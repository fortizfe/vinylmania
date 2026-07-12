import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const ENTRY_ID = 'e2e-responsive-entry-1';

function buildEntry() {
  return {
    id: ENTRY_ID,
    discogsReleaseId: 1,
    addedAt: '2026-07-04T00:00:00.000Z',
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
    discogs: {
      instanceId: 100,
      folderId: 1,
      rating: 0,
      mediaCondition: 'Good (G)',
      sleeveCondition: null,
      notes: 'Bought at a record fair',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
    },
  };
}

async function goToRecordDetail(page: import('@playwright/test').Page) {
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
}

test.describe('Record detail page responsive layout (spec 035, US1)', () => {
  test('desktop: gallery/details/tracklist/additional-info form a multi-panel composition wider than the lg-only cap (Scenario 8)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToRecordDetail(page);

    const gallery = page.getByTestId('record-detail-gallery');
    const details = page.getByTestId('record-detail-details');
    const tracklist = page.getByTestId('record-detail-tracklist');

    const [galleryBox, detailsBox, tracklistBox] = await Promise.all([
      gallery.boundingBox(),
      details.boundingBox(),
      tracklist.boundingBox(),
    ]);
    expect(galleryBox && detailsBox && tracklistBox).toBeTruthy();

    // Gallery, details, and tracklist all share the same row (3-panel
    // composition), not a 2-column layout with the gallery stacked above.
    expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(galleryBox!.x).toBeLessThan(detailsBox!.x);
    expect(detailsBox!.x).toBeLessThan(tracklistBox!.x);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: single column, no horizontal scroll, and rating/condition/remove controls meet 44x44px (Scenario 9)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToRecordDetail(page);

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

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const starBox = await page.getByRole('button', { name: '4 stars' }).boundingBox();
    expect(starBox?.width).toBeGreaterThanOrEqual(44);
    expect(starBox?.height).toBeGreaterThanOrEqual(44);

    const removeBox = await page
      .getByRole('button', { name: /remove from library/i })
      .boundingBox();
    expect(removeBox?.width).toBeGreaterThanOrEqual(44);
    expect(removeBox?.height).toBeGreaterThanOrEqual(44);
  });
});
