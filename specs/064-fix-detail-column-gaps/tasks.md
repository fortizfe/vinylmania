# Tasks: Corregir huecos entre tarjetas en el layout de dos columnas del detalle de release

**Input**: Design documents from `/specs/064-fix-detail-column-gaps/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/DetailColumns.contract.md, quickstart.md

**Tests**: Included — Constitution Principle I (Test-First) is non-negotiable, and the "e2e coverage gate" requires Playwright coverage for any `/frontend` change.

**Organization**: The spec defines a single user story (US1, P1). There is no Setup phase — this is a layout fix inside the existing, already-scaffolded frontend app; no new dependencies, tooling, or project structure are introduced.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared `DetailColumns` layout component that every page in US1 depends on, and remove the now-dead `CARD_SPAN` class it makes obsolete.

**⚠️ CRITICAL**: No page migration (Phase 2) can begin until T002 is complete.

- [X] T001 [P] Write a failing unit test for the new layout component in `frontend/tests/unit/DetailColumns.test.tsx`: asserts the outer element is `grid grid-cols-1 items-start gap-4 lg:grid-cols-2`; asserts exactly two direct children, each `flex flex-col gap-4`; asserts `left` content renders inside the first child and `right` content inside the second; asserts neither wrapper (nor the outer grid) carries any `col-span` class (per contracts/DetailColumns.contract.md).
- [X] T002 Implement `DetailColumns` in `frontend/src/components/DetailColumns.tsx` (`{ left: ReactNode; right: ReactNode }` props) to make T001 pass.
- [X] T003 [P] Remove the dead `CARD_SPAN = 'lg:col-span-2'` constant, its `clsx(CARD_SPAN, RESERVED_HEIGHT)` usage, and its now-inaccurate explanatory comment from `frontend/src/components/StreamingLinksSection.tsx` (research.md Decision 6); keep `RESERVED_HEIGHT` unchanged.

**Checkpoint**: `DetailColumns` exists and is unit-tested; `StreamingLinksSection` no longer references a layout it's no longer a direct child of. Page migrations can start.

---

## Phase 2: User Story 1 - Ver el detalle de una release sin huecos visuales (Priority: P1) 🎯 MVP

**Goal**: Every detail surface (search result, library, wishlist, master release) renders its cards in two independent, gap-free columns — no stretching, no shared full-width row waiting on both columns.

**Independent Test**: Open the detail of a release with a short "Your Copy"/wantlist state and a long tracklist at ≥1024px width; confirm no gap appears within either column despite the large height difference between columns (see quickstart.md §2).

### Tests for User Story 1 (write/update FIRST — confirm they FAIL against the current code before touching any page) ⚠️

- [X] T004 [P] [US1] Update the structural assertions in `frontend/tests/integration/recordDetailFlow.test.tsx` (the `'renders the gallery, key details, tracklist, and additional info...'` test, ~lines 390-425): gallery/tracklist/other-details now share one left-column wrapper (`flex flex-col gap-4`), main-info/your-copy share one right-column wrapper, neither wrapper (nor any card) carries a `col-span` class, and the DOM order becomes gallery → tracklist → other-details → main-info → your-copy (contracts/DetailColumns.contract.md).
- [X] T005 [P] [US1] Rewrite the desktop composition assertions in `e2e/tests/record-detail-responsive.spec.ts` (`checkComposition`, ~lines 93-103): replace `tracklistBox!.y > yourCopyBox!.y` (asserts the old shared-row bug) with assertions that tracklist/other-details share the gallery card's `x` position and stack strictly below it, independent of the right column's `y`/height; add a case where "Your Copy" has minimal content (no rating/media/sleeve/notes) and the tracklist is long, and the inverse, proving no gap appears within either column's own stack in both directions (research.md Decision 8, quickstart.md §2).
- [X] T006 [P] [US1] Update the mobile order assertions in `e2e/tests/record-detail-responsive.spec.ts` (`'mobile: single column...'` test, ~lines 188-193) to the new unified order: gallery → tracklist → other-details → main-info → your-copy.
- [X] T007 [P] [US1] Rewrite the desktop composition assertions in `e2e/tests/release-detail-responsive.spec.ts` (`checkComposition`, ~lines 76-81): replace `tracklistBox!.y > detailsBox!.y` with an assertion that tracklist/other-details share the gallery card's `x` and stack below it independent of the main-info (and, when present, WantlistPanel) column's height; add the same short/long uneven-height regression case as T005.
- [X] T008 [P] [US1] Add a mobile order assertion to the existing `'mobile: single column...'` test in `e2e/tests/release-detail-responsive.spec.ts` confirming the new unified order: gallery → tracklist → other-details → main-info.
- [X] T009 [P] [US1] Rewrite the desktop composition assertions in `e2e/tests/master-release-detail-responsive.spec.ts` (`checkComposition`, ~lines 93-103): replace `tracklistBox!.y > otherDetailsBox!.y` (which compares across columns) with an assertion that tracklist/versions-table share the gallery card's `x` and stack below it independent of the main-info/other-details column's height; add the same uneven-height regression case as T005.
- [X] T010 [P] [US1] Add a mobile order assertion to the `'mobile: no horizontal scroll in the versions area...'` test in `e2e/tests/master-release-detail-responsive.spec.ts` confirming the new unified order: gallery → tracklist → versions → main-info → other-details.

### Implementation for User Story 1

- [X] T011 [P] [US1] Migrate `frontend/src/pages/RecordDetailPage.tsx` to render `<DetailColumns left={...} right={...} />`: `left` = Gallery card, Tracklist card, Additional-info card (conditional on `hasOtherDetails`); `right` = Main-info card, Your-copy card, `StreamingLinksSection` (contracts/DetailColumns.contract.md table). Depends on T002.
- [X] T012 [P] [US1] Migrate `frontend/src/pages/ReleaseDetailPage.tsx` to render `<DetailColumns left={...} right={...} />`: `left` = Gallery card, Tracklist card, Additional-info card (conditional on `hasOtherDetails`); `right` = Main-info card (with its Add-to-library/Add-to-wishlist buttons and status messages), WantlistPanel card (conditional on an existing wantlist entry), `StreamingLinksSection`. Depends on T002.
- [X] T013 [P] [US1] Migrate `frontend/src/pages/MasterReleaseDetailPage.tsx` to render `<DetailColumns left={...} right={...} />`: `left` = Gallery card, Tracklist card, Versions-table card; `right` = Main-info card, Other-details card (conditional on `masterHasOtherDetails`), `StreamingLinksSection`. Depends on T002.
- [X] T014 [US1] Run `cd frontend && npm run test -- DetailColumns recordDetailFlow ReleaseDetailPage MasterReleaseDetailPage StreamingLinksSection` and fix any remaining failures until T001/T004 (and all pre-existing tests in the touched files) pass.
- [X] T015 [US1] Run `cd e2e && npx playwright test record-detail-responsive release-detail-responsive master-release-detail-responsive` and fix any remaining failures until T005-T010 (and every pre-existing test in these three files, including the WCAG 2.1 AA scans) pass.

**Checkpoint**: All four detail surfaces (search, library, wishlist, master release) render gap-free, independently-stacked columns; the single-column layout keeps its mechanics and usability with the new unified card order. This is the entire feature — there is no further phase.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS Phase 2 entirely (every page migration needs `DetailColumns`).
- **User Story 1 (Phase 2)**: Depends on Phase 1 completion (specifically T002).

### Within Phase 2

- Tests (T004-T010) MUST be written/updated and confirmed failing before the implementation tasks (T011-T013).
- T011, T012, T013 touch different files and each depends only on T002 — they can run in parallel.
- T014 depends on T002, T003, T004, T011, T012, T013 (all frontend unit/integration work).
- T015 depends on T011, T012, T013 and on T005-T010 (all e2e work).

### Parallel Opportunities

- T001 and T003 (Phase 1) — different files, no shared dependency.
- T004 through T010 (all seven test-authoring tasks) — different files, can all run in parallel once Phase 1 is complete.
- T011, T012, T013 (page migrations) — different files, can all run in parallel once T002 is complete.

---

## Parallel Example: Phase 2 tests

```bash
Task: "Update structural assertions in frontend/tests/integration/recordDetailFlow.test.tsx"
Task: "Rewrite desktop composition assertions in e2e/tests/record-detail-responsive.spec.ts"
Task: "Update mobile order assertions in e2e/tests/record-detail-responsive.spec.ts"
Task: "Rewrite desktop composition assertions in e2e/tests/release-detail-responsive.spec.ts"
Task: "Add mobile order assertion in e2e/tests/release-detail-responsive.spec.ts"
Task: "Rewrite desktop composition assertions in e2e/tests/master-release-detail-responsive.spec.ts"
Task: "Add mobile order assertion in e2e/tests/master-release-detail-responsive.spec.ts"
```

## Parallel Example: Phase 2 page migrations

```bash
Task: "Migrate frontend/src/pages/RecordDetailPage.tsx to <DetailColumns>"
Task: "Migrate frontend/src/pages/ReleaseDetailPage.tsx to <DetailColumns>"
Task: "Migrate frontend/src/pages/MasterReleaseDetailPage.tsx to <DetailColumns>"
```

---

## Implementation Strategy

Since this feature has exactly one user story, there is no incremental
multi-story rollout: complete Phase 1, then Phase 2 in full, then validate
with `specs/064-fix-detail-column-gaps/quickstart.md` (both the automated
commands in §1 and the manual repro steps in §2) before opening a PR. Call
out the intentional single-column card-order change explicitly in the PR
description (Constitution Principle VI; research.md Decision 5) — it is a
deliberate, user-confirmed behavior change, not a regression.

## Notes

- [P] tasks = different files, no dependencies.
- Verify each test task's test actually fails against the current (pre-fix)
  code before starting the corresponding implementation task.
- Commit after each task or logical group.
