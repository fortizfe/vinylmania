# Tasks: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

**Input**: Design documents from `/specs/052-grid-list-view-toggle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and REQUIRED — the project constitution makes Test-First non-negotiable (Principle I), this feature changes a public API contract (`GET /api/discogs/search`), and it changes rendered/interactive behavior on two existing screens, which triggers the mandatory e2e coverage gate for `/frontend` changes (Development Workflow).

**Organization**: Tasks are grouped by user story from spec.md — all three (US1, US2, US3) are Priority P1. US1 (toggle + persistence) is the spec's own documented functional prerequisite for US2 and US3 (see spec.md "Why this priority" for both), so US2/US3 build on US1's output rather than being fully independent of it; each is still independently testable once US1 exists.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[US1]/[US2]/[US3]**: Maps to the matching user story in spec.md
- Every task includes an exact file path

## Path Conventions

Web application per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean pre-change baseline for every suite this feature touches

- [X] T001 [P] Run the current targeted suites as a baseline check: `frontend/tests/unit/SearchResultCard.test.tsx`, `frontend/tests/unit/RecordCard.test.tsx`, `frontend/tests/unit/ThemeToggle.test.tsx`, `frontend/tests/integration/searchResultsFlow.test.tsx`, `frontend/tests/integration/libraryListFlow.test.tsx`, `backend/tests/unit/discogsCatalog/adapters/discogsMapper.test.ts` — confirm all pass before any change

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No cross-story infrastructure is required beyond Setup. User Story 1 (Phase 3) itself creates the shared toggle control, the persistence hook, and the first-pass list-row components that User Stories 2 and 3 extend — this is the spec's own documented dependency (see spec.md "Why this priority" for US2/US3), so it is tracked as Phase 3's job rather than duplicated here.

**⚠️ CRITICAL**: No fabricated tasks are added to this phase — see rationale above.

**Checkpoint**: Setup complete — proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Control para alternar entre carátula y lista (Priority: P1) 🎯 MVP

**Goal**: A two-option toggle (grid/list) appears top-right on both `SearchResultsPage` and `LibraryListPage`, switches presentation instantly without losing already-loaded data, persists independently per screen in `localStorage`, defaults to grid, and is keyboard/screen-reader accessible with 44×44px touch targets.

**Independent Test**: Open each screen, toggle to list and back, confirm no reload/data loss, reload the page and confirm the last mode is remembered per screen independently, and confirm the toggle is keyboard-operable — all observable without the list row showing its full six-field content yet (spec.md US1 "Independent Test").

### Tests for User Story 1 ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T002 [P] [US1] Create `frontend/tests/unit/useViewModePreference.test.ts`: defaults to `'grid'` when the given `localStorage` key is absent or holds a value other than `'grid'`/`'list'`; `setMode` updates the returned state and writes through to that key; two hook instances created with different keys never share state (spec FR-003, FR-004; contract `useViewModePreference` in `contracts/view-mode-toggle-ui.md`)
- [X] T003 [P] [US1] Create `frontend/tests/unit/ViewModeToggle.test.tsx`: renders `role="radiogroup"` (`data-testid="view-mode-toggle"`) with two `role="radio"` options (`data-testid="view-mode-grid"`/`"view-mode-list"`); `aria-checked` reflects the `mode` prop; clicking the inactive option calls `onChange` with the new mode exactly once; clicking the active option is a no-op; both options render with the 44px minimum-size utility class; pressing the arrow key while the active option is focused moves focus to and activates the other option (roving `tabIndex`, only the active option has `tabIndex={0}`), verified via RTL `fireEvent.keyDown` (spec US1 AC3, AC9, AC10, FR-015; contract `ViewModeToggle`)
- [X] T004 [P] [US1] Create `frontend/tests/unit/RecordListRow.test.tsx` (minimal first pass): renders the cover image, title, and artist for a library entry; wraps the row in a link to `/app/library/records/{id}` and navigates there on click; shows the existing "Couldn't load catalog details for this record right now." copy and "Open record" link when `catalogStatus === 'unavailable'` (spec FR-009, FR-010)
- [X] T005 [P] [US1] Create `frontend/tests/unit/SearchResultListRow.test.tsx` (minimal first pass): renders cover, title, artist, and navigates to the release/master detail route on click for a `resultType: 'release'` result; renders the stacked-cover treatment (`data-testid="search-result-stacked-covers"`) and a "Multiple editions" badge, with no navigation-blocking elements, for a `resultType: 'master'` result (spec FR-009, FR-012)
- [X] T006 [P] [US1] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: the toggle renders top-right next to the page title; clicking "List" swaps `search-results-grid` for `search-results-list` immediately with no new network request and without losing already-loaded (incl. infinite-scroll-loaded) results; clicking "Grid" swaps back; while results are loading in list mode, the loading state renders with `data-testid="search-results-skeleton"` shaped as rows (not grid cards), per the constitution's "skeleton mirrors final content shape" rule (spec US1 AC1, AC4, AC5)
- [X] T007 [P] [US1] Extend `frontend/tests/integration/libraryListFlow.test.tsx`: the toggle renders in the existing header row beside the "Refresh" button; switching modes preserves already-loaded records and does not change pagination/filter/refresh behavior; while records are loading in list mode, the loading state renders row-shaped skeletons instead of grid-card skeletons, per the constitution's "skeleton mirrors final content shape" rule (spec US1 AC2, AC11)
- [X] T008 [P] [US1] Create `e2e/tests/view-mode-toggle.spec.ts`: mode chosen on one screen persists across reload and is independent of the other screen's mode (spec US1 AC6, AC7, AC8); a first-time visit to either screen defaults to grid (AC8); both toggle options measure at least 44×44px at mobile viewport width, mirroring the `boundingBox()` assertion already used against `ThemeToggle` in `e2e/tests/profile-responsive.spec.ts`; the toggle can be reached and operated with keyboard only (`Tab` to focus, arrow keys to move between options, `Enter`/`Space` to activate) with no mouse interaction (spec US1 AC9, AC10, FR-015; quickstart Scenario 1)

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `frontend/src/hooks/useViewModePreference.ts` implementing the hook contract in `contracts/view-mode-toggle-ui.md` (lazy-init read from `localStorage`, write-through `setMode`, default `'grid'`) (depends on T002 failing first)
- [X] T010 [P] [US1] Create `frontend/src/components/ui/ViewModeToggle.tsx`: two-option `role="radiogroup"` control with roving `tabIndex`, reusing `ThemeToggle.tsx`'s 44px sizing and `focus-visible:ring` utility classes, with hand-rolled inline SVG grid/list icons (no new icon library, per research R2) (depends on T003 failing first)
- [X] T011 [P] [US1] Create `frontend/src/components/RecordListRow.tsx` (minimal first pass: cover, emphasized title, emphasized artist, unavailable-catalog fallback, click-through link) per contract `RecordListRow` in `contracts/view-mode-toggle-ui.md` — format/country/year/label fields are added in User Story 2 (depends on T004 failing first)
- [X] T012 [P] [US1] Create `frontend/src/components/SearchResultListRow.tsx` (minimal first pass: cover, emphasized title, emphasized artist, master/grouped simplified row, click-through link) per contract `SearchResultListRow` in `contracts/view-mode-toggle-ui.md` — format/country/year/labels, "Add to library", and the rating badge are added in User Story 3 (depends on T005 failing first)
- [X] T013 [P] [US1] Create `frontend/src/components/RecordListRowSkeleton.tsx`, mirroring `RecordCardSkeleton.tsx`'s use of the shared `frontend/src/components/ui/Skeleton.tsx` atom but shaped as a horizontal row, per the constitution's "skeleton mirrors final content shape" rule (depends on T007 failing first)
- [X] T014 [P] [US1] Create `frontend/src/components/SearchResultListRowSkeleton.tsx`, mirroring `SearchResultCardSkeleton.tsx`'s use of the shared `Skeleton` atom but shaped as a horizontal row (depends on T006 failing first)
- [X] T015 [US1] Wire `ViewModeToggle` + `useViewModePreference('vinylmania:view-mode:library')` into `frontend/src/pages/LibraryListPage.tsx`'s existing header row (beside "Refresh"); branch the record list between the existing grid (`library-record-grid`, `RecordCard`/`RecordCardSkeleton`) and a new `<ul data-testid="library-record-list">` of `RecordListRow`/`RecordListRowSkeleton`, leaving pagination/filter/refresh logic untouched (depends on T009, T010, T011, T013, T007)
- [X] T016 [US1] Wire `ViewModeToggle` + `useViewModePreference('vinylmania:view-mode:search')` into `frontend/src/pages/SearchResultsPage.tsx`: introduce a `flex items-center justify-between` header row (title + toggle), matching the pattern already used on `LibraryListPage`; branch results between the existing grid (`search-results-grid`, `SearchResultCard`/`SearchResultCardSkeleton`) and a new `<ul data-testid="search-results-list">` of `SearchResultListRow`/`SearchResultListRowSkeleton`, leaving infinite-scroll/loading-more/error-retry logic untouched (depends on T009, T010, T012, T014, T006)

**Checkpoint**: User Story 1 is fully functional and independently testable — toggle, persistence, accessibility, touch targets, and a minimal (cover+title+artist) list mode work on both screens without breaking any existing behavior.

---

## Phase 4: User Story 2 - Vista en modo lista en Mi biblioteca (Priority: P1)

**Goal**: The library list-mode row shows all six fields (cover, title, artist, format, country, year, label) with title/artist emphasized, multi-value fields comma-joined, missing optional fields cleanly omitted, and correct mobile behavior.

**Independent Test**: Switch Mi biblioteca to list mode (via User Story 1's toggle) with library entries loaded and confirm each row shows the full field set correctly, including an entry with multiple labels/formats/artists and an entry missing a field (quickstart Scenario 2).

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Extend `frontend/tests/unit/RecordListRow.test.tsx`: renders format, country, year, and label beside the emphasized title/artist; an entry with more than one format/label/artist shows all values comma-joined (not just the first) (spec FR-007); an entry missing country or label omits that field with no empty gap or `"undefined"` text (spec FR-008); the community rating badge renders overlaid on the cover, matching grid mode (spec FR-018)
- [X] T018 [P] [US2] Extend `e2e/tests/library-list-responsive.spec.ts`: list mode shows all six fields per row; Previous/Next pagination still works in list mode; at mobile viewport width there is no horizontal scroll and title/artist remain legible (spec US2 AC8, AC9; quickstart Scenario 2)
- [X] T019 [P] [US2] Extend `e2e/tests/library-filters.spec.ts`: applying/clearing Format/Genre/Style filters and the empty-library/no-matches states behave identically whether the active mode is grid or list (spec US2 AC7, FR-014)

### Implementation for User Story 2

- [X] T020 [US2] Extend `frontend/src/components/RecordListRow.tsx` to render `release.formats.map(f => f.name).join(', ')`, `release.country`, `release.year`, and `release.labels.map(l => l.name).join(', ')` in secondary style beside the emphasized title/artist, omitting any field that is missing/empty (spec FR-005, FR-006, FR-007, FR-008) (depends on T017 failing first)
- [X] T021 [US2] Add the community-rating badge overlay to `RecordListRow.tsx`'s cover, reusing the existing rating-badge component unchanged (spec FR-018) (depends on T020)
- [X] T022 [US2] Apply mobile-responsive sizing to `RecordListRow.tsx` (cover shrinks first, title/artist stay legible, no horizontal scroll), reusing Tailwind's existing responsive utilities per the constitution's dual-layout rule (spec FR-017) (depends on T020)

**Checkpoint**: User Stories 1 AND 2 both work independently — Mi biblioteca's list mode is feature-complete.

---

## Phase 5: User Story 3 - Vista en modo lista en Resultados de búsqueda (Priority: P1)

**Goal**: The search-results list-mode row shows the same six fields as the library (requiring a backend extension to capture `country`/`labels`), preserves "Add to library" and its states, shows master/grouped results as a simplified row, and keeps infinite scroll/filters/errors working identically to grid mode.

**Independent Test**: With the backend extension deployed, switch Resultados de búsqueda to list mode (via User Story 1's toggle) with results loaded and confirm individual results show all six fields, a master result shows the simplified row, "Add to library" works from the row, and infinite scroll/filters/errors are unaffected (quickstart Scenario 3).

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Extend `backend/tests/unit/discogsCatalog/adapters/discogsMapper.test.ts`: `mapSearchResult` includes `country` (string) and `labels` (string array) on the mapped result when the raw Discogs payload has them; omits both fields entirely (not `null`/`[]`) when absent; a raw `master`-type result maps with `country`/`labels` absent regardless of payload content (spec FR-012, FR-013; `data-model.md` §3; contract `discogs-search-api.md`)
- [X] T024 [P] [US3] Extend `frontend/tests/unit/SearchResultListRow.test.tsx`: renders format, country, year, and labels (comma-joined when more than one) beside the emphasized title/artist for a `release` result, omitting any missing field cleanly (spec FR-005, FR-006, FR-007, FR-008); renders "Add to library" with its "adding…"/"added" states inside the row, and clicking it does not trigger row navigation (spec FR-011); the community rating badge renders overlaid on the cover (spec FR-018)
- [X] T025 [P] [US3] Extend `e2e/tests/search-results-responsive.spec.ts`: list mode shows all six fields for individual results and the simplified row for master results; infinite scroll continues to load more rows including "loading more" and "no more results" states; at mobile viewport width there is no horizontal scroll and title/artist remain legible (spec US3 AC6, AC9; quickstart Scenario 3)
- [X] T026 [P] [US3] Extend `e2e/tests/search-result-filters.spec.ts`: applying Format/Genre/Style filters, the no-results state, and a next-page load error + "Retry" all behave identically whether the active mode is grid or list (spec US3 AC7, AC8, FR-014)

### Implementation for User Story 3

- [X] T027 [US3] Extend `CatalogSearchResult` in `backend/src/domain/discogsCatalog/types.ts` with `country?: string` and `labels?: string[]` (data-model.md §2) — must land before T028 so `mapSearchResult`'s `CatalogSearchResult`-typed return value type-checks once it starts populating these fields (depends on T023 failing first)
- [X] T028 [US3] Extend `rawSearchResultSchema` and `mapSearchResult` in `backend/src/adapters/discogsCatalog/discogsMapper.ts`: add `country: z.string().optional()` and `label: z.array(z.string()).optional()` to the raw schema, and conditionally spread `country`/`labels` (mapped from raw `label`) onto the mapped result, following the existing conditional-spread pattern used for `year`/`formats` (spec FR-013; `data-model.md` §3; research R3) (depends on T023 failing first, T027)
- [X] T029 [P] [US3] Extend `CatalogSearchResult` in `frontend/src/services/discogsApi.ts` with the matching `country?: string` and `labels?: string[]` fields (data-model.md §2) — only mirrors T027's field names (no import relationship between the two codebases), so it can be written in parallel with T028's mapper implementation (depends on T027)
- [X] T030 [US3] Extend `frontend/src/components/SearchResultListRow.tsx` to render `result.formats?.join(', ')`, `result.country`, `result.year`, and `result.labels?.join(', ')` in secondary style beside the emphasized title/artist for `release` results, omitting any missing field cleanly (spec FR-005, FR-006, FR-007, FR-008) (depends on T024 failing first, T028, T029)
- [X] T031 [US3] Add the existing `ResultCardActions` component ("Add to library", unchanged) into `SearchResultListRow.tsx` for `release` results, ensuring its click is not treated as a row-navigation click (spec FR-011) (depends on T030)
- [X] T032 [US3] Add the community-rating badge overlay to `SearchResultListRow.tsx`'s cover, reusing the existing rating-badge component unchanged (spec FR-018) (depends on T030)
- [X] T033 [US3] Apply mobile-responsive sizing to `SearchResultListRow.tsx` (spec FR-017) (depends on T030)

**Checkpoint**: All three user stories are independently functional — the feature is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm nothing outside the three stories regressed, and close out constitution/spec-level gates that span all of them

- [ ] T034 [P] Run the full regression suites referenced in `quickstart.md` ("Full regression check"): `cd frontend && npm run test:unit`, `cd backend && npm run test`, `cd e2e && npx playwright test search-result-filters.spec.ts library-filters.spec.ts`
- [X] T035 [P] Diff `frontend/package.json` and `backend/package.json` to confirm no new production dependency was introduced (constitution Technology Stack gate; research R2)
- [ ] T036 Manually verify with a real screen reader (e.g. VoiceOver/NVDA) that `ViewModeToggle`'s active option is announced correctly on both screens — keyboard operation itself is already covered by automated tests (T003, T008); this task is the supplementary real-assistive-technology check jsdom/Playwright can't fully substitute for (spec FR-015)
- [ ] T037 Run all four `quickstart.md` scenarios end-to-end manually (toggle/persistence, library list mode, search list mode + backend contract, cross-cutting edge cases)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Empty (see rationale above) — proceed directly from Setup to User Story 1.
- **User Story 1 (Phase 3)**: Depends on Setup. Unlike a typical spec-kit feature, US2 and US3 both depend on US1's output (the toggle, the hook, and the first-pass row components) — this mirrors the spec's own documented priority rationale, not an artificial constraint.
- **User Story 2 (Phase 4)**: Depends on User Story 1 (extends `RecordListRow.tsx` created there). Independent of User Story 3.
- **User Story 3 (Phase 5)**: Depends on User Story 1 (extends `SearchResultListRow.tsx` created there). Independent of User Story 2.
- **Polish (Phase 6)**: Depends on User Stories 1–3 being complete.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution Principle I).
- Hook/component creation before page wiring.
- Backend domain-type change before the mapper implementation that populates it, before the frontend type that mirrors it (User Story 3: T027 → T028; T027 → T029).
- Story complete (checkpoint) before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (only one here).
- All User Story 1 test tasks (T002–T008) can run in parallel — different files, no dependency on unfinished tasks.
- T009–T014 (User Story 1 implementation) can run in parallel — six different files, each depending only on its own failing test.
- T015 and T016 (page wiring) touch different files (`LibraryListPage.tsx`, `SearchResultsPage.tsx`) and can run in parallel once their respective dependencies are met.
- User Story 2 and User Story 3 can be worked on in parallel by different developers once User Story 1's checkpoint is reached (they touch entirely different files: `RecordListRow.tsx` vs. `SearchResultListRow.tsx` + backend).
- Within User Story 3, T029 (frontend type) depends only on T027 (backend domain type) and can therefore run in parallel with T028 (mapper implementation) — both only need T027's field names decided. T023–T026 (all four test tasks) can also run in parallel with each other.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create frontend/tests/unit/useViewModePreference.test.ts"
Task: "Create frontend/tests/unit/ViewModeToggle.test.tsx"
Task: "Create frontend/tests/unit/RecordListRow.test.tsx (minimal)"
Task: "Create frontend/tests/unit/SearchResultListRow.test.tsx (minimal)"
Task: "Extend frontend/tests/integration/searchResultsFlow.test.tsx"
Task: "Extend frontend/tests/integration/libraryListFlow.test.tsx"
Task: "Create e2e/tests/view-mode-toggle.spec.ts"

# Launch all implementation for User Story 1 together (after their tests fail):
Task: "Create frontend/src/hooks/useViewModePreference.ts"
Task: "Create frontend/src/components/ui/ViewModeToggle.tsx"
Task: "Create frontend/src/components/RecordListRow.tsx (minimal)"
Task: "Create frontend/src/components/SearchResultListRow.tsx (minimal)"
Task: "Create frontend/src/components/RecordListRowSkeleton.tsx"
Task: "Create frontend/src/components/SearchResultListRowSkeleton.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Skip Phase 2 (empty).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
5. Deploy/demo if ready — both screens already have a working (minimal) list mode.

### Incremental Delivery

1. Setup → Foundation ready (trivially, via Phase 3).
2. Add User Story 1 → validate independently → deploy/demo (MVP: toggle + minimal list mode on both screens).
3. Add User Story 2 → validate independently → deploy/demo (Mi biblioteca's list mode is feature-complete).
4. Add User Story 3 → validate independently → deploy/demo (Resultados de búsqueda's list mode is feature-complete; feature done).

### Parallel Team Strategy

With multiple developers:

1. One developer completes Setup + User Story 1 (the shared prerequisite).
2. Once User Story 1's checkpoint is reached:
   - Developer A: User Story 2 (`RecordListRow.tsx` extension, library e2e).
   - Developer B: User Story 3 (backend mapper/types, `SearchResultListRow.tsx` extension, search e2e).
3. Both stories complete and integrate independently — they touch disjoint files.

---

## Notes

- [P] tasks = different files, no dependency on unfinished tasks.
- [Story] label maps task to specific user story for traceability.
- User Story 1 is an atypical "foundational-but-still-a-story" phase per the spec's own documented dependency — this is called out explicitly rather than hidden inside an artificially-populated Foundational phase.
- Verify tests fail before implementing (constitution Principle I).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence beyond the one already documented (US2/US3 → US1).
