# Contract: Release Script (`scripts/release/`)

This feature has no HTTP/API surface. Its external contract is the
command-line interface of the release script invoked by the GitHub Actions
`release` job, plus the file-write contract it makes with the repository.

## CLI contract

**Invocation** (from repo root, inside the `release` job):

```sh
node scripts/release/run-release.js
```

**Inputs** (implicit, read by the script itself — no CLI flags):

- Git history of `main` from the most recent `vX.Y.Z` tag to `HEAD`
  (`git log <last-tag>..HEAD --format=...`).
- Current version, read from `frontend/package.json`'s `version` field
  (asserted equal to `backend/package.json`'s `version` — a mismatch here
  is a hard failure, since lockstep equality is the feature's own
  invariant, SC-002).

**Outputs**:

- Exit code `0` in both outcomes below (a no-op run is success, not
  failure — FR-011 requires the deploy trigger stays untouched):
  - **No qualifying commits** (`ReleasePlan.bumpLevel === "none"`): no files
    written, no commit, no tag. Script prints a one-line summary to stdout.
  - **Qualifying commits found**: writes `CHANGELOG.md`,
    `backend/package.json`, `frontend/package.json`; creates commit
    `chore(release): vX.Y.Z [skip ci]`; creates annotated tag `vX.Y.Z`;
    pushes both to `main` (the job, not the script, holds the
    `contents: write` permission and remote credentials).
- Exit code `1` only for genuine failures unrelated to commit content
  (e.g., `frontend/package.json` and `backend/package.json` versions
  already disagree before this run started, or git history is
  unreadable). This is the only case that should fail the CI job.
- One `::warning::` GitHub Actions annotation per malformed commit found in
  range (FR-013) — printed to stdout/stderr, does not affect the exit
  code.

## Internal function contract (unit-tested per Principle I)

These are the pure functions the orchestrator composes; each is
independently unit-testable with `node --test` against fixed commit-message
fixtures (no git/filesystem access required for these four):

| Function | Input | Output | Notes |
|---|---|---|---|
| `parseCommit(rawSubject, rawBody)` | raw commit subject + body strings | `ClassifiedCommit` (partial: `type`, `scope`, `description`, `breaking`, `malformed`) | Pure string parsing, no I/O |
| `classifyCommit(parsed)` | output of `parseCommit` | `ClassifiedCommit` (adds `qualifies`, `bumpLevel`, `changelogCategory`) | Pure, implements the FR-010 exclusion list and the Clarifications category mapping |
| `computeReleasePlan(classifiedCommits[], previousVersion, date)` | array of `ClassifiedCommit` + current version + date | `ReleasePlan` | Pure; picks highest-impact `bumpLevel`, computes `nextVersion` via SemVer increment, collects `warnings` from `malformed` entries |
| `renderChangelogSection(releasePlan)` | `ReleasePlan` | Markdown string (the `## [X.Y.Z] - YYYY-MM-DD` block to insert) | Pure string formatting, no file I/O |

The orchestrator (`run-release.js`) is the only part that touches `git`,
`fs`, or `process.exit` — it is exercised via the `quickstart.md` manual/dry-run
validation rather than unit tests, consistent with keeping I/O at the edges.
