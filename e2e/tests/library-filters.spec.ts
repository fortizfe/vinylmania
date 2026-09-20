import { expect, type Locator, type Page, test } from '@playwright/test';

import { runAxeScan } from '../helpers/axe';
import { assertUiComponentContrast } from '../helpers/contrast';
import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';
import { settleEntranceOpacity } from '../helpers/settleEntrance';

/**
 * My Library filters — feature 038 (one shared filter component) and 052
 * (list mode), migrated by feature 068 US3 (T039, research D22, FR-021a).
 *
 * What changed: the filters no longer sit in a collapsible panel above the
 * grid with a Genre trigger button (`#filter-genre-trigger`) and an "Apply
 * filters" submit. They live inside the Library's own panel — the "Filters"
 * end drawer at ≥ 640 px, the "Sort & Filter" bottom sheet below it — as
 * native `<details>` disclosures whose checkboxes apply **live**: each tick
 * updates the URL, the record count, the active-filter badge and the results,
 * with focus staying on the checkbox just changed.
 *
 * Search keeps the old collapsible + Apply behaviour unchanged
 * (`search-result-filters.spec.ts`).
 */

interface FilterMeta {
  genre?: string[];
  style?: string[];
  format?: string[];
}

function record(id: string, title: string, meta: FilterMeta = {}) {
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
    ...meta,
  };
}

type LibraryRecord = ReturnType<typeof record>;

/**
 * Mocks `/api/library` over `records`, honouring `genre`/`style`/`format`
 * (comma-joined, OR within a facet, AND across facets) and `page`/`pageSize`
 * the way the backend does. Returns every request it answered.
 */
async function mockLibrary(page: Page, records: LibraryRecord[], pageSize = 20): Promise<URL[]> {
  const requests: URL[] = [];
  await page.route('**/api/library*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const matches = (facet: keyof FilterMeta) => {
      const wanted = url.searchParams.get(facet)?.split(',').filter(Boolean) ?? [];
      return (entry: LibraryRecord) =>
        wanted.length === 0 ||
        (entry[facet] ?? []).some((value: string) => wanted.includes(value));
    };
    const filtered = records
      .filter(matches('genre'))
      .filter(matches('style'))
      .filter(matches('format'));
    const pageNo = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize),
        page: pageNo,
        pageSize,
        totalItems: filtered.length,
      }),
    });
  });
  return requests;
}

/** The two widths at which the same live filters are reachable (contracts §3). */
const SURFACES = [
  { name: 'Filters drawer', viewport: { width: 1280, height: 800 }, trigger: /^Filters/, title: 'Filters' },
  {
    name: 'Sort & Filter sheet',
    viewport: { width: 390, height: 844 },
    trigger: /^Sort & Filter/,
    title: 'Sort & Filter',
  },
] as const;

type Surface = (typeof SURFACES)[number];

/** Opens the drawer/sheet for `surface` and returns its dialog. */
async function openFilters(page: Page, surface: Surface): Promise<Locator> {
  const trigger = page.getByRole('button', { name: surface.trigger });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.click();
  const panel = page.getByRole('dialog', { name: surface.title });
  await expect(panel).toBeVisible();
  return panel;
}

/** Opens a facet's native `<details>` disclosure and returns one option checkbox. */
async function facetOption(panel: Locator, facet: string, option: string): Promise<Locator> {
  await panel.getByText(new RegExp(`^${facet}(\\s*\\(\\d+ selected\\))?$`)).click();
  return panel.getByLabel(option, { exact: true });
}

async function goToLibrary(page: Page, path = '/app/library') {
  await page.goto('/');
  await signInAsFakeGoogleUser(page);
  await page.goto(path);
}

const recordCount = (page: Page) => page.getByText(/^\d+ records?$/);

