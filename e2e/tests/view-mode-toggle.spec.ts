import { expect, test } from '@playwright/test';

import { assertFocusIndicatorContrast, assertUiComponentContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

function buildLibraryResponse(count: number) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: `entry-${i}`,
      discogsReleaseId: i,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: {
        discogsId: i,
        title: `Record ${i}`,
        artists: [{ discogsArtistId: i, name: 'Test Artist' }],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        discogsUrl: `https://www.discogs.com/release/${i}`,
      },
    })),
    page: 1,
    pageSize: 20,
    totalItems: count,
  };
}

function buildSearchResults(count: number) {
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

async function mockLibrary(page: import('@playwright/test').Page, count = 3) {
  await page.route('**/api/library*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildLibraryResponse(count)),
    });
  });
}

async function mockSearch(page: import('@playwright/test').Page, count = 3) {
  await page.route('**/api/discogs/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSearchResults(count)),
    });
  });
}

test.describe('View mode toggle (feature 052, US1)', () => {
  test('a first-time visit to either screen defaults to grid', async ({ page }) => {
    await mockLibrary(page);
    await mockSearch(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();
    await expect(page.getByTestId('view-mode-grid')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();
    await expect(page.getByTestId('view-mode-grid')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('mode chosen on one screen persists across reload and does not affect the other screen', async ({
    page,
  }) => {
    await mockLibrary(page);
    await mockSearch(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();
    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    // Visiting search for the first time still defaults to grid — the two
    // screens' preferences are independent (spec FR-003).
    await page.goto('/app/search?q=rock');
    await expect(page.getByTestId('search-results-grid')).toBeVisible();
    await expect(page.getByTestId('view-mode-grid')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('both toggle options meet 44x44px at mobile viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    const gridBox = await page.getByTestId('view-mode-grid').boundingBox();
    const listBox = await page.getByTestId('view-mode-list').boundingBox();
    expect(gridBox?.width).toBeGreaterThanOrEqual(44);
    expect(gridBox?.height).toBeGreaterThanOrEqual(44);
    expect(listBox?.width).toBeGreaterThanOrEqual(44);
    expect(listBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('the toggle can be reached and operated with keyboard only', async ({ page }) => {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    await page.getByTestId('view-mode-grid').focus();
    await expect(page.getByTestId('view-mode-grid')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('library-record-list')).toBeVisible();
    await expect(page.getByTestId('view-mode-list')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  /**
   * Each contrast check below runs as its own test rather than as several
   * chained assertions in one test — otherwise the first failing assertion
   * would abort the test and hide whether the later ones pass or fail.
   */
  async function goToLibraryForContrastChecks(page: import('@playwright/test').Page) {
    await mockLibrary(page);
    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();
  }

  test.describe('ViewModeToggle UI component and focus-indicator contrast (spec 058, US2)', () => {
    for (const theme of ['light', 'dark'] as const) {
      test(`toggle container border meets WCAG UI component contrast in ${theme} mode`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await goToLibraryForContrastChecks(page);

        const toggleContainer = page.getByTestId('view-mode-toggle');
        const appShell = page.getByTestId('app-shell');
        await assertUiComponentContrast(
          page,
          toggleContainer,
          appShell,
          `ViewModeToggle container border (${theme})`,
        );
      });

      test(`active option fill meets WCAG UI component contrast in ${theme} mode`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await goToLibraryForContrastChecks(page);

        const toggleContainer = page.getByTestId('view-mode-toggle');
        const activeOption = page.getByTestId('view-mode-grid');
        await assertUiComponentContrast(
          page,
          activeOption,
          toggleContainer,
          `ViewModeToggle active option fill (${theme})`,
        );
      });

      // This file already reaches the toggle via keyboard (see "the toggle
      // can be reached and operated with keyboard only" above), so a
      // focus-indicator check applies here too (per spec 058 T021).
      test(`active option meets WCAG focus-indicator contrast in ${theme} mode`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await goToLibraryForContrastChecks(page);

        const activeOption = page.getByTestId('view-mode-grid');
        await assertFocusIndicatorContrast(
          page,
          activeOption,
          `ViewModeToggle active option focus indicator (${theme})`,
        );
      });
    }
  });
});
