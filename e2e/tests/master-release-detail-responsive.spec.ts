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
  test('desktop: gallery and details form a two-column row from lg (1024px), tracklist and versions table render full-width below, and there is no distinct state before xl (spec 044, US2)', async ({
    page,
  }) => {
    let signedIn = false;
    async function checkComposition(width: number, height: number) {
      await page.setViewportSize({ width, height });
      if (!signedIn) {
        await goToMasterDetail(page);
        signedIn = true;
      } else {
        // Already authenticated from the first call — reload instead of
        // re-running the sign-in flow (the Google popup only appears once
        // per session).
        await page.reload();
        await expect(page.getByText('Hybrid Theory').first()).toBeVisible();
      }

      const gallery = page.getByTestId('master-detail-gallery-card');
      const mainInfo = page.getByTestId('master-detail-main-info-card');
      const otherDetails = page.getByTestId('master-detail-other-details-card');
      const tracklist = page.getByTestId('master-detail-tracklist-card');
      const versions = page.getByTestId('master-detail-versions-card');

      const [galleryBox, mainInfoBox, otherDetailsBox, tracklistBox, versionsBox] =
        await Promise.all([
          gallery.boundingBox(),
          mainInfo.boundingBox(),
          otherDetails.boundingBox(),
          tracklist.boundingBox(),
          versions.boundingBox(),
        ]);
      expect(
        galleryBox && mainInfoBox && otherDetailsBox && tracklistBox && versionsBox,
      ).toBeTruthy();

      // Gallery and the main-info/other-details column share a row (two-column composition).
      expect(Math.abs(mainInfoBox!.y - galleryBox!.y)).toBeLessThan(4);
      expect(galleryBox!.x).toBeLessThan(mainInfoBox!.x);
      expect(otherDetailsBox!.y).toBeGreaterThan(mainInfoBox!.y);

      // Tracklist and the versions table both render full-width below the
      // gallery/info column, not beside it as extra panels (spec 057
      // FR-009/FR-010), in their current visual order (tracklist first).
      expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
      expect(tracklistBox!.y).toBeGreaterThan(otherDetailsBox!.y);
      expect(versionsBox!.y).toBeGreaterThan(tracklistBox!.y);

      // Desktop keeps the versions table (not the mobile card list).
      await expect(page.locator('table')).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      return { galleryBox: galleryBox! };
    }

    const lgRange = await checkComposition(1024, 900);
    const xlRange = await checkComposition(1280, 900);

    // No distinct intermediate state between lg and xl (spec FR-011).
    expect(Math.abs(lgRange.galleryBox.x - xlRange.galleryBox.x)).toBeLessThan(4);
  });

  test('desktop: the no-cover placeholder stays contained within the gallery column of the two-column lg-range layout (spec 044, FR-014)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    const noImagesMaster = { ...masterResponse, images: [] };
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
        body: JSON.stringify(noImagesMaster),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByText('Hybrid Theory').first()).toBeVisible();

    const gallery = page.getByTestId('master-detail-gallery-card');
    const mainInfo = page.getByTestId('master-detail-main-info-card');

    const [galleryBox, mainInfoBox] = await Promise.all([
      gallery.boundingBox(),
      mainInfo.boundingBox(),
    ]);
    expect(galleryBox && mainInfoBox).toBeTruthy();

    expect(Math.abs(mainInfoBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(galleryBox!.x + galleryBox!.width).toBeLessThanOrEqual(mainInfoBox!.x + 1);

    await expect(page.getByText(/no cover image available/i)).toBeVisible();
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

    // Confirm the strip is actually clipped and scrolling internally, not
    // simply growing in lockstep with the main image (spec 044, research.md
    // Decision 1): under the WebKit bug this feature fixes, the whole
    // gallery row — main image and thumbnail strip alike — grows together
    // to fit every thumbnail, so the height-comparison assertion above
    // alone would still pass even with the bug present.
    const scrollableHeight = await thumbnailStrip.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(scrollableHeight).toBe(true);

    const hasVisibleScrollbar = await thumbnailStrip.evaluate(
      (el) => el.offsetWidth - el.clientWidth > 0,
    );
    expect(hasVisibleScrollbar).toBe(false);

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
