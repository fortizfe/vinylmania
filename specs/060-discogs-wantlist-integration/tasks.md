---
description: "Task list for Discogs-Integrated Wantlist (Lista de Deseos)"
---

# Tasks: Discogs-Integrated Wantlist (Lista de Deseos)

**Input**: Design documents from `/specs/060-discogs-wantlist-integration/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE). Every implementation task is preceded by a failing test task.

**Organization**: Grouped by user story. US1 + US2 together are the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task in the same phase → parallelizable
- **[Story]**: US1–US5 (Setup / Foundational / Polish carry no story label)

## Path Conventions (from plan.md — web app)

- Backend: `backend/src/{domain,application,ports,adapters}/<slice>/`, tests `backend/tests/{unit,contract,integration}/<slice>/`
- Frontend: `frontend/src/{pages,components,services,queries}/`, tests `frontend/tests/unit/`
- E2E: `e2e/tests/`, helpers `e2e/helpers/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Slice scaffolding. No behavior.

- [X] T001 Create backend slice directories `backend/src/domain/wantlist/`, `backend/src/application/wantlist/`, `backend/src/adapters/wantlist/` and test directories `backend/tests/unit/wantlist/{application,domain}/`, `backend/tests/contract/wantlist/`, `backend/tests/integration/wantlist/` (add `.gitkeep` where empty)
- [X] T002 Confirm no new env vars / dependencies are required (cross-check [plan.md](plan.md) Technical Context against `backend/package.json`, `frontend/package.json`); record the confirmation in the PR description — CONFIRMED: backend has axios/zod/express/ioredis/jest/supertest; frontend has react/@tanstack/react-query/react-router-dom/tailwindcss/vitest/@testing-library; no new deps; no new env vars (reuses DISCOGS_CONSUMER_KEY/SECRET, DISCOGS_USER_AGENT, DISCOGS_OAUTH_BASE_URL)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Discogs wantlist client, shared error mapping, route wiring, API/query scaffolding, and the e2e stub — every user story depends on these.

**⚠️ CRITICAL**: No user story work begins until Phase 2 is complete.

### Domain + Port

- [X] T003 [P] Define `WantItem`, `EnrichedWantEntry`, `WantEntryDetail`, `UpdateWantEntryPatch`, `AddToWantlistResult` types in `backend/src/domain/discogsOauth/wantlistTypes.ts` per [data-model.md](data-model.md) §1–5
- [X] T004 [P] Define `wantlist` domain errors in `backend/src/domain/wantlist/wantlistErrors.ts` — re-export `DiscogsNotLinkedError`; add `ReleaseNotFoundForWantError` (mirrors `ReleaseNotFoundForCreationError` in `createLibraryEntry.ts`)
- [X] T005 [P] Declare `DiscogsWantlistPort` interface (`listWants`, `getWant`, `putWant`, `deleteWant`) in `backend/src/ports/discogsOauth/discogsWantlistPort.ts` per [contracts/discogs-wantlist-client.md](contracts/discogs-wantlist-client.md)

### Discogs wantlist adapter (test-first)

- [X] T006 [US-shared] Write contract tests for `discogsWantlistAdapter` in `backend/tests/contract/discogsOauth/wantlistClient.contract.test.ts` covering the 10 cases in [contracts/discogs-wantlist-client.md](contracts/discogs-wantlist-client.md) (multi-page list, empty list, `getWant` null on 404, partial `putWant` upsert, `deleteWant` 204 + 404→`DiscogsNotFoundError`, 401→`DiscogsAuthError`, 429→`DiscogsRateLimitError` after `MAX_ATTEMPTS`, writes `__skipRetry` but breaker-eligible, `recordRateLimitHeaders` on success + error) — MUST FAIL
- [X] T007 [US-shared] Implement `discogsWantlistAdapter` in `backend/src/adapters/discogsOauth/discogsWantlistAdapter.ts` — reuse the `createClient(connection)` resilience structure from `discogsCollectionAdapter.ts` (circuit breaker → `acquireSlot()` → retry/backoff → header recording → 401/403/404/429 mapping), `mapWant` normalization, `__skipRetry` on `putWant`/`deleteWant`; export `discogsWantlistAdapter: DiscogsWantlistPort`. Tests from T006 pass

