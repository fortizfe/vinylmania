---

description: "Task list for feature implementation"
---

# Tasks: Search Results Organization

**Input**: Design documents from `/specs/027-search-results-organization/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/search-api.md](./contracts/search-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED, not optional — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change in this repo.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Existing web app split, per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: Confirm the codebase still matches the assumptions research.md/plan.md were built on before changing it.

- [X] T001 Re-read `frontend/src/components/AppHeader.tsx`, `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/queries/discogsQueries.ts`, `frontend/src/components/SearchResultCard.tsx`, and `backend/src/routes/discogs.ts` to confirm the current line numbers/structure still match what research.md and plan.md describe (no drift since planning); note any discrepancy before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No foundational tasks are required for this feature: `@tanstack/react-query` v5 (with `useInfiniteQuery`), the Express router, and the existing auth middleware are already in place and used unchanged. User Stories 1, 2, and 3 touch disjoint files (`AppHeader.tsx` / `SearchResultsPage.tsx`+`discogsQueries.ts` / `discogs.ts`+`SearchResultCard.tsx` respectively) and can proceed directly after Phase 1.

**Checkpoint**: Proceed straight to user story phases.

---

## Phase 3: User Story 1 - Header stays visible while scrolling (Priority: P1) 🎯 MVP

**Goal**: The shared `AppHeader` stays fixed at the top of the viewport on every authenticated page while the user scrolls.

**Independent Test**: Open any page with content taller than the viewport, scroll down, and confirm the header remains visible, fully interactive, and never overlaps/hides page content.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] [US1] In `frontend/tests/unit/AppHeader.test.tsx`, add/update a test asserting the rendered `<header>` element carries sticky-positioning classes (`sticky`, `top-0`) and an explicit background class (`bg-white`/`dark:bg-gray-950`), so it will not be transparent once content scrolls underneath it.

### Implementation for User Story 1

- [X] T003 [US1] Update `frontend/src/components/AppHeader.tsx`: add `sticky top-0 z-40 bg-white dark:bg-gray-950` to the existing `<header>` element's class list (keeping its current `border-b` and layout classes), per research.md Decision 1. Depends on T002 failing first.

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — the header stays put on every page while scrolling.

---

## Phase 4: User Story 2 - Infinite scroll through search results (Priority: P2)

**Goal**: The search results page automatically fetches and appends more results as the user scrolls, replacing Previous/Next pagination.

**Independent Test**: Search a term returning more than 20 results, scroll to the bottom of the loaded cards, and confirm the next batch loads and appends automatically with no button click, an end-of-results indicator appears once exhausted, and no pagination controls are present anywhere on the page.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T004 [P] [US2] In `frontend/tests/unit/queries/discogsQueries.test.tsx`, add tests for a new infinite-query search hook (e.g. `useCatalogSearchInfinite`) built on TanStack Query's `useInfiniteQuery`: assert its query key excludes `page` but includes `query`/`type`/`perPage`/`filters`; assert `getNextPageParam` returns the next page number when `pagination.page < pagination.pages`, and `undefined` (no more pages) when `pagination.page >= pagination.pages`.
- [X] T005 [P] [US2] In `frontend/tests/integration/searchResultsFlow.test.tsx`, add/update tests (mocking `IntersectionObserver`) covering: (a) initial load fetches enough results to fill the viewport with no pagination buttons rendered; (b) scrolling the sentinel into view triggers fetching and appending the next batch, showing a loading indicator meanwhile and not double-firing while a fetch is in flight; (c) an end-of-results indicator appears once `hasNextPage` is false; (d) a failed next-batch fetch shows an error message with a retry action while keeping already-loaded cards; (e) changing the search query or a filter clears the accumulated list and restarts from the first batch.

### Implementation for User Story 2

- [X] T006 [US2] In `frontend/src/queries/discogsQueries.ts`, add `useCatalogSearchInfinite(query, type, perPage, filters)` built on `useInfiniteQuery`, with `initialPageParam: 1` and `getNextPageParam` derived from `CatalogSearchResponse.pagination` (per research.md Decision 2 and data-model.md). Depends on T004 failing first.
- [X] T007 [US2] Update `frontend/src/pages/SearchResultsPage.tsx`: replace `useCatalogSearch`/`page`-based fetching with `useCatalogSearchInfinite`, flatten `data.pages` into a single results array (no client-side reordering — the backend already orders each page, per research.md Decision 3), render a sentinel element observed via `IntersectionObserver` that calls `fetchNextPage()` when it enters the viewport, guarded by `hasNextPage && !isFetchingNextPage` so an already-in-flight or exhausted query never issues a duplicate request (FR-006), replace the Previous/Next `Button` block with a loading-more indicator (reusing the existing `SearchResultCardSkeleton` pattern) and an end-of-results message, add an error message with a retry action for a failed `fetchNextPage`, remove the now-unused `goToPage`/`page` pagination logic, and fix `currentSearchPath` to `buildSearchPath(query, 1, filters)` (search/filter identity only — infinite scroll has no single "current page" to carry back). Depends on T006 and T005 failing first.

**Checkpoint**: User Stories 1 AND 2 both work independently — header stays fixed, and search results now load via scrolling instead of pagination buttons.

---

## Phase 5: User Story 3 - Masters shown first, without a format tag (Priority: P3)

**Goal**: Within each loaded batch, master results appear before release results, and master cards no longer show a format badge.

**Independent Test**: Search a term whose results mix masters and releases; confirm masters appear ahead of releases within the loaded batch and show no format badge, while release cards still show theirs.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T008 [P] [US3] In `backend/tests/contract/discogsSearch.contract.test.ts`, add a test stubbing a Discogs `/database/search` response that mixes `master` and `release` result items, and assert `GET /api/discogs/search`'s `response.body.results` orders all `master`-type entries before all `release`-type entries while preserving each group's relative order; add a second test with an all-release stub asserting the order is unchanged from today.
- [X] T009 [P] [US3] In `frontend/tests/unit/SearchResultCard.test.tsx`, add a test asserting no format `Badge` is rendered when `result.resultType === 'master'`, and that an existing/added test still confirms the badge renders for `resultType === 'release'`.

### Implementation for User Story 3

- [X] T010 [US3] Update the `/search` handler in `backend/src/routes/discogs.ts`: respond with `{ ...result, results: [...masterResults, ...releaseResults] }` (reusing the `releaseResults`/`masterResults` partition already computed for its logging call) instead of the original `result.results`, per research.md Decision 3 and contracts/search-api.md. Depends on T008 failing first.
- [X] T011 [US3] Update `frontend/src/components/SearchResultCard.tsx`: gate the existing format `<Badge>` behind the existing `isGrouped` flag (`{!isGrouped && format && <Badge tone="muted">{format}</Badge>}`), per research.md Decision 4. Depends on T009 failing first.

**Checkpoint**: All three user stories are independently functional and can be combined — sticky header, infinite scroll, and masters-first/no-badge ordering all work together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide quality gates that span all three stories.

- [X] T012 [P] Extend `e2e/tests/search-result-filters.spec.ts` (or add a sibling spec, e.g. `e2e/tests/search-results-organization.spec.ts`) with Playwright coverage for: the header staying visible while scrolling the results page, a scroll action triggering an additional batch of results to load, and a mixed-results search showing masters ahead of releases with no format badge on master cards — satisfying the constitution's mandatory e2e gate for `/frontend` PRs.
- [X] T013 [P] Add dated entries to `frontend/CHANGELOG.md` and `backend/CHANGELOG.md` describing this change (sticky header, infinite scroll, masters-first ordering/badge removal) and bump the `version` field in `frontend/package.json` and `backend/package.json` per Principle VI (MINOR — additive/behavioral, no breaking contract change).
- [X] T014 [P] Run `npm run lint` and `npm run format` in `frontend/` and `backend/` on all changed files.
- [X] T015 Walk through every scenario in `quickstart.md` against the running app (frontend + backend dev servers) to confirm all three user stories work together end-to-end, including timing the scroll-to-next-batch delay under normal network conditions to confirm it lands within ~2s (SC-003).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: No tasks; nothing blocks the user stories beyond Phase 1.
- **User Stories (Phase 3-5)**: Each can start right after Phase 1. They touch disjoint files and have no cross-story dependency, so they may proceed in parallel or in priority order (P1 → P2 → P3).
- **Polish (Phase 6)**: Depends on whichever user stories are completed (T012 needs at least US1+US2 behavior to exercise meaningfully; T013-T015 should run last).

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3.
- **User Story 2 (P2)**: No dependency on US1/US3 (independently testable even though it shares the same page as US3's card changes).
- **User Story 3 (P3)**: No dependency on US1/US2.

### Within Each User Story

- Failing tests (T002/T004+T005/T008+T009) MUST exist and fail before their corresponding implementation task.
- Hook/service changes (T006, T010) before the component/page that consumes them (T007, T011) where applicable.

### Parallel Opportunities

- T002 (US1 test) can run alongside T004/T005 (US2 tests) and T008/T009 (US3 tests) — all different files.
- T012, T013, T014 in Polish can run in parallel (different files/scopes).
- Different user story phases (3, 4, 5) can be worked on by different people in parallel once Phase 1 is done.

---

## Parallel Example: Kicking off all three stories' tests together

```bash
Task: "Add sticky-header assertions in frontend/tests/unit/AppHeader.test.tsx"
Task: "Add useInfiniteQuery hook tests in frontend/tests/unit/queries/discogsQueries.test.tsx"
Task: "Add infinite-scroll flow tests in frontend/tests/integration/searchResultsFlow.test.tsx"
Task: "Add masters-first ordering contract test in backend/tests/contract/discogsSearch.contract.test.ts"
Task: "Add no-format-badge-on-master test in frontend/tests/unit/SearchResultCard.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (sticky header).
3. **STOP and VALIDATE**: confirm the header stays fixed across pages while scrolling.
4. Deploy/demo if ready — this alone already improves every page in the app, not just search.

### Incremental Delivery

1. Setup → Phase 3 (US1, sticky header) → validate → deploy.
2. Phase 4 (US2, infinite scroll) → validate → deploy.
3. Phase 5 (US3, masters-first + no badge) → validate → deploy.
4. Phase 6 (Polish: e2e, changelog/version, lint, quickstart pass) → final validation → deploy.

### Parallel Team Strategy

With multiple developers, after Phase 1:

- Developer A: User Story 1 (`AppHeader.tsx`)
- Developer B: User Story 2 (`discogsQueries.ts` + `SearchResultsPage.tsx`)
- Developer C: User Story 3 (`discogs.ts` route + `SearchResultCard.tsx`)

All three integrate independently in `SearchResultsPage`/`AppHeader`/`discogs.ts` without touching each other's files.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Tests are mandatory here (Principle I, NON-NEGOTIABLE) — verify each listed test fails before writing the corresponding implementation.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before moving on.
