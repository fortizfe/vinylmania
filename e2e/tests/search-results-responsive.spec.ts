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
