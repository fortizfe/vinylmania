---

description: "Task list template for feature implementation"
---

# Tasks: Release Preview Layout Redesign

**Input**: Design documents from `/specs/013-release-preview-layout-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — the project constitution mandates Test-First (Principle I, NON-NEGOTIABLE): a failing test must exist before implementation code is written, for every story.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Web application structure (existing repo): `frontend/src/`, `frontend/tests/`, `e2e/tests/`. This feature does not touch `backend/`.

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before changing any layout code

- [X] T001 Run the existing suites (`cd frontend && npm test`, and `cd e2e && npm test`) to confirm they pass cleanly on the current `main` before starting the redesign, establishing the pre-change baseline required by Principle I

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure required by every user story below

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add a reusable hidden-scrollbar utility to `frontend/src/styles/global.css` via Tailwind v4's `@utility` directive (e.g. `.scrollbar-hidden`), combining `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (legacy Edge), and `&::-webkit-scrollbar { display: none }` (Chrome/Safari), per [research.md](./research.md) decision 1 — content inside elements using this class remains fully scrollable, only the scrollbar chrome is hidden

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - See the cover gallery front and center (Priority: P1) 🎯 MVP

**Goal**: The image gallery (main image + vertical thumbnail strip) spans the full width of the preview in a square format, with the thumbnail strip scrollable but never showing a visible scrollbar.

**Independent Test**: Open the preview for a record with multiple catalog images; confirm the gallery spans the full preview width, the main image is square, the thumbnail strip is fully browsable with no visible scrollbar, and clicking a thumbnail swaps the main image. Repeat for single-image and no-image records.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T003 [P] [US1] Update `frontend/tests/unit/ReleaseImageGallery.test.tsx`: assert the gallery renders full width with a square (`aspect-square`) main image, the thumbnail strip's scroll container carries the hidden-scrollbar utility class from T002 instead of the current visible `overflow-y-auto`, and the existing multiple/one/zero-image scenarios still hold
- [X] T004 [P] [US1] Update `frontend/tests/unit/ReleasePreviewModal.test.tsx`: assert the gallery element spans the full width of the grid (both columns) in both the `release-preview-loading` skeleton state and the loaded state
- [X] T005 [US1] Extend `e2e/tests/release-preview-gallery.spec.ts`: add an assertion that the gallery renders at full preview width and the thumbnail strip shows no visible scrollbar track/handle when there are more thumbnails than fit the visible area (desktop viewport)

### Implementation for User Story 1

- [X] T006 [US1] Update `frontend/src/components/ReleaseImageGallery.tsx`: remove the current fixed-width constraint so the gallery fills its container width, keep the main image square (`aspect-square`), and apply the `.scrollbar-hidden` class (T002) to the vertical thumbnail strip's scroll container in place of the current `overflow-y-auto`
- [X] T007 [US1] Update `frontend/src/components/ReleasePreviewModal.tsx`: change the top-level grid so `ReleaseImageGallery` spans both columns on `lg:` layouts (e.g. `lg:col-span-2`), moving the existing details+tracklist block to its own row below (its internal content is unchanged for now; narrowed further in later stories)
- [X] T008 [US1] Update the `release-preview-loading` skeleton branch in `frontend/src/components/ReleasePreviewModal.tsx`: replace the current gallery skeleton with a single full-width square skeleton block matching the new gallery shape (existing skeleton blocks below remain for now)

**Checkpoint**: Gallery redesign is functional and independently verifiable — full-width square gallery with a hidden-scrollbar thumbnail strip — while the row below still shows the pre-existing single-column details+tracklist block.

---

## Phase 4: User Story 2 - Scan key details and tracklist together (Priority: P2)

**Goal**: Below the gallery, key release details (title, artist, genres, styles, date, label) render in the left column and the tracklist renders in the right column, neither independently height-bounded.

