---

description: "Task list for Record Detail View Redesign with Inline Editing"
---

# Tasks: Record Detail View Redesign with Inline Editing

**Input**: Design documents from `/specs/010-record-detail-inline-edit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included and REQUIRED. The project constitution's Principle I
(Test-First, NON-NEGOTIABLE) requires a failing test before implementation for
every feature/bug fix, and its e2e quality gate requires Playwright coverage
under `/e2e` for any change touching `/frontend`. Both apply here.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Frontend-only feature (per plan.md/research.md — no backend change needed).
All paths are under `frontend/` and `e2e/`.

---

## Phase 1: Setup

**Purpose**: Confirm tooling/paths before writing new tests and components

- [X] T001 Confirm Vitest picks up new test files under
  `frontend/tests/unit/ui/` and `frontend/tests/integration/` (no config
  change expected — verify by running `cd frontend && npm test` and noting
  the baseline pass count before this feature's changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Restructure the existing single-blob detail page into the four
named block components (still mobile-stacked, still using the existing
Edit/Save/Cancel my-copy behavior for now) so User Stories 1-3 can each be
implemented and tested independently against a stable block boundary

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extract the existing tracklist markup out of
  `frontend/src/pages/RecordDetailPage.tsx` into a new
  `frontend/src/components/TracklistCard.tsx` component (props: `tracks:
  Track[]`), adding the empty-state message ("No tracklist available") for
  an empty list per the Edge Cases in spec.md
- [X] T003 [P] Add a unit test for the empty-tracklist state in
  `frontend/tests/unit/TracklistCard.test.tsx` (renders "No tracklist
  available" when `tracks` is `[]`, renders the list otherwise) — write
  before/alongside T002 per Principle I
- [X] T004 Create a placeholder `frontend/src/components/RecordHeaderImage.tsx`
  component (props: `images: CatalogImage[]`) that renders the image marked
  `imageType === 'primary'` (falling back to the first image) with no
  placeholder logic yet (placeholder graphic is added in US2, T0XX below) —
  used to establish the block boundary
- [X] T005 Create a placeholder `frontend/src/components/DiscInfoCard.tsx`
  component (props: `release: Release`) rendering only `title` and the
  existing per-artist paragraphs (matching today's behavior) — full
  field set is added in US3
- [X] T006 Restructure `frontend/src/pages/RecordDetailPage.tsx` to render the
  four blocks via `RecordHeaderImage`, `DiscInfoCard`, the existing "Your
  copy" markup (unchanged for now), and `TracklistCard`, stacked in a single
  column in this order: header image, disc info, my copy, tracklist (per
  FR-002), replacing the inline tracklist/title/artist JSX removed in
  T002/T005
- [X] T007 Update `frontend/src/components/RecordDetailSkeleton.tsx` to add a
  fourth skeleton block matching the new header-image block (so the skeleton
  has one skeleton block per real block, avoiding layout shift per the UI
  Design System's "no layout shift" rule)
- [X] T008 Run `cd frontend && npm test` and confirm the existing
  `frontend/tests/integration/recordDetailFlow.test.tsx` still passes against
  the restructured page (update only what's needed to keep it green — no new
  assertions yet, those are added per-story below)

**Checkpoint**: Foundation ready — the page renders the same content as today,
now split into four named block components; user story implementation can now
begin

---

## Phase 3: User Story 1 - Edit my copy's condition and notes without leaving the page (Priority: P1) 🎯 MVP

**Goal**: Replace the Edit/Save/Cancel form with per-field click/tap-to-edit
inputs that autosave on blur/confirm, cancel on Escape, show an editable
affordance, and confirm success — all within the existing "Your copy" card.

**Independent Test**: Open a record's detail view, click/tap the condition
value directly (no "Edit" button exists), change it, click away, and confirm
it autosaves and shows a brief success indicator; repeat for notes; press
Escape mid-edit and confirm the value reverts.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T009 [P] [US1] Unit tests for the state machine in
  `frontend/tests/unit/ui/InlineEditableField.test.tsx`: click/tap switches
  read→editing; blur triggers `onSave` and returns to read with the new
  value; Escape reverts to the original value with no `onSave` call; a
  rejected `onSave` keeps the field in editing with the entered value and
  shows an error message (FR-009 through FR-013, FR-016)
- [X] T010 [P] [US1] Integration test addition in
  `frontend/tests/integration/recordDetailFlow.test.tsx`: starting to edit the
  notes field while the condition field is mid-edit resolves (saves) the
  condition field first, so only one field is ever in edit mode (FR-017)

### Implementation for User Story 1

- [X] T011 [US1] Create `frontend/src/components/ui/InlineEditableField.tsx`
  implementing the read/editing/saving/saved/error state machine from
  data-model.md: props `value: string | undefined`, `placeholder: string`
  (shown when empty, e.g. "Add a condition"), `renderEditor(value, onChange,
  onKeyDown, onBlur, autoFocus)`, `onSave(value): Promise<void>`, `isActive:
  boolean`, `onActivate: () => void` (to satisfy FR-017's "one active field"
  coordination from the parent) — makes T009 pass
- [X] T012 [US1] Add Tailwind hover affordance (`hover:` variant) for pointer
  devices and a permanent affordance for touch devices (a `(hover: none)`
  media-based style, per research.md) to `InlineEditableField`'s read-mode
  rendering, satisfying FR-014
- [X] T013 [US1] Add a transient (~1.5s) success confirmation
  (checkmark/highlight) to `InlineEditableField`'s `saved` state, satisfying
  FR-012 and SC-... "self-dismissing" requirement
- [X] T014 [US1] In `frontend/src/pages/RecordDetailPage.tsx`, replace the
  existing Edit/Save/Cancel "Your copy" block with two `InlineEditableField`
  instances: condition (editor = `<select>` of the existing
  `CONDITION_OPTIONS`) and notes (editor = `<textarea>`), each calling
  `libraryApi.update(entryId, condition, undefined)` or
  `libraryApi.update(entryId, undefined, notes)` respectively on save, and
  hold the "active field" key (`'condition' | 'notes' | null`) in page state
  to satisfy FR-017 — makes T010 pass
- [X] T015 [US1] On a failed save in `RecordDetailPage.tsx`, log the failure
  via `console.error` including `entryId` and the field name (Principle V,
  Observability), in addition to the inline error shown by
  `InlineEditableField`
- [X] T016 [US1] [P] Add Playwright e2e spec
  `e2e/tests/record-detail-inline-edit.spec.ts` covering: open a record's
  detail page, edit the condition field inline (no Edit button clicked),
  confirm autosave, reload the page, confirm the new value persisted —
  satisfying the constitution's `/frontend` e2e quality gate for this change

**Checkpoint**: At this point, User Story 1 should be fully functional and
testable independently — my-copy fields are editable inline with autosave,
Escape-cancel, and a success indicator

---

## Phase 4: User Story 2 - View a record's details in a layout that adapts to available space (Priority: P1)

**Goal**: Make the four blocks reflow between a single-column stack (narrow
viewports) and a two-column layout (wide viewports: full-width header image,
left column = disc info + my copy, right column = tracklist) using CSS
responsive breakpoints only.

**Independent Test**: Open a record's detail view at a narrow width and
confirm the four blocks stack in the specified order; widen the viewport past
the breakpoint and confirm the two-column arrangement (full-width image,
left column, right column) appears, with no JS-driven device branching.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T017 [P] [US2] Integration test addition in
  `frontend/tests/integration/recordDetailFlow.test.tsx` asserting the
  responsive grid wrapper renders header image, disc info, my copy, and
  tracklist in DOM order matching the stacked order (FR-002), and that the
  wrapper carries the two-column Tailwind grid utility classes expected for
  wide viewports (FR-003) — since jsdom doesn't compute real breakpoints,
  assert on the presence of the responsive class names on the wrapper/blocks
  rather than actual visual column placement
- [X] T018 [P] [US2] Unit test for the "no cover image" placeholder in
  `frontend/tests/unit/RecordHeaderImage.test.tsx`: renders a placeholder
  graphic when `images` is empty, renders the primary image otherwise (Edge
  Cases)

### Implementation for User Story 2

- [X] T019 [US2] Add the missing-image placeholder to
  `frontend/src/components/RecordHeaderImage.tsx` (created in T004),
  satisfying the "no cover image" edge case and making T018 pass
- [X] T020 [US2] Replace the flat `flex flex-col gap-6` wrapper in
  `frontend/src/pages/RecordDetailPage.tsx` (from T006) with a CSS Grid
  layout per research.md's decision: single column by default, switching at
  the `lg:` breakpoint to a two-column grid with `RecordHeaderImage` spanning
  both columns at the top, `DiscInfoCard` + my-copy in the left column, and
  `TracklistCard` in the right column — makes T017 pass
- [X] T021 [US2] Verify no layout-shift/overlap regressions in
  `frontend/src/components/RecordDetailSkeleton.tsx` (updated in T007) by
  applying the same grid wrapper classes, so the skeleton's block sizing
  matches the real content's grid placement at both breakpoints

**Checkpoint**: At this point, User Stories 1 AND 2 should both work
independently — inline editing works, and the layout reflows fluidly by
viewport width

---

## Phase 5: User Story 3 - View read-only disc information at a glance (Priority: P2)

**Goal**: Show title, artist(s), release year, format(s), and genre(s) in the
disc-information block, omitting any field with no data, and listing every
value when a field has more than one (multiple artists/formats/genres).

**Independent Test**: Open a record with multiple artists, multiple format
descriptors, and multiple genres, and confirm the disc-information block
shows all of them, with no interactive controls in that block; open a record
missing its year and confirm that field is simply absent.

### Tests for User Story 3 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T022 [P] [US3] Unit tests in `frontend/tests/unit/DiscInfoCard.test.tsx`:
  renders title, all credited artists, year (when present), all format
  descriptors, and all genres; omits the year entirely when `release.year` is
  `undefined`; renders no buttons/inputs (read-only per FR-006)

### Implementation for User Story 3

- [X] T023 [US3] Expand `frontend/src/components/DiscInfoCard.tsx` (created
  in T005) per the data-model.md mapping table: render all `release.artists`
  names, `release.year` only if present, all `release.formats` entries
  (`name` + joined `descriptions`), and all `release.genres` joined for
  display — makes T022 pass
- [X] T024 [US3] [P] Extend the existing
  `frontend/tests/integration/recordDetailFlow.test.tsx` fixture data to
  include a second artist, a second format descriptor, and a second genre,
  and assert all of them render in the full page flow

**Checkpoint**: All user stories should now be independently functional —
inline editing, responsive layout, and full disc-information display

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Satisfy the constitution's remaining quality gates and validate
the full feature end-to-end

- [X] T025 Add an `Unreleased` entry to `frontend/CHANGELOG.md` describing the
  record detail view redesign (responsive 4-block layout + inline autosave
  editing for condition/notes), satisfying the constitution's `/frontend`
  CHANGELOG quality gate (v1.7.0)
- [X] T026 Run `cd frontend && npm test` and `cd e2e && npm test`, confirming
  all existing and newly added tests pass (Principle I and the e2e quality
  gate)
- [X] T027 Run quickstart.md's 9 manual validation scenarios against a local
  dev server (`specs/010-record-detail-inline-edit/quickstart.md`)
- [X] T028 Cross-check spec.md FR-001 through FR-017 and SC-001 through SC-005
  against the final `RecordDetailPage.tsx`, `RecordDetailSkeleton.tsx`,
  `InlineEditableField.tsx`, `DiscInfoCard.tsx`, `RecordHeaderImage.tsx`, and
  `TracklistCard.tsx` to confirm every requirement is satisfied
  (`specs/010-record-detail-inline-edit/spec.md`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user
  stories (the four block components and the restructured page must exist
  before any story's tests/implementation can target them)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion;
  once done, US1, US2, and US3 touch different concerns (my-copy editing vs.
  layout/header-image vs. disc-info content) and can proceed in parallel
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — edits only the
  my-copy block and adds `InlineEditableField`; no dependency on US2/US3
- **User Story 2 (P1)**: Can start after Foundational — edits the page's grid
  wrapper and `RecordHeaderImage`; no dependency on US1/US3 (it wraps
  whatever `DiscInfoCard`/my-copy content exists, whether or not US1/US3 have
  landed yet)
- **User Story 3 (P2)**: Can start after Foundational — edits only
  `DiscInfoCard`; no dependency on US1/US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- Component/state logic before page wiring
- Story complete before moving to the next priority (if working sequentially)

### Parallel Opportunities

- T003 (tracklist empty-state test) can run in parallel with T004/T005
  (placeholder component creation) within Foundational
- Once Foundational (Phase 2) completes, User Stories 1, 2, and 3 can be
  implemented in parallel by different contributors, since they touch
  different files/blocks (`InlineEditableField.tsx` + my-copy JSX vs.
  `RecordHeaderImage.tsx` + grid wrapper vs. `DiscInfoCard.tsx`)
- T009 and T010 (US1 tests) can run in parallel; T017 and T018 (US2 tests)
  can run in parallel; T016 (e2e spec) can run in parallel with other US1
  tasks once T011/T014 land

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together (different files):
Task: "Add unit test for empty-tracklist state in frontend/tests/unit/TracklistCard.test.tsx"
Task: "Create placeholder RecordHeaderImage component in frontend/src/components/RecordHeaderImage.tsx"
Task: "Create placeholder DiscInfoCard component in frontend/src/components/DiscInfoCard.tsx"
```

