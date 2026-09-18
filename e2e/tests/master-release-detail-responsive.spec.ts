import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
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
  await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();
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
        await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();
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

      // Tracklist and the versions table share the gallery card's column
      // (the left column) and stack strictly below it, independent of the
      // main-info/other-details column's own height — the two columns
      // stack independently, with no shared row track between them (spec
      // 064 fixes the old shared-row gap defect).
      expect(Math.abs(tracklistBox!.x - galleryBox!.x)).toBeLessThan(4);
      expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
      expect(Math.abs(versionsBox!.x - galleryBox!.x)).toBeLessThan(4);
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

  test('desktop: an uneven height between columns never creates a gap within the shorter column, in either direction (spec 064)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    let signedIn = false;

    async function checkNoGapsInLeftColumn(master: typeof masterResponse) {
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
          body: JSON.stringify(master),
        });
      });

      if (!signedIn) {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);
        await page.goto(`/app/masters/${MASTER_ID}`);
        signedIn = true;
      } else {
        await page.reload();
      }
      await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();

      const gallery = page.getByTestId('master-detail-gallery-card');
      const tracklist = page.getByTestId('master-detail-tracklist-card');
      const versions = page.getByTestId('master-detail-versions-card');

      const [galleryBox, tracklistBox, versionsBox] = await Promise.all([
        gallery.boundingBox(),
        tracklist.boundingBox(),
        versions.boundingBox(),
      ]);
      expect(galleryBox && tracklistBox && versionsBox).toBeTruthy();

      // gap-4 is 16px; allow a little slack for card padding/border
      // rounding, but nothing near the size of an unfilled row-track gap.
      const galleryToTracklistGap = tracklistBox!.y - (galleryBox!.y + galleryBox!.height);
      const tracklistToVersionsGap = versionsBox!.y - (tracklistBox!.y + tracklistBox!.height);

      expect(galleryToTracklistGap).toBeLessThan(20);
      expect(tracklistToVersionsGap).toBeLessThan(20);
    }

    // (a) minimal main-info/other-details (short right column) + a long
    // tracklist (tall left column): the left column must stay gap-free
    // even though it is now much taller than the right column.
    const longTracklistMinimalDetails = {
      ...masterResponse,
      genres: [],
      styles: [],
      tracklist: Array.from({ length: 15 }, (_, i) => ({
        position: `${i + 1}`,
        title: `Track ${i + 1}`,
        duration: '3:30',
      })),
    };
    await checkNoGapsInLeftColumn(longTracklistMinimalDetails);

    // (b) many artists — each rendered on its own line by
    // MasterReleaseDetailsSection, reliably making the right column
    // (main-info + other-details) taller than the gallery card (the old
    // bug's trigger) — plus a short tracklist (short left column): the
    // left column must not wait for the taller right column to finish
    // before continuing its own stack.
    const shortTracklistRichDetails = {
      ...masterResponse,
      artists: Array.from({ length: 40 }, (_, i) => ({
        discogsArtistId: i + 1,
        name: `Featured Artist ${i + 1}`,
      })),
      tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
    };
    await checkNoGapsInLeftColumn(shortTracklistRichDetails);
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
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();

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

    // Unified column-grouped order (spec 064, research.md Decision 5):
    // gallery -> tracklist -> versions (left column), then main-info ->
    // other-details (right column). The default fixture has year/genres/
    // styles set, so the other-details card is present.
    const gallery = page.getByTestId('master-detail-gallery-card');
    const tracklist = page.getByTestId('master-detail-tracklist-card');
    const versions = page.getByTestId('master-detail-versions-card');
    const mainInfo = page.getByTestId('master-detail-main-info-card');
    const otherDetails = page.getByTestId('master-detail-other-details-card');

    const [galleryBox, tracklistBox, versionsBox, mainInfoBox, otherDetailsBox] =
      await Promise.all([
        gallery.boundingBox(),
        tracklist.boundingBox(),
        versions.boundingBox(),
        mainInfo.boundingBox(),
        otherDetails.boundingBox(),
      ]);
    expect(
      galleryBox && tracklistBox && versionsBox && mainInfoBox && otherDetailsBox,
    ).toBeTruthy();
    expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
    expect(versionsBox!.y).toBeGreaterThan(tracklistBox!.y);
    expect(mainInfoBox!.y).toBeGreaterThan(versionsBox!.y);
    expect(otherDetailsBox!.y).toBeGreaterThan(mainInfoBox!.y);

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
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();

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

test.describe('Master release detail responsive WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await goToMasterDetail(page);

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});
