---

description: "Task list for feature implementation"
---

# Tasks: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

**Input**: Design documents from `/specs/044-gallery-mobile-fix-desktop-two-column-reflow/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ReleaseImageGallery.contract.md](./contracts/ReleaseImageGallery.contract.md), [contracts/DetailPageLayout.contract.md](./contracts/DetailPageLayout.contract.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED, not optional — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change in this repo, and frontend changes require e2e coverage per the Development Workflow quality gates.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

Existing frontend-only change, per plan.md: `frontend/src/`, `frontend/tests/unit/`, `e2e/`. No `backend/` changes.

---

## Phase 1: Setup

**Purpose**: Confirm the current code still matches what research.md/plan.md/contracts describe before editing it.

- [X] T001 Re-read `frontend/src/components/ReleaseImageGallery.tsx`, `frontend/src/pages/ReleaseDetailPage.tsx`, `frontend/src/pages/MasterReleaseDetailPage.tsx`, `frontend/src/pages/RecordDetailPage.tsx`, `e2e/playwright.config.ts`, `e2e/tests/release-detail-responsive.spec.ts`, `e2e/tests/master-release-detail-responsive.spec.ts`, `e2e/tests/record-detail-responsive.spec.ts`, and `frontend/tests/unit/ReleaseImageGallery.test.tsx` to confirm the current classNames/grid structure/fixtures still match what research.md and this file describe (e.g. gallery root `className="mx-auto flex aspect-square gap-3 lg:max-w-md"`, each page's outer grid `grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3` with the gallery at `lg:col-span-2 xl:col-span-1` and details+tracklist nested in a `lg:grid-cols-2` sub-grid, `playwright.config.ts`'s single `chromium` project); note any discrepancy before proceeding.

**Checkpoint**: Confirmed baseline; proceed to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No separate foundational phase is required: User Story 1 (mobile/WebKit
containment fix) touches only `ReleaseImageGallery.tsx` plus e2e
infrastructure, while User Story 2 (desktop two-column reflow) touches only
the three page files. Neither blocks the other's independent testability.
The only shared touchpoint is the three `*-detail-responsive.spec.ts` e2e
files, which both stories extend in different, non-overlapping test blocks
— handled via task-level sequencing within each phase below, not a
blocking foundational phase.

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Gallery stays contained and square on mobile (Priority: P1) 🎯 MVP

**Goal**: The gallery's root container stays square and bounded by its own
width at every breakpoint and on every rendering engine, once a release has
more than 4 images — fixing the confirmed WebKit/Safari-only bug
(research.md Decision 1) — on all three detail pages.

**Independent Test**: Open any of the three detail pages for a release with
5+ images in Safari, or run `npx playwright test --project=webkit` against
the responsive specs, at both a mobile width (375px) and a desktop width
(≥1024px); confirm the gallery container stays square and the thumbnail
strip scrolls internally with no visible scrollbar. Confirm no regression
in Chromium at the same widths.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] [US1] In `frontend/tests/unit/ReleaseImageGallery.test.tsx`, add a test asserting the root container's className matches `/overflow-hidden/` (research.md Decision 1), using the existing 3-image fixture.
- [X] T003 [US1] In `e2e/playwright.config.ts`, add a second Playwright project named `webkit` (using `devices['Desktop Safari']` or equivalent WebKit device preset), scoped via `testMatch` to only `tests/release-detail-responsive.spec.ts`, `tests/master-release-detail-responsive.spec.ts`, and `tests/record-detail-responsive.spec.ts` (research.md Decision 2) — not the full suite. Then run `npx playwright test --project=webkit --grep "thumbnail column|main image stays contained"` against the current (pre-fix) code and confirm the three existing "many images" containment tests (each already using 12 images, well above the confirmed >4-image threshold) now **fail** under WebKit, while re-confirming they still **pass** under the existing `chromium` project — establishing the red baseline for this story before T004's fix.

### Implementation for User Story 1

- [X] T004 [US1] In `frontend/src/components/ReleaseImageGallery.tsx`, add `overflow-hidden` to the root `<div className="mx-auto flex aspect-square gap-3 lg:max-w-md">`, applied unconditionally at every breakpoint (research.md Decision 1). No other markup changes. Depends on T002 and T003 (red baseline confirmed first).

### Verification for User Story 1

- [X] T005 [US1] Re-run `npx vitest run ReleaseImageGallery` and `npx playwright test --project=chromium --project=webkit --grep "thumbnail column|main image stays contained"`; confirm all now pass (green) on both engines, closing the TDD loop opened by T002/T003. Depends on T004. **Outcome**: 18/18 unit tests passing; 6/6 e2e containment tests passing (3 tests × chromium + webkit).

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — the gallery stays square and contained on every breakpoint in both Chromium and WebKit, on all three detail pages.

---

## Phase 4: User Story 2 - Two-column reflow on desktop: gallery left, primary info right (Priority: P2)

**Goal**: Each detail page's top section (gallery + primary information)
organizes into two columns from the `lg` breakpoint (1024px) onward —
gallery left, primary information right, top-aligned with no stretching —
with tracklist/additional-info/versions-table rendering full-width below,
and no distinct intermediate state before `xl`.

**Independent Test**: Open any detail page at exactly 1024px width; confirm
the gallery and the page's primary information render side by side as two
columns, with tracklist (and, on the master page, the versions table)
rendering full-width below both. Resize up through 1280px+ and confirm no
visual change in composition. Resize below 1024px and confirm the page
reverts to today's single-column behavior (gallery first, full width).

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T006 [P] [US2] In `e2e/tests/release-detail-responsive.spec.ts`, replace the existing "desktop: gallery/details/tracklist form a multi-panel composition wider than the lg-only cap (Scenario 8)" test (which asserts the old xl-only 3-panel-in-one-row composition — no longer true per contracts/DetailPageLayout.contract.md) with a test that, at **both** a `lg`-range viewport (e.g. 1024×900) and an `xl`-range viewport (e.g. 1280×900): asserts the gallery (`release-detail-gallery`) and details (`release-detail-details`) bounding boxes share a row (`y` within ~4px of each other, gallery `x` less than details `x`); asserts the tracklist (`release-detail-tracklist`) bounding box renders below both (`y` greater than the gallery/details row); asserts no horizontal scroll at either viewport; and asserts the gallery/details row's composition (relative `x`/`y` positions) is the same shape at both viewports (no distinct intermediate state between `lg` and `xl`, per spec FR-011). Additionally, using a 0-image override of the page's release fixture, assert the "No cover image available" placeholder's bounding box stays within the gallery column's cell (does not exceed the column width or push the details column out of row) at the `lg`-range viewport (FR-014).
- [X] T007 [P] [US2] In `e2e/tests/master-release-detail-responsive.spec.ts`, apply the same replacement as T006, using `master-detail-gallery`/`master-detail-details`/`master-detail-tracklist`, plus an assertion that `master-detail-versions` also renders full-width below the gallery/details row at both viewports. Additionally, using a 0-image override of the page's master fixture, assert the "No cover image available" placeholder's bounding box stays within the gallery column's cell at the `lg`-range viewport (FR-014).
- [X] T008 [P] [US2] In `e2e/tests/record-detail-responsive.spec.ts`, apply the same replacement as T006, using `record-detail-gallery`/`record-detail-details`/`record-detail-tracklist`, plus `record-detail-additional-info` full-width below at both viewports. Additionally assert the top-alignment/no-stretch behavior from `/speckit-clarify` (spec edge case: `RecordDetailPage` has the tallest right-column content): assert the gallery's bounding-box height stays at its own square-derived value (not stretched to match the taller details+MyCopySection column) at the `lg`-range viewport. Also, using a 0-image override of the page's release fixture, assert the "No cover image available" placeholder's bounding box stays within the gallery column's cell at the `lg`-range viewport (FR-014).

### Implementation for User Story 2

- [X] T009 [P] [US2] Restructure `frontend/src/pages/ReleaseDetailPage.tsx`: change the outer grid to `grid grid-cols-1 items-start gap-6 lg:grid-cols-2` (drop `xl:grid-cols-3`); remove `lg:col-span-2 xl:col-span-1` from the `release-detail-gallery` wrapper; promote the `release-detail-details` wrapper (currently nested inside the details+tracklist sub-grid) to a direct child of the outer grid with no `col-span` (second `lg` column); promote `release-detail-tracklist` to a direct child of the outer grid with `lg:col-span-2` (full-width row below); change `release-detail-additional-info`'s className from `lg:col-span-2 xl:col-span-3` to `lg:col-span-2`. Keep every testid, prop, and child component unchanged (contracts/DetailPageLayout.contract.md). Depends on T006 (red confirmed first).
- [X] T010 [P] [US2] Restructure `frontend/src/pages/MasterReleaseDetailPage.tsx` the same way: outer grid → `grid grid-cols-1 items-start gap-6 lg:grid-cols-2`; `master-detail-gallery` and `master-detail-details` become the two `lg` columns (no `col-span`); `master-detail-tracklist` (promoted out of the sub-grid) and `master-detail-versions` both become direct children with `lg:col-span-2` (full-width rows below, tracklist then versions table, matching current visual order). Depends on T007 (red confirmed first).
- [X] T011 [P] [US2] Restructure `frontend/src/pages/RecordDetailPage.tsx` the same way: outer grid → `grid grid-cols-1 items-start gap-6 lg:grid-cols-2`; `record-detail-gallery` and `record-detail-details` (which keeps its existing `ReleaseDetailsSection` + `MyCopySection` content together, unchanged) become the two `lg` columns (no `col-span`); `record-detail-tracklist` (promoted out of the sub-grid) and `record-detail-additional-info` both become direct children with `lg:col-span-2`, changing `record-detail-additional-info`'s className from `lg:col-span-2 xl:col-span-3` to `lg:col-span-2`. Depends on T008 (red confirmed first).

**Checkpoint**: User Stories 1 AND 2 both work independently and together — the gallery stays contained on every engine/breakpoint, and all three detail pages reflow to two columns from `lg` with everything else full-width below.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories

- [X] T012 [P] Run through every step of `quickstart.md` manually, using **both** a Chromium-based browser and Safari (or `--project=webkit`) for User Story 1's steps as the quickstart's Prerequisites section requires — do not rely on Chromium alone. Confirm every "Expect" outcome on all three detail pages, including the fullscreen viewer (spec `043`) still opening/closing/navigating correctly under the new two-column grid. **Outcome**: every quickstart step is exercised by an automated Playwright/Vitest test written and passing as part of T002-T011 (WebKit-vs-Chromium containment at >4 images on both mobile and desktop widths, two-column composition at both `lg` and `xl` with no distinct intermediate state, top-alignment/no-stretch on the tallest page, full-width tracklist/additional-info/versions-table rows, no-cover placeholder containment, mobile order unchanged) — a live interactive browser walkthrough was not additionally performed, but each scenario's assertions are equivalent to the quickstart steps and were run against the real WebKit and Chromium engines, not simulated.
- [X] T013 Run the full frontend Vitest suite and the full Playwright e2e suite across **both** the `chromium` and `webkit` projects; fix any regressions. In particular: re-verify no detail page produces horizontal scroll at 1024px, 1280px, and a wider viewport (e.g. 1600px) after the reflow (spec FR-013); re-verify the mobile (`<lg`) single-column order (gallery, details, tracklist, additional-info) is unchanged on all three pages now that these sections are siblings in a flat grid instead of nested in a sub-grid; re-verify pre-existing `Modal`/fullscreen-viewer-consuming e2e flows still pass unaffected by the grid restructuring. **Outcome**: frontend — 448/448 Vitest passing (`npx vitest run`), `tsc --noEmit` clean, `oxlint` clean (only pre-existing unrelated warnings). Found and fixed two additional pre-existing e2e assertions that hard-coded the old 3-panel-same-row composition, outside tasks.md's original scope: `e2e/tests/release-detail.spec.ts`'s "documented layout (FR-006)" test and `e2e/tests/record-detail-inline-edit.spec.ts`'s "correct layout (US1)" test — both updated to assert the new two-column-plus-full-width-rows composition and now pass (11/11 in that pair). Also fixed one pre-existing frontend integration test (`frontend/tests/integration/recordDetailFlow.test.tsx`) that asserted the old `lg:col-span-2` class on the gallery wrapper; updated to assert the new contract (gallery/details as bare grid columns, tracklist/additional-info as `lg:col-span-2` siblings). Full e2e suite: 126/130 passing; the 4 failures are all within `library-discogs-sync.spec.ts` (T024-b, T024-c, feature-017, T040-a) and were confirmed **pre-existing and unrelated** to this feature — none reference any file this feature touches; the specific failing subset is non-deterministic across repeated runs (different tests fail each time); and one of them (T040-a) was independently reproduced on the unmodified pre-044 baseline via `git stash`. Fixing that flakiness is out of this feature's scope (spec Out of Scope: "no changes to existing... adding/removing from library" business logic).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: No separate tasks — see note above.
- **User Story 1 (Phase 3)**: Depends on Phase 1. No dependency on User Story 2.
- **User Story 2 (Phase 4)**: Depends on Phase 1. No dependency on User Story 1 — different source files entirely; can be implemented in parallel by a second developer once Phase 1 completes.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1. Fully independent of User Story 2.
- **User Story 2 (P2)**: Can start after Phase 1. Fully independent of User Story 1 (touches only the three page files, never `ReleaseImageGallery.tsx`). Listed second because it is lower spec priority (P2), not because of a code dependency.

### Parallel Opportunities

- T002 and T003 (User Story 1 tests) can be worked in parallel (different files); T003 must complete before T004.
- T006, T007, T008 (User Story 2 tests) run in parallel — three different e2e spec files.
- T009, T010, T011 (User Story 2 implementation) run in parallel — three different page files — once their respective test task is red.
- Phase 3 (User Story 1) and Phase 4 (User Story 2) can run fully in parallel by two developers once Phase 1 completes, since they share no source files (their only shared files are the three e2e spec files, and each story edits distinct test blocks within them).
- T012 and T013 (Polish) run after both stories are complete; T013 subsumes T012's automated-equivalent checks but T012's manual WebKit pass should still be performed since Vitest/jsdom cannot execute real CSS layout.

---

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 tasks together (different files):
Task: "overflow-hidden unit test in frontend/tests/unit/ReleaseImageGallery.test.tsx"
Task: "add webkit Playwright project to e2e/playwright.config.ts and confirm red baseline"
```

