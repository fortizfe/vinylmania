import { expect, type Page, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

function record(
  id: string,
  title: string,
  overrides: { genre?: string[]; style?: string[]; format?: string[] } = {},
) {
  return {
    id,
    discogsReleaseId: Number(id.replace(/\D/g, '')) || 1,
    addedAt: '2026-07-03T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title,
      artists: [],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
    ...overrides,
  };
}

/** Expands the collapsible filter panel from its default collapsed state (feature 038, FR-002/FR-003). */
async function expandFilters(page: Page) {
  await page.getByRole('button', { name: /^filters$/i }).click();
}

/** Opens the Genre modal, checks the given option, and closes the modal (feature 038). */
async function selectGenreOption(page: Page, option: string) {
  await page.locator('#filter-genre-trigger').click();
  await page.getByRole('dialog').getByLabel(option, { exact: true }).check();
  await page.keyboard.press('Escape');
}

test.describe('Shared collapsible filters on My Library (feature 038, US2)', () => {
  test('the same filter component (collapsed by default) appears above the records grid, with no free-text Genre/Style anywhere', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record('entry-1', 'Stockholm')],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');

    await expect(page.getByText('Stockholm')).toBeVisible();
    await expect(page.getByRole('button', { name: /^filters$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^genre$/i })).toHaveCount(0);
    await expect(page.getByTestId('active-filter-badge')).toHaveCount(0);
  });

  test('applying a Genre filter narrows the grid to matching entries and shows the active-filter badge once collapsed (FR-004, FR-017)', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      if (genre === 'Rock') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [record('entry-1', 'Rock Only')],
            page: 1,
            pageSize: 20,
            totalItems: 1,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record('entry-1', 'Rock Only'), record('entry-2', 'Jazz Only')],
          page: 1,
          pageSize: 20,
          totalItems: 2,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Jazz Only')).toBeVisible();

    await expandFilters(page);
    await selectGenreOption(page, 'Rock');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page.getByText('Rock Only')).toBeVisible();
    await expect(page.getByText('Jazz Only')).not.toBeVisible();

    await page.getByRole('button', { name: /collapse filters/i }).click();
    await expect(page.getByTestId('active-filter-badge')).toHaveText('1');
  });

  test('a filter combination matching no entries shows a distinct "no results for the active filters" message', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      if (genre === 'Non-Music') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record('entry-1', 'Stockholm')],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();

    await expandFilters(page);
    await selectGenreOption(page, 'Non-Music');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page.getByText(/no results for the active filters/i)).toBeVisible();
    await expect(page.getByText(/no records yet/i)).not.toBeVisible();
  });

  test('clearing filters returns to the unfiltered paginated view', async ({ page }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      if (genre === 'Rock') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [record('entry-1', 'Rock Only')],
            page: 1,
            pageSize: 20,
            totalItems: 1,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record('entry-1', 'Rock Only'), record('entry-2', 'Jazz Only')],
          page: 1,
          pageSize: 20,
          totalItems: 2,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Jazz Only')).toBeVisible();

    await expandFilters(page);
    await selectGenreOption(page, 'Rock');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await expect(page.getByText('Jazz Only')).not.toBeVisible();

    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page.getByText('Jazz Only')).toBeVisible();
    await expect(page.getByTestId('active-filter-badge')).toHaveCount(0);
  });

  test('filters remain active across a page change (FR-022)', async ({ page }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      const pageParam = url.searchParams.get('page') ?? '1';
      expect(genre).toBe('Rock');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record(`entry-${pageParam}`, `Rock Result Page ${pageParam}`)],
          page: Number(pageParam),
          pageSize: 20,
          totalItems: 40,
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library?genre=Rock');
    await expect(page.getByText('Rock Result Page 1')).toBeVisible();

    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText('Rock Result Page 2')).toBeVisible();
    await expect(page).toHaveURL(/genre=Rock/);
  });

  test('no horizontal scroll appears on the Library page in either viewport when a selectable list is open (SC-005)', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [record('entry-1', 'Stockholm')],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        }),
      });
    });

    // Sign in once before the loop, not per iteration: signInAsFakeGoogleUser
    // relies on clicking a "Sign in with Google" button that only exists on
    // the unauthenticated landing page. Re-navigating to `/` on the second
    // iteration while already signed in (page.context().clearCookies() alone
    // doesn't clear Firebase Auth's client-side IndexedDB persistence) either
    // skips straight past the landing page or races a redirect away from it,
    // which is what produced "element was detached from the DOM" here.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/app/library');
      await expect(page.getByText('Stockholm')).toBeVisible();

      await expandFilters(page);
      await page.locator('#filter-style-trigger').click();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width);

      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Filters behave identically in list mode (feature 052, US2)', () => {
  test('applying a Genre filter narrows the list rows the same way it narrows the grid', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      const items =
        genre === 'Rock'
          ? [record('entry-1', 'Rock Only', { genre: ['Rock'] })]
          : [
              record('entry-1', 'Rock Only', { genre: ['Rock'] }),
              record('entry-2', 'Jazz Only', { genre: ['Jazz'] }),
            ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, pageSize: 20, totalItems: items.length }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Jazz Only')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    await expandFilters(page);
    await selectGenreOption(page, 'Rock');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page.getByText('Rock Only')).toBeVisible();
    await expect(page.getByText('Jazz Only')).toHaveCount(0);
  });

  test('the empty-library and no-matches-for-filter messages are unchanged in list mode', async ({
    page,
  }) => {
    await page.route('**/api/library*', async (route) => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('genre');
      const items = genre ? [] : [record('entry-1', 'Stockholm')];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, pageSize: 20, totalItems: items.length }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByText('Stockholm')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    await expandFilters(page);
    await selectGenreOption(page, 'Non-Music');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page.getByText(/no results for the active filters/i)).toBeVisible();
  });
});
