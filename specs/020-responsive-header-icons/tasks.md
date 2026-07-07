---

description: "Task list for Responsive Header Navigation — Icons on Desktop, Hamburger on Mobile"
---

# Tasks: Responsive Header Navigation — Icons on Desktop, Hamburger on Mobile

**Input**: Design documents from `/specs/020-responsive-header-icons/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The project constitution's Test-First principle (NON-NEGOTIABLE) requires a failing test before implementation for every behavior change, and mandates e2e coverage for the affected flow on any `/frontend` PR.

**Organization**: Tasks are grouped by user story (US1, US2 — both P1 — and US3 — P2, per spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths below are relative to the repository root

## Path Conventions

Web application, frontend-only change (see plan.md Project Structure): all
paths are under `frontend/` except the one Playwright spec under `e2e/`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing toolchain is ready; no new dependencies are introduced by this feature.

- [X] T001 Run `cd frontend && npm install` to confirm the existing toolchain (`react-router-dom`, Tailwind CSS v4, Vitest, React Testing Library) builds cleanly. No new packages are required for this feature (research.md Decisions 1 and 3).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Single shared source of truth for the three nav destinations, so `HamburgerMenu` (existing) and the new icon layout never diverge (research.md Decision 4).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `frontend/src/components/headerNavLinks.ts` exporting a `NAV_LINKS` array of `{ key: 'profile' | 'wishlist' | 'library', label: string, to: string }`, matching the current three destinations and order (`My library` → `/app/library`, `My wishlist` → `/app/wishlist`, `Profile` → `/app/profile`) from the existing `HamburgerMenu.tsx` (data-model.md).
- [X] T003 Refactor `frontend/src/components/HamburgerMenu.tsx` to import `NAV_LINKS` from `headerNavLinks.ts` instead of its private local array (depends on T002). Run `frontend/tests/unit/HamburgerMenu.test.tsx` to confirm this pure refactor introduces no behavior change (all existing assertions must still pass unmodified). Also run `frontend/tests/integration/navigationMenu.test.tsx` ("never shows a menu trigger on the landing page") to confirm FR-009's landing-page/sign-in gating is unaffected by this refactor.

**Checkpoint**: Foundation ready — both `HamburgerMenu` (US2) and the new `HeaderNavIcons` (US1) can consume the same `NAV_LINKS`.

---

## Phase 3: User Story 1 - Navigate via header icons on wide screens (Priority: P1) 🎯 MVP

**Goal**: At viewport widths of 768px and above, Profile, My wishlist, and My library render as three separate, individually clickable outline icon buttons on the right side of the header, and the hamburger menu is not shown.

**Independent Test**: Sign in on a wide browser window (≥768px) and confirm three distinct, accessible icon buttons for Profile, My wishlist, and My library appear on the right side of the header instead of the hamburger icon, each navigating to the correct section on click.

### Tests for User Story 1

- [X] T004 [P] [US1] Write a failing unit test in `frontend/tests/unit/HeaderNavIcons.test.tsx`: renders three icon buttons/links, one per `NAV_LINKS` entry, each with the correct accessible name (`Profile`, `My wishlist`, `My library`) and `href`/navigation target (FR-006, FR-007), in the order defined by `NAV_LINKS`. Also assert each icon is reachable via `userEvent.tab()` in DOM order and activatable with `{Enter}` (navigates same as a click), covering SC-004's keyboard-parity claim, not just accessible-name presence.
- [X] T005 [P] [US1] Write a failing unit test in `frontend/tests/unit/AppHeader.test.tsx` (new file): rendering `AppHeader` inside a `MemoryRouter` shows both a hamburger-menu trigger button and a header-nav-icons container in the DOM, where the icons container carries Tailwind's `hidden md:flex` responsive classes and the hamburger trigger carries `md:hidden` (FR-002, FR-003, FR-004) — i.e., exactly one is CSS-visible at any given breakpoint.
- [X] T006 [US1] Write a failing e2e test in `e2e/tests/header-responsive-nav.spec.ts` (new file): at a wide viewport (`page.setViewportSize({ width: 1280, height: 800 })`), after signing in, confirm the three icon buttons (Profile, My wishlist, My library) are visible, the hamburger icon is not visible, and clicking each icon navigates to `/app/profile`, `/app/wishlist`, and `/app/library` respectively (User Story 1 acceptance scenarios).

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `frontend/src/components/HeaderNavIcons.tsx` (depends on T002): three inline outline SVG icon components (`ProfileIcon`, `WishlistIcon`, `LibraryIcon`) matching the existing `viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}` style used by `HamburgerIcon`/`SearchIcon` (research.md Decision 3), plus a `HeaderNavIcons` component that maps `NAV_LINKS` to a single `Link` per destination styled with the same classes `Button`'s `size="icon" variant="secondary"` produces (`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 ... hover:bg-gray-50 dark:...`) — extract that class string into a small shared helper (e.g. export `iconButtonClassName` from `frontend/src/components/ui/Button.tsx`) so `Button` and these `Link`s stay visually identical without nesting a `<button>` inside an `<a>`. Wrap the three `Link`s in a container with `hidden items-center gap-2 md:flex`. Satisfies T004.
- [X] T008 [US1] In `frontend/src/components/HamburgerMenu.tsx`, add the `md:hidden` class to the trigger `Button` so it is hidden at the `md` breakpoint and above (FR-002) (depends on T003).
- [X] T009 [US1] Wire `<HeaderNavIcons />` into `frontend/src/components/AppHeader.tsx`, rendering it alongside `<HamburgerMenu />` in the header's right-side container (depends on T007, T008). Satisfies T005 and T006.

**Checkpoint**: User Story 1 is independently functional and testable — wide-screen users see three working icons and no hamburger.

---

## Phase 4: User Story 2 - Navigate via hamburger menu on narrow screens (Priority: P1)

**Goal**: Below 768px, the existing hamburger menu remains the sole entry point to Profile, My wishlist, and My library, unchanged from today's behavior.

**Independent Test**: Sign in on a narrow viewport (<768px) and confirm the hamburger menu icon is shown (and the individual icons are not), and that opening it still lists Profile, My wishlist, and My library as navigable links.

### Tests for User Story 2

- [X] T010 [US2] Extend `e2e/tests/header-responsive-nav.spec.ts` (from T006) with a narrow-viewport test case (`page.setViewportSize({ width: 375, height: 812 })`): confirm the hamburger icon is visible and the three individual icons are not, opening the hamburger reveals the same three links, and each still navigates to its correct destination (User Story 2 acceptance scenarios).

### Implementation for User Story 2

- [X] T011 [US2] Run `frontend/tests/unit/HamburgerMenu.test.tsx` and the new `e2e/tests/header-responsive-nav.spec.ts` narrow-viewport case (T010) against the T007–T009 implementation. Because the icon/hamburger switch is a single two-sided CSS toggle (research.md Decision 1), no additional source change is expected — this task exists to confirm that toggling `HeaderNavIcons` on (T007) and hiding the hamburger trigger at `md:hidden` (T008) together already satisfy US2 without regressing the hamburger's existing open/close/link behavior. Additionally assert the "Sign out" button remains present and unchanged in `frontend/tests/unit/AppHeader.test.tsx` (FR-010). Fix any gap found before checking this off.

**Checkpoint**: User Stories 1 AND 2 both verified — the header shows exactly one navigation control style at each breakpoint, and neither regresses the other.

---

## Phase 5: User Story 3 - Seamless transition when screen size changes (Priority: P2)

**Goal**: Resizing the browser window or rotating a device switches the header between the icon layout and the hamburger menu automatically, with no page reload and never both/neither visible at once.

**Independent Test**: Starting on a wide browser window, resize below 768px and confirm the icons are replaced by the hamburger menu; resize back above 768px and confirm the icons return, with no broken or duplicate controls at any point.

### Tests for User Story 3

- [X] T012 [US3] Extend `e2e/tests/header-responsive-nav.spec.ts` (from T006/T010) with a resize test case: start at a wide viewport, resize down past 768px mid-test and confirm the header switches to the hamburger with no page reload, then resize back up past 768px and confirm it switches back to the icons — asserting exactly one navigation control is visible at each point (FR-004, FR-008, SC-003, User Story 3 acceptance scenarios).

### Implementation for User Story 3

- [X] T013 [US3] Run the T012 resize test against the existing T007–T009 implementation. Per research.md Decision 1, the pure-CSS `hidden md:flex` / `md:hidden` toggle requires no JS resize listener and should pass without additional code; if the test surfaces a real failure (e.g., a stale hamburger modal left open across the breakpoint per research.md Decision 2's edge case), address the minimal gap found — do not add speculative resize-handling code the test doesn't require.

**Checkpoint**: All three user stories are independently functional — the header responds correctly to every viewport size covered by the spec.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite validation across all three stories, plus the project's changelog/versioning gate.

- [X] T014 [P] Run `cd frontend && npm run lint && npm test` to confirm no regressions across the full frontend unit/component suite.
- [X] T015 [P] Run `cd e2e && npx playwright test header-responsive-nav` to confirm the full new e2e spec (wide, narrow, and resize cases) passes.
- [X] T016 Add a `frontend/CHANGELOG.md` entry (`Added`: header nav icons on wide screens; `Changed`: hamburger menu now shown only below the `md` breakpoint) under a new dated version heading, and bump the `version` field in `frontend/package.json` (MINOR bump, e.g. `0.10.0` → `0.11.0`), per the project's Development Workflow versioning gate.
- [X] T017 Walk through the manual validation scenarios in [quickstart.md](./quickstart.md) end-to-end against a running `npm run dev` instance.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (both US1 and US2 consume `NAV_LINKS` from `headerNavLinks.ts`).
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on User Story 1 (the CSS toggle that shows the icons at `md:flex` is the same toggle that hides the hamburger at `md:hidden`; US2 verifies the other side of that same change).
- **User Story 3 (Phase 5)**: Depends on User Story 1 and User Story 2 both being in place (there must be two distinct layouts before a transition between them can be tested).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — independently testable per its own acceptance scenarios (icons visible and working at wide viewports, hamburger absent).
- **User Story 2 (P1)**: Shares its implementation with User Story 1 (one two-sided CSS toggle) but is independently testable per its own acceptance scenarios (hamburger visible and working at narrow viewports, icons absent).
- **User Story 3 (P2)**: Builds on both P1 stories being in place; independently testable via the resize scenario once both layouts exist.

This is intentionally not a parallel-team split across stories: US1 and US2 are the two faces of a single implementation change (T007–T009), and US3 only makes sense once both exist.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Story complete before moving to the next priority.

### Parallel Opportunities

- T004 and T005 (US1 unit tests) can be written in parallel — different files.
- T007 can be implemented in parallel with writing T005/T006 — different files, though it must land before those tests can pass.
- T014 and T015 (Polish) can run in parallel — different test runners.

---

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 unit tests together (different files, no shared dependency):
Task: "Failing unit test in frontend/tests/unit/HeaderNavIcons.test.tsx"
Task: "Failing unit test in frontend/tests/unit/AppHeader.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks both P1 stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm wide-screen icons render, are accessible, and navigate correctly
5. Deploy/demo if ready — note that because US1 and US2 share one CSS toggle, completing US1 alone already leaves the narrow-screen hamburger in its correct (unchanged) state too

### Incremental Delivery

1. Complete Setup + Foundational → shared `NAV_LINKS` ready
2. Add User Story 1 → validate independently → deploy/demo (MVP!)
3. Add User Story 2 → validate independently (narrow-screen hamburger confirmed unaffected) → deploy/demo
4. Add User Story 3 → validate independently (resize transition confirmed) → deploy/demo
5. Each story adds verification/value without breaking the previous one

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are delivered by the same underlying change (a single CSS-driven toggle in `AppHeader`/`HamburgerMenu`/`HeaderNavIcons`); their separate phases exist to keep each story's acceptance scenarios independently testable and reviewable, not because the code is built twice
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
