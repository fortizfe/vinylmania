import { expect, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

type Page = import('@playwright/test').Page;

function buildLibraryItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
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
  }));
}

/**
 * Feature 068 (US2) replaced Previous/Next with infinite scroll, so this mock
 * has to honour `page`/`pageSize` instead of returning the whole collection
 * for every request (research D22).
 */
async function routeLibrary(page: Page, items: object[]) {
  await page.route('**/api/library*', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const pageNo = Math.max(1, Number(params.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Number(params.get('pageSize') ?? '20') || 20);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: items.slice((pageNo - 1) * pageSize, pageNo * pageSize),
        page: pageNo,
        pageSize,
        totalItems: items.length,
      }),
    });
  });
}

/** Loaded records only — skeleton placeholders carry no detail link. */
const recordCount = (page: Page) =>
  page
    .locator(
      '[data-testid="library-record-grid"] a[href^="/app/library/records/"], [data-testid="library-record-list"] a[href^="/app/library/records/"]',
    )
    .count();

/** Scrolls to the bottom until `check()` holds, loading one batch per pass. */
async function scrollUntil(page: Page, check: () => Promise<boolean>) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        return check();
      },
      { timeout: 12_000, intervals: [150] },
    )
    .toBe(true);
}

async function goToLibrary(page: Page, count: number) {
  await routeLibrary(page, buildLibraryItems(count));

  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto('/app/library');
  await expect(page.getByTestId('library-record-grid')).toBeVisible();
}

test.describe('Library page responsive layout (spec 035, US1)', () => {
  test('desktop: record grid uses a deliberate multi-column composition (Scenario 5)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToLibrary(page, 12);

    const grid = page.getByTestId('library-record-grid');
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

  test('mobile: single column, no horizontal scroll, and scrolling loads the rest of the collection (Scenario 6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToLibrary(page, 25);

    const grid = page.getByTestId('library-record-grid');
    const columnCount = await grid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(' ').length;
    });
    expect(columnCount).toBe(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    // Feature 068 US2 removed Previous/Next: the second batch arrives by
    // scrolling, and the view-mode toggle carries the 44x44 touch-target
    // check the Next button used to (research D22).
    expect(await recordCount(page)).toBe(20);
    await scrollUntil(page, async () => (await recordCount(page)) === 25);
    await expect(page.getByText(/reached the end of your collection\s*—\s*25 records/)).toBeVisible();

    const box = await page.getByTestId('view-mode-list').boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile: the "link Discogs account" control meets 44x44px when the account is unlinked (Scenario 6 edge case)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/library*', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'discogs_not_linked', message: 'Not linked' }),
      });
    });

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');

    const link = page.getByRole('link', { name: /go to your profile/i });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test.describe('List mode (feature 052, US2)', () => {
  /** The detailed row under test, followed by filler so paging stays meaningful. */
  function buildListItems() {
    return [
      {
        id: 'entry-stockholm',
        discogsReleaseId: 1,
        addedAt: '2026-07-03T00:00:00.000Z',
        catalogStatus: 'ok',
        release: {
          discogsId: 1,
          title: 'Stockholm',
          year: 1999,
          country: 'Sweden',
          artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
          labels: [{ discogsLabelId: 1, name: 'Svek' }],
          formats: [{ name: 'Vinyl', descriptions: [] }],
          genres: [],
          styles: [],
          tracklist: [],
          images: [],
          discogsUrl: 'https://www.discogs.com/release/1',
        },
      },
      ...buildLibraryItems(24),
    ];
  }

  test('shows all six fields per row and scrolling loads the next batch', async ({ page }) => {
    await routeLibrary(page, buildListItems());

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    const list = page.getByTestId('library-record-list');
    await expect(list).toBeVisible();

    // Scoped to the list container: a bare page-wide `getByText('Vinyl')`
    // also matches the always-present "VINYLMANIA" header wordmark
    // (Playwright's default text match is a case-insensitive substring).
    await expect(list.getByText('Stockholm')).toBeVisible();
    await expect(list.getByText('The Persuader')).toBeVisible();
    await expect(list.getByText('Vinyl')).toBeVisible();
    await expect(list.getByText('Sweden')).toBeVisible();
    await expect(list.getByText('1999')).toBeVisible();
    await expect(list.getByText('Svek')).toBeVisible();

    // Feature 068 US2: the second batch arrives by scrolling, not by Next.
    expect(await recordCount(page)).toBe(20);
    await scrollUntil(page, async () => (await recordCount(page)) === 25);
    await expect(page.getByText(/reached the end of your collection\s*—\s*25 records/)).toBeVisible();
  });

  test('mobile: list mode has no horizontal scroll and title/artist remain legible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await routeLibrary(page, buildListItems());

    await page.goto('/');
    await signInAsFakeGoogleUser(page);
    await page.goto('/app/library');
    await expect(page.getByTestId('library-record-grid')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    const list = page.getByTestId('library-record-list');
    await expect(list).toBeVisible();
    await expect(list.getByText('Stockholm')).toBeVisible();
    await expect(list.getByText('The Persuader')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test.describe('Library WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await goToLibrary(page, 12);

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});
