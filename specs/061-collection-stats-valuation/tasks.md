---
description: "Task list for Mi colección en cifras — Collection Stats & Estimated Market Value"
---

# Tasks: Mi colección en cifras — Collection Stats & Estimated Market Value

**Input**: Design documents from `/specs/061-collection-stats-valuation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE). Every implementation task is preceded by a failing test task.

**Organization**: Grouped by user story. **US1 alone is a shippable MVP** (statistics, zero external calls). US2 adds the valuation; US3 hardens it for large collections.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task in the same phase → parallelizable
- **[Story]**: US1–US3 (Setup / Foundational / Polish carry no story label; `[SHARED]` marks a foundational task that serves multiple stories)

## Path Conventions (from plan.md — web app)

- Backend: `backend/src/{domain,application,ports,adapters}/<slice>/`, tests `backend/tests/{unit,contract,integration}/<slice>/`
- Frontend: `frontend/src/{pages,components,services,queries}/`, tests `frontend/tests/unit/`
- E2E: `e2e/tests/`, helpers `e2e/helpers/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Slice scaffolding. No behavior.

- [X] T001 Create backend slice directories `backend/src/domain/collectionStats/`, `backend/src/application/collectionStats/`, `backend/src/adapters/collectionStats/` and test directories `backend/tests/unit/collectionStats/{domain,application}/`, `backend/tests/contract/collectionStats/`, `backend/tests/integration/collectionStats/` (add `.gitkeep` where empty)
- [X] T002 Confirm no new dependencies or env vars are needed — cross-check [plan.md](plan.md) Technical Context against `backend/package.json` and `frontend/package.json`; record the confirmation in the PR description (expected: reuses axios/zod/express/ioredis/jest/supertest and react/@tanstack/react-query/react-router-dom/tailwindcss/motion/vitest; reuses `DISCOGS_CONSUMER_KEY`/`_SECRET`, `DISCOGS_USER_AGENT`, `DISCOGS_OAUTH_BASE_URL`; growth chart is inline SVG, no chart lib)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain types, the Discogs marketplace client, the collection-sync facet mapping + persistence, route/query scaffolding, gate/nav wiring, and the e2e stub. Every user story depends on these.

**⚠️ CRITICAL**: No user story work begins until Phase 2 is complete.

### Domain types + errors + port

- [X] T003 [P] Define `CollectionStatistics`, `StatBreakdown`, `StatBucket`, `ArtistCount`, `GrowthSeries`, `GrowthPoint`, `CollectionValuation`, `PerDiscValue`, `ValuationStatus` types in `backend/src/domain/collectionStats/types.ts` per [data-model.md](data-model.md) §3–§5
- [X] T004 [P] Define `backend/src/domain/collectionStats/statsErrors.ts` — re-export `DiscogsNotLinkedError`; add `SellerSettingsRequiredError` (domain error, no HTTP knowledge; mirrors the `DiscogsError` hierarchy pattern)
- [X] T005 [P] Declare `DiscogsMarketplacePort` interface (`getPriceSuggestions(connection, releaseId): Promise<PriceSuggestions>`) plus `ConditionPrice` / `PriceSuggestions` types in `backend/src/ports/discogsOauth/discogsMarketplacePort.ts` per [contracts/discogs-marketplace-client.md](contracts/discogs-marketplace-client.md)

### Collection adapter — map the `basic_information` facets (test-first)

- [X] T006 [P] [SHARED] Extend the `CollectionInstance` interface in `backend/src/domain/discogsOauth/collectionTypes.ts` with `year: number | null`, `labelNames: string[]`, `artistNames: string[]`, `genres: string[]`, `styles: string[]` per [data-model.md](data-model.md) §2
- [X] T007 [SHARED] Add/extend contract tests for `discogsCollectionAdapter.mapInstance` in `backend/tests/contract/discogsOauth/collectionClient.contract.test.ts` — `basic_information` with `year`/`labels`/`artists`/`genres`/`styles` is mapped onto `CollectionInstance`; `year: 0` → `null`; missing `genres`/`styles` → `[]`; artist name disambiguation suffix `" (2)"` trimmed; `"Various"` preserved — MUST FAIL
- [X] T008 [SHARED] Update `RawInstance.basic_information` typing and `mapInstance` in `backend/src/adapters/discogsOauth/discogsCollectionAdapter.ts` to read `year`, `labels[].name` (deduped), `artists[].name` (suffix-trimmed), `genres`, `styles`; tests from T007 pass; run the existing collection/library contract + integration suites to prove no regression