**Independent Test**: Open the preview for a record with full metadata and a tracklist on a wide viewport; confirm key details and tracklist appear side by side directly below the gallery, and confirm a long tracklist grows the row rather than scrolling internally.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T009 [P] [US2] Create `frontend/tests/unit/ReleaseTracklistSection.test.tsx`: assert it renders each track's position/title/duration in order, and renders nothing (`null`) when given an empty tracklist array
- [X] T010 [P] [US2] Update `frontend/tests/unit/ReleasePreviewModal.test.tsx`: assert key details and the tracklist render as two adjacent columns below the gallery on wide layouts (details left, tracklist right), sourced from the new `ReleaseTracklistSection`
- [X] T011 [P] [US2] Update `frontend/tests/integration/addRecordFlow.test.tsx`: update tracklist assertions to match its new placement via the extracted section component
- [X] T012 [US2] Extend `e2e/tests/release-preview-gallery.spec.ts`: assert that on a desktop-width viewport, key details render in the left column and the tracklist renders in the right column, side by side below the gallery

### Implementation for User Story 2

- [X] T013 [P] [US2] Create `frontend/src/components/ReleaseTracklistSection.tsx`: extract the tracklist rendering currently inlined in `ReleasePreviewModal.tsx` into its own component taking `{ tracklist: Track[] }`; return `null` when `tracklist.length === 0`
- [X] T014 [US2] Update `frontend/src/components/ReleasePreviewModal.tsx`: remove the inline tracklist JSX, render `<ReleaseTracklistSection tracklist={release.tracklist} />`, and restructure the row below the gallery into a two-column grid (`lg:grid-cols-2`) with `ReleaseDetailsSection` in the left column and `ReleaseTracklistSection` in the right column — neither column given a `max-h`/`overflow` bound, per FR-012 (depends on T007)
- [X] T015 [US2] Update the `release-preview-loading` skeleton branch in `frontend/src/components/ReleasePreviewModal.tsx`: add a second skeleton row with two column-shaped skeleton blocks (details / tracklist) beneath the gallery skeleton (depends on T008)

**Checkpoint**: Desktop now shows the full-width gallery, then a details/tracklist two-column row below it; all release data remains visible (notes/identifiers/community still render inside the details column for now).

---

## Phase 5: User Story 3 - Review remaining release information last (Priority: P3)

**Goal**: Notes, identifiers, and community stats render in their own full-width section below the details/tracklist row, omitted entirely when absent.

**Independent Test**: Open the preview for a record with notes, identifiers, and community stats populated; confirm this content appears as the last section, below key details and tracklist. Confirm it disappears cleanly (no empty section) when the data is absent.

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T016 [P] [US3] Create `frontend/tests/unit/ReleaseAdditionalInfoSection.test.tsx`: assert it renders notes/identifiers/community when present, and renders nothing (`null`) when all three are absent/empty
- [X] T017 [P] [US3] Update `frontend/tests/unit/ReleaseDetailsSection.test.tsx`: remove assertions for notes, identifiers, and community stats (no longer rendered by this component); keep title/artist/meta-row assertions
- [X] T018 [P] [US3] Update `frontend/tests/unit/ReleasePreviewModal.test.tsx`: assert the additional-info section renders full width below the details/tracklist row, sourced from the new `ReleaseAdditionalInfoSection`
- [X] T019 [P] [US3] Update `frontend/tests/integration/addRecordFlow.test.tsx`: update notes/identifiers/community assertions to match their new placement in the full-width section below tracklist
- [X] T020 [US3] Extend `e2e/tests/release-preview-gallery.spec.ts`: assert notes/identifiers/community content renders as the last section, below the details/tracklist row

### Implementation for User Story 3

- [X] T021 [P] [US3] Create `frontend/src/components/ReleaseAdditionalInfoSection.tsx`: extract the notes/identifiers/community rendering currently at the tail of `ReleaseDetailsSection.tsx` into its own component taking `{ notes?: string; identifiers: ReleaseIdentifier[]; community?: CommunityStats }`; return `null` when all three are absent/empty
- [X] T022 [US3] Update `frontend/src/components/ReleaseDetailsSection.tsx`: remove the notes/identifiers/community blocks (now owned by `ReleaseAdditionalInfoSection`), keeping only title/artists/meta-row
- [X] T023 [US3] Update `frontend/src/components/ReleasePreviewModal.tsx`: render `<ReleaseAdditionalInfoSection ... />` as a full-width row below the details/tracklist row (depends on T014)
- [X] T024 [US3] Update the `release-preview-loading` skeleton branch in `frontend/src/components/ReleasePreviewModal.tsx`: add a third, full-width skeleton block for the additional-info section (depends on T015)

