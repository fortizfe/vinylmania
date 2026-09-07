/**
 * E2E spec: "Mi colección en cifras" — Block 2 valuation at collection scale
 * (feature 061, User Story 3 — T051).
 *
 * Same hermetic full-stack harness as `collection-stats-statistics.spec.ts`
 * (T027) and `collection-stats-valuation.spec.ts` (T040): frontend + backend +
 * Discogs stub, no real Discogs calls. Each test signs in as a fresh fake
 * Google identity so the backend's sync marker and the 7-day price cache
 * (both keyed by uid) start cold.
 *
 * Control API used (see e2e/helpers/discogsOauthStub.ts):
 *   POST /__stub/reset                           — clear all state between tests
 *   PUT  /__stub/collections/:username           — seed / replace the stub collection
 *   GET  /__stub/price-suggestions               — total + per-release marketplace hit counters
 *   POST /__stub/failure { priceSuggestions: … } — force 503 ('unavailable') / paced ('slow') price responses
 *
 * Covers US3 acceptance scenarios 1, 2, 3, 4 and SC-005 / SC-006 / SC-009.
 *
 * NOTE (SC-005 — warm cache): this relies on Redis being reachable by the
 * backend (`REDIS_URL` in backend/.env). Without Redis the cache adapter
 * fail-softs to always-miss, so a re-open re-prices every release and the
 * "zero new calls" assertion cannot hold. Redis runs locally via
 * docker-compose; if it is absent the cache-window test is skipped rather
 * than reported as a product failure.
 */

import net from 'node:net';

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';
const STUB_USERNAME = 'e2e-discogs-user';

const GRADE = 'Near Mint (NM or M-)';

// BATCH_SIZE = 25 in the backend use case; 104 releases → 5 cursor pages.
const SCALE_COLLECTION_SIZE = 104;

// ---------------------------------------------------------------------------
// Helpers (mirrors of collection-stats-statistics.spec.ts / -valuation.spec.ts)
// ---------------------------------------------------------------------------

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
}

async function seedCollection(releases: CollectionSeed[]): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releases }),
    });
    if (!res.ok) throw new Error(`Failed to seed stub collection: ${res.status}`);
}

async function setPriceFailure(
    mode: 'none' | 'unavailable' | 'slow',
): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceSuggestions: mode }),
    });
    if (!res.ok) throw new Error(`Failed to set price-suggestions failure mode: ${res.status}`);
}

async function marketplaceHitTotal(): Promise<number> {
    const res = await fetch(`${STUB_URL}/__stub/price-suggestions`);
    const body = (await res.json()) as { totalHits: number };
    return body.totalHits;
}

/**
 * True when the Redis port is open, i.e. the backend's 7-day price cache is
 * real. Matches `backend/.env`'s `REDIS_URL=redis://localhost:6379`; without it
 * the cache adapter fail-softs to always-miss and SC-005 cannot be asserted.
 */
function redisReachable(): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net
            .connect({ host: '127.0.0.1', port: 6379 })
            .setTimeout(1_000)
            .once('connect', () => {
                socket.destroy();
                resolve(true);
            })
            .once('timeout', () => {
                socket.destroy();
                resolve(false);
            })
            .once('error', () => resolve(false));
    });
}

function valuationRegion(page: Page) {
    return page.getByRole('region', { name: 'Estimated market value' });
}

function valuationTotal(page: Page) {
    return valuationRegion(page).locator('.text-4xl');
}

async function openStats(page: Page): Promise<void> {
    await page.goto('/app/stats');
    await expect(
        page.getByRole('heading', { name: 'Collection statistics' }),
    ).toBeVisible({ timeout: 20_000 });
}

async function waitForValuationComplete(page: Page, timeout = 60_000): Promise<void> {
    await expect(page.getByRole('button', { name: /ver todos/i })).toBeVisible({ timeout });
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(valuationRegion(page).getByRole('status')).toHaveText(
        /valoración completada/i,
    );
}

