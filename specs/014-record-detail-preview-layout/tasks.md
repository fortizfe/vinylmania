---

description: "Task list template for feature implementation"
---

# Tasks: Record Detail View Aligned with Preview Layout

**Input**: Design documents from `/specs/014-record-detail-preview-layout/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — the project constitution mandates Test-First (Principle I, NON-NEGOTIABLE): a failing test must exist before implementation code is written, for every story.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Web application structure (existing repo): `frontend/src/`, `frontend/tests/`, `e2e/tests/`. This feature does not touch `backend/`.

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before changing any layout code

- [X] T001 Run the existing suites (`cd frontend && npm test`, and `cd e2e && npm test`) to confirm they pass cleanly on the current `main` before starting the redesign, establishing the pre-change baseline required by Principle I — frontend unit suite 135/135 passing; e2e suite listed cleanly (14 tests, 7 files), full browser run deferred to final validation (T021) per environment constraints noted in 013's prior run

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared component change required before the "key release details" section can satisfy this feature's requirements (and reused by the existing release preview)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests ⚠️ (write first, confirm they FAIL before implementation)

- [X] T002 [P] Update `frontend/tests/unit/ReleaseDetailsSection.test.tsx`: add assertions that `release.formats` renders as badges (single format, and multiple formats each with their own descriptors), and that the existing "omits the meta row when the release has none of that data" case now also requires `formats` to be empty

### Implementation

- [X] T003 Update `frontend/src/components/ReleaseDetailsSection.tsx`: render `release.formats` as `Badge`s using the same join logic `DiscInfoCard` used (`name` alone, or `name (descriptions.join(', '))` when descriptions are present), and extend the existing `hasMetaRow` guard to also check `formats.length > 0`, per [research.md](./research.md) Decision 2 (depends on T002 failing first)

**Checkpoint**: The shared key-details component now includes `format`, matching what the detail page shows today (no information loss per SC-005) and improving the existing release preview as a side effect — confirm `cd frontend && npm test` is still green before continuing.

---

## Phase 3: User Story 1 - Recognize the detail view as the same design language as the preview (Priority: P1) 🎯 MVP

**Goal**: `RecordDetailPage` renders using the same section components and single-bordered-surface structure as the release preview: full-width square gallery with browsable thumbnails, key release details (including format) and tracklist in a two-column row below it, and remaining release information (notes, identifiers, community stats) in a full-width section after that.

**Independent Test**: Open a record's detail page and compare it structurally to the release preview: gallery full width and square, key details (title, artist, format, genres, styles, date, label) in the left column, tracklist in the right column, additional info below, all inside one shared bordered container instead of several separate cards.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T004 [P] [US1] Rewrite the "renders the four blocks in a responsive grid" test in `frontend/tests/integration/recordDetailFlow.test.tsx` to assert the new structure: a single shared bordered container (e.g. `data-testid="record-detail-content"`) wraps everything; the gallery (`data-testid="record-detail-gallery"`) spans the full width (`lg:col-span-2`); a nested two-column grid (`lg:grid-cols-2`) contains key details (`data-testid="record-detail-details"`) on the left and tracklist (`data-testid="record-detail-tracklist"`) on the right; additional info (`data-testid="record-detail-additional-info"`) spans full width below; and DOM source order is gallery → details → tracklist → additional-info; also assert no individual section wrapper (details, tracklist, additional-info) carries its own `rounded-xl border` card styling — only the single outer container does
- [X] T005 [P] [US1] Update the "shows every credited artist, format descriptor, and genre when there is more than one" test in `frontend/tests/integration/recordDetailFlow.test.tsx` to also assert release date, country, label, and styles render when present (now sourced from `ReleaseDetailsSection` instead of the deleted `DiscInfoCard`)
- [X] T006 [US1] Add a desktop-viewport layout assertion to `e2e/tests/record-detail-inline-edit.spec.ts` (or a new sibling spec `e2e/tests/record-detail-layout.spec.ts`): with a faked library entry that includes notes, identifiers, community stats, and multiple formats/genres/styles, assert the gallery renders full width, key details (including format) render in the left column, the tracklist renders in the right column, and the additional-info section renders below

### Implementation for User Story 1

- [X] T007 [US1] Rewrite `frontend/src/pages/RecordDetailPage.tsx`: replace `RecordHeaderImage`, `DiscInfoCard`, and `TracklistCard` with `ReleaseImageGallery`, `ReleaseDetailsSection`, `ReleaseTracklistSection`, and add `ReleaseAdditionalInfoSection`, composed inside one outer `<Card>` using the same grid structure as `ReleasePreviewModal` (gallery wrapped with `lg:col-span-2`; a nested `grid grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2` for details/tracklist; additional-info wrapped with `lg:col-span-2`); keep the existing "Your copy" JSX inline for now (not yet extracted — that is Phase 4), positioned directly after `ReleaseDetailsSection` in the left column, so existing inline-edit/removal tests keep passing throughout this rewrite
- [X] T008 [US1] Update `frontend/src/components/RecordDetailSkeleton.tsx`: reshape it to mirror the new structure inside a single `<Card>` — a full-width square gallery skeleton, a two-column skeleton row (key-details skeleton plus a my-copy skeleton placeholder on the left, tracklist skeleton on the right), and a full-width additional-info skeleton block — matching `ReleasePreviewModal`'s loading-branch proportions so no layout shift occurs between loading and loaded states
- [X] T009 [P] [US1] Delete `frontend/src/components/RecordHeaderImage.tsx`, `frontend/src/components/DiscInfoCard.tsx`, `frontend/src/components/TracklistCard.tsx`, and their test files `frontend/tests/unit/RecordHeaderImage.test.tsx`, `frontend/tests/unit/DiscInfoCard.test.tsx`, `frontend/tests/unit/TracklistCard.test.tsx` — all now superseded by the reused preview section components (depends on T007)

**Checkpoint**: The detail page structurally and visually matches the release preview (gallery, key details incl. format, tracklist, additional info, single shared bordered container) — independently verifiable even before the my-copy extraction in Phase 4.

---

## Phase 4: User Story 2 - Find my copy's condition and notes right below the key details (Priority: P1)

**Goal**: The "Your copy" block (condition and notes, inline-editable) is extracted into its own `MyCopySection` component and rendered directly below the key release details in the left column, with all existing inline-edit behavior (autosave, Escape-to-cancel, save confirmation, editable affordance) and the "remove from library" action preserved unchanged.

**Independent Test**: Open the detail page on a wide viewport; confirm "Your copy" appears directly below key details in the left column as a plain section (no card border of its own); click/tap the condition value and confirm it edits, autosaves on blur, and shows a save confirmation; edit notes and press Escape to confirm the change is discarded; confirm "Remove from library" still works.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T010 [P] [US2] Create `frontend/tests/unit/MyCopySection.test.tsx`: unit-test the new component in isolation — renders condition/notes read-mode text (with placeholders when both are absent), condition editing shows the fixed `<select>` options, notes editing shows a `<textarea>`, confirming an edit calls the corresponding `onSaveCondition`/`onSaveNotes` prop, Escape cancels without calling save, and clicking "Remove from library" calls `onRemove`

### Implementation for User Story 2

- [X] T011 [US2] Create `frontend/src/components/MyCopySection.tsx`: extract the condition/notes `InlineEditableField`s and the "Remove from library" `Button` currently inlined in `RecordDetailPage.tsx` into this component, accepting `{ condition?: string; notes?: string; onSaveCondition: (value: string) => Promise<void>; onSaveNotes: (value: string) => Promise<void>; onRemove: () => void }`, preserving the existing field-coordination behavior (activating one field commits the other via its `InlineEditableFieldHandle`) internally, and rendering as a plain section with no independent card border (depends on T010 failing first)
- [X] T012 [US2] Update `frontend/src/pages/RecordDetailPage.tsx`: replace the inline "Your copy" JSX (kept temporarily in T007) with `<MyCopySection condition={entry.condition} notes={entry.notes} onSaveCondition={saveCondition} onSaveNotes={saveNotes} onRemove={handleRemove} />`, rendered directly after `ReleaseDetailsSection` in the left column (depends on T007, T011)

**Checkpoint**: My Copy is now its own independently-tested component, positioned directly below key details, with every existing inline-edit and removal behavior intact — confirm the pre-existing `recordDetailFlow.test.tsx` tests for inline editing ("edits condition inline...", "edits notes inline...", "resolves the condition field before activating...") and removal ("removes the record after confirmation...", "does not remove...") still pass unchanged against the extracted component. User Stories 1 and 2 together deliver the full P1 slice, matching the spec's note that they must ship together.

---

## Phase 5: User Story 3 - Consistent reading order on mobile (Priority: P2)

**Goal**: On narrow viewports, sections stack in the order: gallery, key details, my copy, tracklist, remaining release information.

**Independent Test**: Open the detail page on a narrow (mobile-width) viewport for a record with full data; confirm sections stack top to bottom in that exact order; resize across the layout breakpoint and confirm the content reflows correctly with no duplicated or missing sections.

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL before implementation — if the DOM order established in Phases 3–4 already satisfies this, that is an acceptable immediate pass; proceed to T015 to confirm rather than force an artificial red state)

- [X] T013 [P] [US3] Update `frontend/tests/integration/recordDetailFlow.test.tsx`: assert the full DOM source order is gallery → key details → my copy → tracklist → additional info (extending the existing partial-order assertion from T004 to include additional info)
- [X] T014 [US3] Add a mobile-viewport test to `e2e/tests/record-detail-inline-edit.spec.ts` (or the layout spec from T006) verifying the sections appear top-to-bottom in that order on a narrow viewport, plus a resize test that crosses the layout breakpoint while the page is open, asserting the content reflows to single-column order with no duplicated or missing sections

### Implementation for User Story 3

- [X] T015 [US3] Verify/adjust the grid classes in `frontend/src/pages/RecordDetailPage.tsx` (introduced in T007/T012) so narrow viewports collapse to a single column (`grid-cols-1`) while preserving DOM source order gallery → details → my copy → tracklist → additional-info, with no `order-*` utility overriding that order

**Checkpoint**: Mobile stacking order verified correct end-to-end, alongside the existing desktop two-column layout.

---

## Phase 6: User Story 4 - Graceful handling of missing or unavailable catalog data (Priority: P3)

**Goal**: A library entry whose catalog details are unavailable still shows an explanatory message plus an editable My Copy section; a record missing optional key-detail fields or a tracklist degrades gracefully without empty placeholders or errors.

**Independent Test**: Open the detail page for a library entry with `catalogStatus: 'unavailable'`; confirm the explanatory message renders and My Copy (condition/notes) still renders and remains editable. Open a record missing optional fields (no label, no styles, no format) and no tracklist; confirm the layout omits those pieces cleanly.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL before implementation)

- [X] T016 [P] [US4] Confirm/update the existing `catalogStatus: 'unavailable'` fallback test in `frontend/tests/integration/recordDetailFlow.test.tsx` to assert `MyCopySection` (condition/notes, editable) still renders alongside the explanatory message, without the gallery/key-details/tracklist/additional-info sections
- [X] T017 [P] [US4] Add a test to `frontend/tests/integration/recordDetailFlow.test.tsx` for a record missing optional key-detail fields (no label, no styles, no format) and with an empty tracklist: confirm the key-details meta row and tracklist section are omitted cleanly (no empty headings or placeholder gaps), while title/artist and My Copy still render

### Implementation for User Story 4

- [X] T018 [US4] Update `frontend/src/pages/RecordDetailPage.tsx`: confirm/adjust the existing `entry.catalogStatus === 'unavailable' || !entry.release` early-return branch to render the explanatory message plus `<MyCopySection ... />` (using the component from T011) instead of the old inline "Your copy" block, styled consistently with the rest of the page (depends on T012)

**Checkpoint**: All four user stories independently verified; the redesigned detail page is functionally and visually complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Release hygiene required by the project constitution for any `frontend` change

- [X] T019 [P] Add a `frontend/CHANGELOG.md` entry under a new dated version heading (`Changed` category, Keep a Changelog format) describing the record detail view redesign: same layout as the release preview (single bordered container, full-width gallery, key details with the new format field, tracklist, additional info), with My Copy extracted into its own component directly below key details
- [X] T020 Bump the `version` field in `frontend/package.json` (MINOR bump, per Principle VI — a backward-compatible UI enhancement) to match the new `frontend/CHANGELOG.md` entry from T019
- [X] T021 Run the [quickstart.md](./quickstart.md) validation: `frontend` unit suite (136/136 passing), `oxlint` (clean, one pre-existing unrelated warning in `AuthContext.tsx`), `tsc -b --noEmit` (clean). The full `e2e` run (17 tests, 7 files) shows 16 failures, but every single one — including the 4 new/updated record-detail specs and all pre-existing specs like `sign-in.spec.ts`/`release-preview-gallery.spec.ts` — fails identically inside the shared `signInAsFakeGoogleUser` helper ("could not complete the fake-account form in the emulator popup") before reaching any test-specific assertion; this is the same pre-existing Firebase Auth emulator popup limitation documented in 013's `tasks.md` T035, not a defect introduced by this feature. `npx playwright test --list` confirms all specs (including the 4 new/updated ones) parse and register correctly. Flagged to the user for a clean-environment/CI re-run.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the `format` field is part of the key-details set every later phase renders)
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational and on US1's `RecordDetailPage` rewrite (T007) existing to extract `MyCopySection` from
- **User Story 3 (Phase 5)**: Depends on US1 + US2 both being complete — verifying the full stacking order requires the my-copy section to already be in its final position (per spec's own dependency note)
- **User Story 4 (Phase 6)**: Depends on US2 (T011/T012) — the catalog-unavailable fallback renders `MyCopySection`, so that component must exist first
- **Polish (Phase 7)**: Depends on all user stories being complete

### Within Each User Story

- Tests MUST be written and confirmed to FAIL before implementation (Principle I)
- The page-level rewrite (US1) precedes the my-copy extraction (US2), which precedes the mobile-order and edge-case verification (US3/US4)
- Skeleton updates (T008) follow the corresponding layout change in the same story (T007)

### Parallel Opportunities

- T002 (Foundational test) has no dependency on other Foundational work and can be authored independently, though it should only be considered "done" once it fails, then passes after T003
- T004 and T005 (US1 tests, same file but independent assertions) can be drafted in parallel and merged; T006 (e2e, different file) can run in parallel with both
- T009 (delete old components/tests) can run in parallel with T008 (skeleton reshape) once T007 lands, since they touch disjoint files
- T016 and T017 (US4 tests, same file but independent scenarios) can be drafted in parallel

---

## Parallel Example: User Story 1

```bash
# Launch independent test-file work for User Story 1 together:
Task: "Rewrite the responsive-grid test in frontend/tests/integration/recordDetailFlow.test.tsx for the new 5-section structure"
Task: "Update the format/genre assertions test in frontend/tests/integration/recordDetailFlow.test.tsx"
Task: "Add a desktop layout e2e assertion in e2e/tests/record-detail-inline-edit.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — they ship together)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (format field on `ReleaseDetailsSection`)
3. Complete Phase 3: User Story 1 (layout/structure parity with the preview)
4. Complete Phase 4: User Story 2 (my-copy extraction, positioned under key details)
5. **STOP and VALIDATE**: Confirm the detail page matches the preview's structure and every existing inline-edit/removal behavior still works
6. Demo if ready — this is the requester's core ask (same design as the preview, my-copy below key details)

### Incremental Delivery

1. Setup + Foundational → baseline established, shared component ready
2. US1 → layout/structure parity (gallery, key details incl. format, tracklist, additional info, single card) → validate
3. US2 → my-copy extracted and positioned correctly, behavior unchanged → validate → demo (MVP complete)
4. US3 → mobile stacking order confirmed across all sections → validate
5. US4 → catalog-unavailable and missing-field edge cases confirmed → validate
6. Polish (Phase 7) → changelog, version bump, final quickstart run

---

## Notes

- [P] tasks = different files, no dependencies on each other (or independent assertions within a shared file, called out explicitly above)
- [Story] label maps each task to its user story for traceability
- Verify each story's tests fail before implementing, per Principle I
- Commit after each task or logical group (Conventional Commits format, per the Constitution's Development Workflow gate)
- Stop at any checkpoint to validate a story independently
- US1 and US2 are both P1 and sequenced together by design (per spec.md's own "ship together" note); US3 and US4 are sequenced by structural dependency (my-copy must exist and be positioned first) rather than being blocked on anything unrelated to this feature
