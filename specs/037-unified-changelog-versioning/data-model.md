# Phase 1 Data Model: Unified Changelog with CI-Automated Versioning

This feature has no application database entities — it operates entirely on
repository files (Markdown, `package.json`, git tags) inside CI. The
"entities" below are the in-memory shapes the release script passes between
its pure functions (see `contracts/release-script.md` for the CLI-level
contract).

## ClassifiedCommit

Represents one commit from the range `<last-tag>..HEAD` on `main`, after
parsing its Conventional Commits header.

| Field | Type | Notes |
|---|---|---|
| `sha` | string | Full commit SHA |
| `type` | string | Conventional Commit type (`feat`, `fix`, `chore`, `docs`, `test`, `ci`, `style`, `refactor`, `perf`, `revert`, ...) |
| `scope` | string \| null | Optional Conventional Commit scope |
| `description` | string | Commit subject text after `type(scope)!: ` |
| `breaking` | boolean | `true` if `!` follows type/scope, or a `BREAKING CHANGE:` footer is present in the commit body |
| `qualifies` | boolean | `false` when `type` is one of `chore/docs/test/ci/style/refactor` **and** `breaking` is `false` (FR-010); `true` otherwise |
| `bumpLevel` | `"major" \| "minor" \| "patch" \| "none"` | Derived: `breaking` → `major`; else `feat` → `minor`; else `fix` → `patch`; else (qualifying via `breaking` only, e.g. `chore!`) → `major`; non-qualifying → `none` |
| `changelogCategory` | `"Added" \| "Changed" \| "Fixed" \| null` | Derived per the Clarifications mapping: `feat` → `Added`; `fix` → `Fixed`; any other qualifying commit → `Changed`; non-qualifying → `null` |
| `malformed` | boolean | `true` when the subject does not parse as Conventional Commits at all (FR-013) — such commits are excluded from `qualifies`/version math but recorded for the visible warning |

**Validation rules**:
- A commit is `malformed` when it has no recognizable `type:` prefix; malformed commits MUST NOT influence `bumpLevel` or produce a changelog line, but MUST be surfaced as a build warning (FR-013).
- `changelogCategory` MUST be `null` whenever `qualifies` is `false`.

## ReleasePlan

The computed outcome for one CI run, derived from the full list of
`ClassifiedCommit`s in range.

| Field | Type | Notes |
|---|---|---|
| `previousVersion` | string | Read from `frontend/package.json` (or `backend/package.json` — both MUST already be equal per SC-002) |
| `bumpLevel` | `"major" \| "minor" \| "patch" \| "none"` | Highest-impact `bumpLevel` across all qualifying commits in range (breaking > feat > fix) |
| `nextVersion` | string \| null | `null` when `bumpLevel` is `none` (no-op run, FR-010); otherwise `previousVersion` incremented per SemVer |
| `date` | string (`YYYY-MM-DD`) | Date the release job runs |
| `entries` | ChangelogEntry[] | One per qualifying commit, grouped by category when rendered |
| `warnings` | string[] | Human-readable notices for each `malformed` commit found in range (FR-013) |

**State transition**: A `ReleasePlan` with `bumpLevel === "none"` MUST result in no file writes, no commit, and no tag — the job still succeeds (exit 0) so it never blocks the existing deploy trigger (FR-011).

## ChangelogEntry

One rendered line under a version heading in the root `CHANGELOG.md`.

| Field | Type | Notes |
|---|---|---|
| `category` | `"Added" \| "Changed" \| "Fixed" \| "Removed"` | `Removed` is reserved for the historical merged entries (Historia 1); the automated generator (Historia 2) only ever emits `Added`/`Changed`/`Fixed` per the Clarifications mapping — no Conventional Commit type maps to `Removed` automatically |
| `description` | string | The commit's `description`, verbatim from its Conventional Commit subject |
| `sourcePackage` | `"backend" \| "frontend" \| "unified"` | `"unified"` for every automated entry from Historia 2 onward; `"backend"`/`"frontend"` only appears in the migrated historical section from Historia 1 |
| `originalVersion` | string \| null | Only set for migrated historical entries — preserves the entry's real historical version number (e.g. `0.13.0`), never a retroactively invented unified number |
| `commitSha` | string \| null | Short SHA (7 chars) of the originating commit, carried over from `ClassifiedCommit.sha`; `null` only for migrated historical entries (Historia 1), where no single commit exists per entry — every automated entry (Historia 2 onward) MUST set this, per SC-004 |

## Root CHANGELOG.md structure (file-level shape, not a data entity but documented here for implementers)

```
# Changelog
<intro: Keep a Changelog + SemVer references, single-project-version note>

## Unified versioning
<marker text: from 0.22.1 the whole project shares one version, computed
automatically by CI from Conventional Commits; entries below this line and
above "Historical merged entries" are added by CI, newest first>

## [X.Y.Z] - YYYY-MM-DD        <- automated entries land here, newest on top
### Added / Changed / Fixed
- ... ([abc1234])

## Historical merged entries (backend + frontend, pre-unification)
<all pre-existing entries from both old changelogs, interleaved by original
date, each keeping its original version number and (backend)/(frontend) tag>
```
