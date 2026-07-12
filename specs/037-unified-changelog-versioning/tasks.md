---

description: "Task list template for feature implementation"
---

# Tasks: Changelog único con versionado automático desde la pipeline de CI

**Input**: Design documents from `/specs/037-unified-changelog-versioning/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-script.md, quickstart.md

**Tests**: Included and mandatory — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before implementation for every change, including this one.

**Organization**: Tasks are grouped by user story (US1, US2 per spec.md, both Priority P1) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are absolute to repository root unless noted

## Path Conventions

Existing web app layout (`backend/`, `frontend/`) is unchanged. This feature adds a new root-level concern:

```text
CHANGELOG.md
package.json
scripts/release/
├── parse-commit.js
├── classify-commit.js
├── compute-release-plan.js
├── render-changelog-section.js
├── run-release.js
└── __tests__/
.github/workflows/ci.yml   (edited: new `release` job)
backend/CHANGELOG.md       (frozen)
backend/package.json       (edited: version)
frontend/CHANGELOG.md      (frozen)
frontend/package.json      (edited: version)
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the new root-level release-tooling project so tests can run from Phase 3 onward

- [X] T001 Create root `package.json` at repo root: `"private": true`, `"type": "commonjs"`, no dependencies, `"scripts": {"test": "node --test scripts/release/__tests__"}` (per research.md's "no new dependency" decision)
- [X] T002 [P] Create the `scripts/release/` and `scripts/release/__tests__/` directory scaffold (empty, ready for Phase 3/4 files)

**Checkpoint**: `npm test` (root) runs successfully with zero test files found — ready for Phase 3.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No additional cross-story infrastructure is needed beyond Phase 1 — this feature's two stories are Setup → US1 → US2 in a hard sequence (see Dependencies below), not independently-parallel stories, because US2's automation reads and appends to the exact file/tag structure US1 creates (per spec's own "Why this priority" for US1: "prerrequisito de datos para todo lo demás").

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Changelog único con el historial fusionado (Priority: P1) 🎯 MVP

**Goal**: Replace the two independent per-package changelogs/versions with one root `CHANGELOG.md` (full merged history, clearly marked unified-versioning start) and one lockstep version (`0.22.1`) in both `package.json` files.

**Independent Test**: Inspect `CHANGELOG.md`, `backend/package.json`, and `frontend/package.json` after this phase — no CI automation needs to run yet (per spec's Independent Test: "sin ejecutar todavía ninguna automatización de CI").

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T003 [P] [US1] Write failing test asserting root `CHANGELOG.md` exists, contains `## Unified versioning` before `## Historical merged entries`, and its total `## [` heading count is `>=` the combined heading count of `backend/CHANGELOG.md` + `frontend/CHANGELOG.md`, in `scripts/release/__tests__/changelog-migration.test.js`
- [X] T004 [P] [US1] Write failing test asserting `backend/package.json` and `frontend/package.json` both report `"version": "0.22.1"`, in `scripts/release/__tests__/lockstep-version.test.js`

### Implementation for User Story 1

- [X] T005 [US1] Merge `backend/CHANGELOG.md` (15 entries, `0.1.0`→`0.13.1`) and `frontend/CHANGELOG.md` (25 entries, `0.1.0`→`0.22.1`) chronologically by original date into new root `CHANGELOG.md`, preserving each entry's original version, date, and category, tagging each with `(backend)`/`(frontend)`, per the file structure in `data-model.md` (depends on T003)
- [X] T006 [US1] Add the intro (Keep a Changelog + SemVer references, single-project-version note) and the `## Unified versioning` marker section to root `CHANGELOG.md`, positioned above the merged historical section from T005, per `data-model.md` (depends on T005)
- [X] T007 [P] [US1] Bump `backend/package.json` `"version"` from `0.13.1` to `0.22.1` (frontend's `package.json` already reports `0.22.1`, no change needed there)
- [X] T008 [P] [US1] Prepend a short frozen/superseded notice to the top of `backend/CHANGELOG.md` and `frontend/CHANGELOG.md`, pointing at the new root `CHANGELOG.md`, without altering any existing entry's wording (FR-005)
- [X] T009 [US1] Run T003 and T004 and confirm both now pass (depends on T005, T006, T007, T008)
- [X] T010 [US1] Seed annotated git tag `v0.22.1` on the migration commit that includes T005-T008, only after T009 confirms both tests pass (per research.md's "git tags as release marker" decision) — this tag is the anchor US2's automation will diff against (depends on T009)

**Checkpoint**: Root `CHANGELOG.md` and lockstep `0.22.1` version fully in place and tagged — User Story 1 is independently complete and demoable.

---

## Phase 4: User Story 2 - Versión y changelog se actualizan solos desde la CI de GitHub (Priority: P1)

**Goal**: A new `release` job in `.github/workflows/ci.yml` computes the correct lockstep SemVer bump from Conventional Commits on every push to `main`, updates both `package.json` files and `CHANGELOG.md`, and commits/tags the result — with no manual editing.

**Independent Test**: Merge a PR with `feat:`/`fix:` commits to a test `main` and verify the `release` job bumps both `package.json` files and appends the correct `CHANGELOG.md` entry, per `quickstart.md` Part 3.

**Depends on**: Phase 3 (User Story 1) — the `v0.22.1` tag and the `## Unified versioning` marker it creates are the base state this automation reads from and appends to.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation — per `contracts/release-script.md`'s function contract

- [X] T011 [P] [US2] Write failing tests for `parseCommit(subject, body)` covering `feat:`, `fix:`, breaking (`!` and `BREAKING CHANGE:` footer), and a malformed subject with no recognizable type, in `scripts/release/__tests__/parse-commit.test.js`
- [X] T012 [P] [US2] Write failing tests for `classifyCommit(parsed)` covering: the FR-010 exclusion list (`chore`/`docs`/`test`/`ci`/`style`/`refactor` without `!` → `qualifies: false`); the same types *with* `!` → `qualifies: true` + `bumpLevel: "major"`; and the Clarifications category mapping (`feat`→`Added`, `fix`→`Fixed`, any other qualifying type→`Changed`), in `scripts/release/__tests__/classify-commit.test.js`
- [X] T013 [P] [US2] Write failing tests for `computeReleasePlan(commits[], previousVersion, date)` covering: highest-impact bump selection across a mixed batch (breaking > feat > fix, per FR-007); a no-op case where every commit is non-qualifying (`bumpLevel: "none"`, `nextVersion: null`, per FR-010); and `warnings` collection from malformed commits (per FR-013), in `scripts/release/__tests__/compute-release-plan.test.js`
- [X] T014 [P] [US2] Write failing tests for `renderChangelogSection(releasePlan)` covering grouped-by-category Markdown output, omission of empty categories, and that each rendered line includes its originating commit's short SHA (per SC-004 traceability), in `scripts/release/__tests__/render-changelog-section.test.js`

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement `parseCommit` in `scripts/release/parse-commit.js` (depends on T011)
- [X] T016 [P] [US2] Implement `classifyCommit` in `scripts/release/classify-commit.js` (depends on T012)
- [X] T017 [US2] Implement `computeReleasePlan` in `scripts/release/compute-release-plan.js`, including the SemVer increment logic (depends on T013, T015, T016)
- [X] T018 [US2] Implement `renderChangelogSection` in `scripts/release/render-changelog-section.js`, including the commit short-SHA suffix per entry (depends on T014, T017)
- [X] T019 [US2] Implement the orchestrator `scripts/release/run-release.js`: reads `git log <last-tag>..HEAD` on `main`, asserts `backend/package.json` and `frontend/package.json` versions match (exit 1 if not, per `contracts/release-script.md`), calls the pure functions, and — only if `bumpLevel !== "none"` — writes `CHANGELOG.md` + both `package.json` files, commits `chore(release): vX.Y.Z [skip ci]`, and creates tag `vX.Y.Z`; emits `::warning::` GitHub Actions annotations for each malformed commit (FR-013) (depends on T015-T018)
- [X] T020 [US2] Add the `release` job to `.github/workflows/ci.yml`: `needs: [backend-test, frontend-test]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, checkout with `fetch-depth: 0`, `permissions: { contents: write }`, `concurrency: { group: release-main, cancel-in-progress: false }`, a step configuring the commit identity (`git config user.name "github-actions[bot]"` / `git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`), and a step running `node scripts/release/run-release.js` followed by `git push --follow-tags` (depends on T019)
- [X] T021 [US2] Run `quickstart.md` Part 2 (local dry-run against the `v0.22.1` tag from Phase 3) and Part 3 (workflow field validation) to confirm end-to-end behavior (depends on T020) — validated via an isolated sandbox repo (real `v0.22.1` tag doesn't exist yet pending the Phase 3 commit) covering minor bump, `chore` exclusion, malformed-commit warning, no-op case, and version-mismatch failure; workflow fields verified directly in `ci.yml`

**Checkpoint**: Pushing a `feat:`/`fix:` commit to `main` now bumps both `package.json` files and appends a `CHANGELOG.md` entry automatically, with no manual step — both user stories are independently complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories

- [X] T022 Run the full `quickstart.md` validation guide end-to-end (Parts 1-3) against the completed feature — heading counts match (15+25=40), markers in correct order, both packages at `0.22.1`, old changelogs preserved, all 35 unit tests pass
- [X] T023 [P] Confirm `.github/workflows/ci.yml`'s existing `backend-test`/`frontend-test` jobs are unaffected by the new `release` job (no shared step names, no new required-status-check regressions), and confirm Vercel's push-to-`main` deploy trigger still fires independently of the `release` job's outcome — a `release` job failure MUST NOT block or delay the existing Vercel deploy (FR-011) — consistent with constitution v2.3.0's removal of the manual changelog/version gate. Verified: `backend-test`/`frontend-test` jobs and the `on:` trigger block are byte-for-byte unchanged; Vercel's deploy is triggered by GitHub's own push webhook (per constitution Technology Stack), independent of Actions job outcomes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: No additional tasks — proceed straight to Phase 3
- **User Story 1 (Phase 3)**: Depends on Setup only
- **User Story 2 (Phase 4)**: Depends on User Story 1 completing (needs the `v0.22.1` tag and `## Unified versioning` marker as its base state) — **not independent of US1**, by design (see spec's own priority rationale)
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle I)
- US1: merge → marker → version bump / pointer notes (parallel) → tag → re-run tests
- US2: four pure functions (tests then implementation, parallelizable across functions) → orchestrator (integrates all four) → CI workflow wiring → end-to-end validation

### Parallel Opportunities

- T003, T004 (US1 tests) — different files
- T007, T008 (US1 implementation) — different files, no shared state
- T011, T012, T013, T014 (US2 tests) — different files
- T015, T016 (US2 implementation: `parseCommit`, `classifyCommit`) — different files, no interdependency
- T023 (Polish) can run alongside T022

---

## Parallel Example: User Story 1

```bash
# Tests, launched together:
Task: "Write failing test asserting root CHANGELOG.md structure in scripts/release/__tests__/changelog-migration.test.js"
Task: "Write failing test asserting lockstep 0.22.1 version in scripts/release/__tests__/lockstep-version.test.js"

# Implementation, launched together once T005/T006 are done:
Task: "Bump backend/package.json version to 0.22.1"
Task: "Prepend frozen/superseded notice to backend/CHANGELOG.md and frontend/CHANGELOG.md"
```

## Parallel Example: User Story 2

```bash
# Tests, launched together:
Task: "Write failing tests for parseCommit in scripts/release/__tests__/parse-commit.test.js"
Task: "Write failing tests for classifyCommit in scripts/release/__tests__/classify-commit.test.js"
Task: "Write failing tests for computeReleasePlan in scripts/release/__tests__/compute-release-plan.test.js"
Task: "Write failing tests for renderChangelogSection in scripts/release/__tests__/render-changelog-section.test.js"

# Implementation, launched together:
Task: "Implement parseCommit in scripts/release/parse-commit.js"
Task: "Implement classifyCommit in scripts/release/classify-commit.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Confirm `CHANGELOG.md` and both `package.json` files per the Independent Test
4. This alone already satisfies "single source of truth for history," even before automation exists

### Incremental Delivery

1. Setup → Phase 3 (US1) → validate → this is already a shippable improvement (unified changelog, no CI change yet)
2. Add Phase 4 (US2) → validate via quickstart.md → automation now removes the last manual step
3. Phase 5 polish

### Notes

- [P] tasks = different files, no dependencies
- Tests MUST fail before their corresponding implementation task, per Principle I
- Unlike the typical "independent stories" pattern, US2 has a genuine, spec-acknowledged dependency on US1's output (the `v0.22.1` tag and unified marker) — do not attempt to parallelize the two stories across team members
- Commit after each task or logical group
- Avoid: vague tasks, same-file conflicts, skipping the tag step (T010) before starting US2
