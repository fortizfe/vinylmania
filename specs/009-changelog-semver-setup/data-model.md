# Phase 1 Data Model: Changelog & Semantic Versioning Setup

This feature has no application data model (no database, no API payloads). The
"entities" below are documentation/metadata conventions codified across the two
package changelogs, carried over from the spec's Key Entities section.

## Package Version

Represents the current release identifier of one package, stored in that package's
`package.json` under `version`.

| Field | Type | Rules |
|-------|------|-------|
| `version` | string, `MAJOR.MINOR.PATCH` | MUST follow SemVer 2.0.0. MUST be independent per package (`frontend/package.json` vs `backend/package.json` never need to match). MUST increment per the constitution's Principle VI mapping: breaking change → MAJOR, backward-compatible new functionality → MINOR, fix/clarification → PATCH. |
| `package` | enum: `frontend` \| `backend` | Identifies which package the version belongs to; determines which `package.json` and which `CHANGELOG.md` are updated together. |

**Relationships**: Every `Package Version` value that has ever been released MUST
have exactly one corresponding `## [version] - date` section in that package's
`CHANGELOG.md` (see Changelog Entry below). The `[Unreleased]` section is the only
exception — it has no version number yet.

## Changelog Entry

Represents one recorded change within a package's `CHANGELOG.md`.

| Field | Type | Rules |
|-------|------|-------|
| `package` | enum: `frontend` \| `backend` | Determines which file (`frontend/CHANGELOG.md` or `backend/CHANGELOG.md`) the entry lives in. Entries MUST NOT span both files for a single logical change — a cross-cutting PR gets one entry per affected package. |
| `version_section` | string | Either `Unreleased` or a released `MAJOR.MINOR.PATCH` value that matches a `Package Version` at the time of that section's release. |
| `date` | ISO date `YYYY-MM-DD` | Present on released version sections; omitted on `Unreleased`. |
| `category` | enum: `Added` \| `Changed` \| `Fixed` \| `Removed` | Keep a Changelog categorization (per research.md decision and the constitution's quality gate wording). A version section only includes the categories it needs — empty categories are omitted, not left as empty headings. |
| `description` | string (one line) | Short, human-readable summary of the change; MUST be understandable without reading the underlying commit/PR. |

**Relationships**: Many `Changelog Entry` records belong to one `version_section`
within one package's changelog. A `version_section` belongs to exactly one
`Package Version` (once released) or to the special `Unreleased` bucket (before
release).

**Validation rules** (structural, enforced by review per the constitution's quality
gate, not by tooling in this feature):

- A pull request touching `/frontend` MUST add at least one `Changelog Entry` under
  `Unreleased` in `frontend/CHANGELOG.md` (or directly under a new version section if
  the PR also cuts a release).
- A pull request touching `/backend` MUST do the same in `backend/CHANGELOG.md`.
- Moving entries from `Unreleased` to a new dated version section MUST coincide with
  bumping that package's `Package Version` in its `package.json`.
