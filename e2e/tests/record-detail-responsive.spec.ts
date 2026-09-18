import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
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
  test('desktop: gallery and details form a two-column row from lg (1024px), tracklist/additional-info render full-width below, and there is no distinct state before xl (spec 044, US2)', async ({
    page,
  }) => {
    let signedIn = false;
    async function checkComposition(width: number, height: number) {
      await page.setViewportSize({ width, height });
      if (!signedIn) {
        await goToRecordDetail(page);
        signedIn = true;
      } else {
        // Already authenticated from the first call — reload instead of
        // re-running the sign-in flow (the Google popup only appears once
        // per session).
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
      }

      const gallery = page.getByTestId('record-detail-gallery-card');
      const mainInfo = page.getByTestId('record-detail-main-info-card');
      const yourCopy = page.getByTestId('record-detail-your-copy-card');
      const tracklist = page.getByTestId('record-detail-tracklist-card');
      const otherDetails = page.getByTestId('record-detail-other-details-card');

      const [galleryBox, mainInfoBox, yourCopyBox, tracklistBox, otherDetailsBox] =
        await Promise.all([
          gallery.boundingBox(),
          mainInfo.boundingBox(),
          yourCopy.boundingBox(),
          tracklist.boundingBox(),
          otherDetails.boundingBox(),
        ]);
      expect(galleryBox && mainInfoBox && yourCopyBox && tracklistBox && otherDetailsBox).toBeTruthy();

      // Gallery and the main-info/your-copy column share a row (two-column
      // composition), not a 3-panel row with the tracklist beside them.
      expect(Math.abs(mainInfoBox!.y - galleryBox!.y)).toBeLessThan(4);
      expect(galleryBox!.x).toBeLessThan(mainInfoBox!.x);
      expect(yourCopyBox!.y).toBeGreaterThan(mainInfoBox!.y);

      // Tracklist and other-details share the gallery card's column (the
      // left column) and stack strictly below it, independent of the right
      // column's own height — the two columns stack independently, with no
      // shared row track between them (spec 064 fixes the old shared-row
      // gap defect).
      expect(Math.abs(tracklistBox!.x - galleryBox!.x)).toBeLessThan(4);
      expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
      expect(Math.abs(otherDetailsBox!.x - galleryBox!.x)).toBeLessThan(4);
      expect(otherDetailsBox!.y).toBeGreaterThan(tracklistBox!.y);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      return { galleryBox: galleryBox!, mainInfoBox: mainInfoBox!, yourCopyBox: yourCopyBox! };
    }

    const lgRange = await checkComposition(1024, 900);
    const xlRange = await checkComposition(1280, 900);

    // No distinct intermediate state between lg and xl (spec FR-011).
    expect(Math.abs(lgRange.galleryBox.x - xlRange.galleryBox.x)).toBeLessThan(4);

    // Top-alignment / no-stretch (spec FR-011a, /speckit-clarify): this page
    // has the tallest right-column content of the three (main info + your
    // copy, stacked as two cards), so the combined right column extends well
    // past the gallery card's own height. Neither column should stretch to
    // match the other's height — the gallery must stay at its own
    // square-derived height, not the taller right column's height.
    expect(lgRange.yourCopyBox.y + lgRange.yourCopyBox.height).toBeGreaterThan(
      lgRange.galleryBox.y + lgRange.galleryBox.height,
    );
    expect(lgRange.galleryBox.height).toBeLessThanOrEqual(lgRange.galleryBox.width + 1);
  });

  test('desktop: the no-cover placeholder stays contained within the gallery column of the two-column lg-range layout (spec 044, FR-014)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    const noImagesEntry = buildEntry();
    noImagesEntry.release.images = [];
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noImagesEntry),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const gallery = page.getByTestId('record-detail-gallery-card');
    const mainInfo = page.getByTestId('record-detail-main-info-card');

    const [galleryBox, mainInfoBox] = await Promise.all([
      gallery.boundingBox(),
      mainInfo.boundingBox(),
    ]);
    expect(galleryBox && mainInfoBox).toBeTruthy();

    expect(Math.abs(mainInfoBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(galleryBox!.x + galleryBox!.width).toBeLessThanOrEqual(mainInfoBox!.x + 1);

    await expect(page.getByText(/no cover image available/i)).toBeVisible();
  });

  test('desktop: an uneven height between columns never creates a gap within the shorter column, in either direction (spec 064)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    let signedIn = false;

    async function checkNoGapsInLeftColumn(fixture: ReturnType<typeof buildEntry>) {
      await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixture),
        });
      });
      if (!signedIn) {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);
        await page.goto(`/app/library/records/${ENTRY_ID}`);
        signedIn = true;
      } else {
        await page.reload();
      }
      await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

      const gallery = page.getByTestId('record-detail-gallery-card');
      const tracklist = page.getByTestId('record-detail-tracklist-card');
      const otherDetails = page.getByTestId('record-detail-other-details-card');

      const [galleryBox, tracklistBox, otherDetailsBox] = await Promise.all([
        gallery.boundingBox(),
        tracklist.boundingBox(),
        otherDetails.boundingBox(),
      ]);
      expect(galleryBox && tracklistBox && otherDetailsBox).toBeTruthy();

      // gap-4 is 16px; allow a little slack for card padding/border
      // rounding, but nothing near the size of an unfilled row-track gap.
      const galleryToTracklistGap = tracklistBox!.y - (galleryBox!.y + galleryBox!.height);
      const tracklistToOtherDetailsGap =
        otherDetailsBox!.y - (tracklistBox!.y + tracklistBox!.height);

      expect(galleryToTracklistGap).toBeLessThan(20);
      expect(tracklistToOtherDetailsGap).toBeLessThan(20);
    }

    // (a) minimal "Your Copy" (short right column) + a long tracklist (tall
    // left column): the left column must stay gap-free even though it is
    // now much taller than the right column.
    const shortCopyLongTracklist = buildEntry();
    shortCopyLongTracklist.discogs = {
      instanceId: 100,
      folderId: 1,
      rating: 0,
      mediaCondition: null,
      sleeveCondition: null,
      notes: '',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
    };
    shortCopyLongTracklist.release.tracklist = Array.from({ length: 15 }, (_, i) => ({
      position: `${i + 1}`,
      title: `Track ${i + 1}`,
      duration: '3:30',
    }));
    await checkNoGapsInLeftColumn(shortCopyLongTracklist);

    // (b) full "Your Copy" (tall right column — the old bug's trigger) + a
    // short tracklist (short left column): the left column must not wait
    // for the taller right column to finish before continuing its own
    // stack.
    const fullCopyShortTracklist = buildEntry();
    fullCopyShortTracklist.discogs = {
      instanceId: 100,
      folderId: 1,
      rating: 5,
      mediaCondition: 'Near Mint (NM or M-)',
      sleeveCondition: 'Very Good Plus (VG+)',
      notes:
        'A long note about this specific copy, added deliberately to make the "Your Copy" card noticeably taller than usual for this regression test.',
      editable: { mediaCondition: true, sleeveCondition: true, notes: true },
    };
    await checkNoGapsInLeftColumn(fullCopyShortTracklist);
  });

  test('mobile: single column, no horizontal scroll, and rating/condition/remove controls meet 44x44px (Scenario 9)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToRecordDetail(page);

    const gallery = page.getByTestId('record-detail-gallery-card');
    const mainInfo = page.getByTestId('record-detail-main-info-card');
    const yourCopy = page.getByTestId('record-detail-your-copy-card');
    const tracklist = page.getByTestId('record-detail-tracklist-card');
    const otherDetails = page.getByTestId('record-detail-other-details-card');

    const boxes = await Promise.all([
      gallery.boundingBox(),
      mainInfo.boundingBox(),
      yourCopy.boundingBox(),
      tracklist.boundingBox(),
      otherDetails.boundingBox(),
    ]);
    if (boxes.includes(null)) {
      throw new Error('Expected all five card bounding boxes to be measurable');
    }
    const [galleryBox, mainInfoBox, yourCopyBox, tracklistBox, otherDetailsBox] =
      boxes as NonNullable<(typeof boxes)[number]>[];
    // Unified column-grouped order (spec 064, research.md Decision 5):
    // gallery -> tracklist -> other-details (left column), then main-info
    // -> your-copy (right column).
    expect(tracklistBox.y).toBeGreaterThan(galleryBox.y);
    expect(otherDetailsBox.y).toBeGreaterThan(tracklistBox.y);
    expect(mainInfoBox.y).toBeGreaterThan(otherDetailsBox.y);
    expect(yourCopyBox.y).toBeGreaterThan(mainInfoBox.y);

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

  test('mobile: the thumbnail column never exceeds the main image height, even with many images (spec 043, US1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const manyImagesEntry = buildEntry();
    manyImagesEntry.release.images = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/cover-${i}.jpg`,
      imageType: i === 0 ? 'primary' : 'secondary',
    }));
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manyImagesEntry),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const mainImage = page.getByRole('img', { name: 'Stockholm' });
    const thumbnailStrip = page
      .getByRole('button', { name: /show image 1 of 12/i })
      .locator('xpath=..');

    const [mainImageBox, thumbnailStripBox] = await Promise.all([
      mainImage.boundingBox(),
      thumbnailStrip.boundingBox(),
    ]);
    expect(mainImageBox && thumbnailStripBox).toBeTruthy();
    expect(thumbnailStripBox!.height).toBeLessThanOrEqual(mainImageBox!.height + 1);

    const scrollableHeight = await thumbnailStrip.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(scrollableHeight).toBe(true);

    const hasVisibleScrollbar = await thumbnailStrip.evaluate(
      (el) => el.offsetWidth - el.clientWidth > 0,
    );
    expect(hasVisibleScrollbar).toBe(false);
  });

  test('the no-cover placeholder does not open a fullscreen viewer, and a real image does, with the X closing it (spec 043, US2)', async ({
    page,
  }) => {
    await goToRecordDetail(page);

    // Default fixture has no images: clicking the placeholder opens nothing.
    await page.getByText(/no cover image available/i).click();
    await expect(page.getByTestId('gallery-fullscreen-viewer')).not.toBeVisible();

    const oneImageEntry = buildEntry();
    oneImageEntry.release.images = [
      { url: 'https://example.com/cover-front.jpg', imageType: 'primary' },
    ];
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(oneImageEntry),
      });
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    const fullscreenViewer = page.getByTestId('gallery-fullscreen-viewer');
    await expect(fullscreenViewer).toBeVisible();

    await page.getByTestId('gallery-fullscreen-close').click();
    await expect(fullscreenViewer).not.toBeVisible();
  });
});

test.describe('Record detail responsive WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await goToRecordDetail(page);

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});