### Shared HTTP error mapping

- [X] T008 Extract `respondCollectionError(res, route, uid, err)` from `backend/src/adapters/library/libraryRoutes.ts` into `backend/src/adapters/discogs/respondCollectionError.ts` (message text stays library-specific via a passed `resourceLabel`, or keep generic — see [contracts/wantlist-api.md](contracts/wantlist-api.md)); update `libraryRoutes.ts` to import it; run `backend/tests/contract/library/library.contract.test.ts` + `backend/tests/integration/library/*` to prove no regression

### Route wiring + API/query scaffolding

- [X] T009 Create `wantlistRouter` skeleton in `backend/src/adapters/wantlist/wantlistRoutes.ts` (Express Router, `standardRateLimit` via `createRateLimitStore()`, `requireAuth`, composition root block instantiating use cases — stub handlers returning 501 for now) and mount it in `backend/src/app.ts` as `app.use('/api/wantlist', wantlistRouter)` after `/api/library`
- [X] T010 [P] Create `frontend/src/services/wantlistApi.ts` with `list`, `getOne`, `add`, `update`, `remove` functions typed to [contracts/wantlist-api.md](contracts/wantlist-api.md), using `authorizedFetch` (mirror `libraryApi.ts`)
- [X] T011 [P] Create `frontend/src/queries/wantlistQueries.ts` with `wantlistKeys`, `useWantlist(page,pageSize)`, `useRefreshWantlist`, `useWantlistEntry(releaseId)`, `useAddToWantlist`, `useUpdateWantEntry`, `useRemoveFromWantlist` (mirror `libraryQueries.ts`; invalidate `wantlistKeys.all` on every mutation)

### E2E stub

- [X] T012 [US-shared] Extend `e2e/helpers/discogsOauthStub.ts` — add `wants: Map<username, WantItem[]>`, routes `GET /users/:username/wants` (paginated), `PUT /users/:username/wants/:releaseId` (upsert notes/rating), `DELETE /users/:username/wants/:releaseId` (404 when absent); `/__stub/wants/:username` seed + read control endpoints; extend `collectionFailureMode` to cover `/wants`; clear `wants` in `/__stub/reset`

**Checkpoint**: Discogs wantlist reachable end-to-end (stubbed); routes mounted; frontend can call `/api/wantlist`. User stories can now proceed.

---

## Phase 3: User Story 1 — Browse my wantlist as a synchronized view (Priority: P1) 🎯 MVP

**Goal**: A linked user opens "My wishlist" and sees their Discogs wantlist as cards (community rating badge included); an unlinked user sees the link-required gate only; empty wantlist shows an empty state; manual refresh re-syncs.

**Independent Test**: Seed the stub wantlist with entries → open `/app/wishlist` → cards render matching library/search style. Unlink → gate only, no list/actions. Empty wantlist → empty state. Refresh → re-sync.

### Tests for User Story 1 (write first, MUST FAIL)

