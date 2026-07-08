import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const MASTER_ID = 1660109;
const VERSION_RELEASE_ID = 98765;

const searchResponse = {
  results: [
    {
      discogsId: MASTER_ID,
      resultType: 'master',
      title: 'Hybrid Theory',
      artist: 'Linkin Park',
      year: 2000,
      formats: ['Vinyl'],
    },
  ],
  pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
};

const masterResponse = {
  discogsId: MASTER_ID,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' }],
  tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
  mainReleaseId: VERSION_RELEASE_ID,
  discogsUrl: 'https://www.discogs.com/master/1660109',
};

function versionsResponse(page: number) {
  return {
    results: [
      {
        discogsId: VERSION_RELEASE_ID,
        title: 'Hybrid Theory',
        format: 'Vinyl, LP, Album',
        year: 2000,
        label: 'Warner Bros. Records',
        country: 'US',
      },
    ],
    pagination: { page, pages: 2, items: 11, perPage: 10 },
  };
}

const releaseResponse = {
  discogsId: VERSION_RELEASE_ID,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
  labels: [{ discogsLabelId: 1, name: 'Warner Bros. Records' }],
  formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  identifiers: [],
  tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
  images: [],
  discogsUrl: 'https://www.discogs.com/release/98765',
};

// Fakes the Discogs endpoints at the browser network boundary (Playwright
// route interception), same rationale as release-detail.spec.ts.
test.describe('Master release detail page (feature 026, US3)', () => {
  async function stubAll(page: import('@playwright/test').Page) {
    await page.route('**/api/discogs/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResponse),
      });
    });
    await page.route(`**/api/discogs/masters/${MASTER_ID}/versions**`, async (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(versionsResponse(requestedPage)),
      });
    });
    await page.route(`**/api/discogs/masters/${MASTER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(masterResponse),
      });
    });
    await page.route(`**/api/discogs/releases/${VERSION_RELEASE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(releaseResponse),
      });
    });
  }

  test('grouped card click navigates to the master detail page, not a release detail page (FR-005)', async ({
    page,
  }) => {
    await stubAll(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel('Search Discogs').fill('Linkin Park');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText('Hybrid Theory')).toBeVisible();
    await expect(page.getByTestId('search-result-stacked-covers')).toBeVisible();

    await page.getByRole('link', { name: /hybrid theory/i }).click();

    await expect(page).toHaveURL(new RegExp(`/app/masters/${MASTER_ID}`));
    await expect(page.getByText('Rock')).toBeVisible();
  });

  test('the version table paginates, a row navigates to its release detail page, and back returns to the same version-table page (FR-009, FR-011, Acceptance Scenario 5)', async ({
    page,
  }) => {
    await stubAll(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();

    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page).toHaveURL(/page=2/);

    await page.getByRole('link', { name: /hybrid theory/i }).last().click();
    await expect(page).toHaveURL(new RegExp(`/app/releases/${VERSION_RELEASE_ID}`));

    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/masters/${MASTER_ID}\\?page=2`));
  });

  test('back from the master detail page returns to the original search results (Acceptance Scenario 6)', async ({
    page,
  }) => {
    await stubAll(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel('Search Discogs').fill('Linkin Park');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByText('Hybrid Theory')).toBeVisible();

    await page.getByRole('link', { name: /hybrid theory/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/masters/${MASTER_ID}`));

    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/app\/search\?q=Linkin(\+|%20)Park/);
  });

  test('loading the master detail page directly by URL renders correctly, with back falling back to search (FR-012, FR-014)', async ({
    page,
  }) => {
    await stubAll(page);

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto(`/app/masters/${MASTER_ID}`);
    await expect(page.getByRole('heading', { name: 'Hybrid Theory' })).toBeVisible();
    await expect(page.getByText('Rock')).toBeVisible();

    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/app\/search$/);
  });

  test('a master id the catalog has no data for shows a not-found message (FR-015)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/masters/999999999', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'master_not_found', message: 'No master release found for that ID.' }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/masters/999999999');
    await expect(page.getByText(/couldn.t find that master release/i)).toBeVisible();
  });
});
