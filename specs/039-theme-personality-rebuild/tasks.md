---

description: "Task list for Theme Personality Rebuild (Light & Dark Mode)"

---

# Tasks: Theme Personality Rebuild (Light & Dark Mode)

**Input**: Design documents from `/specs/039-theme-personality-rebuild/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (no `contracts/` — FR-012, this feature adds no API/interface surface)

**Tests**: Not included as dedicated tasks — this is a visual-only rebuild with no new business logic (FR-012). The existing Vitest/RTL and Playwright suites are the regression net (SC-004) and are re-run in Polish (T052–T053), not written fresh.

**Organization**: This feature has a single user story (US1) per spec.md — the visual rebuild is not divisible into independently valuable slices; partial application would leave the app visually inconsistent, which is the problem being solved. All implementation tasks below carry the `[US1]` label.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: All implementation tasks belong to the single user story
- Every task includes the exact file path (relative to repo root)

## Path Conventions

Web app layout (`backend/` + `frontend/`), frontend-only feature. All paths are under `frontend/src/` unless noted; the constitution file is at `.specify/memory/constitution.md`.

---

## Phase 1: Setup

**Purpose**: Establish the baseline to measure the rebuild against.

- [X] T001 Run `grep -rn "gray-\|slate-" frontend/src --include="*.tsx" --include="*.ts" --include="*.css"` from repo root and save the output (e.g. to a scratch file) as the baseline file list (~42 files) to compare against the zero-match gate in T051 (SC-002).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The token contract every US1 task depends on, plus the constitution amendment this feature requires before/with merge.

**⚠️ CRITICAL**: T002 MUST be complete before any US1 task — every US1 task references the renamed/new token names it introduces.

- [X] T002 Update the `@theme` block in `frontend/src/styles/global.css` per `data-model.md` §2–3 and `research.md` §2–3: rename `--color-landing-surface` → `--color-surface: #0b0b10`; rename `--color-landing-accent` → `--color-accent: #f59e0b`; add `--color-surface-raised: #16161f`; add `--color-border-dark: #262631`; add `--color-accent-text: #b45309`; update the surrounding doc comments to describe the generalized (no-longer-landing-only) scope; leave `--color-primary`, the four `--color-rating-*` tokens, `--color-brand-icon-dark-bg`, `--font-sans`, and `--font-display` unchanged.
- [X] T003 [P] Amend `.specify/memory/constitution.md` per the exact drafted text in `specs/039-theme-personality-rebuild/research.md` §7: replace the "Visual lightness" bullet, replace the "Skeleton loading states" bullet, append the new clause to "Theme-variable dark mode", leave every other "UI Design System & Styling" rule textually unchanged, bump the version `2.3.0` → `2.4.0` (MINOR), and update the `Sync Impact Report` (FR-011, SC-005).

**Checkpoint**: Token contract is in place — all US1 file-level tasks can now proceed (in parallel, since each touches a distinct file).

---

## Phase 3: User Story 1 - A theme with personality, across the whole app, in both modes (Priority: P1) 🎯 MVP

**Goal**: Every shared UI component, shared feature component, page, and the app header consumes the rebuilt warm-neutral (`stone`) + dual-accent (indigo primary / amber secondary) + near-black dark-surface token set, with `Anton` applied to in-scope titles only, in both light and dark mode — no screen left on the old generic gray/slate look.

**Independent Test**: Toggle light/dark mode on any existing screen (including the header) and confirm palette, typography, borders, and shadows consistently reflect the new theme rather than the previous gray/slate look, across all 10 screens.

### Shared atomic UI components (`frontend/src/components/ui/`, FR-006, data-model.md component table)