- [X] T013 [P] [US1] Unit test `listWantlist` use case in `backend/tests/unit/wantlist/application/listWantlist.test.ts` — fake ports: sorts newest-first, paginates the cached array, `catalogStatus:'unavailable'` per failed enrichment (rest still returned), cache hit issues zero `listWants` calls, `force` invalidates then re-fetches, unlinked → `DiscogsNotLinkedError`
- [X] T014 [P] [US1] Contract/integration test for `GET /api/wantlist` in `backend/tests/integration/wantlist/wantlistRoutes.integration.test.ts` — 200 shape (`items`/`page`/`pageSize`/`totalItems`), empty → `totalItems:0`, 409 `discogs_not_linked`, 401 `discogs_link_invalid`, 429/503 mapping, `refresh=true` forces sync
- [X] T015 [P] [US1] RTL test `frontend/tests/unit/WishlistPage.test.tsx` — renders cards from a mocked list, shows `WantlistLinkRequired` on `discogs_not_linked`/`discogs_link_invalid`, empty state on `items:[]`, Refresh triggers refetch, loading skeletons
- [X] T016 [P] [US1] RTL test `frontend/tests/unit/WantlistCard.test.tsx` — renders title/artist/cover, community `ReleaseRatingBadge` from `release.community.rating`, links to `/app/releases/:discogsId` with `state.from`, `catalogStatus:'unavailable'` fallback
- [X] T017 [P] [US1] E2E `e2e/tests/wishlist-discogs-sync.spec.ts` (US1 cases) — linked+seeded → cards; unlinked → gate; empty → empty state; refresh re-syncs after a stub-side change

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement `enrichWantEntry` / `enrichWantEntries` in `backend/src/application/wantlist/enrichWantEntry.ts` — `getRelease({type:'vinylmania'}, releaseId)` via `mapWithConcurrency(entries, 5, …)`, per-entry `catalogStatus` degrade, no local write-back
- [X] T019 [US1] Implement `createListWantlistUseCase` in `backend/src/application/wantlist/listWantlist.ts` — `requireConnection`; `cacheAdapter.withCache('discogs:wantlist:'+uid, 300, () => listWants+enrich+sortByAddedAtDesc)`; `options.force` → `cacheAdapter.invalidate` first; return full array (route slices); structured logs `sync_started|sync_skipped|sync_completed`
- [X] T020 [US1] Implement `GET /api/wantlist` handler in `backend/src/adapters/wantlist/wantlistRoutes.ts` — parse `page`/`pageSize` (1..50) + `refresh`; call `listWantlist`; slice page; serialize `{items,page,pageSize,totalItems}`; errors via shared `respondCollectionError`
- [X] T021 [P] [US1] Create `frontend/src/components/WantlistCard.tsx` — `Card` + `pressableCard` link to `/app/releases/:discogsId` (`state={{from:'/app/wishlist'}}`), `ReleaseRatingBadge` via `presentRating(release.community?.rating)`, title/artist, `catalogStatus:'unavailable'` fallback (remove action added in US4)
- [X] T022 [P] [US1] Create `frontend/src/components/WantlistLinkRequired.tsx` (or add a `context:'library'|'wishlist'` prop to `LibraryLinkRequired.tsx`) with wishlist copy — "Your wishlist is synchronized with your Discogs wantlist. Link your accounts from your profile to start using it."
- [X] T023 [US1] Rebuild `frontend/src/pages/WishlistPage.tsx` — replace `<UnderConstruction/>`; use `useWantlist` + `useRefreshWantlist`; gate via `discogs_not_linked`/`discogs_link_invalid` (reuse `gateVariant` pattern from `LibraryListPage.tsx`); grid of `WantlistCard`; empty state (FR-004); Refresh button; pagination; heading "Your wishlist"
- [X] T024 [US1] Verify "My wishlist" nav parity: desktop `HeaderNavIcons.tsx` (already present) + mobile menu in `frontend/src/components/AppHeader.tsx` / `HamburgerMenu` — add the wishlist link to the mobile menu if missing; update `frontend/tests/unit/AppHeader.test.tsx` / `HamburgerMenu.test.tsx`
- [X] T025 [US1] Add structured logging assertions review — confirm `listWantlist` logs match `syncLibrary.ts` shape (`route:'wantlistSync'`, `outcome`, `uid`, `meta`)

**Checkpoint**: "My wishlist" is a working, synchronized, gated, refreshable read view. MVP-readable.

---

## Phase 4: User Story 2 — Add a record to my wantlist from search & detail (Priority: P1) 🎯 MVP

**Goal**: A distinct "Add to wishlist" action on search-result cards and the release detail page writes straight to the Discogs wantlist; idempotent; flags "already in wishlist" and "already in library"; gated for unlinked users.

**Independent Test**: From a search result and from a release detail page, "Add to wishlist" → the release appears in `/app/wishlist` and in the stub wantlist. Re-add → no duplicate, "already in wishlist". Add an owned release → added + "already in library", library unchanged. Unlinked → gate message, not added.

### Tests for User Story 2 (write first, MUST FAIL)

