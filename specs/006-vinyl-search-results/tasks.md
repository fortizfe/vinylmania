---

description: "Task list template for feature implementation"
---

# Tasks: Vinyl Search Results — Cards, Actions & Pagination

**Input**: Design documents from `/specs/006-vinyl-search-results/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/discogs-api.md, quickstart.md

**Tests**: Included — constitution Principle I (Test-First, NON-NEGOTIABLE)
requires a failing test before implementation for every story.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story. User Stories 1 and 2 are both
Priority P1 in spec.md (neither alone satisfies the original request); User
Story 3 is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Existing **web app** structure: `backend/src/`, `backend/tests/` and
`frontend/src/`, `frontend/tests/`, per plan.md's Project Structure section.

---

## Phase 1: Setup

**Purpose**: N/A — no new dependency, tool, or scaffolding is required (see
research.md and plan.md's Technical Context: no new npm package on either
side; all target test/component directories already exist from prior
features). This phase is intentionally empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — there is no shared blocking infrastructure beyond what
already exists (`searchCatalog`'s `page`/`perPage` support and `getRelease`
are already implemented; only routing/UI needs to be added, and that work
belongs to the specific story that needs it). This phase is intentionally
empty.

---

## Phase 3: User Story 1 - Scan search results as clear, informative cards (Priority: P1)

**Goal**: Every search result renders as a card with its cover thumbnail,
title, artist, and release year (plus format as a secondary detail), with a
matching skeleton loading state.

**Independent Test**: Search the catalog and confirm each result renders as a
card showing a cover thumbnail (or placeholder), title, artist, and release
year (quickstart.md scenario 1).

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T001 [P] [US1] Contract test: extend
      `backend/tests/contract/discogsSearch.contract.test.ts` with two cases —
      a raw title matching `"Artist - Title"` is split into `artist`/`title`;
      a raw title with no separator keeps `title` as-is with no `artist` field
      (contracts/discogs-api.md, research.md §2)
- [X] T002 [P] [US1] Unit test for `SearchResultCard` in
      `frontend/tests/unit/SearchResultCard.test.tsx` — asserts thumbnail (or
      placeholder when absent), title, artist (when present), year, and
      format render, per contracts/discogs-api.md "SearchResultCard"
- [X] T003 [P] [US1] Unit test for `ResultCardActions` in
      `frontend/tests/unit/ResultCardActions.test.tsx` — asserts both actions
      always render in the same position, the add action shows a busy state
      while `adding` and an "added" confirmation while `added`, and the
      preview action stays independently clickable throughout, per
      contracts/discogs-api.md "ResultCardActions"

### Implementation for User Story 1

- [X] T004 [US1] Add optional `artist` field to `CatalogSearchResult` in
      `backend/src/discogs/types.ts` (depends on T001)
- [X] T005 [US1] Implement artist/title parsing in `mapSearchResult`
      (`backend/src/discogs/discogsMapper.ts`) per research.md §2 (depends on
      T004)
- [X] T006 [P] [US1] Add optional `artist` field to the frontend
      `CatalogSearchResult` type in `frontend/src/services/discogsApi.ts`
      (depends on T005's shape)
- [X] T007 [US1] Implement `ResultCardActions` in
      `frontend/src/components/ResultCardActions.tsx` per
      contracts/discogs-api.md, built on the existing `Button` atomic
      component (icon-only, inline SVGs — no new icon dependency) (depends on
      T003)
- [X] T008 [US1] Implement `SearchResultCard` in
      `frontend/src/components/SearchResultCard.tsx`, composing the existing
      `Card` + a thumbnail/placeholder + `Badge` (format) + `ResultCardActions`,
      per contracts/discogs-api.md (depends on T002, T006, T007)
- [X] T009 [US1] Implement `SearchResultCardSkeleton` in
      `frontend/src/components/SearchResultCardSkeleton.tsx`, matching
      `SearchResultCard`'s `Card`/thumbnail sizing exactly (same pattern as
      feature 004's `RecordCardSkeleton`) (depends on T008)
- [X] T010 [US1] Replace the plain results `<ul>` in
      `frontend/src/pages/AddRecordPage.tsx` with a responsive multi-column
      grid (Tailwind grid utilities) of `SearchResultCard`, showing a grid of
      `SearchResultCardSkeleton` while `loading` is true; wire temporary
      `onAdd`/`onPreview` handlers (to be replaced with real behavior in User
      Story 2) so the grid renders end-to-end (depends on T008, T009)

**Checkpoint**: User Story 1 is independently testable — searching renders a
responsive grid of information-complete cards with a matching skeleton
loading state.

---

## Phase 4: User Story 2 - Act on a result directly from its card (Priority: P1)

**Goal**: Every card's add action adds the record to the library without
navigating away (showing busy/added states), and every card's preview action
opens an overlay with the record's fuller details without adding it.

**Independent Test**: Search the catalog, use a card's add action to add a
record to the library (staying on the results), and separately use a
different card's preview action to view its full details without adding it
(quickstart.md scenario 2).

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T011 [P] [US2] Contract test for `GET /api/discogs/releases/:discogsId`
      in new file `backend/tests/contract/discogsRelease.contract.test.ts` —
      200 with the full `Release` shape, 404 `release_not_found`, 502
      `catalog_unavailable`, per contracts/discogs-api.md
- [X] T012 [P] [US2] Unit test for `Modal` in
      `frontend/tests/unit/ui/Modal.test.tsx` — renders nothing when
      `open=false`; when open, renders with `role="dialog"`/`aria-modal`, and
      calls `onClose` on backdrop click, close control, and `Escape`
      keydown, per contracts/discogs-api.md "Modal"
- [X] T013 [P] [US2] Unit test for `ReleasePreviewModal` in
      `frontend/tests/unit/ReleasePreviewModal.test.tsx` — loading state,
      populated release (cover/title/artists/tracklist), and error state when
      `release` is `null` and not loading, per contracts/discogs-api.md
- [X] T014 [P] [US2] Extend
      `frontend/tests/integration/addRecordFlow.test.tsx`: activating a
      card's add action shows a busy state then an "added" confirmation
      without navigating away from the results (FR-012); activating a card's
      preview action opens an overlay with that release's details, and
      closing it returns to the same results/page

### Implementation for User Story 2

- [X] T015 [US2] Add `GET /api/discogs/releases/:discogsId` route to
      `backend/src/routes/discogs.ts`, calling the existing `getRelease()`,
      with `requireAuth` and the same logging/error-mapping convention as
      `/api/discogs/search` per contracts/discogs-api.md (depends on T011)
- [X] T016 [US2] Add `getRelease(discogsId)` to
      `frontend/src/services/discogsApi.ts` (depends on T015)
- [X] T017 [US2] Implement `Modal` in `frontend/src/components/ui/Modal.tsx`
      per contracts/discogs-api.md (depends on T012)
- [X] T018 [US2] Implement `ReleasePreviewModal` in
      `frontend/src/components/ReleasePreviewModal.tsx`, composing `Modal`
      with the release's cover/title/artists/tracklist (reusing
      `RecordDetailPage`'s existing rendering approach for consistency)
      (depends on T013, T017)
- [X] T019 [US2] Wire `AddRecordPage`'s per-card add handler to call
      `libraryApi.create`, tracking per-card `adding`/`added` state, and
      remove the existing `navigate('/app')` call after a successful add
      (FR-012) (depends on T010, T014)
- [X] T020 [US2] Wire `AddRecordPage`'s per-card preview handler to call
      `discogsApi.getRelease` and open `ReleasePreviewModal` with the result
      (depends on T016, T018, T019)

**Checkpoint**: User Stories 1 AND 2 together deliver the realistic MVP —
informative cards with working add (stay on results) and preview (overlay)
actions.

---

## Phase 5: User Story 3 - Browse many results without endless scrolling (Priority: P2)

**Goal**: Search results are split into pages (using Discogs' own server-side
pagination), with navigation between pages and no large continuous scroll.

**Independent Test**: Run a search broad enough to return more results than
fit on one page and confirm the results are split into pages with working
navigation, resetting to page 1 on a new search (quickstart.md scenario 3).

### Tests for User Story 3 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T021 [P] [US3] Contract test: extend
      `backend/tests/contract/discogsSearch.contract.test.ts` asserting the
      route parses `page`/`perPage` query params and forwards them to
      `searchCatalog` (with sensible defaults when absent), per
      contracts/discogs-api.md
- [X] T022 [P] [US3] Extend
      `frontend/tests/integration/addRecordFlow.test.tsx`: a search with more
      results than one page shows pagination controls and a subsequent page
      loads new cards without a full reload or re-entering the search; a new
      search resets to page 1; pagination controls are hidden/disabled when
      everything fits one page

### Implementation for User Story 3

- [X] T023 [US3] Update the `/api/discogs/search` route in
      `backend/src/routes/discogs.ts` to parse and forward `page`/`perPage`
      query params to `searchCatalog`, per contracts/discogs-api.md (depends
      on T021)
- [X] T024 [US3] Update `search()` in
      `frontend/src/services/discogsApi.ts` to accept optional `page`/
      `perPage` parameters (default `perPage` to 20 per research.md §1)
      (depends on T023)
- [X] T025 [US3] Add pagination state and controls (Previous/Next, matching
      `LibraryListPage`'s existing pattern) to `AddRecordPage`, hiding/
      disabling controls when `pagination.pages <= 1` and resetting to page 1
      whenever a new search is run (depends on T024, T020)

**Checkpoint**: All three user stories are independently functional — the
full card-based, paginated, action-enabled search experience is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories

- [X] T026 [P] Verify the results grid shows visibly more cards per row on a
      wide viewport than on a narrow one, with every card fully readable at
      narrow widths (quickstart.md scenario 4); adjust Tailwind grid
      breakpoints in `AddRecordPage`/`SearchResultCard` if needed
- [X] T027 [P] Run `npm test`, `npm run lint`, and `npm run build` in both
      `backend/` and `frontend/` and confirm all pass
- [X] T028 Execute quickstart.md end-to-end (all 5 scenarios) and record the
      outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1–2)**: Empty — no shared blocking work
- **User Story 1 (Phase 3)**: No dependency on other stories
- **User Story 2 (Phase 4)**: Its add/preview wiring (T019, T020) depends on
  User Story 1's grid existing (T010, T014); its new endpoint/`Modal`/
  `ReleasePreviewModal` work (T011–T018) has no dependency on User Story 1
  and can proceed in parallel with it
- **User Story 3 (Phase 5)**: Its `AddRecordPage` pagination wiring (T025)
  depends on User Story 2's handlers being in place (T020); its
  backend/service changes (T021–T024) have no dependency on User Story 2 and
  can proceed in parallel with it
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories
- **User Story 2 (P1)**: Extends the `SearchResultCard`/`AddRecordPage` grid
  User Story 1 builds; its backend/`Modal`/`ReleasePreviewModal` pieces are
  independent of User Story 1's completion
- **User Story 3 (P2)**: Builds pagination around the grid + actions already
  wired by User Stories 1 and 2; its backend/service pieces are independent

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend type/mapper changes before frontend service changes that depend on
  their shape
- Component implementation before page-level wiring that consumes it
- Story complete before moving to the next priority (recommended order:
  US1 → US2 → US3, matching their P1/P1/P2 priorities)

### Parallel Opportunities

- T001, T002, T003 (US1 tests) can all run in parallel
- T006 (US1) can run in parallel with T007 (different files)
- T011, T012, T013, T014 (US2 tests) can all run in parallel
- T015–T018 (US2 backend/Modal/ReleasePreviewModal work) can proceed in
  parallel with User Story 1's tasks, since neither touches the other's files
- T021, T022 (US3 tests) can run in parallel
- T026 and T027 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for artist parsing in backend/tests/contract/discogsSearch.contract.test.ts"
Task: "Unit test for SearchResultCard in frontend/tests/unit/SearchResultCard.test.tsx"
Task: "Unit test for ResultCardActions in frontend/tests/unit/ResultCardActions.test.tsx"
```

