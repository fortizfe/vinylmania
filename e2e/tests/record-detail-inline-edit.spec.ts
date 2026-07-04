import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const ENTRY_ID = 'e2e-entry-1';

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

test.describe('Record detail inline edit (US1)', () => {
  // The Discogs catalog lookup this page depends on requires a live,
  // rate-limited third-party API and an API token — not something this e2e
  // suite has for CI (per the sign-in specs, this project deliberately never
  // depends on a live third party). Per plan.md/research.md, this feature is
  // frontend-only: the inline-edit behavior under test lives entirely in
  // RecordDetailPage/InlineEditableField and only needs *some* library entry
  // response to render, so the library API is faked at the browser network
  // boundary (Playwright route interception) rather than by seeding Firestore
  // or hitting the real Discogs API. This still drives the real page, real
  // routing, and the real autosave PATCH call in a real browser.
  test('editing the condition field inline autosaves and the new value survives a reload', async ({
    page,
  }) => {
    // Stateful across GET/PATCH so a reload after saving reflects the saved
    // value, the same way the real backend/Firestore would persist it.
    let currentCondition = 'Good';

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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry(currentCondition)),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0);

    const patchRequest = page.waitForRequest(
      (request) => request.url().includes(`/api/library/${ENTRY_ID}`) && request.method() === 'PATCH',
    );

    await page.getByText('Good', { exact: true }).click();
    await page.getByLabel('Condition').selectOption('Mint');
    await page.getByLabel('Condition').blur();

    const request = await patchRequest;
    expect(request.postDataJSON()).toEqual({ condition: 'Mint' });
    await expect(page.getByText('Mint', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Mint', { exact: true })).toBeVisible();
  });
});