### Discogs marketplace adapter (test-first)

- [X] T009 [SHARED] Write contract tests for `discogsMarketplaceAdapter` in `backend/tests/contract/discogsOauth/marketplaceClient.contract.test.ts` covering [contracts/discogs-marketplace-client.md](contracts/discogs-marketplace-client.md): 200 per-grade map returned as-is; `200 {}` and `404` → `null`; `403` → `SellerSettingsRequiredError`; `401` → `DiscogsAuthError`; `429` after `MAX_ATTEMPTS` → `DiscogsRateLimitError`; `5xx`/network/circuit-open → `DiscogsUnavailableError`; GET is retry-eligible; `recordRateLimitHeaders` + `recordSuccess` on success; `acquireSlot` called per attempt — MUST FAIL
- [X] T010 [SHARED] Implement `discogsMarketplaceAdapter` in `backend/src/adapters/discogsOauth/discogsMarketplaceAdapter.ts` — reuse the `createClient(connection)` resilience structure from `discogsCollectionAdapter.ts` (breaker → OAuth header → `acquireSlot()` → retry/backoff → header recording → status mapping per T009); `getPriceSuggestions` wraps the call in `cacheAdapter.withCache('discogs:pricesuggest:{uid}:{releaseId}', 7*24*3600, fetcher)` and negative-caches `null`; export `discogsMarketplaceAdapter: DiscogsMarketplacePort`. Tests from T009 pass

### Library sync — persist collection facets (test-first)

- [X] T011 [P] [SHARED] Add `year?: number`, `label?: string[]`, `primaryArtist?: string` to `LibraryEntry` in `backend/src/domain/library/types.ts` (additive, backfilled — document alongside the existing `genre`/`style`/`format` note)
- [X] T012 [SHARED] Extend `LibraryRepositoryPort` in `backend/src/ports/library/libraryRepositoryPort.ts` with `persistCollectionFacets(uid, entryId, { year, label, primaryArtist })` and (if not already present) an `addedAt` reconcile path; add fake-repo support in `backend/tests/helpers/`
- [X] T013 [SHARED] Write unit tests for the `syncLibrary` facet write-back in `backend/tests/unit/library/syncLibrary.facets.test.ts` — on each managed/created entry, `year`/`label`/`primaryArtist` are persisted from the instance `basic_information`; `addedAt` is reconciled to `new Date(instance.dateAdded)` when it differs; a facet-less instance leaves prior values untouched — MUST FAIL
- [X] T014 [SHARED] Implement the write-back in `backend/src/application/library/syncLibrary.ts` (`reconcileMatchedEntry` + the create branch call `repository.persistCollectionFacets` and reconcile `addedAt`); implement `persistCollectionFacets` in `backend/src/adapters/library/firestoreLibraryRepository.ts`. Tests from T013 pass; existing `syncLibrary` tests still green

### Route wiring + frontend scaffolding + gate/nav

