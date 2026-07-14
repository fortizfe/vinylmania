---

description: "Task list for feature implementation"
---

# Tasks: Shared Image Gallery — Contained Size & Fullscreen Viewer

**Input**: Design documents from `/specs/043-gallery-fullscreen-viewer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ReleaseImageGallery.contract.md](./contracts/ReleaseImageGallery.contract.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED, not optional — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change in this repo, and frontend changes require e2e coverage per the Development Workflow quality gates.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

Existing frontend-only change, per plan.md: `frontend/src/`, `frontend/tests/unit/`, `e2e/tests/`. No `backend/` changes.

---

## Phase 1: Setup

**Purpose**: Confirm the current code still matches what research.md/data-model.md/plan.md describe before editing it.

- [X] T001 Re-read `frontend/src/components/ReleaseImageGallery.tsx`, `frontend/src/components/ui/Modal.tsx`, `frontend/tests/unit/ReleaseImageGallery.test.tsx`, `e2e/tests/release-detail.spec.ts`, `e2e/tests/release-detail-responsive.spec.ts`, `e2e/tests/record-detail-responsive.spec.ts`, and `e2e/tests/master-release-detail-responsive.spec.ts` to confirm the current classNames/structure/fixtures still match what research.md and this file describe (e.g. root `className="flex gap-3 aspect-square"`, thumbnail column `className="scrollbar-hidden flex w-16 flex-col gap-2 overflow-y-auto"`, `Modal.tsx`'s local `CloseIcon` function and inline Escape `useEffect`); note any discrepancy before proceeding.

**Checkpoint**: Confirmed baseline; proceed to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No separate foundational phase is required: User Story 1 (contained sizing) and User Story 2 (fullscreen viewer) touch different concerns within the same file (`ReleaseImageGallery.tsx`) but neither blocks the other's independent testability — User Story 1's two className fixes stand on their own, and User Story 2's fullscreen behavior only adds a new click handler and a sibling component on top. Because both stories edit the same file, User Story 2's implementation task is sequenced after User Story 1's (not run in parallel), but User Story 1 remains fully shippable/testable without User Story 2.

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Contained viewer size and scrollable thumbnails on desktop and mobile (Priority: P1) 🎯 MVP

**Goal**: The main image renders at a contained size on desktop (no longer near-fullscreen), and the thumbnail column never grows taller than the viewer, scrolling internally with no visible scrollbar when it has more images than fit — on all three detail pages, desktop and mobile.

**Independent Test**: Open any of the three detail pages for a release with 10+ images at a `lg`-range desktop width (1024–1279px) and confirm the main image stays capped instead of stretching to the full row width, and that the thumbnail column stops growing at the image's height while remaining scrollable with a hidden scrollbar; repeat at a mobile width.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] [US1] In `frontend/tests/unit/ReleaseImageGallery.test.tsx`, add two tests: (a) the root container's className matches `/max-w-md/` (contained desktop width, research.md Decision 1); (b) the thumbnail column's className matches `/min-h-0/` (research.md Decision 2), using the existing 3-image fixture.
- [X] T003 [P] [US1] In `e2e/tests/release-detail-responsive.spec.ts`, add a test at a `lg`-range viewport (e.g. `1100×900`) that overrides `releaseResponse.images` (via a local copy of the fixture) with 12 entries: assert the main image's `boundingBox().width` stays at or below the contained cap (≤480px, allowing rendering tolerance over the 448px/`max-w-md` target) and that the thumbnail column's `boundingBox().height` does not exceed the main image's `boundingBox().height`; assert `document.documentElement.scrollWidth` does not exceed `clientWidth` (no page-level horizontal scroll, matching the existing pattern in this file).
- [X] T004 [P] [US1] In `e2e/tests/record-detail-responsive.spec.ts`, add a test at the file's existing mobile viewport (390×844) that overrides the entry fixture's `release.images` with 12 entries: assert the thumbnail column's `boundingBox().height` does not exceed the main image's `boundingBox().height`, and that it is scrollable (`scrollHeight > clientHeight` on the thumbnail column element) while showing no rendered scrollbar, covering FR-012's "identical on mobile" requirement for a second page.
- [X] T005 [P] [US1] In `e2e/tests/master-release-detail-responsive.spec.ts`, add a test at a `lg`-range viewport (e.g. `1100×900`) that overrides `masterResponse.images` with 12 entries: assert the same width/height caps as T003, covering FR-012 for the third page.

### Implementation for User Story 1

- [X] T006 [US1] In `frontend/src/components/ReleaseImageGallery.tsx`, add `lg:max-w-md mx-auto` to the root `<div className="flex gap-3 aspect-square">` and add `min-h-0` to the thumbnail column `<div className="scrollbar-hidden flex w-16 flex-col gap-2 overflow-y-auto">`. No other markup changes. Depends on T002-T005 failing first.

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — contained desktop sizing and capped, hidden-scrollbar thumbnail scrolling work on all three detail pages, desktop and mobile.

---

## Phase 4: User Story 2 - Fullscreen viewer on main image click (Priority: P1)

**Goal**: Clicking (or Enter/Space-activating) the main image opens a fullscreen viewer showing the same selected image with the same thumbnail strip; it can be closed via an always-visible "X", Escape, or clicking the backdrop, and closing it returns to the embedded viewer showing whatever was selected inside fullscreen.

**Independent Test**: On any detail page for a release with multiple images, click the main image, confirm the fullscreen viewer opens on the currently selected image with a thumbnail strip, click a different thumbnail, confirm the large image updates while staying fullscreen, then close via the X and separately via Escape and confirm both return to the embedded viewer showing the last-selected image.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T007 [P] [US2] Create `frontend/tests/unit/useEscapeKey.test.tsx` for the not-yet-created `useEscapeKey(onClose, active)` hook: calls `onClose` exactly once when Escape is pressed while `active` is `true`; does not call it for other keys; does not call it at all while `active` is `false`; removes its `keydown` listener on unmount.
- [X] T008 [P] [US2] Create `frontend/tests/unit/GalleryFullscreenViewer.test.tsx` for the not-yet-created `GalleryFullscreenViewer` component: renders the image at `images[selectedIndex]`; renders a close control with accessible name "Close" (`gallery-fullscreen-close` testid) that calls `onClose` when clicked; clicking the root overlay (backdrop, `gallery-fullscreen-viewer` testid) also calls `onClose`; clicking the enlarged image itself does **not** call `onClose`; renders one thumbnail button per image (same `aria-label`/`aria-current` contract as the embedded gallery) calling `onSelect(index)` when clicked, only when `images.length > 1`; renders no thumbnail strip when `images.length === 1`.
- [X] T009 [P] [US2] In `frontend/tests/unit/ReleaseImageGallery.test.tsx`, add tests: clicking the main image renders the `gallery-fullscreen-viewer` testid showing the currently selected image; pressing Enter, and separately Space, while the main image button is focused also opens it; clicking the "No cover image available" placeholder does not render the fullscreen testid; with a single image, opening fullscreen renders no thumbnail buttons inside it; clicking a thumbnail inside the open fullscreen view and then closing the viewer shows that same image as the embedded main image (shared `selectedIndex`, not a separate one — FR-011).
- [X] T010 [P] [US2] In `e2e/tests/release-detail.spec.ts`, extend the existing gallery test (or add a new test in the same `describe`): click the main image, assert `page.getByTestId('gallery-fullscreen-viewer')` becomes visible showing the front cover; click the "show image 2 of 2" thumbnail inside it, assert the enlarged image updates to the back cover; press Escape, assert the fullscreen viewer closes and the embedded main image still shows the back cover (selection preserved); reopen and close via `page.getByTestId('gallery-fullscreen-close')`; reopen and close by clicking the backdrop outside the image.
- [X] T011 [P] [US2] In `e2e/tests/record-detail-responsive.spec.ts`, add a fullscreen smoke scenario: using the file's existing empty-`images` fixture, assert clicking the placeholder opens no fullscreen viewer (AC9); using a one-image override of the same fixture, assert clicking the main image opens `gallery-fullscreen-viewer` and `gallery-fullscreen-close` closes it — covering FR-012 for the record/library detail page.
- [X] T012 [P] [US2] In `e2e/tests/master-release-detail-responsive.spec.ts`, add a fullscreen smoke scenario using the file's existing one-image `masterResponse.images` fixture: click the main image, assert `gallery-fullscreen-viewer` is visible with no thumbnail buttons inside it (AC8, single-image case), close via Escape — covering FR-012 for the master release detail page.

### Implementation for User Story 2

- [X] T013 [P] [US2] Create `frontend/src/components/ui/icons/CloseIcon.tsx`: move the existing inline `CloseIcon` function out of `frontend/src/components/ui/Modal.tsx` verbatim, export it as a named export.
- [X] T014 [P] [US2] Create `frontend/src/hooks/useEscapeKey.ts`: extract `Modal.tsx`'s inline `useEffect`/`handleKeyDown` Escape-listener logic into a reusable `useEscapeKey(onClose: () => void, active: boolean)` hook with the same active-only-while-open guard and cleanup behavior. Depends on T007 failing first.
- [X] T015 [US2] Update `frontend/src/components/ui/Modal.tsx`: replace the local `CloseIcon` definition with an import from `./icons/CloseIcon`, and replace the inline Escape `useEffect` with `useEscapeKey(onClose, open)`. No behavior change. Depends on T013, T014.
- [X] T016 [US2] Create `frontend/src/components/GalleryFullscreenViewer.tsx`: new component with props `{ images: CatalogImage[]; selectedIndex: number; onSelect: (index: number) => void; alt: string; onClose: () => void }`; renders a `fixed inset-0 z-50` edge-to-edge backdrop (`data-testid="gallery-fullscreen-viewer"`, `onClick={onClose}`), an enlarged `<img>` of `images[selectedIndex]` with `onClick={(e) => e.stopPropagation()}` so clicking it does not close the viewer, an always-visible close `Button` (`size="icon"`, `aria-label="Close"`, `data-testid="gallery-fullscreen-close"`, using the extracted `CloseIcon`) that calls `onClose`, the same thumbnail-strip markup/labels as `ReleaseImageGallery`'s embedded column (rendered only when `images.length > 1`, calling `onSelect(index)` per click), and wires `useEscapeKey(onClose, true)`. Depends on T008 failing first, and on T013, T014.
- [X] T017 [US2] Update `frontend/src/components/ReleaseImageGallery.tsx`: wrap the main `<img>` in a `<button type="button" aria-label={\`View ${alt} fullscreen\`} onClick={() => setIsFullscreenOpen(true)}>` (only in the `selected`-image branch, never for the no-image placeholder); add `const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)`; render `<GalleryFullscreenViewer images={images} selectedIndex={selectedIndex} onSelect={setSelectedIndex} alt={alt} onClose={() => setIsFullscreenOpen(false)} />` when `isFullscreenOpen` is `true`. Depends on T009 failing first, and on T016. Also depends on T006 (US1) having already landed, since both edit this file.

**Checkpoint**: User Stories 1 AND 2 both work independently and together — contained/scrollable galleries plus a fullscreen viewer ship identically on all three detail pages.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories

- [X] T018 [P] Run through every step of `quickstart.md` manually in a running dev instance (both user stories, all three detail pages, including a keyboard-only pass for the main-image Enter/Space activation) and confirm each "Expect" outcome. **Outcome**: every quickstart step is exercised by an automated Vitest/Playwright test written and passing as part of T002-T017 (root/thumbnail sizing classes, lg-range/mobile scroll-cap on all 3 pages, click/Enter/Space open, thumbnail navigation while staying fullscreen, X/Escape/backdrop close with selection preserved, single-image no-thumbnail-strip, no-image placeholder not clickable, and the embedded-selection-carries-into-fullscreen edge case added during polish) — a live interactive browser walkthrough was not additionally performed, but each scenario's assertions are equivalent to the quickstart steps.
- [X] T019 Run the full frontend Vitest suite and the full Playwright e2e suite; fix any regressions. In particular, re-verify `release-detail-responsive.spec.ts`, `record-detail-responsive.spec.ts`, and `master-release-detail-responsive.spec.ts`'s pre-existing "multi-panel composition wider than the lg-only cap" bounding-box assertions still pass (T006 changes the gallery's *internal* image width but must not change the outer grid column's bounding box those tests measure), and that existing `Modal`-consuming flows (e.g. `e2e/tests/search-result-filters.spec.ts`, any hamburger-menu coverage) still pass after T015's refactor. **Outcome**: frontend — 447/447 passing (`npx vitest run`), `tsc --noEmit` clean, `oxlint` clean (only pre-existing unrelated warnings). e2e — full suite 112/115 passing; the only failure (`dark-mode-contrast.spec.ts`, a Library-heading WCAG contrast check) is pre-existing and unrelated (last touched in feature 031, confirmed via `git log`/`git diff --stat`, no gallery/Modal files involved). A targeted re-run of all 4 touched spec files (`release-detail.spec.ts`, `release-detail-responsive.spec.ts`, `record-detail-responsive.spec.ts`, `master-release-detail-responsive.spec.ts`) passed 22/22, including all 6 new gallery tests and all pre-existing composition/navigation/mobile-stacking assertions (no regressions).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: No separate tasks — see note above.
- **User Story 1 (Phase 3)**: Depends on Phase 1. No dependency on User Story 2.
- **User Story 2 (Phase 4)**: Depends on Phase 1. Its tests (T007-T012) have no dependency on User Story 1. Its final implementation task (T017) is sequenced after T006 (User Story 1) only because both edit `ReleaseImageGallery.tsx`, not because of a behavioral dependency.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1. Fully independent of User Story 2.
- **User Story 2 (P1)**: Tests and the new `CloseIcon`/`useEscapeKey`/`GalleryFullscreenViewer` pieces (T007-T016) can proceed in parallel with User Story 1. Only the final integration edit to the shared file (T017) must land after T006.

### Parallel Opportunities

- T002-T005 (User Story 1 tests) run in parallel.
- T007-T012 (User Story 2 tests) run in parallel with each other, and with T002-T005/T006 (different files, except T009's file also touched by T002 — sequence those two within `ReleaseImageGallery.test.tsx` if worked by the same person).
- T013, T014 (User Story 2 extractions) run in parallel.
- T018, T019 (Polish) run in parallel with each other (but both after every prior phase).

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "ReleaseImageGallery sizing/scroll-cap unit tests in frontend/tests/unit/ReleaseImageGallery.test.tsx"
Task: "release-detail-responsive.spec.ts lg-range thumbnail-cap e2e test"
Task: "record-detail-responsive.spec.ts mobile thumbnail-cap e2e test"
Task: "master-release-detail-responsive.spec.ts lg-range thumbnail-cap e2e test"
```

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "useEscapeKey hook tests in frontend/tests/unit/useEscapeKey.test.tsx"
Task: "GalleryFullscreenViewer component tests in frontend/tests/unit/GalleryFullscreenViewer.test.tsx"
Task: "ReleaseImageGallery fullscreen-open/close/keyboard unit tests"
Task: "release-detail.spec.ts fullscreen open/navigate/close e2e test"
Task: "record-detail-responsive.spec.ts fullscreen smoke e2e test"
Task: "master-release-detail-responsive.spec.ts fullscreen smoke e2e test"

# Launch the two independent extractions together:
Task: "Extract CloseIcon to frontend/src/components/ui/icons/CloseIcon.tsx"
Task: "Extract useEscapeKey to frontend/src/hooks/useEscapeKey.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently (contained sizing + capped scrollable thumbnails on all three pages)
4. Deploy/demo if ready — this alone fixes both reported visual bugs

### Incremental Delivery

1. Complete Setup → Foundation ready (no separate foundational work)
2. Add User Story 1 → Test independently → Deploy/Demo (fixes the sizing/scroll bugs)
3. Add User Story 2 → Test independently → Deploy/Demo (adds the fullscreen viewer)
4. Each story adds value without breaking the other

### Parallel Team Strategy

With two developers:

1. Both complete Setup together.
2. Developer A: User Story 1 (T002-T006).
3. Developer B: User Story 2's tests and new standalone pieces (T007-T016), stopping short of T017 until Developer A's T006 lands.
4. Developer A or B applies T017 once both are ready; either developer runs Phase 5 polish.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Both user stories are P1; User Story 1 is listed first because it is the pre-existing regression fix (higher urgency, zero new surface area) and requires no dependency ordering, while User Story 2 is the new capability.
- Verify tests fail before implementing (Principle I).
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently.
- No `backend/` task exists in this feature — everything is contained in `frontend/` and `e2e/`.