- [X] T026 [P] [US2] Unit test `addToWantlist` use case in `backend/tests/unit/wantlist/application/addToWantlist.test.ts` — catalog lookup gates add (404 → `ReleaseNotFoundForWantError`); `putWant` called; `alreadyInWantlist` true when `getWant` already present (no duplicate); `alreadyInLibrary` from `getInstancesForRelease` non-empty; cache invalidated; unlinked → `DiscogsNotLinkedError`
- [X] T027 [P] [US2] Integration test `POST /api/wantlist` in `backend/tests/integration/wantlist/wantlistRoutes.integration.test.ts` — 201 shape + `alreadyInWantlist`/`alreadyInLibrary`, 404 `release_not_found`, 409/401/429/503 mapping, body validation (`{discogsReleaseId:number}` strict)
- [X] T028 [P] [US2] RTL test `frontend/tests/unit/ResultCardActions.test.tsx` (extend) — two distinct actions with distinct accessible names ("Add to library" / "Add to wishlist"), wishlist button loading/added/`alreadyInWantlist` states, not color-only distinction
- [X] T029 [P] [US2] RTL test `frontend/tests/unit/ReleaseDetailPage.test.tsx` (extend) — "Add to wishlist" button present next to "Add to library"; success shows added state; `alreadyInLibrary` message; `discogs_not_linked` → link message; error → retryable alert
- [X] T030 [P] [US2] E2E `e2e/tests/wishlist-discogs-sync.spec.ts` (US2 cases) — add from search result + from detail page; duplicate add; add owned release shows "already in library"; unlinked gate

### Implementation for User Story 2

- [X] T031 [US2] Implement `createAddToWantlistUseCase` in `backend/src/application/wantlist/addToWantlist.ts` — `requireConnection`; `getRelease` gate (map 404 → `ReleaseNotFoundForWantError`, rate/unavailable → reuse `CatalogUnavailableForCreationError` pattern); `getWant` → `alreadyInWantlist`; `putWant` (no fields) to add; `discogsCollection.getInstancesForRelease` → `alreadyInLibrary`; `cacheAdapter.invalidate`; log `entry_added` with `meta:{releaseId,alreadyInWantlist,alreadyInLibrary}`
- [X] T032 [US2] Implement `POST /api/wantlist` handler in `backend/src/adapters/wantlist/wantlistRoutes.ts` — `zod` `{discogsReleaseId:number().int().positive()}` strict; call use case; 201 `AddToWantlistResult`; `ReleaseNotFoundForWantError` → 404 `release_not_found`; else `respondCollectionError`
- [X] T033 [US2] Wire `discogsCollectionAdapter` + `discogsWantlistAdapter` + `discogsConnectionAdapter` + `cacheAdapter` + catalog into the `wantlistRoutes.ts` composition root for `addToWantlist`
- [X] T034 [P] [US2] Extend `frontend/src/components/ResultCardActions.tsx` — add a second icon `Button` "Add to wishlist" (heart icon, matches `WishlistIcon`), props `onAddToWantlist`, `addingToWantlist`, `inWantlist`; keep the two visually distinct (icon + label, not color)
- [X] T035 [US2] Update `frontend/src/components/SearchResultCard.tsx` + `frontend/src/pages/SearchResultsPage.tsx` — pass wantlist handlers (`useAddToWantlist`), track per-result wantlist state, surface `alreadyInLibrary` in the result message, handle `discogs_not_linked`/`discogs_link_invalid`/generic error
- [X] T036 [US2] Update `frontend/src/pages/ReleaseDetailPage.tsx` — add "Add to wishlist" button beside "Add to library" in the main info card; on success set added state; show `alreadyInLibrary` note; reuse the page's existing `gateError`/`addError` pattern for wishlist errors
- [X] T037 [US2] On successful wishlist add, invalidate `wantlistKeys.all` so `/app/wishlist` reflects it immediately (FR-014 "changes from Vinylmania reflected immediately")

**Checkpoint**: MVP complete — users can browse and populate the wantlist. Deploy/demo candidate.

---

## Phase 5: User Story 3 — Edit notes & personal rating on the release detail page (Priority: P2)

**Goal**: When a release is in the user's wantlist, its detail page shows a wantlist panel (notes + personal star rating) with per-field autosave; hidden when the release is not in the wantlist.

**Independent Test**: Open the detail page of a wanted release → panel shows current notes + personal rating. Tap a star / edit notes + blur → saved to Discogs (visible on stub), persists after reload. Open a non-wanted release → no panel.

### Tests for User Story 3 (write first, MUST FAIL)

