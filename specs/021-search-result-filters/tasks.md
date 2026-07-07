# Tasks: Search Result Filters

**Input**: Design documents from `/specs/021-search-result-filters/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and REQUIRED — the project constitution makes Test-First non-negotiable, and this feature changes a public API contract (`GET /api/discogs/search`) plus rendered/interactive behavior on an existing screen, which also triggers the mandatory e2e coverage gate for `/frontend` changes.

**Organization**: Tasks are grouped by user story from spec.md — US1 (P1, single filter), US2 (P2, combining filters), US3 (P3, clear/persist filters across navigation).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[US1]/[US2]/[US3]**: Maps to the matching user story in spec.md
- Every task includes an exact file path

## Path Conventions

Web application per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean pre-change baseline for every suite this feature touches

- [X] T001 Run the current targeted suites as a baseline check: `backend/tests/contract/discogsSearch.contract.test.ts`, `frontend/tests/unit/useSearchQueryParams.test.tsx`, `frontend/tests/unit/queries/discogsQueries.test.tsx`, `frontend/tests/integration/searchResultsFlow.test.tsx` — confirm all pass before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Thread filter support through every existing seam (Discogs client, API route, cache key, URL params, API service, query hook) that every user story's UI work depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Work

- [X] T002 [P] Extend `backend/tests/contract/discogsSearch.contract.test.ts` with cases: a request with `artist`/`genre`/`style`/`format` query params forwards each, unchanged, to the outbound `GET /database/search` call; omitted or whitespace-only values are NOT forwarded as empty-string params (per `contracts/discogs-search-filters-api.md`)
- [X] T003 [P] Extend `frontend/tests/unit/useSearchQueryParams.test.tsx` so `useSearchQueryParams` parses `artist`/`genre`/`style`/`format` from the URL (present → trimmed string; absent/blank → omitted from the returned object) and `buildSearchPath` accepts and encodes the same four optional filters, omitting any that are unset (per `data-model.md` "Existing types touched")
- [X] T004 [P] Extend `frontend/tests/unit/queries/discogsQueries.test.tsx` so `useCatalogSearch` accepts an optional filters argument, includes it in `discogsKeys.search(...)`'s query key (so different filter combinations cache separately), and forwards it to `discogsApi.search(...)`

### Implementation for Foundational Work

- [X] T005 Extend `SearchCatalogOptions` in `backend/src/discogs/discogsClient.ts` with optional `artist`/`genre`/`style`/`format` string fields; include them in the `GET /database/search` request `params`; extend the Redis cache-aside key with a stable, deterministic filter segment per `contracts/discogs-search-filters-api.md` ("Cache-aside key") so filtered and unfiltered requests never collide (depends on T002 failing first)
- [X] T006 Extend the `GET /search` handler in `backend/src/routes/discogs.ts` to read, trim, and forward `artist`/`genre`/`style`/`format` query params to `searchCatalog(...)` (blank/whitespace-only → omitted), and add a `filters` list (names only, not values) to the existing structured success log per Constitution Principle V / `contracts/discogs-search-filters-api.md` ("Observability") (depends on T005)
- [X] T007 [P] Extend `useSearchQueryParams`/`buildSearchPath` in `frontend/src/hooks/useSearchQueryParams.ts` to parse and build `artist`/`genre`/`style`/`format` alongside `query`/`page`, trimming values and omitting unset ones (depends on T003 failing first)
- [X] T008 [P] Extend `discogsApi.search(...)` in `frontend/src/services/discogsApi.ts` to accept an optional filters object (`{ artist?, genre?, style?, format? }`) and include only its non-empty values as request query params (depends on T004 failing first)
- [X] T009 Extend `useCatalogSearch` and `discogsKeys.search` in `frontend/src/queries/discogsQueries.ts` to accept and key on the same filters object, forwarding it to `discogsApi.search(...)` (depends on T007, T008)

**Checkpoint**: The backend accepts, forwards, logs, and cache-keys the four filters; the frontend URL hook, API service, and query hook all carry filters end-to-end — user-facing UI work can now begin

---

## Phase 3: User Story 1 - Narrow search results by filter (Priority: P1) 🎯 MVP

**Goal**: A user can use the filter control on the search results screen, enter a value into any single field (Artist, Genre, Style, or Format), select "Apply filters", and see the result list narrowed to matches; an empty filtered result set shows a filters-aware message.

**Independent Test**: Run a catalog search, apply a single filter (e.g. genre "Rock"), and confirm the result list updates to show only matching records (quickstart Scenario 1 & 4).

### Tests for User Story 1

- [X] T010 [P] [US1] Create `frontend/tests/unit/SearchFiltersControl.test.tsx`: renders four empty, labeled fields (Artist/Genre/Style/Format) on mount (Acceptance Scenario 2); typing into fields and selecting "Apply filters" calls `onApply` exactly once with the trimmed, non-empty subset of values, and is NOT called on every keystroke (FR-002/FR-003); selecting "Clear filters" calls `onClear` and resets all fields to empty (FR-005)
- [X] T011 [P] [US1] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: applying a single filter (e.g. Genre "Rock") re-runs the search with that filter and resets to page 1 (Acceptance Scenario 1, FR-003); a filtered search that resolves to zero results renders a "no results" message that names the active filter(s), distinct from the plain no-query-results message (Acceptance Scenario 3, FR-008); entering a filter value with no search query present issues no request and leaves the existing "use the search box" prompt shown (edge case, spec.md); submitting a new query from the header search box while a filter is active preserves that filter and re-applies it against the new query's results (edge case, spec.md)
- [X] T012 [P] [US1] Create `e2e/tests/search-result-filters.spec.ts` with a case covering quickstart Scenario 1: search, use the filter control to apply a single Genre filter, confirm the results narrow

### Implementation for User Story 1

- [X] T013 [US1] Create `SearchFiltersControl` in `frontend/src/components/SearchFiltersControl.tsx`: four `Input` fields (Artist/Genre/Style/Format) built from `frontend/src/components/ui/Input.tsx`, local uncommitted state initialized from the component's current-filter props, a primary `Button` ("Apply filters") that trims each field, drops empty ones, and calls `onApply` with the resulting subset, and a secondary `Button` ("Clear filters") that resets local state and calls `onClear` (per `contracts/search-results-filter-ui.md`) (depends on T010 failing first)
- [X] T014 [US1] Wire `SearchFiltersControl` into `frontend/src/pages/SearchResultsPage.tsx`: read active filters via the extended `useSearchQueryParams` (T007), pass them into `useCatalogSearch` (T009); on `onApply`, navigate (replace, matching the existing pagination navigation style) to the current `q` with `page` reset to `1` and the new filter params set; on `onClear`, navigate with all four filter params removed and `q` unchanged (depends on T013, T009)
- [X] T015 [US1] Add the filters-aware empty-results message in `frontend/src/pages/SearchResultsPage.tsx`: when `searched` is true, filters are active, and results are empty, render a message naming the active filters and inviting the user to adjust/clear them, instead of the existing plain "No results found" message (FR-008) (depends on T014)

**Checkpoint**: Single-filter apply and its zero-match state work end-to-end — this is the shippable MVP increment

---

## Phase 4: User Story 2 - Combine multiple filters at once (Priority: P2)

**Goal**: A user can set two or more filters together and see the intersection of all active filters; clearing one field while others remain set re-applies only the remaining filters.

**Independent Test**: Apply two or more filters simultaneously and confirm the results reflect the intersection of all active filters; clear one and confirm only the remaining filter(s) still apply (quickstart Scenario 2).

### Tests for User Story 2

- [X] T016 [P] [US2] Extend `backend/tests/contract/discogsSearch.contract.test.ts`: a request with multiple filter params set together (e.g. `genre` + `format`) forwards all of them together, unchanged, to the outbound `GET /database/search` call (Acceptance Scenario 1)
- [X] T017 [P] [US2] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: applying Genre + Format together sends both to the search request and both appear in the URL (Acceptance Scenario 1); clearing only the Format field and re-applying keeps Genre active in both the URL and the request while dropping Format (Acceptance Scenario 2)
- [X] T018 [P] [US2] Extend `e2e/tests/search-result-filters.spec.ts` with quickstart Scenario 2: apply two filters together and confirm combined narrowing, then clear one field and confirm the other remains applied

### Implementation for User Story 2

- [X] T019 [US2] Verify and, if needed, adjust the `onApply` handling in `frontend/src/components/SearchFiltersControl.tsx` and `frontend/src/pages/SearchResultsPage.tsx` so any subset of the four fields (zero through four, in any combination) is committed and requested together, with no field treated as mutually exclusive with another (FR-004) (depends on T016–T018 failing first; expected to require little to no code change if T013–T014 were built generically)

**Checkpoint**: Multi-filter combination and partial-clear behavior verified — US1 and US2 both independently functional

---

## Phase 5: User Story 3 - Reset filters and preserve filter state across navigation (Priority: P3)

**Goal**: Active filters survive pagination and URL reload/sharing, and can be reset to the unfiltered view in a single action.

**Independent Test**: Apply filters, navigate to page 2 of results, confirm the same filters remain active; use "clear filters" and confirm all filters reset and results revert to the unfiltered search; reload a filtered URL and confirm the same filtered results reproduce (quickstart Scenario 3).

### Tests for User Story 3

- [X] T020 [P] [US3] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: navigating to the next page while filters are active preserves those filters in both the URL and the resulting search request (FR-006, Acceptance Scenario 1)
- [X] T021 [P] [US3] Extend `frontend/tests/unit/useSearchQueryParams.test.tsx`: `buildSearchPath`, given filters, produces a URL that `useSearchQueryParams` parses back into the identical filter values (round-trip), so a reloaded/shared URL reproduces the same filtered request (FR-007, Acceptance Scenario 3)
- [X] T022 [P] [US3] Extend `e2e/tests/search-result-filters.spec.ts` with quickstart Scenario 3: apply filters, paginate to page 2 and confirm filters persist; reload the resulting URL directly and confirm the same filtered results load; select "Clear filters" and confirm all fields and URL params reset

### Implementation for User Story 3

- [X] T023 [US3] Verify and, if needed, adjust `goToPage` in `frontend/src/pages/SearchResultsPage.tsx` so it carries the currently active filter params forward unchanged when navigating pages (FR-006) (depends on T020 failing first)
- [X] T024 [US3] Verify and, if needed, adjust the "Clear filters" navigation wired in T014 so it removes all four filter params from the URL in a single navigation while leaving `q` (and `page`) untouched (FR-005) (depends on T021–T022 failing first)

**Checkpoint**: All three user stories are independently functional — filters survive pagination and reload, and reset in one action

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene required by the constitution, plus final end-to-end validation

- [X] T025 [P] Add a backend changelog entry and bump `backend/package.json`'s version (MINOR — additive, backward-compatible query params) in `backend/CHANGELOG.md` and `backend/package.json`
- [X] T026 [P] Add a frontend changelog entry and bump `frontend/package.json`'s version (MINOR — new filter control) in `frontend/CHANGELOG.md` and `frontend/package.json`
- [X] T027 Run the full quickstart validation flow from `specs/021-search-result-filters/quickstart.md` (backend contract suite, frontend unit + integration suites, and the `search-result-filters.spec.ts` e2e spec)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 must complete (and pass) before any change lands
- **Foundational (Phase 2)**: Depends on Setup; T002–T004 must be written and observed failing before T005–T009 are considered complete; blocks Phase 3
- **User Story 1 (Phase 3)**: Depends on Foundational (T005–T009); T010–T012 must fail before T013–T015 land
- **User Story 2 (Phase 4)**: Depends on Foundational; benefits from Phase 3 existing (reuses `SearchFiltersControl`/`SearchResultsPage`) but is independently testable against the same combined-filter contract
- **User Story 3 (Phase 5)**: Depends on Foundational; benefits from Phase 3 existing (reuses the Apply/Clear wiring) but is independently testable against pagination/URL round-trip behavior
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each Phase

- Tests MUST be written and observed failing before their paired implementation tasks are considered complete (Constitution Principle I)
- Within Phase 2: client/route/cache-key work (T005–T006) can proceed in parallel with the frontend hook/service work (T007–T008); T009 depends on both T007 and T008
- Within Phase 3: T013 depends on T010; T014 depends on T013 and the completed Phase 2 (T009); T015 depends on T014
- Within Phase 4 and 5: implementation tasks (T019, T023, T024) are verify-and-adjust tasks that depend on their phase's tests existing and failing first

### Parallel Opportunities

- Phase 2: T002 ∥ T003 ∥ T004 (tests, different files); then T005 ∥ T007 ∥ T008 (implementation, different files); T006 after T005; T009 after T007 and T008
- Phase 3: T010 ∥ T011 ∥ T012 (different files) before T013–T015
- Phase 4: T016 ∥ T017 ∥ T018 (different files) before T019
- Phase 5: T020 ∥ T021 ∥ T022 (different files) before T023–T024
- Phase 6: T025 ∥ T026 before T027

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Red tests in parallel
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts with filter param cases"
Task: "Extend frontend/tests/unit/useSearchQueryParams.test.tsx with filter parse/build cases"
Task: "Extend frontend/tests/unit/queries/discogsQueries.test.tsx with a filters-argument case"

# Implementation, in parallel where files differ
Task: "Extend SearchCatalogOptions + searchCatalog()'s cache key in backend/src/discogs/discogsClient.ts"
Task: "Extend useSearchQueryParams/buildSearchPath in frontend/src/hooks/useSearchQueryParams.ts"
Task: "Extend discogsApi.search() in frontend/src/services/discogsApi.ts"
# Then, once the route's client dependency and both frontend pieces land:
Task: "Extend GET /search route forwarding in backend/src/routes/discogs.ts"
Task: "Extend useCatalogSearch/discogsKeys.search in frontend/src/queries/discogsQueries.ts"
```

