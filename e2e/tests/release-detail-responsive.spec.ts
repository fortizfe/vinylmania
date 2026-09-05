import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { assertUiComponentContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const RELEASE_ID = 1;

const releaseResponse = {
  discogsId: RELEASE_ID,
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
  images: [{ url: 'https://example.com/cover-front.jpg', imageType: 'primary' }],
  discogsUrl: 'https://www.discogs.com/release/1',
};

async function goToReleaseDetail(page: import('@playwright/test').Page) {
  await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(releaseResponse),
    });
  });

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto(`/app/releases/${RELEASE_ID}`);
  await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
}

test.describe('Release detail page responsive layout (spec 035, US1)', () => {
  test('desktop: gallery and details form a two-column row from lg (1024px), tracklist renders full-width below, and there is no distinct state before xl (spec 044, US2)', async ({
    page,
  }) => {
    let signedIn = false;
    async function checkComposition(width: number, height: number) {
      await page.setViewportSize({ width, height });
      if (!signedIn) {
        await goToReleaseDetail(page);
        signedIn = true;
      } else {
        // Already authenticated from the first call — reload the same
        // page instead of re-running the sign-in flow, which only shows
        // the Google popup once per session (page.goto('/') again would
        // skip straight past the "Sign in with Google" button).
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
      }

      const gallery = page.getByTestId('release-detail-gallery-card');
      const details = page.getByTestId('release-detail-main-info-card');
      const tracklist = page.getByTestId('release-detail-tracklist-card');

      const [galleryBox, detailsBox, tracklistBox] = await Promise.all([
        gallery.boundingBox(),
        details.boundingBox(),
        tracklist.boundingBox(),
      ]);
      expect(galleryBox && detailsBox && tracklistBox).toBeTruthy();

      // Gallery and details share a row (two-column composition).
      expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
      expect(galleryBox!.x).toBeLessThan(detailsBox!.x);

      // Tracklist renders full-width below the gallery/details row, not
      // beside it as a third panel (spec 044 FR-005/FR-010).
      expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
      expect(tracklistBox!.y).toBeGreaterThan(detailsBox!.y);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      return { galleryBox: galleryBox!, detailsBox: detailsBox! };
    }

    const lgRange = await checkComposition(1024, 900);
    const xlRange = await checkComposition(1280, 900);

    // No distinct intermediate state between lg and xl (spec FR-011): the
    // gallery column sits at the same horizontal offset at both widths,
    // rather than jumping to a different composition at xl.
    expect(Math.abs(lgRange.galleryBox.x - xlRange.galleryBox.x)).toBeLessThan(4);
  });

  test('desktop: the no-cover placeholder stays contained within the gallery column of the two-column lg-range layout (spec 044, FR-014)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    const noImagesRelease = { ...releaseResponse, images: [] };
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noImagesRelease),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const gallery = page.getByTestId('release-detail-gallery-card');
    const details = page.getByTestId('release-detail-main-info-card');

    const [galleryBox, detailsBox] = await Promise.all([
      gallery.boundingBox(),
      details.boundingBox(),
    ]);
    expect(galleryBox && detailsBox).toBeTruthy();

    // Placeholder stays in the gallery column: same row as details, and its
    // right edge does not overlap into the details column.
    expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(galleryBox!.x + galleryBox!.width).toBeLessThanOrEqual(detailsBox!.x + 1);

    await expect(page.getByText(/no cover image available/i)).toBeVisible();
  });

  test('mobile: single column, no horizontal scroll, and the "Add to library" button meets 44x44px (Scenario 9)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToReleaseDetail(page);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const addButton = page.getByRole('button', { name: /add to library/i });
    const box = await addButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('lg-range desktop: the main image stays contained and the thumbnail column never exceeds it, even with many images (spec 043, US1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });

    const manyImagesRelease = {
      ...releaseResponse,
      images: Array.from({ length: 12 }, (_, i) => ({
        url: `https://example.com/cover-${i}.jpg`,
        imageType: i === 0 ? 'primary' : 'secondary',
      })),
    };
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manyImagesRelease),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/releases/${RELEASE_ID}`);
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
});

test.describe('Release detail responsive WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await goToReleaseDetail(page);

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

test.describe('Release detail Badge UI component contrast (spec 058, US2)', () => {
  // ReleaseRatingBadge is not rendered on the release detail page itself
  // (only on library/search cards and rows — SearchResultCard.tsx,
  // RecordCard.tsx, etc.) — the plain Badge chips in
  // ReleaseDetailsSection.tsx (format/label/genre/style) are the real
  // boundary-having components this screen actually renders. Each chip's
  // check runs as its own test so one failing assertion never hides
  // whether the other would have passed or failed.
  // The format Badge (`tone="muted"`) is intentionally borderless,
  // bg-transparent, inline colored text with no interactive/selectable
  // behavior — see the `muted` tone's comment in `Badge.tsx`. WCAG 1.4.11
  // (Non-text Contrast) only applies to boundaries needed to perceive a
  // component; it does not require one to be added to a text-only status
  // label whose own text contrast is already covered by this file's axe
  // scan above. No `assertUiComponentContrast` check for it here — adding
  // one would assert a boundary the design deliberately doesn't have,
  // which `spec 058, T027 finding #7` confirmed reads a transparent fill
  // as opaque black (a measurement artifact, not a real violation).
  for (const theme of ['light', 'dark'] as const) {
    test(`genre Badge chip meets WCAG UI component contrast against the main-info card in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await goToReleaseDetail(page);

      const mainInfoCard = page.getByTestId('release-detail-main-info-card');
      const genreBadge = mainInfoCard.getByText('Electronic', { exact: true });

      await assertUiComponentContrast(
        page,
        genreBadge,
        mainInfoCard,
        `Genre Badge boundary (${theme})`,
      );
    });
  }
});
