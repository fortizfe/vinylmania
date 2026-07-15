---

description: "Task list template for feature implementation"
---

# Tasks: Discogs Catalog Domain Migrated to Hexagonal Architecture

**Input**: Design documents from `/specs/047-discogs-catalog-hexagonal-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE) applies to
this project. See "Migration Strategy" below for how Test-First applies to a pure structural
refactor of already-covered production code.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story. All paths are relative to the repository root; `backend/` is implied for
every `src/`/`tests/` path below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Migration Strategy (read before starting)

This feature relocates already-tested, already-live production code, following the exact
copy-then-cutover pattern the library domain migration (046) validated. User Stories 1 and 2 build
their new `ports/discogsCatalog/`, `adapters/discogsCatalog/`, `application/discogsCatalog/` files
**additively, alongside the untouched originals** — `backend/src/discogs/discogsClient.ts` and
`backend/src/routes/discogs.ts` keep serving all traffic, completely unmodified, until Story 3's
cutover. This keeps Stories 1 and 2 zero-risk (the running app never changes behavior while they're
in progress) and independently mergeable/testable.

Three of the thirteen existing catalog test files span more than one story because of
research.md Decision 2 (rating enrichment and the search cache-wrap move to the application layer,
not the adapter): `tests/contract/discogsClient.contract.test.ts`,
`tests/integration/discogsCaching.test.ts`, and `tests/integration/discogsRateLimitSmoothing.test.ts`
each have some tests that exercise the catalog **port's raw** methods (fixed in Phase 3/US1) and
some tests that exercise **rating-enrichment/search-caching** behavior (fixed in Phase 4/US2, once
`searchCatalogWithRatings` exists). Each of these three files is *expected* to still show red on
its enrichment-related tests at the end of Phase 3 — that is the genuine Red-Green-Refactor signal
Phase 4 exists to turn green, not a mistake to fix early. The four purely HTTP-level test files
(`discogsRelease.contract.test.ts`, `discogsMaster.contract.test.ts`, `discogsSearch.contract.test.ts`,
`discogsCacheOutage.test.ts`) don't reference any internal module path at all — they only call
`createApp()` — so, following 046's precedent, they are relocated in Phase 5 (US3), the one phase
that actually swaps which router serves `/api/discogs` traffic; relocating them earlier would add a
duplicate-coverage window with no verification benefit.

Because `discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`, and the Redis client
underneath `CachePort` are **shared, unmoved, process-global modules** (research.md Decision 1),
tests that call the new adapter's functions directly during the additive window (Phases 3-4) observe
and affect the exact same rate-limiter/circuit-breaker/cache state as the still-untouched
`routes/discogs.ts` — there is no split-brain risk from having two call paths into the same
underlying resilience/cache singletons.

## Phase 1: Setup

**Purpose**: Establish a pre-migration baseline to measure "no regression" against.

- [X] T001 Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/discogs"`
  (matched against `discogsMapper.test.ts`, `discogsRateLimiter.test.ts`,
  `discogsCircuitBreaker.test.ts`, `discogsRetry.test.ts`, `discogsClient.contract.test.ts`,
  `discogsRelease.contract.test.ts`, `discogsSearch.contract.test.ts`, `discogsMaster.contract.test.ts`,
  `discogsCaching.test.ts`, `discogsCacheOutage.test.ts`, `discogsRateLimitSmoothing.test.ts`,
  `discogsRetryResilience.test.ts`, `discogsClient.live.test.ts`) and confirm all 13 files named in
  the parent user story's "Prueba independiente" pass today. This is the baseline spec.md
  FR-006/SC-001 must not regress.
