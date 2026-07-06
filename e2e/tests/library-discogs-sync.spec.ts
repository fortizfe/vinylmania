/**
 * E2E spec: Library ⇄ Discogs Collection Sync (feature 016)
 *
 * These tests drive the full stack (frontend + backend + Discogs stub) to
 * verify the key user-facing sync behaviors. The backend is pointed at
 * DISCOGS_OAUTH_BASE_URL and DISCOGS_BASE_URL (both = stub) so no real Discogs
 * calls are made.
 *
 * Control API used:
 *   POST  /__stub/reset                         — clear state between tests
 *   PUT   /__stub/collections/:username          — seed stub collection
 *   GET   /__stub/collections/:username          — inspect stub collection state
 *   POST  /__stub/failure { mode }               — inject 503/401 failures
 */

import { expect, test, type Page } from '@playwright/test';

import { signInAsFakeGoogleUser } from '../helpers/fakeGoogleSignIn';

const STUB_URL = 'http://localhost:4571';
const STUB_USERNAME = 'e2e-discogs-user';

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

/** Seeds the stub collection for the linked user. */
async function seedCollection(
    releases: Array<{
        releaseId: number;
        rating?: number;
        mediaCondition?: string;
        sleeveCondition?: string;
        notes?: string;
    }>,
): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releases }),
    });
    if (!res.ok) throw new Error(`Failed to seed stub collection: ${res.status}`);
}

/** Returns the current stub collection state. */
async function getCollection(): Promise<
    Array<{ instance_id: number; basic_information: { id: number }; rating: number }>
> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`);
    const body = await res.json() as { releases: Array<{ instance_id: number; basic_information: { id: number }; rating: number }> };
    return body.releases;
}

/** Injects a failure mode into the stub. */
async function setFailureMode(mode: 'none' | 'unavailable' | 'auth'): Promise<void> {
    await fetch(`${STUB_URL}/__stub/failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
    });
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Library ⇄ Discogs Collection Sync (feature 016)', () => {
    // --- US1: Gate for unlinked users ---

    test('T024-a: shows a "link required" gate for an unlinked user (FR-003)', async ({ page }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        await page.goto('/app/library');

        await expect(page.getByText(/link your discogs account/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /go to your profile/i })).toBeVisible();
        // No records, no add/refresh actions visible.
        await expect(page.getByRole('button', { name: /refresh/i })).not.toBeVisible();
    });

    // --- US1: First sync – Discogs-only records are mirrored ---

    test('T024-b: first sync mirrors Discogs-only instances into the library', async ({ page }) => {
        await seedCollection([
            { releaseId: 1001, rating: 4, mediaCondition: 'Very Good Plus (VG+)' },
            { releaseId: 1002 },
        ]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/library');

        // Both releases appear (they come from stub's basic_information.title).
        await expect(page.getByText(/Stub Release 1001/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/Stub Release 1002/)).toBeVisible();
    });

    // --- US1: Discogs-side deletion disappears after Refresh ---

    test('T024-c: entry deleted on Discogs disappears after Refresh and is not re-added', async ({
        page,
    }) => {
        await seedCollection([{ releaseId: 2001 }, { releaseId: 2002 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/library');
        await expect(page.getByText(/Stub Release 2001/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/Stub Release 2002/)).toBeVisible();

        // Delete 2001 from the stub side (simulates deleting on discogs.com).
        await seedCollection([{ releaseId: 2002 }]);

        // Refresh forces a re-sync.
        await page.getByRole('button', { name: /refresh/i }).click();

        await expect(page.getByText(/Stub Release 2001/)).not.toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/Stub Release 2002/)).toBeVisible();

        // Verify it wasn't re-added to Discogs.
        const collection = await getCollection();
        expect(collection.some((r) => r.basic_information.id === 2001)).toBe(false);
    });

    // --- Feature 017: rating badge on library cards (US2) ---

    test('feature-017: library card shows the rating badge for a release with a community rating', async ({
        page,
    }) => {
        // Release IDs ending in 1 get a stubbed "high"-band community rating
        // (see stubCommunity() in discogsOauthStub.ts); others stay unrated.
        await seedCollection([{ releaseId: 4002 }, { releaseId: 4011 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/library');

        await expect(page.getByText(/Stub Release 4002/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/Stub Release 4011/)).toBeVisible();

        const ratedCard = page.locator('li', { hasText: 'Stub Release 4011' });
        await expect(ratedCard.getByRole('status')).toBeVisible();
        await expect(ratedCard.getByText('4.5')).toBeVisible();

        const unratedCard = page.locator('li', { hasText: 'Stub Release 4002' });
        await expect(unratedCard.getByRole('status')).not.toBeVisible();
    });

    // --- US3: Add propagation ---

    test('T036-a: adding a release adds it to both the library and the Discogs collection', async ({
        page,
    }) => {
        await signInAndLinkDiscogs(page);

        await page.getByLabel(/search discogs/i).fill('stub test vinyl');
        await page.getByRole('button', { name: /^search$/i }).click();
        await expect(page).toHaveURL(/\/app\/search/);

        // The stub returns one result for any query.
        await expect(page.getByText(/stub search result/i)).toBeVisible({ timeout: 10_000 });

        // Add it.
        await page.getByRole('button', { name: /add to library/i }).first().click();

        // The button should show a checkmark (added state).
        await expect(
            page.getByRole('button', { name: /added to library/i }).first(),
        ).toBeVisible({ timeout: 10_000 });

        // Verify it landed in the stub collection.
        const collection = await getCollection();
        expect(collection.length).toBeGreaterThan(0);
        // release ID 99901 is what the stub returns for catalog search
        expect(collection.some((r) => r.basic_information.id === 99901)).toBe(true);
    });

    test('T036-b: stub failure on add shows an error and does not show the record as owned', async ({
        page,
    }) => {
        await signInAndLinkDiscogs(page);
        await setFailureMode('unavailable');

        await page.getByLabel(/search discogs/i).fill('stub test vinyl');
        await page.getByRole('button', { name: /^search$/i }).click();
        await expect(page).toHaveURL(/\/app\/search/);
        await expect(page.getByText(/stub search result/i)).toBeVisible({ timeout: 10_000 });

        await page.getByRole('button', { name: /add to library/i }).first().click();

        // Error message should appear.
        await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });

        // The button should NOT show "added" state.
        await expect(page.getByRole('button', { name: /added to library/i })).not.toBeVisible();

        // Collection stays empty.
        const collection = await getCollection();
        expect(collection.length).toBe(0);
    });

    // --- US4: Remove propagation ---

    test('T040-a: removing a record deletes it from both the library and the Discogs collection', async ({
        page,
    }) => {
        // Seed one record so we have something to remove.
        await seedCollection([{ releaseId: 3001 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/library');
        await expect(page.getByText(/Stub Release 3001/)).toBeVisible({ timeout: 15_000 });

        // Open the detail page for the entry.
        await page.getByText(/Stub Release 3001/).click();

        await expect(page).toHaveURL(/\/app\/library\/records\//);
        await expect(page.getByRole('button', { name: /remove from library/i })).toBeVisible({
            timeout: 10_000,
        });

        // Confirm the removal dialog.
        page.on('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: /remove from library/i }).click();

        // Should navigate back to the library, which is now empty.
        await expect(page).toHaveURL(/\/app\/library$/, { timeout: 10_000 });
        await expect(page.getByText(/Stub Release 3001/)).not.toBeVisible();

        // Verify it was removed from the stub collection.
        const collection = await getCollection();
        expect(collection.some((r) => r.basic_information.id === 3001)).toBe(false);
    });

    test('T040-b: stub failure on remove shows an error and leaves the record visible', async ({
        page,
    }) => {
        await seedCollection([{ releaseId: 3002 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/library');
        await expect(page.getByText(/Stub Release 3002/)).toBeVisible({ timeout: 15_000 });

        await page.getByText(/Stub Release 3002/).click();
        await expect(page.getByRole('button', { name: /remove from library/i })).toBeVisible({
            timeout: 10_000,
        });

        await setFailureMode('unavailable');
        page.on('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: /remove from library/i }).click();

        // Error should be visible (not navigated away).
        await expect(page).toHaveURL(/\/app\/library\/records\//);

        // Record remains in the Discogs stub.
        const collection = await getCollection();
        expect(collection.some((r) => r.basic_information.id === 3002)).toBe(true);
    });
});
