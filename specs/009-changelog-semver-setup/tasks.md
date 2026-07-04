---

description: "Task list for Changelog & Semantic Versioning Setup"
---

# Tasks: Changelog & Semantic Versioning Setup

**Input**: Design documents from `/specs/009-changelog-semver-setup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested — this feature has no executable behavior (docs +
`package.json` metadata only); `quickstart.md` provides manual CLI validation
instead of an automated test suite.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app layout already in place: `backend/` and `frontend/` at repository root.
This feature touches exactly 4 files: `backend/CHANGELOG.md`,
`frontend/CHANGELOG.md`, `backend/package.json`, `frontend/package.json`.

---

## Phase 1: Setup

**Purpose**: Confirm the target locations before creating/editing files

- [X] T001 Verify `backend/package.json` and `frontend/package.json` exist and
  read their current `version` fields (`1.0.0` and `0.0.0` respectively per
  research.md); confirm neither `backend/CHANGELOG.md` nor
  `frontend/CHANGELOG.md` exists yet

---

## Phase 2: Foundational

**Purpose**: Core infrastructure that MUST be complete before ANY user story
can be implemented

**Not applicable for this feature**: `frontend/` and `backend/` changelogs and
versions are fully independent artifacts (per plan.md Constraints and spec.md
FR-006/FR-007) — there is no shared code, schema, or middleware that both
packages depend on. The format and versioning conventions were already decided
in [research.md](research.md), so no additional blocking setup task is needed.
Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Contributor records a change in the right changelog (Priority: P1) 🎯 MVP

**Goal**: Give each package a `CHANGELOG.md` with a documented format and a
ready-to-use `Unreleased` section, so contributors have an unambiguous place to
log changes per the constitution's quality gate.

**Independent Test**: Open `frontend/CHANGELOG.md` and `backend/CHANGELOG.md`;
each shows a title, a one-line format explanation, and an `## [Unreleased]`
section; adding a bullet under it does not break the file structure.

### Implementation for User Story 1

- [X] T002 [P] [US1] Create `frontend/CHANGELOG.md` with a title, a one-line
  note that it follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
  and [Semantic Versioning](https://semver.org/), and an empty
  `## [Unreleased]` section at the top (no version sections yet)
- [X] T003 [P] [US1] Create `backend/CHANGELOG.md` with the same title/format
  note and an empty `## [Unreleased]` section at the top

**Checkpoint**: Both packages now have an independently usable changelog file;
future PRs touching `/frontend` or `/backend` have a place to add an entry,
satisfying the constitution's changelog quality gate even before any history is
backfilled.

---

## Phase 4: User Story 2 - Maintainer determines the current released version of each package (Priority: P1)

**Goal**: Each package exposes its own explicit `MAJOR.MINOR.PATCH` version,
and that version has a matching dated section in its changelog.

**Independent Test**: Read `frontend/package.json`'s `version` and
`backend/package.json`'s `version` — both are explicit SemVer values, set
independently. Each matches a `## [version] - date` heading in that package's
`CHANGELOG.md`.

### Implementation for User Story 2

- [X] T004 [US2] Bump `"version"` in `frontend/package.json` from `0.0.0` to
  `1.0.0` (per research.md: a working, deployed, user-facing app already
  exists, so `0.0.0` no longer reflects reality)
- [X] T005 [US2] Confirm `"version"` in `backend/package.json` stays `1.0.0`
  as the baseline reflecting already-delivered API scope (no numeric change,
  documents the decision from research.md)
- [X] T006 [US2] Add a `## [1.0.0] - 2026-07-04` heading to
  `frontend/CHANGELOG.md`, placed below `## [Unreleased]`, matching the
  version set in T004 (depends on: T002, T004)
- [X] T007 [US2] Add a `## [1.0.0] - 2026-07-04` heading to
  `backend/CHANGELOG.md`, placed below `## [Unreleased]`, matching the
  version confirmed in T005 (depends on: T003, T005)

**Checkpoint**: A maintainer can now determine each package's released version
independently and find its matching changelog section, even before that
section lists backfilled entries.

---

## Phase 5: User Story 3 - New contributor understands what has already shipped (Priority: P2)

**Goal**: Backfill each package's `[1.0.0]` changelog section with the
notable work already delivered, grouped by Keep a Changelog category, so
history isn't lost.

**Independent Test**: Open either changelog's `[1.0.0]` section and find
entries corresponding to the feature areas listed in research.md's "Source
material for backfill content".

### Implementation for User Story 3

- [X] T008 [P] [US3] Populate the `## [1.0.0]` section of
  `frontend/CHANGELOG.md` with `### Added` entries summarizing: landing page +
  Google sign-in (specs/001), Tailwind CSS v4 design system refactor
  (specs/004), card-based paginated vinyl search results (specs/006), app
  navigation with hamburger menu and dashboard (specs/007), and end-to-end
  auth testing (specs/008); include the frontend Vercel project split
  (specs/005) as a `### Changed` entry (depends on: T006)
- [X] T009 [P] [US3] Populate the `## [1.0.0]` section of
  `backend/CHANGELOG.md` with `### Added` entries summarizing: Discogs
  catalog API client and data model (specs/002) and vinyl library CRUD with
  Discogs enrichment (specs/003); include the backend Vercel project split
  as a `### Changed` entry and the invalid pinned runtime removal as a
  `### Fixed` entry (both from specs/005) (depends on: T007)

**Checkpoint**: Both changelogs now fully document delivered scope; a new
contributor or reviewer can read either file and understand what has shipped
without consulting `git log`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both packages

- [X] T010 [P] Run quickstart.md validation scenarios 1-5 against
  `frontend/CHANGELOG.md`, `backend/CHANGELOG.md`, `frontend/package.json`,
  and `backend/package.json` (specs/009-changelog-semver-setup/quickstart.md)
- [X] T011 Cross-check spec.md FR-001 through FR-010 against the four final
  files to confirm every functional requirement is satisfied
  (specs/009-changelog-semver-setup/spec.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: N/A for this feature — proceed straight to
  Phase 3 after Phase 1
- **User Story 1 (Phase 3)**: Depends on Phase 1 (T001)
- **User Story 2 (Phase 4)**: Depends on User Story 1's file creation (T002,
  T003) since it adds a heading into the same files
- **User Story 3 (Phase 5)**: Depends on User Story 2's version headings (T006,
  T007) since it populates content under those headings
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independently testable once T002/T003 are done
- **User Story 2 (P1)**: Builds on US1's files (adds a heading); independently
  testable once T004-T007 are done, even with empty version sections