test.describe('Live filters on My Library (feature 038 US2, migrated by 068 US3)', () => {
  test('the filters are not in the page flow: no free-text Genre/Style, no options until the panel opens', async ({
    page,
  }) => {
    await mockLibrary(page, [record('entry-1', 'Stockholm')]);
    await goToLibrary(page);

    await expect(page.getByText('Stockholm')).toBeVisible();
    // The "Filters" button now opens a dialog (the end drawer), it no longer
    // expands a collapsible panel in the page flow (contracts §4).
    const trigger = page.getByRole('button', { name: /^Filters/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    // Feature 038: genre/style are picked from curated lists, never typed.
    await expect(page.getByRole('textbox', { name: /^genre$/i })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /^style$/i })).toHaveCount(0);
    // Nothing filter-shaped is rendered inline any more (no collapsible panel).
    await expect(page.locator('#filter-genre-trigger')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /apply/i })).toHaveCount(0);
  });

  for (const surface of SURFACES) {
    test.describe(`in the ${surface.name}`, () => {
      test.use({ viewport: surface.viewport });

      test('ticking a genre applies live: URL, record count, badge and results all update (FR-021a)', async ({
        page,
      }) => {
        await mockLibrary(page, [
          record('entry-1', 'Rock Only', { genre: ['Rock'] }),
          record('entry-2', 'Jazz Only', { genre: ['Jazz'] }),
        ]);
        await goToLibrary(page);
        await expect(page.getByText('Jazz Only')).toBeVisible();
        await expect(recordCount(page)).toHaveText('2 records');

        const panel = await openFilters(page, surface);
        const rock = await facetOption(panel, 'Genre', 'Rock');
        await rock.check();

        // Live: no Apply, the panel stays open, focus stays put.
        await expect(panel.getByRole('button', { name: /apply/i })).toHaveCount(0);
        await expect(panel).toBeVisible();
        await expect(rock).toBeFocused();

        await expect(page).toHaveURL(/[?&]genre=Rock(&|$)/);
        await expect(page.getByText('Rock Only')).toBeVisible();
        await expect(page.getByText('Jazz Only')).toHaveCount(0);
        await expect(recordCount(page)).toHaveText('1 record');
        await expect(page.getByRole('button', { name: surface.trigger })).toHaveAccessibleName(
          /1 active filter/,
        );
      });

      test('unticking it restores the unfiltered list (FR-021a)', async ({ page }) => {
        await mockLibrary(page, [
          record('entry-1', 'Rock Only', { genre: ['Rock'] }),
          record('entry-2', 'Jazz Only', { genre: ['Jazz'] }),
        ]);
        await goToLibrary(page, '/app/library?genre=Rock');
        await expect(page.getByText('Rock Only')).toBeVisible();

        const panel = await openFilters(page, surface);
        const rock = await facetOption(panel, 'Genre', 'Rock');
        await expect(rock).toBeChecked();
        await rock.uncheck();

        await expect(page).not.toHaveURL(/genre=/);
        await expect(page.getByText('Jazz Only')).toBeVisible();
        await expect(rock).toBeFocused();
      });

      test('"Clear all filters" clears every facet and stays focusable when nothing is active', async ({
        page,
      }) => {
        await mockLibrary(page, [
          record('entry-1', 'Rock Only', { genre: ['Rock'] }),
          record('entry-2', 'Jazz Only', { genre: ['Jazz'] }),
        ]);
        await goToLibrary(page, '/app/library?genre=Rock');
        await expect(page.getByText('Rock Only')).toBeVisible();

        const panel = await openFilters(page, surface);
        const clear = panel.getByRole('button', { name: 'Clear all filters' });
        await expect(clear).toBeVisible();
        await clear.click();

        await expect(page).not.toHaveURL(/genre=/);
        await expect(page.getByText('Jazz Only')).toBeVisible();
        await expect(recordCount(page)).toHaveText('2 records');
        await expect(clear).toBeFocused();
        await expect(clear).toHaveAttribute('aria-disabled', 'true');
      });

      test('no horizontal scroll appears while a facet disclosure is open (SC-005)', async ({
        page,
      }) => {
        await mockLibrary(page, [record('entry-1', 'Stockholm')]);
        await goToLibrary(page);
        await expect(page.getByText('Stockholm')).toBeVisible();

        const panel = await openFilters(page, surface);
        // Style is the searchable facet (757 options) — the widest content.
        await panel.getByText(/^Style(\s*\(\d+ selected\))?$/).click();
        await expect(panel.getByRole('textbox', { name: /search style/i })).toBeVisible();

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(surface.viewport.width);
      });
    });
  }

  test('a filter combination matching no entries shows a distinct "no results for the active filters" message', async ({
    page,
  }) => {
    await mockLibrary(page, [record('entry-1', 'Stockholm', { genre: ['Rock'] })]);
    await goToLibrary(page);
    await expect(page.getByText('Stockholm')).toBeVisible();

    const panel = await openFilters(page, SURFACES[0]);
    const nonMusic = await facetOption(panel, 'Genre', 'Non-Music');
    await nonMusic.check();

    await expect(page.getByText(/no results for the active filters/i)).toBeVisible();
    await expect(page.getByText(/no records yet/i)).toHaveCount(0);
  });

  test('filters remain active while more batches load on scroll (FR-022, now infinite scroll)', async ({
    page,
  }) => {
    const rockRecords = Array.from({ length: 40 }, (_, i) =>
      record(`entry-${i + 1}`, `Rock Result ${i + 1}`, { genre: ['Rock'] }),
    );
    const requests = await mockLibrary(page, [
      ...rockRecords,
      record('entry-jazz', 'Jazz Result', { genre: ['Jazz'] }),
    ]);
    await goToLibrary(page, '/app/library?genre=Rock');

    await expect(page.getByText('Rock Result 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Rock Result 40', { exact: true })).toHaveCount(0);

    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          return page.getByText('Rock Result 40', { exact: true }).isVisible();
        },
        { timeout: 10_000, intervals: [150] },
      )
      .toBe(true);

    await expect(page).toHaveURL(/genre=Rock/);
    await expect(page.getByText('Jazz Result')).toHaveCount(0);
    // Every batch carried the active filter, including the second one.
    expect(requests.map((url) => url.searchParams.get('genre'))).not.toContain(null);
    expect(requests.map((url) => url.searchParams.get('page') ?? '1')).toContain('2');
  });
});