- [X] T038 [P] [US3] Unit test `getWantEntry` + `updateWantEntry` use cases in `backend/tests/unit/wantlist/application/updateWantEntry.test.ts` — `getWantEntry` returns detail or null (→404); `updateWantEntry` sends only the provided field to `putWant`; rating clamped 0..5; not-in-wantlist → not-found; cache invalidated; Discogs write failure propagates (not reported as saved)
- [X] T039 [P] [US3] Integration test `GET /api/wantlist/:releaseId` + `PATCH /api/wantlist/:releaseId` in `backend/tests/integration/wantlist/wantlistRoutes.integration.test.ts` — 200/404 shapes, `PATCH` strict body (≥1 key, `rating` 0..5, `notes` string), 400 on empty/out-of-range, 404 `not_in_wantlist`, error mapping
- [X] T040 [P] [US3] RTL test `frontend/tests/unit/WantlistPanel.test.tsx` — renders notes + `StarRating` from entry; star tap calls update mutation with `{rating}`; notes blur calls `{notes}`; no Save button; save error keeps prior value + shows retryable message
- [X] T041 [P] [US3] RTL test `frontend/tests/unit/ReleaseDetailPage.test.tsx` (extend) — panel shown when `useWantlistEntry` resolves an entry, absent on 404
- [X] T042 [P] [US3] E2E `e2e/tests/wishlist-discogs-sync.spec.ts` (US3 cases) — 5 cases written; 1 passes (no-panel), 4 RED — surfaced a P0 bug: `getWant` used a non-existent Discogs endpoint `GET /wants/:id` so the detail panel never showed & PATCH autosave always 404'd. Fix in progress (backend-agent a5a04154). RE-RUN after the fix lands.

### Implementation for User Story 3

- [X] T043 [P] [US3] Implement `createGetWantEntryUseCase` in `backend/src/application/wantlist/getWantEntry.ts` — `requireConnection`; serve from warm `discogs:wantlist:` cache when present else `getWant`; return `WantEntryDetail` or null
- [X] T044 [US3] Implement `createUpdateWantEntryUseCase` in `backend/src/application/wantlist/updateWantEntry.ts` — `requireConnection`; `putWant(connection, releaseId, {only the provided field})`; `getWant` first to 404 if absent; `cacheAdapter.invalidate`; log `entry_updated` with `meta:{releaseId,fields}`
- [X] T045 [US3] Implement `GET /api/wantlist/:releaseId` + `PATCH /api/wantlist/:releaseId` handlers in `backend/src/adapters/wantlist/wantlistRoutes.ts` — param parse (positive int); `PATCH` `zod` schema `{rating?:0..5 int, notes?:string}` `.strict().refine(len>0)`; wire use cases into composition root; errors via `respondCollectionError`
- [X] T046 [P] [US3] Create `frontend/src/components/WantlistPanel.tsx` — modeled on `MyCopySection.tsx`: `StarRating` (personal rating, `onChange` → `useUpdateWantEntry` `{rating}`) + `InlineEditableField` textarea (notes, `onSave` → `{notes}`); heading "Your wishlist notes"; no Save button; per-field error handling
- [X] T047 [US3] Update `frontend/src/pages/ReleaseDetailPage.tsx` — call `useWantlistEntry(parsedId)`; render `WantlistPanel` in its own `Card` when an entry exists; keep it in sync after an add (US2) via query invalidation

**Checkpoint**: Wantlist entries are annotatable; feature is a working tool.

---

## Phase 6: User Story 4 — Remove a record from my wantlist (Priority: P2)

**Goal**: Each wantlist entry has an explicit "Remove from wishlist" action in the wishlist view, gated by a lightweight confirmation; on confirm the entry is removed from the Discogs wantlist and disappears.

**Independent Test**: In `/app/wishlist`, click "Remove from wishlist" → confirmation dialog → confirm → entry gone from list + stub wantlist. Dismiss → nothing changes. Discogs failure on confirm → retryable error, entry stays.

### Tests for User Story 4 (write first, MUST FAIL)