function scaleSeed(size: number): CollectionSeed[] {
    return Array.from({ length: size }, (_, i) => ({
        releaseId: 2_000 + i,
        mediaCondition: GRADE,
    }));
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Mi colección en cifras — valuation at collection scale (feature 061, US3)', () => {
    // --- US3 Scenarios 1 + 2 / SC-006: a large collection completes, Block 1 stays live ---

    test('T051-1: a 100+ release collection reaches a stable complete total with Block 1 interactive throughout', async ({
        page,
    }) => {
        test.setTimeout(150_000);

        await seedCollection(scaleSeed(SCALE_COLLECTION_SIZE));

        await signInAndLinkDiscogs(page);
        await openStats(page);

        // Block 1 is usable immediately and stays interactive while Block 2's
        // cursor loop runs (the growth per-period ⇄ cumulative toggle is always
        // rendered — FR-012 / US3 scenario 2).
        const cumulative = page.getByRole('button', { name: /^cumulative$/i });
        await cumulative.click();
        await expect(cumulative).toHaveAttribute('aria-pressed', 'true');

        // The long-running "come back later" affordance is optional (US3 T053,
        // not yet implemented). If it appears mid-run it must be non-blocking.
        const comeBackLater = page.getByText(/come back later|puede tardar|tardar un rato/i);
        if (await comeBackLater.count()) {
            await page.getByRole('button', { name: /per period/i }).click();
            await expect(
                page.getByRole('button', { name: /per period/i }),
            ).toHaveAttribute('aria-pressed', 'true');
        }

        await waitForValuationComplete(page, 120_000);

        // Every seeded release is covered → a stable, error-free complete total,
        // and the shared circuit breaker never tripped (no outage notice, no
        // error alert — SC-006).
        await expect(
            valuationRegion(page).getByText(
                new RegExp(`estimado sobre ${SCALE_COLLECTION_SIZE} de ${SCALE_COLLECTION_SIZE} discos`, 'i'),
            ),
        ).toBeVisible();
        await expect(valuationTotal(page)).toContainText('€');
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText(/couldn't estimate your collection's value/i)).toHaveCount(0);

        const settled = await valuationTotal(page).innerText();
        await page.waitForTimeout(1_000);
        expect(await valuationTotal(page).innerText()).toBe(settled);

        // Block 1 is still interactive after the valuation settled.
        await page.getByRole('button', { name: /per period/i }).click();
        await expect(
            page.getByRole('button', { name: /per period/i }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    // --- US3 Scenario 3 / SC-005: re-open within the cache window ⇒ zero new price calls ---

    test('T051-2: re-opening the section after a completed valuation issues no new price_suggestions calls', async ({
        page,
    }) => {
        test.setTimeout(120_000);

        test.skip(
            !(await redisReachable()),
            'SC-005 needs the backend 7-day price cache (Redis); it is not reachable',
        );

        await seedCollection(scaleSeed(SCALE_COLLECTION_SIZE));

        await signInAndLinkDiscogs(page);
        await openStats(page);
        await waitForValuationComplete(page, 90_000);

        const hitsAfterFirstRun = await marketplaceHitTotal();
        expect(hitsAfterFirstRun).toBeGreaterThanOrEqual(SCALE_COLLECTION_SIZE);

        // Navigate away and back — the loop re-runs from cursor 0 on mount.
        await page.goto('/app/library');
        await expect(page).toHaveURL(/\/app\/library$/);
        await openStats(page);
        await waitForValuationComplete(page, 90_000);

        await expect(
            valuationRegion(page).getByText(
                new RegExp(`estimado sobre ${SCALE_COLLECTION_SIZE} de ${SCALE_COLLECTION_SIZE} discos`, 'i'),
            ),
        ).toBeVisible();

        // SC-005: the warm 7-day cache serves every release — no new upstream hits.
        expect(await marketplaceHitTotal()).toBe(hitsAfterFirstRun);
    });

    // --- US3 Scenario 4 / SC-009: an outage mid-run is graceful, and retry recovers ---

    test('T051-3: a Discogs price outage never surfaces an error; the retry affordance completes once Discogs is back', async ({
        page,
    }) => {
        test.setTimeout(150_000);

        await setPriceFailure('unavailable');
        await seedCollection(scaleSeed(40));

        await signInAndLinkDiscogs(page);
        await openStats(page);

        // Block 1 renders regardless of the marketplace outage (SC-009).
        await expect(
            page.getByRole('heading', { name: 'By decade', exact: true }),
        ).toBeVisible();

        // Block 2: a non-blocking outage notice with a retry, never an error page
        // and never a 5xx surfaced to the user.
        await expect(
            page.getByText(/couldn't estimate your collection's value right now/i),
        ).toBeVisible({ timeout: 40_000 });
        const retry = page.getByRole('button', { name: /try the valuation again/i });
        await expect(retry).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);
        // Block 1 is still fully interactive under the outage.
        const cumulative = page.getByRole('button', { name: /^cumulative$/i });
        await cumulative.click();
        await expect(cumulative).toHaveAttribute('aria-pressed', 'true');

        // Recover Discogs. The valuation shares the process-wide Discogs circuit
        // breaker (discogsCircuitBreaker.ts, OPEN_COOLDOWN_MS = 20s), which the
        // outage tripped open — wait out the cooldown so the first retry request
        // is let through as the half-open trial, then re-drive from the retry
        // control (US3 scenario 4; a per-failed-disc `retry=failed` path is not
        // yet implemented — T052/T053).
        await setPriceFailure('none');
        await page.waitForTimeout(22_000);
        await retry.click();

        await waitForValuationComplete(page, 90_000);
        await expect(
            valuationRegion(page).getByText(/estimado sobre 40 de 40 discos/i),
        ).toBeVisible();
        await expect(valuationTotal(page)).toContainText('€');
    });
});
