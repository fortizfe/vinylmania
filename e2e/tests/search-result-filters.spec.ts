import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

// Fakes the /api/discogs/search boundary at the browser network layer, same
// rationale as the caching-navigation e2e suite: drives the real filter
// control and search-results rendering without depending on a live Discogs
// API (spec 021-search-result-filters).

test.describe('Search result filters (feature 021, US1)', () => {
  test('applying a single Genre filter narrows the results (quickstart Scenario 1)', async ({ page }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      if (genre === 'Rock') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { discogsId: 501, resultType: 'release', title: 'Nevermind', artist: 'Nirvana', year: 1991 },
            ],
            pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { discogsId: 501, resultType: 'release', title: 'Nevermind', artist: 'Nirvana', year: 1991 },
            { discogsId: 502, resultType: 'release', title: 'Unplugged in New York', artist: 'Nirvana', year: 1994 },
          ],
          pagination: { page: 1, pages: 1, items: 2, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('nirvana');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);

    await expect(page.getByText('Nevermind')).toBeVisible();
    await expect(page.getByText('Unplugged in New York')).toBeVisible();

    await page.getByLabel(/^genre$/i).fill('Rock');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page.getByText('Nevermind')).toBeVisible();
    await expect(page.getByText('Unplugged in New York')).not.toBeVisible();
  });
});

test.describe('Search result filters (feature 021, US2)', () => {
  test('combining two filters narrows further, and clearing one keeps the other applied (quickstart Scenario 2)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      const format = url.searchParams.get('format');

      if (genre === 'Rock' && format === 'Vinyl') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ discogsId: 601, resultType: 'release', title: 'Vinyl Rock Only' }],
            pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
          }),
        });
        return;
      }
      if (genre === 'Rock' && !format) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { discogsId: 601, resultType: 'release', title: 'Vinyl Rock Only' },
              { discogsId: 602, resultType: 'release', title: 'CD Rock Only' },
            ],
            pagination: { page: 1, pages: 1, items: 2, perPage: 20 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { discogsId: 601, resultType: 'release', title: 'Vinyl Rock Only' },
            { discogsId: 602, resultType: 'release', title: 'CD Rock Only' },
            { discogsId: 603, resultType: 'release', title: 'Jazz Result' },
          ],
          pagination: { page: 1, pages: 1, items: 3, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('combo');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText('Jazz Result')).toBeVisible();

    await page.getByLabel(/^genre$/i).fill('Rock');
    await page.getByLabel(/^format$/i).fill('Vinyl');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page).toHaveURL(/format=Vinyl/);
    await expect(page.getByText('Vinyl Rock Only')).toBeVisible();
    await expect(page.getByText('CD Rock Only')).not.toBeVisible();
    await expect(page.getByText('Jazz Result')).not.toBeVisible();

    await page.getByLabel(/^format$/i).fill('');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).not.toHaveURL(/format=/);
    await expect(page.getByText('Vinyl Rock Only')).toBeVisible();
    await expect(page.getByText('CD Rock Only')).toBeVisible();
    await expect(page.getByText('Jazz Result')).not.toBeVisible();
  });
});

test.describe('Search result filters (feature 021, US3)', () => {
  test('preserves filters across pagination and reload, and clears them in one action (quickstart Scenario 3)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      const pageParam = url.searchParams.get('page') ?? '1';

      if (!genre) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ discogsId: 701, resultType: 'release', title: 'Unfiltered Result' }],
            pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
          }),
        });
        return;
      }

      if (pageParam === '2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ discogsId: 703, resultType: 'release', title: 'Page Two Filtered Result' }],
            pagination: { page: 2, pages: 2, items: 2, perPage: 20 },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ discogsId: 702, resultType: 'release', title: 'Page One Filtered Result' }],
          pagination: { page: 1, pages: 2, items: 2, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('persist');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);

    await page.getByLabel(/^genre$/i).fill('Rock');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await expect(page.getByText('Page One Filtered Result')).toBeVisible();

    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Page Two Filtered Result')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Page Two Filtered Result')).toBeVisible();
    await expect(page.getByLabel(/^genre$/i)).toHaveValue('Rock');

    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page).not.toHaveURL(/genre=/);
    await expect(page.getByText('Unfiltered Result')).toBeVisible();
    await expect(page.getByLabel(/^genre$/i)).toHaveValue('');
  });
});