- [X] T048 [P] [US4] Unit test `removeFromWantlist` use case in `backend/tests/unit/wantlist/application/removeFromWantlist.test.ts` — `deleteWant` called; 404 from Discogs → `not_in_wantlist`; cache invalidated; unlinked → `DiscogsNotLinkedError`; log `entry_removed`
- [X] T049 [P] [US4] Integration test `DELETE /api/wantlist/:releaseId` in `backend/tests/integration/wantlist/wantlistRoutes.integration.test.ts` — 204 success, 404 `not_in_wantlist`, error mapping
- [X] T050 [P] [US4] RTL test `frontend/tests/unit/RemoveFromWantlistDialog.test.tsx` — opens on trigger, confirm calls `useRemoveFromWantlist`, cancel/`Esc` closes without calling, focus trap + accessible name (uses `ui/Modal`)
- [X] T051 [P] [US4] RTL test `frontend/tests/unit/WantlistCard.test.tsx` (extend) — remove control present, opens dialog; on success card removed from list; on error card stays + alert
- [X] T052 [P] [US4] E2E `e2e/tests/wishlist-discogs-sync.spec.ts` (US4 cases) — remove with confirm; dismiss keeps entry; ≤2 interactions (SC-006)

### Implementation for User Story 4

- [X] T053 [US4] Implement `createRemoveFromWantlistUseCase` in `backend/src/application/wantlist/removeFromWantlist.ts` — `requireConnection`; `deleteWant`; map `DiscogsNotFoundError` → domain not-found; `cacheAdapter.invalidate`; log `entry_removed` with `meta:{releaseId}`
- [X] T054 [US4] Implement `DELETE /api/wantlist/:releaseId` handler in `backend/src/adapters/wantlist/wantlistRoutes.ts` — 204 on success, 404 `not_in_wantlist`, else `respondCollectionError`; wire into composition root
- [X] T055 [P] [US4] Create `frontend/src/components/RemoveFromWantlistDialog.tsx` — wrap `frontend/src/components/ui/Modal.tsx`; title "Remove from wishlist?", body names the release, "Remove" (destructive) + "Cancel"; consult `apple-design`/`emil-design-eng` for the destructive-action pattern + motion
- [X] T056 [US4] Add the remove action to `frontend/src/components/WantlistCard.tsx` — a "Remove from wishlist" button (accessible name, not icon-only-ambiguous) opening `RemoveFromWantlistDialog`; on confirm call `useRemoveFromWantlist`; optimistic removal or refetch on success; error → inline alert, entry stays
- [X] T057 [US4] Ensure `WishlistPage` handles the post-remove empty state (list becomes empty → FR-004 empty state, not a blank)

**Checkpoint**: Users can curate their wantlist down.

---

## Phase 7: User Story 5 — Buying a wanted record removes it from the wantlist (Priority: P2)

**Goal**: Adding a release to the library auto-removes it from the wantlist after the collection write is confirmed; if that removal fails, the user is told (library add still succeeds); a release never in the wantlist triggers no wantlist change/error.

**Independent Test**: With a release in the wantlist, "Add to library" → library has it, `/app/wishlist` no longer shows it, stub wantlist no longer has it. Stub wantlist-delete failure → library add still succeeds + "couldn't remove from wishlist" notice. Release not in wantlist → no error.

### Tests for User Story 5 (write first, MUST FAIL)

- [X] T058 [P] [US5] Unit test `createLibraryEntry` (extend `backend/tests/unit/library/application/*` — new file `createLibraryEntry.test.ts` if absent) — after collection + repo write, `discogsWantlist.deleteWant` attempted; success → `wantlistRemoval:'removed'`; `DiscogsNotFoundError` → `'not_in_wantlist'`; other error → `'failed'` (library add NOT rolled back, NOT thrown); warm-cache miss of the release → DELETE skipped, `'not_in_wantlist'`
- [X] T059 [P] [US5] Integration test `POST /api/library` in `backend/tests/integration/library/*` — response includes `wantlistRemoval`; `'failed'` path returns 201 (not an error); existing library contract tests still pass
- [X] T060 [P] [US5] RTL test `frontend/tests/unit/ReleaseDetailPage.test.tsx` / `SearchResultsPage` — `wantlistRemoval:'failed'` in the add response shows the non-blocking notice; `'removed'`/absent shows nothing extra
- [X] T061 [P] [US5] E2E `e2e/tests/wishlist-discogs-sync.spec.ts` (US5 cases) — wanted release added to library disappears from wishlist; stub failure → notice + library still updated; non-wanted release → no error

