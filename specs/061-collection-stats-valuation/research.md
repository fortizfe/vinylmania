# Phase 0 Research: Mi colección en cifras

All decisions below feed directly into [data-model.md](data-model.md), [contracts/](contracts/), and the Phase 2 task list.

## Decision 1 — Block 1 needs zero new Discogs calls: the data is already in the collection sync

**Decision**: Compute all statistics from Firestore `LibraryEntry` documents. Extend `discogsCollectionAdapter.mapInstance` to read the extra fields already present in each collection page's `basic_information` object, and extend `syncLibrary` to persist `year`, `label[]`, and `primaryArtist` onto each entry (alongside the `genre`/`style`/`format` that feature 038 already write-backs), plus reconcile `addedAt` from the instance `date_added`.

**Rationale**:
- `syncLibrary` already calls `discogsCollection.listAllInstances(connection, fieldMap)`, which walks **every page** of `GET /users/{username}/collection/folders/0/releases`. Each release row includes a `basic_information` object with `id, title, year, thumb, cover_image, formats[], labels[]{name,catno,id}, artists[]{name,id,join}` — and, in practice, `genres[]` and `styles[]`. Vinylmania's `RawInstance.basic_information` type currently declares only `{ id: number }`, discarding the rest.
- `genre` and `style` are **already persisted** per entry by `enrichLibraryEntry` (feature 038, FR-018). Only `year`, `label`, and `primaryArtist` are missing, and all three are in `basic_information` — so mapping them in the sync adds **no request**.
- Reading persisted entries is how the library already does filtering "correct at this app's few-hundred-records-per-user scale" (see `listLibraryEntries.ts`). Statistics are the same shape of problem.

**Alternatives considered**:
- *Fetch every release from the catalog endpoint in a stats use case* — rejected: violates FR-004 ("MUST NOT issue any new Discogs catalog requests"), and duplicates data the sync already has in hand.
- *A separate Firestore `collectionStats` document recomputed on write* — rejected: YAGNI; the aggregation over a few hundred entries is sub-millisecond, no need to precompute or store it.

**Verification task for Phase 2**: confirm `genres`/`styles` presence in the live `basic_information` payload and in `e2e/helpers/discogsOauthStub.ts`. If absent from `basic_information`, `genre`/`style` fall back to the already-persisted `entry.genre`/`entry.style` (feature 038) — no behavior change, since those are always populated after a library browse/refresh.

## Decision 2 — Block 2 uses `GET /marketplace/price_suggestions/{release_id}`; it requires seller settings

**Decision**: A new `DiscogsMarketplacePort.getPriceSuggestions(connection, releaseId)` returns a `Record<MediaCondition, { currency: string; value: number }>` or `null` (no market data). Its OAuth-signed adapter reuses the collection adapter's resilience pattern. When Discogs responds 401/403 specifically because the user has **no seller settings**, the adapter throws a dedicated `SellerSettingsRequiredError` (distinct from `DiscogsAuthError`), which the route maps to a specific response code so the UI can show a tailored, non-blocking notice.

**Rationale**:
- The endpoint returns, per condition grade, `{ "currency": "EUR", "value": 4.95 }`. Grades are exactly `MEDIA_CONDITIONS` from `conditionGrading.ts` — a direct key lookup with the copy's `mediaCondition`, no mapping table.
- Prices are denominated in the **authenticated user's Discogs selling currency**, which resolves the currency clarification (FR-019) with no conversion: read `currency` straight off the response.
- The endpoint **requires the user to have completed Discogs seller settings**. A linked account without seller settings gets an error, not an empty result. This is a real gap versus the spec's gating assumption and is surfaced in `plan.md` "Deviations". Graceful-degradation handling: Block 1 unaffected; Block 2 shows "Discogs only provides price estimates once you've completed your seller settings on discogs.com".
- A release with no sales history returns `null`/empty → that disc is excluded and counted as non-covered (FR-016), same treatment as a missing search-result rating.

**Alternatives considered**:
- *Marketplace statistics endpoint (`/marketplace/stats/{release_id}`: lowest price, copies for sale)* — explicitly out of scope per the spec; also doesn't give a condition-adjusted value.
- *Assume EUR and convert* — rejected by clarification (FR-019): single currency = the user's Discogs currency, no FX.

