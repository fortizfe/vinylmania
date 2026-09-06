# Phase 0 Research: Discogs-Integrated Wantlist

All Technical Context items were resolved without open `NEEDS CLARIFICATION`. The
decisions below record the choices that shape Phase 1.

---

## Decision 1 — Discogs Wantlist API surface

**Decision**: Use three endpoints of the authenticated Discogs API, called as the linked user (OAuth 1.0a, same credentials as the collection client):

| Operation | Method + path | Notes |
|-----------|---------------|-------|
| List wantlist | `GET /users/{username}/wants?page={n}&per_page=100` | Paginated. Response `{ pagination: { page, pages }, wants: [ WantItem ] }`. |
| Add / update entry | `PUT /users/{username}/wants/{release_id}` | Body `{ notes?: string, rating?: 0..5 }`. Creates the want if absent, updates it if present. Omitted fields are left unchanged. Returns the updated `WantItem`. |
| Remove entry | `DELETE /users/{username}/wants/{release_id}` | `204` on success; `404` when the release is not in the wantlist. |

`WantItem` shape (fields this feature uses):

```jsonc
{
  "id": 123456,                 // the release id — the wantlist's key
  "rating": 4,                  // 0..5 integer; 0 = unrated (same scale as the collection instance rating)
  "notes": "Original pressing only",
  "date_added": "2025-08-01T12:00:00-07:00",
  "basic_information": { "id": 123456, "title": "...", "year": 1979, "artists": [...], "thumb": "..." }
}
```

**Rationale**: These are the only wantlist endpoints Discogs exposes, and `rating`/`notes` are exactly the two per-entry fields the spec constrains editing to (spec Clarifications, FR-008). `PUT` doubling as add-and-update means "Add to wishlist" and per-field autosave hit the same endpoint. The want key is the release id, so no local entry id is invented — routes use `/:releaseId`.

**Alternatives considered**:
- *Sending both `notes` and `rating` on every autosave (read-modify-write)*: rejected — Discogs merges partial `PUT`s, so sending only the changed field is sufficient and matches the library's per-field `PATCH` model.
- *Discogs `sort`/`sort_order` params*: not used in v1 — the wantlist is shown newest-first from `date_added` (client-side), and manual reordering is explicitly out of scope.

---

## Decision 2 — No local storage; sync-on-read with a short Redis cache

**Decision**: Introduce **no Firestore collection** for the wantlist. `listWantlist` walks every page of `GET /wants`, enriches each entry with catalog data, and serves the result from `cacheAdapter.withCache('discogs:wantlist:' + uid, 300, …)`. Any write (`addToWantlist`, `updateWantEntry`, `removeFromWantlist`, and the purchase-removal in `createLibraryEntry`) calls `cacheAdapter.invalidate('discogs:wantlist:' + uid)` after the Discogs write is confirmed. `GET /api/wantlist?refresh=true` invalidates then re-fetches.

**Rationale**:
- The user's requirement is explicit: "escribe directamente en la wantlist real … (no en Firestore)" and "no como una lista aparte guardada solo en Vinylmania".
- The library keeps a Firestore mirror only because it had to migrate pre-016 local per-copy data and reconcile a union on first sync (`syncLibrary.ts`). The wantlist has **no pre-existing local data**, so that entire reconciliation/marker/first-sync machinery is unnecessary (Principle III).
- `withCache` on the enriched payload gives SC-008 directly: a hit inside the 5-minute window issues zero Discogs requests; a miss (or `refresh`) issues exactly one paginated walk + enrichment. Writes are reflected immediately because they bust the key (FR-014).
- `cacheAdapter` is already fail-soft: with no Redis, every read is a miss (correct, just more Discogs calls) and every `invalidate` is a no-op.

**Alternatives considered**:
- *Marker-only, like `syncLibrary`*: rejected — the library can afford a marker because the data itself lives in Firestore; the wantlist has nowhere to read from on a "skip", so the payload itself must be cached.
- *Per-release cache only (rely on catalog cache)*: rejected — still pays a full `GET /wants` walk on every load; caching the assembled page avoids that within the window.

