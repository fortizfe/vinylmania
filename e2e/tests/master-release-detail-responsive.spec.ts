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

  // Spec 065 (US2/US3): the top gallery/info-stack pair is a plain Flexbox row
  // (`flex flex-col lg:flex-row lg:items-start gap-4`), not a shared CSS Grid
  // row — so a height mismatch between the gallery and the info-stack must
  // never leave dead space before the tracklist card below, sized to the
  // taller of the two (research.md R2).
  test('desktop: the top row and the info-stack sit gap-free even when other-details content is much taller than the gallery (spec 065, US2/US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // A real-dimensioned (400x400) image, not the module-level fixture's
    // unresolvable `https://example.com/cover.jpg` — see the note in the
    // "gallery taller" test below for why an unloaded <img> would silently
    // invalidate this test's premise too (a collapsed gallery is trivially
    // shorter than anything, whether or not the fix works).
    const squareImageDataUri = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#888"/></svg>',
    ).toString('base64')}`;
    const manyGenresMaster = {
      ...masterResponse,
      genres: Array.from({ length: 60 }, (_, i) => `Genre ${i}`),
      styles: Array.from({ length: 60 }, (_, i) => `Style ${i}`),
      images: [{ url: squareImageDataUri, imageType: 'primary' }],
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
        body: JSON.stringify(manyGenresMaster),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByText('Hybrid Theory').first()).toBeVisible();

    // Wait for the cover image to actually decode so the aspect-square
    // gallery card has settled at its real height before measuring.
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>('img[alt="Hybrid Theory"]');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    });

    const [galleryBox, mainInfoBox, otherDetailsBox, tracklistBox] = await Promise.all([
      page.getByTestId('master-detail-gallery-card').boundingBox(),
      page.getByTestId('master-detail-main-info-card').boundingBox(),
      page.getByTestId('master-detail-other-details-card').boundingBox(),
      page.getByTestId('master-detail-tracklist-card').boundingBox(),
    ]);
    expect(galleryBox && mainInfoBox && otherDetailsBox && tracklistBox).toBeTruthy();

    // Sanity check the mismatch is real: 120 wrapped genre/style badges make
    // the info-stack much taller than the fixed-aspect-ratio gallery card.
    const infoStackHeight = otherDetailsBox!.y + otherDetailsBox!.height - mainInfoBox!.y;
    expect(infoStackHeight).toBeGreaterThan(galleryBox!.height + 200);

    // Within the info-stack column: main-info -> other-details stack with
    // only the card gap (`gap-4` = 16px), independent of the gallery's height.
    const infoStackGap = otherDetailsBox!.y - (mainInfoBox!.y + mainInfoBox!.height);
    expect(infoStackGap).toBeGreaterThanOrEqual(8);
    expect(infoStackGap).toBeLessThanOrEqual(24);

    // The tracklist card begins right after the TALLER of the two top-row
    // siblings (here, the info-stack) plus the standard card gap — never
    // with dead space reserved to match the shorter gallery card.
    const rowBottom = Math.max(
      galleryBox!.y + galleryBox!.height,
      otherDetailsBox!.y + otherDetailsBox!.height,
    );
    const rowToTracklistGap = tracklistBox!.y - rowBottom;
    expect(rowToTracklistGap).toBeGreaterThanOrEqual(8);
    expect(rowToTracklistGap).toBeLessThanOrEqual(24);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('desktop: the top row sits gap-free when the gallery is taller than a minimal info-stack with no other-details card (spec 065, US2/US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // A self-contained, real-dimensioned image (600x600 SVG data URI) instead
    // of the module-level fixture's `https://example.com/cover.jpg`: that URL
    // resolves to a generic external page rather than image bytes, so the
    // <img> has no intrinsic size and the aspect-square gallery collapses to
    // a few px — which would silently invert this test's whole premise (the
    // gallery must be measurably TALLER than the info-stack here).
    const squareImageDataUri = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#888"/></svg>',
    ).toString('base64')}`;
    const noOtherDetailsMaster = {
      ...masterResponse,
      year: 0,
      genres: [],
      styles: [],
      images: [{ url: squareImageDataUri, imageType: 'primary' }],
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
        body: JSON.stringify(noOtherDetailsMaster),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByText('Hybrid Theory').first()).toBeVisible();

    // No year/genres/styles: the other-details card does not render at all.
    await expect(page.getByTestId('master-detail-other-details-card')).toHaveCount(0);

    // Wait for the cover image to actually decode so the aspect-square
    // gallery card has settled at its real (non-zero-intrinsic) height
    // before measuring — a data URI decodes fast, but not synchronously.
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>('img[alt="Hybrid Theory"]');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    });

    const [galleryBox, mainInfoBox, tracklistBox] = await Promise.all([
      page.getByTestId('master-detail-gallery-card').boundingBox(),
      page.getByTestId('master-detail-main-info-card').boundingBox(),
      page.getByTestId('master-detail-tracklist-card').boundingBox(),
    ]);
    expect(galleryBox && mainInfoBox && tracklistBox).toBeTruthy();

    // Sanity check the mismatch is real: the title/artist-only info-stack is
    // much shorter than the fixed-aspect-ratio gallery card next to it.
    expect(galleryBox!.height).toBeGreaterThan(mainInfoBox!.height + 200);

    // The tracklist card begins right after the gallery (the taller of the
    // two) plus the standard card gap — not stretched to reserve extra space
    // matching the gallery, and not left with a gap the size of the gallery
    // under the shorter info-stack.
    const gap = tracklistBox!.y - (galleryBox!.y + galleryBox!.height);
    expect(gap).toBeGreaterThanOrEqual(8);
    expect(gap).toBeLessThanOrEqual(24);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: gallery, info-stack and full-width sections keep the same single-column visual order as before this fix (spec 065, US3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToMasterDetail(page);

    const order = [
      'master-detail-gallery-card',
      'master-detail-main-info-card',
      'master-detail-other-details-card',
      'master-detail-tracklist-card',
    ];
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const id of order) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b, `${id} should be measurable`).toBeTruthy();
      boxes.push(b!);
    }
    // Single column: each card aligns to the first card's left edge and sits
    // strictly below the previous one, exactly as before this fix.
    for (let i = 1; i < boxes.length; i += 1) {
      expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(4);
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 1);
    }

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
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