- [X] T004 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ui/Card.tsx` (border → `stone-200`/`--color-border-dark`, background → `stone-50`/`--color-surface-raised`), keeping the existing rounded/border/shadow/padding pattern.
- [X] T005 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ui/Button.tsx` (primary variant keeps `--color-primary`; secondary/outline variant → `stone-*`/`--color-border-dark`).
- [X] T006 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ui/Badge.tsx`, adding an accent tone variant using `--color-accent`/`--color-accent-text` (data-model.md §3) alongside the existing neutral `stone-*` tone.
- [X] T007 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*` fallback background in `frontend/src/components/ui/Avatar.tsx`.
- [X] T008 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*` border/background/text in `frontend/src/components/ui/Input.tsx`, keeping `--color-primary` for the focus ring.
- [X] T009 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*` (light) and `--color-surface-raised` (dark) background in `frontend/src/components/ui/Modal.tsx`.
- [X] T010 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*` border in `frontend/src/components/ui/Checkbox.tsx`, keeping `--color-primary` for the checked state.
- [X] T011 [P] [US1] Swap `gray-*`/`slate-*` pulse-background utilities for the `stone-200`/`stone-800`-equivalent tokens in `frontend/src/components/ui/Skeleton.tsx`, preserving exact shape/dimensions (FR-008, no layout shift).
- [X] T012 [P] [US1] Replace the literal `amber-400` filled-state color with `--color-accent` in `frontend/src/components/ui/StarRating.tsx` and swap any remaining `gray-*`/`slate-*` utilities to `stone-*`.
- [X] T013 [P] [US1] Swap the unrated dark-mode companion class from `dark:bg-gray-700` to the equivalent `stone-700` in `frontend/src/components/ui/ReleaseRatingBadge.tsx`; leave the `--color-rating-*` band pairings untouched (FR-009).
- [X] T014 [P] [US1] Migrate `ThemeToggle`'s night-sky gradient in `frontend/src/components/ui/ThemeToggle.tsx` from literal `slate-*` to `--color-surface`/`--color-surface-raised` (research.md §1 exception), keeping the sun's existing `--color-accent`.
- [X] T015 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ui/BackLink.tsx`.
- [X] T016 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ui/InlineEditableField.tsx`.

### App header and header-adjacent components (FR-007)

- [X] T017 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*` (light) and `--color-surface-raised`/`--color-border-dark` (dark) in `frontend/src/components/AppHeader.tsx`.
- [X] T018 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/HamburgerMenu.tsx`.

### Landing-specific shared components (pillar headers = Anton scope, FR-005)

- [X] T019 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/LandingHeader.tsx`.
- [X] T020 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/LandingHero.tsx`.
- [X] T021 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/LandingPillarSection.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility (research.md §5) to the pillar/section headers.

### Dashboard feed components

- [X] T022 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/FeedArticleBoard.tsx`.
- [X] T023 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/FeedArticleCard.tsx`, keeping its per-item title in the regular body typeface (not `font-display` — FR-005).
- [X] T024 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/FeedCategoryFilterBar.tsx`.
- [X] T025 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/FeedSourceFilterBar.tsx`.

### Filter components (feature 038)

- [X] T026 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/filters/CollapsibleFilterPanel.tsx`.
- [X] T027 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/filters/SelectableListFilter.tsx`.

### Detail-page shared sections

- [X] T028 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/MasterReleaseDetailsSection.tsx`.
- [X] T029 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/MasterVersionsTable.tsx`.
- [X] T030 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/MyCopySection.tsx`.
- [X] T031 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ReleaseAdditionalInfoSection.tsx`.
- [X] T032 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ReleaseDetailsSection.tsx`.
- [X] T033 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ReleaseImageGallery.tsx`, recoloring any inline SVG icons to theme tokens (FR-013).
- [X] T034 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/ReleaseTracklistSection.tsx`.

### List/grid item cards (per-item titles stay body typeface, FR-005 negative case)

- [X] T035 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/RecordCard.tsx`, keeping the per-item release title in the regular body typeface (not `font-display`).
- [X] T036 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/SearchResultCard.tsx`, keeping the per-item release title in the regular body typeface (not `font-display`).

### Misc shared components