- [X] T015 [SHARED] Create `collectionStatsRouter` skeleton in `backend/src/adapters/collectionStats/collectionStatsRoutes.ts` (Express Router, `standardRateLimit` via `createRateLimitStore()`, `requireAuth`, composition-root block wiring the use cases, stub handlers returning 501, error mapping via the shared `respondCollectionError` from `backend/src/adapters/discogs/respondCollectionError.ts` plus a `seller_settings_required` → 422 branch) and mount it in `backend/src/app.ts` as `app.use('/api/collection-stats', collectionStatsRouter)`
- [X] T016 [P] [SHARED] Create `frontend/src/services/collectionStatsApi.ts` with `getStatistics(refresh?)` and `getValuationChunk(cursor, refresh?)` typed to [contracts/collection-stats-api.md](contracts/collection-stats-api.md), using `authorizedFetch` (mirror `libraryApi.ts`), and DTO types mirroring [data-model.md](data-model.md) §8
- [X] T017 [P] [SHARED] Create `frontend/src/queries/collectionStatsQueries.ts` with `collectionStatsKeys`, `useCollectionStatistics()` (`useQuery`, `retry:false`) and a `useProgressiveValuation()` stub (loop wiring added in US2)
- [X] T018 [P] [SHARED] Add `context: 'stats'` copy to `frontend/src/components/LibraryLinkRequired.tsx` ("Your collection stats are built from your Discogs collection. Link your accounts from your profile to start using it." + the matching `relink` copy)
- [X] T019 [SHARED] Add the nav entry: `{ key: 'stats', label: 'Collection stats', to: '/app/stats' }` in `frontend/src/components/headerNavLinks.ts`; add `stats:` to the `ICONS` map in `frontend/src/components/HeaderNavIcons.tsx` with a new bar-chart SVG icon (`aria` handled by the existing `Link aria-label`); update `frontend/tests/unit/HamburgerMenu.test.tsx` expectation
- [X] T020 [SHARED] Register the route in `frontend/src/App.tsx` — `<Route path="/app/stats" element={<AuthenticatedLayout><CollectionStatsPage /></AuthenticatedLayout>} />` (page created in US1; a temporary placeholder import is acceptable until T028)

### E2E stub

- [X] T021 [SHARED] Extend `e2e/helpers/discogsOauthStub.ts` — enrich seeded collection-folder responses with `basic_information.{year,labels,artists,genres,styles}`; add `GET /marketplace/price_suggestions/:releaseId` returning a deterministic EUR per-grade map for seeded releases, `404` for one designated release, and `403` seller-settings body for a designated "no-seller-settings" test token; add `/__stub` seed/reset support for price data and a seller-settings flag

**Checkpoint**: `/api/collection-stats/*` mounted (stubbed), Discogs marketplace + enriched collection reachable via the stub, nav shows "Collection stats", frontend can call the API. User stories can now proceed.

---

## Phase 3: User Story 1 — See my collection as statistics (Priority: P1) 🎯 MVP

**Goal**: A linked user with a loaded library opens "Collection stats" and sees total records + breakdowns by decade / genre / style / label, the most-present artist (+ top list, no "Various Artists"), and a growth-over-time chart (per-period ⇄ cumulative) built entirely from persisted collection data — zero new Discogs requests. Unlinked → link-required gate only. Empty collection → empty state.

**Independent Test**: Seed the stub collection with a spread of `basic_information` → open `/app/stats` → all six breakdowns render, ordered by count, with the top-N + "Otros (N)" behavior; a discogs.com-added record lands in the right growth month. Unlink → gate only. Empty → empty state. Backend logs show no catalog/marketplace call for `/statistics`.

### Tests for User Story 1 (write first, MUST FAIL)

