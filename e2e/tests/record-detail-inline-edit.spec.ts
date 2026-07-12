import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const ENTRY_ID = 'e2e-entry-1';

const BASE_RELEASE = {
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
};

function buildEntry(
  discogsOverrides: Partial<{
    rating: number;
    mediaCondition: string | null;
    sleeveCondition: string | null;
    notes: string | null;
  }> = {},
) {
  return {
    id: ENTRY_ID,
    discogsReleaseId: 1,
    addedAt: '2026-07-04T00:00:00.000Z',
    catalogStatus: 'ok',
    release: BASE_RELEASE,
    discogs: {
      instanceId: 100,
      folderId: 1,
      rating: 0,
      mediaCondition: 'Good (G)',
      sleeveCondition: null,
      notes: 'Bought at a record fair',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
      ...discogsOverrides,
    },
  };
}

test.describe('Record detail per-copy edits (US2 – feature 016)', () => {
  // The Discogs collection calls are routed to the stub via DISCOGS_OAUTH_BASE_URL.
  // Library API responses are intercepted at the Playwright level (route interception)
  // so catalog enrichment does not require a live Discogs token.

  test('editing the Media Condition select autosaves and the new value survives a reload (T032)', async ({
    page,
  }) => {
    let currentMediaCondition: string | null = 'Good (G)';

    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { mediaCondition?: string | null };
        if (body.mediaCondition !== undefined) currentMediaCondition = body.mediaCondition;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildEntry({ mediaCondition: currentMediaCondition })),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry({ mediaCondition: currentMediaCondition })),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const patchRequest = page.waitForRequest(
      (request) => request.url().includes(`/api/library/${ENTRY_ID}`) && request.method() === 'PATCH',
    );

    await page.getByLabel('Media Condition').selectOption('Mint (M)');

    const request = await patchRequest;
    expect(request.postDataJSON()).toEqual({ mediaCondition: 'Mint (M)' });

    // After reload the select should reflect the saved value.
    await page.reload();
    await expect(page.getByLabel('Media Condition')).toHaveValue('Mint (M)');
  });

  test('editing the rating via star buttons autosaves (T032)', async ({ page }) => {
    let currentRating = 0;

    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { rating?: number };
        if (body.rating !== undefined) currentRating = body.rating;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildEntry({ rating: currentRating })),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry({ rating: currentRating })),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const patchRequest = page.waitForRequest(
      (request) => request.url().includes(`/api/library/${ENTRY_ID}`) && request.method() === 'PATCH',
    );

    await page.getByRole('button', { name: '4 stars' }).click();

    const request = await patchRequest;
    expect(request.postDataJSON()).toEqual({ rating: 4 });
  });

  test('renders the gallery, key details, tracklist, and additional info in the correct layout (US1)', async ({
    page,
  }) => {
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);

    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const gallery = page.getByTestId('record-detail-gallery');
    const details = page.getByTestId('record-detail-details');
    const tracklist = page.getByTestId('record-detail-tracklist');
    const additionalInfo = page.getByTestId('record-detail-additional-info');

    const galleryBox = await gallery.boundingBox();
    const detailsBox = await details.boundingBox();
    const tracklistBox = await tracklist.boundingBox();
    const additionalInfoBox = await additionalInfo.boundingBox();
    expect(galleryBox && detailsBox && tracklistBox && additionalInfoBox).toBeTruthy();

    // At the >=1280px desktop composition (spec 035), the gallery sits in
    // its own column beside details+tracklist (same row) rather than above
    // them, using the wide viewport's horizontal space instead of stacking.
    expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(detailsBox!.x).toBeGreaterThan(galleryBox!.x);
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

  test('on a mobile viewport, sections stack top to bottom (US3)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry()),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);

    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

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

    const myCopyBox = await page.getByText('Your copy').boundingBox();
    expect(myCopyBox).not.toBeNull();
    expect(myCopyBox!.y).toBeGreaterThan(detailsBox.y);
    expect(myCopyBox!.y).toBeLessThan(tracklistBox.y);
  });

  test('resizing from desktop to mobile width reflows to single-column order (US3)', async ({
    page,
  }) => {
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildEntry()),
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
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    await expect(page.getByText('Your copy')).toBeVisible();
    await expect(page.getByText(/Östermalm/)).toBeVisible();
  });
});

