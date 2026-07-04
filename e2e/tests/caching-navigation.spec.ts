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
