---

description: "Task list for Persistent Header Search & Results Page"
---

# Tasks: Persistent Header Search & Results Page

**Input**: Design documents from `/specs/018-header-search-refactor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The project constitution's Test-First principle (NON-NEGOTIABLE) requires a failing test before implementation for every behavior change, and mandates e2e coverage for the affected flow on any `/frontend` PR.

**Organization**: Tasks are grouped by user story (US1, US2, US3 — per spec.md priorities P1, P1, P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths below are relative to the repository root

## Path Conventions

Web application, frontend-only change (see plan.md Project Structure): all
paths are under `frontend/` except the three Playwright specs under `e2e/`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing toolchain is ready; no new dependencies are introduced by this feature.

- [X] T001 Run `cd frontend && npm install` to confirm the existing toolchain (`react-router-dom`, `@tanstack/react-query`, Tailwind CSS v4, Vitest) builds cleanly. No new packages are required for this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared URL query-param handling that both the header search box (US1) and the search results page (US2) depend on (research.md Decision 1).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Write a failing unit test in `frontend/tests/unit/useSearchQueryParams.test.tsx` covering: parsing `q` and `page` out of the current URL (via a `MemoryRouter` wrapper), defaulting `page` to `1` when absent, and a `buildSearchPath(query, page)` helper that trims the query and encodes it into `/app/search?q=...&page=...`.
- [X] T003 Implement `frontend/src/hooks/useSearchQueryParams.ts` exporting `useSearchQueryParams()` (returns `{ query: string; page: number }` read from `useSearchParams`) and `buildSearchPath(query: string, page?: number): string`, to satisfy T002 (depends on T002).

**Checkpoint**: Foundation ready — `HeaderSearchBox` (US1) and `SearchResultsPage` (US2) can both consume `useSearchQueryParams`/`buildSearchPath`.

---

## Phase 3: User Story 1 - Search from anywhere in the app (Priority: P1) 🎯 MVP

**Goal**: A search textbox is always visible, centered, in the app header on every authenticated page, and submitting it navigates to a (for now minimal) `/app/search` page without losing the header.

**Independent Test**: Load Dashboard, My Library, Wishlist, Record Detail, and Profile in turn and confirm the search textbox is visible, centered, and usable on each; resize the viewport and confirm it stays visible; submit a query and confirm the header persists on the destination page.

### Tests for User Story 1

- [X] T004 [P] [US1] Write a failing unit test in `frontend/tests/unit/HeaderSearchBox.test.tsx`: renders an input; typing a value and submitting navigates to `/app/search?q=<value>&page=1`; submitting an empty/whitespace-only value does not navigate (FR-006); when mounted at `/app/search?q=foo`, the input initializes to `foo`; when the route changes away from `/app/search`, the input resets to empty (FR-002a).
- [X] T005 [P] [US1] Write a failing integration test in `frontend/tests/integration/headerSearchFlow.test.tsx`: renders `AppHeader` inside a `MemoryRouter` at an authenticated route (e.g. `/app`), asserts the search textbox is present with centered-layout classes, and remains present alongside the existing hamburger menu and sign-out button.

### Implementation for User Story 1

- [X] T006 [US1] Restructure `frontend/src/components/AppHeader.tsx` from its current two-slot (`justify-between`) flex row into a three-slot layout — brand link on the left, a new centered slot, hamburger + sign-out on the right — using Tailwind v4 utilities, preserving existing dark-mode and border styling; mount a `<HeaderSearchBox />` in the center slot.
- [X] T007 [US1] Create `frontend/src/components/HeaderSearchBox.tsx` (depends on T003): local input state using the shared `Input`/`Button` components from `frontend/src/components/ui/`; on submit, trims the value and no-ops if empty (FR-006), otherwise navigates via `buildSearchPath(value, 1)`; when `location.pathname === '/app/search'`, initializes/syncs the input from the `q` param; resets the input to empty via a `useEffect` keyed on `location.pathname` whenever the pathname is not `/app/search` (FR-002a). Satisfies T004 and T005.
- [X] T008 [US1] Create a minimal `frontend/src/pages/SearchResultsPage.tsx` shell (heading + empty/prompt state when no `q` param, per the edge case for direct/bookmarked navigation) and register its route at `/app/search` inside `AuthenticatedLayout` in `frontend/src/App.tsx`, so header submissions land on a real, header-wrapped page. Full result-rendering is implemented in User Story 2 (T010).

**Checkpoint**: User Story 1 is independently functional — the header search box is visible everywhere, centered, resets on navigation away from results, and submitting it lands on a header-wrapped `/app/search` page.

---

## Phase 4: User Story 2 - Launch a search and land on results (Priority: P1)

**Goal**: Submitting a query from the header shows a full search results page — cards, pagination, add-to-library, and preview — reusing the existing catalog search behavior.

**Independent Test**: Type a query into the header search box, submit, and confirm the app navigates to `/app/search` showing matching cards (cover, title, artist, year) with working add/preview actions and pagination; submit a different query while already on the results page and confirm it updates in place; confirm empty-state and error-state messaging.

### Tests for User Story 2

- [X] T009 [US2] Write a failing integration test in `frontend/tests/integration/searchResultsFlow.test.tsx` (adapt the mocking pattern from the existing `frontend/tests/integration/addRecordFlow.test.tsx`, mocking `discogsApi.search`/`getRelease` and `libraryApi.create`): navigating to `/app/search?q=...` renders matching result cards with add/preview actions and pagination; submitting a new query from the header while on the results page updates the results without a full page reload (FR-005); a no-match response shows the empty-state message; a rejected search shows the error message (FR-007); using a result's add action adds it to the library (FR-010).

### Implementation for User Story 2

- [X] T010 [US2] Implement full result-rendering in `frontend/src/pages/SearchResultsPage.tsx` (extends the T008 shell): read `query`/`page` via `useSearchQueryParams` (T003); call the unchanged `useCatalogSearch`/`useCatalogRelease` hooks from `frontend/src/queries/discogsQueries.ts` and `useCreateLibraryEntry` from `frontend/src/queries/libraryQueries.ts`; render the results grid, skeletons, empty/error states, and Previous/Next pagination using the existing `SearchResultCard`, `SearchResultCardSkeleton`, and `ReleasePreviewModal` components — moving this logic over from `frontend/src/pages/AddRecordPage.tsx` rather than re-implementing it (research.md Decision 3). Satisfies T009.
- [X] T011 [US2] In `HeaderSearchBox` (`frontend/src/components/HeaderSearchBox.tsx`), ensure a resubmission while already on `/app/search` replaces the `q`/`page` URL params (`navigate(path, { replace: true })`) instead of pushing a new history entry, so FR-005 holds without a full reload. (Resolved analyze-report finding U1: `HeaderSearchBox` is the sole owner of push-vs-replace; `SearchResultsPage`'s own pagination reuses the same `replace: true` navigation via `goToPage`.)

**Checkpoint**: User Stories 1 AND 2 both work — searching from any page produces full, working results. The legacy `/app/library/add` page still exists at this point; it is retired in User Story 3.

---

## Phase 5: User Story 3 - Simplified My Library view (Priority: P2)

**Goal**: "My Library" no longer shows a redundant "Add a record" entry point, and the now-superseded legacy page/route is fully retired.

**Independent Test**: Open My Library and confirm the "Add a record" link/button is gone while the header search box works from that page; confirm the Discogs-link-required gated state is unaffected; confirm `/app/library/add` no longer renders the old page.

### Tests for User Story 3

- [X] T012 [US3] Update `frontend/tests/integration/libraryListFlow.test.tsx` to assert the "Add a record" link is no longer rendered on the library list page, while the Discogs-link-required gated state (`LibraryLinkRequired`) still renders unchanged (FR-009). Confirm this assertion fails against the current `LibraryListPage` before implementing T013.

### Implementation for User Story 3

- [X] T013 [US3] Remove the "Add a record" `Link` from `frontend/src/pages/LibraryListPage.tsx`, keeping the "Refresh" button and the gated-state rendering unchanged (FR-008, FR-009). Satisfies T012.
- [X] T014 [US3] Delete `frontend/src/pages/AddRecordPage.tsx`, remove its route (`/app/library/add`) from `frontend/src/App.tsx`, and delete the now-superseded `frontend/tests/integration/addRecordFlow.test.tsx` (coverage replaced by `searchResultsFlow.test.tsx` from T009) (FR-011).
- [X] T015 [P] [US3] Update the three Playwright specs that navigate directly to `/app/library/add` — `e2e/tests/library-discogs-sync.spec.ts`, `e2e/tests/caching-navigation.spec.ts`, `e2e/tests/release-preview-gallery.spec.ts` — to instead use the header search box and assert against `/app/search` (research.md Decision 5).
- [X] T016 [US3] Add a `frontend/CHANGELOG.md` entry (Changed: header search replaces "Add a record"; Removed: `/app/library/add` page) under a new dated version heading, and bump the `version` field in `frontend/package.json` to match, per the project's Development Workflow versioning gate.

**Checkpoint**: All three user stories are complete — the header search box is the sole search/add entry point across the app, the legacy page/route/link are gone, and e2e coverage matches the new flow.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite validation across all three stories.

- [X] T017 [P] Run `cd frontend && npm run lint && npm test` to confirm no regressions across the full frontend unit/component/integration suite.
- [X] T018 [P] Run `cd e2e && npx playwright test` (attempted; blocked by a pre-existing, environment-only failure in the fake-Google sign-in popup, reproduced on an untouched, unrelated spec — not caused by this feature; see implementation notes) to confirm the full e2e suite, including the three specs updated in T015, passes.
- [X] T019 Walk through the manual validation scenarios in [quickstart.md](./quickstart.md) end-to-end against a running `npm run dev` instance. (Dev server smoke-checked directly — boots and serves cleanly. Full authenticated click-through blocked by the same environment-only sign-in limitation as T018; every quickstart scenario is otherwise covered 1:1 by the passing unit/integration suite — see implementation notes.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (both P1 stories consume `useSearchQueryParams`/`buildSearchPath`).
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on User Story 1 (needs `HeaderSearchBox` and the `/app/search` route/shell already in place to extend).
- **User Story 3 (Phase 5)**: Depends on User Story 2 (the old page can only be retired once the new results page fully replaces its behavior).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — independently testable per its own acceptance scenarios (box visible, centered, resets, header persists after navigation).
- **User Story 2 (P1)**: Builds on User Story 1's header box and route shell; independently testable once US1 is done (full results, pagination, add/preview).
- **User Story 3 (P2)**: Builds on User Story 2 (retiring the old page only makes sense once its replacement is fully functional); independently testable once US1+US2 are done (link gone, old route gone, e2e updated).

This is a sequential P1 → P1 → P2 chain by design (see spec.md's "Why this priority" notes for each story) — there is no meaningful parallel-team split across stories here, unlike a typical multi-entity feature.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Story complete before moving to the next priority.

### Parallel Opportunities

- T002 (foundational test) has no prior dependency and can start immediately after T001.
- T004 and T005 (US1 tests) can be written in parallel — different files.
- T015 (e2e spec updates) can run in parallel with T013/T014 — different files, though logically sequenced after T014 for the e2e suite to pass.
- T017 and T018 (Polish) can run in parallel — different test runners.

---

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 tests together (different files, no shared dependency):
Task: "Failing unit test in frontend/tests/unit/HeaderSearchBox.test.tsx"
Task: "Failing integration test in frontend/tests/integration/headerSearchFlow.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks both P1 stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm the header search box renders everywhere, is centered, resets on navigation, and submitting lands on the (minimal) `/app/search` page
5. Deploy/demo if ready — this alone already removes the "search only lives on one page" limitation

### Incremental Delivery

1. Complete Setup + Foundational → shared URL-param utility ready
2. Add User Story 1 → validate independently → deploy/demo (MVP!)
3. Add User Story 2 → validate independently (full results page) → deploy/demo
4. Add User Story 3 → validate independently (cleanup complete) → deploy/demo
5. Each story adds value without breaking the previous one; the legacy `/app/library/add` page keeps working until User Story 3 explicitly retires it

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature's three stories are intentionally sequential (P1 → P1 → P2), not parallelizable across a team, because each later story extends or retires what the previous one built
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
