# Feature Specification: Changelog & Semantic Versioning Setup

**Feature Branch**: `009-changelog-semver-setup`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Haz los cambios necesarios para crear los ficheros CHANGELOG.md en /frontend y /backend con el objetivo de mantener un registro de las versiones. Haz lo necesario también para que tanto backend como frontend implementen, cada uno por separado, semantic version. Nutre tanto el vertsionado como los changelog con lo desarrolado hasta ahora"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contributor records a change in the right changelog (Priority: P1)

A contributor finishes work on the frontend (or backend) and needs to record what changed
before opening a pull request, per the constitution's changelog quality gate. They open
`frontend/CHANGELOG.md` (or `backend/CHANGELOG.md`), find an "Unreleased" section at the
top, and add a line describing their change under the right category (Added, Changed,
Fixed, Removed).

**Why this priority**: This is the core, everyday interaction the feature exists to
support, and it is now a mandatory quality gate — without a usable, well-structured
changelog file, every future PR touching `/frontend` or `/backend` is out of compliance.

**Independent Test**: Can be fully tested by opening either package's `CHANGELOG.md`,
confirming it has a clear "Unreleased" section and a documented format, adding an entry,
and confirming the file remains well-formed.

**Acceptance Scenarios**:

1. **Given** `frontend/CHANGELOG.md` exists, **When** a contributor opens it, **Then**
   they see a title, a short explanation of the format used, and an "Unreleased"
   section ready to receive new entries.
2. **Given** `backend/CHANGELOG.md` exists, **When** a contributor opens it, **Then**
   they see the same structure, independent from the frontend's changelog and versioned
   separately.
3. **Given** an existing changelog, **When** a contributor adds a new dated version
   section, **Then** the previous "Unreleased" entries move under that version heading
   without losing history.

---

### User Story 2 - Maintainer determines the current released version of each package (Priority: P1)

A maintainer preparing a release (or investigating a bug report) needs to know exactly
which version of the frontend and which version of the backend are currently released,
independently of each other, since the two packages are deployed as separate Vercel
projects.

**Why this priority**: Without an authoritative, package-scoped version number, "what
version is running" is undecidable, which blocks debugging, release communication, and
the constitution's semantic-versioning requirement (Principle VI).

**Independent Test**: Can be fully tested by inspecting the frontend package's version
identifier and the backend package's version identifier and confirming they are tracked
independently and both follow MAJOR.MINOR.PATCH.

**Acceptance Scenarios**:

1. **Given** the frontend package, **When** a maintainer checks its version identifier,
   **Then** it shows a MAJOR.MINOR.PATCH value that reflects the frontend's own release
   history, not the backend's.
2. **Given** the backend package, **When** a maintainer checks its version identifier,
   **Then** it shows a MAJOR.MINOR.PATCH value that reflects the backend's own release
   history, not the frontend's.
3. **Given** a version number in either package, **When** a maintainer looks it up in
   that package's `CHANGELOG.md`, **Then** they find a matching dated section listing
   what changed in that version.

---

### User Story 3 - New contributor understands what has already shipped (Priority: P2)

A new contributor (or the constitution's own reviewers) opens either changelog for the
first time and wants a backfilled history of what has been delivered so far in that
package, so they have context without having to read the full git log.

**Why this priority**: A changelog that starts empty at "now" loses everything already
delivered; the user explicitly asked to seed ("nutrir") both the changelog and the
version number with what has already been built, so this history has standalone value
even before any new change is recorded.

**Independent Test**: Can be fully tested by opening either changelog and confirming it
lists the notable features already delivered in that package, grouped under a version
that matches the package's current version identifier.

**Acceptance Scenarios**:

1. **Given** the frontend package's delivered history (landing/sign-in, Discogs search
   UI, vinyl library UI, Tailwind design system, search results, app navigation, e2e
   auth testing), **When** a contributor opens `frontend/CHANGELOG.md`, **Then** they
   see those items summarized under one or more dated version entries.
2. **Given** the backend package's delivered history (Discogs catalog client, vinyl
   library CRUD with Discogs enrichment, Vercel deployment split/fixes), **When** a
   contributor opens `backend/CHANGELOG.md`, **Then** they see those items summarized
   under one or more dated version entries.

### Edge Cases

- What happens when a change touches both `/frontend` and `/backend` in the same pull
  request? Both changelogs MUST receive an entry, and each package's version MUST be
  bumped independently according to the significance of the change to that package.