## Parallel Example: User Story 1

```bash
# Red tests in parallel
Task: "Create frontend/tests/unit/SearchFiltersControl.test.tsx"
Task: "Extend frontend/tests/integration/searchResultsFlow.test.tsx with single-filter cases"
Task: "Create e2e/tests/search-result-filters.spec.ts with the single-filter scenario"

# Implementation, sequential (each depends on the prior)
Task: "Create SearchFiltersControl in frontend/src/components/SearchFiltersControl.tsx"
Task: "Wire SearchFiltersControl into frontend/src/pages/SearchResultsPage.tsx"
Task: "Add the filters-aware empty-results message in frontend/src/pages/SearchResultsPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (filters flow end-to-end through backend + frontend plumbing)
3. Complete Phase 3: User Story 1 (single-filter apply + filtered empty state)
4. **Stop and validate**: confirm a single filter narrows results and the zero-match state reads correctly
5. Deploy/demo if ready — this alone delivers the feature's core value

### Incremental Delivery

1. Setup + Foundational → filters supported end-to-end, no UI yet
2. Add User Story 1 → single-filter apply works → validate → deploy/demo (MVP)
3. Add User Story 2 → multi-filter combination and partial-clear verified → validate → deploy/demo
4. Add User Story 3 → pagination/reload persistence and one-click clear verified → validate → deploy/demo
5. Polish → changelogs, version bumps, full quickstart run

---

## Notes

- `[P]` tasks touch different files and have no unfinished dependency between them
- Because the constitution requires Test-First, do not treat T005–T009, T013–T015, T019, T023–T024 as started until their paired tests (T002–T004, T010–T012, T016–T018, T020–T022 respectively) exist and fail
- US2 and US3's implementation tasks (T019, T023, T024) are deliberately framed as "verify and adjust" rather than "build new" — if `SearchFiltersControl` and `SearchResultsPage` are built generically in Phase 3, these later phases should mostly confirm behavior via their tests rather than requiring new code; keep them as their own tasks so each story remains independently verifiable even if that assumption turns out wrong
- No changes to `ReleasePreviewModal`, `SearchResultCard`, `HeaderSearchBox`, or any library/collection code — all out of scope per spec.md Assumptions (artist result-type search remains untouched)