## Parallel Example: After Foundational, Across User Stories

```bash
# Launch all three user stories' first test tasks together (different files):
Task: "Unit tests for InlineEditableField in frontend/tests/unit/ui/InlineEditableField.test.tsx"
Task: "Integration test for responsive grid DOM order in frontend/tests/integration/recordDetailFlow.test.tsx"
Task: "Unit tests for DiscInfoCard in frontend/tests/unit/DiscInfoCard.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T008) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T009-T016)
4. **STOP and VALIDATE**: Inline autosave editing works end-to-end (quickstart
   scenarios 4-7); layout is still the old single-column stack and disc info
   still only shows title/artist — both acceptable as an MVP slice
5. Continue to US2/US3, or ship the MVP as-is

### Incremental Delivery

1. Setup + Foundational → four-block structure in place, behavior unchanged
2. Add User Story 1 → inline autosave editing ships (MVP!)
3. Add User Story 2 → responsive two-column layout ships
4. Add User Story 3 → full disc-information display ships
5. Polish → changelog entry, full test suite, quickstart validation, FR
   cross-check

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (`InlineEditableField` + my-copy wiring)
   - Developer B: User Story 2 (grid wrapper + `RecordHeaderImage`)
   - Developer C: User Story 3 (`DiscInfoCard` content)
3. Stories complete and integrate independently in `RecordDetailPage.tsx`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests MUST be written and confirmed failing before their corresponding
  implementation task (Principle I, NON-NEGOTIABLE)
- Commit after each task or logical group, using Conventional Commits (e.g.
  `feat(record-detail): add InlineEditableField with autosave`)
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts across stories, cross-story
  dependencies that would break independence
