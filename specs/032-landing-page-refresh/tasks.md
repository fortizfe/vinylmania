---

description: "Task list for Landing Page Refresh"
---

# Tasks: Landing Page Refresh

**Input**: Design documents from `/specs/032-landing-page-refresh/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included — Constitution Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before implementation for every touched/new component and flow; this is not optional for this project.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Existing web app monorepo (per plan.md Project Structure): `frontend/src/`, `frontend/tests/`, `e2e/tests/`. No `backend/` changes in this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new tool dependency required by this feature before any test/implementation work begins

- [X] T001 Add `@axe-core/playwright` as a dev dependency in `e2e/package.json` and install it (research.md §3; enables the FR-010/SC-006 accessibility scan in Phase 6)

**Checkpoint**: Tooling ready for the accessibility gate used later in Phase 6

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared palette tokens and page shell that every user story's work plugs into

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add landing-specific rock/metal-inflected color tokens (e.g., `--color-landing-surface`, `--color-landing-accent`) to the `@theme` block in `frontend/src/styles/global.css`, following the existing `--color-rating-*` token pattern (research.md §4; supports FR-009)
- [X] T003 Restructure the root container in `frontend/src/pages/LandingPage.tsx` from the current single-viewport, no-scroll layout (`h-dvh w-full ... overflow-hidden`) to a scrollable vertical layout that can hold a header, a hero section, and further sections in normal document flow, keeping the `data-testid="landing-viewport"` attribute on the root element (research.md §6; unblocks FR-007/FR-008 for all stories). Do not touch the existing `if (!loading && user) return <Navigate to="/app" replace />` early-return above the restructured container — after this change, re-run `e2e/tests/returning-session.spec.ts` (which asserts `landing-viewport` is not visible for an authenticated session) as a regression guard for FR-006.
- [X] T004 Remove the two now-invalid "no-scroll" assertions from `frontend/tests/integration/landingLayout.test.tsx` (`does not wrap the landing content in a scrollable element` test, and the no-scroll-class check) since they directly contradict FR-007/FR-008's scrollable, sectioned design (research.md §6)

**Checkpoint**: Foundation ready — page shell is scrollable and palette tokens exist; user story implementation can now begin

---

## Phase 3: User Story 1 - First impression reflects product identity (Priority: P1) 🎯 MVP

**Goal**: A first-time visitor sees a headline and supporting copy describing Vinylmania's purpose (Discogs catalog, ratings, curated rock/metal news), styled consistently with the app's existing design tokens in both light and dark mode.

**Independent Test**: Load the landing page and confirm the hero renders a heading + supporting copy referencing the three product pillars, rendered with the app's design tokens, in both light and dark mode — independent of the sign-in header or pillar sections below it.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL before implementation (Constitution Principle I)

- [X] T005 [P] [US1] Update `frontend/tests/components/LandingHero.test.tsx` to assert the heading/copy references the app's three pillars (Discogs catalog, ratings, curated rock/metal news), replacing the current generic "organize/manage/collection" assertion (FR-001)
- [X] T006 [P] [US1] Add a test in `frontend/tests/integration/landingLayout.test.tsx` asserting the hero heading and supporting copy render inside the `landing-viewport` container with the app's existing design-token classes present (light/dark variants) (FR-002)

### Implementation for User Story 1

- [X] T007 [US1] Update `frontend/src/components/LandingHero.tsx`: rewrite the copy to reference the three product pillars and apply the FR-009 rock/metal-inflected typography/color treatment using the new `@theme` tokens from T002 (depends on T002, T005, T006)
- [X] T008 [US1] Render the updated `LandingHero` as the first section inside the restructured `frontend/src/pages/LandingPage.tsx` layout from T003 (depends on T003, T007)

**Checkpoint**: User Story 1 is independently functional and testable — first impression/value-prop is correct and on-brand.

---

## Phase 4: User Story 2 - Sign-in is always within easy reach (Priority: P2)

**Goal**: The sign-in action is presented in a persistent (sticky) header — brand/logo + sign-in only — that stays visible at every scroll position.

**Independent Test**: Load the landing page, scroll through all content, and confirm the sign-in button remains visible/reachable at every scroll position and viewport size, and that completing sign-in still lands the visitor in `/app` exactly as before.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; confirm they FAIL before implementation (Constitution Principle I)

- [X] T009 [P] [US2] Create `frontend/tests/components/LandingHeader.test.tsx` asserting the header renders the Vinylmania wordmark and the sign-in action, carries sticky-positioning classes (`sticky`, `top-0`), and renders no nav/anchor links (FR-008); also assert that passing `loading`/`error` props through to the wrapped `GoogleSignInButton` still renders its loading state ("Signing in…") and its `role="alert"` error message correctly (FR-004)
- [X] T010 [P] [US2] Add a test in `frontend/tests/integration/landingLayout.test.tsx` asserting the sign-in button lives inside the sticky header element (not the scrollable body), so it stays present regardless of scroll position (FR-003)
- [X] T011 [P] [US2] Extend `e2e/tests/sign-in.spec.ts` with a scenario that scrolls to the bottom of the landing page and asserts the header and "Sign in with Google" button are still visible in the viewport before completing the existing sign-in flow (FR-003/FR-008)

### Implementation for User Story 2

- [X] T012 [US2] Create `frontend/src/components/LandingHeader.tsx`: a sticky header reusing the `AppHeader` sticky-positioning Tailwind pattern (research.md §1), styled with the FR-009 rock/metal palette tokens from T002, rendering the Vinylmania wordmark and the existing `GoogleSignInButton` (accepting `onClick`/`loading`/`error` props), with no search box, nav icons, or hamburger menu (depends on T002, T009; must fail first)
- [X] T013 [US2] Update `frontend/src/pages/LandingPage.tsx` to render `LandingHeader` (wired to `useAuth`'s `signIn`/`signingIn`/`error`) at the top of the scrollable layout, removing the old standalone `GoogleSignInButton` placement from the page body (depends on T003, T008, T012)

**Checkpoint**: User Stories 1 AND 2 both work independently — sign-in is always reachable via the sticky header.

---

## Phase 5: User Story 3 - Visitors get a glimpse of what the product offers (Priority: P3)

**Goal**: Three distinct sections beneath the hero showcase the app's core pillars (Discogs catalog, personal ratings, curated rock/metal news), each as an icon + short copy — no screenshots or live data.

**Independent Test**: Scroll past the hero and confirm three sections are present, each with an icon, a title, and one–two lines of copy describing a distinct product pillar, with no live backend data involved.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; confirm they FAIL before implementation (Constitution Principle I)

- [X] T014 [P] [US3] Create `frontend/tests/components/LandingPillarSection.test.tsx` asserting the component renders an icon, a title, and description text for a given `PillarSectionContent` prop (data-model.md)
- [X] T015 [P] [US3] Add a test in `frontend/tests/integration/landingLayout.test.tsx` asserting the landing page renders exactly three pillar sections (catalog, ratings, news) below the hero, each with a heading and descriptive text (FR-007)

### Implementation for User Story 3

- [X] T016 [P] [US3] Create `frontend/src/components/LandingPillarSection.tsx`: a presentational component rendering a hand-authored inline SVG icon + title + description, matching the `PillarSectionContent` shape from data-model.md and the icon approach from research.md §2 (depends on T014; must fail first)
- [X] T017 [US3] Author the three pillar content entries (catalog/ratings/news titles, copy, and inline SVG icons) as a local data array in `frontend/src/pages/LandingPage.tsx` (or a co-located constants file) and render three `LandingPillarSection` instances below the hero (depends on T003, T008, T016)

**Checkpoint**: All three user stories are independently functional — the full landing page matches the clarified spec.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Feature-wide accessibility gate, responsive verification, changelog/versioning compliance, and final validation

- [X] T018 [P] Add an automated accessibility scan (using `@axe-core/playwright` from T001) against the landing route (`/`) in `e2e/tests/sign-in.spec.ts`, asserting zero serious/critical violations (FR-010/SC-006, research.md §3) — depends on T001, T008, T013, T017
- [X] T019 [P] Verify every new/changed `@theme` color token pairing from T002 meets the WCAG 2.1 AA 4.5:1 contrast minimum (FR-010) and record the verification in `specs/032-landing-page-refresh/research.md` §4 — depends on T002, T007, T012, T016
- [X] T020 Add a `frontend/CHANGELOG.md` entry under a new version heading (Keep a Changelog `Added`/`Changed` categorization) describing the landing page refresh, per the Constitution's Development Workflow gate — depends on T008, T013, T017
- [X] T021 Bump the `version` field in `frontend/package.json` to the next MINOR version to match T020's changelog heading, per Constitution Principle VI — depends on T020
- [X] T022 Run the `specs/032-landing-page-refresh/quickstart.md` validation steps (manual scenarios + `npm run test`, `npm run build`, `npm run lint`, and the Playwright e2e spec) end-to-end and confirm everything passes — depends on T018, T019, T020, T021, T023
- [X] T023 [P] In `e2e/tests/sign-in.spec.ts` (or a new `e2e/tests/landing-responsive.spec.ts`), add automated Playwright checks at mobile (~375px), tablet (~768px), and desktop (~1280px) viewport sizes asserting the sticky header, sign-in button, and all three pillar sections render without layout breakage (FR-005/SC-005) — depends on T008, T013, T017

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completion
  - US1 (P1) has no dependency on US2/US3
  - US2 (P2) implementation (T013) removes the old inline `GoogleSignInButton` placement introduced by US1's T008, so **US2 should start after US1's T008 lands** even though its tests (T009-T011) can be written earlier
  - US3 (P3) implementation (T017) adds sections after the hero from US1's T008, so **US3 should start after US1's T008 lands**; it does not depend on US2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests (T005-T006, T009-T011, T014-T015) MUST be written and FAIL before their corresponding implementation tasks
- Component implementation before page-wiring implementation (e.g., T007 before T008; T012 before T013; T016 before T017)

### Parallel Opportunities

- T002 (theme tokens) can run in parallel with T001 (dependency install) — different files
- Within Phase 3: T005 and T006 in parallel (different files)
- Within Phase 4: T009, T010, T011 in parallel (different files)
- Within Phase 5: T014 and T015 in parallel (different files); T016 can start as soon as T014 fails, in parallel with T015
- Within Phase 6: T018, T019, and T023 in parallel (different files/concerns)

---

## Parallel Example: User Story 2

```bash
# Launch all US2 tests together (must fail before T012):
Task: "Create frontend/tests/components/LandingHeader.test.tsx asserting sticky brand+sign-in header with no nav links"
Task: "Add sign-in-reachability test in frontend/tests/integration/landingLayout.test.tsx"
Task: "Extend e2e/tests/sign-in.spec.ts with a scroll-then-sign-in scenario"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004)
3. Complete Phase 3: User Story 1 (T005-T008)
4. **STOP and VALIDATE**: Confirm the hero communicates the value prop correctly in light/dark mode — the pre-existing (non-sticky) sign-in button below it still works, so the page remains fully usable even before US2/US3 land
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → shell + tokens ready
2. Add User Story 1 → validate independently → deploy/demo (MVP)
3. Add User Story 2 → sign-in becomes persistently accessible → validate → deploy/demo
4. Add User Story 3 → pillar sections complete the story → validate → deploy/demo
5. Phase 6 Polish → accessibility gate, changelog, version bump, full quickstart validation → final release

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle I (Test-First) is NON-NEGOTIABLE for this project: every test task above MUST fail before its paired implementation task begins
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
