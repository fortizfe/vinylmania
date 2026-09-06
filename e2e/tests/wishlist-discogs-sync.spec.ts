/**
 * E2E spec: Wishlist ⇄ Discogs Wantlist Sync (feature 060, User Story 1)
 *
 * Mirrors `library-discogs-sync.spec.ts`: drives the full stack (frontend +
 * backend + Discogs stub) so the wantlist browse behaviour is exercised
 * against the real backend, hermetically. The backend is pointed at the
 * stub via DISCOGS_OAUTH_BASE_URL / DISCOGS_BASE_URL (see playwright.config.ts),
 * so no real Discogs calls are made.
 *
 * Each test signs in as a fresh fake Google identity, which sidesteps the
 * backend's ~5-minute sync cache (a brand-new user has an empty cache), the
 * same approach the library spec relies on.
 *
 * Control API used (see e2e/helpers/discogsOauthStub.ts):
 *   POST /__stub/reset                     — clear all state between tests
 *   POST /__stub/wants/:username { wants }  — seed / replace the stub wantlist
 *   GET  /__stub/wants/:username            — inspect stub wantlist state
 *   POST /__stub/failure { mode }           — inject 401/503 failures (all endpoints)
 *   POST /__stub/failure { wantlistWrite }  — 503 on PUT/DELETE /wants/:id only
 *
 * Covers US1 acceptance scenarios 1–5 and SC-008 (FR-001..FR-004).
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

interface WantSeed {
    releaseId: number;
    rating?: number;
    notes?: string;
}

/** Seeds (replaces) the stub wantlist for the linked user. */
async function seedWantlist(wants: WantSeed[]): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/wants/${STUB_USERNAME}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wants }),
    });
    if (!res.ok) throw new Error(`Failed to seed stub wantlist: ${res.status}`);
}

/** Returns the current stub wantlist state. */
async function getWantlist(): Promise<Array<{ id: number }>> {
    const res = await fetch(`${STUB_URL}/__stub/wants/${STUB_USERNAME}`);
    const body = (await res.json()) as { wants: Array<{ id: number }> };
    return body.wants;
}

/** Seeds (replaces) the stub Discogs collection for the linked user (US2 case 5). */
async function seedCollection(releases: Array<{ releaseId: number }>): Promise<void> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releases }),
    });
    if (!res.ok) throw new Error(`Failed to seed stub collection: ${res.status}`);
}

/** Returns the current stub collection state. */
async function getCollection(): Promise<Array<{ basic_information: { id: number } }>> {
    const res = await fetch(`${STUB_URL}/__stub/collections/${STUB_USERNAME}`);
    const body = (await res.json()) as {
        releases: Array<{ basic_information: { id: number } }>;
    };
    return body.releases;
}

/**
 * Runs a catalog search from the header search box and waits for the stub's
 * single result card. The Discogs catalog stub returns release id 99901 for
 * every query (see `database/search` in discogsOauthStub.ts).
 */
const STUB_SEARCH_RELEASE_ID = 99901;
async function searchForStubResult(page: Page): Promise<void> {
    await page.getByLabel(/search discogs/i).fill('stub wishlist vinyl');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/app\/search/);
    await expect(page.getByText(/stub search result/i)).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
    await fetch(`${STUB_URL}/__stub/reset`, { method: 'POST' });
});

