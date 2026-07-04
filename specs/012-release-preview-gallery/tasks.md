---

description: "Task list for Release Preview Popup — Full Details & Image Gallery"
---

# Tasks: Release Preview Popup — Full Details & Image Gallery

**Input**: Design documents from `/specs/012-release-preview-gallery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md

**Tests**: Included and REQUIRED. The project constitution's Principle I
(Test-First, NON-NEGOTIABLE) requires a failing test before implementation for
every feature/bug fix, and its e2e quality gate requires Playwright coverage
under `/e2e` for any change touching `/frontend`. Both apply here.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application split: `backend/` (Discogs model/mapper), `frontend/`
(popup redesign), `e2e/` (Playwright), per plan.md's Project Structure.

---

## Phase 1: Setup

**Purpose**: Confirm tooling/paths before writing new tests and components

- [X] T001 Run `cd backend && npm test` and `cd frontend && npm test`, noting
  the baseline pass counts before this feature's changes (no config change
  expected — both suites already cover `discogsMapper`/`ReleasePreviewModal`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Split the existing single-blob `ReleasePreviewModal` into named
block components (still single-column, still showing exactly today's
content) so User Stories 1–3 can each be implemented and tested
independently against a stable block boundary

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create a placeholder `frontend/src/components/ReleaseImageGallery.tsx`
  (props: `images: CatalogImage[]`, `alt: string`) that renders only the
  `imageType === 'primary'` image (falling back to `images[0]`) as an
  `aspect-square w-full object-cover` image — matching today's inline
  `release.images[0]` block in `ReleasePreviewModal.tsx` — plus the existing
  "No cover image available" placeholder pattern from
  `frontend/src/components/RecordHeaderImage.tsx` when `images` is empty (no
  thumbnails yet; that's added in US3)
- [X] T003 [P] Create a placeholder `frontend/src/components/ReleaseDetailsSection.tsx`
  (props: `release: Release`) that renders only today's title (`h3`) and
  per-artist paragraphs, matching current `ReleasePreviewModal.tsx` content
  exactly (no new fields yet; those are added in US1)
- [X] T004 Restructure `frontend/src/components/ReleasePreviewModal.tsx` to
  compose `ReleaseImageGallery`, `ReleaseDetailsSection`, and the existing
  tracklist block (unchanged), stacked in a single column in that order —
  loading skeleton and "couldn't load" error state remain unchanged for now
- [X] T005 Run `cd frontend && npm test` and confirm
  `frontend/tests/unit/ReleasePreviewModal.test.tsx` still passes against the
  restructured composition (update only what's needed to keep it green — no
  new assertions yet, those are added per-story below)

**Checkpoint**: Foundation ready — the popup renders the same content as
today, now split into two named block components; user story implementation
can now begin

---

## Phase 3: User Story 1 - See everything Discogs knows about a release before adding it (Priority: P1) 🎯 MVP

**Goal**: Widen the shared `Release` model with the Discogs fields the spec
scopes in (release date, notes, identifiers, community stats), and show all
of it — plus the already-modeled label/country/genres/styles that the popup
doesn't surface today — in a details section above the tracklist, omitting
whatever the release doesn't have.

**Independent Test**: Open the preview popup for a release with label,
country, release date, notes, and community data on Discogs, and confirm
every one of those fields appears above the tracklist; open one missing most
of that data and confirm only the present fields show, with no blank
placeholders.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T006 [P] [US1] Extend `backend/tests/unit/discogsMapper.test.ts`:
  `mapRelease` maps raw `released` → `releaseDate`, raw `notes` → `notes`,
  raw `identifiers[]` → `identifiers` (`type`/`value`/`description`), and raw
  `community.{have,want,rating.average,rating.count}` → `community`; a
  separate case confirms `releaseDate`/`notes`/`community` are omitted and
  `identifiers` defaults to `[]` when Discogs returns none of them
- [X] T007 [P] [US1] Extend `backend/tests/contract/discogsRelease.contract.test.ts`:
  add `released`, `notes`, `identifiers`, and `community` to the `rawRelease`
  fixture, and assert the widened fields appear in `res.body` via
  `toMatchObject`
- [X] T008 [P] [US1] Create `frontend/tests/unit/ReleaseDetailsSection.test.tsx`:
  renders label(s) + catalogue number, country, release date, genres,
  styles, notes, an identifiers list, and community stats (have/want,
  rating) when present on `release`; omits each field/section entirely (no
  blank label or placeholder) when its data is absent, per data-model.md's
  display-mapping table
- [X] T009 [P] [US1] Extend `frontend/tests/unit/ReleasePreviewModal.test.tsx`:
  add the new fields to the fixture `release` and assert the details content
  (e.g. label/catalogue number text) appears before the "Tracklist" heading
  in DOM order

### Implementation for User Story 1

- [X] T010 [US1] Add `ReleaseIdentifier` (`type: string`, `value: string`,
  `description?: string`) and `CommunityStats` (`have: number`, `want:
  number`, `rating: { average: number; count: number }`) interfaces to
  `backend/src/discogs/types.ts`, and add `releaseDate?: string`, `notes?:
  string`, `identifiers: ReleaseIdentifier[]`, `community?: CommunityStats`
  to the `Release` interface
- [X] T011 [US1] Extend `rawReleaseSchema` in
  `backend/src/discogs/discogsMapper.ts` with optional `released`, `notes`,
  `identifiers` (array of `{ type, value, description? }`), and `community`
  (`{ have, want, rating: { average, count } }`); update `mapRelease` to map
  them into the new `Release` fields, defaulting `identifiers` to `[]` and
  omitting the others when Discogs doesn't provide them — makes T006/T007
  pass
- [X] T012 [P] [US1] Mirror the exact same `ReleaseIdentifier`/
  `CommunityStats`/`Release` field additions from T010 in
  `frontend/src/services/libraryApi.ts`, matching the existing 1:1
  backend/frontend type-mirroring convention
- [X] T013 [US1] Implement `frontend/src/components/ReleaseDetailsSection.tsx`
  (extending the T003 placeholder) per data-model.md's display-mapping
  table: label(s) + catalogue number, country, release date, genres and
  styles (as `Badge` components, per the UI Design System), notes
  (paragraph), identifiers (list of `type: value`, plus `description` when
  present), and community stats (have/want counts, rating average of count)
  — each field/section omitted entirely when absent — makes T008 pass
- [X] T014 [US1] Confirm `frontend/src/components/ReleasePreviewModal.tsx`'s
  composition (from T004) places `ReleaseDetailsSection` immediately above
  the tracklist block — makes T009 pass
- [X] T015 [P] [US1] Add Playwright e2e spec
  `e2e/tests/release-preview-gallery.spec.ts`: search for a release, open its
  preview popup from the search result card, and assert the new details
  section (e.g. label/catalogue number or notes text) is visible above the
  tracklist — satisfying the constitution's `/frontend` e2e quality gate

**Checkpoint**: At this point, User Story 1 should be fully functional and
testable independently — the popup shows all available Discogs release
details above the tracklist, single-column, with today's one-image cover
still in place

---

## Phase 4: User Story 2 - Read the popup comfortably on any screen size (Priority: P2)

**Goal**: Make the popup reflow between a single stacked column (mobile
width) and two columns — image gallery in one, details + tracklist in the
other — at the same `lg:` breakpoint the record detail page (010) already
uses, widening the shared `Modal` to fit without affecting its other caller.

**Independent Test**: Open the popup at a desktop-width viewport and confirm
the gallery and details+tracklist split into two columns; narrow the
viewport to a typical mobile width and confirm everything stacks into one
column.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T016 [P] [US2] Extend `frontend/tests/unit/ui/Modal.test.tsx`:
  `size="lg"` renders a wider `max-w` class (e.g. `max-w-3xl`) than the
  `size="md"`/default case (`max-w-lg`, unchanged); confirm `position="end"`'s
  existing `h-dvh`/`max-w-xs` classes are unaffected regardless of `size`
  (regression guard for the additive-only requirement in research.md §5)
- [X] T017 [P] [US2] Extend `frontend/tests/unit/ReleasePreviewModal.test.tsx`:
  assert the popup's top-level content wrapper carries `grid-cols-1` and
  `lg:grid-cols-2` Tailwind classes, with `ReleaseImageGallery` and the
  details+tracklist column as its two children (jsdom can't compute actual
  breakpoints, so assert class presence, per 010's established pattern)

### Implementation for User Story 2

- [X] T018 [US2] Add an additive `size` prop (`'md' | 'lg'`, default `'md'`)
  to `frontend/src/components/ui/Modal.tsx` that only changes the
  `center`-position `max-w` class (`md` = today's `max-w-lg`, unchanged; `lg`
  = `max-w-3xl`); the `end` position's sizing stays untouched regardless of
  `size` — makes T016 pass
- [X] T019 [US2] Update `frontend/src/components/ReleasePreviewModal.tsx` to
  pass `size="lg"` to `Modal`, and wrap `ReleaseImageGallery` and the
  (details + tracklist) column in a `grid grid-cols-1 gap-6 lg:grid-cols-2`
  container, reusing the same breakpoint as `RecordDetailPage.tsx`'s
  two-column grid (research.md §3) — makes T017 pass
- [X] T020 [US2] Update the loading skeleton inside
  `ReleasePreviewModal.tsx` (same file as T019) to mirror the new
  two-column shape (skeleton blocks for the gallery column and the
  details+tracklist column) so there's no layout shift between skeleton and
  populated states, per the UI Design System's "no layout shift" rule

**Checkpoint**: At this point, User Stories 1 AND 2 should both work
independently — full release details show, and the popup's layout reflows
fluidly by viewport width

---

## Phase 5: User Story 3 - Browse all of a release's photos, not just the cover (Priority: P3)

**Goal**: Replace the single static cover image with a primary image plus a
vertical, clickable thumbnail list built from every image Discogs returns
for the release, handling the single-image and no-image edge cases.

**Independent Test**: Open the popup for a release with multiple images on
Discogs, click a thumbnail other than the first, and confirm the primary
image updates to match; open a release with exactly one image and confirm no
thumbnail controls appear; open one with none and confirm the existing
placeholder shows.

### Tests for User Story 3 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T021 [P] [US3] Create `frontend/tests/unit/ReleaseImageGallery.test.tsx`:
  renders the `imageType === 'primary'` image (falling back to `images[0]`)
  as the primary image by default; renders one clickable thumbnail per entry
  in `images` when there is more than one; clicking a thumbnail updates the
  primary image to that entry; renders no thumbnail list when
  `images.length <= 1`; renders the existing no-image placeholder when
  `images` is `[]`

### Implementation for User Story 3

- [X] T022 [US3] Implement `frontend/src/components/ReleaseImageGallery.tsx`
  (extending the T002 placeholder) with local `selectedIndex` state per
  data-model.md: a primary image area showing `images[selectedIndex]`, a
  vertical `overflow-y-auto` thumbnail list (one clickable thumbnail per
  image) shown only when `images.length > 1`, and the existing no-image
  placeholder when `images` is empty — makes T021 pass
- [X] T023 [P] [US3] Extend `e2e/tests/release-preview-gallery.spec.ts`
  (from T015) with a scenario: open the preview popup for a release with
  multiple images, click a thumbnail other than the first, and assert the
  primary image's `src` updates to the clicked thumbnail's image

**Checkpoint**: All user stories should now be independently functional —
full release details, responsive two-column layout, and a browsable image
gallery

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Satisfy the constitution's remaining quality gates and validate
the full feature end-to-end

- [X] T024 [P] Add a dated version-heading entry to `backend/CHANGELOG.md`
  describing the widened Discogs release model (release date, notes,
  identifiers, community stats), and bump `backend/package.json`'s version
  (MINOR), per the constitution's CHANGELOG/version-bump gate (no
  `[Unreleased]` section — date the heading directly)
- [X] T025 [P] Add a dated version-heading entry to `frontend/CHANGELOG.md`
  describing the redesigned preview popup (full release details, two-column
  layout, image gallery), and bump `frontend/package.json`'s version
  (MINOR)
- [X] T026 Run `cd backend && npm test`, `cd frontend && npm test`, and
  `cd e2e && npm test`, confirming all existing and newly added tests pass
  (Principle I and the e2e quality gate)
- [X] T027 Run quickstart.md's 10 manual validation scenarios against a
  local dev server (`specs/012-release-preview-gallery/quickstart.md`)
- [X] T028 Cross-check spec.md FR-001 through FR-013 and SC-001 through
  SC-005 against the final `ReleasePreviewModal.tsx`,
  `ReleaseDetailsSection.tsx`, `ReleaseImageGallery.tsx`, `Modal.tsx`,
  `discogsMapper.ts`, and `discogs/types.ts`; confirm FR-011 by running
  `cd frontend && npm run build` (typecheck passes with the widened
  `Release` shape) and opening a record's detail page to confirm it renders
  unchanged (data-model-only change, no new fields displayed there yet)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user
  stories (`ReleaseImageGallery`/`ReleaseDetailsSection` placeholders and the
  restructured popup must exist before any story's tests/implementation can
  target them)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion;
  once done, US1 (backend model + details section), US2 (Modal size +
  popup grid wrapper), and US3 (gallery component) touch different
  concerns/files and can proceed in parallel
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — widens `Release`
  and fills in `ReleaseDetailsSection`; no dependency on US2/US3
- **User Story 2 (P2)**: Can start after Foundational — edits `Modal.tsx`
  and the popup's grid wrapper; no dependency on US1/US3 (wraps whatever
  `ReleaseDetailsSection`/`ReleaseImageGallery` content exists, whether or
  not US1/US3 have landed yet)
- **User Story 3 (P3)**: Can start after Foundational — edits only
  `ReleaseImageGallery.tsx`; no dependency on US1/US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- Backend model/mapper before frontend types before components (US1)
- Story complete before moving to the next priority (if working
  sequentially)

### Parallel Opportunities

- T002 and T003 (Foundational placeholders) can run in parallel — different
  files
- Once Foundational (Phase 2) completes, User Stories 1, 2, and 3 can be
  implemented in parallel by different contributors, since they touch
  different files (`discogs/types.ts` + `discogsMapper.ts` +
  `ReleaseDetailsSection.tsx` vs. `Modal.tsx` + the popup's grid wrapper vs.
  `ReleaseImageGallery.tsx`)
- T006, T007, T008, T009 (US1 tests) can run in parallel; T016 and T017
  (US2 tests) can run in parallel; T015 (e2e spec) can run in parallel with
  other US1 tasks once T010-T014 land; T023 extends the same e2e file as
  T015, so it must come after T015 exists

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together (different files):
Task: "Create placeholder ReleaseImageGallery in frontend/src/components/ReleaseImageGallery.tsx"
Task: "Create placeholder ReleaseDetailsSection in frontend/src/components/ReleaseDetailsSection.tsx"
```

