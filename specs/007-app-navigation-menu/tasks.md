---

description: "Task list template for feature implementation"
---

# Tasks: App Navigation — Hamburger Menu, Dashboard & Back Navigation

**Input**: Design documents from `/specs/007-app-navigation-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-navigation.md, quickstart.md

**Tests**: Included — constitution Principle I (Test-First, NON-NEGOTIABLE)
requires a failing test before implementation for every story.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story. User Stories 1 and 2 are both
Priority P1 in spec.md; User Story 3 is P2. The route restructuring that all
three stories rely on (data-model.md §1) is carried by User Story 1, since
establishing the new Dashboard entry point is what requires moving the
library to its own path in the first place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Existing **web app** structure: this feature is entirely within `frontend/src/`
and `frontend/tests/`, per plan.md's Project Structure section. No backend
changes.

---

## Phase 1: Setup

**Purpose**: N/A — no new dependency, tool, or scaffolding is required (see
research.md and plan.md's Technical Context: no new npm package; every
directory this feature writes to already exists). This phase is intentionally
empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — the one genuinely shared prerequisite (restructuring the
route table) is carried by User Story 1 below rather than a separate phase,
since it's inseparable from that story's own goal (establishing the new
Dashboard entry point). This phase is intentionally empty.

---

## Phase 3: User Story 1 - Land on a Dashboard after signing in (Priority: P1) 🎯 MVP

**Goal**: Sign-in lands on a new Dashboard placeholder (reached at `/app`),
the library moves to `/app/library` (with its `add`/`record detail`
sub-routes nested underneath), and the header logo continues to return to
the Dashboard from anywhere.

**Independent Test**: Sign in and confirm the Dashboard (showing "under
construction") is what appears; navigate to the library and confirm clicking
the logo/app name returns to the Dashboard (quickstart.md scenario 1).

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T001 [P] [US1] Unit test for `UnderConstruction` in
      `frontend/tests/unit/UnderConstruction.test.tsx` — renders the given
      `title` and a static "under construction" message inside a `Card`, per
      contracts/ui-navigation.md
- [X] T002 [US1] Update `frontend/tests/integration/signInFlow.test.tsx`:
      replace the post-sign-in `getByText(/your library/i)` assertion with an
      assertion for the Dashboard's "under construction" content, per
      data-model.md §1
- [X] T003 [US1] Update `frontend/tests/integration/signOutFlow.test.tsx`:
      replace the same pre-sign-out assertion with the Dashboard's content
      (the test still needs to reach a signed-in state before exercising
      sign-out)

### Implementation for User Story 1

- [X] T004 [US1] Create the shared `UnderConstruction` component in
      `frontend/src/components/UnderConstruction.tsx` per
      contracts/ui-navigation.md (depends on T001)
- [X] T005 [US1] Create `DashboardPage` in
      `frontend/src/pages/DashboardPage.tsx`, using `UnderConstruction`
      (depends on T004)
- [X] T006 [US1] Restructure the route table in `frontend/src/App.tsx` per
      data-model.md §1: `/app` → `DashboardPage`; add `/app/library` →
      `LibraryListPage`, `/app/library/add` → `AddRecordPage`,
      `/app/library/records/:entryId` → `RecordDetailPage` (depends on T005,
      T002, T003)
- [X] T007 [P] [US1] Update the record link path in
      `frontend/src/components/RecordCard.tsx` from
      `/app/records/${entry.id}` to `/app/library/records/${entry.id}`
      (depends on T006)
- [X] T008 [P] [US1] Update the "Add a record" link path in
      `frontend/src/pages/LibraryListPage.tsx` from `/app/add` to
      `/app/library/add` (depends on T006)
- [X] T009 [P] [US1] Update the post-remove `navigate()` call in
      `frontend/src/pages/RecordDetailPage.tsx` from `/app` to
      `/app/library` (depends on T006)

**Checkpoint**: User Story 1 is independently testable — sign-in lands on the
Dashboard, the logo returns to it from anywhere, and the library/add/record-
detail screens still work, now at their new paths.

---

## Phase 4: User Story 2 - Navigate the app through the hamburger menu (Priority: P1)

**Goal**: A header menu offers "My library", "My wishlist", and "Profile",
each navigating correctly (the latter two to new "under construction"
placeholders), and works equally well on narrow and wide viewports.

**Independent Test**: Open the menu from any authenticated screen and confirm
all three options are present and each navigates to its destination
(quickstart.md scenario 2).

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T010 [P] [US2] Extend `frontend/tests/unit/ui/Modal.test.tsx` with
      cases for the new `position` prop: `position="end"` still renders the
      dialog/backdrop/close/`Escape` behavior; the default (`"center"`,
      omitted) continues to pass every existing assertion unchanged, per
      contracts/ui-navigation.md "Modal"
- [X] T011 [P] [US2] Unit test for `HamburgerMenu` in
      `frontend/tests/unit/HamburgerMenu.test.tsx` — the trigger opens the
      menu; exactly three links appear in order ("My library" → `/app/library`,
      "My wishlist" → `/app/wishlist`, "Profile" → `/app/profile`); opening
      the menu does not itself navigate; selecting a link, the backdrop, or
      `Escape` closes it, per contracts/ui-navigation.md "HamburgerMenu"
- [X] T012 [US2] New integration test
      `frontend/tests/integration/navigationMenu.test.tsx`: from an
      authenticated screen, open the menu and navigate to each of the three
      destinations (confirming the wishlist/profile placeholders and the
      working library); separately, render the landing page and confirm no
      menu trigger exists anywhere in the document

### Implementation for User Story 2

- [X] T013 [US2] Extend `Modal` in `frontend/src/components/ui/Modal.tsx`
      with the `position` prop (`'center' | 'end'`, default `'center'`) per
      contracts/ui-navigation.md and research.md §2 (depends on T010)
- [X] T014 [P] [US2] Create `WishlistPage` in
      `frontend/src/pages/WishlistPage.tsx`, using `UnderConstruction`
      (depends on T004)
- [X] T015 [P] [US2] Create `ProfilePage` in
      `frontend/src/pages/ProfilePage.tsx`, using `UnderConstruction`
      (depends on T004)
- [X] T016 [US2] Add the `/app/wishlist` and `/app/profile` routes to
      `frontend/src/App.tsx` (depends on T014, T015, T006)
- [X] T017 [US2] Implement `HamburgerMenu` in
      `frontend/src/components/HamburgerMenu.tsx` per
      contracts/ui-navigation.md, using `Modal position="end"` (depends on
      T011, T013)
- [X] T018 [US2] Wire `HamburgerMenu`'s trigger into
      `frontend/src/components/AppHeader.tsx` alongside the existing logo
      and sign-out button, per research.md §3 (depends on T017)

**Checkpoint**: User Stories 1 AND 2 together deliver the full navigation
surface — Dashboard entry point plus a working hamburger menu to every
destination, on both narrow and wide viewports.

---

## Phase 5: User Story 3 - Go back from any section (Priority: P2)

**Goal**: A consistent back action, placed the same way everywhere, lets a
collector return to the library from the add-record and record-detail
screens.

**Independent Test**: Navigate into a record's detail page (or the add-record
screen) from the library and confirm a consistently placed back action is
available and returns to the library (quickstart.md scenario 4).

### Tests for User Story 3 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T019 [P] [US3] Unit test for `BackLink` in
      `frontend/tests/unit/ui/BackLink.test.tsx` — renders a chevron + label
      (default `"Back"`) as a link to the given `to` prop, per
      contracts/ui-navigation.md "BackLink"
- [X] T020 [US3] Update `frontend/tests/integration/recordDetailFlow.test.tsx`:
      mount at the new nested path (`/app/library/records/:entryId`, with a
      `/app/library` stub route standing in for "library"), and assert a
      back action is present and links to `/app/library`
- [X] T021 [US3] Update `frontend/tests/integration/addRecordFlow.test.tsx`:
      mount at the new nested path (`/app/library/add`, with a
      `/app/library` stub route), and assert a back action is present and
      links to `/app/library`

### Implementation for User Story 3

- [X] T022 [US3] Implement `BackLink` in
      `frontend/src/components/ui/BackLink.tsx` per
      contracts/ui-navigation.md (depends on T019)
- [X] T023 [US3] Add a `BackLink` (`to="/app/library"`) at the top of
      `frontend/src/pages/AddRecordPage.tsx`'s content, above its heading
      (depends on T022, T021)
- [X] T024 [US3] Add a `BackLink` (`to="/app/library"`) at the top of
      `frontend/src/pages/RecordDetailPage.tsx`'s content — above its
      heading, loading, and not-found states alike, so it's present
      regardless of which render branch is active (depends on T022, T020)

**Checkpoint**: All three user stories are independently functional — the
full navigation redesign (Dashboard, menu, back action) is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories

- [X] T025 [P] Run `npm test`, `npm run lint`, and `npm run build` in
      `frontend/` and confirm all pass
- [X] T026 Execute quickstart.md end-to-end (all 4 scenarios, including both
      narrow and wide viewports) and record the outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1–2)**: Empty — the shared route
  restructuring is carried by User Story 1
- **User Story 1 (Phase 3)**: No dependency on other stories
- **User Story 2 (Phase 4)**: Its new routes (T016) and the shared
  `UnderConstruction` component (T014, T015 depend on T004) build on User
  Story 1's work; its `Modal`/`HamburgerMenu` pieces (T010, T011, T013, T017)
  have no dependency on User Story 1 and can proceed in parallel with it
- **User Story 3 (Phase 5)**: Its integration test updates and `BackLink`
  placement depend on User Story 1's new nested route paths existing
  (T006); its `BackLink` component itself (T019, T022) has no such
  dependency and can proceed in parallel
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — this is the MVP
  (Dashboard entry point + restructured routes)
- **User Story 2 (P1)**: Reuses User Story 1's `UnderConstruction` and route
  table shape; its menu-specific pieces are independently buildable
- **User Story 3 (P2)**: Targets the nested paths User Story 1 establishes;
  its `BackLink` component itself is independent

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Shared component (`UnderConstruction`, `Modal` extension, `BackLink`)
  before the pages/components that consume it
- Route table changes before the link/navigate call sites that depend on
  the new paths existing
- Story complete before moving to the next priority (recommended order:
  US1 → US2 → US3, matching their P1/P1/P2 priorities)

### Parallel Opportunities

- T007, T008, T009 (US1 link/navigate updates) can all run in parallel once
  T006 is done — different files
- T010, T011 (US2 tests) can run in parallel
- T014, T015 (US2 placeholder pages) can run in parallel — different files
- The US2 `Modal`/`HamburgerMenu` track (T010, T011, T013, T017) can proceed
  in parallel with all of User Story 1, since neither touches the other's
  files until T018 wires the finished menu into `AppHeader`
- T019 (US3 test) can proceed at any time — `BackLink` has no dependency on
  User Story 1 or 2
- T025 and T026 (Polish) — T025 can run before T026's manual pass

---

## Parallel Example: User Story 1

```bash
# After T006 (route table restructured), these can run in parallel:
Task: "Update RecordCard's link path (T007)"
Task: "Update LibraryListPage's 'Add a record' link path (T008)"
Task: "Update RecordDetailPage's post-remove navigate() path (T009)"
```

## Parallel Example: User Story 2's Modal/HamburgerMenu track vs. User Story 1

```bash
# These can run in parallel with User Story 1's tasks (different files):
Task: "Extend Modal's test with the position prop (T010)"
Task: "Unit test for HamburgerMenu (T011)"
Task: "Extend Modal with the position prop (T013)"
Task: "Implement HamburgerMenu (T017)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1
2. **STOP and VALIDATE**: Run quickstart.md scenario 1 — sign-in lands on the
   Dashboard, and the logo reliably returns to it
3. At this point the entry-point change is live even before the menu or
   back-navigation exist

### Incremental Delivery

1. Add User Story 1 → validate independently → new entry point live (MVP!)
2. Add User Story 2 → validate independently (menu on both viewport widths,
   absent on landing) → full navigation surface live
3. Add User Story 3 → validate independently (back action on the two deeper
   screens) → full feature complete
4. Each story adds value without breaking the previous ones or any existing
   test

### Solo Developer Strategy

Since User Story 2's `Modal`/`HamburgerMenu` work (T010, T011, T013, T017)
and User Story 3's `BackLink` (T019, T022) don't depend on User Story 1's
route restructuring, they can be built in any order relative to it — only the
final wiring steps (T016's new routes, T018's header wiring, T023/T024's
placement, and the three integration test updates) need User Story 1's
route table to exist first. A practical sequence: T001–T009 (US1) →
T010–T018 (US2) → T019–T024 (US3) → Polish.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle I (Test-First, NON-NEGOTIABLE) applies: every test
  task must be written and observed to fail before its corresponding
  implementation task
- No backend changes are involved in this feature; `backend/` is untouched
- Commit after each task or logical group, following Conventional Commits per
  the constitution's Development Workflow section
