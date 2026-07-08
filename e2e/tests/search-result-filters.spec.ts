import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

/**
 * Opens the Format modal, checks the given option, and closes the modal
 * (feature 022). Uses the trigger's stable id rather than its accessible
 * name, since the trigger's label now shows the live selection (e.g.
 * "Vinyl") rather than a fixed "Format" prefix once at least one value is
 * selected (feature 023, US1).
 */
async function selectFormatOption(page: Page, option: string) {
  await page.locator('#filter-format-trigger').click();
  await page.getByRole('dialog').getByLabel(option, { exact: true }).check();
  await page.keyboard.press('Escape');
}

/** Opens the Format modal, unchecks the given option, and closes the modal (feature 022). */
async function deselectFormatOption(page: Page, option: string) {
  await page.locator('#filter-format-trigger').click();
  await page.getByRole('dialog').getByLabel(option, { exact: true }).uncheck();
  await page.keyboard.press('Escape');
}

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
  test('combining two filters narrows further, and clearing one keeps the other applied (quickstart Scenario 2; feature 023 baseline, FR-014)', async ({
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
    await selectFormatOption(page, 'Vinyl');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page).toHaveURL(/format=Vinyl/);
    await expect(page.getByText('Vinyl Rock Only')).toBeVisible();
    await expect(page.getByText('CD Rock Only')).not.toBeVisible();
    await expect(page.getByText('Jazz Result')).not.toBeVisible();

    await deselectFormatOption(page, 'Vinyl');
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

test.describe('Search result filters (feature 022, US1)', () => {
  test('selecting multiple formats narrows results to releases matching all of them together (quickstart Scenario 1)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const format = url.searchParams.get('format');

      if (format === 'Vinyl,CD') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            // Verified against live Discogs (feature 022, T014): a comma-joined
            // format value is AND-matched — only a release genuinely available
            // in both formats simultaneously (e.g. a box set) qualifies.
            results: [{ discogsId: 801, resultType: 'release', title: 'Vinyl+CD Box Set' }],
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
            { discogsId: 801, resultType: 'release', title: 'Vinyl+CD Box Set' },
            { discogsId: 802, resultType: 'release', title: 'Vinyl Only' },
            { discogsId: 803, resultType: 'release', title: 'Cassette Only' },
          ],
          pagination: { page: 1, pages: 1, items: 3, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('multiformat');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText('Cassette Only')).toBeVisible();

    await page.getByRole('button', { name: /^format$/i }).click();
    await page.getByRole('dialog').getByLabel('Vinyl', { exact: true }).check();
    await page.getByRole('dialog').getByLabel('CD', { exact: true }).check();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/format=Vinyl%2CCD/);
    await expect(page.getByText('Vinyl+CD Box Set')).toBeVisible();
    await expect(page.getByText('Vinyl Only')).not.toBeVisible();
    await expect(page.getByText('Cassette Only')).not.toBeVisible();
  });
});

test.describe('Search result filters (feature 022, US2)', () => {
  test('never renders an Artist field, and an obsolete artist link loads cleanly with the genre filter still active (quickstart Scenario 2)', async ({
    page,
  }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');

      if (genre === 'Rock') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ discogsId: 901, resultType: 'release', title: 'Nevermind' }],
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
            { discogsId: 901, resultType: 'release', title: 'Nevermind' },
            { discogsId: 902, resultType: 'release', title: 'Unrelated Result' },
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

    await expect(page.getByLabel(/^artist$/i)).toHaveCount(0);

    // Navigate directly to a link carrying an obsolete `artist` param, as if
    // it were an old bookmark/share from before feature 022.
    await page.goto('/app/search?q=nirvana&artist=Nirvana&genre=Rock');

    await expect(page.getByText('Nevermind')).toBeVisible();
    await expect(page.getByText('Unrelated Result')).not.toBeVisible();
    await expect(page.getByLabel(/^genre$/i)).toHaveValue('Rock');
    await expect(page.getByLabel(/^artist$/i)).toHaveCount(0);
  });
});

test.describe('Search result filters (feature 023, US1)', () => {
  test('Format leads the filter bar and its label updates live, before Apply is clicked', async ({ page }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ discogsId: 901, resultType: 'release', title: 'Nevermind', artist: 'Nirvana', year: 1991 }],
          pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('nirvana');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);

    // Format is the first filter control, ahead of Genre and Style (FR-001).
    const filterControls = page.locator('#filter-format-trigger, #filter-genre, #filter-style');
    await expect(filterControls.first()).toHaveId('filter-format-trigger');

    // The trigger label updates live as selections are made, without clicking Apply (FR-002, FR-005).
    await selectFormatOption(page, 'Vinyl');
    await expect(page.getByRole('button', { name: /^vinyl$/i })).toBeVisible();

    await selectFormatOption(page, 'CD');
    await expect(page.getByRole('button', { name: /^vinyl, cd$/i })).toBeVisible();
  });
});

test.describe('Search result filters (feature 023, US3)', () => {
  test('Apply and Clear are icon-only but remain operable by their accessible name', async ({ page }) => {
    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: genre === 'Rock'
            ? [{ discogsId: 951, resultType: 'release', title: 'Nevermind' }]
            : [
                { discogsId: 951, resultType: 'release', title: 'Nevermind' },
                { discogsId: 952, resultType: 'release', title: 'Other Result' },
              ],
          pagination: { page: 1, pages: 1, items: genre === 'Rock' ? 1 : 2, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.getByLabel(/search discogs/i).fill('nirvana');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText('Other Result')).toBeVisible();

    const applyButton = page.getByRole('button', { name: /^apply filters$/i });
    const clearButton = page.getByRole('button', { name: /^clear filters$/i });
    await expect(applyButton).toHaveText('');
    await expect(clearButton).toHaveText('');

    await page.getByLabel(/^genre$/i).fill('Rock');
    await applyButton.click();
    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page.getByText('Other Result')).not.toBeVisible();

    await clearButton.click();
    await expect(page).not.toHaveURL(/genre=/);
    await expect(page.getByLabel(/^genre$/i)).toHaveValue('');
  });
});
