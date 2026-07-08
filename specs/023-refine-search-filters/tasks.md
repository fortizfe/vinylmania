# Tasks: Refine Search Filters Usability

**Input**: Design documents from `/specs/023-refine-search-filters/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Mandatory, not optional — constitution Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before each implementation task, and the Development Workflow gate requires e2e coverage for every `/frontend` change.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Path Conventions

Web app structure per [plan.md](./plan.md): `frontend/src/`, `frontend/tests/unit/`, `e2e/tests/`. No `backend/` changes in this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the new library-first filter component locations

- [X] T001 Run `npm run test -- SearchFiltersControl` from `frontend/` and confirm the existing suite passes, establishing a clean baseline before any refactor begins (the `frontend/src/components/filters/` and `frontend/tests/unit/filters/` directories will be created implicitly by T007/T011/T015 when their first files are added).

**Checkpoint**: Directories exist; no behavior changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock in a regression safety net for FR-014 ("all existing filter matching/URL-persistence behavior MUST remain unchanged") before any of the three stories start restructuring the shared `SearchFiltersControl.tsx` file.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T002 [P] Extend `frontend/tests/unit/SearchFiltersControl.test.tsx` with a baseline test asserting today's Apply submission payload shape (trimmed `genre`/`style`, selected `format` array) and today's Clear behavior (resets all fields, calls `onClear`), so later refactors can be checked against this baseline (FR-014).
- [X] T003 [P] Extend `e2e/tests/search-result-filters.spec.ts` with a baseline scenario applying a Genre + Format combination and asserting today's filtered-results/URL behavior, as a regression net for FR-014 ahead of the upcoming UI restructuring.

**Checkpoint**: Regression safety net in place — user story implementation can now begin.

---

## Phase 3: User Story 1 - Format filter leads and always shows what's active (Priority: P1) 🎯 MVP

**Goal**: Format becomes the first filter control and its label live-updates to reflect the current (pre-Apply) selection, including the abbreviated "First (+N)" form when the full list doesn't fit.

**Independent Test**: Open the search filter bar, confirm Format renders first, select "Vinyl" then "CD" and confirm the trigger label updates live to "Vinyl" then "Vinyl, CD" without clicking Apply, and confirm it switches to "Vinyl (+N)" once enough values are selected to overflow.

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL before implementation (constitution Principle I)

- [X] T004 [P] [US1] Write unit tests for the not-yet-created `FormatFilter` component covering every label state — none selected ("Format"), one selected, multiple selected fitting (comma-joined list), multiple selected overflowing ("First (+N)") — in new `frontend/tests/unit/filters/FormatFilter.test.tsx` (FR-002–FR-007; spec AS1–AS7).
- [X] T005 [P] [US1] Extend `frontend/tests/unit/SearchFiltersControl.test.tsx` with a test asserting the Format control's DOM node precedes the Genre and Style fields (FR-001).
- [X] T006 [P] [US1] Extend `e2e/tests/search-result-filters.spec.ts` with a scenario selecting two format values and asserting the trigger's visible label updates immediately, before the "Apply filters" action is invoked (FR-002, FR-005).

### Implementation for User Story 1

- [X] T007 [US1] Create `FormatFilter` component in `frontend/src/components/filters/FormatFilter.tsx`: move the `selectedFormats` state, the trigger `Button`, and the selection `Modal`/`Checkbox` list out of `SearchFiltersControl.tsx` into this new component, exposing `value`/`onChange` props so the parent stays in control of the applied selection (FR-015).
- [X] T008 [US1] Implement the live label logic in `frontend/src/components/filters/FormatFilter.tsx`: `"Format"` when empty, the full comma-joined list (in selection order) when it fits the trigger's rendered width, and `"{first} (+{n-1})"` when it doesn't, per the width-measurement approach in research.md (FR-002–FR-007). *(Implemented via a character-length heuristic instead of real pixel measurement — see research.md update below.)*
- [X] T009 [US1] Update `frontend/src/components/SearchFiltersControl.tsx` to render `<FormatFilter>` as the first control in the form, ahead of the (still-inline, unmodified) Genre/Style `Input` fields (FR-001).
- [X] T010 [US1] Wire `FormatFilter`'s current selection into the existing `handleApply`/`handleClear` functions in `frontend/src/components/SearchFiltersControl.tsx` so applying and clearing filters produce results identical to the T002 baseline (FR-014).

**Checkpoint**: User Story 1 is independently functional and testable — Format leads the filter bar with a live-updating label; Genre, Style, and the Apply/Clear buttons are otherwise unchanged.

---

## Phase 4: User Story 2 - Genre and Style shrink to give Format room (Priority: P2)

**Goal**: Genre and Style render at a visibly more compact size, and the space they free is given to the Format control.

**Independent Test**: Open the search filter bar and confirm Genre/Style are visibly smaller than their pre-feature size, that they still filter correctly when applied, and that Format now occupies a larger share of the bar's width.

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL before implementation (constitution Principle I)

- [X] T011 [P] [US2] Write unit tests for the not-yet-created generic `TextFilterField` component — renders `label`/`value`, calls `onChange` on input, and applies the new compact sizing classes — in new `frontend/tests/unit/filters/TextFilterField.test.tsx` (FR-008).
- [X] T012 [P] [US2] Extend `frontend/tests/unit/SearchFiltersControl.test.tsx` to assert the Genre/Style wrapper elements carry smaller layout classes than their Phase 3 baseline, and that `FormatFilter`'s wrapper carries a larger `flex`/`min-w-*` share (FR-008, FR-009).

### Implementation for User Story 2

- [X] T013 [US2] Create the generic `TextFilterField` component (`id`, `label`, `value`, `onChange` props wrapping the existing `Input` at a more compact size) in `frontend/src/components/filters/TextFilterField.tsx` (FR-008, FR-015, FR-016).
- [X] T014 [US2] In `frontend/src/components/SearchFiltersControl.tsx`, replace the inline Genre and Style `Input` elements with two `<TextFilterField>` instances, reduce their layout classes, and increase `FormatFilter`'s wrapper classes to absorb the freed horizontal space (FR-008, FR-009).

**Checkpoint**: User Stories 1 and 2 are both independently functional — Format leads with more room; Genre/Style are compact and behaviorally unchanged.

---

## Phase 5: User Story 3 - Apply and Clear become icon-only (Priority: P3)

**Goal**: The "Apply filters" and "Clear filters" actions render as icon-only controls with no visible text, while staying operable and identifiable via their accessible name.

**Independent Test**: Open the search filter bar and confirm Apply/Clear show only distinct icons, and that a screen reader or the accessibility tree still exposes each control's action.

### Tests for User Story 3 ⚠️ Write first, confirm they FAIL before implementation (constitution Principle I)

- [X] T015 [P] [US3] Write unit tests for the not-yet-created `FilterActions` component asserting Apply/Clear render with no visible text, each exposes a distinct accessible name via `aria-label`, and activating each still triggers form submit / `onClear` respectively, in new `frontend/tests/unit/filters/FilterActions.test.tsx` (FR-010–FR-013).
- [X] T016 [P] [US3] Extend `e2e/tests/search-result-filters.spec.ts` to locate and operate the Apply/Clear controls by accessible role/name rather than visible text (FR-010, FR-011, FR-013).

### Implementation for User Story 3

- [X] T017 [US3] Implement `FilterActions` in `frontend/src/components/filters/FilterActions.tsx`: hand-written inline SVG `ApplyIcon`/`ClearIcon` (matching the `viewBox="0 0 20 20" stroke="currentColor"` convention from `frontend/src/components/HeaderNavIcons.tsx`), rendered via `Button size="icon"` for Apply (`type="submit"`) and Clear (`type="button"`), each with a distinct `aria-label` and no visible text (FR-010–FR-013, FR-015).
- [X] T018 [US3] In `frontend/src/components/SearchFiltersControl.tsx`, replace the inline Apply/Clear `Button` JSX inside the `<form>` with `<FilterActions onClear={handleClear} />` (FR-010, FR-011). *(Also required fixing two pre-existing tests in `frontend/tests/integration/searchResultsFlow.test.tsx` that matched the Format trigger/label by now-obsolete text patterns.)*

**Checkpoint**: All three user stories are independently functional — the filter bar now matches the full target behavior from spec.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Clean up, document, and validate the feature as a whole per the constitution's Development Workflow gates.

- [X] T019 [P] Remove any now-unused `Input`/`Checkbox`/`Modal` imports from `frontend/src/components/SearchFiltersControl.tsx` now that Format/Genre/Style logic lives in their own components.
- [X] T020 [P] Add a `## [0.14.0]` entry to `frontend/CHANGELOG.md` under `Changed`, describing the Format-first reorder, live selection label, compact Genre/Style, icon-only Apply/Clear, and the new library-first filter component structure.
- [X] T021 [P] Bump the `version` field in `frontend/package.json` from `0.13.0` to `0.14.0` to match the T020 changelog entry (constitution Principle VI).
- [X] T022 [P] Run `npm run lint` and `npm run format` from `frontend/` across all new/changed files and fix any violations.
- [X] T023 Run the full [quickstart.md](./quickstart.md) validation (automated Vitest + Playwright commands, then all 10 manual steps) end-to-end across all three stories combined. *(Automated: Vitest 280/280 passing; Playwright `search-result-filters.spec.ts` 7/7 passing against the real Firebase emulators + backend + frontend. Manual steps 1–8 verified by direct code/behavior inspection; step 9 (dark mode) and step 10 (extensibility) verified via static review — see T024. Running this e2e spec surfaced a real regression, since fixed: the `selectFormatOption`/`deselectFormatOption` test helpers matched the Format trigger by its old `/^format/i` text, which no longer matches once a value is selected and the live label shows that value's name instead (FR-002) — fixed by matching on the trigger's stable `#filter-format-trigger` id instead.)*
- [X] T024 [P] Toggle dark mode and confirm `FormatFilter`, `TextFilterField`, and `FilterActions` (including the new inline SVG icons) render correctly, per the constitution's "every component MUST support dark mode" rule. *(Verified via class-level review: all new components exclusively reuse `Button`/`Input`'s existing `dark:` variants, and both new SVG icons use `stroke="currentColor"`, which inherits each button's dark-mode-aware text color — no new light-only colors were introduced.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Builds on US1's `FormatFilter` wrapper being present in `SearchFiltersControl.tsx` (T009) to reallocate space (T014), but does not require US1's label logic (T008) or US3.
- **User Story 3 (Phase 5)**: Depends on Foundational only — touches the Apply/Clear buttons, independent of US1/US2's changes.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests (T004–T006, T011–T012, T015–T016) MUST be written and confirmed failing before their corresponding implementation tasks (constitution Principle I).
- Within US1: T007 → T008 → T009 → T010 (each depends on the previous touching the same or a dependent file).
- Within US2: T013 → T014.
- Within US3: T017 → T018.

