import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { waitForStableCardGeometry } from '../helpers/columnLayout';
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

      // Tracklist and other-details both render full-width below the
      // gallery/main-info row (spec 057 FR-009/FR-010).
      expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
      expect(tracklistBox!.y).toBeGreaterThan(yourCopyBox!.y);
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
    expect(mainInfoBox.y).toBeGreaterThan(galleryBox.y);
    expect(yourCopyBox.y).toBeGreaterThan(mainInfoBox.y);
    expect(tracklistBox.y).toBeGreaterThan(yourCopyBox.y);
    expect(otherDetailsBox.y).toBeGreaterThan(tracklistBox.y);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    // Feature 063 US2: scope to the RatingCard's star group — the library view
    // transiently renders a second star group in MyCopySection (removed in US3).
    const starBox = await page
      .getByTestId('record-detail-rating-card')
      .getByRole('button', { name: '4 stars' })
      .boundingBox();
    expect(starBox?.width).toBeGreaterThanOrEqual(44);
    expect(starBox?.height).toBeGreaterThanOrEqual(44);

    // The canonical Remove control lives in the action bar (feature 063 US1);
    // MyCopySection still renders a transient duplicate until US3, so scope the
    // locator to the action bar.
    const removeBox = await page
      .getByTestId('record-detail-actions')
      .getByRole('button', { name: /remove from library/i })
      .boundingBox();
    expect(removeBox?.width).toBeGreaterThanOrEqual(44);
    expect(removeBox?.height).toBeGreaterThanOrEqual(44);
  });

  // Feature 063 (US1, contracts/ui-contracts.md §C1 + §C2): the library view is
  // recomposed onto the shared `RecordDetailLayout`. On `lg:` and up the
  // gallery, rating and streaming sections sit in the narrow left grid column;
  // the general-info, "estado de mi copia", tracklist and catalog sections sit
  // in the wider right grid column. This is an honest two-column "media-left"
  // grid, NOT a sticky rail — the `lg:sticky lg:top-6` was removed from the
  // left-column slots because it had ~zero scroll travel and its stacking
  // context trapped the gallery's fullscreen overlay (`z-50`) beneath
  // `AppHeader` (`z-40`). There is no single element wrapping the three
  // left-column sections — assert on column placement, not containment.
  async function stubStreamingMatch(page: import('@playwright/test').Page) {
    await page.route('**/api/streaming/links**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          links: [
            { platform: 'apple_music', url: 'https://music.apple.com/es/album/x/123' },
          ],
        }),
      });
    });
  }

  test('desktop: gallery, rating and streaming sit in the narrow left grid column; general-info, your-copy, tracklist and catalog in the wider right column (feature 063, US1)', async ({
    page,
  }) => {
    await stubStreamingMatch(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await goToRecordDetail(page);
    await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

    const rail = page.getByTestId('record-detail-rail');
    const [
      railBox,
      galleryBox,
      ratingBox,
      streamingBox,
      mainInfoBox,
      yourCopyBox,
      tracklistBox,
      otherDetailsBox,
    ] = await Promise.all([
      rail.boundingBox(),
      page.getByTestId('record-detail-gallery-card').boundingBox(),
      page.getByTestId('record-detail-rating-card').boundingBox(),
      page.getByTestId('record-detail-streaming-card').boundingBox(),
      page.getByTestId('record-detail-main-info-card').boundingBox(),
      page.getByTestId('record-detail-your-copy-card').boundingBox(),
      page.getByTestId('record-detail-tracklist-card').boundingBox(),
      page.getByTestId('record-detail-other-details-card').boundingBox(),
    ]);
    for (const b of [
      railBox,
      galleryBox,
      ratingBox,
      streamingBox,
      mainInfoBox,
      yourCopyBox,
      tracklistBox,
      otherDetailsBox,
    ]) {
      expect(b).toBeTruthy();
    }

    // Left column: gallery, rating and streaming share a left offset and none
    // overlaps into the right column.
    const rightColumnLeft = Math.min(
      mainInfoBox!.x,
      yourCopyBox!.x,
      tracklistBox!.x,
      otherDetailsBox!.x,
    );
    for (const leftCard of [galleryBox!, ratingBox!, streamingBox!]) {
      expect(Math.abs(leftCard.x - galleryBox!.x)).toBeLessThan(4);
      expect(leftCard.x + leftCard.width).toBeLessThanOrEqual(rightColumnLeft + 1);
    }
    // The right column sits to the right of the rail and its cards align.
    expect(rightColumnLeft).toBeGreaterThan(galleryBox!.x + galleryBox!.width - 1);
    for (const rightCard of [yourCopyBox!, tracklistBox!, otherDetailsBox!]) {
      expect(Math.abs(rightCard.x - mainInfoBox!.x)).toBeLessThan(4);
    }
    // "Estado de mi copia" is right after general info in the right column.
    expect(yourCopyBox!.y).toBeGreaterThan(mainInfoBox!.y);
    expect(tracklistBox!.y).toBeGreaterThan(yourCopyBox!.y);

    // The layout is an honest two-column composition, NOT a sticky rail: the
    // left-column anchor never pins itself to the viewport while scrolling,
    // and the narrow left column is meaningfully narrower than the wide right
    // column. Spec 065 (US1) replaced the earlier CSS Grid column classes with
    // useIndependentColumnLayout, whose documented mechanism (research.md R3,
    // contracts/useIndependentColumnLayout.contract.md) is `position: absolute`
    // + a measured `top` — deliberately chosen over `sticky`/`fixed` for this
    // exact "not a sticky rail" reason, so `absolute` here is expected; only
    // `sticky`/`fixed` (real viewport-pinning) would indicate a regression.
    // The scroll-lockstep assertions below are the actual behavioral proof.
    const railPosition = await rail.evaluate((el) => getComputedStyle(el).position);
    expect(railPosition).not.toBe('sticky');
    expect(railPosition).not.toBe('fixed');
    expect(galleryBox!.width).toBeLessThan(mainInfoBox!.width);

    // No horizontal scroll at desktop width.
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    // The left column is in normal flow: scrolling the page moves it up in
    // lock-step with the right column (no pinning, no detachment).
    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const scrollDelta = Math.min(220, Math.max(0, maxScroll - 1));
    expect(scrollDelta, 'the detail page should be tall enough to scroll').toBeGreaterThan(60);
    await page.evaluate((y) => window.scrollTo(0, y), scrollDelta);
    await page.waitForTimeout(150);

    const railAfter = await rail.boundingBox();
    const mainInfoAfter = await page.getByTestId('record-detail-main-info-card').boundingBox();
    expect(railAfter && mainInfoAfter).toBeTruthy();
    // Both columns scrolled up by ~the same delta.
    const rightShift = mainInfoBox!.y - mainInfoAfter!.y;
    const railShift = railBox!.y - railAfter!.y;
    expect(rightShift).toBeGreaterThan(scrollDelta - 20);
    expect(Math.abs(railShift - rightShift)).toBeLessThan(4);
  });

  test('mobile: every record-detail section is a single column in contract DOM order (feature 063, US1)', async ({
    page,
  }) => {
    await stubStreamingMatch(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await goToRecordDetail(page);
    await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

    const order = [
      'record-detail-gallery-card',
      'record-detail-main-info-card',
      'record-detail-your-copy-card',
      'record-detail-rating-card',
      'record-detail-streaming-card',
      'record-detail-tracklist-card',
      'record-detail-other-details-card',
    ];
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const id of order) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b, `${id} should be measurable`).toBeTruthy();
      boxes.push(b!);
    }
    for (let i = 1; i < boxes.length; i += 1) {
      expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(4);
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 1);
    }

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const position = await page
      .getByTestId('record-detail-rail')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('static');
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

  // Spec 065 (US1/US3): useIndependentColumnLayout positions each rail/content
  // slot with `top: <running total of same-column heights>`, so a mismatch in
  // one column must never leave a gap the size of a card from the *other*
  // column — only the standard 24px card gap (`CARD_GAP_PX` in
  // useIndependentColumnLayout.ts, matching the pre-fix `lg:gap-y-6`). The
  // library view additionally exercises the `myCopy` content-column slot.
  test('desktop: rail and content columns stack gap-free even when the tracklist is very long and streaming/notes are minimal (spec 065, US1/US3)', async ({
    page,
  }) => {
    await stubStreamingMatch(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    const longTracklistEntry = buildEntry();
    longTracklistEntry.release.notes = '';
    longTracklistEntry.release.identifiers = [];
    longTracklistEntry.release.tracklist = Array.from({ length: 40 }, (_, i) => ({
      position: String(i + 1),
      title: `Track title number ${i + 1} with enough words to take real vertical space`,
      duration: '3:33',
    }));
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(longTracklistEntry),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

    // No notes/identifiers in this fixture, so the trailing catalog-info card
    // does not render at all (ReleaseAdditionalInfoSection returns null).
    await expect(page.getByTestId('record-detail-other-details-card')).toHaveCount(0);

    // useIndependentColumnLayout positions cards via ResizeObserver callbacks
    // that fire asynchronously after mount — wait for two consecutive reads
    // to agree before measuring, or this races the layout (flaky webkit/CI).
    // Uses getBoundingClientRect() via page.evaluate rather than
    // Locator.boundingBox() — see columnLayout.ts for why.
    const geometry = await waitForStableCardGeometry(page, [
      'record-detail-rating-card',
      'record-detail-streaming-card',
      'record-detail-your-copy-card',
      'record-detail-tracklist-card',
    ]);
    const ratingBox = geometry['record-detail-rating-card'];
    const streamingBox = geometry['record-detail-streaming-card'];
    const myCopyBox = geometry['record-detail-your-copy-card'];
    const tracklistBox = geometry['record-detail-tracklist-card'];
    expect(ratingBox && streamingBox && myCopyBox && tracklistBox).toBeTruthy();

    // Sanity check the mismatch is real: the 40-track tracklist card is much
    // taller than the minimal streaming card next to it in the rail column.
    expect(tracklistBox.height).toBeGreaterThan(streamingBox.height + 200);

    // Rail column: rating -> streaming stack with only the card gap between
    // them (never a gap shaped like the much-taller tracklist card).
    const railGap = streamingBox.top - (ratingBox.top + ratingBox.height);
    expect(railGap).toBeGreaterThanOrEqual(16);
    expect(railGap).toBeLessThanOrEqual(32);

    // Content column: myCopy -> tracklist also stack with only the card gap,
    // independent of the rail column's much shorter total height.
    const contentGap = tracklistBox.top - (myCopyBox.top + myCopyBox.height);
    expect(contentGap).toBeGreaterThanOrEqual(16);
    expect(contentGap).toBeLessThanOrEqual(32);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('desktop: rail and content columns stack gap-free with a short tracklist and a long notes/identifiers card (spec 065, US1/US3)', async ({
    page,
  }) => {
    await stubStreamingMatch(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    const longCatalogInfoEntry = buildEntry();
    longCatalogInfoEntry.release.tracklist = [
      { position: 'A', title: 'Östermalm', duration: '4:45' },
    ];
    longCatalogInfoEntry.release.notes =
      'A very long catalog note repeated several times to take real vertical space. '.repeat(
        10,
      );
    longCatalogInfoEntry.release.identifiers = Array.from({ length: 30 }, (_, i) => ({
      type: 'Matrix',
      value: `MX-${i}-ABCDEFGH-${i}`,
    }));
    await page.route(`**/api/library/${ENTRY_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(longCatalogInfoEntry),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/library/records/${ENTRY_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

    // See the note above: wait for the async layout to settle before measuring.
    const geometry = await waitForStableCardGeometry(page, [
      'record-detail-rating-card',
      'record-detail-streaming-card',
      'record-detail-tracklist-card',
      'record-detail-other-details-card',
    ]);
    const ratingBox = geometry['record-detail-rating-card'];
    const streamingBox = geometry['record-detail-streaming-card'];
    const tracklistBox = geometry['record-detail-tracklist-card'];
    const otherDetailsBox = geometry['record-detail-other-details-card'];
    expect(ratingBox && streamingBox && tracklistBox && otherDetailsBox).toBeTruthy();

    // Sanity check the mismatch is real: the 30-identifier catalog-info card
    // is much taller than the single-track tracklist card next to it.
    expect(otherDetailsBox.height).toBeGreaterThan(tracklistBox.height + 200);

    // Rail column: rating -> streaming stack with only the card gap, even
    // though the content column below them is now much taller overall.
    const railGap = streamingBox.top - (ratingBox.top + ratingBox.height);
    expect(railGap).toBeGreaterThanOrEqual(16);
    expect(railGap).toBeLessThanOrEqual(32);

    // Content column: tracklist -> catalog-info stack with only the card gap,
    // never a gap shaped like the rail column's shorter cards.
    const contentGap = otherDetailsBox.top - (tracklistBox.top + tracklistBox.height);
    expect(contentGap).toBeGreaterThanOrEqual(16);
    expect(contentGap).toBeLessThanOrEqual(32);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
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
