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

// This e2e suite fakes the Discogs endpoints at the browser network boundary
// (Playwright route interception), matching the project's established
// pattern (see record-detail-inline-edit.spec.ts) for flows that depend on
// the live, rate-limited, token-gated Discogs API — not something CI has
// access to. This still drives the real search page, real preview popup
// component tree, and real click interactions in a real browser.
test.describe('Release preview popup — details and gallery', () => {
  test('opening the preview popup shows the release details section above the tracklist', async ({
    page,
  }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    await expect(page.getByText('Sweden')).toBeVisible();
    await expect(page.getByText(/Recorded at Stockholm Sound Studio/)).toBeVisible();
    await expect(page.getByText('Tracklist')).toBeVisible();
  });

  test('the gallery spans the full preview width and its thumbnail strip has no visible scrollbar', async ({
    page,
  }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    const gallery = page.getByTestId('release-preview-gallery');
    const content = page.getByTestId('release-preview-content');
    const [galleryBox, contentBox] = await Promise.all([gallery.boundingBox(), content.boundingBox()]);
    if (!galleryBox || !contentBox) {
      throw new Error('Expected the gallery and content bounding boxes to be measurable');
    }
    expect(galleryBox.width).toBeGreaterThan(contentBox.width * 0.9);

    const thumbnailStrip = page.getByRole('button', { name: /show image 2 of 2/i }).locator('..');
    const scrollbarWidth = await thumbnailStrip.evaluate(
      (el) => el.offsetWidth - el.clientWidth,
    );
    expect(scrollbarWidth).toBe(0);
  });

  test('on a desktop viewport, key details render in the left column and the tracklist in the right column', async ({
    page,
  }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    const detailsColumn = page.getByTestId('release-preview-details');
    const tracklistColumn = page.getByTestId('release-preview-tracklist');
    const [detailsBox, tracklistBox] = await Promise.all([
      detailsColumn.boundingBox(),
      tracklistColumn.boundingBox(),
    ]);
    if (!detailsBox || !tracklistBox) {
      throw new Error('Expected the details and tracklist bounding boxes to be measurable');
    }
    expect(detailsBox.x).toBeLessThan(tracklistBox.x);
  });

  test('notes, identifiers, and community stats render as the last section, below details and tracklist', async ({
    page,
  }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    await expect(page.getByText(/Recorded at Stockholm Sound Studio/)).toBeVisible();
    await expect(page.getByText(/7 39051 23421 6/)).toBeVisible();
    await expect(page.getByText(/214 have/)).toBeVisible();

    const tracklistColumn = page.getByTestId('release-preview-tracklist');
    const additionalInfo = page.getByTestId('release-preview-additional-info');
    const [tracklistBox, additionalInfoBox] = await Promise.all([
      tracklistColumn.boundingBox(),
      additionalInfo.boundingBox(),
    ]);
    if (!tracklistBox || !additionalInfoBox) {
      throw new Error('Expected the tracklist and additional-info bounding boxes to be measurable');
    }
    expect(additionalInfoBox.y).toBeGreaterThan(tracklistBox.y);
  });

  test('on a mobile viewport, sections stack top to bottom: gallery, key details, tracklist, additional info', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    const gallery = page.getByTestId('release-preview-gallery');
    const details = page.getByTestId('release-preview-details');
    const tracklist = page.getByTestId('release-preview-tracklist');
    const additionalInfo = page.getByTestId('release-preview-additional-info');

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

  test('resizing from desktop to mobile width reflows to single-column order with no duplicated or missing sections', async ({
    page,
  }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();
    await expect(page.getByTestId('release-preview-gallery')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByTestId('release-preview-gallery')).toHaveCount(1);
    await expect(page.getByTestId('release-preview-details')).toHaveCount(1);
    await expect(page.getByTestId('release-preview-tracklist')).toHaveCount(1);
    await expect(page.getByTestId('release-preview-additional-info')).toHaveCount(1);
    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByText(/Östermalm/)).toBeVisible();
  });

  test('a long tracklist forces the modal to grow, remaining fully scrollable with no visible scrollbar', async ({
    page,
  }) => {
    const longReleaseResponse = {
      ...releaseResponse,
      tracklist: Array.from({ length: 40 }, (_, index) => ({
        position: `A${index + 1}`,
        title: `Track ${index + 1}`,
        duration: '3:33',
      })),
    };

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
        body: JSON.stringify(longReleaseResponse),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    const dialog = page.getByRole('dialog');
    const scrollbarWidth = await dialog.evaluate((el) => el.offsetWidth - el.clientWidth);
    expect(scrollbarWidth).toBe(0);

    await page.getByText('Track 40').scrollIntoViewIfNeeded();
    await expect(page.getByText('Track 40')).toBeVisible();
  });

  test('clicking a thumbnail updates the primary image in the gallery', async ({ page }) => {
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

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library/add');
    await page.getByLabel('Search Discogs').fill('Stockholm');
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText('Stockholm')).toBeVisible();
    await page.getByRole('button', { name: 'Preview details' }).click();

    const mainImage = page.getByRole('img', { name: 'Stockholm' });
    await expect(mainImage).toHaveAttribute('src', 'https://example.com/cover-front.jpg');

    await page.getByRole('button', { name: /show image 2 of 2/i }).click();

    await expect(mainImage).toHaveAttribute('src', 'https://example.com/cover-back.jpg');
  });
});
