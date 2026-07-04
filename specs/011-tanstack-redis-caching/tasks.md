---

description: "Task list template for feature implementation"
---

# Tasks: Application Caching (Frontend State & Backend Responses)

**Input**: Design documents from `/specs/011-tanstack-redis-caching/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for all new behavior, and the "Frontend e2e coverage gate" mandates Playwright coverage for any `/frontend` change (see plan.md's Constitution Check).

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story. Per the original two-part request, User Story 1 = the frontend TanStack Query effort, User Story 2 = the backend Redis/ioredis effort, and User Story 3 = the invalidation safeguard that ties both together.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new dependencies and document the new environment variable before any code is written.

- [X] T001 [P] Add `@tanstack/react-query` (^5) as a dependency in `frontend/package.json` and run `npm install` in `frontend/`
- [X] T002 [P] Add `ioredis` as a dependency and `ioredis-mock` as a devDependency in `backend/package.json` and run `npm install` in `backend/`
- [X] T003 [P] Add a `REDIS_URL` row to the backend environment variables table in `docs/deployment-vercel.md` (Step 2), describing it as the connection string for the managed Redis instance backing the response cache

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the two shared caching primitives (backend Redis client + cache-aside wrapper, frontend `QueryClient`) that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Write failing unit test for `getRedisClient()` in `backend/tests/unit/cache/redisClient.test.ts`: asserts the same `ioredis` instance is returned across repeated calls (connection reuse) and that it is constructed using `process.env.REDIS_URL`
- [X] T005 Implement `getRedisClient()` in `backend/src/cache/redisClient.ts` as a lazily-initialized, module-level singleton per `contracts/backend-cache-module.md` and `research.md` §3 (makes T004 pass)
- [X] T006 [P] Extend the `LogOutcome` union in `backend/src/config/logger.ts` with `'cache_hit'`, `'cache_miss'`, and `'cache_unavailable'`
- [X] T007 [P] Write failing unit tests for `withCache()` in `backend/tests/unit/cache/cacheAside.test.ts` using `ioredis-mock`: (a) cache hit returns the stored value and does not call the fetcher, (b) cache miss calls the fetcher, stores the JSON result with the given TTL, and returns it, (c) a Redis error on get/set falls through to calling the fetcher and returns its result without throwing, (d) a fetcher error propagates unchanged and nothing is cached
- [X] T008 Implement `withCache<T>(key, ttlSeconds, fetcher)` in `backend/src/cache/cacheAside.ts` per `contracts/backend-cache-module.md`, logging `cache_hit`/`cache_miss`/`cache_unavailable` via the existing `logger` (makes T007 pass; depends on T005, T006)
- [X] T009 [P] Create the shared `QueryClient` in `frontend/src/lib/queryClient.ts` with project-wide `staleTime`/`gcTime` defaults per `research.md` §1
- [X] T010 Wrap `<App />` in `<QueryClientProvider client={queryClient}>` in `frontend/src/main.tsx` (depends on T009)
- [X] T011 [P] Add a `renderWithQueryClient` test helper (constructs a fresh `QueryClient` per call with retries disabled, wraps children in `QueryClientProvider`) in `frontend/tests/setup.ts` (or a new `frontend/tests/testUtils.tsx`), for reuse by every query-hook and page test added below

**Checkpoint**: Backend cache-aside primitive and frontend `QueryClient` are in place and unit-tested. User story implementation can now begin.

---

## Phase 3: User Story 1 - Instant reloads of already-seen data (Priority: P1) 🎯 MVP

**Goal**: Wrap all frontend read flows (library list, record detail, catalog search/preview) in TanStack Query so revisiting a screen renders instantly from cache while refreshing in the background.

**Independent Test**: Open the library list, open a record's detail page, navigate back to the library list, then back into the same record — the second visit to each screen must render immediately with no loading skeleton (see `quickstart.md` §2).

### Tests for User Story 1

- [X] T012 [P] [US1] Write failing unit tests for `libraryKeys`, `useLibraryList`, `useLibraryEntry` in `frontend/tests/unit/queries/libraryQueries.test.ts` (using the T011 helper): `useLibraryEntry(undefined)` stays disabled and issues no request; a second render with the same arguments within `staleTime` returns cached data without invoking the underlying `libraryApi` call again
- [X] T013 [P] [US1] Write failing unit tests for `discogsKeys`, `useCatalogSearch`, `useCatalogRelease` in `frontend/tests/unit/queries/discogsQueries.test.ts`: `useCatalogSearch` stays disabled for an empty query; a second call with identical search/release arguments within `staleTime` returns cached data without invoking the underlying `discogsApi` call again

### Implementation for User Story 1

- [X] T014 [US1] Implement `libraryKeys`, `useLibraryList`, `useLibraryEntry` in `frontend/src/queries/libraryQueries.ts` per `contracts/frontend-query-hooks.md`, wrapping the existing `libraryApi.list`/`libraryApi.getOne` functions unchanged (makes T012 pass)
- [X] T015 [US1] Implement `discogsKeys`, `useCatalogSearch`, `useCatalogRelease` in `frontend/src/queries/discogsQueries.ts` per `contracts/frontend-query-hooks.md`, wrapping the existing `discogsApi.search`/`discogsApi.getRelease` functions unchanged (makes T013 pass)
- [X] T016 [US1] Refactor `frontend/src/pages/LibraryListPage.tsx` to replace the manual `useEffect`/`useState` fetch (current lines ~15-38) with `useLibraryList(page, pageSize)`, preserving the existing skeleton, error, and pagination UI behavior exactly
- [X] T017 [US1] Refactor the read path of `frontend/src/pages/RecordDetailPage.tsx` to replace the manual `useEffect`/`libraryApi.getOne` call (current lines ~22-42) with `useLibraryEntry(entryId)`, preserving the existing not-found and skeleton behavior. *(Implementation note: done together with T026's mutation-hook wiring in the same edit, since `setEntry(updated)` had no local state to update once the read path moved to the query cache — see T026.)*
- [X] T018 [US1] Refactor the search-submit and release-preview flows in `frontend/src/pages/AddRecordPage.tsx` to use `useCatalogSearch`/`useCatalogRelease` instead of calling `discogsApi` directly, preserving existing loading/error/pagination behavior. *(Implementation note: done together with T027's `useCreateLibraryEntry` wiring for the same reason.)*
- [X] T019 [P] [US1] Update `frontend/tests/integration/recordDetailFlow.test.tsx` and any existing `LibraryListPage`/`AddRecordPage` tests to render through the `renderWithQueryClient` helper from T011, so they exercise the real query hooks instead of the old manual-fetch mocks (also updated `libraryListFlow.test.tsx`, `addRecordFlow.test.tsx`, and `navigationMenu.test.tsx`, which all mount query-hook-backed pages)

**Checkpoint**: User Story 1 is fully functional and independently demoable — revisiting the library list, a record's detail page, or a repeated search renders from cache instantly, with no backend or User Story 2/3 changes required.

---

## Phase 4: User Story 2 - Fewer repeated calls to slow external catalog lookups (Priority: P2)

**Goal**: Cache Discogs responses in Redis behind `searchCatalog`, `getRelease`, and `getArtist` so identical catalog lookups — including the repeated `getRelease` calls made per library entry during list enrichment — are served without a new outbound Discogs request.

**Independent Test**: Call `GET /api/discogs/search` (or `getRelease`) twice with identical parameters within the cache's TTL — the second call must complete without a new outbound Discogs request and must return the same response shape (see `quickstart.md` §1). Verifiable via `curl`/Jest alone, with no frontend changes required.

### Tests for User Story 2

- [X] T020 [P] [US2] Write a failing integration test in `backend/tests/integration/discogsCaching.test.ts` asserting that two identical `searchCatalog(query, options)` calls within TTL only consume one `nock` interceptor (i.e., only one outbound HTTP call is made) and both calls return identical results
- [X] T021 [P] [US2] In the same file, write a failing test asserting that two `getRelease(discogsReleaseId)` calls with the same ID within TTL only consume one `nock` interceptor, and that `enrichEntries()` (`backend/src/library/libraryEnrichment.ts`) enriching two library entries that share the same `discogsReleaseId` triggers only one outbound Discogs call

### Implementation for User Story 2

- [X] T022 [US2] Wrap `searchCatalog`, `getRelease`, and `getArtist` in `backend/src/discogs/discogsClient.ts` with `withCache(key, ttlSeconds, fetcher)`, using the key-naming scheme from `research.md` §4 and the TTL tiers from `research.md` §5 (makes T020, T021 pass; depends on T008). *(cacheAside.ts also gained an in-flight single-flight map — concurrent calls sharing a key, as `enrichEntries()` does, would otherwise race past each other since each independently checks Redis before either writes.)*
- [X] T023 [P] [US2] Write and pass an integration test in `backend/tests/integration/discogsCacheOutage.test.ts` asserting that `GET /api/discogs/search` and `GET /api/discogs/releases/:discogsId` still return 200 with the correct, unchanged response shape when the Redis client throws/is unreachable (SC-005 at the route level, on top of the generic T007 coverage)

**Checkpoint**: User Story 2 is fully functional and independently verifiable — repeated catalog lookups (including the library-enrichment hot path) no longer re-hit Discogs, and a Redis outage never breaks a request. No frontend changes required.

---

## Phase 5: User Story 3 - Never see stale data after making a change (Priority: P3)

**Goal**: Ensure a user's own edits (condition/notes update, add, remove) are immediately reflected everywhere the affected data is shown, by routing writes through TanStack Query mutation hooks that invalidate the relevant cached queries.

**Independent Test**: Edit a record's condition on its detail page, then navigate to the library list — the updated value must appear without a manual reload (see `quickstart.md` §3). Builds on the query infrastructure from User Story 1 (`libraryQueries.ts`) but is independently testable as its own increment.

### Tests for User Story 3

- [X] T024 [P] [US3] Write failing unit tests for `useCreateLibraryEntry`, `useUpdateLibraryEntry`, `useRemoveLibraryEntry` in `frontend/tests/unit/queries/libraryQueries.test.ts` (extends T012's file): each mutation's `onSuccess` invalidates `libraryKeys.all` (or the more targeted `libraryKeys.detail`/`libraryKeys.lists` per `contracts/frontend-query-hooks.md`)

### Implementation for User Story 3

- [X] T025 [US3] Implement `useCreateLibraryEntry`, `useUpdateLibraryEntry`, `useRemoveLibraryEntry` in `frontend/src/queries/libraryQueries.ts` per `contracts/frontend-query-hooks.md`, invalidating the appropriate query keys `onSuccess` (makes T024 pass; depends on T014)
- [X] T026 [US3] Refactor `saveCondition`, `saveNotes`, and `handleRemove` in `frontend/src/pages/RecordDetailPage.tsx` to use `useUpdateLibraryEntry`/`useRemoveLibraryEntry` instead of calling `libraryApi` directly and manually calling `setEntry` (depends on T025, T017)
- [X] T027 [US3] Refactor the "add to library" action in `frontend/src/pages/AddRecordPage.tsx` to use `useCreateLibraryEntry` instead of calling `libraryApi.create` directly, so a newly added record appears in `LibraryListPage`'s cached list without a manual refresh (depends on T025, T018)
- [X] T028 [US3] Update `frontend/tests/integration/recordDetailFlow.test.tsx` (and any `AddRecordPage`/`LibraryListPage` integration tests) to assert that after an edit, add, or remove mutation, the library list/detail query cache reflects the change without a manual reload (depends on T026, T027). *(Single-page-tree assertions only — recordDetailFlow's existing condition/notes/remove tests now exercise the real mutation hooks and confirm the cache updates in place; true cross-page propagation is covered end-to-end by T029.)*
- [X] T029 [P] [US3] Add `e2e/tests/caching-navigation.spec.ts` covering both the User Story 1 flow (revisit library → detail → library is instant) and the User Story 3 flow (edit a record, then see the updated value on the library list) end-to-end, per the constitution's frontend e2e coverage gate

**Checkpoint**: All three user stories are independently functional. The full feature — frontend state caching, backend response caching, and stale-data-safe invalidation — is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all three stories.

- [X] T030 [P] Add an `Added` entry to `frontend/CHANGELOG.md` describing the TanStack Query state-caching layer (per Keep a Changelog / the constitution's changelog gate)
- [X] T031 [P] Add an `Added` entry to `backend/CHANGELOG.md` describing the Redis/ioredis response-caching layer (per Keep a Changelog / the constitution's changelog gate)
- [X] T032 [P] Update the "Stack" section of `README.md` to mention TanStack Query (frontend) and Redis/ioredis (backend) caching, linking to `specs/011-tanstack-redis-caching/quickstart.md`
- [X] T033 Run the full `quickstart.md` validation and confirm SC-001 through SC-005 are observably met. *(§2/§3, the frontend flows, were validated live via the new `e2e/tests/caching-navigation.spec.ts`, which passed against the real browser/dev servers. §1/§4, the backend Redis-down and cache-hit/miss behavior, were validated via the automated `discogsCaching.test.ts`/`discogsCacheOutage.test.ts` suites using `ioredis-mock` — this sandbox has no Docker daemon or local `redis-server` available to also run the literal `docker run redis` + `curl` steps from quickstart.md against a real Redis instance, so that specific manual step is unverified here and worth a quick sanity check in a dev environment that has Redis available.)*
- [X] T034 Run `npm test` in `frontend/`, `backend/`, and `e2e/` and fix any regressions surfaced by the refactors in T016-T018 and T026-T027. All green: frontend 106/106, backend 88/88, e2e 6/6; both packages' `tsc --noEmit` and lint are clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends only on Foundational — independent of US2/US3
- **User Story 2 (Phase 4)**: Depends only on Foundational — independent of US1/US3 (pure backend)
- **User Story 3 (Phase 5)**: Depends on Foundational AND on US1's `libraryQueries.ts`/page refactors (T014, T017, T018) since its mutation hooks live in the same file and its page refactors build on US1's read-path refactors
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **User Story 2 (P2)**: Can start after Foundational, in parallel with US1 — entirely backend, no dependency on US1 or US3
- **User Story 3 (P3)**: Can start after Foundational, but its implementation tasks depend on US1's `libraryQueries.ts` (T014) and page refactors (T017, T018) — schedule after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Test-First, NON-NEGOTIABLE)
- Query/cache primitives before page refactors
- Read-path refactors (US1) before write-path/mutation refactors (US3) on the same page
- Story complete (including its tests) before moving to the next priority

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- Within Foundational: T004/T006/T007/T009/T011 can run in parallel (distinct files); T005 depends on T004, T008 depends on T005-T007, T010 depends on T009
- Once Foundational completes, **User Story 1 and User Story 2 can be staffed and run fully in parallel** (different files, different stacks)
- User Story 3 should start once T014/T017/T018 (from US1) exist
- Within US1: T012/T013 in parallel; T014/T015 in parallel (after their respective tests); T019 in parallel with nothing else in the phase (runs last)
- Within US2: T020/T021 in parallel; T023 can run in parallel with nothing else in the phase (runs after T022)
- Polish tasks T030/T031/T032 can all run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests (after Foundational is done):
Task: "Write failing unit tests for libraryKeys/useLibraryList/useLibraryEntry in frontend/tests/unit/queries/libraryQueries.test.ts"
Task: "Write failing unit tests for discogsKeys/useCatalogSearch/useCatalogRelease in frontend/tests/unit/queries/discogsQueries.test.ts"

# Implementation (after each hook's tests exist):
Task: "Implement libraryKeys/useLibraryList/useLibraryEntry in frontend/src/queries/libraryQueries.ts"
Task: "Implement discogsKeys/useCatalogSearch/useCatalogRelease in frontend/src/queries/discogsQueries.ts"
```

## Parallel Example: User Story 1 + User Story 2 together

```bash
# Different developers, different stacks, no shared files:
Developer A: T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019   # frontend
Developer B: T020 → T021 → T022 → T023                                # backend
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `quickstart.md` §2 manually; confirm SC-001
5. Deploy/demo if ready — this alone delivers the "instant revisit" experience

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → validate independently → deploy/demo (MVP!)
3. Add User Story 2 → validate independently (`quickstart.md` §1) → deploy/demo
4. Add User Story 3 → validate independently (`quickstart.md` §3) → deploy/demo
5. Polish: changelogs, README, full quickstart + test-suite pass

### Parallel Team Strategy

With two developers:

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (frontend)
   - Developer B: User Story 2 (backend)
3. Either developer picks up User Story 3 once US1's `libraryQueries.ts` (T014) lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests MUST fail before their corresponding implementation task is started (Test-First, NON-NEGOTIABLE per the constitution)
- Commit after each task or logical group, following Conventional Commits (constitution's Development Workflow gate)
- Stop at any checkpoint to validate a story independently before continuing
- T016-T018 and T026-T027 touch existing page files with pre-existing tests — expect to update those tests (T019, T028) in the same logical change, not as an afterthought