## Decision 3 — Price-suggestion cache: Redis, 7-day TTL, keyed by uid + release

**Decision**: Cache each price-suggestion response at `discogs:pricesuggest:{uid}:{releaseId}` via `cacheAdapter.withCache` with `TTL = 7 * 24 * 60 * 60` seconds. Cache negative results (`null`, "no market data") too, at the same TTL, so releases without data aren't re-fetched every visit.

**Rationale**:
- Market value "no cambia cada minuto" (FR-022) — a week-stale estimate is fine for a collection-worth headline, and it collapses a 500-record re-valuation to zero calls within the window (SC-005).
- Keyed by `uid` because the value is currency-specific (per-user seller currency) and simplest; per-user collections are small so cross-user cache sharing isn't worth the complexity of resolving and keying by currency.
- `cacheAdapter.withCache` already provides single-flight coalescing and fail-soft behavior (a Redis outage just means live fetches) — no new cache code.
- Invalidation is **not** needed on `mediaCondition` change (feature 016): the cached response contains **all** condition grades, so `computeValuation` re-picks the new grade from cache with no Discogs call (FR-026).

**Alternatives considered**:
- *Same short TTL as catalog* — rejected by FR-022.
- *Persist prices in Firestore* — rejected: YAGNI, and a stale price in a DB is worse than a cache entry that self-expires.

## Decision 4 — Reuse the resilience machinery; follow the feature 060 adapter precedent

**Decision**: `discogsMarketplaceAdapter.ts` builds its axios instance with the **same interceptor wiring** as `discogsCollectionAdapter.createClient`: `shouldShortCircuit()` → reject; `buildProtectedResourceHeader(...)` per request; `await acquireSlot()`; response interceptor calls `recordRateLimitHeaders` + `recordSuccess`; error interceptor does 401/403 → auth, 404 → not-found, `classifyForRetry` + `backoffDelayMs` for 429/5xx up to `MAX_ATTEMPTS`, `recordExhaustedFailure()` on exhaustion. `price_suggestions` is an idempotent GET, so it **is** retry-eligible (unlike `addReleaseToCollection`).

**Rationale**: Feature 060's `discogsWantlistAdapter` set the precedent — the resilience *primitives* (`discogsRateLimiter`, `discogsCircuitBreaker`, `discogsRetry`) are shared modules already consumed by two adapters; only the ~40 lines of interceptor glue are repeated. Repeating that glue a third time is cheaper and lower-risk than extracting a shared client factory mid-feature. The circuit breaker and throttle are process-global singletons, so the marketplace client automatically shares the one per-IP Discogs budget with the catalog and collection clients (FR-021).

**Alternatives considered**:
- *Extract a shared `createResilientOauthClient(connection)` factory* — attractive but out of scope; noted as a future refactor. Doing it now would touch the collection and wantlist adapters and expand the blast radius.

## Decision 5 — Progressive valuation via a stateless chunked endpoint

**Decision**: `GET /api/collection-stats/valuation?cursor=<n>` does:
1. Ensure the collection instance list is available (sync-on-read; the instance list itself is briefly cached per uid).
2. Take the slice of not-yet-priced releases starting at `cursor`, up to `BATCH_SIZE` (~25).
3. For each, `getPriceSuggestions` (served from the 7-day cache when warm), `mapWithConcurrency` at a small limit (~4) so the shared throttle paces the rest.
4. Fold results into a running `CollectionValuation` computed over **all** currently-cached suggestions for the collection (not just this batch).
5. Return `{ valuation, status: 'partial' | 'complete', nextCursor, pricedThisBatch, ... }`.

The frontend `useProgressiveValuation` hook fires the first call on mount (FR-020 — automatic), then re-fires with `nextCursor` while `status === 'partial'`, updating the card each round with `aria-live` progress.

**Rationale**: Simplest design meeting FR-020 + FR-021 + FR-023a with no streaming or job infrastructure (see plan.md "Chunked valuation endpoint — rationale"). Stateless: the cursor is just an index into a stable, cached ordering of the collection; all real state is the shared price cache, so navigation mid-run loses nothing.

**Alternatives considered**: SSE streaming, background job + poll — both rejected as infrastructure the project lacks and doesn't need at personal-collection scale.

## Decision 6 — Pure domain aggregation

