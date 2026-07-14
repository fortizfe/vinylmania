import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const MASTER_ID = 1660109;

const masterResponse = {
  discogsId: MASTER_ID,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' }],
  tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
  mainReleaseId: 98765,
  discogsUrl: 'https://www.discogs.com/master/1660109',
};

function versionsResponse() {
  return {
    results: Array.from({ length: 10 }, (_, i) => ({
      discogsId: 90000 + i,
      title: `Hybrid Theory Version ${i}`,
      format: 'Vinyl, LP, Album',
      year: 2000,
      label: 'Warner Bros. Records',
      country: 'US',
    })),
    pagination: { page: 1, pages: 2, items: 11, perPage: 10 },
  };
}

async function goToMasterDetail(page: import('@playwright/test').Page) {
  await page.route(`**/api/discogs/masters/${MASTER_ID}/versions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(versionsResponse()),
    });
  });
  await page.route(`**/api/discogs/masters/${MASTER_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(masterResponse),
    });
  });

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto(`/app/masters/${MASTER_ID}`);
  await expect(page.getByText('Hybrid Theory').first()).toBeVisible();
}

test.describe('Master release detail page responsive layout (spec 035, US1)', () => {
  test('desktop: gallery/details/tracklist form a multi-panel composition wider than the lg-only cap (Scenario 8)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToMasterDetail(page);

    const gallery = page.getByTestId('master-detail-gallery');
    const details = page.getByTestId('master-detail-details');
    const tracklist = page.getByTestId('master-detail-tracklist');

    const [galleryBox, detailsBox, tracklistBox] = await Promise.all([
      gallery.boundingBox(),
      details.boundingBox(),
      tracklist.boundingBox(),
    ]);
    expect(galleryBox && detailsBox && tracklistBox).toBeTruthy();
    expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(galleryBox!.x).toBeLessThan(detailsBox!.x);
    expect(detailsBox!.x).toBeLessThan(tracklistBox!.x);

    // Desktop keeps the versions table (not the mobile card list).
    await expect(page.locator('table')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: no horizontal scroll in the versions area, card list instead of a table, and Previous/Next buttons meet 44x44px (Scenario 9)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToMasterDetail(page);

    await expect(page.getByTestId('master-versions-cards')).toBeVisible();
    await expect(page.locator('table')).toBeHidden();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const nextButton = page.getByRole('button', { name: /^next$/i });
    const box = await nextButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('lg-range desktop: the main image stays contained and the thumbnail column never exceeds it, even with many images (spec 043, US1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });

    const manyImagesMaster = {
      ...masterResponse,
      images: Array.from({ length: 12 }, (_, i) => ({
        url: `https://example.com/cover-${i}.jpg`,
        imageType: i === 0 ? 'primary' : 'secondary',
      })),
    };
    await page.route(`**/api/discogs/masters/${MASTER_ID}/versions**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(versionsResponse()),
      });
    });
    await page.route(`**/api/discogs/masters/${MASTER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manyImagesMaster),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByText('Hybrid Theory').first()).toBeVisible();

    const mainImage = page.getByRole('img', { name: 'Hybrid Theory' });
    const thumbnailStrip = page
      .getByRole('button', { name: /show image 1 of 12/i })
      .locator('xpath=..');

    const [mainImageBox, thumbnailStripBox] = await Promise.all([
      mainImage.boundingBox(),
      thumbnailStrip.boundingBox(),
    ]);
    expect(mainImageBox && thumbnailStripBox).toBeTruthy();
    expect(mainImageBox!.width).toBeLessThanOrEqual(480);
    expect(thumbnailStripBox!.height).toBeLessThanOrEqual(mainImageBox!.height + 1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('a single-image release opens a fullscreen viewer with no thumbnail strip, closable via Escape (spec 043, US2)', async ({
    page,
  }) => {
    await goToMasterDetail(page);

    await page.getByRole('button', { name: /view hybrid theory fullscreen/i }).click();
    const fullscreenViewer = page.getByTestId('gallery-fullscreen-viewer');
    await expect(fullscreenViewer).toBeVisible();
    await expect(fullscreenViewer.getByRole('button', { name: /show image/i })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(fullscreenViewer).not.toBeVisible();
  });
});