**Checkpoint**: Full 4-section desktop layout complete — gallery, details | tracklist, additional info — with no information loss relative to the pre-redesign preview.

---

## Phase 6: User Story 4 - Consistent reading order on mobile (Priority: P2)

**Goal**: On narrow viewports, sections stack in the order: gallery, key details, tracklist, remaining information.

**Independent Test**: Open the preview on a narrow (mobile-width) viewport for a record with full data; confirm sections stack top to bottom in that exact order, and confirm resizing across the breakpoint reflows correctly with no duplicated or missing sections.

> **Note on sequencing**: Although this story is P2, it is sequenced after the P3 User Story 3 because verifying the full stacking order requires all four sections (including the additional-info section added in US3) to exist. See Dependencies below.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL before implementation — if the source order established in US1–US3 already satisfies them, that is an acceptable immediate pass; proceed to T028 to confirm rather than force an artificial red state)

- [X] T025 [P] [US4] Update `frontend/tests/unit/ReleasePreviewModal.test.tsx`: assert the DOM order of the four sections is gallery → details → tracklist → additional-info, independent of viewport size
- [X] T026 [US4] Add a mobile-viewport test in `e2e/tests/release-preview-gallery.spec.ts` (e.g. via `test.use({ viewport: ... })` or a dedicated mobile test) verifying the four sections appear top-to-bottom in the order: gallery, key details, tracklist, additional info
- [X] T027 [US4] Add a viewport-resize test in `e2e/tests/release-preview-gallery.spec.ts` that resizes from a desktop width to a mobile width while the preview is open, asserting the content reflows to single-column order with no duplicated or missing sections

### Implementation for User Story 4

- [X] T028 [US4] Verify/adjust the grid classes in `frontend/src/components/ReleasePreviewModal.tsx` (introduced in T007/T014/T023) so narrow viewports collapse to a single column (`grid-cols-1`) preserving DOM source order gallery → details → tracklist → additional-info, with no `order-*` utility overriding that order

**Checkpoint**: Mobile stacking order verified correct end-to-end, alongside the existing desktop layout.

---

## Phase 7: User Story 5 - A modern, cohesive visual style (Priority: P3)

**Goal**: The preview's visual style is consistent with the rest of the app, and no scrollbar is ever visibly rendered anywhere in the preview — including the modal's own outer scroll container — without changing the shared `Modal` component's default behavior elsewhere.

**Independent Test**: Open several previews (with/without images, short/long tracklists, complete/incomplete metadata); confirm visual consistency with the app's design language and confirm no scrollbar is visibly rendered anywhere, even when the modal's own content overflows the viewport.

### Tests for User Story 5 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T029 [P] [US5] Update `frontend/tests/unit/ui/Modal.test.tsx` (assert default behavior is unaffected and a new opt-in `hideScrollbar` prop applies `.scrollbar-hidden` to the dialog) and `frontend/tests/unit/ReleasePreviewModal.test.tsx` (assert it renders `Modal` with `hideScrollbar` so the rendered dialog carries the `.scrollbar-hidden` utility class from T002)
- [X] T030 [US5] Extend `e2e/tests/release-preview-gallery.spec.ts`: open a record with a tracklist long enough to force the modal past viewport height, and assert the modal remains fully scrollable (all content reachable) while no scrollbar track/handle is visibly rendered anywhere in the preview

### Implementation for User Story 5

- [X] T031 [US5] Add an opt-in `hideScrollbar?: boolean` prop (default `false`) to `frontend/src/components/ui/Modal.tsx`, applying `.scrollbar-hidden` (T002) to its dialog wrapper and `Card` only when passed — every other call site is unaffected by default — then pass `hideScrollbar` from `frontend/src/components/ReleasePreviewModal.tsx` so the entire preview hides its scrollbar end-to-end per FR-008 (per [research.md](./research.md) decision 2, revised)
- [X] T032 [P] [US5] Visual polish pass across `frontend/src/components/ReleasePreviewModal.tsx`, `ReleaseImageGallery.tsx`, `ReleaseDetailsSection.tsx`, `ReleaseTracklistSection.tsx`, and `ReleaseAdditionalInfoSection.tsx`: consistent spacing (`gap-4`/`gap-6`/`p-6`), `font-semibold` section headings, soft shadow/border treatment per the Constitution's "Visual lightness" rule, and confirmed `dark:` variants on every new/changed element

