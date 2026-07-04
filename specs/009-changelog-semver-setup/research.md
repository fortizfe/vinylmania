# Phase 0 Research: Changelog & Semantic Versioning Setup

No `NEEDS CLARIFICATION` markers remain in the spec. The research below confirms the
conventions to apply and resolves the two judgment calls the spec's Assumptions
section flagged (changelog format, initial version per package).

## Decision: Changelog format

- **Decision**: Use the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 1.1.0
  convention for both `frontend/CHANGELOG.md` and `backend/CHANGELOG.md`: an
  `## [Unreleased]` section at the top, followed by `## [X.Y.Z] - YYYY-MM-DD` sections,
  each with `### Added` / `### Changed` / `### Fixed` / `### Removed` subsections as
  needed (omit empty subsections).
- **Rationale**: Already named explicitly in the project constitution's changelog
  quality gate (v1.7.0), so it requires no new format decision — just following the
  gate's own wording keeps the changelog and the constitution consistent.
- **Alternatives considered**: A freeform per-PR bullet log (rejected — not
  categorized, harder to scan for "what changed in version X"); auto-generated
  changelog from conventional commits via a tool like `standard-version` or
  `conventional-changelog` (rejected for this feature — out of scope per the spec's
  Assumptions; can be layered on top later without changing the file format).

## Decision: Semantic versioning scheme per package

- **Decision**: Each package keeps its version in its own `package.json` (`version`
  field), following `MAJOR.MINOR.PATCH` per [SemVer 2.0.0](https://semver.org/). The
  two packages version independently — no shared/monorepo version number.
- **Rationale**: `frontend/package.json` and `backend/package.json` already exist and
  already have a `version` field (`0.0.0` and `1.0.0` respectively); npm tooling
  already reads this field, so no new mechanism is needed to "expose" a version.
  Independent versioning matches the existing separate-Vercel-projects deployment
  model (see git history: `build(deploy): split Vercel deployment into separate
  backend/frontend projects`), where the two packages already release independently.
- **Alternatives considered**: A shared root-level version file for both packages
  (rejected — conflicts with FR-006/FR-007's requirement for independent identifiers,
  and with the constitution's per-package changelog gate); a new versioning tool/CLI
  (rejected — unnecessary; plain `package.json` edits satisfy the requirement per
  Principle III, Simplicity/YAGNI).

## Decision: Initial version value per package, backfilled from git history

- **Decision**:
  - `backend/package.json`: keep `1.0.0` as the current version (already at a stable
    baseline reflecting the delivered API surface: Discogs client, vinyl CRUD,
    deployment config) and record that baseline as `## [1.0.0] - 2026-07-04` in
    `backend/CHANGELOG.md`, with the deploy fix as a preceding `Fixed` entry folded
    into the same baseline release (since it was never separately tagged).
  - `frontend/package.json`: bump from the placeholder `0.0.0` to `1.0.0`, since a
    working, deployed, user-facing application already exists (landing/sign-in,
    Tailwind design system, search results, navigation, e2e auth testing) — `0.0.0`
    under SemVer conventionally means "nothing has shipped yet," which no longer
    matches reality. Record this as `## [1.0.0] - 2026-07-04` in
    `frontend/CHANGELOG.md`.
- **Rationale**: Directly satisfies spec FR-008 (initial version must reflect scope
  already delivered) and User Story 3 (backfilled history). Both packages have
  shipped multiple independently deployable feature areas, so a `0.x` "still
  unstable" baseline would understate delivered scope; `1.0.0` is the conventional
  SemVer starting point for "has a usable public surface," and both packages qualify.
- **Alternatives considered**: Leaving `frontend` at `0.0.0` and only adding a
  changelog (rejected — FR-006/FR-008 require an explicit, scope-reflecting version,
  and `0.0.0` is a placeholder, not an explicit choice); reconstructing one version
  bump per historical commit (rejected per spec Assumptions — no prior tagged
  releases exist, so a single backfilled baseline per package is sufficient and
  avoids fabricating a release history that never actually happened).

## Source material for backfill content

Derived from `git log --oneline` (already conventional-commit formatted per
constitution v1.3.0) and prior spec directories under `specs/`, filtered by which
package each change actually touched:

- **Frontend-facing**: `001-landing-google-login`, `004-frontend-tailwind-refactor`,
  `006-vinyl-search-results`, `007-app-navigation-menu`, `008-e2e-auth-testing`, plus
  the frontend half of `005-vercel-separate-projects`.
- **Backend-facing**: `002-discogs-api-client`, `003-vinyl-library-crud`, plus the
  backend half of `005-vercel-separate-projects` (including the `fix(deploy): remove
  invalid pinned runtime from backend vercel.json` follow-up fix).