- [X] T022 [P] [US1] Unit tests for `aggregateStatistics` in `backend/tests/unit/collectionStats/domain/aggregateStatistics.test.ts` — table-driven: total count; decade buckets + `year: undefined` → "Año desconocido" (still in total); genre/style/label multi-valued (one count per value, sum may exceed total); `primaryArtist`-only artist counting; `/^various(\s+artists)?$/i` excluded; growth `added` per month + continuous `cumulative` with zero-fill months; desc sort; top-12 + `others {count, hiddenBuckets}`; decade never collapsed; empty input → zeros + `mostPresentArtist: null`
- [X] T023 [P] [US1] Unit tests for `getCollectionStatistics` use case in `backend/tests/unit/collectionStats/application/getCollectionStatistics.test.ts` — fake ports: unlinked → `DiscogsNotLinkedError`; calls `syncLibrary` (honors marker; `refresh` forces); reads all entries via the repo; returns `aggregateStatistics(entries)`; makes zero calls to any catalog/marketplace port
- [X] T024 [P] [US1] Integration test for `GET /api/collection-stats/statistics` in `backend/tests/integration/collectionStats/statistics.integration.test.ts` (`supertest`) — 200 shape per [contracts/collection-stats-api.md](contracts/collection-stats-api.md); 409 `discogs_not_linked` unlinked; 401 `discogs_link_invalid` on revoked; `refresh=true` triggers a sync; empty collection → 200 with zeros
- [X] T025 [P] [US1] RTL tests in `frontend/tests/unit/CollectionStatsPage.stats.test.tsx` — gate renders `LibraryLinkRequired` (`context:'stats'`) on `discogs_not_linked`/`discogs_link_invalid` with no stats; populated → totals + four `StatBreakdownList`s + `TopArtistsList` + `CollectionGrowthChart`; "Otros (N)" is a real button that expands the hidden buckets; empty collection → empty state
- [X] T026 [P] [US1] RTL test for `CollectionGrowthChart` in `frontend/tests/unit/CollectionGrowthChart.test.tsx` — renders an SVG + a visually-hidden `<table>` with one row per period (`added`, `cumulative`); the per-period ⇄ cumulative control is keyboard-operable and toggles the rendered series; `aria-label` summary present; asserts no `color`-only encoding
- [X] T027 [P] [US1] E2E `e2e/tests/collection-stats-statistics.spec.ts` — nav entry present at library/wishlist level; unlinked gate; seeded collection → breakdowns + growth chart data table; a stub record with an early `date_added` appears in the correct growth month (FR-010). RESOLVED at T060: `syncLibrary.persistCollectionFacets` now persists `genre`/`style` from `basic_information` (guarded against overwriting feature-038 enrichment), so the FR-007 genre/style case (T027-7) is a plain passing test — the `test.fail()` marker was removed. T027-6 was also rescoped: it now aborts `/valuation` at the network layer to prove Block 1 (statistics) needs zero marketplace calls independently of Block 2's auto-starting valuation.

### Implementation for User Story 1

- [X] T028 [P] [US1] Implement pure `aggregateStatistics(entries: LibraryEntry[]): CollectionStatistics` in `backend/src/domain/collectionStats/aggregateStatistics.ts` (decade/genre/style/label/artist/growth per [data-model.md](data-model.md) §3; `TOP_N = 12`). T022 passes
- [X] T029 [US1] Implement `createGetCollectionStatisticsUseCase({ repository, syncLibrary, discogsConnection })` in `backend/src/application/collectionStats/getCollectionStatistics.ts` — `requireConnection` → `syncLibrary(uid, {force: refresh})` → `repository.listAllEntries(uid)` → `aggregateStatistics`. T023 passes
- [X] T030 [US1] Wire `GET /statistics` in `backend/src/adapters/collectionStats/collectionStatsRoutes.ts` — parse `refresh`, call the use case, map domain errors via `respondCollectionError`, structured `stats_computed` log with record count. T024 passes
- [X] T031 [P] [US1] Create `frontend/src/pages/CollectionStatsPage.tsx` — gate handling (mirror `WishlistPage`), page `<h1>` ("Mi colección en cifras" / "Collection by the numbers" — finalize copy here), renders the Block 1 section from `useCollectionStatistics()`, skeleton + empty state; leaves a slot for the Block 2 section (filled in US2)
- [X] T032 [P] [US1] Create `frontend/src/components/stats/CollectionTotals.tsx` (total records + headline figures) and `frontend/src/components/stats/StatBreakdownList.tsx` (reusable ranked rows with a length-encoded bar + count text, `others` as an expandable `<button>`/`<details>` — WCAG: never color-only, accessible name, visible focus)
- [X] T033 [P] [US1] Create `frontend/src/components/stats/TopArtistsList.tsx` (most-present artist highlighted + ranked list)
- [X] T034 [US1] Create `frontend/src/components/stats/CollectionGrowthChart.tsx` — inline SVG (bars = per-period `added`, line = `cumulative`), a real toggle control, visually-hidden `<table>` alt-representation, `aria-label` summary; count-up / bar-grow motion via `motion` with spring easing, gated on `prefers-reduced-motion`. Consult the `apple-design` / `emil-design-eng` / `animate` skills first. T026 passes
- [X] T035 [US1] Assemble Block 1 in `CollectionStatsPage.tsx` (totals + 4 breakdowns + top artists + growth chart) and finalize the loading/empty states. T025, T027 pass

**Checkpoint**: US1 fully functional and independently shippable — the statistics section works with only a linked account, no marketplace dependency.

---