**Checkpoint**: Full redesign visually polished; no scrollbar visible anywhere in the preview, in either theme.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene required by the project constitution for any `frontend` change

- [X] T033 [P] Add a `frontend/CHANGELOG.md` entry under a new dated version heading (`Changed` category, Keep a Changelog format) describing the release preview layout redesign
- [X] T034 Bump the `version` field in `frontend/package.json` (MINOR bump, per Principle VI — a backward-compatible UI enhancement) to match the new `frontend/CHANGELOG.md` entry from T033
- [X] T035 Run the [quickstart.md](./quickstart.md) validation: `frontend` unit suite (135/135 passing), `oxlint` (clean), `tsc -b --noEmit` (clean). The `e2e` run in this sandbox could not validate any sign-in-gated flow, including the new release-preview assertions: every failure (13/13, spanning `release-preview-gallery.spec.ts` and unrelated pre-existing specs like `sign-in.spec.ts`) fails identically inside the shared `signInAsFakeGoogleUser` helper ("could not complete the fake-account form in the emulator popup") before reaching any test-specific assertion — a pre-existing environment/sandbox limitation with the Firebase Auth emulator popup, not a defect introduced by this feature. `npx playwright test --list` confirms all 8 new/updated specs parse and register correctly. Flagged to the user for a clean-environment/CI re-run.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the hidden-scrollbar utility is used by US1 and US5)
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; its grid restructuring builds on US1's T007
- **User Story 3 (Phase 5)**: Depends on Foundational; builds on US2's T014 (two-column row must exist before adding the row beneath it)
- **User Story 4 (Phase 6)**: Depends on US1 + US2 + US3 all being complete — verifying full stacking order requires all four sections to exist, even though this story is P2 (see note in Phase 6)
- **User Story 5 (Phase 7)**: Depends on US1–US4 being complete — the modal-wide scrollbar hiding and visual polish pass touch every section added by the prior stories
- **Polish (Phase 8)**: Depends on all user stories being complete

### Within Each User Story

- Tests MUST be written and confirmed to FAIL before implementation (Principle I)
- New section components before the `ReleasePreviewModal` wiring that consumes them
- Skeleton updates follow the corresponding layout change in the same story

### Parallel Opportunities

- T003 and T004 (US1 tests, different files) can run in parallel
- T009, T010, T011 (US2 tests, different files) can run in parallel
- T016, T017, T018, T019 (US3 tests, different files) can run in parallel
- T013 (new component) has no dependency on T009–T012 completing and can be authored in parallel with them, though it should only be considered "done" once its test (T009) fails-then-passes
- T032 (visual polish) touches multiple files but is a single cohesive pass — kept as one task rather than split, per Simplicity/YAGNI

---

## Parallel Example: User Story 2

```bash
# Launch all independent test-file updates for User Story 2 together:
Task: "Create frontend/tests/unit/ReleaseTracklistSection.test.tsx"
Task: "Update frontend/tests/unit/ReleasePreviewModal.test.tsx for two-column details/tracklist row"
Task: "Update frontend/tests/integration/addRecordFlow.test.tsx for tracklist's new placement"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (hidden-scrollbar utility)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm the gallery is full-width, square, and its thumbnail strip has no visible scrollbar — independently of the rest of the preview
5. Demo if ready — the modal already looks meaningfully improved even before US2–US5 land

### Incremental Delivery

1. Setup + Foundational → baseline established
2. US1 → full-width square gallery (MVP) → validate → demo
3. US2 → details/tracklist two-column row → validate → demo
4. US3 → additional-info full-width footer → validate → demo (all 4 sections now present)
5. US4 → mobile stacking order confirmed across all 4 sections → validate
6. US5 → modal-wide hidden scrollbar + visual polish → validate → demo
7. Polish (Phase 8) → changelog, version bump, final quickstart run

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [Story] label maps each task to its user story for traceability
- Verify each story's tests fail before implementing, per Principle I
- Commit after each task or logical group (Conventional Commits format, per the Constitution's Development Workflow gate)
- Stop at any checkpoint to validate a story independently
- US4 and US5 are sequenced by structural dependency (all sections must exist first) rather than strict priority order — flagged explicitly above rather than silently reordered
