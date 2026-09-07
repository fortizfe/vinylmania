import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const RELEASE_ID = 1;

const searchResponse = {
  results: [
    {
      discogsId: RELEASE_ID,
      resultType: 'release',
      title: 'Stockholm',
      artist: 'The Persuader',
      year: 1999,
      formats: ['Vinyl'],
    },
  ],
  pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
};

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
  images: [
    { url: 'https://example.com/cover-front.jpg', imageType: 'primary' },
    { url: 'https://example.com/cover-back.jpg', imageType: 'secondary' },
  ],
  discogsUrl: 'https://www.discogs.com/release/1',
};

// Fakes the Discogs/library endpoints at the browser network boundary
// (Playwright route interception), same rationale as the other search/detail
// e2e suites — the live Discogs API is rate-limited and token-gated, and CI
// has no access to it. This still drives the real search page, the real
// release detail page, and real click/navigation interactions in a browser.

/**
 * Stubs `GET /api/streaming/links` with a single Apple Music match so the
 * `record-detail-streaming-card` resolves and its contract position (§C1 §4 —
 * immediately after the rating card, immediately before the tracklist) can be
 * asserted. Feature 063 US1/US4 shared helper — reused by the US4 position
 * suite below.
 */
async function stubStreamingMatch(page: import('@playwright/test').Page) {
  await page.route('**/api/streaming/links**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        links: [{ platform: 'apple_music', url: 'https://music.apple.com/es/album/x/123' }],
      }),
    });
  });
}

/** Stubs `GET /api/streaming/links` with a confirmed no-match (empty links). */
async function stubStreamingNoMatch(page: import('@playwright/test').Page) {
  await page.route('**/api/streaming/links**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ links: [] }),
    });
  });
}