test.describe('Wishlist ⇄ Discogs Wantlist Sync (feature 060, US1)', () => {
    // --- US1 Scenario 1: seeded wantlist renders as cards ---

    test('T017-1: a linked user sees their Discogs wantlist entries as cards with the rating badge', async ({
        page,
    }) => {
        // Release IDs ending in 1 get a stubbed "high"-band community rating
        // (stubCommunity() in discogsOauthStub.ts); others stay unrated.
        await seedWantlist([
            { releaseId: 111, rating: 3, notes: 'Original UK pressing' },
            { releaseId: 222 },
        ]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');

        const grid = page.getByTestId('wishlist-grid');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        const firstCard = page.locator('li', { hasText: 'Stub Release 111' });
        await expect(firstCard).toBeVisible();
        await expect(firstCard.getByText('Stub Artist')).toBeVisible();
        // FR-003: the badge shows the release's Discogs community rating.
        await expect(firstCard.getByRole('status')).toBeVisible();
        await expect(firstCard.getByText('4.5')).toBeVisible();

        const secondCard = page.locator('li', { hasText: 'Stub Release 222' });
        await expect(secondCard).toBeVisible();
        await expect(secondCard.getByText('Stub Artist')).toBeVisible();
        // feature-019 parity: an unrated release still shows the placeholder badge.
        await expect(
            secondCard.getByRole('status', { name: /rating not available/i }),
        ).toBeVisible();
    });

    // --- US1 Scenario 2: unlinked user sees the gate only ---

    test('T017-2: an unlinked user sees the "link your account" gate — no cards, no refresh, no pagination', async ({
        page,
    }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        await page.goto('/app/wishlist');

        await expect(page.getByText(/link your discogs account/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /go to your profile/i })).toBeVisible();

        // No wantlist content or actions.
        await expect(page.getByTestId('wishlist-grid')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /refresh/i })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(previous|next)$/i })).toHaveCount(0);
    });

    // --- US1 Scenario 3: empty wantlist shows an empty state, not an error ---

    test('T017-3: a linked user with an empty Discogs wantlist sees the empty state', async ({
        page,
    }) => {
        await seedWantlist([]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');

        await expect(page.getByText(/nothing on your wishlist yet\./i)).toBeVisible({
            timeout: 15_000,
        });
        // Empty state, not an error state.
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
        await expect(page.getByTestId('wishlist-grid')).toHaveCount(0);
    });

    // --- US1 Scenario 5: nav entry present at the same level as "My library" ---

    test('T017-4: "My wishlist" sits alongside "My library" in the desktop header and the mobile menu', async ({
        page,
    }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        // Desktop header: both icon links visible together.
        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.getByRole('link', { name: /my library/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /my wishlist/i })).toBeVisible();

        // Mobile menu: both links present in the same menu dialog.
        await page.setViewportSize({ width: 375, height: 812 });
        await page.getByRole('button', { name: /^menu$/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('link', { name: /my library/i })).toBeVisible();
        await expect(dialog.getByRole('link', { name: /my wishlist/i })).toBeVisible();

        // The wishlist link actually routes to the wishlist.
        await dialog.getByRole('link', { name: /my wishlist/i }).click();
        await expect(page).toHaveURL(/\/app\/wishlist$/);
    });

    // --- US1 Scenario 4: manual refresh forces a re-sync past the cache window ---

    test('T017-5: Refresh re-synchronizes with a change made directly on Discogs', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 511 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');
        await expect(page.getByText('Stub Release 511')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Stub Release 522')).toHaveCount(0);

        // Simulate the user adding an entry on discogs.com (the seed endpoint
        // replaces the whole list).
        await seedWantlist([{ releaseId: 511 }, { releaseId: 522 }]);

        // A plain reload would be served from the ~5-min cache; Refresh forces
        // a fresh synchronization.
        await page.getByRole('button', { name: /refresh/i }).click();

        await expect(page.getByText('Stub Release 522')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Stub Release 511')).toBeVisible();
    });

    // --- SC-008: opening the wishlist twice in quick succession is stable ---

    test('T017-6: opening the wishlist twice in quick succession does not error and shows a stable list', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 631 }, { releaseId: 642 }]);

        await signInAndLinkDiscogs(page);

        await page.goto('/app/wishlist');
        await expect(page.getByText('Stub Release 631')).toBeVisible({ timeout: 15_000 });

        await page.goto('/app/wishlist');
        await expect(page.getByText('Stub Release 631')).toBeVisible();
        await expect(page.getByText('Stub Release 642')).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);

        // The stub wantlist is unchanged — the second open did not mutate state.
        const wants = await getWantlist();
        expect(wants.map((w) => w.id).sort()).toEqual([631, 642]);
    });
});

