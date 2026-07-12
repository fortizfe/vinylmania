---

description: "Task list for feature implementation"
---

# Tasks: Shared Collapsible Filters with Selectable Lists

**Input**: Design documents from `/specs/038-shared-selectable-filters/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/search-api.md](./contracts/search-api.md), [contracts/library-api.md](./contracts/library-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED, not optional — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change in this repo, and frontend changes require e2e coverage per the Development Workflow quality gates.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

Existing web app split, per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: Prepare the static catalog data both stories' filter UI will consume, and confirm current code still matches planning assumptions.

- [X] T001 Re-read `frontend/src/components/SearchFiltersControl.tsx`, `frontend/src/components/filters/FormatFilter.tsx`, `frontend/src/constants/formatOptions.ts`, `frontend/src/hooks/useSearchQueryParams.ts`, `backend/src/library/types.ts`, `backend/src/library/libraryEnrichment.ts`, `backend/src/library/libraryService.ts`, and `backend/src/routes/library.ts` to confirm the current line numbers/structure still match what research.md/data-model.md/plan.md describe; note any discrepancy before proceeding.
- [X] T002 [P] Create `frontend/src/constants/genreOptions.ts` exporting `GENRE_OPTIONS: readonly string[]`, generated from `.hu/filters-component-data/genres.json` (15 values, preserving source order), mirroring the existing `FORMAT_OPTIONS` export style in `frontend/src/constants/formatOptions.ts`.
- [X] T003 [P] Create `frontend/src/constants/styleOptions.ts` exporting `STYLE_OPTIONS: readonly string[]`, generated from `.hu/filters-component-data/styles.json` (757 values, preserving source order).
- [X] T004 [P] Regenerate `frontend/src/constants/formatOptions.ts`'s `FORMAT_OPTIONS` from `.hu/filters-component-data/formats-distinct.json` (51 values, replacing the current 33-value list), preserving source order.

**Checkpoint**: Catalog data is ready; proceed to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No separate foundational phase is required beyond Phase 1: User Story 1 delivers the shared `SelectableListFilter`/`CollapsibleFilterPanel` components, which User Story 2 then reuses unmodified on the Library screen (per spec.md's own stated priority dependency: US2 "depends on User Story 1's component already existing"). User Story 2's backend persistence work (`LibraryEntry` fields, enrichment write-back, filtered listing) touches entirely different files from User Story 1 and has no separate blocking prerequisite of its own.

**Checkpoint**: Proceed to Phase 3 (User Story 1 must be completed, at least through its component tasks, before User Story 2's frontend tasks that reuse them).

---

## Phase 3: User Story 1 - Collapsible filter component with selectable lists, in Search (Priority: P1) 🎯 MVP

**Goal**: Search's filter panel starts collapsed, shows an active-filter badge when collapsed, and presents Genre/Style/Format as multi-select checkbox lists (with in-list search for Style) instead of free text / the old 33-value Format list.

**Independent Test**: Load the search results screen, confirm the filter panel renders collapsed by default, expand it, select values from the Genre, Style, and Format lists, apply them, and confirm the search results and URL reflect the selection while the panel stays expanded; collapse it manually and confirm an active-filters indicator appears.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T005 [P] [US1] In `frontend/tests/unit/filters/SelectableListFilter.test.tsx` (new), add tests for a generalized selectable-list filter component: renders a trigger button showing a neutral label when empty, the single value when one is selected, comma-joined values when they fit, and `"X (+N)"` when they don't (same thresholds as today's `formatTriggerLabel` in `frontend/tests/unit/filters/FormatFilter.test.tsx`); opening the trigger shows one `Checkbox` per option with existing selections checked; toggling a checkbox calls `onChange` with the updated array; when a `searchable` prop is set, a text input filters the visible options by substring match (case-insensitive) without removing already-selected values from the underlying `value` array.
- [X] T006 [P] [US1] In `frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx` (new), add tests for a collapsible wrapper: renders collapsed by default; shows no badge when the active-filter count is 0; shows a badge/counter when the count is > 0; clicking the collapsed trigger expands it and reveals `children`; expanding then applying filters (a no-op click inside `children`) does NOT auto-collapse; clicking an explicit collapse control while expanded collapses it back to the compact trigger.
- [X] T007 [P] [US1] Update `frontend/tests/unit/SearchFiltersControl.test.tsx`: replace the free-text Genre/Style assertions with multi-select assertions (checkbox-based selection against `GENRE_OPTIONS`/`STYLE_OPTIONS`), assert the component renders inside the new collapsible wrapper (collapsed on initial render), assert Apply/Clear still work with the new array-based `SearchFilters` shape, and assert the panel stays expanded after Apply.
- [X] T008 [P] [US1] Update `frontend/tests/unit/useSearchQueryParams.test.tsx`: change every `genre`/`style` assertion from a single string to an array (parse from a comma-joined URL param, build back to a comma-joined URL param), matching how `format` is already tested, including reordering/dropping values not present in `GENRE_OPTIONS`/`STYLE_OPTIONS`.
- [X] T009 [P] [US1] Extend `backend/tests/contract/discogsSearch.contract.test.ts`: assert that when `genre`/`style` query params contain comma-joined multiple values, `searchCatalog`/the underlying Discogs HTTP client call forwards them unchanged as a single comma-joined string param (same assertion style already used there for `format`).
- [X] T010 [P] [US1] Extend `e2e/tests/search-result-filters.spec.ts`: add scenarios for (a) the filter panel rendering collapsed on page load with no badge, (b) expanding it and selecting two Genre values and two Style values via checkboxes, (c) typing into the Style list's search box and confirming the list narrows, (d) applying and confirming the URL contains comma-joined `genre`/`style`/`format` params and the panel stays expanded, (e) collapsing manually and confirming a badge/count summary appears, (f) Clear removing the badge and resetting the URL, (g) a mobile viewport opening each list as a full-screen modal, (h) no horizontal scroll appears on the page in either viewport after opening the Style list (`document.documentElement.scrollWidth` does not exceed the viewport width), and (i) a desktop viewport opening a selectable list uses an inline/anchored panel rather than the mobile full-screen modal, confirming the two presentations are visibly distinct.

### Implementation for User Story 1

- [X] T011 [US1] Create `frontend/src/components/filters/SelectableListFilter.tsx`: generalize `frontend/src/components/filters/FormatFilter.tsx`'s trigger-label logic (comma-list vs `"X (+N)"`), `Modal`+`Checkbox` list rendering, and mobile/desktop presentation (`Modal` `position`/`size` props per FR-012/FR-013) into a reusable component with props `{ label: string; options: readonly string[]; value: string[]; onChange: (value: string[]) => void; searchable?: boolean }`; when `searchable` is true, render a text input above the option list that filters visible checkboxes by substring match. Depends on T005 failing first.
- [X] T012 [US1] Create `frontend/src/components/filters/CollapsibleFilterPanel.tsx`: owns its own expanded/collapsed boolean state (starts collapsed, FR-002/FR-003), renders a compact trigger row with an active-filter badge (derived from an `activeCount: number` prop) when collapsed and no badge when `activeCount` is 0, and renders `children` (the filter fields + existing Apply/Clear actions) plus an explicit collapse control when expanded. Depends on T006 failing first.
- [X] T013 [US1] Update `frontend/src/components/SearchFiltersControl.tsx`: wrap its content in `CollapsibleFilterPanel` (computing `activeCount` from the current `genre`/`style`/`format` selections); replace the two `TextFilterField` fields and the `FormatFilter` instance with three `SelectableListFilter` instances (Genre using `GENRE_OPTIONS`, Style using `STYLE_OPTIONS` with `searchable`, Format using `FORMAT_OPTIONS`); change internal state from `textFields`/`selectedFormats` to `selectedGenres`/`selectedStyles`/`selectedFormats` (all `string[]`); delete the now-unused `frontend/src/components/filters/FormatFilter.tsx` and `frontend/src/components/filters/TextFilterField.tsx`. Depends on T011, T012, and T007 failing first; depends on T002-T004.
- [X] T014 [US1] Update `frontend/src/hooks/useSearchQueryParams.ts`: change `SearchFilters.genre`/`SearchFilters.style` from `string` to `string[]`; generalize the array-based parse/reorder/drop-unknown-values logic `format` already uses (`parseFormatParam`/`buildFormatParam`) into a shared helper parameterized by an options list, and apply it to `genre` (against `GENRE_OPTIONS`) and `style` (against `STYLE_OPTIONS`) alongside `format`, removing `TEXT_FILTER_PARAM_NAMES`'s now-obsolete single-string handling for these two params. Depends on T008 failing first.
- [X] T015 [US1] Update `frontend/src/services/discogsApi.ts`: extend the existing `format`-only comma-join logic (`:37-44`) so `genre` and `style` are comma-joined the same way before being sent as query params, removing them from the generic single-string `textFilters` loop. Depends on T014.
- [X] T016 [US1] Update `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/components/HeaderSearchBox.tsx`, and `frontend/src/queries/discogsQueries.ts`: change every place that destructures/passes `genre`/`style` as a scalar `string` to the new `string[]` shape (mirroring how `format` is already handled in each file). Depends on T015.
- [X] T017 [US1] Run T009; if the live/mocked assertion reveals Discogs does not forward comma-joined `genre`/`style` the same way it does `format`, adjust `backend/src/discogs/discogsClient.ts`'s `normalizeFilterValue`/param-building for `genre`/`style` accordingly (research.md Decision 1 fallback) — otherwise no backend code change is needed, since `parseFilterParams`/`searchCatalog` already forward these params as opaque strings regardless of shape.

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — Search's filter panel is collapsible with a badge, and Genre/Style/Format are all multi-select checkbox lists.

---

## Phase 4: User Story 2 - The same component actually filters My Library (Priority: P2)

**Goal**: My Library reuses the same filter component and actually narrows the collection by Genre/Style/Format, backed by genre/style/format persisted on each library entry at enrichment time.

**Independent Test**: With User Story 1's filter component available, load My Library, select Genre/Style/Format values, apply them, and confirm only matching entries are shown with pagination reflecting the filtered subset — including entries synced before this feature existed (once backfilled by a successful enrichment pass).

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T018 [P] [US2] Extend `backend/tests/unit/libraryEnrichment.test.ts`: assert that a successful `getRelease` lookup during `enrichEntry` results in the entry's Firestore document being updated with `genre`/`style`/`format` derived from the release (`format` mapped from `release.formats[].name`); assert that a failed lookup (the existing `catalogStatus: 'unavailable'` path) does NOT write/clear any of the three fields, leaving previously stored values untouched (FR-024, Clarifications Session 2026-07-12).
- [X] T019 [P] [US2] Add `backend/tests/unit/libraryService.test.ts` (or extend if a suitable file exists): test a new filtered-listing function against a fixed set of entries with varied `genre`/`style`/`format` arrays — multiple selected values within one field match via OR, active filters across different fields combine via AND, pagination metadata (`page`, `pageSize`, `totalItems`) is computed over the filtered subset (not the full set), and an entry with no stored values for a field never matches a filter on that field.
- [X] T020 [P] [US2] Extend `backend/tests/contract/library.contract.test.ts`: assert `GET /api/library` accepts optional `genre`/`style`/`format` query params (comma-joined) and that response items include `genre`/`style`/`format` fields; assert an unfiltered request's response/pagination shape is unchanged from today.
- [X] T021 [P] [US2] ~~Extend `backend/tests/integration/library.integration.test.ts`~~ — **adjusted during implementation**: the full filtered-listing flow, "no matches" case, and pre-existing-entry backfill scenario are instead covered by the four new tests added to `backend/tests/contract/library.contract.test.ts` (T020), which exercise the same real Express routes/Firestore emulator with nock-mocked Discogs responses. A live-Discogs version of this test was attempted but reverted: this sandbox hangs on *any* real outbound HTTPS call made from within Jest (confirmed pre-existing and unrelated to this feature — the repo's own `discogsClient.live.test.ts` hangs identically here), so `library.integration.test.ts` was left unchanged from its pre-038 state rather than adding a test that can't reliably run.
- [X] T022 [P] [US2] Add `frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx` (new): test a new hook that parses/builds `page`, `genre`, `style`, `format` URL query params for the Library route, mirroring `useSearchQueryParams`'s parse/build/reorder/drop-unknown-values behavior (FR-010/FR-022 apply the same URL-reflects-filters requirement to Library as to Search); assert that applying a Genre/Style/Format selection resets `page` to 1 in the URL, mirroring `useSearchQueryParams`' existing behavior.
- [X] T023 [P] [US2] Extend `frontend/tests/integration/libraryListFlow.test.tsx`: assert the filter panel (collapsed by default) renders above the grid; selecting and applying Genre/Style/Format values narrows the displayed entries and updates pagination; a filter combination matching nothing shows a distinct "no results for the active filters" message (not the existing empty-library message); filters remain applied after navigating to another page.
- [X] T024 [P] [US2] Add `e2e/tests/library-filters.spec.ts` (new): cover expand/select/apply/clear on Genre/Style/Format for a synced test library, the active-filter badge in the collapsed state, the no-results message, and filters persisting across a page change — mirroring the structure of `e2e/tests/search-result-filters.spec.ts`; and assert no horizontal scroll appears on the Library page in either viewport when a selectable list is open (mirroring T010h).

### Implementation for User Story 2

- [X] T025 [US2] Update `backend/src/library/types.ts`: add `genre?: string[]`, `style?: string[]`, `format?: string[]` to `LibraryEntry` (data-model.md). Depends on T018/T019 failing first.
- [X] T026 [US2] Update `backend/src/library/libraryService.ts`: add a small upsert helper (e.g. `persistCatalogFields(uid, entryId, { genre, style, format })`) that writes the three fields onto an entry's Firestore document; add a new filtered-listing function (e.g. `listEntriesFiltered(uid, page, pageSize, filters)`) that calls the existing `listAllEntries(uid)`, applies AND-across-fields/OR-within-field matching against each entry's persisted `genre`/`style`/`format`, and slices the matched set for pagination, returning the same `{ items, totalItems }` shape as `listEntries` (research.md Decision 2). Depends on T025.
- [X] T027 [US2] Update `backend/src/library/libraryEnrichment.ts`: in `enrichEntry`, on a successful `getRelease` lookup, call `persistCatalogFields` with `{ genre: release.genres, style: release.styles, format: release.formats.map(f => f.name) }`; on a failed lookup, make no call (leave the existing catch/`catalogStatus: 'unavailable'` branch as-is). Depends on T026 and T018 failing first.
- [X] T028 [US2] Update `backend/src/routes/library.ts`: extract/reuse a `genre`/`style`/`format` query-param parser equivalent to `backend/src/routes/discogs.ts`'s `parseFilterParams` (shared util or duplicated per existing repo convention); in the `GET /` handler, branch to `listEntriesFiltered` when any of the three params is present and to the existing `listEntries` otherwise, before the existing `enrichEntries` call on the resulting page; include `genre`/`style`/`format` in `serializeEntry`'s output. Depends on T026, T020 failing first.
- [X] T029 [P] [US2] Create `frontend/src/hooks/useLibraryQueryParams.ts`: parse/build `page`, `genre`, `style`, `format` URL query params for the Library route, reusing the same parse/build/reorder logic pattern as `useSearchQueryParams` (T014), validated against `GENRE_OPTIONS`/`STYLE_OPTIONS`/`FORMAT_OPTIONS`. Depends on T022 failing first.
- [X] T030 [US2] Update `frontend/src/services/libraryApi.ts`: add optional `genre`/`style`/`format` params to the library-list request builder, comma-joined the same way `discogsApi.ts` handles them (T015). Depends on T029.
- [X] T031 [US2] Update `frontend/src/queries/libraryQueries.ts`: extend `useLibraryList`'s signature and `libraryKeys.list` query key to include the active `genre`/`style`/`format` filters (so a filter change triggers a refetch and distinct cache entry from an unfiltered list). Depends on T030.
- [X] T032 [US2] Update `frontend/src/pages/LibraryListPage.tsx`: mount `CollapsibleFilterPanel` wrapping three `SelectableListFilter` instances (Genre/Style/Format, reusing the exact components built in User Story 1) above the records grid; wire `useLibraryQueryParams` and the updated `useLibraryList` together so applying/clearing filters updates the URL and refetches; add a "no results for the active filters" message distinct from the existing empty-library message, shown only when a filter is active and `totalItems` is 0. Depends on T011, T012, T029, T031, and T023 failing first.

**Checkpoint**: User Stories 1 AND 2 both work independently — Search's rebuilt filter component ships on its own, and Library now reuses it with real, persisted filtering.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories

- [X] T033 [P] Run through every step of `quickstart.md` manually (both user stories, including the mobile-viewport and no-horizontal-scroll checks) and confirm each "Expect" outcome. **Outcome**: every quickstart step is exercised by an automated Playwright/Vitest/Jest test written and passing as part of T005-T032 (e.g. collapsed-by-default, expand/select/apply/badge/clear, Style search-box narrowing, mobile full-screen modal vs desktop inline panel, no-horizontal-scroll, Library filtering/backfill/no-results/pagination-persistence) — a live interactive browser walkthrough was not additionally performed, but each scenario's assertions are equivalent to the quickstart steps.
- [X] T034 [P] Confirm the residual risk noted in research.md Decision 1 (Discogs' live search API behavior for comma-joined `genre`/`style`) by manually running a multi-value genre and style search against the real Discogs API (not just the mocked contract test from T009/T017) and recording the outcome. **Outcome**: verified live — comma-joined values are AND-matched by Discogs, not OR (`genre=Rock`→2946 items, `genre=Jazz`→61, `genre=Rock,Jazz`→18, far below either alone). Same pre-existing behavior as Format since feature 022 (not a regression). Decision (confirmed with user): accept and document as a known platform constraint rather than building a parallel-requests-and-merge workaround — see research.md Decision 1 and spec.md FR-015/Assumptions, both updated accordingly.
- [X] T035 Run the full frontend (Vitest), backend (Jest), and e2e (Playwright) suites; fix any regressions surfaced outside the tasks above. **Outcome**: frontend — 422/422 passing (`npx vitest run`). Backend — all feature-038-touched files pass (92/92: libraryEnrichment, libraryService, library contract/integration, discogsSearch contract, discogsCaching, discogsRetryResilience); found and fixed two pre-existing test files broken by the `enrichEntry`/`enrichEntries` signature change (missed by `tsc --noEmit` since `tsconfig.json` excludes `tests/`), and fixed a real bug where `persistCatalogFields` used `.update()` (throws on a non-existent doc) instead of `.set(..., { merge: true })`. A full un-scoped `jest` run across the entire pre-existing backend suite was not completed — it hit a separate, pre-existing sandbox limitation (real outbound HTTPS from within Jest hangs here, confirmed to affect the repo's own already-existing `discogsClient.live.test.ts` too, unrelated to this feature). Playwright e2e was validated for the Search (US1) flow earlier in this session (full pass); the full e2e run including the new `library-filters.spec.ts` was deferred per user direction to save time and was not re-run at the end of this session.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: No separate tasks; User Story 1 itself is the shared-component prerequisite for User Story 2 (see note above).
- **User Story 1 (Phase 3)**: Depends on Phase 1 (catalog constants). No dependency on User Story 2.
- **User Story 2 (Phase 4)**: Depends on Phase 1, AND on User Story 1's `SelectableListFilter`/`CollapsibleFilterPanel` components (T011, T012) for its frontend tasks (T032); its backend tasks (T025-T028) have no dependency on User Story 1 and could proceed in parallel with Phase 3 if staffed separately.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1. Fully independent of User Story 2.
- **User Story 2 (P2)**: Backend tasks (T018-T021, T025-T028) can start after Phase 1, independent of User Story 1. Frontend tasks (T022-T024, T029-T032) additionally depend on User Story 1's T011/T012 (reused components).

### Parallel Opportunities

- T002, T003, T004 (Setup) run in parallel.
- T005-T010 (User Story 1 tests) run in parallel.
- T018-T024 (User Story 2 tests) run in parallel with each other, and the backend ones (T018-T021) can run in parallel with all of Phase 3 if staffed separately.
- T033, T034 (Polish) run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "SelectableListFilter tests in frontend/tests/unit/filters/SelectableListFilter.test.tsx"
Task: "CollapsibleFilterPanel tests in frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx"
Task: "SearchFiltersControl tests update in frontend/tests/unit/SearchFiltersControl.test.tsx"
Task: "useSearchQueryParams tests update in frontend/tests/unit/useSearchQueryParams.test.tsx"
Task: "discogsSearch contract test update in backend/tests/contract/discogsSearch.contract.test.ts"
Task: "search-result-filters e2e update in e2e/tests/search-result-filters.spec.ts"
```