### Implementation for User Story 5

- [X] T062 [US5] Extend `createCreateLibraryEntryUseCase` in `backend/src/application/library/createLibraryEntry.ts` — add injected `discogsWantlist: DiscogsWantlistPort` (+ optional `cache` read) dep; after the repo entry is created, attempt `deleteWant(connection, releaseId)` best-effort per [research.md](research.md) Decision 5; return `wantlistRemoval` on the result; log `wantlist_removed_on_purchase` / `wantlist_removal_failed`; invalidate `discogs:wantlist:'+uid`
- [X] T063 [US5] Update `backend/src/domain/library/types.ts` + `serializeEntry` in `backend/src/adapters/library/libraryRoutes.ts` — add optional `wantlistRemoval` to the `POST /api/library` 201 body; inject `discogsWantlistAdapter` into the `createLibraryEntry` composition root
- [X] T064 [P] [US5] Update `frontend/src/services/libraryApi.ts` + `frontend/src/queries/libraryQueries.ts` — add `wantlistRemoval?: 'removed'|'not_in_wantlist'|'failed'` to `EnrichedLibraryEntry`/create result; `useCreateLibraryEntry` `onSuccess` also invalidates `wantlistKeys.all`
- [X] T065 [US5] Update `frontend/src/pages/ReleaseDetailPage.tsx` + `frontend/src/pages/SearchResultsPage.tsx` — when a library-add response has `wantlistRemoval === 'failed'`, show "Added to your library. We couldn't remove it from your wishlist — remove it there when you can."

**Checkpoint**: Library and wantlist stay mutually consistent; all 5 stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T066 [P] Accessibility audit of all new/changed UI (WishlistPage, WantlistCard, WantlistPanel, RemoveFromWantlistDialog, ResultCardActions, ReleaseDetailPage) against Principle X — keyboard operability, visible focus, contrast (light + dark), accessible names, heading order, `prefers-reduced-motion`; fix findings. Also: give the wishlist add-gate its own copy on SearchResultsPage + ReleaseDetailPage (currently reuses the library gate string "…before adding records to your library")
- [X] T067 [P] Apple HIG / motion pass per Principle XI — consult `apple-design` / `emil-design-eng` / `animate` for the add→added transition, the wantlist panel reveal, and the confirmation dialog; align easing/spring + reduced-motion
- [X] T068 [P] Update `e2e/tests/wishlist-responsive.spec.ts` for the real page (replaces the `UnderConstruction` assumptions) — grid/list responsiveness, mobile nav entry, dialog on mobile
- [X] T069 [P] `frontend/src/components/UnderConstruction.tsx` is now orphaned (no route uses it after WishlistPage rebuilt) — remove it + its unit test; repoint or remove `e2e/tests/dashboard-feed-grid.spec.ts` line ~406 (asserts `/app/wishlist` renders an UnderConstruction display `<h1>`) to a still-existing display heading; `e2e/tests/header-responsive-nav.spec.ts` line 36 already fixed by T017 agent
- [X] T070 [P] Structured-logging review across the `wantlist` slice — every operation + error logs `route`, `outcome`, `uid`, `meta` per Principle V / FR-019; grep for missing paths
- [X] T071 [P] Docs: add a "Wishlist" section to end-user docs under `docs/` (how it syncs with Discogs, add/edit/remove, purchase auto-removal, out-of-scope items)
- [X] T072 CHANGELOG entry + MINOR version bump — CI auto-generates the CHANGELOG + version from Conventional Commits (per CHANGELOG.md "Unified versioning" note); the feature commit MUST be `feat(060): ...` for the MINOR bump. README now links docs/wishlist.md from the "Manage your library" section. (additive API surface; new `wantlistRemoval` field is backward-compatible) per Principle VI
- [X] T073 Run [quickstart.md](quickstart.md) end-to-end (all 13 walkthrough steps + SC-001…SC-008); attach evidence to the PR
- [X] T074 Full suite gate — `backend` Jest (+ emulator), `frontend` Vitest, `e2e` Playwright all green; no WCAG regression (feature 054 deploy gate)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: immediate
- **Phase 2 (Foundational)**: after Setup — **BLOCKS all user stories**
  - T003, T004, T005 [P] → T006 → T007; T008 [P]; T009 (after T007); T010, T011, T012 [P]
