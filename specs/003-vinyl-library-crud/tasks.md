---

description: "Task list template for feature implementation"
---

# Tasks: Vinyl Library CRUD

**Input**: Design documents from `/specs/003-vinyl-library-crud/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/library-api.md](./contracts/library-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED. The constitution's Principle I (Test-First,
NON-NEGOTIABLE) overrides the template default of "tests optional." Every
implementation task below is preceded by a test task that must be written
and failing first.

**Organization**: Tasks are grouped by user story (from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every description

## Path Conventions

Both existing projects are extended: `backend/src/library/`,
`backend/src/routes/`, `backend/tests/{contract,unit,integration}/`,
`frontend/src/{components,pages,services}/`, `frontend/tests/{unit,integration}/`.

---

## Phase 1: Setup

**Purpose**: Scaffold the new module/file layout in both projects (no new
dependencies needed per research.md)

- [X] T001 Create the `backend/src/library/` directory with empty `types.ts`, `concurrency.ts`, `libraryService.ts`, `libraryEnrichment.ts` files, and empty `backend/src/routes/library.ts` and `backend/src/routes/discogs.ts` files, per [plan.md](./plan.md#project-structure)
- [X] T002 [P] Create empty `frontend/src/services/apiClient.ts`, `frontend/src/services/libraryApi.ts`, `frontend/src/services/discogsApi.ts`, `frontend/src/components/AppHeader.tsx`, `frontend/src/components/RecordCard.tsx`, `frontend/src/pages/LibraryListPage.tsx`, `frontend/src/pages/AddRecordPage.tsx`, and `frontend/src/pages/RecordDetailPage.tsx` files, per [plan.md](./plan.md#project-structure)

**Checkpoint**: Module skeletons exist in both projects.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement the `mapWithConcurrency(items, limit, fn)` helper in `backend/src/library/concurrency.ts` per [research.md](./research.md#3-enriching-a-page-of-entries-without-exceeding-discogs-rate-limit)
- [X] T004 [P] Define `LibraryEntry` and `EnrichedLibraryEntry` TypeScript types in `backend/src/library/types.ts` per [data-model.md](./data-model.md)
- [X] T005 Implement raw Firestore CRUD in `backend/src/library/libraryService.ts` — `createEntry`, `getEntry`, `listEntries` (paginated), `updateEntry`, `deleteEntry`, all scoped to `users/{uid}/libraryEntries` (depends on T004)
- [X] T006 Implement `backend/src/library/libraryEnrichment.ts` — `enrichEntry(entry)` (single, calls feature 002's `getRelease`, catches `DiscogsNotFoundError`/`DiscogsRateLimitError`/`DiscogsUnavailableError` into `catalogStatus: 'unavailable'`) and `enrichEntries(entries)` (uses `mapWithConcurrency` with limit 5) (depends on T003, T004)
- [X] T007 [P] Implement `authorizedFetch(path, options)` in `frontend/src/services/apiClient.ts` — attaches the current Firebase user's ID token as a Bearer header, per [research.md](./research.md#7-frontend-api-call-helper)
- [X] T008 [P] Implement `AppHeader.tsx` (sign-out button using `AuthContext`'s `signOut`, and a link back to `/app`) in `frontend/src/components/AppHeader.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Add a record to my library by searching Discogs (Priority: P1) 🎯 MVP

**Goal**: A signed-in collector searches Discogs, picks a result, and it's
added to their library.