test.describe('Release detail page (feature 026, US2)', () => {
  async function stubSearchAndRelease(page: import('@playwright/test').Page) {
    await page.route('**/api/discogs/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResponse),
      });
    });
    await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseResponse),
      });
    });
  }

  test('clicking a search result navigates to its detail page, Add to library works, and back restores the search (FR-004, FR-007, FR-012, FR-013)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);
    await page.route('**/api/library', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'entry-1',
          discogsReleaseId: RELEASE_ID,
          addedAt: '2026-07-08T00:00:00.000Z',
          catalogStatus: 'ok',
          release: releaseResponse,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText('Stockholm')).toBeVisible();

    // No quick-look preview control remains — the card itself is the only
    // way to see full release information (FR-013).
    await expect(page.getByRole('button', { name: 'Preview details' })).toHaveCount(0);

    await page.getByRole('link', { name: /stockholm/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/releases/${RELEASE_ID}`));
    await expect(page.getByText('Sweden')).toBeVisible();
    await expect(page.getByText(/Recorded at Stockholm Sound Studio/)).toBeVisible();
    await expect(page.getByText('Tracklist')).toBeVisible();

    await page.getByRole('button', { name: /^add to library$/i }).click();
    await expect(page.getByRole('button', { name: /added to library/i })).toBeVisible();

    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/app\/search\?q=Stockholm/);
    await expect(page.getByText('Stockholm')).toBeVisible();
  });

  test('loading the release detail page directly by URL renders correctly, with back falling back to search (FR-012, FR-014)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
    await expect(page.getByText('Sweden')).toBeVisible();

    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/app\/search$/);
  });

  test('a release id the catalog has no data for shows a not-found message (FR-015)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/releases/999999999', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'release_not_found', message: 'No release found for that ID.' }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/releases/999999999');
    await expect(page.getByText(/couldn.t find that release/i)).toBeVisible();
  });

  // Feature 063 (US1, contracts/ui-contracts.md §C1 + §C8): the search view is
  // recomposed onto the shared `RecordDetailLayout`. The section testids are
  // unified to the `record-detail-*` set and must appear in the contract DOM
  // order, with the standalone Rating card carrying the Discogs community
  // rating and the action bar sitting directly under the back-link as chrome
  // (never inside a Card).
  const SEARCH_SECTION_ORDER = [
    'record-detail-actions',
    'record-detail-gallery-card',
    'record-detail-main-info-card',
    'record-detail-rating-card',
    'record-detail-streaming-card',
    'record-detail-tracklist-card',
    'record-detail-other-details-card',
  ];

  test('the search view renders the unified record-detail sections in contract DOM order with the action bar under the back-link (feature 063, US1)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);
    await stubStreamingMatch(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('link', { name: /stockholm/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/releases/${RELEASE_ID}`));

    // The streaming card resolves (stubbed) so its contract position can be
    // asserted alongside the always-present sections.
    await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

    const domOrder = await page.evaluate((ids: string[]) => {
      const seen = new Set<string>();
      return Array.from(document.querySelectorAll('[data-testid]'))
        .map((el) => el.getAttribute('data-testid') ?? '')
        .filter((id) => ids.includes(id) && !seen.has(id) && (seen.add(id), true));
    }, SEARCH_SECTION_ORDER);
    expect(domOrder).toEqual(SEARCH_SECTION_ORDER);

    // The Discogs community rating badge is shown on the standalone Rating
    // card for a rated release (community.rating.average = 4.3, count 37).
    const ratingCard = page.getByTestId('record-detail-rating-card');
    await expect(
      ratingCard.getByRole('status', { name: /rating 4\.3 out of 5/i }),
    ).toBeVisible();
    await expect(ratingCard.getByText('(37)')).toBeVisible();
    await expect(ratingCard.getByText(/214 lo tienen/)).toBeVisible();

    // The action bar carries both add actions, sits as the first element
    // after the back-link inside <main>, and is not wrapped in a Card.
    const actionBar = page.getByTestId('record-detail-actions');
    await expect(actionBar.getByRole('button', { name: /^add to library$/i })).toBeVisible();
    await expect(actionBar.getByRole('button', { name: /^add to wishlist$/i })).toBeVisible();

    const placement = await actionBar.evaluate((el) => {
      const wrapper = el.parentElement;
      const prev = wrapper?.previousElementSibling ?? null;
      return {
        wrapperParentIsMain: wrapper?.parentElement?.tagName.toLowerCase() === 'main',
        prevIsBackLink:
          prev?.tagName.toLowerCase() === 'a' && /back/i.test(prev.textContent ?? ''),
        insideCard: Boolean(el.closest('.rounded-xl.border')),
      };
    });
    expect(placement).toEqual({
      wrapperParentIsMain: true,
      prevIsBackLink: true,
      insideCard: false,
    });

    // The two-column desktop composition still holds: gallery left, main-info
    // right on the same row; tracklist + other-details stacked below.
    const [galleryBox, mainInfoBox, tracklistBox, otherDetailsBox] = await Promise.all([
      page.getByTestId('record-detail-gallery-card').boundingBox(),
      page.getByTestId('record-detail-main-info-card').boundingBox(),
      page.getByTestId('record-detail-tracklist-card').boundingBox(),
      page.getByTestId('record-detail-other-details-card').boundingBox(),
    ]);
    expect(galleryBox && mainInfoBox && tracklistBox && otherDetailsBox).toBeTruthy();
    expect(Math.abs(mainInfoBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(mainInfoBox!.x).toBeGreaterThan(galleryBox!.x);
    expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
    expect(tracklistBox!.y).toBeGreaterThan(mainInfoBox!.y);
    expect(otherDetailsBox!.y).toBeGreaterThanOrEqual(tracklistBox!.y + tracklistBox!.height);

    // The gallery still drives the fullscreen image navigation.
    const mainImage = page.getByRole('img', { name: 'Stockholm' });
    await expect(mainImage).toHaveAttribute('src', 'https://example.com/cover-front.jpg');
    await page.getByRole('button', { name: /show image 2 of 2/i }).click();
    await expect(mainImage).toHaveAttribute('src', 'https://example.com/cover-back.jpg');
  });

  test('the main image opens a fullscreen viewer that navigates via thumbnails and closes via X, Escape, and the backdrop (spec 043, US2)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const fullscreenViewer = page.getByTestId('gallery-fullscreen-viewer');
    const fullscreenImage = fullscreenViewer.getByRole('img', { name: 'Stockholm' });

    // Open via click on the main (embedded) image.
    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    await expect(fullscreenViewer).toBeVisible();
    await expect(fullscreenImage).toHaveAttribute('src', 'https://example.com/cover-front.jpg');

    // Navigate via the thumbnail strip inside fullscreen; stays fullscreen.
    await fullscreenViewer.getByRole('button', { name: /show image 2 of 2/i }).click();
    await expect(fullscreenImage).toHaveAttribute('src', 'https://example.com/cover-back.jpg');
    await expect(fullscreenViewer).toBeVisible();

    // Escape closes it, preserving the selection made inside fullscreen.
    await page.keyboard.press('Escape');
    await expect(fullscreenViewer).not.toBeVisible();
    await expect(page.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/cover-back.jpg',
    );

    // Reopen and close via the "X".
    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    await expect(fullscreenViewer).toBeVisible();
    await page.getByTestId('gallery-fullscreen-close').click();
    await expect(fullscreenViewer).not.toBeVisible();

    // Reopen and close by clicking the backdrop outside the image.
    await page.getByRole('button', { name: /view stockholm fullscreen/i }).click();
    await expect(fullscreenViewer).toBeVisible();
    await fullscreenViewer.click({ position: { x: 5, y: 5 } });
    await expect(fullscreenViewer).not.toBeVisible();
  });

  test('on a mobile viewport, sections stack top to bottom', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubSearchAndRelease(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    // Navigate directly (rather than through the search UI) since the
    // header collapses to a hamburger menu at this width (feature 020).
    await page.goto(`/app/releases/${RELEASE_ID}`);
    await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

    const gallery = page.getByTestId('record-detail-gallery-card');
    const mainInfo = page.getByTestId('record-detail-main-info-card');
    const tracklist = page.getByTestId('record-detail-tracklist-card');
    const otherDetails = page.getByTestId('record-detail-other-details-card');

    const boxes = await Promise.all([
      gallery.boundingBox(),
      mainInfo.boundingBox(),
      tracklist.boundingBox(),
      otherDetails.boundingBox(),
    ]);
    if (boxes.includes(null)) {
      throw new Error('Expected all four card bounding boxes to be measurable');
    }
    const [galleryBox, mainInfoBox, tracklistBox, otherDetailsBox] = boxes as NonNullable<
      (typeof boxes)[number]
    >[];

    expect(mainInfoBox.y).toBeGreaterThan(galleryBox.y);
    expect(tracklistBox.y).toBeGreaterThan(mainInfoBox.y);
    expect(otherDetailsBox.y).toBeGreaterThan(tracklistBox.y);
  });

  test.describe('WCAG 2.1 AA automated scan (spec 058, US1)', () => {
    for (const theme of ['light', 'dark'] as const) {
      test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await stubSearchAndRelease(page);

        await page.goto('/');
        await signInAsFakeGoogleUser(page);
        await page.goto(`/app/releases/${RELEASE_ID}`);
        await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();

        const seriousOrCritical = await runAxeScan(page);

        expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Feature 063 US4 (contracts/ui-contracts.md §C1 §4 / §C8, quickstart §3):
// the streaming card renders at position 4 — immediately AFTER the rating card
// and immediately BEFORE the tracklist card — placed by `RecordDetailLayout`,
// not by its own hard-coded grid span (T035 removed `lg:col-span-2`). This must
// hold in all three views (search, wishlist, library). On a confirmed no-match
// the card collapses to `null` and the rating card is then immediately followed
// by the tracklist, with every section above streaming unmoved.
// ---------------------------------------------------------------------------

const LIBRARY_ENTRY_ID = 'e2e-063-us4-lib';

const libraryEntryResponse = {
  id: LIBRARY_ENTRY_ID,
  discogsReleaseId: RELEASE_ID,
  addedAt: '2026-07-04T00:00:00.000Z',
  catalogStatus: 'ok',
  release: releaseResponse,
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

const wantEntryResponse = {
  discogsReleaseId: RELEASE_ID,
  rating: 3,
  notes: null,
  addedAt: '2026-07-04T00:00:00.000Z',
};

/** All record-detail section testids, in contract §C1 top-to-bottom order. */
const ALL_SECTION_TESTIDS = [
  'record-detail-actions',
  'record-detail-gallery-card',
  'record-detail-main-info-card',
  'record-detail-your-copy-card',
  'record-detail-rating-card',
  'record-detail-streaming-card',
  'record-detail-tracklist-card',
  'record-detail-other-details-card',
];

/** The section testids actually present in the DOM, in document order. */
async function presentSectionOrder(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate((ids: string[]) => {
    const seen = new Set<string>();
    return Array.from(document.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid') ?? '')
      .filter((id) => ids.includes(id) && !seen.has(id) && (seen.add(id), true));
  }, ALL_SECTION_TESTIDS);
}

type DetailView = 'search' | 'wishlist' | 'library';

/**
 * Stubs the catalog / library / wantlist endpoints for `view` and navigates to
 * the corresponding detail page. Streaming is left to the caller so each test
 * picks the match / no-match stub. Reuses the same `releaseResponse` fixture as
 * the rest of this spec.
 */
async function openDetailForView(
  page: import('@playwright/test').Page,
  view: DetailView,
): Promise<void> {
  await page.route(`**/api/discogs/releases/${RELEASE_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(releaseResponse),
    });
  });

  if (view === 'wishlist') {
    await page.route(`**/api/wantlist/${RELEASE_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wantEntryResponse),
      });
    });
  }

  if (view === 'library') {
    await page.route(`**/api/library/${LIBRARY_ENTRY_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(libraryEntryResponse),
      });
    });
  }

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto(
    view === 'library'
      ? `/app/library/records/${LIBRARY_ENTRY_ID}`
      : `/app/releases/${RELEASE_ID}`,
  );
  await expect(page.getByRole('heading', { name: 'Stockholm' })).toBeVisible();
}

test.describe('Streaming card contract position (feature 063, US4 — T034)', () => {
  for (const view of ['search', 'wishlist', 'library'] as const) {
    test(`${view} view: streaming card sits immediately after the rating card and immediately before the tracklist (streaming match stubbed)`, async ({
      page,
    }) => {
      await stubStreamingMatch(page);
      await openDetailForView(page, view);

      // The streaming card resolves so its contract position is assertable.
      await expect(page.getByTestId('record-detail-streaming-card')).toBeVisible();

      const order = await presentSectionOrder(page);

      const expected =
        view === 'library'
          ? [
              'record-detail-actions',
              'record-detail-gallery-card',
              'record-detail-main-info-card',
              'record-detail-your-copy-card',
              'record-detail-rating-card',
              'record-detail-streaming-card',
              'record-detail-tracklist-card',
              'record-detail-other-details-card',
            ]
          : [
              'record-detail-actions',
              'record-detail-gallery-card',
              'record-detail-main-info-card',
              'record-detail-rating-card',
              'record-detail-streaming-card',
              'record-detail-tracklist-card',
              'record-detail-other-details-card',
            ];
      // Full ordered list ⇒ streaming is adjacent to rating (before) and
      // tracklist (after), AND every section above it is unmoved.
      expect(order).toEqual(expected);

      const streamingIndex = order.indexOf('record-detail-streaming-card');
      expect(order[streamingIndex - 1]).toBe('record-detail-rating-card');
      expect(order[streamingIndex + 1]).toBe('record-detail-tracklist-card');
    });
  }

  test('search view: a no-match streaming stub collapses the card — rating is then immediately followed by tracklist, sections above unmoved', async ({
    page,
  }) => {
    await stubStreamingNoMatch(page);
    await openDetailForView(page, 'search');

    // The rest of the page has settled: the tracklist card is present.
    await expect(page.getByTestId('record-detail-tracklist-card')).toBeVisible();
    // The streaming card collapsed to nothing (FR-014 / §C1 §4 "may render null").
    await expect(page.getByTestId('record-detail-streaming-card')).toHaveCount(0);

    const order = await presentSectionOrder(page);
    expect(order).toEqual([
      'record-detail-actions',
      'record-detail-gallery-card',
      'record-detail-main-info-card',
      'record-detail-rating-card',
      'record-detail-tracklist-card',
      'record-detail-other-details-card',
    ]);

    const ratingIndex = order.indexOf('record-detail-rating-card');
    expect(order[ratingIndex + 1]).toBe('record-detail-tracklist-card');
  });

  test('library view: a no-match streaming stub collapses the card without disturbing "Estado de mi copia" or the sections above', async ({
    page,
  }) => {
    await stubStreamingNoMatch(page);
    await openDetailForView(page, 'library');

    await expect(page.getByTestId('record-detail-tracklist-card')).toBeVisible();
    await expect(page.getByTestId('record-detail-streaming-card')).toHaveCount(0);

    const order = await presentSectionOrder(page);
    expect(order).toEqual([
      'record-detail-actions',
      'record-detail-gallery-card',
      'record-detail-main-info-card',
      'record-detail-your-copy-card',
      'record-detail-rating-card',
      'record-detail-tracklist-card',
      'record-detail-other-details-card',
    ]);
  });
});