- **Phase 3 (US1)**: after Phase 2
- **Phase 4 (US2)**: after Phase 2 (independent of US1; shares `wantlistRoutes.ts` composition root — coordinate merges)
- **Phase 5 (US3)**: after Phase 2; T047 touches `ReleaseDetailPage.tsx` also touched by T036 (US2) — sequence US2 before US3 on that file, or merge-coordinate
- **Phase 6 (US4)**: after Phase 2; T056 extends `WantlistCard.tsx` from US1 (T021) — US4 needs US1's card
- **Phase 7 (US5)**: after Phase 2; independent backend path, but T065 touches `ReleaseDetailPage.tsx`/`SearchResultsPage.tsx` (US2 files) — sequence after US2
- **Phase 8 (Polish)**: after all targeted stories

### Story dependencies

- **US1 (P1)**: needs only Foundational. Delivers the readable MVP half.
- **US2 (P1)**: needs only Foundational. Independently testable. Together with US1 = full MVP.
- **US3 (P2)**: needs Foundational; soft-depends on US2 for the `ReleaseDetailPage` add flow but the panel is independently testable via a pre-seeded want.
- **US4 (P2)**: needs Foundational + US1's `WantlistCard` (the remove control lives on it).
- **US5 (P2)**: needs Foundational; soft file-level ordering after US2.

### Within each story

Tests (fail first) → domain/use case → route handler + composition wiring → frontend component → page integration → logging.

---

## Parallel Opportunities

- **Phase 2**: T003 / T004 / T005 together; then T006 + T008 + T010 + T011 + T012 in parallel; T007 after T006; T009 after T007.
- **Phase 3 tests**: T013–T017 all [P].
- **Phase 4 tests**: T026–T030 all [P].
- **Phase 5 tests**: T038–T042 all [P].
- **Phase 6 tests**: T048–T052 all [P].
- **Phase 7 tests**: T058–T061 all [P].
- **Cross-story**: once Phase 2 is done, a backend dev can take US1+US2 use cases/routes while a frontend dev builds `WantlistCard`/`WishlistPage`/`ResultCardActions`; US5's backend (`createLibraryEntry`) is fully independent of US3/US4.
- **Phase 8**: T066–T071 all [P].

---

## Parallel Example: User Story 1

```bash
# Tests first (all fail):
Task: "T013 Unit test listWantlist in backend/tests/unit/wantlist/application/listWantlist.test.ts"
Task: "T014 Integration test GET /api/wantlist in backend/tests/integration/wantlist/wantlistRoutes.integration.test.ts"
Task: "T015 RTL test frontend/tests/unit/WishlistPage.test.tsx"
Task: "T016 RTL test frontend/tests/unit/WantlistCard.test.tsx"
Task: "T017 E2E US1 cases in e2e/tests/wishlist-discogs-sync.spec.ts"

# Then parallel implementation:
Task: "T018 enrichWantEntry in backend/src/application/wantlist/enrichWantEntry.ts"
Task: "T021 WantlistCard in frontend/src/components/WantlistCard.tsx"
Task: "T022 WantlistLinkRequired in frontend/src/components/WantlistLinkRequired.tsx"
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2)

1. Phase 1 Setup → Phase 2 Foundational (all blocking).
2. Phase 3 (US1) → validate: synchronized, gated, refreshable read view.
3. Phase 4 (US2) → validate: add from search + detail, idempotent, flags.
4. **STOP & VALIDATE** → deploy/demo. This is a coherent, shippable wantlist.

### Incremental delivery

5. US3 → per-entry notes + personal rating (detail page). Demo.
6. US4 → explicit remove with confirmation. Demo.
7. US5 → auto-remove on purchase. Demo.
8. Phase 8 polish → a11y, motion, docs, version, full-suite gate.

### Notes

- Every implementation task has a preceding failing test (Principle I).
- `backend/src/adapters/wantlist/wantlistRoutes.ts` and `frontend/src/pages/ReleaseDetailPage.tsx` are multi-story touchpoints — commit per task and merge-coordinate.
- No Firestore, no migration — the wantlist is a Discogs projection (research.md Decision 2).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