test.describe('US2 - add to wantlist (feature 060, FR-005/006/007/007a)', () => {
    // --- US2 Scenario 1: add from a search result card ---

    test('T0XX-1: adding from a search result card writes to the Discogs wantlist and it shows in "My wishlist"', async ({
        page,
    }) => {
        await signInAndLinkDiscogs(page);

        await searchForStubResult(page);
        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to wishlist' }).click();

        // FR-007: the action flips to the "already in wishlist" state.
        await expect(card.getByRole('button', { name: 'In your wishlist' })).toBeVisible({
            timeout: 10_000,
        });

        await page.goto('/app/wishlist');
        const grid = page.getByTestId('wishlist-grid');
        await expect(grid).toBeVisible({ timeout: 15_000 });
        await expect(
            page.locator('li', { hasText: `Stub Release ${STUB_SEARCH_RELEASE_ID}` }),
        ).toBeVisible();

        // FR-006: written straight to the Discogs wantlist (the stub), not Firestore.
        const wants = await getWantlist();
        expect(wants.map((w) => w.id)).toContain(STUB_SEARCH_RELEASE_ID);
    });

    // --- US2 Scenario 2: add from a release detail page ---

    test('T0XX-2: adding from a release detail page writes to the Discogs wantlist and it shows in "My wishlist"', async ({
        page,
    }) => {
        const releaseId = 222;

        await signInAndLinkDiscogs(page);
        await page.goto(`/app/releases/${releaseId}`);
        await expect(
            page.getByRole('heading', { name: `Stub Release ${releaseId}` }),
        ).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: /^add to wishlist$/i }).click();
        await expect(page.getByRole('button', { name: /^added to wishlist$/i })).toBeVisible({
            timeout: 10_000,
        });

        await page.goto('/app/wishlist');
        await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });
        await expect(
            page.locator('li', { hasText: `Stub Release ${releaseId}` }),
        ).toBeVisible();

        const wants = await getWantlist();
        expect(wants.map((w) => w.id)).toContain(releaseId);
    });

    // --- US2 Scenario 3: both add actions present and distinguishable (FR-005) ---

    test('T0XX-3: a search card offers "Add to library" and "Add to wishlist" as distinct, independently-named actions', async ({
        page,
    }) => {
        await signInAndLinkDiscogs(page);
        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        const addToLibrary = card.getByRole('button', { name: 'Add to library' });
        const addToWishlist = card.getByRole('button', { name: 'Add to wishlist' });

        await expect(addToLibrary).toBeVisible();
        await expect(addToWishlist).toBeVisible();

        // Distinguishable by accessible name, not colour alone (Constitution X).
        await expect(addToLibrary).toHaveAttribute('aria-label', 'Add to library');
        await expect(addToWishlist).toHaveAttribute('aria-label', 'Add to wishlist');

        // Independent: adding to the wishlist does not flip the library action.
        await addToWishlist.click();
        await expect(card.getByRole('button', { name: 'In your wishlist' })).toBeVisible({
            timeout: 10_000,
        });
        await expect(card.getByRole('button', { name: 'Add to library' })).toBeVisible();
    });

    // --- US2 Scenario 6 / FR-007: adding a release already in the wantlist makes no duplicate ---

    test('T0XX-4: adding a release already in the wantlist keeps a single entry (no duplicate)', async ({
        page,
    }) => {
        // The catalog search stub always returns release 99901; seed that.
        await seedWantlist([{ releaseId: STUB_SEARCH_RELEASE_ID }]);

        await signInAndLinkDiscogs(page);
        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to wishlist' }).click();

        await expect(card.getByRole('button', { name: 'In your wishlist' })).toBeVisible({
            timeout: 10_000,
        });

        // FR-007: still exactly one entry for that release, no duplicate write.
        const wants = await getWantlist();
        expect(wants.filter((w) => w.id === STUB_SEARCH_RELEASE_ID)).toHaveLength(1);
    });

    // --- US2 / FR-007a: adding a release the user already owns ---

    test('T0XX-5: adding a release already in the library still adds it to the wantlist, flags "already in your library", and leaves the library unchanged', async ({
        page,
    }) => {
        await seedCollection([{ releaseId: STUB_SEARCH_RELEASE_ID }]);

        await signInAndLinkDiscogs(page);
        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to wishlist' }).click();

        await expect(card.getByRole('button', { name: 'In your wishlist' })).toBeVisible({
            timeout: 10_000,
        });
        // FR-007a: the add succeeds but is visibly flagged as already owned.
        await expect(card.getByText(/already in your library/i)).toBeVisible();

        // The release was added to the wantlist...
        const wants = await getWantlist();
        expect(wants.map((w) => w.id)).toContain(STUB_SEARCH_RELEASE_ID);

        // ...and the library/collection was NOT modified (FR-007a: no removal, no add).
        const collection = await getCollection();
        expect(collection).toHaveLength(1);
        expect(collection[0].basic_information.id).toBe(STUB_SEARCH_RELEASE_ID);
    });

    // --- US2 Scenario 4: unlinked user is gated, nothing is added ---

    test('T0XX-6: an unlinked user choosing "Add to wishlist" sees the link-required message and nothing is added', async ({
        page,
    }) => {
        await page.goto('/');
        await signInAsFakeGoogleUser(page);

        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to wishlist' }).click();

        await expect(page.getByText(/link your discogs account/i)).toBeVisible({
            timeout: 10_000,
        });
        // The action is not shown as succeeded.
        await expect(
            page.getByRole('button', { name: 'In your wishlist' }),
        ).toHaveCount(0);

        // Nothing reached the Discogs wantlist.
        const wants = await getWantlist();
        expect(wants).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// US3 — edit a wantlist entry's notes + personal rating from the release
// detail page (feature 060, FR-008/FR-009/FR-010; US3 acceptance scenarios
// 1–5; quickstart steps 5–6).
//
// The release-detail wantlist panel (`<Card data-testid=
// "release-detail-wantlist-panel-card">` → `WantlistPanel`) renders ONLY when
// `GET /api/wantlist/:releaseId` returns an entry (FR-008). It carries a
// heading "Your wishlist notes", a "Personal rating" `StarRating`, and a
// "Notes" `InlineEditableField` (click to edit → textarea → blur/Enter to
// confirm), each autosaving per field with NO Save button (FR-009). Backend
// `PATCH /api/wantlist/:releaseId` takes `{rating}` or `{notes}`, one per call.
//
// Autosave persistence is asserted the durable way — reload the page, then
// read the stub wantlist — never by racing the PATCH request.
// ---------------------------------------------------------------------------

interface StubWantState {
    id: number;
    rating: number;
    notes: string;
}

/** Full stub wantlist state, including each entry's rating and notes. */
async function getStubWants(): Promise<StubWantState[]> {
    const res = await fetch(`${STUB_URL}/__stub/wants/${STUB_USERNAME}`);
    const body = (await res.json()) as { wants: StubWantState[] };
    return body.wants;
}

/** Opens a release detail page and waits for its heading to render. */
async function openReleaseDetail(page: Page, releaseId: number): Promise<void> {
    await page.goto(`/app/releases/${releaseId}`);
    await expect(
        page.getByRole('heading', { name: `Stub Release ${releaseId}` }),
    ).toBeVisible({ timeout: 15_000 });
}

test.describe('US3 - edit wantlist entry (feature 060, FR-008/FR-009/FR-010)', () => {
    // --- US3 Scenario 2 / SC-003: personal rating autosaves + survives a reload ---

    test('T0YY-1: setting the personal rating autosaves to the Discogs wantlist and persists across a reload', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 222, rating: 0, notes: '' }]);

        await signInAndLinkDiscogs(page);
        await openReleaseDetail(page, 222);

        // FR-008: the panel is shown because release 222 IS in the wantlist.
        const panel = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panel).toBeVisible({ timeout: 15_000 });
        await expect(
            panel.getByRole('heading', { name: /your wishlist notes/i }),
        ).toBeVisible();

        // FR-009/FR-010: tapping a star autosaves — no Save button involved.
        await panel.getByRole('button', { name: '4 stars' }).click();

        // Durable persistence check: reload, then read the stub directly.
        await openReleaseDetail(page, 222);
        const panelAfterReload = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panelAfterReload).toBeVisible({ timeout: 15_000 });
        await expect(
            panelAfterReload.getByRole('button', { name: '4 stars' }),
        ).toHaveAttribute('aria-pressed', 'true');

        const wants = await getStubWants();
        expect(wants.find((w) => w.id === 222)?.rating).toBe(4);
    });

    // --- US3 Scenario 2 / SC-003: notes autosave on blur + survive a reload ---

    test('T0YY-2: editing the notes field autosaves to the Discogs wantlist and persists across a reload', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 222, rating: 0, notes: '' }]);

        await signInAndLinkDiscogs(page);
        await openReleaseDetail(page, 222);

        const panel = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panel).toBeVisible({ timeout: 15_000 });

        // InlineEditableField: click the read-mode trigger → textarea → type → blur.
        await panel.getByRole('button', { name: /edit notes/i }).click();
        const editor = panel.getByRole('textbox', { name: 'Notes' });
        await editor.fill('Original UK pressing');
        await editor.blur();

        // Durable persistence check: reload, then read the stub directly.
        await openReleaseDetail(page, 222);
        const panelAfterReload = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panelAfterReload).toBeVisible({ timeout: 15_000 });
        await expect(
            panelAfterReload.getByRole('button', { name: /edit notes/i }),
        ).toContainText('Original UK pressing');

        const wants = await getStubWants();
        expect(wants.find((w) => w.id === 222)?.notes).toBe('Original UK pressing');
    });

    // --- US3 Scenario 2 / FR-009: no Save button anywhere in the panel ---

    test('T0YY-3: the wantlist panel has no Save button (per-field autosave)', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 222, rating: 0, notes: '' }]);

        await signInAndLinkDiscogs(page);
        await openReleaseDetail(page, 222);

        const panel = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panel).toBeVisible({ timeout: 15_000 });

        await expect(panel.getByRole('button', { name: /save/i })).toHaveCount(0);
        // Also true while the notes field is open for editing.
        await panel.getByRole('button', { name: /edit notes/i }).click();
        await expect(panel.getByRole('textbox', { name: 'Notes' })).toBeVisible();
        await expect(panel.getByRole('button', { name: /save/i })).toHaveCount(0);
    });

    // --- US3 Scenario 5 / FR-008: no panel for a release NOT in the wantlist ---

    test('T0YY-4: a release that is not in the wantlist shows no panel — only "Add to wishlist"', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 222, rating: 0, notes: '' }]);

        await signInAndLinkDiscogs(page);
        // Release 999 was never seeded into the wantlist.
        await openReleaseDetail(page, 999);

        await expect(
            page.getByTestId('release-detail-wantlist-panel-card'),
        ).toHaveCount(0);
        await expect(page.getByText(/your wishlist notes/i)).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: /^add to wishlist$/i }),
        ).toBeVisible();
    });

    // --- US3 Scenario 1 / FR-008: the panel appears after an add, without a reload ---

    test('T0YY-5: adding a release to the wantlist from its detail page reveals the panel without a manual reload', async ({
        page,
    }) => {
        // 999 starts outside both the wantlist and the library.
        await signInAndLinkDiscogs(page);
        await openReleaseDetail(page, 999);

        await expect(
            page.getByTestId('release-detail-wantlist-panel-card'),
        ).toHaveCount(0);

        await page.getByRole('button', { name: /^add to wishlist$/i }).click();
        await expect(
            page.getByRole('button', { name: /^added to wishlist$/i }),
        ).toBeVisible({ timeout: 10_000 });

        // FR-008 / US3-1: the panel appears on the same page load.
        const panel = page.getByTestId('release-detail-wantlist-panel-card');
        await expect(panel).toBeVisible({ timeout: 15_000 });
        await expect(
            panel.getByRole('heading', { name: /your wishlist notes/i }),
        ).toBeVisible();

        const wants = await getStubWants();
        expect(wants.map((w) => w.id)).toContain(999);
    });
});