**Pagination**: `listWantlist` fetches the full wants list into the cached array (matching `listAllInstances`' full walk) and the route serves the requested `page`/`pageSize` slice from it. Total count comes from the cached array length. Typical personal wantlists are tens–hundreds of entries; a full walk is 1–3 upstream calls, amortized by the cache.

---

## Decision 3 — Catalog enrichment reuses the existing cached catalog path

**Decision**: A `enrichWantEntry` step in `application/wantlist` calls `getRelease({ type: 'vinylmania' }, releaseId)` (the app-token catalog adapter, already Redis-cached since feature 011) via `mapWithConcurrency(entries, 5, …)` — the same shape as `enrichLibraryEntry.ts`. On a per-entry catalog failure it returns `catalogStatus: 'unavailable'` for that entry and the rest of the list still renders (Principle VII).

**Rationale**: The wantlist card needs title, artist, cover, and the **community** rating — all catalog data the catalog adapter already serves and caches. No new catalog integration; no local write-back (there is no Firestore row to persist genre/style/format onto, and the wantlist has no filters in v1).

**Alternatives considered**:
- *Use `basic_information` from the `wants` payload*: it carries title/artists/thumb but **not** the community rating or full-size cover, and the badge (FR-003) needs the community rating — so a catalog lookup is required anyway. `basic_information` is used only as a fallback label when the catalog lookup fails.

---

## Decision 4 — Reuse the collection client's resilience machinery verbatim

**Decision**: `discogsWantlistAdapter.ts` copies the `createClient(connection)` structure from `discogsCollectionAdapter.ts`: shared circuit breaker (`discogsCircuitBreaker`), preventive throttle (`discogsRateLimiter.acquireSlot`), retry with backoff (`discogsRetry`), `recordRateLimitHeaders`, and the response-error interceptor mapping `401/403 → DiscogsAuthError`, `404 → DiscogsNotFoundError`, `429 → DiscogsRateLimitError`, else `DiscogsUnavailableError`. The non-idempotent `PUT`/`DELETE` writes are marked `__skipRetry` (circuit-breaker still applies), exactly as `addReleaseToCollection` is.

**Rationale**: FR-016 requires reuse of "the resilience already existing (rate limiting, retry, circuit breaker)". The collection and wantlist clients consume the **same per-IP Discogs budget**, so they must share the same limiter and breaker instances (they already are process-global singletons). Duplicating ~90 lines of `createClient` is the KISS choice versus prematurely extracting a shared OAuth-client factory; a follow-up refactor to share it is cheap and out of scope here.

**Alternatives considered**:
- *Extract a shared `createOauthClient` now*: deferred — YAGNI; two call sites don't justify the abstraction, and the extraction is safer once both are test-covered.

---

## Decision 5 — "Remove from wantlist on purchase" (FR-012 / FR-013)

**Decision**: `createLibraryEntry` gains an injected `discogsWantlist` port. After the collection write **and** the Firestore library entry are confirmed, it attempts `discogsWantlist.deleteWant(connection, releaseId)`:
- success → result carries `wantlistRemoval: 'removed'`, log `wantlist_removed_on_purchase`.
- `DiscogsNotFoundError` (release was not in the wantlist) → `wantlistRemoval: 'not_in_wantlist'`, no error surfaced.
- any other Discogs error → **swallowed** (the library add already succeeded); result carries `wantlistRemoval: 'failed'`, log `wantlist_removal_failed` at `warn`.

`POST /api/library` (201) response gains an optional `wantlistRemoval` field. The frontend shows "Added to your library. Couldn't remove it from your wishlist — try removing it there." only when `wantlistRemoval === 'failed'` (FR-013).

Where the cached wantlist for the uid is present and fresh, `createLibraryEntry` skips the DELETE entirely when the release is absent from it (honors scenario "no wantlist change attempted" and saves a call); otherwise it attempts the DELETE and relies on the 404-as-benign mapping.

**Rationale**: The library add is the user's primary intent and must not be rolled back or reported as failed because a secondary cleanup failed (FR-013). Swallowing non-404 errors with a surfaced-but-non-blocking flag matches `syncLibrary.ts`'s existing "count failures, keep going" style.

**Scope note (assumption, recorded in spec)**: Auto-removal is wired only into the `createLibraryEntry` use case — the "Add to library" action from search results and the release detail page. It is **not** wired into `syncLibrary`'s reconciliation (a release appearing in the Discogs collection because the user added it on discogs.com is not a Vinylmania "purchase" event, and discogs.com already applies its own native wantlist removal in that case).

---

## Decision 6 — "Already in library" indication is post-action, not per-card

**Decision**: `addToWantlist` checks library membership authoritatively via `discogsCollection.getInstancesForRelease(connection, releaseId)` (non-empty ⇒ owned) and returns `alreadyInLibrary: boolean` on the `POST /api/wantlist` (201) response. The frontend surfaces "Added to your wishlist — this is already in your library." only in the action's result toast/inline message. The release **detail page** additionally shows this state inline (it can afford the one extra lookup). Search-result cards do **not** pre-compute ownership (would be N collection lookups per page).

**Rationale**: FR-007a and the edge case require the indication "after" adding and on the detail page, not a pre-emptive per-card badge. One authoritative lookup on the add path is cheap; N lookups per search page is not (and would blow the rate-limit budget). The library is never modified by this path (FR-007a).

**Alternatives considered**:
- *Scan the Firestore library mirror (`listAllEntries`)*: rejected — the mirror can lag the Discogs collection between syncs; the collection is the source of truth.

---

## Decision 7 — Terminology and navigation

**Decision**: Keep the **existing** frontend route `/app/wishlist` and nav label "My wishlist" (already shipped in `headerNavLinks.ts` / `HeaderNavIcons.tsx` with a heart icon, at the same level as "My library" — satisfying FR-001). Backend slice, port, adapter, and Discogs-facing code use Discogs' own term: **wantlist** / `wants`. API routes are `/api/wantlist`. User-facing copy says "wishlist".

**Rationale**: The app already uses "wishlist" in navigation and routing; renaming user-facing strings to "wantlist" would be a gratuitous churn with no user benefit. Using "wantlist" server-side keeps the code aligned with the Discogs API it mirrors. FR-001's "same level as Mi biblioteca" is already true — the task is to verify mobile-menu parity (`AppHeader`) and replace the stub page.

**Action**: `frontend/src/pages/WishlistPage.tsx` currently renders `<UnderConstruction title="My wishlist" />`; this feature replaces its body. `frontend/src/components/UnderConstruction.tsx` stays (still used elsewhere? verify during tasks; do not delete if referenced).

---

## Decision 8 — Wantlist panel & card component strategy

**Decision**:
- **Card**: new `WantlistCard.tsx` mirroring `RecordCard.tsx`'s structure (`Card` + `pressableCard` link + `ReleaseRatingBadge` from `presentRating(release.community?.rating)` + title/artist) but linking to `/app/releases/:discogsId` (with router `state={{ from: '/app/wishlist' }}`) and rendering an explicit "Remove from wishlist" control that opens `RemoveFromWantlistDialog`.
- **Detail panel**: new `WantlistPanel.tsx` modeled on `MyCopySection.tsx` — a `StarRating` for the personal rating and an `InlineEditableField` (textarea) for notes, each autosaving via its own mutation, no Save button. Shown on `ReleaseDetailPage` only when `GET /api/wantlist/:releaseId` returns an entry.
- **Confirmation**: `RemoveFromWantlistDialog.tsx` wraps the existing accessible `ui/Modal`.
- **Link-required**: reuse `LibraryLinkRequired` with wishlist-specific copy (add a `context: 'library' | 'wishlist'` prop, or a thin `WantlistLinkRequired` wrapper) — same visual, same `discogs_not_linked` / `discogs_link_invalid` mapping already used by `LibraryListPage`.

**Rationale**: Maximise reuse (spec FR-003, FR-010, and Principle XI's consistency mandate). `RecordCard` can't be reused as-is because it's typed to `EnrichedLibraryEntry` and hard-links to `/app/library/records/:entryId`; extracting a shared inner presentational component is a reasonable option to weigh at task time, but a parallel `WantlistCard` is the low-risk default.

**Design skills**: `apple-design` / `emil-design-eng` / `animate` MUST be consulted before implementing `WantlistPanel`, `RemoveFromWantlistDialog`, and the "Add to wishlist → added" state transition (Principle XI).

---

## Decision 9 — E2E hermetic stub

**Decision**: Extend `e2e/helpers/discogsOauthStub.ts` with:
- `wants: Map<username, WantItem[]>` in-memory state.
- `GET /users/:username/wants` (paginated), `PUT /users/:username/wants/:releaseId` (upsert notes/rating), `DELETE /users/:username/wants/:releaseId` (404 when absent).
- `/__stub/wants/:username` control endpoints (seed + read) mirroring the existing `/__stub/collections/:username`.
- Reuse/extend the `collectionFailureMode` toggle (`none|auth|unavailable`) to cover the wants endpoints so resilience/gate e2e paths can be exercised.
- `wants.clear()` in the existing `/__stub/reset`.

**Rationale**: Principle I + the existing pattern (feature 016 added the collection state to this same stub). E2E never touches real Discogs.

---

## Open items for Phase 1

None. Proceed to data-model.md, contracts/, quickstart.md.
