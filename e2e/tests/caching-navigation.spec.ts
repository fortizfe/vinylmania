import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const ENTRY_ID = 'e2e-cache-entry-1';

function buildEntry(condition: string) {
  return {
    id: ENTRY_ID,
    discogsReleaseId: 1,
    addedAt: '2026-07-04T00:00:00.000Z',
    condition,
    notes: 'Bought at a record fair',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [],
      formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
      genres: ['Electronic'],
      styles: [],
      tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
  };
}

// Fakes the /api/library boundary at the browser network layer, same
// rationale as record-detail-inline-edit.spec.ts: this suite drives the real
// app/routing/caching behavior in a real browser without depending on a live
// Discogs API or seeded Firestore data.
test.describe('Caching: instant revisits and post-edit freshness (US1, US3)', () => {
  test('revisiting the library list and a record detail page is served from cache, and an edit is reflected on the list without a manual reload', async ({
    page,
  }) => {
    let currentCondition = 'Good';
    let listRequests = 0;
    let detailRequests = 0;

    await page.route('**/api/library?*', async (route) => {
      listRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [buildEntry(currentCondition)],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      });
    });

    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { condition?: string };
        currentCondition = body.condition ?? currentCondition;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildEntry(currentCondition)),
        });
        return;
      }

      detailRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry(currentCondition)),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // First visit to the library list: one request, record renders.
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();
    expect(listRequests).toBe(1);

    // First visit to the record's detail page: one request, detail renders.
    await page.getByText('Stockholm').click();
    await expect(page.getByRole('heading', { name: /your copy/i })).toBeVisible();
    expect(detailRequests).toBe(1);

    // Revisit the library list within the cache's freshness window: no new
    // request — this is the "instant revisit" behavior FR-001/FR-002/SC-001 require.
    await page.getByRole('link', { name: /back/i }).click();
    await expect(page.getByText('Stockholm')).toBeVisible();
    expect(listRequests).toBe(1);

    // Revisit the same detail page again: still no new request.
    await page.getByText('Stockholm').click();
    await expect(page.getByRole('heading', { name: /your copy/i })).toBeVisible();
    expect(detailRequests).toBe(1);

    // Edit the condition — this must invalidate the cached library list.
    const patchRequest = page.waitForRequest(
      (request) => request.url().includes(`/api/library/${ENTRY_ID}`) && request.method() === 'PATCH',
    );
    await page.getByText('Good', { exact: true }).click();
    await page.getByLabel('Condition').selectOption('Mint');
    await page.getByLabel('Condition').blur();
    await patchRequest;
    await expect(page.getByText('Mint', { exact: true })).toBeVisible();

    // Navigating back to the library list must show the update immediately,
    // with no manual reload (US3, FR-004/SC-004).
    await page.getByRole('link', { name: /back/i }).click();
    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByText('Mint', { exact: true })).toBeVisible();
  });
});

// Fakes the /api/discogs/search and /api/library boundaries at the browser
// network layer, same rationale as the caching suite above: drives the real
// search-result rendering and add flow without depending on a live Discogs API.
test.describe('Record rating badges on search-result cards (feature 017, US1)', () => {
  test('shows the correctly colored rating badge on an enriched result and does not block add-to-library', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              discogsId: 501,
              resultType: 'release',
              title: 'Highly Rated Release',
              artist: 'Test Artist',
              year: 1999,
              formats: ['Vinyl'],
              communityRating: { average: 4.5, count: 30 },
            },
            {
              discogsId: 502,
              resultType: 'release',
              title: 'Unrated Release',
              artist: 'Test Artist',
              year: 2001,
              formats: ['Vinyl'],
            },
          ],
          pagination: { page: 1, pages: 1, items: 2, perPage: 20 },
        }),
      });
    });

    await page.route('**/api/library', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'entry-501',
          discogsReleaseId: 501,
          addedAt: '2026-07-06T00:00:00.000Z',
          catalogStatus: 'ok',
          release: { discogsId: 501, title: 'Highly Rated Release' },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('rated');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);

    await expect(page.getByText('Highly Rated Release')).toBeVisible();
    await expect(page.getByText('Unrated Release')).toBeVisible();

    // Exactly one badge renders, on the enriched result, with the correct value.
    await expect(page.getByRole('status')).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText('4.5');

    const ratedCard = page.locator('li', { hasText: 'Highly Rated Release' });
    await expect(ratedCard.getByRole('button', { name: /add to library/i })).toBeVisible();
    await ratedCard.getByRole('button', { name: /add to library/i }).click();
    await expect(ratedCard.getByRole('button', { name: /added to library/i })).toBeVisible();
  });

  test('badge stays contained within the thumbnail on a narrow viewport (US3)', async ({ page }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              discogsId: 601,
              resultType: 'release',
              title: 'Narrow Viewport Release',
              artist: 'Test Artist',
              year: 1999,
              formats: ['Vinyl'],
              communityRating: { average: 4.5, count: 30 },
            },
          ],
          pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByLabel(/search discogs/i).fill('narrow');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);

    await expect(page.getByText('Narrow Viewport Release')).toBeVisible();

    const card = page.locator('li', { hasText: 'Narrow Viewport Release' });
    const badge = card.getByRole('status');
    await expect(badge).toBeVisible();

    const cardBox = await card.boundingBox();
    const badgeBox = await badge.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();

    // The badge must remain fully inside the card's bounds — no overlap,
    // truncation, or overflow at a narrow (mobile) width (spec FR-011).
    if (cardBox && badgeBox) {
      expect(badgeBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(badgeBox.y).toBeGreaterThanOrEqual(cardBox.y);
      expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
    }
  });
});