**Independent Test**: Search for a well-known release, select it, and
confirm a new `LibraryEntry` now exists for the caller.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T009 [P] [US1] Contract test: `GET /api/discogs/search` happy path, 401 (missing token), and 502 `catalog_unavailable`, `nock`-mocked, in `backend/tests/contract/discogsSearch.contract.test.ts`
- [X] T010 [P] [US1] Contract test: `POST /api/library` happy path (201, verifies the release first), 404 `release_not_found`, and 502 `catalog_unavailable`, `nock`-mocked against the Firestore emulator, in `backend/tests/contract/library.contract.test.ts`
- [X] T011 [P] [US1] Live integration test: `POST /api/library` against the Firestore emulator and the real Discogs release ID `1`, confirming a document is created under `users/{uid}/libraryEntries`, in `backend/tests/integration/library.integration.test.ts`
- [X] T012 [P] [US1] Frontend integration test: `AddRecordPage` search → select → add flow (mocked `discogsApi`/`libraryApi`) confirms a success state after adding, in `frontend/tests/integration/addRecordFlow.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Implement `GET /api/discogs/search` in `backend/src/routes/discogs.ts` — `requireAuth`, calls feature 002's `searchCatalog`, maps `DiscogsRateLimitError`/`DiscogsUnavailableError` to a 502 `catalog_unavailable` response (depends on T009)
- [X] T014 [US1] Implement `POST /api/library` in `backend/src/routes/library.ts` — `requireAuth`, calls `getRelease` to verify the release exists (404 `release_not_found` / 502 `catalog_unavailable` on failure), then `libraryService.createEntry`, and returns the `EnrichedLibraryEntry` built from the already-fetched release (depends on T005, T006, T010)
- [X] T015 [US1] Mount the `discogs` and `library` routers in `backend/src/app.ts` (depends on T013, T014)
- [X] T016 [US1] Implement `discogsApi.search(query, resultType)` in `frontend/src/services/discogsApi.ts` using `authorizedFetch` (depends on T007)
- [X] T017 [US1] Implement `libraryApi.create(discogsReleaseId, condition?, notes?)` in `frontend/src/services/libraryApi.ts` using `authorizedFetch` (depends on T007)
- [X] T018 [US1] Implement `AddRecordPage.tsx` (search input, result list, select-and-add action, loading/error states) in `frontend/src/pages/AddRecordPage.tsx` (depends on T016, T017)
- [X] T019 [US1] Wire the `/app/add` route in `frontend/src/App.tsx` (depends on T018)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - View my library (Priority: P1)

**Goal**: A signed-in collector sees every record in their library, each
enriched with live Discogs data.

**Independent Test**: With existing library entries, open the library and
confirm all of them are listed with recognizable information; with none,
confirm a clear empty state.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T020 [P] [US2] Contract test: `GET /api/library` happy path (paginated, mixed `catalogStatus` ok/unavailable), `nock`-mocked against the Firestore emulator, in `backend/tests/contract/library.contract.test.ts`
- [X] T021 [P] [US2] Unit test: `enrichEntries` merges a page of raw entries correctly, including one whose Discogs fetch fails (→ `catalogStatus: 'unavailable'`, `release: null`) without affecting the others, in `backend/tests/unit/libraryEnrichment.test.ts`
- [X] T022 [P] [US2] Frontend unit test: `RecordCard` renders title/artist/cover for an `'ok'` entry and a "couldn't load catalog details" state for an `'unavailable'` one, in `frontend/tests/unit/RecordCard.test.tsx`
- [X] T023 [P] [US2] Frontend integration test: `LibraryListPage` renders entries from a mocked `libraryApi.list`, and a clear empty state when there are none, in `frontend/tests/integration/libraryListFlow.test.tsx`

### Implementation for User Story 2

- [X] T024 [US2] Implement `GET /api/library` in `backend/src/routes/library.ts` — `requireAuth`, reads `page`/`pageSize` query params, calls `libraryService.listEntries` then `libraryEnrichment.enrichEntries` (depends on T005, T006, T020)
- [X] T025 [US2] Implement `RecordCard.tsx` (title/artist/cover/condition summary, unavailable state) in `frontend/src/components/RecordCard.tsx` (depends on T022)
- [X] T026 [US2] Implement `libraryApi.list(page?, pageSize?)` in `frontend/src/services/libraryApi.ts` using `authorizedFetch` (depends on T007)
- [X] T027 [US2] Implement `LibraryListPage.tsx` (fetch and render the list, empty state, pagination controls, link to `/app/add`) in `frontend/src/pages/LibraryListPage.tsx` (depends on T025, T026)
- [X] T028 [US2] Wire `/app` to `LibraryListPage` wrapped in `AppHeader`, replacing `AuthenticatedPlaceholderPage`, in `frontend/src/App.tsx` (depends on T008, T027)

**Checkpoint**: User Stories 1 AND 2 both work independently — a collector can add records and see their library.

---

## Phase 5: User Story 3 - View a single record's full detail (Priority: P2)

**Goal**: A signed-in collector opens one record and sees its full Discogs
detail plus their own condition/notes.

**Independent Test**: Open a record from the library and confirm both its
full catalog detail and personal information are shown together; confirm
another collector's entry ID returns "not found."

### Tests for User Story 3 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T029 [P] [US3] Contract test: `GET /api/library/:id` happy path and 404 `entry_not_found` (including an ID belonging to a different user), `nock`-mocked against the Firestore emulator, in `backend/tests/contract/library.contract.test.ts`
- [X] T030 [P] [US3] Frontend integration test: `RecordDetailPage` shows merged release detail plus personal notes, and a not-found state, in `frontend/tests/integration/recordDetailFlow.test.tsx`

### Implementation for User Story 3

- [X] T031 [US3] Implement `GET /api/library/:id` in `backend/src/routes/library.ts` — `requireAuth`, calls `libraryService.getEntry` scoped to the caller then `libraryEnrichment.enrichEntry`, 404 if absent (depends on T005, T006, T029)
- [X] T032 [US3] Implement `libraryApi.getOne(entryId)` in `frontend/src/services/libraryApi.ts` using `authorizedFetch` (depends on T007)
- [X] T033 [US3] Implement the detail portion of `RecordDetailPage.tsx` (fetch and render merged release + personal info, not-found state) in `frontend/src/pages/RecordDetailPage.tsx` (depends on T025, T032)
- [X] T034 [US3] Wire the `/app/records/:entryId` route in `frontend/src/App.tsx` and link each `RecordCard` to it (depends on T028, T033)

**Checkpoint**: User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Remove a record from my library (Priority: P2)

**Goal**: A signed-in collector removes a record, with confirmation, and it
no longer appears afterward.

**Independent Test**: Remove a record and confirm it's gone from the
library; confirm removing another collector's entry ID is denied.

### Tests for User Story 4 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T035 [P] [US4] Contract test: `DELETE /api/library/:id` happy path (204) and 404 `entry_not_found` (including a different user's ID), `nock`-mocked against the Firestore emulator, in `backend/tests/contract/library.contract.test.ts`
- [X] T036 [P] [US4] Frontend integration test: `RecordDetailPage` delete flow — confirmation prompt, then navigation back to `/app` with the record no longer listed, in `frontend/tests/integration/recordDetailFlow.test.tsx`

### Implementation for User Story 4

- [X] T037 [US4] Implement `DELETE /api/library/:id` in `backend/src/routes/library.ts` — `requireAuth`, calls `libraryService.deleteEntry` scoped to the caller, 404 if absent (depends on T005, T035)
- [X] T038 [US4] Implement `libraryApi.remove(entryId)` in `frontend/src/services/libraryApi.ts` using `authorizedFetch` (depends on T007)
- [X] T039 [US4] Add a delete control with a confirmation prompt to `RecordDetailPage.tsx`, navigating back to `/app` on success (depends on T033, T038)

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Update my personal notes on a record (Priority: P3)

**Goal**: A signed-in collector edits their condition/notes for a record
they own, and the change persists.

**Independent Test**: Change a record's condition/notes and confirm the
update is reflected when viewing that record again.

### Tests for User Story 5 ⚠️

> Write these tests FIRST, and confirm they FAIL before implementation.

- [X] T040 [P] [US5] Contract test: `PATCH /api/library/:id` happy path and 404 `entry_not_found`, `nock`-mocked against the Firestore emulator, in `backend/tests/contract/library.contract.test.ts`
- [X] T041 [P] [US5] Frontend integration test: `RecordDetailPage` edit flow persists condition/notes and reflects the change after reload, in `frontend/tests/integration/recordDetailFlow.test.tsx`

### Implementation for User Story 5

- [X] T042 [US5] Implement `PATCH /api/library/:id` in `backend/src/routes/library.ts` — `requireAuth`, calls `libraryService.updateEntry` scoped to the caller, 404 if absent (depends on T005, T040)
- [X] T043 [US5] Implement `libraryApi.update(entryId, condition?, notes?)` in `frontend/src/services/libraryApi.ts` using `authorizedFetch` (depends on T007)
- [X] T044 [US5] Add an edit form (condition select using the standard grading terms, notes textarea) to `RecordDetailPage.tsx` (depends on T033, T043)

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening across all user stories

- [X] T045 [P] Run the manual validation script in [quickstart.md](./quickstart.md#validate-manually-end-to-end) — all 5 stories, cross-user isolation, and Discogs-unavailable degradation
- [X] T046 [P] Verify no secrets are newly introduced and `.gitignore` still covers everything relevant (no new environment variables are expected per research.md)
- [X] T047 Run the full backend and frontend test suites and confirm every test passes
- [X] T048 [P] Add a short "Manage your library" pointer to the project README linking to [quickstart.md](./quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational only — shares `backend/src/routes/library.ts` and `frontend/src/App.tsx` with US1, so implement after US1 in practice even though independently testable
- **User Story 3 (Phase 5)**: Depends on Foundational, and in practice follows US2 (reuses `RecordCard`, needs `/app` wired first for navigation)
- **User Story 4 (Phase 6)**: Depends on Foundational, and in practice follows US3 (extends `RecordDetailPage.tsx`)
- **User Story 5 (Phase 7)**: Depends on Foundational, and in practice follows US4 (extends `RecordDetailPage.tsx` again)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No logical dependency on other stories
- **User Story 2 (P1)**: No logical dependency on other stories
- **User Story 3 (P2)**: No logical dependency on other stories
- **User Story 4 (P2)**: No logical dependency on other stories
- **User Story 5 (P3)**: No logical dependency on other stories
- All five are independently testable per their "Independent Test" above, but
  because they share a small number of files (`library.ts` route file,
  `RecordDetailPage.tsx`), implement them in priority order (US1 → US2 → US3
  → US4 → US5) rather than truly in parallel.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- Backend: service layer → enrichment/route → router mounting
- Frontend: API-service function → page/component
- Story complete before moving to the next priority

### Parallel Opportunities

- Setup: T001 and T002 can run in parallel
- Foundational: T004, T007, T008 can run in parallel; T003 and T005/T006 have
  their own internal ordering (T005 needs T004; T006 needs T003 and T004)
- Within each user story, the listed test tasks touch different files and
  can run in parallel with each other; the contract-test tasks for US2–US5
  append to the same `library.contract.test.ts` file used in US1, so treat
  cross-story contract-test edits as sequential, not parallel, across
  phases (they already are, since phases run in order)
- Frontend `RecordDetailPage.tsx` and its `recordDetailFlow.test.tsx` test
  file are extended across US3, US4, and US5 — sequential across those
  phases, not parallel

---

## Parallel Example: User Story 2

```bash
# These can run in parallel (different files):
Task: "Contract test: GET /api/library happy path in backend/tests/contract/library.contract.test.ts"
Task: "Unit test: enrichEntries merges a page including one failed lookup in backend/tests/unit/libraryEnrichment.test.ts"
Task: "Frontend unit test: RecordCard renders ok/unavailable states in frontend/tests/unit/RecordCard.test.tsx"
Task: "Frontend integration test: LibraryListPage renders entries and empty state in frontend/tests/integration/libraryListFlow.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (add via search)
4. Complete Phase 4: User Story 2 (view library)
5. **STOP and VALIDATE**: a collector can add records and see them listed —
   this is the first genuinely useful increment
6. Demo if ready — note that detail view, delete, and edit aren't available yet

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → demo
3. Add User Story 2 → validate independently → demo (MVP: add + view)
4. Add User Story 3 → validate independently → demo (full detail view)
5. Add User Story 4 → validate independently → demo (can remove records)
6. Add User Story 5 → validate independently → demo (full CRUD complete)
7. Polish → quickstart validation, secrets check, full suite green

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] labels map every implementation task back to spec.md's user stories
- Commit after each task or logical group, using Conventional Commits per the constitution
- Tests must fail before their corresponding implementation task is started
- Avoid: vague tasks, two tasks editing the same file in parallel, cross-story dependencies that break independent testability (beyond the noted shared-file caution above)
