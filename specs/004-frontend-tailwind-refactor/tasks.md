---

description: "Task list template for feature implementation"
---

# Tasks: Frontend Look-and-Feel Refactor (Design System Alignment)

**Input**: Design documents from `/specs/004-frontend-tailwind-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-components.md, quickstart.md

**Tests**: Included — constitution Principle I (Test-First, NON-NEGOTIABLE) requires
a failing test before implementation for every story.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is the existing **web app** structure: `backend/src/` (untouched by this
feature) and `frontend/src/`, `frontend/tests/` (this feature's scope), per
plan.md's Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring Tailwind CSS v4 into the existing Vite/React frontend

- [X] T001 Add `tailwindcss`, `@tailwindcss/vite`, and `clsx` to
      `frontend/package.json` dependencies and run `npm install` (research.md §1, §3)
- [X] T002 Register the `@tailwindcss/vite` plugin in `frontend/vite.config.ts`
- [X] T003 [P] Replace the contents of `frontend/src/styles/global.css` with the
      CSS-first entry point (`@import "tailwindcss";`), removing the legacy
      hand-written selectors it replaces (constitution: no `tailwind.config.js`)

**Checkpoint**: `npm run dev` builds with Tailwind utilities available; no visual
migration has happened yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core theme/token infrastructure that every atomic component and every
user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define the new palette in an `@theme` block in
      `frontend/src/styles/global.css`: `--color-primary` accent, neutral gray/slate
      usage, and `--font-sans` carried forward from the current stack (data-model.md
      §1, FR-009, FR-013)
- [X] T005 [P] Confirm Tailwind v4's default `dark:` variant resolves against
      `prefers-color-scheme` with no extra config in `frontend/vite.config.ts` /
      `frontend/src/styles/global.css` — no custom variant or toggle is added
      (research.md §2, FR-006, FR-007)
- [X] T006 [P] Create the `frontend/src/components/ui/` directory to hold the
      shared atomic components (one file per component, per data-model.md §2)

**Checkpoint**: Theme tokens and dark-mode behavior are in place — atomic component
implementation can now begin.

---

## Phase 3: User Story 1 - Consistent card-based experience across every screen (Priority: P1) 🎯 MVP

**Goal**: Every screen (landing, library list, record detail, add-record) presents
its content through the same shared `Card`-based visual language and a common set
of reusable atomic components, with no per-screen duplicated styling.

**Independent Test**: Navigate landing → library list → record detail → add-record
and confirm every primary content block uses the same card treatment (rounded
corners, border, soft shadow, consistent padding) and that a shared element (e.g.
primary button) looks/behaves identically everywhere it appears.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T007 [P] [US1] Unit test for `Card` in `frontend/tests/unit/ui/Card.test.tsx`
      asserting `rounded-xl`/`border`/`shadow-sm`/padding classes per
      contracts/ui-components.md
- [X] T008 [P] [US1] Unit test for `Button` in `frontend/tests/unit/ui/Button.test.tsx`
      asserting `variant` styling, `loading` → `disabled` + `aria-busy`, and stable
      footprint while loading
- [X] T009 [P] [US1] Unit test for `Badge` in `frontend/tests/unit/ui/Badge.test.tsx`
      asserting the two supported `tone` values render distinct, restrained styling
- [X] T010 [P] [US1] Unit test for `Avatar` in `frontend/tests/unit/ui/Avatar.test.tsx`
      asserting fixed `w-*`/`h-*` sizing identically whether `src` is present or absent
- [X] T011 [P] [US1] Unit test for `Input` in `frontend/tests/unit/ui/Input.test.tsx`
      asserting the `<label htmlFor>` / control association

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `Card` in `frontend/src/components/ui/Card.tsx` per
      contracts/ui-components.md (depends on T004)
- [X] T013 [P] [US1] Implement `Button` in `frontend/src/components/ui/Button.tsx`
      per contracts/ui-components.md (depends on T004)
- [X] T014 [P] [US1] Implement `Badge` in `frontend/src/components/ui/Badge.tsx` per
      contracts/ui-components.md (depends on T004)
- [X] T015 [P] [US1] Implement `Avatar` in `frontend/src/components/ui/Avatar.tsx`
      per contracts/ui-components.md (depends on T004)
- [X] T016 [P] [US1] Implement `Input` in `frontend/src/components/ui/Input.tsx` per
      contracts/ui-components.md (depends on T004)
- [X] T017 [US1] Refactor `RecordCard` to compose `Card` + `Avatar` (cover) + `Badge`
      (condition) in `frontend/src/components/RecordCard.tsx` (depends on T012, T014, T015)
- [X] T018 [US1] Refactor `AppHeader` to use `Button` for sign-out in
      `frontend/src/components/AppHeader.tsx` (depends on T013)
- [X] T019 [US1] Refactor `GoogleSignInButton` to use `Button` in
      `frontend/src/components/GoogleSignInButton.tsx` (depends on T013)
- [X] T020 [US1] Refactor `LandingHero` onto Tailwind typography/spacing utilities in
      `frontend/src/components/LandingHero.tsx` (depends on T004)
- [X] T021 [US1] Refactor `LandingPage` layout composition (viewport, hero, sign-in)
      onto Tailwind utilities in `frontend/src/pages/LandingPage.tsx` (depends on T019, T020)
- [X] T022 [US1] Refactor `LibraryListPage`'s record grid so each record renders
      inside `Card` via the refactored `RecordCard`, using Tailwind grid utilities,
      in `frontend/src/pages/LibraryListPage.tsx` (depends on T017)
- [X] T023 [US1] Refactor `RecordDetailPage` layout (title/artists/tracklist/your-copy
      sections) onto `Card` + `Input` + `Button` in
      `frontend/src/pages/RecordDetailPage.tsx` (depends on T012, T013, T016)
- [X] T024 [US1] Refactor `AddRecordPage` layout (search form + result rows) onto
      `Card` + `Input` + `Button` in `frontend/src/pages/AddRecordPage.tsx` (depends
      on T012, T013, T016)
- [X] T025 [US1] Update the class-name-coupled assertion in
      `frontend/tests/integration/landingLayout.test.tsx` (currently checks
      `viewport.className` does not match `/scroll/i`) to verify the rendered
      layout behavior instead of a literal legacy class name (research.md §5)

**Checkpoint**: User Story 1 is fully functional and testable independently — every
screen uses the shared Card/atomic-component system, and all existing integration
tests pass.

---

## Phase 4: User Story 2 - Predictable loading feedback with no layout jumps (Priority: P2)

**Goal**: Every asynchronous screen shows a skeleton placeholder matching the shape
of its final content, and the skeleton/empty/error/loaded states never cause a
layout shift.

**Independent Test**: Throttle the network, open the library list and a record
detail page, and confirm a shape-matching skeleton appears immediately with no
blank screen/spinner and no visible jump when real content arrives.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T026 [P] [US2] Unit test for `Skeleton` in
      `frontend/tests/unit/ui/Skeleton.test.tsx` asserting `animate-pulse`, caller-
      supplied sizing via `className`, and `rounded` variants
- [X] T027 [P] [US2] Integration test: `LibraryListPage` renders `RecordCardSkeleton`
      placeholders while the library request is pending, in
      `frontend/tests/integration/libraryListFlow.test.tsx`
- [X] T028 [P] [US2] Integration test: `RecordDetailPage` renders
      `RecordDetailSkeleton` while the record request is pending, in
      `frontend/tests/integration/recordDetailFlow.test.tsx`
- [X] T029 [P] [US2] Integration test: `AddRecordPage` renders a skeleton placeholder
      in the results area while a search is pending, in
      `frontend/tests/integration/addRecordFlow.test.tsx`

### Implementation for User Story 2

- [X] T030 [US2] Implement the `Skeleton` primitive in
      `frontend/src/components/ui/Skeleton.tsx` per contracts/ui-components.md
      (depends on T004)
- [X] T031 [US2] Implement `RecordCardSkeleton`, matching `RecordCard`'s `Card` +
      `Avatar` sizing exactly, in `frontend/src/components/RecordCardSkeleton.tsx`
      (depends on T017, T030)
- [X] T032 [US2] Implement `RecordDetailSkeleton`, matching `RecordDetailPage`'s
      loaded-state layout exactly, in
      `frontend/src/components/RecordDetailSkeleton.tsx` (depends on T023, T030)
- [X] T033 [US2] Wire the `loading` render branch in `LibraryListPage` to show a
      `RecordCardSkeleton` grid while `entries === null`, in
      `frontend/src/pages/LibraryListPage.tsx` (depends on T031)
- [X] T034 [US2] Wire the `loading` render branch in `RecordDetailPage` to show
      `RecordDetailSkeleton` while the record hasn't loaded yet, in
      `frontend/src/pages/RecordDetailPage.tsx` (depends on T032)
- [X] T035 [US2] Wire the `loading` render branch in `AddRecordPage`'s results area
      to show a `Skeleton`-based placeholder while `loading` is true, in
      `frontend/src/pages/AddRecordPage.tsx` (depends on T030)
- [X] T036 [US2] Align the `empty` and `error` render branches in
      `LibraryListPage`, `RecordDetailPage`, and `AddRecordPage` to reuse the same
      `Card` sizing as their `loaded` branch so no state transition shifts layout
      (FR-005), in `frontend/src/pages/LibraryListPage.tsx`,
      `frontend/src/pages/RecordDetailPage.tsx`, `frontend/src/pages/AddRecordPage.tsx`

**Checkpoint**: User Stories 1 AND 2 both work independently — loading states are
shape-matched skeletons with zero layout shift across all four render states.

---

## Phase 5: User Story 3 - Comfortable, low-fatigue visual style (Priority: P3)

**Goal**: Generous spacing, medium/semibold-driven hierarchy, a restrained palette,
and soft shadows across every screen.

**Independent Test**: Visually review any screen with real content and confirm
generous/consistent spacing, medium/semibold (not heavy bold) hierarchy, a small
consistent palette, and soft shadows reserved as the default (strong shadows only on
floating elements).

### Tests for User Story 3 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T037 [P] [US3] Extend `frontend/tests/unit/ui/Card.test.tsx` and
      `frontend/tests/unit/ui/Button.test.tsx` with assertions that standard
      surfaces use `shadow-sm` (never `shadow-xl`/`shadow-2xl`) and text uses
      `font-medium`/`font-semibold` per FR-011/FR-012 (depends on T007, T008)

### Implementation for User Story 3

- [X] T038 [US3] Audit and adjust spacing utilities (`gap-4`, `space-y-4`, `p-6`)
      across `frontend/src/pages/LandingPage.tsx`,
      `frontend/src/pages/LibraryListPage.tsx`,
      `frontend/src/pages/RecordDetailPage.tsx`, `frontend/src/pages/AddRecordPage.tsx`
      for generous, consistent spacing per FR-010
- [X] T039 [US3] Audit and adjust typography classes across `frontend/src/pages/*.tsx`
      and `frontend/src/components/*.tsx` to use `font-medium`/`font-semibold`
      instead of heavy bold weights per FR-011
- [X] T040 [US3] Confirm `Card` in `frontend/src/components/ui/Card.tsx` uses
      `shadow-sm` by default, reserving stronger shadows for floating/modal-style
      elements per FR-012 (depends on T012)
- [X] T041 [US3] Sweep `frontend/src/` for any remaining hardcoded hex/rgb color
      values left over from the pre-refactor styles and replace them with the
      palette tokens from T004, per FR-013

**Checkpoint**: All three user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and full-suite validation across all stories

- [X] T042 [P] Remove now-unused legacy CSS selectors from
      `frontend/src/styles/global.css` after confirming no component references them
- [X] T043 Run `npm test`, `npm run lint`, and `npm run build` in `frontend/` and
      confirm all pass (quickstart.md "Automated validation")
- [X] T044 Execute the manual validation scenarios in
      `specs/004-frontend-tailwind-refactor/quickstart.md` (card consistency,
      skeleton/no layout shift, light/dark legibility, visual lightness, no
      duplicated patterns)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion; its skeleton
  compositions additionally depend on US1's `RecordCard`/`RecordDetailPage` layout
  (T017, T023) to mirror
- **User Story 3 (Phase 5)**: Depends on Foundational completion; its polish tasks
  operate on components/pages already refactored in US1 (and, for shadow/spacing on
  loading states, US2)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — this is the MVP
- **User Story 2 (P2)**: Builds its skeleton compositions on top of US1's
  `RecordCard`/`RecordDetailPage` layouts, but is independently testable once those
  exist
- **User Story 3 (P3)**: Refines styling already introduced by US1 (and touches
  US2's loading states for shadow consistency), but is independently testable via
  visual review at any point after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Atomic components before screen refactors that consume them
- Story complete before moving to the next priority (recommended order: US1 → US2 → US3)

### Parallel Opportunities

- T003 (Setup) can run in parallel with T001/T002 once dependencies are declared
- T005 and T006 (Foundational) can run in parallel after T004
- T007–T011 (US1 tests) can all run in parallel
- T012–T016 (US1 atomic component implementations) can all run in parallel
- T026 (US2 test) can run in parallel with any remaining US1 work once Foundational
  is done
- T027–T029 (US2 integration tests) can all run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for Card in frontend/tests/unit/ui/Card.test.tsx"
Task: "Unit test for Button in frontend/tests/unit/ui/Button.test.tsx"
Task: "Unit test for Badge in frontend/tests/unit/ui/Badge.test.tsx"
Task: "Unit test for Avatar in frontend/tests/unit/ui/Avatar.test.tsx"
Task: "Unit test for Input in frontend/tests/unit/ui/Input.test.tsx"

# Launch all atomic component implementations for User Story 1 together:
Task: "Implement Card in frontend/src/components/ui/Card.tsx"
Task: "Implement Button in frontend/src/components/ui/Button.tsx"
Task: "Implement Badge in frontend/src/components/ui/Badge.tsx"
Task: "Implement Avatar in frontend/src/components/ui/Avatar.tsx"
Task: "Implement Input in frontend/src/components/ui/Input.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md scenario 1 (card-based consistency)
   independently
5. Deploy/demo if ready — the app is now visually consistent even without
   skeletons or the visual-lightness polish pass

### Incremental Delivery

1. Complete Setup + Foundational → Tailwind/theme foundation ready
2. Add User Story 1 → validate independently → deploy/demo (MVP!)
3. Add User Story 2 → validate independently (throttled network, no layout shift) → deploy/demo
4. Add User Story 3 → validate independently (visual review) → deploy/demo
5. Each story adds value without breaking the previous stories or any existing
   integration test

### Solo Developer Strategy

Given this is a presentation-layer refactor of an existing app (not a
multi-developer greenfield build), the realistic path is sequential: Setup →
Foundational → US1 → US2 → US3 → Polish, using the `[P]` markers within each phase
to batch independent file edits rather than parallelizing across stories.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle I (Test-First, NON-NEGOTIABLE) applies: every unit/
  integration test task must be written and observed to fail before its
  corresponding implementation task
- FR-008/SC-006 (no functional regression) is gated by the pre-existing
  integration suites in `frontend/tests/integration/` continuing to pass unmodified,
  except the one explicitly-updated assertion in T025
- Commit after each task or logical group, following Conventional Commits per the
  constitution's Development Workflow section
