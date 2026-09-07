/**
 * E2E spec: "Mi colección en cifras" — Block 1 collection statistics
 * (feature 061, User Story 1 — T027).
 *
 * Mirrors `library-discogs-sync.spec.ts` / `wishlist-discogs-sync.spec.ts`:
 * drives the full stack (frontend + backend + Discogs stub) so the statistics
 * section is exercised against the real backend, hermetically. The backend is
 * pointed at the stub via DISCOGS_OAUTH_BASE_URL / DISCOGS_BASE_URL (see
 * playwright.config.ts), so no real Discogs calls are made.
 *
 * Each test signs in as a fresh fake Google identity, which sidesteps the
 * backend's ~5-minute sync cache (a brand-new user has an empty cache) — the
 * same approach the library / wishlist specs rely on.
 *
 * Control API used (see e2e/helpers/discogsOauthStub.ts):
 *   POST /__stub/reset                       — clear all state between tests
 *   PUT  /__stub/collections/:username        — seed / replace the stub collection
 *   GET  /__stub/price-suggestions            — per-release marketplace hit counters
 *
 * Designated fixtures (kept stable in the stub for feature 061):
 *   STATS_RELEASE_NO_YEAR      = 6100  — `basic_information.year` omitted → "Año desconocido"
 *   STATS_RELEASE_EARLY_ADDED  = 6102  — fixed `date_added` 2021-02-05 → earliest growth month
 *   per-release facets are derived from `releaseId % 9` (DERIVED_FACETS in the stub)
 *
 * Covers US1 acceptance scenarios 1, 2, 3, 4, 6 and FR-001 / FR-002 / FR-004 /
 * FR-006 / FR-007 / FR-009 / FR-010 / FR-011 / FR-011a.
 *
 * FR-007 (genre/style breakdowns): `syncLibrary`'s `persistCollectionFacets`
 * write-back now persists `genre` / `style` from `basic_information` alongside
 * `year` / `label` / `primaryArtist` (guarded so it never overwrites a value
 * feature 038's catalog enrichment already wrote), so `aggregateStatistics`
 * sees them straight from the collection mirror. The backend integration test
 * `tests/integration/collectionStats/statistics.integration.test.ts` asserts
 * the same. The FR-007 case below (T027-7) is therefore a plain passing test.
 */

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';
const STUB_USERNAME = 'e2e-discogs-user';

// Designated stub fixtures — keep in sync with discogsOauthStub.ts.
const STATS_RELEASE_NO_YEAR = 6100;
const STATS_RELEASE_EARLY_ADDED = 6102;
const STATS_EARLY_ADDED_MONTH_LABEL = 'Feb 2021';

// DERIVED_FACETS is indexed by `releaseId % 9`. Index 2 → "Iron Maiden" / 1979 /
// "Roadrunner Records"; index 7 → "Various" (excluded from the artist stat).
const IRON_MAIDEN_IDS = [2, 11, 20, 29];
const VARIOUS_ARTIST_ID = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Signs in with a fresh identity and links Discogs via the stub authorize page. */
async function signInAndLinkDiscogs(page: Page): Promise<void> {
    await page.goto('/');
    await signInAsFakeGoogleUser(page);

    await page.goto('/app/profile');
    await page.getByRole('button', { name: /connect discogs account/i }).click();
    await expect(page.getByRole('heading', { name: /discogs authorization/i })).toBeVisible();
    await page.locator('#authorize').click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByText('e2e-discogs-user')).toBeVisible();
}

interface CollectionSeed {
    releaseId: number;
    mediaCondition?: string;
    labels?: string[];
    genres?: string[];
    styles?: string[];
    year?: number | null;
}

/** Seeds (replaces) the stub Discogs collection for the linked user. */
async function seedCollection(releases: CollectionSeed[]): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releases }),
    });
    if (!res.ok) throw new Error(`Failed to seed stub collection: ${res.status}`);
}

/** Total number of GET /marketplace/price_suggestions hits across all releases. */
async function marketplaceHitTotal(): Promise<number> {
    const res = await fetch(`${STUB_URL}/__stub/price-suggestions`);
    const body = (await res.json()) as { totalHits: number };
    return body.totalHits;
}

/**
 * The breakdown card (`<div>`) wrapping a given `<h3>` heading. Scoped via the
 * heading's parent rather than a list role: the ranked `<ol>` uses
 * `list-style: none`; query `ol > li` for its rows.
 */
function breakdownCard(page: Page, title: string) {
    return page.getByRole('heading', { name: title, exact: true }).locator('xpath=..');
}