- [X] T002 Run
  `grep -rn "jest.mock(" backend/tests/unit/discogsMapper.test.ts backend/tests/contract/discogsClient.contract.test.ts backend/tests/integration/discogsClient.live.test.ts backend/tests/integration/discogsRetryResilience.test.ts backend/tests/integration/discogsCaching.test.ts backend/tests/integration/discogsRateLimitSmoothing.test.ts backend/tests/contract/discogsRelease.contract.test.ts backend/tests/contract/discogsMaster.contract.test.ts backend/tests/contract/discogsSearch.contract.test.ts backend/tests/integration/discogsCacheOutage.test.ts`
  and confirm every `jest.mock(...)` call targets a bare package name (e.g. `'ioredis'`), never a
  `discogs`-relative module path — spec.md's Edge Case "How does this migration confirm no existing
  test relies on a `jest.mock()` call keyed to a module's current file path?". Already verified true
  as of this migration's design (only `jest.mock('ioredis', ...)` calls exist); this task makes that
  check explicit and re-runnable rather than an unrecorded, one-time finding. If a path-sensitive mock
  is found, update it in the same task that relocates its file (T009-T014, T021-T024).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Relocate the shared `CachePort` (research.md Decision 3) and the catalog domain's pure
types — the building blocks both User Story 1 and User Story 2 depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/src/ports/cache/cachePort.ts` per `contracts/cache-port.md`: copy
  `has(key)`/`set(key, value, ttlSeconds)` unchanged from `backend/src/ports/library/cachePort.ts`,
  add the new `withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>`
  method (fail-soft; falls back to calling `fetcher()` directly on any cache error or missing
  backend; concurrent calls for the same key are coalesced into one fetch).
- [X] T004 [P] Create `backend/src/adapters/cache/cacheAdapter.ts` per `contracts/cache-port.md`:
  copy the `has`/`set` implementation unchanged from `backend/src/adapters/library/cacheAdapter.ts`
  (still calling `getRedisClient()` from `../../cache/redisClient`, unmoved), add a `withCache`
  implementation that delegates to `withCache` exported from `../../cache/cacheAside` (unmoved).
  Export `cacheAdapter: CachePort` bundling all three methods, same pattern as the original file.
- [X] T005 Update `backend/src/application/library/syncLibrary.ts`'s `CachePort` type import from
  `../../ports/library/cachePort` to `../../ports/cache/cachePort`; update
  `backend/src/adapters/library/libraryRoutes.ts`'s `cacheAdapter` import from `./cacheAdapter` to
  `../cache/cacheAdapter`; update `backend/tests/unit/library/application/syncLibrary.test.ts`'s
  `CachePort` type import the same way. Then delete the now-superseded
  `backend/src/ports/library/cachePort.ts` and `backend/src/adapters/library/cacheAdapter.ts` (no
  duplication window needed — `has`/`set` are byte-for-byte unchanged, so this is a straight
  relocation, not a cutover, per research.md Decision 3).
- [X] T006 Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/library"`
  and confirm every library-domain test still passes — this is the regression gate proving the
  `CachePort` relocation didn't disturb the already-migrated library domain (spec.md SC-005;
  quickstart.md step 3, run early).
- [X] T007 [P] Create `backend/src/domain/discogsCatalog/types.ts` — copy `Release`, `Artist`,
  `MasterRelease`, `MasterReleaseVersion`, `MasterReleaseVersionsPage`, `CatalogSearchResult`,
  `CatalogSearchResponse`, `CommunityRating` unchanged from `backend/src/discogs/types.ts`. Leave
  the original file in place (still imported by `discogs/discogsClient.ts`, `discogs/discogsMapper.ts`,
  `application/library/createLibraryEntry.ts`, `domain/library/types.ts`,
  `application/library/enrichLibraryEntry.ts`) until Phase 5 deletes it.

**Checkpoint**: The shared `CachePort`/`cacheAdapter` live at `ports/cache/`/`adapters/cache/`,
proven by the full library-domain suite; `domain/discogsCatalog/types.ts` exists, ready for the new
port. `backend/src/discogs/discogsClient.ts` and `backend/src/routes/discogs.ts` still exist,
unmodified, still serving production traffic.

---

## Phase 3: User Story 1 - Catalog access isolated behind a port, reusing the shared caching contract (Priority: P1)

**Goal**: Every raw catalog lookup (release, artist, master, master-versions, per-release rating,
raw search) goes through `DiscogsCatalogPort`, implemented by `discogsCatalogAdapter.ts`, preserving
resilience (rate-limit smoothing, circuit breaker, retry, the rating lookup's fail-soft/short-timeout
opt-out) and per-method caching via the now-shared `CachePort` — exactly as `discogsClient.ts` does
today, just relocated.

