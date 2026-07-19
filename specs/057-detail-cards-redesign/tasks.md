# Tasks: Detail Screens Card-Based Redesign

**Input**: Design documents from `/specs/057-detail-cards-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included as mandatory, per constitution Principle I (Test-First, NON-NEGOTIABLE). Existing unit/integration/e2e tests for these three pages currently assert the *old* single-outer-card structure (e.g. `recordDetailFlow.test.tsx`'s "none of the individual sections gets its own independent border" assertion) and must be updated to assert the new structure *before* the page implementation changes, so they fail against the current markup and pass once each story's implementation lands.

**Organization**: Tasks are grouped by user story (US1 = library record detail, US2 = master release detail, US3 = catalog release preview), matching spec.md's priority order (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app structure per plan.md: `frontend/src/`, `frontend/tests/`, `e2e/tests/` at repository root. No `backend/` changes in this feature.

---

## Phase 1: Setup

**Purpose**: Confirm the pre-change baseline. No new dependencies, scaffolding, or shared components are needed — this feature reuses the existing `Card`, `Badge`, `Button`, `StarRating`, and `InlineEditableField` components unchanged (plan.md Constitution Check).

- [X] T001 On branch `057-detail-cards-redesign`, run `cd frontend && npm test` and confirm the current suite is green before making any code changes, establishing the baseline quickstart.md's automated validation compares against

---

## Phase 2: Foundational

**Purpose**: N/A — no cross-story blocking work exists for this feature. Each of the three pages below (`RecordDetailPage.tsx`, `MasterReleaseDetailPage.tsx`, `ReleaseDetailPage.tsx`) is modified independently, reusing existing, unchanged atomic components; none of the three user stories depends on a shared new component or data structure (data-model.md confirms no new entities). Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Scan a library record at a glance (Priority: P1) 🎯 MVP

**Goal**: Replace `RecordDetailPage`'s single bordered container with five lightly-separated cards — gallery, main info, "your copy," tracklist, and other details (omitted when empty) — while every existing interaction keeps working exactly as before.

**Independent Test**: Open a library record's detail page (`/app/library/records/:entryId`); verify the five cards render as distinct, lightly-bordered, tightly-spaced groups, and that rating, condition editing, notes editing, and remove-from-library all still work. `recordDetailFlow.test.tsx`, `record-detail-inline-edit.spec.ts`, and `record-detail-responsive.spec.ts` pass.

### Tests for User Story 1 ⚠️

> Write/update these FIRST; confirm they fail against the current single-card markup before touching `RecordDetailPage.tsx`.

- [X] T002 [P] [US1] In `frontend/tests/integration/recordDetailFlow.test.tsx`, update the "renders the gallery, key details, tracklist, and additional info in the same structure as the release preview" test (~line 357) and the "stacks gallery, key details, my copy, tracklist, and additional info in that DOM order" test (~line 474): replace the single `record-detail-content` wrapper assertions (grid on one shared bordered surface, sections with no independent border) with assertions for five separate `data-testid`s — `record-detail-gallery-card`, `record-detail-main-info-card`, `record-detail-your-copy-card`, `record-detail-tracklist-card`, `record-detail-other-details-card` — each carrying its own `rounded-xl`/`border` classes plus the `Card` component's dark-mode classes (`dark:border-border-dark`, `dark:bg-surface-raised`, satisfying FR-011; since all three redesigned pages reuse the same unchanged `Card` component, this one assertion is a representative regression guard for dark-theme legibility across all of them), no single outer wrapping card, and DOM order gallery → main info (containing your copy) → tracklist → other details
- [X] T003 [P] [US1] In `frontend/tests/integration/recordDetailFlow.test.tsx`, add a test asserting the `other-details` card (`record-detail-other-details-card`) is entirely absent from the DOM when the release has no `notes`, `identifiers`, or `community` data
- [X] T004 [P] [US1] In `e2e/tests/record-detail-inline-edit.spec.ts` (locators ~lines 154-250), update `page.getByTestId(...)` calls from `record-detail-gallery`/`record-detail-details`/`record-detail-tracklist`/`record-detail-additional-info` to the new per-card test IDs from T002, keeping all rating/condition/notes/remove interaction assertions unchanged
- [X] T005 [P] [US1] In `e2e/tests/record-detail-responsive.spec.ts` (locators ~lines 76-168), update the same testid locators to the new per-card test IDs, keeping mobile/desktop stacking assertions unchanged

### Implementation for User Story 1

- [X] T006 [US1] In `frontend/src/pages/RecordDetailPage.tsx`, replace the single outer `<Card>` wrapping `data-testid="record-detail-content"` with five sibling `<Card padding="sm">` elements laid out via a `grid grid-cols-1 items-start gap-4 lg:grid-cols-2` wrapper (tightened from the current `gap-6` to `gap-4` at all widths, per research.md Decision 1): gallery card (`ReleaseImageGallery`), main info card (`ReleaseDetailsSection`), your-copy card (`MyCopySection`), tracklist card (`ReleaseTracklistSection`, `lg:col-span-2`), other-details card (`ReleaseAdditionalInfoSection`, `lg:col-span-2`) — assign the new `data-testid`s from T002 (depends on T002-T005 existing as failing tests)
- [X] T007 [US1] In `RecordDetailPage.tsx`, only render the other-details `<Card>` when `ReleaseAdditionalInfoSection` would have content (reuse its existing `notes`/`identifiers`/`community` presence check, lifted into the page, so no empty card is ever rendered) — verify against T003
- [X] T008 [US1] Run `cd frontend && npm test -- recordDetailFlow` and `npx playwright test e2e/tests/record-detail-inline-edit.spec.ts e2e/tests/record-detail-responsive.spec.ts`; fix any failures until all pass — this also re-runs the untouched skeleton-loading and not-found-state tests already in `recordDetailFlow.test.tsx` (~lines 88, 124), confirming FR-013 (loading/error states unchanged) holds with no code path for them modified in this story

**Checkpoint**: User Story 1 is fully functional and independently testable/deployable — the MVP.

---

## Phase 4: User Story 2 - Browse a master release's card-based detail page (Priority: P2)

**Goal**: Apply the same card treatment to `MasterReleaseDetailPage` — gallery, main info (title/artist), other details (year/genres/styles + new "View on Discogs" link, omitted when empty), tracklist, and versions-list cards — and bring the versions list's mobile per-row cards into the same lighter visual style.

**Independent Test**: Open a master release detail page (`/app/masters/:discogsId`); verify five distinct cards render, the "View on Discogs" link opens the master's Discogs page, versions pagination still works, and mobile version rows match the new card style. `MasterReleaseDetailPage.test.tsx` and `master-release-detail-responsive.spec.ts` pass.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] In `e2e/tests/master-release-detail-responsive.spec.ts` (locators ~lines 74-143), update `page.getByTestId(...)` calls from `master-detail-gallery`/`master-detail-details`/`master-detail-tracklist`/`master-detail-versions` to new per-card test IDs `master-detail-gallery-card`, `master-detail-main-info-card`, `master-detail-other-details-card`, `master-detail-tracklist-card`, `master-detail-versions-card`
- [X] T010 [P] [US2] In `frontend/tests/unit/MasterReleaseDetailPage.test.tsx`, add assertions that: (a) a "View on Discogs" link renders with `href={master.discogsUrl}`, `target="_blank"`, `rel="noopener noreferrer"`; (b) the other-details card is entirely absent when `year`, `genres`, and `styles` are all empty (the Discogs link alone must not be treated as sufficient content to keep the card)

### Implementation for User Story 2

- [X] T011 [US2] In `frontend/src/components/MasterReleaseDetailsSection.tsx`, split rendering into two pieces: a main-info piece (title, artist only) and an other-details piece (year, genres, styles) plus a new "View on Discogs" link using `master.discogsUrl`, styled per the existing external-link convention in `frontend/src/components/FeedArticleCard.tsx` (`target="_blank"`, `rel="noopener noreferrer"`) — expose both pieces so `MasterReleaseDetailPage.tsx` can place them in separate cards (depends on T009-T010 existing as failing tests)
- [X] T012 [US2] In `frontend/src/pages/MasterReleaseDetailPage.tsx`, replace the single outer `<Card>` with five sibling `<Card padding="sm">` elements using the same `gap-4` wrapper as US1: gallery, main info, other details (rendered only when T011's other-details piece has content, per T010), tracklist (`lg:col-span-2`), versions list (`lg:col-span-2`) — assign the new testids from T009 (depends on T011)
- [X] T013 [P] [US2] In `frontend/src/components/MasterVersionsTable.tsx`, apply the same lighter `padding="sm"`/tightened-spacing treatment used elsewhere in this feature to the existing per-row `<Card>` elements in its mobile layout (research.md Decision 4); no change to pagination logic or the desktop `<table>` rendering
- [X] T014 [US2] Run `cd frontend && npm test -- MasterReleaseDetailPage` and `npx playwright test e2e/tests/master-release-detail-responsive.spec.ts`; fix any failures until all pass

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Preview a catalog release before adding it to the library (Priority: P3)

**Goal**: Apply the release-detail card template to `ReleaseDetailPage` (the pre-add catalog preview): gallery, main info (with "Add to library" action in place of a "your copy" card), tracklist, and other-details cards.

**Independent Test**: Open a catalog release not yet in the library (`/app/releases/:discogsId`); verify four cards render, no "your copy" card appears, "Add to library" works from inside the main info card. `ReleaseDetailPage.test.tsx`, `release-detail.spec.ts`, and `release-detail-responsive.spec.ts` pass.

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] In `e2e/tests/release-detail.spec.ts` (locators ~lines 161-249), update `page.getByTestId(...)` calls from `release-detail-gallery`/`release-detail-details`/`release-detail-tracklist`/`release-detail-additional-info` to new per-card test IDs `release-detail-gallery-card`, `release-detail-main-info-card`, `release-detail-tracklist-card`, `release-detail-other-details-card`
- [X] T016 [P] [US3] In `e2e/tests/release-detail-responsive.spec.ts` (locators ~lines 60-117), update the same testid locators to the new per-card test IDs

### Implementation for User Story 3

- [X] T017 [US3] In `frontend/src/pages/ReleaseDetailPage.tsx`, replace the single outer `<Card>` with four sibling `<Card padding="sm">` elements using the same `gap-4` wrapper: gallery, main info (`ReleaseDetailsSection` + the existing "Add to library" button/gate-error/add-error block), tracklist (`lg:col-span-2`), other details (`lg:col-span-2`, omitted when empty by duplicating the same inline presence-check pattern T007 adds to `RecordDetailPage.tsx` — no shared import between the two pages, keeping this story independent of US1's files) — assign new testids from T015-T016 (depends on T015-T016)
- [X] T018 [US3] Run `cd frontend && npm test -- ReleaseDetailPage` and `npx playwright test e2e/tests/release-detail.spec.ts e2e/tests/release-detail-responsive.spec.ts`; fix any failures until all pass

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite regression check and final design confirmation across all three pages together.

- [X] T019 [P] Run the full frontend suite (`cd frontend && npm test`) to confirm no regressions outside the three touched pages
- [X] T020 [P] Run the complete targeted e2e set: `npx playwright test e2e/tests/record-detail-inline-edit.spec.ts e2e/tests/record-detail-responsive.spec.ts e2e/tests/release-detail.spec.ts e2e/tests/release-detail-responsive.spec.ts e2e/tests/master-release-detail-responsive.spec.ts`
- [X] T021 Manually walk through quickstart.md's five validation scenarios (all three pages, mobile + desktop widths, light + dark theme, empty-data edge cases)
- [ ] T022 Design review checkpoint: confirm the final card look/spacing against spec SC-005 ("subtle, lightly separated") with the requester before closing out the feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first
- **Foundational (Phase 2)**: Empty — no blocking work
- **User Story 1 (Phase 3)**: Depends on Setup only — MVP, implement first
- **User Story 2 (Phase 4)**: Depends on Setup only — independent of US1's files (`MasterReleaseDetailPage.tsx` vs `RecordDetailPage.tsx`); can start any time after Setup, in parallel with US1 if staffed
- **User Story 3 (Phase 5)**: Depends on Setup only — independent of US1/US2's files (`ReleaseDetailPage.tsx`); can start any time after Setup
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests (T002-T005, T009-T010, T015-T016) MUST be written/updated and failing before their story's implementation tasks
- Component-level changes (T011) before page-level changes that consume them (T012)
- Story complete (its test-run task) before moving to the next priority, if working sequentially

### Parallel Opportunities

- T002, T003, T004, T005 (all different files) can run in parallel
- T009, T010 (different files) can run in parallel
- T013 (`MasterVersionsTable.tsx`) can run in parallel with T011/T012 (different file, no dependency)
- T015, T016 (different files) can run in parallel
- Once Setup (T001) is done, US1, US2, and US3 can be worked in parallel by different developers, since each touches a distinct page file
- T019, T020 (full suite vs. targeted e2e) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test-update tasks together:
Task: "Update DOM-structure assertions in frontend/tests/integration/recordDetailFlow.test.tsx"
Task: "Add empty-other-details-card test in frontend/tests/integration/recordDetailFlow.test.tsx"
Task: "Update testid locators in e2e/tests/record-detail-inline-edit.spec.ts"
Task: "Update testid locators in e2e/tests/record-detail-responsive.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002-T008)
3. **STOP and VALIDATE**: open a library record, confirm the five-card layout and all interactions work
4. Deploy/demo if ready — the library record detail page is the most-visited screen, so this alone delivers the core value

### Incremental Delivery

1. Setup → Foundation ready (nothing to build)
2. Add User Story 1 → validate → deploy/demo (MVP)
3. Add User Story 2 → validate → deploy/demo
4. Add User Story 3 → validate → deploy/demo
5. Phase 6 polish → final regression + design sign-off

### Parallel Team Strategy

With multiple developers, after T001:
- Developer A: User Story 1 (T002-T008)
- Developer B: User Story 2 (T009-T014)
- Developer C: User Story 3 (T015-T018)

Each story touches a distinct page file, so no merge conflicts are expected between stories.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are included per constitution Principle I (Test-First, NON-NEGOTIABLE) — write/update them first and confirm they fail against the current single-card markup
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- The "other details" empty-card omission check follows the same inline pattern in both T007 (US1) and T017 (US3) — duplicated per page, not shared via import, so the two stories stay independently buildable; US2 has its own equivalent check (T010/T012) since master release's other-details content differs (year/genres/styles vs. notes/identifiers/community)
