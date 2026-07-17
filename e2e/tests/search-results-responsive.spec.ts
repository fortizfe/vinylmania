import { expect, test } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

function buildResults(count: number) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      discogsId: 1000 + i,
      resultType: 'release',
      title: `Result ${i}`,
      artist: 'Test Artist',
      year: 2000 + i,
    })),
    pagination: { page: 1, pages: 1, items: count, perPage: count },
  };
}

async function searchAndWait(page: import('@playwright/test').Page, count: number) {
  await page.route('**/api/discogs/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildResults(count)),
    });
  });

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  // Navigate directly by URL rather than through the header search form: at
  // narrow (mobile) viewports the always-visible "Sign out" button overlaps
  // the header search submit button (pre-existing crowding bug, out of
  // scope for spec 035 per FR-010's "verify, don't redesign" constraint —
  // also reproducible on main via caching-navigation.spec.ts's identical
  // narrow-viewport search click).
  await page.goto('/app/search?q=rock');
  await expect(page.getByTestId('search-results-grid')).toBeVisible();
}

test.describe('Search results page responsive layout (spec 035, US1)', () => {
  test('desktop: filters and results grid form a deliberate multi-column composition (Scenario 3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await searchAndWait(page, 10);

    const grid = page.getByTestId('search-results-grid');
    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(5);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('mobile: results grid starts at a single column, no horizontal scroll, and controls meet 44x44px (Scenario 4)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await searchAndWait(page, 4);

    const grid = page.getByTestId('search-results-grid');
    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    // The filter panel collapses by default (feature 038) — this file
    // predates that change and never expanded it, so "Apply filters" was
    // never actionable and boundingBox() polled until the test timeout.
    await page.getByRole('button', { name: /^filters$/i }).click();

    const applyButton = page.getByRole('button', { name: /apply filters/i });
    const applyBox = await applyButton.boundingBox();
    expect(applyBox?.width).toBeGreaterThanOrEqual(44);
    expect(applyBox?.height).toBeGreaterThanOrEqual(44);

    const addButtons = page.getByRole('button', { name: /add to library/i });
    const firstAddBox = await addButtons.first().boundingBox();
    expect(firstAddBox?.width).toBeGreaterThanOrEqual(44);
    expect(firstAddBox?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('List mode (feature 052, US3)', () => {
  function buildListResult(id: number) {
    return {
      discogsId: id,
      resultType: 'release',
      title: `Result ${id}`,
      artist: 'Test Artist',
      year: 1999,
      formats: ['Vinyl'],
      country: 'Sweden',
      labels: ['Svek'],
    };
  }

  test('shows all six fields per row, and infinite scroll keeps working', async ({
    page,
  }) => {
    // A full first batch (not just one row): list rows are far shorter than
    // grid cards, so a single row leaves the infinite-scroll sentinel
    // already inside the viewport, auto-fetching page 2 before the
    // "before scroll" assertions below even run.
    const firstBatch = Array.from({ length: 20 }, (_, i) => buildListResult(i));

    await page.route('**/api/discogs/search*', async (route) => {
      const url = new URL(route.request().url());
      const requestedPage = url.searchParams.get('page');
      if (requestedPage === '2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [buildListResult(20)],
            pagination: { page: 2, pages: 2, items: 21, perPage: 20 },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: firstBatch,
          pagination: { page: 1, pages: 2, items: 21, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    const list = page.getByTestId('search-results-list');
    await expect(list).toBeVisible();

    // Scoped to the list container and `.first()`: a bare page-wide text
    // match also hits the "VINYLMANIA" header wordmark (substring match),
    // and every row here shares the same artist/format/country/year/label.
    await expect(list.getByText('Result 0')).toBeVisible();
    await expect(list.getByText('Test Artist').first()).toBeVisible();
    await expect(list.getByText('Vinyl').first()).toBeVisible();
    await expect(list.getByText('Sweden').first()).toBeVisible();
    await expect(list.getByText('1999').first()).toBeVisible();
    await expect(list.getByText('Svek').first()).toBeVisible();
    await expect(list.getByText('Result 20')).not.toBeVisible();

    await page.mouse.wheel(0, 20_000);
    await expect(list.getByText('Result 20')).toBeVisible();
    await expect(page.getByText(/no more results/i)).toBeVisible();
  });

  test('mobile: list mode has no horizontal scroll and title/artist remain legible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/discogs/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [buildListResult(1)],
          pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
        }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    const list = page.getByTestId('search-results-list');
    await expect(list).toBeVisible();
    await expect(list.getByText('Result 1')).toBeVisible();
    await expect(list.getByText('Test Artist')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});
