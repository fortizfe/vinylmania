---
description: "Task list for Apple HIG Component Polish"
---

# Tasks: Apple HIG Component Polish

**Input**: Design documents from `/specs/059-apple-hig-component-polish/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [audit.md](./audit.md)

**Tests**: REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE). Every implementation task is preceded by a failing test; frontend PRs also require Playwright e2e for affected flows (Development Workflow gate).

**Organization**: Foundational `motion/` layer first, then one phase per user story in priority order (US1→US5), then polish. Single feature branch `059-apple-hig-component-polish`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task — may run in parallel
- **[Story]**: US1–US5 for user-story phases only (Setup / Foundational / Polish carry no story label)
- Paths are repo-relative

## Path conventions

- Frontend: `frontend/src/`, unit tests `frontend/tests/unit/`
- E2E: `e2e/tests/`, helpers `e2e/helpers/`
- No `backend/` changes in this feature

---

## Phase 1: Setup

**Purpose**: Bring in the one new dependency and its guard rail.

- [X] T001 Add `motion` (`^12`) to `dependencies` in `frontend/package.json` and run `npm install` in `frontend/`; confirm `npm run build` still succeeds
- [X] T002 [P] Create `frontend/tests/unit/architecture/motion-import-boundary.test.ts` — a failing test that scans `frontend/src/components/**` and `frontend/src/pages/**` and asserts no file imports `motion` / `framer-motion` directly (only `frontend/src/motion/**` may)
- [X] T003 [P] Create the `frontend/src/motion/` directory with a placeholder `frontend/src/motion/index.ts` barrel

**Checkpoint**: dependency installed, import-boundary guard is red (no code yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared motion + overlay layer and CSS tokens that every user story depends on.

**⚠️ No user-story work begins until this phase is complete.**

### Tests (write first, must fail)

- [X] T004 [P] `frontend/tests/unit/motion/tokens.test.ts` — asserts `spring`, `motionDuration`, `easing`, `dismiss` values match [contracts/motion-layer.md](./contracts/motion-layer.md) and are frozen; asserts parity with the `--ease-*` / `--motion-duration-*` custom properties in `frontend/src/styles/global.css`
- [X] T005 [P] `frontend/tests/unit/motion/useFocusTrap.test.tsx` — Tab/Shift+Tab wrap at boundaries; focus enters container on activate; no-op when inactive
- [X] T006 [P] `frontend/tests/unit/motion/useScrollLock.test.tsx` — body scroll locked while active, scrollbar gutter compensated, reference-counted for nesting, prior state restored
- [X] T007 [P] `frontend/tests/unit/motion/useRestoreFocus.test.tsx` — captures `activeElement` on rising edge, restores on falling edge / unmount when target still connected
- [X] T008 [P] `frontend/tests/unit/motion/Overlay.test.tsx` — renders `role="dialog" aria-modal="true"`; `aria-labelledby` when `labelledBy` given; Escape + scrim click call `onClose`; traps + restores focus; locks scroll; reduced-motion path renders with no spring config
- [X] T009 [P] `frontend/tests/unit/motion/Sheet.test.tsx` — release-decision logic (dismiss at ≥45% distance OR ≥500 px/s, else spring back); button + Escape parity preserved
- [X] T010 [P] `frontend/tests/unit/ui/focusRing.test.ts` — exports the single expected utility string

### Implementation

- [X] T011 Add motion + typography tokens and preference media queries to `frontend/src/styles/global.css`: `--ease-out|--ease-in-out|--ease-drawer`, `--motion-duration-press|fade|collapse|drawer`, `--tracking-display|--leading-display`, and `@media (prefers-reduced-motion: reduce)` / `(prefers-reduced-transparency: reduce)` / `(prefers-contrast: more)` blocks (per [research.md](./research.md) R2, R4, R6)
- [X] T012 Create `frontend/src/motion/tokens.ts` per [contracts/motion-layer.md](./contracts/motion-layer.md) (spring configs, `motionDuration`, `easing`, `dismiss`), `as const`
- [X] T013 [P] Create `frontend/src/motion/useFocusTrap.ts`
- [X] T014 [P] Create `frontend/src/motion/useScrollLock.ts` (ref-counted, scrollbar-width compensation, no layout shift)
- [X] T015 [P] Create `frontend/src/motion/useRestoreFocus.ts`
- [X] T016 [P] Create `frontend/src/components/ui/focusRing.ts` (single shared `focus-visible:ring-2 ring-primary ring-offset-2` constant)
- [X] T017 Create `frontend/src/motion/MotionProvider.tsx` — `<LazyMotion features={domAnimation} strict>` + `<MotionConfig reducedMotion="user">`
- [X] T018 Create `frontend/src/motion/Overlay.tsx` — composes `useFocusTrap` + `useScrollLock` + `useRestoreFocus` + `useEscapeKey`; scrim + `<Card>` surface; `AnimatePresence` enter/exit per variant (`center` scale+opacity, `end` slide on-axis); depends on T012–T017
- [X] T019 Create `frontend/src/motion/Sheet.tsx` — composes `Overlay variant="end"`; `m.div` drag on `dismissAxis`; release decision from `tokens.dismiss`; rubber-band; velocity hand-off to `spring.momentum`; depends on T018
- [X] T020 Fill `frontend/src/motion/index.ts` barrel (tokens, `MotionProvider`, `Overlay`, `Sheet`, hooks)
- [X] T021 Mount `<MotionProvider>` in `frontend/src/main.tsx` (or `App.tsx`) alongside `<ThemeProvider>`, above the router

**Checkpoint**: `frontend` Vitest green for `motion/**`; import-boundary guard (T002) green; app boots with provider mounted, no scroll-lock leak.

---

## Phase 3: User Story 1 — Instant press feedback (Priority: P1) 🎯 MVP

**Goal**: Every interactive control shows a pressed state within ~100 ms of pointer-down, distinct from hover/focus, suppressed when disabled/loading and under reduced-motion.

**Independent Test**: `press-feedback.spec.ts` green — `page.mouse.down()` on representative controls shows the pressed transform before `mouse.up()`; a disabled control shows none; keyboard activation still acknowledges; axe passes on both themes.

### Tests (write first, must fail)

- [X] T022 [P] [US1] `e2e/tests/press-feedback.spec.ts` — pressed state on pointer-down (not click) for Button, filter chip, star, header nav icon, inline-edit trigger; disabled Button shows none; reduced-motion keeps a brightness/opacity shift but no scale
- [X] T023 [P] [US1] Extend `frontend/tests/unit/ui/Button.test.tsx` — asserts press utilities present in `baseClassName`, absent effect when `disabled`/`loading`, and `focusRing` applied
- [X] T024 [P] [US1] Extend `frontend/tests/unit/ui/StarRating.test.tsx` and `ThemeToggle.test.tsx` / `Checkbox.test.tsx` — press affordance + shared `focusRing`

### Implementation

- [X] T025 [US1] Add pressed state (`active:scale-[0.97]` + `active:brightness`, tokenized `transition`, disabled/loading + reduced-motion guards) and adopt `focusRing` in `frontend/src/components/ui/Button.tsx` (also updates `buttonClassName`/`iconButtonClassName`)
- [X] T026 [P] [US1] Per-star press scale + `focusRing` (removes the legacy `outline-primary` race) in `frontend/src/components/ui/StarRating.tsx`
- [X] T027 [P] [US1] Track press feedback + `focusRing` in `frontend/src/components/ui/ThemeToggle.tsx`
- [X] T028 [P] [US1] Option press feedback + `focusRing` in `frontend/src/components/ui/ViewModeToggle.tsx`
- [X] T029 [P] [US1] Press nudge (`active:-translate-x-0.5`) + `focusRing` in `frontend/src/components/ui/BackLink.tsx`
- [X] T030 [P] [US1] Trigger-button press + `focusRing` in `frontend/src/components/ui/InlineEditableField.tsx`
- [X] T031 [P] [US1] Row press feedback in `frontend/src/components/ui/Checkbox.tsx` (keep spec-058 dark `bg-stone-300`)
- [X] T032 [P] [US1] Row press feedback + `multi-select-list` pattern conformance in `frontend/src/components/filters/SelectableListFilter.tsx`
- [X] T033 [P] [US1] Icon-button press + `focusRing` in `frontend/src/components/HeaderNavIcons.tsx`
- [X] T034 [P] [US1] Submit/clear control press in `frontend/src/components/HeaderSearchBox.tsx`
- [X] T035 [P] [US1] Action-button press in `frontend/src/components/ResultCardActions.tsx`
- [X] T036 [P] [US1] Press state in `frontend/src/components/GoogleSignInButton.tsx` (keep spec-032 AA indigo)
- [X] T037 [P] [US1] Whole-card press affordance (`active:scale-[0.99]` on the `<Link>`) in `frontend/src/components/RecordCard.tsx` and `frontend/src/components/RecordListRow.tsx` (skeleton parity unchanged)
- [X] T038 [P] [US1] Whole-card press affordance in `frontend/src/components/SearchResultCard.tsx` and `frontend/src/components/SearchResultListRow.tsx`
- [X] T039 [P] [US1] Card press affordance in `frontend/src/components/FeedArticleCard.tsx`
- [X] T040 [P] [US1] Chip press + single chip pattern in `frontend/src/components/FeedCategoryFilterBar.tsx` and `frontend/src/components/FeedSourceFilterBar.tsx`
- [X] T041 [P] [US1] Navigable-row press in `frontend/src/components/MasterVersionsTable.tsx`
- [X] T042 [P] [US1] Collapse-trigger + filter action buttons inherit `Button` press — verify and add press assertions in `frontend/src/components/filters/CollapsibleFilterPanel.tsx`, `frontend/src/components/filters/FilterActions.tsx`, `frontend/src/components/HamburgerMenu.tsx`
- [X] T043 [US1] Extend `e2e/tests/view-mode-toggle.spec.ts` and `e2e/tests/record-detail-inline-edit.spec.ts` with press-state assertions
- [X] T044 [US1] Run US1 validation (quickstart §US1): `press-feedback.spec.ts` + axe both themes green; update the US1 rows in [audit.md](./audit.md) to done

**Checkpoint**: US1 fully functional and independently testable — shippable MVP.

---

## Phase 4: User Story 2 — Physical, interruptible transitions (Priority: P1)

**Goal**: Overlays, disclosures, toggles, and gallery image changes use spring/token motion that decelerates naturally, is interruptible from the presentation value, and collapses to opacity-only under reduced-motion. One shared token set.

**Independent Test**: `reduced-motion.spec.ts` green; interrupt tests show no transform jump on modal/drawer/gallery; a grep test finds no per-component durations/curves.

### Tests (write first, must fail)

- [X] T045 [P] [US2] `e2e/tests/reduced-motion.spec.ts` — `emulateMedia({ reducedMotion: 'reduce' })`: every animated element's `transform` is `none` mid-transition; skeletons have `animation-name: none`
- [X] T046 [P] [US2] `frontend/tests/unit/architecture/no-inline-motion.test.ts` — scans `frontend/src/components/**` for `cubic-bezier(`, `duration-[`, `transition: all`, bare `ease`/`ease-in`/`linear` and fails on new occurrences
- [X] T047 [P] [US2] Extend `frontend/tests/unit/ui/Modal.test.tsx` — motion wrapper present; reduced-motion prop path renders; all existing assertions still pass
- [X] T048 [P] [US2] Motion tests for `frontend/tests/unit/ui/ViewModeToggle.test.tsx` (shared-element pill) and a new `frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx` (disclosure height/opacity)

### Implementation

- [X] T049 [US2] Re-home `frontend/src/components/ui/Modal.tsx` on `motion/Overlay` — spring `center` scale+opacity enter/exit, `end` slide on-axis, interruptible, same-path exit; public props unchanged (per [contracts/component-api-changes.md](./contracts/component-api-changes.md))
- [X] T050 [P] [US2] Knob translate → `spring.default`, sky/stars → `motionDuration.fade` + `easing.out` crossfade, reduced-motion static, in `frontend/src/components/ui/ThemeToggle.tsx`
- [X] T051 [P] [US2] Active state → shared-element sliding pill (`m` + `layoutId` + `spring.default`), reduced-motion jump, in `frontend/src/components/ui/ViewModeToggle.tsx`
- [X] T052 [P] [US2] Height+opacity disclosure motion (measured height, `motionDuration.collapse`, chevron rotate), reduced-motion instant, in `frontend/src/components/filters/CollapsibleFilterPanel.tsx`
- [X] T053 [P] [US2] Gate `animate-pulse` behind `motion-safe` in `frontend/src/components/ui/Skeleton.tsx`; verify all `*Skeleton.tsx` inherit (grep for stray `animate-pulse`)
- [X] T054 [P] [US2] Image-change directional slide + `spring.momentum` in `frontend/src/components/GalleryFullscreenViewer.tsx` (swipe input added in US4)
- [X] T055 [P] [US2] Open viewer anchored to the tapped thumbnail (`transform-origin`) in `frontend/src/components/ReleaseImageGallery.tsx`
- [X] T056 [P] [US2] Carousel/scroll-snap motion → token easing + momentum projection in `frontend/src/components/FeedArticleBoard.tsx`
- [X] T057 [US2] Extend `e2e/tests/theme-preference.spec.ts`, `e2e/tests/library-filters.spec.ts`, `e2e/tests/search-result-filters.spec.ts` with motion + reduced-motion assertions (also `view-mode-toggle.spec.ts`: sliding-pill motion + fixed the spec-058 "active option fill" contrast check to target `view-mode-pill`)
- [X] T058 [US2] Add interruptibility check to `e2e/tests/overlay-focus-management.spec.ts` (create if not yet present): trigger modal close mid-enter and drawer reverse mid-drag; sample `getBoundingClientRect()` across rAF ticks; assert no single-frame jump to start/end transform (SC-003)
- [X] T059 [US2] Run US2 validation (quickstart §US2); update US2 rows in [audit.md](./audit.md)

**Checkpoint**: US1 + US2 both work independently; motion feels physical and respects reduced-motion.

---

## Phase 5: User Story 3 — Overlay depth & focus management (Priority: P2)

**Goal**: Modal, drawer, and fullscreen gallery dim + blur the page behind, keep focus trapped and restored, lock background scroll, and keep overlay content at WCAG AA over the blur.

**Independent Test**: `overlay-focus-management.spec.ts` green (trap/restore/scroll-lock for all three, nested case); `contrast.ts` over-blur assertion passes; manual reduced-transparency + no-`backdrop-filter` fallbacks verified.

### Tests (write first, must fail)

- [X] T060 [P] [US3] `e2e/tests/overlay-focus-management.spec.ts` — Tab/Shift+Tab stays inside modal, drawer, gallery; Escape / backdrop / close button each restore focus to the opener; background does not scroll; nested confirm-in-modal unwinds focus correctly
- [X] T061 [P] [US3] Extend `e2e/helpers/contrast.ts` with an over-blur worst-case helper (busy cover art behind) and a test asserting overlay surface + text ≥ 4.5:1

### Implementation

- [X] T062 [US3] Overlay material in `frontend/src/motion/Overlay.tsx` + `frontend/src/styles/global.css`: scrim `bg-stone-950/60` + `backdrop-blur-md backdrop-saturate-150`; `@supports not (backdrop-filter)` → `/80` no blur; `prefers-reduced-transparency` → `/95` solid; `prefers-contrast: more` → solid + bordered surface; materialize enter (blur+scale together)
- [X] T063 [US3] `aria-labelledby` on the title + consume `Overlay` material/focus contract in `frontend/src/components/ui/Modal.tsx`; drop its hand-rolled Escape handling
- [X] T064 [US3] Route `frontend/src/components/GalleryFullscreenViewer.tsx` through `Overlay` (focus trap + restore + scroll lock + blur backdrop with fallbacks); keep `bg-stone-950/90`
- [X] T065 [P] [US3] Add a nested-overlay test fixture / story (confirm dialog opened from within a modal) and assert focus unwind in `overlay-focus-management.spec.ts`
- [X] T066 [US3] Extend `e2e/tests/release-detail-responsive.spec.ts` and `e2e/tests/dark-mode-contrast.spec.ts` for the overlay material + contrast
- [X] T067 [US3] Run US3 validation (quickstart §US3); update US3 rows in [audit.md](./audit.md)

**Checkpoint**: Overlays have depth; the latent Modal focus/scroll gaps are closed.

---

## Phase 6: User Story 4 — Touch gestures: drag-to-dismiss & gallery swipe (Priority: P2)

**Goal**: Sheets/drawers dismiss by 1:1 drag (45% distance OR 500 px/s flick, else spring back, rubber-band, scroll-boundary aware); the gallery swipes between images; every gesture has a button + keyboard equivalent.

**Independent Test**: `sheet-drag-dismiss.spec.ts` + `gallery-swipe.spec.ts` green; parity paths (button + key) covered; manual real-device check for rubber-band + momentum projection.

### Tests (write first, must fail)

- [ ] T068 [P] [US4] `e2e/tests/sheet-drag-dismiss.spec.ts` — synthetic pointer drag on the drawer: 1:1 tracking from grab point; release <45% & slow → springs back; release >45% or ≥500 px/s → closes + fires `onClose`; drag starting mid-scroll (not at boundary) scrolls instead
- [ ] T069 [P] [US4] `e2e/tests/gallery-swipe.spec.ts` — horizontal swipe advances image; `aria-current` thumbnail follows; `ArrowLeft/Right` and thumbnail buttons still work; hard flick does not skip two images
- [X] T070 [P] [US4] Extend `frontend/tests/unit/motion/Sheet.test.tsx` — scroll-boundary disambiguation, button/keyboard parity retained

### Implementation

- [X] T071 [US4] Drag mechanics in `frontend/src/motion/Sheet.tsx` — 1:1 tracking with grab offset, release decision from `tokens.dismiss`, `dragElastic` rubber-band, release-velocity hand-off to `spring.momentum`, reduced-motion snap
- [X] T072 [US4] Scroll-boundary disambiguation in `frontend/src/motion/Sheet.tsx` — only capture the dismiss drag when scrollable content is at its boundary in the drag direction
- [X] T073 [US4] Render `Modal position="end"` through `Sheet` in `frontend/src/components/ui/Modal.tsx` (button + Escape parity unchanged)
- [X] T074 [P] [US4] Verify `frontend/src/components/HamburgerMenu.tsx` drawer is now swipe-dismissible and nav rows keep press state
- [X] T075 [US4] Horizontal swipe + `ArrowLeft`/`ArrowRight` keys + momentum projection + thumbnail sync in `frontend/src/components/GalleryFullscreenViewer.tsx`
- [ ] T076 [US4] Extend `e2e/tests/header-responsive-nav.spec.ts` with the drawer gesture + parity assertions
- [ ] T077 [US4] Run US4 validation (quickstart §US4, incl. real-device manual checks); update US4 rows in [audit.md](./audit.md)

**Checkpoint**: Touch users can drive every sheet and the gallery by gesture, with full non-gesture parity.

---

## Phase 7: User Story 5 — Consistent interaction & typography language (Priority: P2)

**Goal**: One focus treatment, one pattern per shared concept, size-specific display tracking/leading, no decoration-as-emphasis, scroll-edge header treatment.

**Independent Test**: focus-ring consistency test green; display headings carry the tracking/leading tokens; manual sweep confirms same concept = same behavior across screens.

### Tests (write first, must fail)

- [ ] T078 [P] [US5] `frontend/tests/unit/architecture/focus-ring-consistency.test.ts` — the only focus utility string in `frontend/src/components/**` is `focusRing`; no `outline-primary` / ad-hoc `focus-visible:ring` variants remain
- [ ] T079 [P] [US5] Test that `--font-display` headings render with `--tracking-display` / `--leading-display` (unit test on a representative header component)

### Implementation

- [ ] T080 [US5] Roll `focusRing` out to every remaining interactive control and delete the historical variants (touches `frontend/src/components/GalleryFullscreenViewer.tsx` thumbnails, any file still holding a local focus string)
- [ ] T081 [P] [US5] Add `--tracking-display` (`-0.02em`) and `--leading-display` (`1.05`) to the `@theme` block in `frontend/src/styles/global.css` (if not already added in T011) and expose as utilities
- [ ] T082 [P] [US5] Apply display tracking/leading to page/pillar/showcase headings: `frontend/src/components/LandingHero.tsx`, `frontend/src/components/LandingPillarSection.tsx`, and the section/page headers in the release/master detail + dashboard components (keep the fixed `text-*`/`leading-*` no-CLS pairing)
- [ ] T083 [P] [US5] Replace underline-as-emphasis with weight/color: `frontend/src/components/RecordCard.tsx` ("Open record"), and body-text emphasis across composite components (grep `underline` in `frontend/src/components/**`, keep it only for genuine inline links where affordance needs it)
- [ ] T084 [P] [US5] Replace the hard bottom border with a scroll-edge shadow/gradient mask (appears only once content scrolls under) in `frontend/src/components/AppHeader.tsx` and `frontend/src/components/LandingHeader.tsx`; keep the opaque near-black surface token
- [ ] T085 [P] [US5] Add a calm tokenized focus-border transition (no layout shift) in `frontend/src/components/ui/Input.tsx`
- [ ] T086 [P] [US5] Gentle opacity-only entrance (token, no movement) for status/empty components: `frontend/src/components/UnderConstruction.tsx`, `frontend/src/components/LibraryLinkRequired.tsx`, `frontend/src/components/DiscogsRelinkNotice.tsx`, `frontend/src/components/FeedSourceStatusBanner.tsx`
- [ ] T087 [US5] Document the canonical Interaction Patterns (binary-switch / segmented-selector / multi-select-list / disclosure / dismissible-layer / pressable) in `frontend/src/motion/README.md` and finalize the pattern column in [audit.md](./audit.md)
- [ ] T088 [US5] Extend `e2e/tests/landing-page-responsive.spec.ts`, `e2e/tests/dashboard-feed-grid.spec.ts`, `e2e/tests/header-responsive-nav.spec.ts` for typography tokens + scroll-edge treatment
- [ ] T089 [US5] Run US5 validation (quickstart §US5); update US5 rows in [audit.md](./audit.md)

**Checkpoint**: All five stories independently functional; the component library reads as one system.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T090 [P] Finalize [audit.md](./audit.md) — every row marked done, every implementation task cross-checked against a row (SC-002)
- [ ] T091 [P] Add `e2e/tests/motion-performance.spec.ts` — CDP `Emulation.setCPUThrottlingRate(4)`, measure frame interval during modal / drawer / gallery transitions via `PerformanceObserver`, assert p95 ≤ ~20 ms or a `data-motion-reduced` fallback marker (SC-010)
- [ ] T092 Run full `frontend` gate: `npm run test` + `npm run lint` + `npm run build`
- [ ] T093 Run full `e2e` gate: `npx playwright test` + axe `@a11y` + `dark-mode-contrast.spec.ts` on both themes; confirm ≥ baseline pass rate (SC-005)
- [ ] T094 [P] Execute the "Open feel-checks" from [research.md](./research.md) on a real mid-tier device; record outcomes in the PR
- [ ] T095 [P] Run the side-by-side responsiveness comparison (SC-009) with ≥ 10 people; record ratings
- [ ] T096 Update the PR description with the three documented constitution deviations (the `motion` dependency, the `frontend/src/motion/` module, the CSS motion custom properties) per the Development Workflow gate; do NOT hand-edit `CHANGELOG.md` or `version`
- [ ] T097 Full `quickstart.md` pass — every Definition-of-Done row checked

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Foundational (needs `focusRing`, token CSS; press state is CSS-only so does not need `Overlay`/`Sheet`)
- **US2 (Phase 4)**: depends on Foundational (`MotionProvider`, tokens, `Overlay`). Independent of US1 but shares files (`ThemeToggle`, `ViewModeToggle`) — if run in parallel with US1, sequence those files
- **US3 (Phase 5)**: depends on Foundational + US2's `Modal`-on-`Overlay` re-home (T049). Otherwise independent
- **US4 (Phase 6)**: depends on Foundational + US3's `Overlay` material (T062) + `Sheet` (T019). `Modal position="end"` work builds on T049/T063
- **US5 (Phase 7)**: depends on Foundational (`focusRing`, type tokens). Largely independent; touches many files US1–US4 also touch — run after them or sequence shared files
- **Polish (Phase 8)**: depends on all desired stories complete

### Story completion order

`Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → Polish`
US1 can ship alone. US2 can ship after US1. US3 requires the US2 Modal re-home. US4 requires US3's Overlay material. US5 can slot in after US1 or at the end.

### Within each story

- Tests first, must fail (Principle I)
- Foundational primitive changes before the components that consume them
- `[P]` component tasks touch different files — safe to parallelize
- Story-closing "Run validation" task is last and updates `audit.md`

---

## Parallel execution examples

**Phase 2 (Foundational) — after T011/T012:**

```
T013 useFocusTrap.ts   ·  T014 useScrollLock.ts  ·  T015 useRestoreFocus.ts  ·  T016 focusRing.ts
(tests T004–T010 all [P] up front)
```

**Phase 3 (US1) — after T025 (Button):**

```
T026 StarRating · T027 ThemeToggle · T028 ViewModeToggle · T029 BackLink · T030 InlineEditableField
T031 Checkbox · T032 SelectableListFilter · T033 HeaderNavIcons · T034 HeaderSearchBox
T035 ResultCardActions · T036 GoogleSignInButton · T037 Record{Card,ListRow} · T038 SearchResult{Card,ListRow}
T039 FeedArticleCard · T040 Feed*FilterBar · T041 MasterVersionsTable · T042 CollapsiblePanel/FilterActions/Hamburger
```

**Phase 4 (US2) — after T049 (Modal):**

```
T050 ThemeToggle · T051 ViewModeToggle · T052 CollapsibleFilterPanel · T053 Skeleton
T054 GalleryFullscreenViewer · T055 ReleaseImageGallery · T056 FeedArticleBoard
```

---

## Implementation strategy

### MVP first (US1 only)

1. Phase 1 Setup
2. Phase 2 Foundational (CRITICAL — blocks everything)
3. Phase 3 US1
4. **STOP & VALIDATE**: `press-feedback.spec.ts` + axe both themes; demo the tactile feel
5. Ship

### Incremental delivery

Foundation → US1 (tactile feedback, MVP) → US2 (physical motion) → US3 (overlay depth + a11y fixes) → US4 (gestures) → US5 (consistency + type) → Polish. Each story is a demoable increment that does not break the previous one.

---

## Notes

- `[P]` = different files, no incomplete dependency
- Every user-story task carries its `[USx]` label; Setup/Foundational/Polish do not
- Verify each test fails before implementing it (Principle I)
- Commit after each task or logical group, Conventional Commits; never hand-edit `CHANGELOG.md` / `version`
- Any component whose file is touched must keep its dual desktop/mobile layout, 44×44 targets, skeleton parity, and spec-058 contrast decisions intact (FR-019)
- `audit.md` is the source of truth for per-component scope — no implementation without a matching row