## Parallel Example: After Foundational, Across User Stories

```bash
# Launch each user story's first test task together (different files):
Task: "Extend discogsMapper unit tests in backend/tests/unit/discogsMapper.test.ts"
Task: "Extend Modal unit tests in frontend/tests/unit/ui/Modal.test.tsx"
Task: "Create ReleaseImageGallery unit tests in frontend/tests/unit/ReleaseImageGallery.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T006-T015)
4. **STOP and VALIDATE**: Full release details show above the tracklist
   (quickstart scenarios 1-2); layout is still single-column and the cover
   is still one static image — both acceptable as an MVP slice
5. Continue to US2/US3, or ship the MVP as-is

### Incremental Delivery

1. Setup + Foundational → two-block structure in place, behavior unchanged
2. Add User Story 1 → full Discogs release details ship (MVP!)
3. Add User Story 2 → responsive two-column layout ships
4. Add User Story 3 → browsable image gallery ships
5. Polish → changelog entries in both packages, full test suite, quickstart
   validation, FR cross-check

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (`Release` model + `ReleaseDetailsSection`)
   - Developer B: User Story 2 (`Modal` size prop + grid wrapper)
   - Developer C: User Story 3 (`ReleaseImageGallery`)
3. Stories complete and integrate independently in
   `ReleasePreviewModal.tsx`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests MUST be written and confirmed failing before their corresponding
  implementation task (Principle I, NON-NEGOTIABLE)
- Commit after each task or logical group, using Conventional Commits (e.g.
  `feat(release-preview): add Discogs release details section`)
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts across stories, cross-story
  dependencies that would break independence