## Phase 4: User Story 2 — Know what my collection is worth (Priority: P2)

**Goal**: On opening the section the valuation starts automatically and fills in progressively: a per-condition-adjusted estimate per disc, a total, "estimado sobre X de Y discos", a "most valuable records" highlight list, and a full per-disc breakdown on demand — all in the user's Discogs currency. Missing market data / missing condition → excluded and counted. Statistics stay usable throughout.

**Independent Test**: Seed a collection with known conditions + prices incl. one release with no market data and one copy with no condition → open `/app/stats` → valuation runs without a button, total = Σ covered, label reads "sobre 42 de 50", currency consistent everywhere, "Ver todos" opens the full breakdown, statistics remain interactive.

### Tests for User Story 2 (write first, MUST FAIL)

- [X] T036 [P] [US2] Unit tests for `computeValuation` in `backend/tests/unit/collectionStats/domain/computeValuation.test.ts` — per-disc `suggestions[mediaCondition]?.value`; `mediaCondition === null` → `no_condition`, excluded, `uncovered.noCondition++`; release with no data or grade absent → `no_market_data`, excluded; `estimatedTotal` = Σ covered; `coveredCount`/`totalCount`; `currency` from first suggestion (mismatch keeps first + warns); `topValuable` desc ≤ 10; multiple instances of one release each valued; `status` transitions
- [X] T037 [P] [US2] Unit tests for `getCollectionValuation` (chunked) in `backend/tests/unit/collectionStats/application/getCollectionValuation.test.ts` — fake ports: `cursor=0` resolves + caches the instance list; prices `[cursor, cursor+BATCH_SIZE)` via `mapWithConcurrency` limit ≈ 4; folds over **all** cached suggestions; returns `status:'partial'` + `nextCursor` until exhausted then `status:'complete'` + `perDisc`; a warm 7-day cache ⇒ zero `getPriceSuggestions` upstream calls (`fromCacheThisBatch == pricedThisBatch`); `SellerSettingsRequiredError` from the port → propagated; `DiscogsUnavailableError` before any disc priced → `status:'unavailable'` (no throw)
- [X] T038 [P] [US2] Integration test for `GET /api/collection-stats/valuation` in `backend/tests/integration/collectionStats/valuation.integration.test.ts` — cursor loop reaches `complete` with `perDisc`; `422 seller_settings_required` for the no-seller-settings account (and `/statistics` still 200 for that account); coverage arithmetic `covered + noMarketData + noCondition == totalCount`; Discogs 503 before pricing → 200 `status:'unavailable'`, not a 5xx
- [X] T039 [P] [US2] RTL tests in `frontend/tests/unit/CollectionStatsPage.valuation.test.tsx` — valuation auto-starts on mount (no button); `aria-live` progress announced; running total + "estimado sobre X de Y" update across simulated chunks; single currency across total + highlights + breakdown; `MostValuableRecords` renders; "Ver todos" opens `ValuationBreakdownDialog` with all per-disc rows; statistics block stays interactive while pending; `seller_settings_required` → `ValuationUnavailableNotice`, Block 1 unaffected
- [X] T040 [P] [US2] E2E `e2e/tests/collection-stats-valuation.spec.ts` — progressive valuation reaches a stable total; coverage label with the data-less release; currency consistency; seller-settings notice path

### Implementation for User Story 2

