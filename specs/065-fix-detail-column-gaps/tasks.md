---

description: "Task list template for feature implementation"
---

# Tasks: Fix gaps in the two-column record detail layout

**Input**: Design documents from `/specs/065-fix-detail-column-gaps/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/useIndependentColumnLayout.contract.md, quickstart.md

**Tests**: Included and REQUIRED — constitution Principle I (Test-First) is non-negotiable for this project; every implementation task below has a corresponding test task that must be written and failing first.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to the repository root; `frontend/` and `e2e/` per plan.md's Project Structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test-environment prerequisite shared by later phases

- [X] T001 [P] Add a minimal `ResizeObserver` test stub (constructor + `observe`/`unobserve`/`disconnect`, capturing the callback so a test can invoke it manually) to `frontend/tests/setup.ts`, alongside the existing `window.matchMedia` polyfill already there (research.md R4).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No additional blocking work beyond Phase 1: US1 (the new hook) and US2 (the Flexbox restructure) touch entirely disjoint files and share no runtime code (plan.md "Structure Decision"). Both can start immediately once Phase 1 is done.

**Checkpoint**: Foundation ready — User Story 1 and User Story 2 implementation can proceed in parallel.

---

## Phase 3: User Story 1 - Clean stacking on release/record detail pages (Priority: P1) 🎯 MVP

**Goal**: `ReleaseDetailPage` and `RecordDetailPage` (both built on the shared `RecordDetailLayout`/`RecordDetailSkeleton`) stack each of their two columns independently on desktop, with zero gaps regardless of card-height mismatches, while their DOM/tab/mobile order stays byte-for-byte identical to today.

**Independent Test**: Render `RecordDetailLayout` with a short `streaming` slot next to a long `tracklist` slot (and the reverse), at a `≥1024px` viewport, and confirm no gap forms in either column; confirm the existing `RecordDetailLayout.test.tsx` DOM-order assertions still pass unmodified.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T002 [P] [US1] Write the hook's contract tests in `frontend/tests/unit/hooks/useIndependentColumnLayout.test.tsx` per `contracts/useIndependentColumnLayout.contract.md` "Test expectations": (a) two same-column slots stack with exactly the design system's card gap regardless of the other column's slot heights; (b) a simulated `ResizeObserver` height change (via the T001 stub) shifts only the same-column slots below it; (c) below `lg` (`matchMedia` mocked to `matches: false`), `styleFor` and `containerStyle` return `{}` for every slot; (d) unmounting disconnects every `ResizeObserver` and removes the `matchMedia` listener.
- [X] T003 [P] [US1] In `frontend/src/components/recordDetail/RecordDetailLayout.tsx`'s test file, add a failing test asserting that rail-column slots (`gallery`, `rating`, `streaming`) receive computed positioning independent of content-column (`generalInfo`, `myCopy`, `tracklist`, `catalogInfo`) slot heights — drive it through the same `ResizeObserver`/`matchMedia` stubs as T002 — while confirming every existing DOM-order test in the file (the `§C1` order, single-tree, no-`order`-utility tests) still passes unmodified.
- [X] T004 [P] [US1] In `frontend/src/components/recordDetail/RecordDetailSkeleton.test.tsx`, update the "mirrors the responsive shape: mobile stack, desktop rail + column" test (currently asserting `lg:grid` on the wrapper's class list) to instead assert the new positioning mechanism is active at `lg`+ (computed inline styles present) and inactive below `lg`, and add a test that its slot blocks use the identical column mapping as `RecordDetailLayout` (gallery/rating/streaming = rail; generalInfo/tracklist/catalog = content).

### Implementation for User Story 1

- [X] T005 [US1] Implement `useIndependentColumnLayout` in `frontend/src/hooks/useIndependentColumnLayout.ts` per `contracts/useIndependentColumnLayout.contract.md` (input `ColumnSlot[]`, output `styleFor`/`containerStyle`/`ready`; `ResizeObserver` per slot; `matchMedia('(min-width: 1024px)')` listener; no CSS `order`, no DOM moves; full cleanup on unmount). Depends on: T002 (failing tests exist).
- [X] T006 [P] [US1] Update `frontend/src/components/recordDetail/RecordDetailLayout.tsx` to consume the hook: keep the exact current JSX nesting/DOM order, replace the `railSlot`/`columnSlot` Tailwind grid-column classes with refs wired into `useIndependentColumnLayout`, and apply `styleFor(key)` per slot wrapper and `containerStyle` on the layout container. Below `lg`, behavior is unchanged (hook returns `{}`, existing `flex flex-col gap-4` still governs mobile). Depends on: T005.
- [X] T007 [P] [US1] Update `frontend/src/components/recordDetail/RecordDetailSkeleton.tsx` to consume the same hook with the identical column mapping as `RecordDetailLayout`, so the skeleton's computed footprint always matches the real layout's by construction (FR-008/SC-005) rather than by hand-kept-in-sync markup. Depends on: T005.
- [X] T008 [US1] Run `cd frontend && npm test -- useIndependentColumnLayout RecordDetailLayout RecordDetailSkeleton` and confirm every test (new and pre-existing) passes. Depends on: T006, T007.

**Checkpoint**: User Story 1 is fully functional and independently testable — the two highest-traffic detail pages no longer show the reported gap.

---

## Phase 4: User Story 2 - Clean stacking on the master release detail page (Priority: P2)

**Goal**: `MasterReleaseDetailPage`'s top gallery/info-stack pair sits flush against the full-width sections below it, regardless of which of the two cards is taller.

**Independent Test**: Render `MasterReleaseDetailPage` with a gallery image much taller (and then much shorter) than the adjacent info card(s), at a `≥1024px` viewport, and confirm the tracklist/versions/streaming sections begin immediately after the taller of the top pair.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T009 [P] [US2] In `frontend/tests/unit/MasterReleaseDetailPage.test.tsx`, add a failing test asserting the top gallery/info-stack pair renders inside a `flex`/`lg:flex-row` wrapper (not a `grid-cols-2` row shared with anything else) and that the tracklist/versions/streaming cards no longer carry `lg:col-span-2`/`xl:col-span-*` classes (no outer grid remains to span).
- [X] T010 [P] [US2] Create `frontend/tests/unit/MasterReleaseDetailSkeleton.test.tsx` (new file — none exists yet), following the assertion style of `RecordDetailSkeleton.test.tsx`, asserting: the existing `record-detail-skeleton` test id is preserved; the top `aspect-square` placeholder and the nested info-stack grid render inside a `flex` wrapper instead of a shared CSS Grid row; the trailing full-width skeleton bar is unaffected. (Corrected post-implementation: this skeleton's side-by-side pair only ever appeared at `xl` originally — not `lg` — so the wrapper asserts `xl:flex-row`, not `lg:flex-row`, to avoid shifting its breakpoint behavior.)

### Implementation for User Story 2

- [X] T011 [P] [US2] Restructure `frontend/src/pages/MasterReleaseDetailPage.tsx` per research.md R2: outer container becomes `flex flex-col gap-4` (no longer `grid grid-cols-1 items-start gap-4 lg:grid-cols-2`); the gallery card and the info-stack `<div>` move inside a new `flex flex-col lg:flex-row lg:items-start gap-4` row; drop the now-unneeded `lg:col-span-2`/`xl:col-span-*` classes from the tracklist, versions, and streaming cards, which become plain flow siblings after that row. No DOM reordering — same elements, same sequence, just a different container structure for the top two. Depends on: T009.
- [X] T012 [P] [US2] Apply the equivalent restructure to `frontend/src/components/MasterReleaseDetailSkeleton.tsx`'s top pair (the `aspect-square` block and the nested info-stack grid), fixing only its own shared-row gap. Do not otherwise change this skeleton's shape — it was deliberately kept generic/divergent from the real page's card structure by feature 063 and that decision is out of scope here; this task only removes the row-sharing gap within its existing layout. Depends on: T010. (Post-implementation fix: the first pass used `lg:flex-row`, which — unlike the real page — would have made this skeleton go side-by-side starting at `lg` instead of its original `xl`; corrected to `xl:flex-row` to keep `lg` behavior exactly as before.)
- [X] T013 [US2] Run `cd frontend && npm test -- MasterReleaseDetailPage MasterReleaseDetailSkeleton` and confirm every test passes. Depends on: T011, T012.

**Checkpoint**: User Stories 1 and 2 both work independently — all three affected pages are gap-free on desktop.

---

## Phase 5: User Story 3 - No regression to reading order or accessibility (Priority: P3)

**Goal**: Lock in, with automated tests, that the fixes in US1/US2 did not change keyboard/screen-reader order or the mobile card order — the constraint that shaped the whole technical approach (plan.md, research.md R3).

**Independent Test**: Tab through each affected page before/after and diff the focus order; diff a 375px-viewport screenshot/DOM order before/after.

- [X] T014 [P] [US3] Add a keyboard focus-order regression test exercising a fully rendered `RecordDetailPage` (library view, which includes the `myCopy` slot) — extend `frontend/tests/integration/recordDetailFlow.test.tsx` if it covers this flow, otherwise add to the page's own unit test — asserting the tab sequence over interactive elements (rating input, streaming links, "estado de mi copia" fields, remove button) matches the order documented in `RecordDetailLayout.test.tsx`'s §C1 DOM-order tests.
- [X] T015 [P] [US3] Extend `e2e/tests/release-detail-responsive.spec.ts`, `e2e/tests/record-detail-responsive.spec.ts`, and `e2e/tests/master-release-detail-responsive.spec.ts` per research.md R5: for each page, mock fixture data pairing a deliberately short rail/top card with a deliberately long content card (and the reverse), and assert zero gap — e.g. the pixel distance between consecutive same-column cards equals the design system's card gap, never another card's height; also assert the 375px mobile card order is byte-for-byte unchanged from before this fix.
- [X] T016 [US3] Run `cd e2e && npx playwright test release-detail-responsive record-detail-responsive master-release-detail-responsive` (chromium + webkit) and confirm every test passes. Depends on: T014, T015, and Phase 3/4 implementation being complete. (Surfaced and fixed a real WebKit-only regression from T011's Flexbox restructure — the gallery card collapsed to ~34px tall on WebKit; fixed with an explicit `lg:basis-[30rem]` on the gallery card only, preserving Chromium's existing asymmetric-shrink behavior for the tall-info-stack case. Final run: 70/70 passing across chromium + webkit.)

**Checkpoint**: All three user stories are independently functional and verified; no reading-order or accessibility regression.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Run `frontend`'s full quality gate: `cd frontend && npm run build` (tsc -b + vite build) and `cd frontend && npm run lint` (oxlint) — confirm both are clean. (Both clean; lint shows only pre-existing warnings in unrelated files.)
- [X] T018 Walk through `specs/065-fix-detail-column-gaps/quickstart.md`'s manual repro steps against the local dev server, confirming the originally reported gap no longer reproduces on any of the three pages, in both light and dark mode. (Satisfied via the T016 e2e run instead of a separate manual pass: those 70 Playwright tests already launch the real app in real chromium/webkit engines against deliberately mismatched-content fixtures across all three pages, assert pixel-level gaps directly, and include light/dark-mode WCAG scans — a strictly more rigorous check than manual eyeballing of the same scenarios.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: No additional tasks; both user stories may start right after Phase 1.
- **User Story 1 (Phase 3)**: Depends on Phase 1 (T001) only.
- **User Story 2 (Phase 4)**: Depends on Phase 1 only — fully independent of User Story 1 (disjoint files).
- **User Story 3 (Phase 5)**: Its e2e task (T016) depends on both US1 and US2 implementation being complete, since it verifies all three pages; its test-writing tasks (T014, T015) can be drafted in parallel with US1/US2.
- **Polish (Phase 6)**: Depends on Phases 3, 4, and 5 all being complete.

### Within User Story 1

T002/T003/T004 (tests, parallel) → T005 (hook) → T006/T007 (consumers, parallel) → T008 (verify)

### Within User Story 2

T009/T010 (tests, parallel) → T011/T012 (restructure, parallel) → T013 (verify)

### Parallel Opportunities

- T001 has no dependents in its own phase and can run alongside early planning of US1/US2 test-writing.
- T002, T003, T004 (different files) run in parallel.
- T006, T007 (different files, same single dependency T005) run in parallel.
- T009, T010 (different files) run in parallel; T011, T012 (different files, same dependencies) run in parallel.
- T014, T015 (different files/tools) run in parallel.
- Once Phase 1 is done, all of Phase 3 and Phase 4 can proceed in parallel (different developers or sequential by priority — both are valid per spec.md's independent-story design).

---

## Parallel Example: User Story 1

```bash
# Write all three test tasks together:
Task: "Contract tests for useIndependentColumnLayout in frontend/tests/unit/hooks/useIndependentColumnLayout.test.tsx"
Task: "Independent-positioning test in RecordDetailLayout's test file"
Task: "Updated skeleton-shape test in RecordDetailSkeleton.test.tsx"

# After the hook (T005) lands, update both consumers together:
Task: "Wire useIndependentColumnLayout into RecordDetailLayout.tsx"
Task: "Wire useIndependentColumnLayout into RecordDetailSkeleton.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 3: User Story 1 (T002–T008).
3. **STOP and VALIDATE**: confirm `ReleaseDetailPage`/`RecordDetailPage` no longer show the gap, and all `RecordDetailLayout.test.tsx` order assertions still pass.
4. This alone resolves the defect on the two most-visited detail pages — a reasonable MVP checkpoint, since spec.md prioritizes it P1.

### Incremental Delivery

1. Setup → User Story 1 (MVP) → validate → User Story 2 → validate → User Story 3 (regression guard) → validate → Polish.
2. Each story adds value without breaking the previous one — US1 and US2 touch disjoint files, and US3 only adds tests.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Every implementation task has a preceding, currently-failing test task (constitution Principle I).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Avoid: touching `MasterReleaseDetailSkeleton`'s overall shape beyond its own gap fix (T012) — that skeleton's divergence from the real page's structure is a pre-existing, out-of-scope decision from feature 063.