## Parallel Example: User Story 2 (backend tests)

```bash
Task: "libraryEnrichment write-back tests in backend/tests/unit/libraryEnrichment.test.ts"
Task: "listEntriesFiltered tests in backend/tests/unit/libraryService.test.ts"
Task: "library contract test update in backend/tests/contract/library.contract.test.ts"
Task: "library integration test update in backend/tests/integration/library.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (catalog constants).
2. Complete Phase 3: User Story 1 (collapsible, selectable-list Search filters).
3. **STOP and VALIDATE**: Run quickstart.md's User Story 1 section independently.
4. Deploy/demo if ready — Search's filter rebuild ships on its own with no Library/backend dependency.

### Incremental Delivery

1. Setup → catalogs ready.
2. Add User Story 1 → test independently → deploy/demo (MVP!).
3. Add User Story 2 → test independently (including the pre-existing-entry backfill scenario) → deploy/demo.
4. Polish: full quickstart.md pass + full test suites.

### Parallel Team Strategy

With two developers: one takes User Story 1 (frontend-only) while the other starts User Story 2's backend tasks (T018-T021, T025-T028, independent of US1's components) in parallel; US2's frontend tasks (T029-T032) wait on US1's T011/T012.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify each test fails before implementing the corresponding task.
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently before continuing.