- [X] T041 [P] [US2] Implement pure `computeValuation(instances, suggestionsByRelease, coveredReleaseIds): CollectionValuation` in `backend/src/domain/collectionStats/computeValuation.ts` per [data-model.md](data-model.md) §4. T036 passes
- [X] T042 [US2] Implement `createGetCollectionValuationUseCase({ discogsCollection, discogsMarketplace, discogsConnection, cache })` in `backend/src/application/collectionStats/getCollectionValuation.ts` — `requireConnection`; `cursor=0` → `discogsCollection.listAllInstances` cached at `discogs:statsinstances:{uid}` (~5 min); slice `[cursor, cursor+BATCH_SIZE)`, `mapWithConcurrency` (limit 4) over `discogsMarketplace.getPriceSuggestions`; fold via `computeValuation` over every cached suggestion; return `{ valuation, status, nextCursor?, pricedThisBatch, fromCacheThisBatch, perDisc? }`; `BATCH_SIZE = 25`. T037 passes
- [X] T043 [US2] Wire `GET /valuation` in `backend/src/adapters/collectionStats/collectionStatsRoutes.ts` — parse `cursor`/`refresh`; call the use case; `SellerSettingsRequiredError` → `422 { error:'seller_settings_required' }`; `DiscogsUnavailable`/`RateLimit` → `200` with `status` set (never 5xx); structured `valuation_batch` log (priced/cached/covered/failed). T038 passes
- [X] T044 [US2] Implement `useProgressiveValuation()` in `frontend/src/queries/collectionStatsQueries.ts` — fetch `cursor=0` on mount; while `status === 'partial'` re-fetch with `nextCursor`; expose running `valuation`, a `progress` fraction, and a `notice` (`'seller_settings' | 'unavailable' | null`); short client backoff + retry-same-cursor on a transient `unavailable` mid-run
- [X] T045 [P] [US2] Create `frontend/src/components/valuation/CollectionValuationCard.tsx` (total + "estimado sobre X de Y" + `aria-live` progress; leads the block) and `frontend/src/components/valuation/MostValuableRecords.tsx` (highlight list)
- [X] T046 [P] [US2] Create `frontend/src/components/valuation/ValuationBreakdownDialog.tsx` (full per-disc list behind a "Ver todos" disclosure — reuse `ui/Modal`; covered + uncovered rows with reason) and `frontend/src/components/valuation/ValuationUnavailableNotice.tsx` (seller-settings and outage copy, non-blocking, with retry)
- [X] T047 [US2] Fill the Block 2 slot in `CollectionStatsPage.tsx` with the valuation section driven by `useProgressiveValuation()`; ensure Block 1 renders and stays interactive independent of Block 2 state (FR-012, FR-020). T039, T040 pass

**Checkpoint**: US1 + US2 both work independently; valuation is correct on small/medium collections.

---

## Phase 5: User Story 3 — Valuation stays fast and safe at collection scale (Priority: P3)

**Goal**: For large collections the valuation paces its calls (no breaker trip), shows an explicit long-running state on first run, keeps partial results across navigation, lets failed discs be retried, and re-opening within the cache window issues zero new price calls.

**Independent Test**: 100+ seeded releases → valuation completes without tripping the breaker/rate limit; screen stays responsive; re-open within 7 days → zero new `price_suggestions` calls in the backend log; a chunk with transient failures reports those discs as retryable and the rest of the total still shows.

### Tests for User Story 3 (write first, MUST FAIL)

- [X] T048 [P] [US3] Unit test in `backend/tests/unit/collectionStats/application/getCollectionValuation.scale.test.ts` — a 250-instance fake: the loop pages via `nextCursor` with no cap (every instance attempted); per-chunk concurrency never exceeds the limit; a chunk where some `getPriceSuggestions` throw `DiscogsUnavailableError` marks those releases `no_market_data`-pending (retryable), keeps the rest, and the loop continues; a second full pass with a warm cache issues zero upstream calls
- [X] T049 [P] [US3] Integration test `backend/tests/integration/collectionStats/valuation.scale.integration.test.ts` — with the stub in a paced/slow mode for `price_suggestions`, a full cursor loop over 100+ releases returns `complete`, the shared circuit breaker never opens, and a repeat loop reports `fromCacheThisBatch == pricedThisBatch` on every chunk (SC-005, SC-006)
- [X] T050 [P] [US3] RTL test `frontend/tests/unit/CollectionStatsPage.scale.test.tsx` — first-run large collection shows the long-running "this may take a while — come back later" state while `progress < 1`; navigating away and back resumes from the running total without restarting from zero; a `notice` for partially-failed discs offers a retry that re-drives the loop
- [X] T051 [P] [US3] E2E `e2e/tests/collection-stats-scale.spec.ts` — 100+ seeded releases: valuation reaches a stable total, no error surfaced, re-open shows the total immediately with no new stub `price_suggestions` hits

### Implementation for User Story 3