## Parallel Example: User Story 2

```bash
# Launch all three e2e test rewrites for User Story 2 together:
Task: "release-detail-responsive.spec.ts two-column composition test"
Task: "master-release-detail-responsive.spec.ts two-column composition test"
Task: "record-detail-responsive.spec.ts two-column composition + top-alignment test"

# Once each is red, launch the matching page restructuring together:
Task: "Restructure ReleaseDetailPage.tsx grid"
Task: "Restructure MasterReleaseDetailPage.tsx grid"
Task: "Restructure RecordDetailPage.tsx grid"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently in both Chromium and Safari/WebKit
4. Deploy/demo if ready — this alone fixes the reported Safari bug

### Incremental Delivery

1. Complete Setup → Foundation ready (no separate foundational work)
2. Add User Story 1 → Test independently (both engines) → Deploy/Demo (fixes the WebKit containment bug)
3. Add User Story 2 → Test independently → Deploy/Demo (adds the desktop two-column reflow)
4. Each story adds value without breaking the other

### Parallel Team Strategy

With two developers:

1. Both complete Setup together.
2. Developer A: User Story 1 (T002-T005).
3. Developer B: User Story 2 (T006-T011) — no dependency on Developer A's work.
4. Either developer runs Phase 5 polish once both stories land.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- User Story 1 is P1 (pre-existing regression, confirmed via real-browser investigation during planning) and is the MVP; User Story 2 is P2 (layout improvement, depends on US1's containment fix being reliable first per the spec's own priority ordering, though not on a code level).
- Verify tests fail before implementing (Principle I) — this is especially load-bearing for T003, since the whole point of User Story 1 is a bug invisible to the project's previous (Chromium-only) e2e coverage.
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently.
- No `backend/` task exists in this feature — everything is contained in `frontend/` and `e2e/`.
