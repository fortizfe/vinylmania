import { expect, test } from '@playwright/test';

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

  test('the gallery, details, tracklist, and additional info render in the documented layout (FR-006)', async ({
    page,
  }) => {
    await stubSearchAndRelease(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('link', { name: /stockholm/i }).click();

    const gallery = page.getByTestId('release-detail-gallery');
    const details = page.getByTestId('release-detail-details');
    const tracklist = page.getByTestId('release-detail-tracklist');
    const additionalInfo = page.getByTestId('release-detail-additional-info');

    const [galleryBox, detailsBox, tracklistBox, additionalInfoBox] = await Promise.all([
      gallery.boundingBox(),
      details.boundingBox(),
      tracklist.boundingBox(),
      additionalInfo.boundingBox(),
    ]);
    expect(galleryBox && detailsBox && tracklistBox && additionalInfoBox).toBeTruthy();

    // At the default desktop viewport (spec 044): the gallery and details
    // form a two-column row (gallery left, details right), rather than
    // stacking, with tracklist and additional-info rendering full-width
    // below that row instead of beside it as extra panels.
    expect(Math.abs(detailsBox!.y - galleryBox!.y)).toBeLessThan(4);
    expect(detailsBox!.x).toBeGreaterThan(galleryBox!.x);
    expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
    expect(tracklistBox!.y).toBeGreaterThan(detailsBox!.y);
    expect(additionalInfoBox!.y).toBeGreaterThanOrEqual(tracklistBox!.y + tracklistBox!.height);

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

    const gallery = page.getByTestId('release-detail-gallery');
    const details = page.getByTestId('release-detail-details');
    const tracklist = page.getByTestId('release-detail-tracklist');
    const additionalInfo = page.getByTestId('release-detail-additional-info');

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
  });
});