/** Opens /app/stats and waits for the Block 1 section to finish loading. */
async function openStats(page: Page): Promise<void> {
    await page.goto('/app/stats');
    await expect(
        page.getByRole('heading', { name: 'Collection statistics' }),
    ).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Mi colección en cifras — Block 1 statistics (feature 061, US1)', () => {
    // --- US1 Scenario 6 / FR-001: nav entry at the library / wishlist level ---

    test('T027-1: "Collection stats" sits alongside "My library" / "My wishlist" and routes to /app/stats', async ({
        page,
    }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        // Desktop header: all three section links visible together.
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.getByRole('link', { name: /my library/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /my wishlist/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /collection stats/i })).toBeVisible();

        await page.getByRole('link', { name: /collection stats/i }).click();
        await expect(page).toHaveURL(/\/app\/stats$/);

        // Mobile menu: the link is present in the same menu dialog as the others.
        await page.setViewportSize({ width: 375, height: 812 });
        await page.getByRole('button', { name: /^menu$/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('link', { name: /my library/i })).toBeVisible();
        await expect(dialog.getByRole('link', { name: /my wishlist/i })).toBeVisible();
        await expect(dialog.getByRole('link', { name: /collection stats/i })).toBeVisible();

        await dialog.getByRole('link', { name: /collection stats/i }).click();
        await expect(page).toHaveURL(/\/app\/stats$/);
    });

    // --- US1 Scenario 4 / FR-002: unlinked user sees only the link-required gate ---

    test('T027-2: an unlinked user sees only the link-required card — no statistics, no breakdowns', async ({
        page,
    }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        await page.goto('/app/stats');

        // The reused gate (LibraryLinkRequired, context:'stats').
        await expect(page.getByText(/link your discogs account/i)).toBeVisible();
        await expect(
            page.getByText(/collection stats are built from your discogs collection/i),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: /go to your profile/i })).toBeVisible();

        // No statistics content leaks past the gate.
        await expect(
            page.getByRole('heading', { name: 'Collection statistics' }),
        ).toHaveCount(0);
        await expect(page.getByText(/records in your collection/i)).toHaveCount(0);
        await expect(
            page.getByRole('heading', { name: /^by (decade|genre|style|label)$/i }),
        ).toHaveCount(0);
        await expect(page.getByRole('img', { name: /growth/i })).toHaveCount(0);
    });

    // --- US1 Scenarios 1 + 2 / FR-004 / FR-009 / FR-011 / FR-011a ---

    test('T027-3: a populated collection renders the breakdowns (ordered by count), the "Otros" disclosure, top artists and the growth data table', async ({
        page,
    }) => {
        // A deliberate spread:
        //  - 4 Iron Maiden releases (releaseId % 9 === 2) → the most-present artist,
        //    all on "Roadrunner Records" (that label's derived name)
        //  - 1 "Various" release (releaseId % 9 === 7) → must NOT appear in Top artists
        //  - 14 releases each with a distinct explicit label → >12 label buckets,
        //    so the "Otros (N)" tail disclosure renders (FR-011a).
        await seedCollection([
            ...IRON_MAIDEN_IDS.map((releaseId) => ({ releaseId })),
            { releaseId: VARIOUS_ARTIST_ID },
            ...Array.from({ length: 14 }, (_, i) => ({
                releaseId: 300 + i,
                labels: [`Label ${String(i + 1).padStart(2, '0')}`],
            })),
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);

        // Totals headline (19 seeded releases).
        const totalLabel = page.getByText(/records in your collection/i);
        await expect(totalLabel).toBeVisible();
        await expect(totalLabel.locator('xpath=following-sibling::span[1]')).toHaveText('19');

        // The decade + label breakdowns render.
        await expect(page.getByRole('heading', { name: 'By decade', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'By label', exact: true })).toBeVisible();

        // Ordered by descending count: the highest-count bucket is the first row.
        //  - By label:  "Roadrunner Records" (4 — the Iron Maiden cluster) leads.
        //  - By decade: "1970s" (four Iron Maiden + derived 1970s releases) leads.
        await expect(breakdownCard(page, 'By label').locator('ol > li').first()).toContainText(
            'Roadrunner Records',
        );
        await expect(breakdownCard(page, 'By decade').locator('ol > li').first()).toContainText(
            '1970s',
        );

        // FR-011a: the label tail is a real, keyboard-operable disclosure button.
        const otros = page.getByRole('button', { name: /^otros \(\d+\)/i }).first();
        await expect(otros).toBeVisible();
        await expect(otros).toHaveAttribute('aria-expanded', 'false');
        await otros.click();
        await expect(otros).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByText(/more values/i).first()).toBeVisible();

        // FR-009: the most-present artist is highlighted and "Various" is excluded.
        const topArtists = page
            .getByRole('heading', { name: /top artists/i })
            .locator('xpath=..');
        await expect(topArtists.getByText(/most present/i)).toBeVisible();
        await expect(topArtists.getByText('Iron Maiden').first()).toBeVisible();
        await expect(topArtists.getByText(/^various/i)).toHaveCount(0);

        // FR-010: the growth chart exposes its visually-hidden data table with one
        // row per period, plus the per-period ⇄ cumulative toggle.
        await expect(page.getByRole('img', { name: /growth/i })).toBeVisible();
        const growthTable = page.getByRole('table', { name: /collection growth by month/i });
        await expect(growthTable).toBeAttached();
        expect(await growthTable.locator('tbody tr').count()).toBeGreaterThan(1);
        await expect(page.getByRole('button', { name: /per period/i })).toBeVisible();
        const cumulative = page.getByRole('button', { name: /^cumulative$/i });
        await expect(cumulative).toBeVisible();
        await cumulative.click();
        await expect(cumulative).toHaveAttribute('aria-pressed', 'true');
    });

    // --- FR-007: genre + style breakdowns computed from `basic_information` ---
    //
    // `syncLibrary.persistCollectionFacets` persists `genre` / `style` from the
    // collection mirror's `basic_information`, so both breakdowns fill in from
    // the sync alone with no catalog lookup (see file header + the backend
    // `statistics.integration.test.ts`).
    test('T027-7: [FR-007] genre and style breakdowns are populated from the seeded basic_information', async ({
        page,
    }) => {
        await seedCollection([
            { releaseId: 401, genres: ['Rock', 'Electronic'], styles: ['Synth-pop'] },
            { releaseId: 402, genres: ['Rock'], styles: ['Heavy Metal'] },
            { releaseId: 403, genres: ['Jazz'], styles: ['Modal'] },
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);

        await expect(breakdownCard(page, 'By genre').locator('ol > li').first()).toContainText(
            'Rock',
        );
        await expect(breakdownCard(page, 'By style').locator('ol > li')).not.toHaveCount(0);
    });

    // --- Edge case / FR-006: a release with no year → "Año desconocido" bucket ---

    test('T027-4: release 6100 (no year) lands in the "Año desconocido" decade bucket', async ({
        page,
    }) => {
        await seedCollection([
            { releaseId: STATS_RELEASE_NO_YEAR },
            { releaseId: 11 },
            { releaseId: 20 },
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);

        await expect(
            breakdownCard(page, 'By decade').getByText('Año desconocido'),
        ).toBeVisible();
    });

    // --- US1 Scenario 3 / FR-010: growth uses the real Discogs date_added ---

    test('T027-5: release 6102 (early date_added 2021-02-05) is counted in the Feb 2021 growth month, not a Vinylmania date', async ({
        page,
    }) => {
        await seedCollection([
            { releaseId: STATS_RELEASE_EARLY_ADDED },
            { releaseId: 11 },
            { releaseId: 20 },
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);

        const growthTable = page.getByRole('table', { name: /collection growth by month/i });
        await expect(growthTable).toBeAttached();

        // The earliest row is the real Discogs date of entry for release 6102.
        // (The other two seeded releases get recent `date_added` values, so this
        // row can only come from 6102's fixed 2021-02-05 — proving the chart
        // reflects the Discogs date, not "now".)
        const firstRow = growthTable.locator('tbody tr').first();
        await expect(firstRow.getByRole('rowheader')).toHaveText(STATS_EARLY_ADDED_MONTH_LABEL);
        // ...and that record is counted there ("Added" column = 1).
        await expect(firstRow.locator('td').first()).toHaveText('1');
    });

    // --- FR-004: Block 1 (statistics) issues no Discogs marketplace / catalog data call ---

    test('T027-6: Block 1 renders with zero Discogs marketplace price calls, independent of Block 2', async ({
        page,
    }) => {
        await seedCollection([{ releaseId: 11 }, { releaseId: 20 }, { releaseId: 29 }]);

        // Block 2's valuation auto-starts on mount and legitimately calls
        // price_suggestions (FR-020 / FR-023) — that traffic is Block 2's, not
        // Block 1's. Abort every /valuation request at the network layer so the
        // only thing that can move the stub's price-suggestions counter is a
        // (forbidden) marketplace call made while building the statistics. This
        // also exercises FR-012 / FR-020: Block 1 stays fully usable when Block 2
        // cannot load at all.
        await page.route('**/api/collection-stats/valuation*', (route) => route.abort());

        await signInAndLinkDiscogs(page);
        await openStats(page);
        await expect(page.getByText(/records in your collection/i)).toBeVisible();

        // FR-004: Block 1 is built from the synchronized collection mirror only.
        // The stub's per-release price_suggestions hit counter is the only
        // Discogs-data hit counter it exposes, and it must stay at zero.
        expect(await marketplaceHitTotal()).toBe(0);

        // Block 1 is fully interactive even though Block 2 never loaded.
        const cumulative = page.getByRole('button', { name: /^cumulative$/i });
        await cumulative.click();
        await expect(cumulative).toHaveAttribute('aria-pressed', 'true');

        // NOTE: the stub exposes no GET /releases/:id catalog hit counter, so the
        // "zero catalog fetch" half of the check (spec.md Independent Test) is
        // covered by the backend use-case tests (T023: "makes zero calls to any
        // catalog/marketplace port") rather than asserted here.
    });
});