## Parallel Example: User Story 2's backend/UI track vs. User Story 1

```bash
# These can run in parallel with User Story 1's tasks (different files):
Task: "Contract test for GET /api/discogs/releases/:discogsId"
Task: "Unit test for Modal in frontend/tests/unit/ui/Modal.test.tsx"
Task: "Unit test for ReleasePreviewModal in frontend/tests/unit/ReleasePreviewModal.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 3: User Story 1
2. Complete Phase 4: User Story 2
3. **STOP and VALIDATE**: Run quickstart.md scenarios 1 and 2 — this is the
   realistic MVP, since spec.md itself treats card display and card actions
   as equally essential (P1/P1)
4. Deploy/demo if ready — even without pagination (User Story 3), a modest
   result set is already fully usable

### Incremental Delivery

1. Add User Story 1 → validate independently (cards render correctly)
2. Add User Story 2 → validate independently (add/preview work) → MVP
   complete
3. Add User Story 3 → validate independently (pagination) → full feature
   complete
4. Each story adds value without breaking the previous ones or any existing
   test

### Solo Developer Strategy

Given User Story 2's backend/`Modal`/`ReleasePreviewModal` tasks (T011–T018)
don't depend on User Story 1's grid, they can be built in any order relative
to it — but wiring them into `AddRecordPage` (T019, T020) only makes sense
once User Story 1's grid exists. A practical sequence: T001–T010 (US1) →
T011–T020 (US2, its early tasks could have started earlier but this is
simpler to reason about) → T021–T025 (US3) → Polish.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle I (Test-First, NON-NEGOTIABLE) applies: every
  contract/unit/integration test task must be written and observed to fail
  before its corresponding implementation task
- FR-009 (no functional regression to existing behavior beyond what this
  feature explicitly changes) is gated by the pre-existing backend/frontend
  suites continuing to pass, extended rather than replaced
- Commit after each task or logical group, following Conventional Commits per
  the constitution's Development Workflow section
