/**
 * E2E spec: Catalog requests never silently fall back on a revoked
 * Discogs link (spec 053, US3).
 *
 * Verifies the full stack (frontend + backend + Discogs stub): a user whose
 * linked Discogs account has been revoked externally sees the same "relink
 * required" prompt when merely browsing the catalog (search, release detail)
 * as they already see today when adding a record to their library — and,
 * critically, stays signed in to vinylmania (the frontend's `authorizedFetch`
 * must not treat this 401 as a vinylmania session failure).
 *
 * Control API used:
 *   POST /__stub/reset            — clear state between tests
 *   POST /__stub/failure { mode } — 'auth' revokes OAuth-signed (linked-user)
 *                                    requests only; app-token requests keep
 *                                    succeeding (mirrors the backend's
 *                                    mis-attribution guard)
 */

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';

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

async function setFailureMode(mode: 'none' | 'unavailable' | 'auth'): Promise<void> {
    await fetch(`${STUB_URL}/__stub/failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
    });
}

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Catalog browsing with a revoked Discogs link (spec 053, US3)', () => {
    test('search results show the reconnect prompt instead of results, and the user stays signed in', async ({
        page,
    }) => {
        await signInAndLinkDiscogs(page);
        await setFailureMode('auth');

        await page.getByLabel(/search discogs/i).fill('anything');
        await page.getByRole('button', { name: /^search$/i }).click();
        await expect(page).toHaveURL(/\/app\/search/);

        await expect(page.getByText(/your discogs link is no longer valid/i)).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByRole('link', { name: /go to your profile/i })).toBeVisible();

        // Load-bearing: the caller's vinylmania session must survive this
        // 401 (apiClient's authorizedFetch must not treat discogs_link_invalid
        // as a session failure) — still on /app/search, not redirected to "/".
        await expect(page).toHaveURL(/\/app\/search/);
        await expect(page.getByRole('button', { name: /connect discogs account/i })).not.toBeVisible();
    });

    test('a release detail page shows the reconnect prompt instead of the release', async ({ page }) => {
        await signInAndLinkDiscogs(page);
        await setFailureMode('auth');

        await page.goto('/app/releases/1');

        await expect(page.getByText(/your discogs link is no longer valid/i)).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByRole('link', { name: /go to your profile/i })).toBeVisible();
        await expect(page).toHaveURL(/\/app\/releases\/1/);
    });

    test('an unlinked user keeps browsing normally even while the stub is in auth-failure mode (mis-attribution guard)', async ({
        page,
    }) => {
        // No signInAndLinkDiscogs — this user never links, so the backend
        // always identifies their catalog requests with the shared app
        // token, which the stub does not revoke in 'auth' mode (only
        // OAuth-signed requests are revoked).
        await page.goto('/');
        await signInAsFakeGoogleUser(page);
        await setFailureMode('auth');

        await page.goto('/app/releases/1');

        await expect(page.getByText('Stub Release 1')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/your discogs link is no longer valid/i)).not.toBeVisible();
    });
});