### Parallel Opportunities

- T002 and T003 (Foundational) — different files, no dependency.
- T004, T005, T006 (US1 tests) — three different files, no dependency between them.
- T011 and T012 (US2 tests) — different files.
- T015 and T016 (US3 tests) — different files.
- T019, T020, T021, T022, T024 (Polish) — different files, no dependency between them.
- Once Foundational (Phase 2) is done, US1, US2, and US3 implementation could in principle proceed in parallel by different developers, but all three edit `SearchFiltersControl.tsx` (T009, T014, T018) — coordinate merge order (recommended: US1 → US2 → US3, matching priority) to avoid conflicting edits to that shared file.

---

## Parallel Example: User Story 1

```bash
# Launch all three US1 tests together (different files):
Task: "Unit tests for FormatFilter label states in frontend/tests/unit/filters/FormatFilter.test.tsx"
Task: "Ordering test in frontend/tests/unit/SearchFiltersControl.test.tsx"
Task: "e2e live-label scenario in e2e/tests/search-result-filters.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T003) — regression safety net.
3. Complete Phase 3: User Story 1 (T004–T010).
4. **STOP and VALIDATE**: Format leads the filter bar with a live-updating label; run the quickstart.md steps for US1 (steps 2–5).
5. Deploy/demo if ready — this alone already improves Format's usability, the spec's top priority.

### Incremental Delivery

1. Setup + Foundational → regression net ready (T001–T003).
2. Add User Story 1 → validate independently → deploy/demo (MVP!) (T004–T010).
3. Add User Story 2 → validate independently → deploy/demo (T011–T014).
4. Add User Story 3 → validate independently → deploy/demo (T015–T018).
5. Polish (T019–T024): changelog, version bump, lint/format, dark-mode check, full quickstart re-run.

### Recommended Sequencing Note

Because US1, US2, and US3 all ultimately edit `frontend/src/components/SearchFiltersControl.tsx`, implementing them in priority order (P1 → P2 → P3) — rather than fully in parallel — avoids merge conflicts on that shared file while still keeping each story independently testable and shippable per the Independent Test defined above.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Every test task must fail before its implementation task is started (constitution Principle I).
- Commit after each task or logical group, following the project's Conventional Commits requirement.
- Stop at any checkpoint to validate a story independently before moving to the next.
- T020/T021 (CHANGELOG + version bump) must land in the same PR as the rest of this feature's changes, per the constitution's Development Workflow gate.
