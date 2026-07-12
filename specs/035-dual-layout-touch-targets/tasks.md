---

description: "Task list for Dual Desktop/Mobile Layout & 44px Touch Targets"
---

# Tasks: Dual Desktop/Mobile Layout & 44px Touch Targets

**Input**: Design documents from `/specs/035-dual-layout-touch-targets/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md) (N/A — no data model), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. The project constitution's Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before implementation, and the Development Workflow gate requires Playwright e2e coverage under `/e2e` for any `/frontend` PR — both apply directly to this feature.

**Organization**: The spec defines a single user story (US1, P1) covering all nine in-scope screens plus the app header, grouped by screen. Tasks below are grouped the same way as sub-sections within the User Story 1 phase, matching spec.md's Acceptance Scenarios 1–15.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `US1` for every task in the user-story phase (this feature has only one story)
- File paths are relative to the repository root

## Path Conventions

Web app split already in place: `frontend/src/**`, `frontend/tests/**`, `e2e/tests/**`. This feature does not touch `backend/`.

---

## Phase 1: Setup

**Purpose**: Establish a regression baseline before any code changes

- [X] T001 [P] Audit existing Vitest/Playwright coverage for each of the 9 in-scope screens (rating, condition-edit, add/remove-from-library, filtering, pagination, Discogs link/unlink, theme toggle) and note any screen whose core actions currently lack a passing test — these gaps must be closed (or explicitly accepted as risk) before relying on "rerun the suite" as the regression safety net for FR-007/SC-005
- [X] T002 Run the full existing test suites (`npm test` in `frontend/`, `npm test` in `e2e/`) and record the current pass/fail baseline, so later phases can be checked against it for regressions
- [X] T003 [P] Confirm Tailwind's default breakpoint scale (`sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px) is unmodified in `frontend/src/styles/global.css`'s `@theme` block — this feature relies on the stock scale and must not introduce custom breakpoint values

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the 44×44px touch-target floor once in the shared atomic components that most screens depend on (`Button`'s `size="icon"` and default `md` size are reused by ~7 call sites across the app), per the centralization decision in [research.md](./research.md) §2

**⚠️ CRITICAL**: No per-screen work in Phase 3 should be considered complete until its screen re-verifies against these fixed atomics, but screen-level layout tasks (grid/composition changes) may start in parallel with this phase since they touch different files

- [X] T004 [P] Write a failing Vitest test asserting `Button`'s `size="icon"` variant and default `md` size (and the exported `iconButtonClassName()` helper) render `min-h-11 min-w-11` / `min-h-11` in `frontend/tests/unit/ui/Button.test.tsx`
- [X] T005 [P] Fix the touch-target floor in `frontend/src/components/ui/Button.tsx` (`sizeClasses.icon`, default `md` size, `iconButtonClassName()`) to satisfy T004
- [X] T006 [P] Write a failing Vitest test asserting `Input` renders `min-h-11` in `frontend/tests/unit/ui/Input.test.tsx`
- [X] T007 [P] Fix the touch-target floor in `frontend/src/components/ui/Input.tsx` to satisfy T006
- [X] T008 [P] Write a failing Vitest test asserting `Checkbox`'s clickable row wrapper (input + label) is at least 44px tall in `frontend/tests/unit/ui/Checkbox.test.tsx`
- [X] T009 [P] Add a ≥44px row wrapper around `Checkbox`'s input+label in `frontend/src/components/ui/Checkbox.tsx` to satisfy T008
- [X] T010 [P] Write a failing Vitest test asserting `ThemeToggle` renders `min-h-11` in `frontend/tests/unit/ui/ThemeToggle.test.tsx` (new file)
- [X] T011 [P] Fix the touch-target floor in `frontend/src/components/ui/ThemeToggle.tsx` to satisfy T010
- [X] T012 [P] Write a failing Vitest test asserting each `StarRating` star `<button>` renders `min-h-11 min-w-11` in `frontend/tests/unit/ui/StarRating.test.tsx` (new file)
- [X] T013 [P] Fix the touch-target floor in `frontend/src/components/ui/StarRating.tsx` to satisfy T012
- [X] T014 [P] Write a failing Vitest test asserting `BackLink` renders `min-h-11` in `frontend/tests/unit/ui/BackLink.test.tsx`
- [X] T015 [P] Fix the touch-target floor in `frontend/src/components/ui/BackLink.tsx` to satisfy T014
- [X] T016 Extend `frontend/tests/unit/ui/Modal.test.tsx` with an assertion that the close button (rendered via `Button size="icon"`) meets `min-h-11 min-w-11` — depends on T005 (should pass once `Button` is fixed; no `Modal.tsx` change expected, this is regression coverage)

**Checkpoint**: All shared atomic components enforce the 44px floor — per-screen work in Phase 3 can now rely on them without re-solving touch-target sizing from scratch.

---

## Phase 3: User Story 1 - Usar cualquier pantalla cómodamente en escritorio y en móvil (Priority: P1) 🎯 MVP

**Goal**: Every in-scope screen has a purpose-built desktop composition (multi-column/panels, ≥1280px) and a purpose-built mobile composition (single column, no horizontal scroll, below 768px), with every interactive control at least 44×44px on mobile, and zero change to existing data/actions/flows.

**Independent Test**: Each screen sub-group below can be verified on its own by opening that screen at a desktop width (≥1280px) and a mobile width (360–430px) and running its Playwright spec — no other screen needs to be migrated first.

### Landing Page (Acceptance Scenarios 1–2)

- [X] T017 [P] [US1] Write a failing Playwright spec `e2e/tests/landing-page-responsive.spec.ts`: at ≥1280px the hero/pillar section renders in a multi-column/row composition (not a single centered column); at 375px it is single-column with no horizontal scroll; the sign-in control's `boundingBox()` is ≥44×44; live resize across `md`/`xl` triggers no navigation/reload
- [X] T018 [US1] Implement the desktop multi-column pillar composition in `frontend/src/components/LandingPillarSection.tsx` and `frontend/src/pages/LandingPage.tsx` (replace the fixed `max-w-4xl` single-row/column constraint with a wider `lg:`/`xl:` composition) to satisfy T017
- [X] T019 [US1] Verify the Google sign-in control in `frontend/src/components/LandingHeader.tsx` / `frontend/src/components/GoogleSignInButton.tsx` meets 44×44px at mobile widths, adjusting padding if T017 finds it short

**Checkpoint**: Landing page independently passes T017.

### Search Results Page (Acceptance Scenarios 3–4)

- [X] T020 [P] [US1] Write a failing Playwright spec `e2e/tests/search-results-responsive.spec.ts`: at ≥1280px filters and the results grid form a deliberate multi-panel/multi-column composition; at 375px the grid starts at a single column with no horizontal scroll; filter chips, filter action icons, and each result card's add-to-library icon have `boundingBox()` ≥44×44
- [X] T021 [US1] Update the results grid and container composition in `frontend/src/pages/SearchResultsPage.tsx` (base `grid-cols-1`, then `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`; filters-plus-grid panel arrangement at `xl:`) to satisfy T020
- [X] T022 [P] [US1] Verify/adjust `frontend/src/components/filters/FilterActions.tsx` icon buttons and mobile filter-bar spacing against T020 (should already meet 44px via the Phase 2 `Button` fix — confirm and adjust layout only if needed)
- [X] T023 [P] [US1] Verify/adjust `frontend/src/components/ResultCardActions.tsx` icon button against T020 (should already meet 44px via the Phase 2 `Button` fix)
- [X] T024 [US1] Update `frontend/src/components/SearchResultCardSkeleton.tsx` to match `SearchResultsPage`'s new base `grid-cols-1` shape so no layout shift occurs between skeleton and populated states — depends on T021

**Checkpoint**: Search results page independently passes T020.

### My Library Page (Acceptance Scenarios 5–6)

- [X] T025 [P] [US1] Write a failing Playwright spec `e2e/tests/library-list-responsive.spec.ts`: at ≥1280px the record grid uses a deliberate multi-column composition; at 375px it is single-column with no horizontal scroll; pagination controls and the "link Discogs account" control have `boundingBox()` ≥44×44
- [X] T026 [US1] Replace the `grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]` grid in `frontend/src/pages/LibraryListPage.tsx` with an explicit Tailwind breakpoint grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) and confirm pagination buttons meet 44px via the Phase 2 `Button` fix, to satisfy T025
- [X] T027 [US1] Convert `frontend/src/components/LibraryLinkRequired.tsx` from hand-rolled anchor markup duplicating `Button`'s primary styles to the shared `<Button>` atomic component, so it inherits the 44px floor and complies with the constitution's atomic-reuse rule
- [X] T028 [US1] Update `frontend/src/components/RecordCardSkeleton.tsx` to match `LibraryListPage`'s new grid shape at each breakpoint so no layout shift occurs — depends on T026

**Checkpoint**: Library page independently passes T025.

### Wishlist Page (Acceptance Scenario 7)

- [X] T029 [P] [US1] Write a failing Playwright spec `e2e/tests/wishlist-responsive.spec.ts`: at 375px the placeholder container has no horizontal scroll; any interactive control present has `boundingBox()` ≥44×44; live resize across `md`/`xl` triggers no navigation/reload; no real wishlist functionality is asserted (still a placeholder)
- [X] T030 [US1] Verify/adjust container classes in `frontend/src/pages/WishlistPage.tsx` and `frontend/src/components/UnderConstruction.tsx` for the dual-layout and touch-target rules, without adding any new wishlist functionality, to satisfy T029

**Checkpoint**: Wishlist page independently passes T029.

### Record / Release / Master Release Detail Pages — shared composite sections (Acceptance Scenarios 8–10)

- [X] T031 [P] [US1] Write a failing Playwright spec `e2e/tests/record-detail-responsive.spec.ts`: at ≥1280px gallery/data/tracklist/additional-info form a multi-panel composition wider than the current `lg:`-only 2-column cap; at 375px single column, no horizontal scroll; rating stars, condition-edit controls, and the "Remove from library" button have `boundingBox()` ≥44×44
- [X] T032 [P] [US1] Write a failing Playwright spec `e2e/tests/release-detail-responsive.spec.ts`: equivalent desktop/mobile composition assertions, plus the "Add to library" button `boundingBox()` ≥44×44
- [X] T033 [P] [US1] Write a failing Playwright spec `e2e/tests/master-release-detail-responsive.spec.ts`: equivalent desktop/mobile composition assertions, no horizontal scroll in the versions-table area at 375px, and Previous/Next buttons `boundingBox()` ≥44×44
- [X] T034 [US1] Add an `xl:` multi-panel step and remove the `max-w-5xl` cap at `xl:` in the shared detail-page grid in `frontend/src/pages/RecordDetailPage.tsx`, `frontend/src/pages/ReleaseDetailPage.tsx`, and `frontend/src/pages/MasterReleaseDetailPage.tsx` — depends on T031, T032, T033
- [X] T035 [US1] Adjust panel distribution for the new `xl:` composition in `frontend/src/components/ReleaseDetailsSection.tsx`, `frontend/src/components/ReleaseTracklistSection.tsx`, and `frontend/src/components/ReleaseAdditionalInfoSection.tsx` — depends on T034
- [X] T036 [US1] Fix thumbnail touch targets and adapt `frontend/src/components/ReleaseImageGallery.tsx` to the new desktop composition — depends on T034
- [X] T037 [US1] Fix `StarRating`/select/textarea touch targets and verify the "Remove from library" button in `frontend/src/components/MyCopySection.tsx` (RecordDetailPage only) — depends on T034
- [X] T038 [US1] Replace the `overflow-x-auto`-wrapped `<table>` in `frontend/src/components/MasterVersionsTable.tsx` with a stacked card/list layout below `md:` (table retained at `md:` and above), including Previous/Next button touch targets, per [research.md](./research.md) §4 — depends on T034
- [X] T039 [US1] Update `frontend/src/components/MasterReleaseDetailsSection.tsx` for the new `xl:` composition — depends on T034
- [X] T040 [US1] Update `frontend/src/components/RecordDetailSkeleton.tsx` to match the new detail-page composition shape at each breakpoint so no layout shift occurs — depends on T034, T035, T036
- [X] T041 [US1] Update `frontend/src/components/MasterVersionsTableSkeleton.tsx` to match the new card/list-below-`md`, table-at-`md`-and-above shape so no layout shift occurs — depends on T038

**Checkpoint**: All three detail pages independently pass T031/T032/T033.

### Profile Page (Acceptance Scenarios 11–12)

- [X] T042 [P] [US1] Write a failing Playwright spec `e2e/tests/profile-responsive.spec.ts`: at ≥1280px theme preferences and the Discogs connection card form a side-by-side panel composition; at 375px they stack in a single column with no horizontal scroll; the theme toggle, dismiss-banner button, and connect/disconnect controls have `boundingBox()` ≥44×44
- [X] T043 [US1] Implement the desktop side-by-side panel composition and mobile stacking in `frontend/src/pages/ProfilePage.tsx` (preferences row + `DiscogsConnectionCard`) to satisfy T042
- [X] T044 [US1] Fix the dismiss button touch target in the `DismissibleBanner` markup within `frontend/src/pages/ProfilePage.tsx` — depends on T042
- [X] T045 [US1] Verify/adjust connect/disconnect button composition in `frontend/src/components/DiscogsConnectionCard.tsx` for the new desktop panel — depends on T043
- [X] T046 [US1] Update `frontend/src/components/DiscogsConnectionCardSkeleton.tsx` to match the new panel composition shape so no layout shift occurs — depends on T043

**Checkpoint**: Profile page independently passes T042.

### Discogs Callback Page (Acceptance Scenario 13)

- [X] T047 [P] [US1] Write a failing Playwright spec `e2e/tests/discogs-callback-responsive.spec.ts`: at 375px the transitional loader container has no horizontal scroll; any interactive control present (if any) has `boundingBox()` ≥44×44; live resize across `md`/`xl` triggers no navigation/reload
- [X] T048 [US1] Verify/adjust container classes in `frontend/src/pages/DiscogsCallbackPage.tsx` for the mobile no-horizontal-scroll rule to satisfy T047

**Checkpoint**: Discogs callback page independently passes T047.

### App Header (Acceptance Scenarios 14–15)

- [X] T049 [P] [US1] Extend `e2e/tests/header-responsive-nav.spec.ts` with `boundingBox()` ≥44×44 assertions for every header control at mobile widths (hamburger trigger, mobile nav-modal rows, search submit icon, sign-out button) and confirm the existing desktop composition/behavior is unchanged
- [X] T050 [US1] Verify the search submit icon meets 44px (via the Phase 2 `Button` fix) and adjust `frontend/src/components/HeaderSearchBox.tsx` spacing if T049 finds it short
- [X] T051 [US1] Verify the hamburger trigger and adjust the mobile nav-modal row links (currently `py-2`) in `frontend/src/components/HamburgerMenu.tsx` to `min-h-11` to satisfy T049
- [X] T052 [US1] Verify desktop nav icon links meet 44px (via the Phase 2 `iconButtonClassName()` fix) in `frontend/src/components/HeaderNavIcons.tsx`
- [X] T053 [US1] Verify the sign-out button and brand link meet 44px at every breakpoint in `frontend/src/components/AppHeader.tsx`, without changing the header's existing structure or control placement

**Checkpoint**: App header independently passes T049 — all fifteen acceptance scenarios in spec.md are now covered.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature regression check and required project bookkeeping

- [X] T054 [P] Run the full Vitest suite in `frontend/` (`npm test`) and confirm every touch-target and functional-preservation test passes with no regressions versus the T002 baseline
- [X] T055 [P] Run the full Playwright suite in `e2e/` (`npm test`) and confirm every responsive/geometry spec passes with no regressions in previously-existing specs (e.g. `dashboard-feed-grid.spec.ts`)
- [X] T056 Grep all files touched in Phase 3 for repeated card/button/input utility-class strings duplicating patterns already centralized in `Card`/`Button`/`Input`, and convert any found to use the shared atomic component, per FR-006 — depends on T054, T055
- [X] T057 Walk through [quickstart.md](./quickstart.md)'s manual validation steps across all nine screens and the header
- [X] T058 Add a MINOR entry to `frontend/CHANGELOG.md` describing the dual-layout and 44×44px touch-target reconstruction, per Principle VI and the Development Workflow changelog gate
- [X] T059 Bump the `version` field in `frontend/package.json` to match the MINOR classification of the T058 changelog entry — depends on T058

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Independent of Setup completion in practice, but should follow it; BLOCKS confidence in any per-screen touch-target assertion in Phase 3 (screens can start their layout-only work in parallel, but touch-target verification tasks depend on the relevant Phase 2 task)
- **User Story 1 (Phase 3)**: Each screen sub-group can proceed once Phase 2's atomics are fixed; sub-groups are independent of each other (no screen's tasks depend on another screen's tasks) except that the three detail pages share composite-section files (T034–T041)
- **Polish (Phase 4)**: Depends on all of Phase 3 being complete

### User Story Dependencies

- This feature has a single user story (US1); there are no cross-story dependencies. Each screen sub-group within US1 is independently testable per spec.md's Independent Test criterion.

### Within Each Screen Sub-Group

- The Playwright spec (test) is written and confirmed failing before its implementation task(s)
- Skeleton-shape updates (e.g. T024, T028, T040, T041, T046) depend on their corresponding layout task, since the skeleton must mirror the final shape

### Parallel Opportunities

- T001 and T003 can each run parallel to T002 and to each other
- All Phase 2 test-writing tasks (T004, T006, T008, T010, T012, T014) can run in parallel — different files
- All Phase 2 implementation tasks (T005, T007, T009, T011, T013, T015) can run in parallel with each other once their respective test task is written — different files
- Every screen sub-group's first task (the Playwright spec) is marked `[P]` and can be written in parallel with every other screen's spec — all different files
- Within the detail-pages sub-group, T031/T032/T033 (three separate spec files) can run in parallel
- T054 and T055 can run in parallel (different test runners)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all Foundational touch-target tests together:
Task: "Write failing Vitest test for Button touch targets in frontend/tests/unit/ui/Button.test.tsx"
Task: "Write failing Vitest test for Input touch target in frontend/tests/unit/ui/Input.test.tsx"
Task: "Write failing Vitest test for Checkbox row wrapper in frontend/tests/unit/ui/Checkbox.test.tsx"
Task: "Write failing Vitest test for ThemeToggle touch target in frontend/tests/unit/ui/ThemeToggle.test.tsx"
Task: "Write failing Vitest test for StarRating touch targets in frontend/tests/unit/ui/StarRating.test.tsx"
Task: "Write failing Vitest test for BackLink touch target in frontend/tests/unit/ui/BackLink.test.tsx"
```

## Parallel Example: Phase 3 (screen specs)

```bash
# Launch every screen's Playwright spec in parallel (all new/distinct files):
Task: "Write failing Playwright spec e2e/tests/landing-page-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/search-results-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/library-list-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/wishlist-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/record-detail-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/release-detail-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/master-release-detail-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/profile-responsive.spec.ts"
Task: "Write failing Playwright spec e2e/tests/discogs-callback-responsive.spec.ts"
```

---

## Implementation Strategy

### MVP First

Because this feature has a single P1 story, there is no smaller MVP slice than the full story — but individual screens are independently shippable increments:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks confident touch-target verification everywhere)
3. Complete one screen sub-group in Phase 3 (e.g. Landing Page, the smallest)
4. **STOP and VALIDATE**: run that screen's Playwright spec and confirm it passes independently
5. Deploy/demo if ready — repeat for the next screen sub-group

### Incremental Delivery

1. Setup + Foundational → shared atomics ready
2. Each screen sub-group → test independently → deploy/demo
3. Detail pages (Record/Release/Master) share composite-section files, so land those three together
4. Polish phase closes out the feature once all nine screens + header pass

### Parallel Team Strategy

With multiple developers, after Phase 2 (Foundational) is done:

- Developer A: Landing, Search Results, Library, Wishlist
- Developer B: Record/Release/Master detail pages (shared sections — keep with one owner to avoid merge conflicts on T034–T041)
- Developer C: Profile, Discogs Callback, App Header

---

## Notes

- `[P]` tasks = different files, no unmet dependencies
- `[US1]` label maps every Phase 3 task to the feature's single user story
- Tests (Playwright specs, Vitest assertions) MUST be written and confirmed failing before their implementation task
- Skeleton-shape tasks MUST land in the same PR/commit sequence as the layout change they mirror, per the constitution's "no layout shift" rule
- Commit using Conventional Commits (`feat(frontend):`, `test(frontend):`, `fix(frontend):`) per the constitution's commit-format rule
- Avoid: vague tasks, same-file conflicts marked `[P]`, cross-screen dependencies that would break independent testability
