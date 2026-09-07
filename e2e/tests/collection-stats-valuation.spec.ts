/**
 * E2E spec: "Mi colección en cifras" — Block 2 estimated market value
 * (feature 061, User Story 2 — T040).
 *
 * Mirrors `collection-stats-statistics.spec.ts` (T027) exactly: drives the full
 * stack (frontend + backend + Discogs stub) so the valuation section is
 * exercised against the real backend, hermetically. The backend is pointed at
 * the stub via DISCOGS_OAUTH_BASE_URL / DISCOGS_BASE_URL (see
 * playwright.config.ts), so no real Discogs calls are made.
 *
 * Each test signs in as a fresh fake Google identity, which sidesteps the
 * backend's ~5-minute sync cache and the 7-day price cache (a brand-new user
 * has cold caches, keyed by uid) — the same approach T027 / the library /
 * wishlist specs rely on.
 *
 * Control API used (see e2e/helpers/discogsOauthStub.ts):
 *   POST /__stub/reset                              — clear all state between tests
 *   PUT  /__stub/collections/:username              — seed / replace the stub collection
 *   POST /__stub/price-suggestions { seeds }        — per-release price map / 404 (null)
 *   GET  /__stub/price-suggestions                  — per-release marketplace hit counters
 *   POST /__stub/seller-settings   { missing }      — toggle the "no seller settings" 403
 *   POST /__stub/failure { priceSuggestions: … }    — force 503 / paced price responses
 *
 * Designated fixtures (kept stable in the stub for feature 061):
 *   VALUATION_RELEASE_NO_MARKET_DATA = 6101 — GET price_suggestions → 404 → excluded, counted
 *   per-release facets derived from `releaseId % 9` (DERIVED_FACETS in the stub)
 *   per-grade EUR price map derived from `releaseId % 47` (derivePriceSuggestions)
 *
 * Covers US2 acceptance scenarios 2, 3, 4, 5, 6, 7 and FR-012 / FR-015 / FR-016
 * / FR-017 / FR-018 / FR-019 / FR-020 / plan.md deviation 1 (seller settings).
 */

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';
const STUB_USERNAME = 'e2e-discogs-user';

// Designated stub fixtures — keep in sync with discogsOauthStub.ts.
const VALUATION_RELEASE_NO_MARKET_DATA = 6101;

// An exact grade string from backend conditionGrading.ts (`MEDIA_CONDITIONS`);
// the stub's per-grade price map is keyed by these verbatim.
const GRADE = 'Near Mint (NM or M-)';

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

/** Marks the linked stub account as missing Discogs seller settings (→ 403 on price calls). */
async function setSellerSettingsMissing(missing: boolean): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/seller-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missing }),
    });
    if (!res.ok) throw new Error(`Failed to set seller-settings flag: ${res.status}`);
}

/** Total number of GET /marketplace/price_suggestions hits across all releases. */
async function marketplaceHitTotal(): Promise<number> {
    const res = await fetch(`${STUB_URL}/__stub/price-suggestions`);
    const body = (await res.json()) as { totalHits: number };
    return body.totalHits;
}

/** The Block 2 section, exposed as a landmark region by its `aria-labelledby` heading. */
function valuationRegion(page: Page) {
    return page.getByRole('region', { name: 'Estimated market value' });
}

/** The running/estimated total figure inside the valuation card (the only `text-4xl` node in the region). */
function valuationTotal(page: Page) {
    return valuationRegion(page).locator('.text-4xl');
}

/** Opens /app/stats and waits for the Block 1 section to finish loading. */
async function openStats(page: Page): Promise<void> {
    await page.goto('/app/stats');
    await expect(
        page.getByRole('heading', { name: 'Collection statistics' }),
    ).toBeVisible({ timeout: 20_000 });
}

/**
 * Waits for the progressive valuation loop to settle at `status: 'complete'`:
 * the "Ver todos" control is only rendered once `perDisc` (final page only) is
 * present and there is no notice, and the progress bar is torn down.
 */
