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
      country: 'Sweden',
      releaseDate: '1999-05-01',
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
      formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
      genres: ['Electronic'],
      styles: ['Deep House'],
      notes: 'Recorded at Stockholm Sound Studio.',
      identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
      community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
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

  test('renders the gallery, key details (including format), tracklist, and additional info in the same layout as the release preview (US1)', async ({
    page,
  }) => {
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry('Good')),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);

    await expect(page.getByText('Stockholm')).toBeVisible();

    const gallery = page.getByTestId('record-detail-gallery');
    const details = page.getByTestId('record-detail-details');
    const tracklist = page.getByTestId('record-detail-tracklist');
    const additionalInfo = page.getByTestId('record-detail-additional-info');

    // Desktop viewport (Playwright's default project viewport): key details render
    // in the left column, tracklist in the right column, both below the gallery.
    const galleryBox = await gallery.boundingBox();
    const detailsBox = await details.boundingBox();
    const tracklistBox = await tracklist.boundingBox();
    const additionalInfoBox = await additionalInfo.boundingBox();
    expect(galleryBox && detailsBox && tracklistBox && additionalInfoBox).toBeTruthy();

    expect(detailsBox!.y).toBeGreaterThanOrEqual(galleryBox!.y + galleryBox!.height);
    expect(detailsBox!.x).toBeLessThan(tracklistBox!.x);
    expect(Math.abs(detailsBox!.y - tracklistBox!.y)).toBeLessThan(4);
    expect(additionalInfoBox!.y).toBeGreaterThanOrEqual(tracklistBox!.y + tracklistBox!.height);

    await expect(page.getByText(/Vinyl/)).toBeVisible();
    await expect(page.getByText('Deep House')).toBeVisible();
    await expect(page.getByText('Sweden')).toBeVisible();
    await expect(page.getByText(/Svek/)).toBeVisible();
    await expect(page.getByText(/Östermalm/)).toBeVisible();
    await expect(page.getByText('Recorded at Stockholm Sound Studio.')).toBeVisible();
    await expect(page.getByText(/Barcode/)).toBeVisible();
  });

  test('on a mobile viewport, sections stack top to bottom: gallery, key details, my copy, tracklist, additional info (US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry('Good')),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);

    await expect(page.getByText('Stockholm')).toBeVisible();

    const gallery = page.getByTestId('record-detail-gallery');
    const details = page.getByTestId('record-detail-details');
    const tracklist = page.getByTestId('record-detail-tracklist');
    const additionalInfo = page.getByTestId('record-detail-additional-info');

    const boxes = await Promise.all([
      gallery.boundingBox(),
      details.boundingBox(),
      tracklist.boundingBox(),
      additionalInfo.boundingBox(),
    ]);
    if (boxes.includes(null)) {
      throw new Error('Expected all four section bounding boxes to be measurable');
    }
    const [galleryBox, detailsBox, tracklistBox, additionalInfoBox] = boxes as NonNullable<
      (typeof boxes)[number]
    >[];

    expect(detailsBox.y).toBeGreaterThan(galleryBox.y);
    expect(tracklistBox.y).toBeGreaterThan(detailsBox.y);
    expect(additionalInfoBox.y).toBeGreaterThan(tracklistBox.y);

    // "Your copy" is part of the details section (left column), directly below key details.
    const myCopyBox = await page.getByText('Your copy').boundingBox();
    expect(myCopyBox).not.toBeNull();
    expect(myCopyBox!.y).toBeGreaterThan(detailsBox.y);
    expect(myCopyBox!.y).toBeLessThan(tracklistBox.y);
  });

  test('resizing from desktop to mobile width reflows to single-column order with no duplicated or missing sections (US3)', async ({
    page,
  }) => {
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry('Good')),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByTestId('record-detail-gallery')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByTestId('record-detail-gallery')).toHaveCount(1);
    await expect(page.getByTestId('record-detail-details')).toHaveCount(1);
    await expect(page.getByTestId('record-detail-tracklist')).toHaveCount(1);
    await expect(page.getByTestId('record-detail-additional-info')).toHaveCount(1);
    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByText('Your copy')).toBeVisible();
    await expect(page.getByText(/Östermalm/)).toBeVisible();
  });
});