test.describe('Filters behave identically in list mode (feature 052, US2)', () => {
  test('ticking a genre narrows the list rows the same way it narrows the grid', async ({
    page,
  }) => {
    await mockLibrary(page, [
      record('entry-1', 'Rock Only', { genre: ['Rock'] }),
      record('entry-2', 'Jazz Only', { genre: ['Jazz'] }),
    ]);
    await goToLibrary(page);
    await expect(page.getByText('Jazz Only')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    const panel = await openFilters(page, SURFACES[0]);
    const rock = await facetOption(panel, 'Genre', 'Rock');
    await rock.check();

    await expect(page.getByText('Rock Only')).toBeVisible();
    await expect(page.getByText('Jazz Only')).toHaveCount(0);
    await expect(page.getByTestId('library-record-list')).toBeVisible();
  });

  test('the empty-library and no-matches-for-filter messages are unchanged in list mode', async ({
    page,
  }) => {
    await mockLibrary(page, [record('entry-1', 'Stockholm', { genre: ['Rock'] })]);
    await goToLibrary(page);
    await expect(page.getByText('Stockholm')).toBeVisible();

    await page.getByTestId('view-mode-list').click();
    await expect(page.getByTestId('library-record-list')).toBeVisible();

    const panel = await openFilters(page, SURFACES[0]);
    const nonMusic = await facetOption(panel, 'Genre', 'Non-Music');
    await nonMusic.check();

    await expect(page.getByText(/no results for the active filters/i)).toBeVisible();
  });
});

test.describe('Library filters WCAG 2.1 AA automated scan (spec 058, US1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the open Filters drawer has no automatically detectable WCAG 2.1 AA violations in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await mockLibrary(page, [record('entry-1', 'Stockholm', { genre: ['Rock'] })]);
      await goToLibrary(page);
      await expect(page.getByText('Stockholm')).toBeVisible();

      const panel = await openFilters(page, SURFACES[0]);
      await facetOption(panel, 'Genre', 'Rock');

      // The drawer animates in; axe folds a mid-animation ancestor opacity
      // into its contrast maths and reports a false-positive `color-contrast`.
      await settleEntranceOpacity(page, '[data-testid="sheet-surface"]');

      const seriousOrCritical = await runAxeScan(page);

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});

test.describe('Library filter option contrast (spec 058, US2)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`Genre option checkbox border meets WCAG UI component contrast in ${theme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await mockLibrary(page, [record('entry-1', 'Stockholm', { genre: ['Rock'] })]);
      await goToLibrary(page);
      await expect(page.getByText('Stockholm')).toBeVisible();

      const panel = await openFilters(page, SURFACES[0]);
      const rock = await facetOption(panel, 'Genre', 'Rock');
      await settleEntranceOpacity(page, '[data-testid="sheet-surface"]');

      await assertUiComponentContrast(
        page,
        rock,
        // The painted surface is the Card inside the animating wrapper that
        // carries `sheet-surface`; the wrapper itself has no background.
        page.locator('[data-testid="sheet-surface"] .overlay-surface'),
        `Genre option checkbox border (${theme})`,
      );
    });
  }
});