**Decision**: Two pure modules in `domain/collectionStats/`:
- `aggregateStatistics(entries: LibraryEntry[]): CollectionStatistics` — total; decade buckets from `year` (unknowns → "Año desconocido"); genre/style/label buckets (multi-valued, one count per value); artist buckets from `primaryArtist` only, skipping "Various Artists" (FR-009); growth series = per-period counts **and** cumulative from `addedAt` (FR-010, clarification). Breakdowns sorted desc; genre/style/label capped to the top ~12 with an `others` remainder `{ label: 'Otros', count, hiddenBuckets }` (FR-011a); decade returned in full.
- `computeValuation(instances, suggestionsByRelease, coveredReleaseIds): CollectionValuation` — per-disc pick of `suggestions[instance.mediaCondition]?.value`; sum of covered; `coveredCount` / `totalCount`; `currency` from the first suggestion seen; `topValuable` = highest N per-disc values; `status`.

**Rationale**: Principle VIII (domain has no SDK knowledge) + Principle I (these are the highest-value unit tests in the feature — every FR-005…FR-011a and FR-014…FR-018 rule is a table-driven test case).

## Decision 7 — Frontend: nav, route, chart, no new deps

**Decisions**:
- **Route** `/app/stats`; **nav label** `Collection stats` (the app UI is English — "My library", "My wishlist"; the spec's "Mi colección en cifras" is the Spanish spec title, used as the page's visible `<h1>` is a copy choice for Phase 2, default to English "Collection stats" / "Collection by the numbers"). Nav entry added to `headerNavLinks.ts` (drives both `HeaderNavIcons` and `HamburgerMenu`); new icon in the `ICONS` map.
- **Gate**: reuse `LibraryLinkRequired` with a new `context: 'stats'`; gate on `ApiError.code === 'discogs_not_linked' | 'discogs_link_invalid'`, same as `WishlistPage`.
- **Growth chart**: hand-rolled inline SVG (bars for per-period, line for cumulative, a real toggle control). No charting library — none is installed and KISS/YAGNI + `dataviz` guidance favor a small bespoke chart. Ships with a visually-hidden `<table>` of the same data and an `aria-label` summary (Principle X). Count-up / bar-grow motion via `motion` with spring easing, gated on `prefers-reduced-motion` (Principle XI).
- **Valuation UI**: `CollectionValuationCard` leads with the total + "estimado sobre X de Y" + a progress indicator; `MostValuableRecords` highlight list; full per-disc breakdown behind a "Ver todos" disclosure/dialog (FR-015, clarification). `ValuationUnavailableNotice` for the seller-settings and outage cases.

**Rationale**: Matches established patterns (`WishlistPage`, `LibraryLinkRequired`, TanStack Query hooks, `Card`/`Button`). Consult `apple-design` / `emil-design-eng` / `animate` before building the chart and the progressive-count transition per Principle XI.

## Decision 8 — E2E hermetic stub

**Decision**: Extend `e2e/helpers/discogsOauthStub.ts` with:
- `GET /marketplace/price_suggestions/:releaseId` — returns a per-condition price map for seeded releases, `404`/empty for one release (to exercise "excluded, counted as X of Y"), and a `403` seller-settings shape for a dedicated "no seller settings" test account.
- Richer `basic_information` in the seeded collection folder responses (`year`, `labels`, `artists`, `genres`, `styles`) so Block 1 renders deterministically.

**Rationale**: Consistent with feature 060's stub extension for `/wants`; keeps e2e hermetic (constitution Technology Stack — Discogs outages handled, tests never hit real Discogs).

## Open items resolved into Phase 1

| Item | Resolution |
|------|------------|
| Currency (FR-019) | Read from `price_suggestions` response `currency`; no FX. |
| Valuation trigger (FR-020) | Auto-start on mount; chunked loop. |
| Missing `mediaCondition` (FR-018) | `computeValuation` counts it as non-covered; no default grade. |
| Cache TTL (FR-022) | 7 days, negative results cached too. |
| Large collections (FR-023a) | Unbounded chunked loop; cursor over cached ordering. |
| Seller settings requirement | New `SellerSettingsRequiredError` → tailored notice; **recommend spec update**. |
| Nav label / page title language | Default English nav ("Collection stats"); page `<h1>` copy finalized in Phase 2. |