// ---------------------------------------------------------------------------
// US4 — remove a release from the wishlist (feature 060, FR-004/FR-011;
// US4 acceptance scenarios; SC-006 "removal is ≤2 interactions").
//
// `WantlistCard` renders an icon button `aria-label="Remove from wishlist"` in
// a footer row. Clicking it opens `RemoveFromWantlistDialog` (`role="dialog"`,
// title "Remove from wishlist?", "Remove" + "Cancel" buttons). Confirming
// fires `DELETE /api/wantlist/:releaseId` → the stub drops the want and the
// card unmounts on the `wantlistKeys.all` invalidation. Cancel / Escape /
// scrim just close the dialog and change nothing.
// ---------------------------------------------------------------------------

test.describe('US4 - remove from wantlist (feature 060, FR-004/FR-011)', () => {
    // --- US4: confirm removes the card + the Discogs want, leaving the rest ---

    test('T052-1: removing a want deletes just that card and that Discogs want', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 851 }, { releaseId: 862 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');
        await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

        const target = page.locator('li', { hasText: 'Stub Release 851' });
        const survivor = page.locator('li', { hasText: 'Stub Release 862' });
        await expect(target).toBeVisible();
        await expect(survivor).toBeVisible();

        // Interaction 1: open the confirm dialog.
        await target.getByRole('button', { name: 'Remove from wishlist' }).click();
        const dialog = page.getByRole('dialog', { name: 'Remove from wishlist?' });
        await expect(dialog).toBeVisible();

        // Interaction 2: confirm. (SC-006: open + confirm = 2 interactions.)
        await dialog.getByRole('button', { name: 'Remove' }).click();

        // The removed card unmounts; the other stays.
        await expect(target).toHaveCount(0);
        await expect(survivor).toBeVisible();

        // FR-011: the removal propagated to the Discogs wantlist (the stub).
        const wants = await getWantlist();
        expect(wants.map((w) => w.id)).toEqual([862]);
    });

    // --- US4: Cancel and Escape both dismiss without touching anything ---

    test('T052-2: Cancel and Escape close the dialog and leave the card + Discogs want intact', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 851 }, { releaseId: 862 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');
        await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

        const target = page.locator('li', { hasText: 'Stub Release 851' });
        const removeButton = target.getByRole('button', { name: 'Remove from wishlist' });

        // Cancel button.
        await removeButton.click();
        const dialog = page.getByRole('dialog', { name: 'Remove from wishlist?' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(target).toBeVisible();

        // Escape key.
        await removeButton.click();
        await expect(page.getByRole('dialog', { name: 'Remove from wishlist?' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Remove from wishlist?' })).toHaveCount(0);
        await expect(target).toBeVisible();

        // Nothing was written to the Discogs wantlist.
        const wants = await getWantlist();
        expect(wants.map((w) => w.id).sort()).toEqual([851, 862]);
    });

    // --- US4 / FR-004: removing the last want shows the empty state, not a blank grid ---

    test('T052-3: removing the last want lands on the empty state, not a blank grid', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: 851 }]);

        await signInAndLinkDiscogs(page);
        await page.goto('/app/wishlist');
        await expect(page.getByTestId('wishlist-grid')).toBeVisible({ timeout: 15_000 });

        const target = page.locator('li', { hasText: 'Stub Release 851' });
        await target.getByRole('button', { name: 'Remove from wishlist' }).click();
        await page
            .getByRole('dialog', { name: 'Remove from wishlist?' })
            .getByRole('button', { name: 'Remove' })
            .click();

        // FR-004: the empty state copy, and the grid is gone (not just empty).
        await expect(page.getByText(/nothing on your wishlist yet\./i)).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByTestId('wishlist-grid')).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);

        const wants = await getWantlist();
        expect(wants).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// US5 — buying a wanted record removes it from the wishlist (feature 060,
// FR-012/FR-013; US5 acceptance scenarios).
//
// `POST /api/library` now returns `wantlistRemoval` ('removed' |
// 'not_in_wantlist' | 'failed'). On a successful add of a release that is in
// the wantlist the backend does a best-effort `DELETE /wants/:releaseId`
// AFTER the collection write + Firestore entry are confirmed — a failure
// there is surfaced as a non-blocking notice, never rolled back (FR-013).
//
// The catalog search stub always returns release id 99901
// (`STUB_SEARCH_RELEASE_ID`), so that id is release "R" for these cases.
// ---------------------------------------------------------------------------

test.describe('US5 - buy removes from wishlist (feature 060, FR-012/FR-013)', () => {
    const WISHLIST_REMOVAL_FAILED_NOTICE = /couldn.t remove it from your wishlist/i;

    // --- US5 Scenario 1: adding a wanted release to the library clears the want ---

    test('T061-1: adding a wanted release to the library removes it from the wishlist', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: STUB_SEARCH_RELEASE_ID }]);

        await signInAndLinkDiscogs(page);
        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to library' }).click();
        // A linked user's library add chains several OAuth-signed Discogs calls
        // (catalog lookup, collection write, field map, wantlist DELETE), each
        // subject to the backend's shared preventive throttle — a generous
        // ceiling here, never a fixed wait.
        await expect(card.getByRole('button', { name: 'Added to library' })).toBeVisible({
            timeout: 20_000,
        });
        // FR-012: the removal is silent on success — no "couldn't remove" notice.
        await expect(page.getByText(WISHLIST_REMOVAL_FAILED_NOTICE)).toHaveCount(0);

        // R is in the collection...
        const collection = await getCollection();
        expect(collection.map((r) => r.basic_information.id)).toContain(STUB_SEARCH_RELEASE_ID);
        // ...and gone from the Discogs wantlist.
        const wants = await getWantlist();
        expect(wants.map((w) => w.id)).not.toContain(STUB_SEARCH_RELEASE_ID);

        // The UI agrees: R shows in the library, and the wishlist is now empty.
        await page.goto('/app/library');
        await expect(
            page.getByText(`Stub Release ${STUB_SEARCH_RELEASE_ID}`),
        ).toBeVisible({ timeout: 15_000 });

        await page.goto('/app/wishlist');
        await expect(page.getByText(/nothing on your wishlist yet\./i)).toBeVisible({
            timeout: 15_000,
        });
    });

    // --- US5 / FR-013: the wantlist DELETE fails but the library add still stands ---
    //
    // Uses the NARROW `POST /__stub/failure { wantlistWrite: 'unavailable' }`
    // toggle (discogsOauthStub.ts), which fails ONLY PUT/DELETE
    // `/users/:username/wants/:id` with a 503 while the wantlist LIST, every
    // `/collection` endpoint and the catalog stay healthy. That lets the
    // backend's add path complete the collection write + Firestore entry and
    // THEN hit a failing best-effort `deleteWant`, exercising FR-013: the add
    // stands, the removal is flagged (`wantlistRemoval: 'failed'`), R stays
    // wanted.
    test('T061-2: library add succeeds but the wantlist removal fails → non-blocking "couldn\'t remove" notice, R still wanted', async ({
        page,
    }) => {
        await seedWantlist([{ releaseId: STUB_SEARCH_RELEASE_ID }]);
        await fetch(`${STUB_URL}/__stub/failure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wantlistWrite: 'unavailable' }),
        });

        try {
            await signInAndLinkDiscogs(page);
            await searchForStubResult(page);

            const card = page.getByTestId('search-results-grid').locator('li').first();
            await card.getByRole('button', { name: 'Add to library' }).click();

            // FR-013: the library add still SUCCEEDS despite the failing removal.
            await expect(card.getByRole('button', { name: 'Added to library' })).toBeVisible({
                timeout: 20_000,
            });

            // The non-blocking notice is shown (role="status", not an alert).
            const notice = card.getByRole('status').filter({ hasText: WISHLIST_REMOVAL_FAILED_NOTICE });
            await expect(notice).toBeVisible();
            await expect(page.getByRole('alert')).toHaveCount(0);

            // R did land in the collection...
            const collection = await getCollection();
            expect(collection.map((r) => r.basic_information.id)).toContain(
                STUB_SEARCH_RELEASE_ID,
            );

            // ...and the removal genuinely failed — R is STILL in the Discogs wantlist.
            const wants = await getWantlist();
            expect(wants.map((w) => w.id)).toContain(STUB_SEARCH_RELEASE_ID);
        } finally {
            await fetch(`${STUB_URL}/__stub/failure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wantlistWrite: 'none' }),
            });
        }
    });

    // --- US5 Scenario (control): adding a NON-wanted release does nothing extra ---

    test('T061-3: adding a release that is not on the wishlist shows no notice and no wantlist change', async ({
        page,
    }) => {
        // Wantlist starts empty; the search stub release (99901) is not a want.
        await signInAndLinkDiscogs(page);
        await searchForStubResult(page);

        const card = page.getByTestId('search-results-grid').locator('li').first();
        await card.getByRole('button', { name: 'Add to library' }).click();
        // Generous ceiling for the throttled multi-call add path (see T061-1).
        await expect(card.getByRole('button', { name: 'Added to library' })).toBeVisible({
            timeout: 20_000,
        });

        // No "couldn't remove from your wishlist" notice, no error.
        await expect(page.getByText(WISHLIST_REMOVAL_FAILED_NOTICE)).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);

        // R landed in the collection; the wantlist is still empty (unchanged).
        const collection = await getCollection();
        expect(collection.map((r) => r.basic_information.id)).toContain(STUB_SEARCH_RELEASE_ID);
        const wants = await getWantlist();
        expect(wants).toHaveLength(0);
    });
});