async function waitForValuationComplete(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: /ver todos/i })).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(valuationRegion(page).getByRole('status')).toHaveText(
        /valoración completada/i,
    );
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Mi colección en cifras — Block 2 estimated market value (feature 061, US2)', () => {
    // --- US2 Scenario 5 / FR-020: the valuation auto-starts and settles ---

    test('T040-1: opening the section auto-starts the valuation (no button) and it settles to a stable complete total', async ({
        page,
    }) => {
        await seedCollection(
            [10, 12, 13, 14, 15].map((releaseId) => ({ releaseId, mediaCondition: GRADE })),
        );

        await signInAndLinkDiscogs(page);
        await openStats(page);

        // No "start / calculate" affordance — the loop runs on mount (FR-020).
        await expect(
            page.getByRole('button', { name: /calcula|estimate value|valorar|start valuation/i }),
        ).toHaveCount(0);

        // The total + coverage label appear on their own.
        const coverage = valuationRegion(page).getByText(/estimado sobre \d+ de \d+ discos/i);
        await expect(coverage).toBeVisible({ timeout: 20_000 });
        await expect(valuationTotal(page)).toContainText('€');

        await waitForValuationComplete(page);

        // All five covered → "estimado sobre 5 de 5 discos", and the figure is
        // stable once complete.
        await expect(coverage).toHaveText(/estimado sobre 5 de 5 discos/i);
        const settled = await valuationTotal(page).innerText();
        await page.waitForTimeout(1_000);
        expect(await valuationTotal(page).innerText()).toBe(settled);
    });

    // --- US2 Scenarios 2 + 6 / FR-016 / FR-017 / FR-018: coverage label + arithmetic ---

    test('T040-2: the coverage label excludes the data-less release and the condition-less copy, and the reasons add up', async ({
        page,
    }) => {
        // 5 covered + 1 with no market data (release 6101 → 404) + 1 with no
        // recorded media condition → covered 5 of 7.
        await seedCollection([
            ...[10, 12, 13, 14, 15].map((releaseId) => ({ releaseId, mediaCondition: GRADE })),
            { releaseId: VALUATION_RELEASE_NO_MARKET_DATA, mediaCondition: GRADE },
            { releaseId: 20 }, // no mediaCondition
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);
        await waitForValuationComplete(page);

        await expect(
            valuationRegion(page).getByText(/estimado sobre 5 de 7 discos/i),
        ).toBeVisible();

        // The full per-disc breakdown backs the arithmetic: 5 valued rows + one
        // "sin datos de mercado" + one "sin estado" = 7 total (FR-016/017/018).
        await page.getByRole('button', { name: /ver todos/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog.locator('tbody tr')).toHaveCount(7);
        await expect(dialog.getByText(/sin datos de mercado/i)).toHaveCount(1);
        await expect(dialog.getByText(/sin estado/i)).toHaveCount(1);
        // 7 rows − 2 uncovered = 5 rows carrying a € value.
        const valuedRows = dialog.locator('tbody tr', { hasText: '€' });
        await expect(valuedRows).toHaveCount(5);
    });

    // --- US2 Scenario 4 / FR-019: one currency across the whole screen ---

    test('T040-3: the total, the highlights and the breakdown all render in the same currency (EUR)', async ({
        page,
    }) => {
        await seedCollection([
            ...[10, 12, 13, 14, 15, 16].map((releaseId) => ({ releaseId, mediaCondition: GRADE })),
            { releaseId: VALUATION_RELEASE_NO_MARKET_DATA, mediaCondition: GRADE },
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);
        await waitForValuationComplete(page);

        const region = valuationRegion(page);
        const highlights = page.getByRole('region', { name: /most valuable records/i });

        // Total + highlight list: EUR, and nothing else.
        await expect(valuationTotal(page)).toContainText('€');
        await expect(highlights).toContainText('€');
        await expect(region).not.toContainText('$');
        await expect(region).not.toContainText('£');
        await expect(region).not.toContainText(/USD|GBP/);

        // Breakdown dialog: same currency.
        await page.getByRole('button', { name: /ver todos/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.locator('tbody')).toContainText('€');
        await expect(dialog).not.toContainText('$');
        await expect(dialog).not.toContainText('£');
    });

    // --- plan.md deviation 1: missing seller settings → notice, Block 1 unaffected ---

    test('T040-4: an account without Discogs seller settings sees the notice in Block 2 while Block 1 renders fully', async ({
        page,
    }) => {
        await setSellerSettingsMissing(true);
        await seedCollection(
            [10, 12, 13, 14, 15].map((releaseId) => ({ releaseId, mediaCondition: GRADE })),
        );

        await signInAndLinkDiscogs(page);
        await openStats(page);

        // Block 2: the seller-settings notice (a text notice, not a heading, not
        // an error / alert).
        await expect(
            page.getByText(/estimated value needs your discogs seller settings/i),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText(/seller settings on discogs\.com/i),
        ).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);

        // Block 2 shows no valuation UI.
        await expect(page.getByRole('button', { name: /ver todos/i })).toHaveCount(0);
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        // Block 1 is fully rendered and interactive — the missing seller
        // settings never block the statistics.
        await expect(
            page.getByRole('heading', { name: 'By decade', exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('table', { name: /collection growth by month/i }),
        ).toBeAttached();
        const cumulative = page.getByRole('button', { name: /^cumulative$/i });
        await cumulative.click();
        await expect(cumulative).toHaveAttribute('aria-pressed', 'true');
    });

    // --- US2 Scenario 7 / FR-015: "Ver todos" opens the focus-trapped breakdown ---

    test('T040-5: "Ver todos" opens the per-disc breakdown dialog — focus-trapped, covered + uncovered rows, closes on Escape', async ({
        page,
    }) => {
        await seedCollection([
            ...[10, 12, 13].map((releaseId) => ({ releaseId, mediaCondition: GRADE })),
            { releaseId: VALUATION_RELEASE_NO_MARKET_DATA, mediaCondition: GRADE },
            { releaseId: 20 }, // no condition
        ]);

        await signInAndLinkDiscogs(page);
        await openStats(page);
        await waitForValuationComplete(page);

        await page.getByRole('button', { name: /ver todos/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Covered + uncovered rows are all listed.
        await expect(dialog.locator('tbody tr')).toHaveCount(5);
        await expect(dialog.getByText('€', { exact: false }).first()).toBeVisible();
        await expect(dialog.getByText(/sin datos de mercado/i)).toBeVisible();
        await expect(dialog.getByText(/sin estado/i)).toBeVisible();

        // Focus is trapped inside the dialog.
        for (let i = 0; i < 6; i += 1) {
            await page.keyboard.press('Tab');
            expect(
                await page.evaluate(
                    () => !!document.activeElement?.closest('[role="dialog"]'),
                ),
            ).toBe(true);
        }

        // Escape dismisses it.
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
    });
});