- [X] T052 [US3] Harden `getCollectionValuation.ts` — per-release transient failures within a chunk are recorded as retryable (not fatal, not permanently `no_market_data`); expose a `retryable: number` count and accept a `retry=failed` mode that re-prices only the still-uncached failed releases; confirm the `discogs:statsinstances:{uid}` cache keeps the cursor ordering stable across a navigation gap. T048, T049 pass
- [X] T053 [US3] Add the long-running UX to `CollectionValuationCard.tsx` / `useProgressiveValuation()` — after the first chunk, if `status === 'partial'` and the estimated remaining work is large, surface the explicit "come back later" state (still non-blocking); wire the failed-disc retry action to the `retry=failed` path. T050, T051 pass
- [X] T054 [US3] Verify the shared throttle/breaker are actually shared — add an assertion/log check that `discogsMarketplaceAdapter` requests pass through `acquireSlot()` and `shouldShortCircuit()` (the same singletons as catalog/collection), documented in the PR (FR-021, SC-006)

**Checkpoint**: All three stories independently functional; the valuation is safe for real-world collection sizes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, design, docs, and end-to-end validation across both blocks.

- [X] T055 [P] WCAG 2.1 AA audit of `/app/stats` — keyboard path through breakdowns / "Otros" / chart toggle / "Ver todos" dialog; visible focus; 4.5:1 contrast on all new tokens; chart alt-`<table>` and `aria-label`; `aria-live` politeness on the valuation progress; reduced-motion disables count-up/bar-grow; no color-only state. Fix findings (Principle X). DONE: fixed dark-mode <3:1 contrast on all primary-coloured data marks (growth chart bars/line/dots, breakdown bars, valuation progress bar) via `dark:*-primary-text`; de-stormed the valuation `aria-live` region (announces run start + completion only, not per-chunk counts); fixed heading skip (`ValuationUnavailableNotice` `<p>` → `<h3>`). Audited PASS: keyboard path + visible focus, chart `role="img"` + summary + sr-only `<table>` + per-bar `<title>`, reduced-motion code path, no colour-only state, 44px touch targets.
- [X] T056 [P] `apple-design` / `emil-design-eng` review of the Block 1/Block 2 layout, the growth chart, and the progressive-count transition; align spacing/typography with the project's tokens; confirm spring-eased, interruptible motion (Principle XI). DONE: unified Block 1/Block 2 section rhythm (both `gap-6` inside `main`'s `gap-8`); replaced the only ad-hoc pixel value (`text-[11px]` → `text-xs`); "Ver todos" raw `<button>` → `ui/Button variant="secondary"` (consistency + press feedback); growth toggle inactive shades + `pressable` aligned to `ui/ViewModeToggle`; valuation total transition changed from fade+rise to a plain opacity cross-fade (functional content must not shift for style — `animate`/`emil-design-eng`); valuation card label "Estimated market value" → "Total estimated value" to de-dupe the section `<h2>`. FLAGGED (not changed): growth-chart series toggle keeps the `aria-pressed` two-button pattern rather than the full `ViewModeToggle` radiogroup + measured sliding-pill (valid distinct pattern, already tested, pill adds measurement complexity/risk for marginal gain); growth bars animate SVG geometry rather than a GPU transform (bounded bar count, one-time mount, spring-eased, reduced-motion gated — acceptable tradeoff).
- [X] T057 [P] Add end-user documentation for the section in `docs/` (what the two blocks show, why some discs are excluded from the value, the seller-settings requirement) — hand to the docs-agent
- [X] T058 [P] Update `CHANGELOG.md` / frontend `CHANGELOG.md` — NO manual edit: per `CHANGELOG.md`'s own preamble, entries + the version bump are generated by CI from the Conventional Commit on merge to `main` (frontend `CHANGELOG.md` is frozen). Action taken: the feature's commit/PR MUST use `feat(061): "Mi colección en cifras" — collection statistics and estimated market value` so CI emits a MINOR (additive) entry. Manually editing either file would collide with the CI-generated entry.
- [X] T059 Run the full [quickstart.md](quickstart.md) validation checklist end-to-end against a seeded local environment; record results in the PR — Backend checks / API smoke / Frontend-UX 1–10 / E2E walked: all PASS or covered-by-e2e; automatable items green, running-app-only items deferred to reviewer (see validation report)
- [X] T060 Full gate: backend `lint` (only the 5 pre-existing `no-require-imports` errors in `rateLimitStore.test.ts`) + `tsc --noEmit` clean + `npm test` 83 suites / 696 tests green (emulator-backed); frontend `oxlint` (pre-existing warnings only) + `tsc -b` clean + `vitest` 95 files / 741 tests green; full `e2e` suite 363 passed / 2 pre-existing skips / 0 failures; `plan.md` Constitution Check re-walked — all 11 rows still PASS. 2 stale feature-061 e2e assertions in `collection-stats-statistics.spec.ts` fixed (test-only); 1 backend integration test added for the `retry=failed` route path.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies.
- **Phase 2 (Foundational)** — depends on Phase 1. **Blocks all user stories.** Within Phase 2: T003–T006, T011 are `[P]`; T007→T008; T009→T010; T012→T013→T014; T015 after T004/T005; T016–T020 `[P]` after T015; T021 independent.
- **Phase 3 (US1)** — depends on Phase 2 (needs T006/T008 facets, T011/T014 persistence, T015 route skeleton, T016–T020 scaffolding, T021 stub).
- **Phase 4 (US2)** — depends on Phase 2 (needs T009/T010 marketplace adapter, T015 route, T021 stub). Independent of US1 at the code level; shares only `CollectionStatsPage.tsx` (T031 creates it, T047 fills a distinct slot).
- **Phase 5 (US3)** — depends on Phase 4 (hardens `getCollectionValuation` + the valuation UI).
- **Phase 6 (Polish)** — depends on the desired stories being complete.