- How does the system handle a change that has no user-visible or API-visible effect
  (e.g., internal refactor with no behavior change)? It still MUST be recorded as a
  "Changed" entry so the changelog remains the authoritative record of all shipped
  work referenced by the constitution's quality gate, even if the version bump is a
  PATCH.
- What happens if a future contributor forgets to add a changelog entry? This is
  addressed by the constitution's existing quality gate (reviewers reject PRs missing
  the matching entry) — this feature only needs to provide the file and format for
  that gate to be enforceable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain a `frontend/CHANGELOG.md` file that records
  the version history of the frontend package independently of the backend.
- **FR-002**: The repository MUST contain a `backend/CHANGELOG.md` file that records
  the version history of the backend package independently of the frontend.
- **FR-003**: Each changelog MUST follow a consistent, documented structure: a title,
  a one-line explanation of the convention in use, and entries grouped by version,
  each version grouped further by change type (Added, Changed, Fixed, Removed).
- **FR-004**: Each changelog MUST include an "Unreleased" section at the top, ready to
  receive entries for work that has not yet been released.
- **FR-005**: Each changelog MUST be backfilled with the notable, user-or-API-visible
  work already delivered in that package, derived from the project's existing history,
  grouped into one or more dated version entries.
- **FR-006**: The frontend package MUST expose an explicit, independent version
  identifier following MAJOR.MINOR.PATCH semantic versioning.
- **FR-007**: The backend package MUST expose an explicit, independent version
  identifier following MAJOR.MINOR.PATCH semantic versioning.
- **FR-008**: The initial version identifier assigned to each package MUST reflect the
  scope of what has already been delivered in that package (i.e., MUST NOT restart both
  packages at an identical placeholder version if their delivered scope differs).
- **FR-009**: Each version entry in a changelog MUST correspond exactly to that
  package's version identifier at the time of that entry, so a maintainer can look up
  "what shipped in version X" unambiguously.
- **FR-010**: The versioning and changelog scheme for each package MUST classify past
  and future changes consistently with the constitution's existing MAJOR/MINOR/PATCH
  definitions (breaking change = MAJOR, new backward-compatible functionality = MINOR,
  fix/clarification = PATCH).

### Key Entities

- **Changelog entry**: A single recorded change within a package's `CHANGELOG.md`;
  attributes include the version it belongs to, its category (Added/Changed/Fixed/
  Removed), and a short human-readable description.
- **Package version**: The independent MAJOR.MINOR.PATCH identifier for the frontend
  package or the backend package; changes over time as new versions are released and
  must always correspond to a matching changelog section.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can determine the current released version of the frontend
  and the current released version of the backend independently, in under 30 seconds,
  without reading source code.
- **SC-002**: A contributor can find, for any of the last 8 delivered feature areas
  (landing/login, navigation, search results, e2e auth testing, Discogs client, vinyl
  CRUD, Tailwind refactor, deployment split), a corresponding entry in the correct
  package's changelog.
- **SC-003**: 100% of future pull requests that touch `/frontend` or `/backend` have an
  unambiguous place to add a changelog entry (an "Unreleased" section) without needing
  to invent a new file structure.
- **SC-004**: The frontend and backend version identifiers never need to match each
  other — a change to one package's version has no bearing on the other's.

## Assumptions

- The project's `git log` / commit history (conventional commits already required by
  the constitution) is a sufficient and authoritative source for backfilling the
  "already delivered" changelog entries; no external release records exist.
- Since neither package has shipped an external, versioned release to end users yet,
  the backfilled history MAY be recorded under a single initial version per package
  (e.g., an "0.x" or "1.0.0" baseline) rather than reconstructing a separate version
  per historical commit.
- The frontend currently has no explicit version identifier surfaced outside its
  package manifest; exposing it via that manifest is an acceptable "explicit version
  identifier" for this feature (no new UI or endpoint is required).
- The backend currently has a package manifest version placeholder; this feature
  updates it to reflect real delivered scope rather than introducing a new versioning
  mechanism.
- Changelog format follows the widely-used "Keep a Changelog" categorization already
  named in the constitution's quality gate (Added/Changed/Fixed/Removed), so no new
  format needs to be invented.
- This spec covers establishing the changelog files and independent versioning scheme
  and backfilling them; it does not cover building tooling to auto-generate changelog
  entries from commits (out of scope unless requested later).