- **User Story 3 (P2)**: Builds on US2's headings (adds content underneath);
  independently testable once T008/T009 are done

Note: unlike a typical multi-service feature, these three stories touch the
same two files in layers (skeleton → version heading → content) rather than
being fully parallel from Foundational — each story is still independently
*verifiable* (per its Independent Test above) even though later stories build
on earlier file state.

### Parallel Opportunities

- T002 and T003 (frontend vs. backend changelog creation) can run in parallel
- T004 and T005 (frontend vs. backend version) can run in parallel
- T006 and T007 (frontend vs. backend version heading) can run in parallel
  once their respective T002-T005 dependencies are done
- T008 and T009 (frontend vs. backend backfill content) can run in parallel
  once their respective T006/T007 dependencies are done

---

## Parallel Example: User Story 1

```bash
# Launch both changelog creation tasks together (different files):
Task: "Create frontend/CHANGELOG.md with title, format note, and empty ## [Unreleased] section"
Task: "Create backend/CHANGELOG.md with title, format note, and empty ## [Unreleased] section"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002, T003)
3. **STOP and VALIDATE**: Both changelogs exist with a documented format and
   an `Unreleased` section — the constitution's changelog quality gate is
   already satisfiable for any new PR from this point on
4. Continue to US2/US3 to add versioning and history, or ship the MVP as-is

### Incremental Delivery

1. Setup (T001) → ready to create files
2. User Story 1 (T002-T003) → contributors can start logging changes (MVP)
3. User Story 2 (T004-T007) → maintainers can read an authoritative version
   per package
4. User Story 3 (T008-T009) → full delivered history is backfilled
5. Polish (T010-T011) → validated against quickstart.md and spec.md

---

## Notes

- [P] tasks = different files (or independent sub-sections), no dependencies
- [Story] label maps task to specific user story for traceability
- No automated tests are added — validation is manual via quickstart.md
  (see Tests note above)
- Commit after each phase (or per task) following the project's Conventional
  Commits requirement, e.g. `docs(changelog): add CHANGELOG.md and bump
  version for frontend/backend`