### User story independence

- **US1** is a complete MVP with only a linked account — no marketplace dependency.
- **US2** delivers standalone value on top of the shared foundation; it does not import US1 code.
- **US3** is a refinement of US2 and is the only story with a hard dependency on another.

### Within each story

- Test tasks (T022–T027, T036–T040, T048–T051) are written first and MUST fail before the matching implementation.
- Domain (pure) → application (use case) → adapter (route) → frontend page/components.

---

## Parallel Opportunities

**Phase 2 kickoff (after T001–T002):**

```bash
Task: "T003 domain types in backend/src/domain/collectionStats/types.ts"
Task: "T004 statsErrors.ts"
Task: "T005 DiscogsMarketplacePort"
Task: "T006 extend CollectionInstance"
Task: "T011 LibraryEntry facet fields"
```

**US1 tests (after Phase 2):**

```bash
Task: "T022 aggregateStatistics unit tests"
Task: "T023 getCollectionStatistics use-case tests"
Task: "T024 GET /statistics integration test"
Task: "T025 CollectionStatsPage RTL"
Task: "T026 CollectionGrowthChart RTL"
Task: "T027 statistics e2e"
```

**US1 + US2 in parallel (different developers, after Phase 2):** Developer A → T022–T035 (US1); Developer B → T036–T047 (US2). Only `CollectionStatsPage.tsx` is touched by both — T031 (create, US1) lands before T047 (fill Block 2 slot, US2).

**Polish:** T055, T056, T057, T058 all `[P]`.

---

## Implementation Strategy

### MVP (US1 only)

1. Phase 1 → Phase 2 → Phase 3.
2. **STOP and validate**: `/app/stats` shows the statistics section for a linked user, zero Discogs catalog/marketplace calls, unlinked gate works.
3. Ship — the valuation block simply isn't present yet.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → test independently → ship (statistics MVP).
3. US2 → test independently → ship (valuation, small/medium collections).
4. US3 → test independently → ship (large-collection hardening).

---

## Notes

- `[P]` = different files, no dependency on an incomplete task in the same phase.
- `[Story]` / `[SHARED]` labels give per-story traceability.
- Verify every test fails before implementing it (Principle I).
- Commit after each task or logical group; keep the branch on `061-collection-stats-valuation`.
- Do **not** add a charting dependency — the growth chart is bespoke inline SVG.
- Watch the shared `CollectionStatsPage.tsx` and `collectionStatsQueries.ts` for US1/US2 merge order.
- Backend Jest + Firebase-emulator runs are slow — do not block on a full run mid-task (see the team memory note); run focused suites and let CI do the full pass.