- [X] T037 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/DiscogsConnectionCard.tsx`.
- [X] T038 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/LibraryLinkRequired.tsx`.
- [X] T039 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/components/UnderConstruction.tsx`.

### Root

- [X] T040 [P] [US1] Swap any root-level `gray-*`/`slate-*` utilities (e.g. body/root background class) for `stone-*`/theme tokens in `frontend/src/main.tsx`.

### Pages (`frontend/src/pages/`, FR-005 + FR-007)

- [X] T041 [P] [US1] Verify/apply the new theme in `frontend/src/pages/LandingPage.tsx` — confirm it inherits the rebuilt tokens via `LandingHeader`/`LandingHero`/`LandingPillarSection` (T019–T021) with no lingering `gray-*`/`slate-*` at the page level.
- [X] T042 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/DashboardPage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to its pillar/section headers (FR-005).
- [X] T043 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/SearchResultsPage.tsx`, applying `font-display` to the page header only — per-item result titles (`SearchResultCard`, T036) stay in body typeface.
- [X] T044 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/LibraryListPage.tsx`, applying `font-display` to the page header only — per-item titles (`RecordCard`, T035) stay in body typeface.
- [X] T045 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/WishlistPage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to the page header (FR-005).
- [X] T046 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/RecordDetailPage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to the single-record showcase title (FR-005).
- [X] T047 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/ReleaseDetailPage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to the single-record showcase title (FR-005).
- [X] T048 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/MasterReleaseDetailPage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to the single-record showcase title (FR-005).
- [X] T049 [P] [US1] Swap `gray-*`/`slate-*` utilities for `stone-*`/theme tokens in `frontend/src/pages/ProfilePage.tsx`, applying `font-display` with a fixed `text-*`/`leading-*` utility to the page header (FR-005).
- [X] T050 [P] [US1] Verify/apply the new theme (palette on loading/status states) in `frontend/src/pages/DiscogsCallbackPage.tsx`.

**Checkpoint**: User Story 1 is fully implemented — every screen, the header, and every shared component consume the rebuilt token set, and Anton is applied exactly where in scope.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verify the rebuild against every success criterion (SC-001–SC-005) before merge.

- [X] T051 Re-run `grep -rn "gray-\|slate-" frontend/src --include="*.tsx"` from repo root and confirm zero matches remain (or only matches with an explicit, documented justification comment), comparing against the T001 baseline (SC-002).
- [X] T052 Run `cd frontend && npm run test` (Vitest/RTL) and fix only snapshot/selector regressions caused by the class-name swap — any other failure is a real regression, not an expected diff (SC-004).
- [ ] T053 Run `npx playwright test` from repo root (e2e gate) and fix only selector/snapshot regressions caused by the class-name swap (SC-004). **Skipped per explicit user instruction**: the e2e suite currently has a known, pre-existing bug unrelated to this feature, to be addressed in a future increment. Risk accepted; the suite was not run or modified as part of this implementation.
- [X] T054 [P] Spot-check WCAG AA contrast for every pairing listed in `research.md` §4 / `quickstart.md` §4 (light/dark body text, muted text, `--color-accent` on dark surfaces, `--color-accent` as background, `--color-accent-text` on light surfaces, `--color-primary` button text, including the two hover-border pairings) and confirm each measures ≥4.5:1 normal text / ≥3:1 large text/non-text (SC-003, FR-010).
- [X] T055 [P] Run the manual visual audit in `quickstart.md` §3 across all 10 screens + `AppHeader`, in both light and dark mode, confirming palette/typography/borders/shadows consistency and that skeleton states use the new tokens with no layout shift (SC-001, FR-008).
- [X] T056 [P] Verify the rating bands (low/medium/high) and the unscored placeholder remain visually and semantically unchanged against the new warm-neutral/dark surfaces, per `quickstart.md` §5 (FR-009).
- [X] T057 Verify the constitution amendment checklist in `quickstart.md` §6: `.specify/memory/constitution.md` version is `2.4.0`, "Visual lightness" and "Theme-variable dark mode" reflect the new direction, every other "UI Design System & Styling" rule is textually unchanged, and the `Sync Impact Report` is present and accurate (FR-011, SC-005).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: T002 has no dependencies; T003 has no dependencies (different file, [P]). **T002 BLOCKS every task in Phase 3** — all US1 tasks reference the token names T002 introduces.
- **User Story 1 (Phase 3)**: Depends on T002. All 47 tasks (T004–T050) touch distinct files, so all are parallelizable once T002 lands.
- **Polish (Phase 4)**: Depends on all of Phase 3 being complete. T051–T053 are sequential (each is a repo-wide check); T054–T056 are parallelizable with each other and with T051–T053; T057 depends on T003.

### Parallel Opportunities

- T001 and T002/T003 can run in parallel with each other (T001 is read-only).
- Once T002 completes, all 47 tasks in Phase 3 (T004–T050) can run in parallel — each is a distinct file with no cross-task dependency.
- In Phase 4, T054, T055, and T056 can run in parallel with each other and alongside T051–T053.

---

## Parallel Example: Phase 3 (a representative batch)

```bash
# Shared atomic UI components — all distinct files, fully parallel:
Task: "Swap gray-*/slate-* for stone-*/theme tokens in frontend/src/components/ui/Card.tsx"
Task: "Swap gray-*/slate-* for stone-*/theme tokens in frontend/src/components/ui/Button.tsx"
Task: "Swap gray-*/slate-* for stone-*/theme tokens in frontend/src/components/ui/Badge.tsx"
Task: "Migrate ThemeToggle's night-sky gradient to --color-surface/--color-surface-raised in frontend/src/components/ui/ThemeToggle.tsx"

# Pages — all distinct files, fully parallel:
Task: "Swap gray-*/slate-* for stone-*/theme tokens + Anton showcase title in frontend/src/pages/RecordDetailPage.tsx"
Task: "Swap gray-*/slate-* for stone-*/theme tokens + Anton page header in frontend/src/pages/ProfilePage.tsx"
```

---

## Implementation Strategy

### MVP First (and Only) — User Story 1

1. Complete Phase 1: Setup (baseline audit).
2. Complete Phase 2: Foundational (T002 token rename/additions — **blocking**; T003 constitution amendment).
3. Complete Phase 3: User Story 1 — all 47 file-level swaps, ideally dispatched in parallel batches (shared UI components → header → shared feature components → pages) since none depend on each other, only on T002.
4. Complete Phase 4: Polish — automated regression gates (T051–T053) then the manual/contrast/constitution verification checklist (T054–T057).
5. **STOP and VALIDATE**: This feature has no smaller deliverable slice — SC-001 requires 100% of screens, so the full task list is the MVP.

### Notes

- [P] tasks = different files, no dependencies — the large majority of this feature's tasks.
- Every Phase 3 task should preserve each component's existing dark-mode support, card pattern, and (for skeletons) exact shape/dimensions — this is a class-name/token-level swap only, no new props, state, or markup structure (data-model.md, FR-012).
- Commit after each task or logical group (e.g. all `components/ui/` tasks, then all page tasks).
- Treat any test failure beyond a literal color/class-name assertion as a regression, not an expected diff (SC-004).