**Independent Test**: Stub the outbound HTTP calls (`nock`) and the cache backend (`ioredis-mock`)
that the adapter depends on — rather than a real Discogs API call and a real Redis instance — and
confirm release/artist/master/master-versions/rating lookups behave correctly (spec.md US1).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T008 [US1] Define `backend/src/ports/discogsCatalog/discogsCatalogPort.ts` per
  `contracts/discogs-catalog-port.md` (interface only — `getRelease`, `getArtist`,
  `getMasterRelease`, `getMasterReleaseVersions`, `getReleaseRating`, `searchCatalog` returning the
  **raw, unenriched** response, plus the `SearchCatalogOptions` type).
- [X] T009 [P] [US1] Copy `backend/tests/unit/discogsMapper.test.ts` to
  `backend/tests/unit/discogsCatalog/adapters/discogsMapper.test.ts`, updating its import from
  `../../src/discogs/discogsMapper` to `../../../src/adapters/discogsCatalog/discogsMapper`. Run
  the new copy and confirm it fails (module not found). Leave the original file in place, still
  covering `discogs/discogsMapper.ts`, until Phase 5 deletes it.
- [X] T010 [US1] Copy `backend/tests/contract/discogsClient.contract.test.ts` to
  `backend/tests/contract/discogsCatalog/discogsClient.contract.test.ts`, updating its
  `getArtist`/`getDiscogsHttpClient`/`getRelease`/`searchCatalog` import from
  `../../src/discogs/discogsClient` to `../../../src/adapters/discogsCatalog/discogsCatalogAdapter`
  (call sites and assertions unchanged). Run the new copy and confirm it fails (module not found —
  the adapter doesn't exist yet). Leave the original file in place until Phase 5 deletes it. **Note**:
  once T016 lands, this copy's `describe('master result rating enrichment ...')` and
  `describe('search-result rating enrichment concurrency ...')` blocks will still fail (the raw port
  no longer enriches) — that is expected and is fixed by T018 in Phase 4, not here.
- [X] T011 [P] [US1] Copy `backend/tests/integration/discogsClient.live.test.ts` to
  `backend/tests/integration/discogsCatalog/discogsClient.live.test.ts`, updating its
  `getArtist`/`getRelease`/`searchCatalog` import from `../../src/discogs/discogsClient` to
  `../../../src/adapters/discogsCatalog/discogsCatalogAdapter`. Run the new copy (it self-skips
  without `DISCOGS_TOKEN`, so confirm it at least loads/compiles) and leave the original file in
  place until Phase 5 deletes it.
- [X] T012 [P] [US1] Copy `backend/tests/integration/discogsRetryResilience.test.ts` to
  `backend/tests/integration/discogsCatalog/discogsRetryResilience.test.ts`, updating its
  `getMasterRelease`/`getRelease` import from `../../src/discogs/discogsClient` to
  `../../../src/adapters/discogsCatalog/discogsCatalogAdapter`. Its `createApp()`-based HTTP
  assertions keep exercising the still-untouched `routes/discogs.ts` throughout this phase — that's
  fine, since the underlying rate-limiter/circuit-breaker/Redis state this file relies on is shared
  process-global state (Migration Strategy above). Run the new copy and confirm it fails (module not
  found). Leave the original file in place until Phase 5 deletes it.
- [X] T013 [P] [US1] Copy `backend/tests/integration/discogsCaching.test.ts` to
  `backend/tests/integration/discogsCatalog/discogsCaching.test.ts`, updating its `getRelease`
  import from `../../src/discogs/discogsClient` to
  `../../../src/adapters/discogsCatalog/discogsCatalogAdapter`. Leave its `searchCatalog` import
  pointing at the same new adapter path too (needed to compile), but note its
  `'serves a second identical searchCatalog call from cache ...'` test is *expected* to fail after
  T016 lands — raw `searchCatalog` is deliberately uncached at the adapter layer (research.md
  Decision 2) — until T019 fixes it in Phase 4. Run the new copy now and confirm it fails (module
  not found). Leave the original file in place until Phase 5 deletes it.
- [X] T014 [P] [US1] Copy `backend/tests/integration/discogsRateLimitSmoothing.test.ts` to
  `backend/tests/integration/discogsCatalog/discogsRateLimitSmoothing.test.ts`, updating its
  `getDiscogsHttpClient`/`getRelease`/`searchCatalog` import from `../../src/discogs/discogsClient`
  to `../../../src/adapters/discogsCatalog/discogsCatalogAdapter` (its
  `collectionClient`/`discogsOauth` imports are untouched — that domain isn't migrated by this
  feature). Note its `describe('Discogs rate-limit smoothing — User Story 2 (bounded search-rating
  concurrency)')` block is *expected* to fail after T016 lands, for the same reason as T013 — fixed
  by T020 in Phase 4. Run the new copy and confirm it fails (module not found). Leave the original
  file in place until Phase 5 deletes it.

### Implementation for User Story 1

- [X] T015 [US1] Implement `backend/src/adapters/discogsCatalog/discogsMapper.ts` — relocate
  `discogs/discogsMapper.ts` unchanged, updating only its type import to
  `../../domain/discogsCatalog/types`. Run T009 and confirm it now passes.
- [X] T016 [US1] Implement `backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts` —
  implements `DiscogsCatalogPort`. Relocate from `discogs/discogsClient.ts` unchanged: the axios
  client creation/interceptors (`createDiscogsHttpClient`, `getDiscogsHttpClient`,
  `getDiscogsBaseUrl`, the resilience request/response interceptor pair, `CircuitOpenError`,
  `logRateLimit`, `ResilienceRequestState`/`ResilienceConfig`), importing
  `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts`/`discogsErrors.ts` from their
  unmoved `../../discogs/*` location, and types from `../../domain/discogsCatalog/types`. Implement
  `getRelease`, `getArtist`, `getMasterRelease`, `getMasterReleaseVersions`, `getReleaseRating` each
  wrapped in `cacheAdapter.withCache(key, ttlSeconds, fetcher)` (imported from `../cache/cacheAdapter`)
  with the exact same cache keys/TTLs as today (data-model.md's Caching Map);
  `getReleaseRating` keeps its `__skipResilience: true`/2-second-timeout axios option exactly as
  today, without leaking that detail into the port's signature. Implement `searchCatalog` as
  **raw only** — the empty/whitespace-query short-circuit (no HTTP call) stays, but drop the
  `enrichWithRating`/`mapWithConcurrency` fan-out and the `withCache` wrap entirely (both move to
  `application/discogsCatalog/searchCatalogWithRatings.ts` in Phase 4, research.md Decision 2).
  Export every method as a named function (matching `firestoreLibraryRepository.ts`'s pattern, so
  relocated test call sites don't change) plus
  `export const discogsCatalogAdapter: DiscogsCatalogPort = { getRelease, getArtist,
  getMasterRelease, getMasterReleaseVersions, getReleaseRating, searchCatalog }`. Run T010 (all
  describe blocks except the two enrichment ones — those remain red, expected), T011, T012, T013
  (all except its `searchCatalog`-cache test — remains red, expected), T014 (all except its US2
  block — remains red, expected), and confirm they now pass.

**Checkpoint**: `DiscogsCatalogPort` and its adapter exist and are proven against nock/live Discogs
for every raw lookup, with resilience and per-method caching behavior identical to today. Nothing is
wired into production routes yet — `discogs/discogsClient.ts` and `routes/discogs.ts` are unaffected.
Three copied test files (`discogsClient.contract.test.ts`, `discogsCaching.test.ts`,
`discogsRateLimitSmoothing.test.ts`) each have one enrichment-related section still red, by design.

---

## Phase 4: User Story 2 - Search result rating enrichment isolated as an application-level rule (Priority: P1)

**Goal**: `searchCatalogWithRatings` — the per-result community-rating lookup, graceful per-result
degradation, bounded concurrency, and the search response's own cache-wrap — lives as an explicit
application-level rule depending only on `DiscogsCatalogPort`/`CachePort`, matching today's behavior
exactly (research.md Decision 2: this is the only search-related cache-wrap; the port's raw
`searchCatalog` stays uncached).

**Independent Test**: Run the rule against a fake `DiscogsCatalogPort` that returns raw search
results and either succeeds or fails a per-result rating lookup on demand, confirming enrichment,
per-result degradation, and the concurrency bound all behave as today, with no real Discogs API call
(spec.md US2). Depends on Phase 3's port interface (T008) for typing; does not need Phase 3's
adapter implementation to exist to be unit-tested against a fake.

### Tests for User Story 2 ⚠️ (write first / finish first, confirm red before implementation)

- [X] T017 [US2] Write `backend/tests/unit/discogsCatalog/application/searchCatalogWithRatings.test.ts`
  — new test, against a hand-built fake `DiscogsCatalogPort` and fake `CachePort` (the latter can be
  a passthrough that just calls `fetcher()`, since this test isn't about caching mechanics). Cover:
  a release-type result gets its own rating looked up; a master-type result's rating comes from
  `getMasterRelease(...).mainReleaseId` first; a failed/slow per-result lookup degrades that one
  result to no rating without rejecting the whole search; the concurrency bound (5) is never
  exceeded for a page with more eligible results than that. Run it and confirm it fails (module not
  found — the use case doesn't exist yet).
- [X] T018 [US2] Finish `backend/tests/contract/discogsCatalog/discogsClient.contract.test.ts`
  (copied in T010): rewrite its `describe('master result rating enrichment (feature 026, US1)')` and
  `describe('search-result rating enrichment concurrency (feature 040, US2, ...)')` blocks' calls
  from the raw adapter's `searchCatalog(...)` to a `searchCatalogWithRatings` bound to the real
  `discogsCatalogAdapter` + `cacheAdapter` (constructed once at the top of the file, same pattern as
  `createEnrichLibraryEntryUseCase({...})` in the library-domain tests). Every other describe block
  in this file keeps calling the raw adapter's `searchCatalog`/`getRelease`/`getArtist` unchanged.
  Run the whole file and confirm it is now fully green.
- [X] T019 [P] [US2] Finish `backend/tests/integration/discogsCatalog/discogsCaching.test.ts`
  (copied in T013): update its `'serves a second identical searchCatalog call from cache ...'` test
  to call `searchCatalogWithRatings` (bound to the real `discogsCatalogAdapter` + `cacheAdapter`)
  instead of the raw adapter's `searchCatalog`; its `getRelease`-cache test and `enrichEntries` test
  are unaffected. Run the whole file and confirm it is now fully green.
- [X] T020 [P] [US2] Finish
  `backend/tests/integration/discogsCatalog/discogsRateLimitSmoothing.test.ts` (copied in T014):
  update its `describe('Discogs rate-limit smoothing — User Story 2 (bounded search-rating
  concurrency)')` block's three `searchCatalog(...)` calls to `searchCatalogWithRatings` the same
  way. Run the whole file and confirm it is now fully green.

### Implementation for User Story 2

- [X] T021 [US2] Implement `backend/src/application/discogsCatalog/searchCatalogWithRatings.ts` —
  factory `createSearchCatalogWithRatingsUseCase(deps: { discogsCatalog: DiscogsCatalogPort; cache:
  CachePort })` returning `searchCatalogWithRatings(query, options)`. Relocate the exact logic that
  lives inside `discogsClient.ts`'s current `searchCatalog` today: return the empty result
  immediately for a blank/whitespace query **before** touching the cache (preserves today's "no
  cache interaction for a blank query" behavior); otherwise build the identical cache key
  (`discogs:search:{resultType}:{query}:{page}:{perPage}:{genre}:{style}:{format}`) and wrap the rest
  in `cache.withCache(cacheKey, 30 * 60, async () => { ... })`: call
  `discogsCatalog.searchCatalog(query, options)` for the raw page, then run `enrichWithRating`
  (master results resolve their rating via `discogsCatalog.getMasterRelease(...).mainReleaseId`,
  release results directly; any failure or omitted count degrades to no rating, logging a
  `logger.warn` exactly as today) over all results via `mapWithConcurrency` from
  `../../shared/concurrency` bounded to 5 concurrent lookups. Run T017 and confirm it now passes;
  then run T018, T019, T020 (wiring their bound `searchCatalogWithRatings` instances against this
  real implementation) and confirm all three are now fully green.

**Checkpoint**: The rating-enrichment rule is proven standalone (fake port) and against the real
HTTP/Redis stack. `discogs/discogsClient.ts` and `routes/discogs.ts` are still untouched, still
serving production traffic.

---

## Phase 5: User Story 3 - HTTP layer delegates orchestration to application logic (Priority: P2)

**Goal**: `routes/discogs.ts` becomes a thin driving adapter (parse/validate → one call → error
mapping); this is the cutover that retires the old `discogs/discogsClient.ts`,
`discogs/discogsMapper.ts`, `discogs/types.ts`, and `routes/discogs.ts`.

**Independent Test**: Every route handler body is limited to parsing/validation, one call into
`application/discogsCatalog/searchCatalogWithRatings.ts` (search) or directly into
`discogsCatalogAdapter` (release/master/master-versions — no application-layer rule of their own),
the existing "masters surface first" reordering, and error-to-HTTP mapping; the existing
contract/integration suites pass unchanged against the migrated routes (spec.md US3).

### Tests for User Story 3 ⚠️ (relocate first; they must keep passing throughout this phase)

- [X] T022 [P] [US3] Relocate `backend/tests/contract/discogsRelease.contract.test.ts` →
  `backend/tests/contract/discogsCatalog/discogsRelease.contract.test.ts` (no source-import changes
  needed — it only calls `createApp()`). Run it and confirm it still passes (routes aren't migrated
  yet — this only proves the relocation is correct).
- [X] T023 [P] [US3] Relocate `backend/tests/contract/discogsMaster.contract.test.ts` →
  `backend/tests/contract/discogsCatalog/discogsMaster.contract.test.ts`. Run it and confirm it
  still passes.
- [X] T024 [P] [US3] Relocate `backend/tests/contract/discogsSearch.contract.test.ts` →
  `backend/tests/contract/discogsCatalog/discogsSearch.contract.test.ts`. Run it and confirm it
  still passes.
- [X] T025 [P] [US3] Relocate `backend/tests/integration/discogsCacheOutage.test.ts` →
  `backend/tests/integration/discogsCatalog/discogsCacheOutage.test.ts`. Run it and confirm it still
  passes.

### Implementation for User Story 3

- [X] T026 [US3] Implement `backend/src/adapters/discogsCatalog/discogsRoutes.ts` — the driving
  adapter, relocated from `backend/src/routes/discogs.ts`: instantiate
  `createSearchCatalogWithRatingsUseCase({ discogsCatalog: discogsCatalogAdapter, cache:
  cacheAdapter })` once at module load (importing both from their new adapter locations). Keep
  `parsePageParams`, `parseFilterParams`, `FILTER_PARAM_NAMES`, `DEFAULT_MASTER_VERSIONS_PER_PAGE`,
  and every existing `logger.info/warn/error` call unchanged. `/search`'s handler: parse
  query/filters, call `searchCatalogWithRatings`, apply the existing masters-first reordering
  (research.md Decision 5 — this stays a presentation concern in the route, not the use case) to the
  result before building the JSON response, map errors. `/releases/:discogsId`,
  `/masters/:discogsId`, `/masters/:discogsId/versions` handlers: call
  `discogsCatalogAdapter.getRelease`/`getMasterRelease`/`getMasterReleaseVersions` directly (no
  application-layer rule needed for these three — quickstart.md step 6), same 404/502/500
  error-to-status mapping as today.
- [X] T027 [US3] Update `backend/src/app.ts`: change
  `import { discogsRouter } from './routes/discogs'` to
  `import { discogsRouter } from './adapters/discogsCatalog/discogsRoutes'`.
- [X] T028 [US3] Fix the cross-domain call sites per spec.md FR-009 (data-model.md Edge Case,
  research.md Decision 4): update `backend/src/application/library/createLibraryEntry.ts`'s
  `getRelease` import from `../../discogs/discogsClient` to
  `../../adapters/discogsCatalog/discogsCatalogAdapter`, and its `Release` type import from
  `../../discogs/types` to `../../domain/discogsCatalog/types`; update
  `backend/src/application/library/enrichLibraryEntry.ts`'s `getRelease` import the same way;
  update `backend/src/domain/library/types.ts`'s `Release` type import from `../../discogs/types` to
  `../discogsCatalog/types`; update `backend/tests/contract/collectionClient.contract.test.ts`'s
  `getRelease` import from `../../src/discogs/discogsClient` to
  `../../src/adapters/discogsCatalog/discogsCatalogAdapter`. No business logic changes in any of
  these four files.
- [X] T029 [US3] Delete the now-superseded old files: `backend/src/discogs/discogsClient.ts`,
  `backend/src/discogs/discogsMapper.ts`, `backend/src/discogs/types.ts`,
  `backend/src/routes/discogs.ts`.
- [X] T030 [US3] Delete the now-superseded old test files: `backend/tests/unit/discogsMapper.test.ts`,
  `backend/tests/contract/discogsClient.contract.test.ts`,
  `backend/tests/integration/discogsClient.live.test.ts`,
  `backend/tests/integration/discogsRetryResilience.test.ts`,
  `backend/tests/integration/discogsCaching.test.ts`,
  `backend/tests/integration/discogsRateLimitSmoothing.test.ts`,
  `backend/tests/contract/discogsRelease.contract.test.ts`,
  `backend/tests/contract/discogsMaster.contract.test.ts`,
  `backend/tests/contract/discogsSearch.contract.test.ts`,
  `backend/tests/integration/discogsCacheOutage.test.ts` — each one's coverage now lives at its
  Phase 3/4/5-relocated path. Do **not** delete `tests/unit/discogsRateLimiter.test.ts`,
  `tests/unit/discogsCircuitBreaker.test.ts`, or `tests/unit/discogsRetry.test.ts` — research.md
  Decision 1 keeps their subject files in place, unmoved.
- [X] T031 [US3] Run
  `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/discogsCatalog"`
  and confirm every relocated test (T009, T010, T011, T012, T013, T014, T017, T022-T025) passes
  against the now fully-wired new code — the FR-006/SC-001 regression gate for the catalog domain.
- [X] T032 [US3] Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/library"`
  again and confirm the FR-009 import-path fixes (T028) didn't regress the library domain (mirrors
  quickstart.md step 3, run a second time post-cutover).

**Checkpoint**: All three user stories functional; `discogs/discogsClient.ts`,
`discogs/discogsMapper.ts`, `discogs/types.ts`, and `routes/discogs.ts` no longer exist;
`adapters/discogsCatalog/discogsRoutes.ts` serves `/api/discogs` unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 [P] Run
  `grep -rnE "from '(axios|ioredis|firebase-admin)'" backend/src/domain/discogsCatalog
  backend/src/application/discogsCatalog backend/src/ports/discogsCatalog backend/src/ports/cache`
  and confirm zero matches (spec.md SC-002; quickstart.md step 1). Additionally run
  `find backend/src/ports backend/src/adapters -iname "cachePort*" -o -iname "cacheAdapter*"` and
  confirm exactly one `cachePort.ts` and one `cacheAdapter.ts` exist (both under
  `ports/cache/`/`adapters/cache/`) — spec.md SC-005, confirming T005's deletion held.
- [X] T034 Run `cd backend && npm test` (full suite, no path filter) once and confirm every backend
  test file passes, including every domain this feature didn't touch — proving no cross-domain blast
  radius (spec.md SC-001; quickstart.md step 4).
- [X] T035 [P] Manually review `backend/src/adapters/discogsCatalog/discogsRoutes.ts`: confirm every
  handler body is limited to parsing/validation, one use-case/port call, the masters-first
  reordering for `/search` only, and error mapping, with no inline business orchestration (spec.md
  US3 acceptance scenario 1; quickstart.md step 6).
- [ ] T036 Manually verify quickstart.md step 5 against a running `npm run dev`: masters still
  surface first on `/api/discogs/search`, a repeat search within TTL costs one cache read (no fresh
  rating lookups), and not-found/rate-limited/unavailable responses are byte-for-byte unchanged
  (spec.md SC-004).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. Independent of US2/US3 (US2's own tests use a
  fake port, per its Independent Test).
- **User Story 2 (Phase 4)**: Depends on Phase 3's port interface (T008) for typing its fake, and on
  Phase 3's adapter (T016) only for the three "finish the copied test" tasks (T018-T020), which wire
  the real adapter in. The new unit test (T017) needs neither.
- **User Story 3 (Phase 5)**: Depends on Phase 3 AND Phase 4 (needs the real `discogsCatalogAdapter`
  and `searchCatalogWithRatings` to wire into routes) — matches spec.md's explicit statement that US3
  depends on US1 and US2.
- **Polish (Phase 6)**: Depends on Phase 5.

### Parallel Opportunities

- T003, T004, T007 (Phase 2) — different files.
- T009, T011, T012, T013, T014 (Phase 3 test copies) — different files, all only need T008.
- T019, T020 (Phase 4 "finish the copied test" tasks) — different files, both only need T021.
- T022, T023, T024, T025 (Phase 5 pure test relocations) — different files.
- T033, T035 (Phase 6) — independent checks.

---

## Parallel Example: Phase 3 test copies (User Story 1)

```bash
Task: "Copy tests/unit/discogsMapper.test.ts to tests/unit/discogsCatalog/adapters/discogsMapper.test.ts"
Task: "Copy tests/integration/discogsClient.live.test.ts to tests/integration/discogsCatalog/discogsClient.live.test.ts"
Task: "Copy tests/integration/discogsRetryResilience.test.ts to tests/integration/discogsCatalog/discogsRetryResilience.test.ts"
Task: "Copy tests/integration/discogsCaching.test.ts to tests/integration/discogsCatalog/discogsCaching.test.ts"
Task: "Copy tests/integration/discogsRateLimitSmoothing.test.ts to tests/integration/discogsCatalog/discogsRateLimitSmoothing.test.ts"
```

## Parallel Example: Phase 5 pure test relocations (User Story 3)

```bash
Task: "Relocate tests/contract/discogsRelease.contract.test.ts"
Task: "Relocate tests/contract/discogsMaster.contract.test.ts"
Task: "Relocate tests/contract/discogsSearch.contract.test.ts"
Task: "Relocate tests/integration/discogsCacheOutage.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: T010/T011/T012/T013/T014 pass (except their expected-red enrichment
   sections); `discogsCatalogAdapter` is proven for every raw lookup; production traffic is still
   served by the untouched old code, so this is safe to pause on or merge as an incremental,
   behavior-invisible step.

### Incremental Delivery

1. Setup + Foundational → shared `CachePort` and catalog types ready.
2. User Story 1 → catalog access port proven, zero production risk (additive only).
3. User Story 2 → rating-enrichment rule proven (fake port + real stack), zero production risk
   (additive only) — the three split test files reach full green here.
4. User Story 3 → the cutover: routes rewritten, `app.ts` repointed, cross-domain import fixes
   applied, old files deleted. This is the only phase that changes what actually serves
   `/api/discogs` traffic.
5. Polish → static-import check, full-suite regression run, manual route-handler review, manual
   HTTP smoke test.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every implementation task in Phases 3-4 has a preceding test task that fails until it lands
  (Constitution Principle I).
- Commit after each checkpoint (end of Phase 2, 3, 4, 5, 6) rather than after every single task.
- Do not delete anything under `backend/src/discogs/discogsClient.ts`,
  `backend/src/discogs/discogsMapper.ts`, `backend/src/discogs/types.ts`,
  `backend/src/routes/discogs.ts`, or the ten Phase 3/4 original test files before T029/T030 — every
  earlier phase depends on the old code and its original tests continuing to serve/cover production
  traffic unmodified.
- `discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`, `discogsErrors.ts`, and
  their three dedicated unit tests are **never** touched or relocated by this feature (research.md
  Decision 1) — they stay shared infrastructure for the not-yet-migrated
  `discogs/collection/collectionClient.ts` and `discogs/oauth/discogsOauthService.ts`.
