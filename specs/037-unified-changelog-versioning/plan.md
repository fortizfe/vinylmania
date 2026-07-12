# Implementation Plan: Changelog único con versionado automático desde la pipeline de CI

**Branch**: `037-unified-changelog-versioning` | **Date**: 2026-07-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/037-unified-changelog-versioning/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the two independent, manually-maintained `backend/CHANGELOG.md` /
`frontend/CHANGELOG.md` (and their independent `package.json` versions) with
a single root `CHANGELOG.md` and a single lockstep SemVer version shared by
both packages. Historia 1 is a one-time migration: merge both changelogs'
history chronologically (preserving original version/date/package per
entry) and set both `package.json` files to `0.22.1`. Historia 2 adds a new
`release` job to the existing `.github/workflows/ci.yml` that, after each
push to `main`, reads the Conventional Commits since the last release tag,
computes the correct lockstep SemVer bump, and — only when a qualifying
commit exists — writes the new version into both `package.json` files and
appends a new entry to the root `CHANGELOG.md`, committing and tagging the
result. No new third-party release-automation dependency is introduced; the
logic is a small, dependency-free Node.js script (see `research.md` for why
`semantic-release`/`release-please`/`changesets` were rejected).

## Technical Context

**Language/Version**: Node.js 20 (matches `.github/workflows/ci.yml`'s pinned `node-version: 20`), plain CommonJS JavaScript — no TypeScript build step for the release script itself (see research.md)

**Primary Dependencies**: None new. Uses only Node.js built-ins (`fs`, `child_process` for `git` invocations) and the existing GitHub Actions runner's `git`/`node` toolchain

**Storage**: N/A — plain repository files: root `CHANGELOG.md`, `backend/package.json`, `frontend/package.json`, plus lightweight annotated git tags (`vX.Y.Z`) as the durable "last release" marker

**Testing**: Node.js built-in test runner (`node --test`) for the release script's pure functions (`parseCommit`, `classifyCommit`, `computeReleasePlan`, `renderChangelogSection`); no new test framework dependency

**Target Platform**: GitHub Actions `ubuntu-latest` runner (CI-only script; not shipped in either app's runtime bundle)

**Project Type**: Web application (existing `backend/` + `frontend/` split) plus a new root-level CI/release-tooling script — no change to either app's runtime code

**Performance Goals**: N/A — runs once per push to `main`, operating over a handful of commits per run

**Constraints**: MUST NOT alter or delay the existing Vercel deploy trigger (push to `main` → deploy, FR-011); MUST NOT re-trigger its own CI run (`[skip ci]` + non-qualifying-commit guard, see research.md); MUST serialize across rapidly-merged PRs (FR-012, via a `concurrency` gate)

**Scale/Scope**: 1 new root `CHANGELOG.md` (migrated from 2 files, ~40 combined historical entries), 1 new root `package.json` (release tooling only, no publish), a new `scripts/release/` directory (4 pure functions + orchestrator + unit tests), 1 new job appended to the existing `.github/workflows/ci.yml`, edits to both existing `package.json` `version` fields, both old per-package `CHANGELOG.md` files frozen (not deleted, not further edited beyond an optional pointer note)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Test-First, NON-NEGOTIABLE)**: The release script's pure
  functions (`parseCommit`, `classifyCommit`, `computeReleasePlan`,
  `renderChangelogSection`) MUST have failing tests written before their
  implementation (Red-Green-Refactor), per `contracts/release-script.md`'s
  function contract. PASS — tasks.md must sequence tests before
  implementation for each function.
- **Principle II (Discogs Integration-First & Modularity)**: N/A — this
  feature touches no catalog metadata or Discogs client code. PASS (not
  applicable).
- **Principle III (Simplicity, YAGNI & KISS)**: Directly drives the core
  design decision in `research.md` — a small hand-rolled script instead of
  a heavyweight release-automation dependency, because the spec's clarified
  3-category mapping doesn't fit any stock tool's defaults without fighting
  its plugin config. PASS.
- **Principle IV (SOLID)**: The four functions each have a single
  responsibility (parse / classify / plan / render); the orchestrator is
  the only piece doing I/O, keeping I/O and pure logic separated. PASS.
- **Principle V (Observability)**: Malformed commits (FR-013) and no-op
  runs (FR-010) MUST produce visible, actionable output (`::warning::`
  annotations / stdout summary) rather than failing silently. PASS.
- **Principle VI (Versioning & Breaking Changes)**: This feature *is* the
  automation of Principle VI's existing classification rules (breaking→MAJOR,
  `feat`→MINOR, `fix`→PATCH); it does not redefine that classification, only
  executes it without manual intervention. PASS.
- **Principle VII (Curated Ratings & Music News)**: N/A — no rating or news
  surface touched. PASS (not applicable).
- **Development Workflow — Conventional Commits gate**: Reused as this
  feature's direct input, not redefined. PASS.
- **Development Workflow — e2e quality gate**: N/A — no `/frontend`
  user-facing behavior changes; this is CI/tooling only. PASS (not
  applicable).
- **Development Workflow — Changelog/version automation gate (constitution
  v2.3.0)**: This feature directly implements what that amended clause
  anticipates — reviewers are no longer expected to see manual
  `CHANGELOG.md`/`package.json` edits per PR; this plan supplies the
  automation the amendment presupposes. PASS.
- **Technology Stack**: Backend (Express/Node) and Frontend (React)
  runtimes are untouched. Source control remains GitHub; deployment remains
  Vercel triggered by push to `main`, unchanged (FR-011). The new root-level
  Node script is CI/build tooling, not an application framework choice, so
  it does not trigger the "deviating from this stack" clause. PASS.

No violations — Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/037-unified-changelog-versioning/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── release-script.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
CHANGELOG.md                        # NEW — unified root changelog (merged history + automated entries)
package.json                        # NEW — root, private, release tooling only (no publish, no runtime deps)

scripts/release/
├── run-release.js                  # NEW — orchestrator: git I/O, file writes, commit/tag/push
├── parse-commit.js                 # NEW — pure: raw commit → partial ClassifiedCommit
├── classify-commit.js              # NEW — pure: adds qualifies/bumpLevel/changelogCategory
├── compute-release-plan.js         # NEW — pure: ClassifiedCommit[] → ReleasePlan
├── render-changelog-section.js     # NEW — pure: ReleasePlan → Markdown block
└── __tests__/
    ├── parse-commit.test.js        # NEW
    ├── classify-commit.test.js     # NEW
    ├── compute-release-plan.test.js # NEW
    └── render-changelog-section.test.js # NEW

.github/workflows/ci.yml            # EDIT — add `release` job (needs: [backend-test, frontend-test])

backend/
├── CHANGELOG.md                    # FROZEN — no new entries after migration (FR-005)
└── package.json                    # EDIT — version bumped to 0.22.1, then lockstep-updated by CI thereafter

frontend/
├── CHANGELOG.md                    # FROZEN — no new entries after migration (FR-005)
└── package.json                    # EDIT (already at 0.22.1) — lockstep-updated by CI thereafter
```

**Structure Decision**: Existing Web application layout (`backend/` +
`frontend/`) is unchanged. This feature adds one new root-level concern
(release tooling: `CHANGELOG.md`, a private `package.json`, and
`scripts/release/`) that operates across both packages rather than
belonging to either — matching the feature's own "single project version"
premise. No new top-level app directory is introduced; `scripts/release/`
sits alongside the existing `backend/`, `frontend/`, `e2e/`, `docs/`
top-level directories.

## Complexity Tracking

> Not applicable — Constitution Check reported no violations.
