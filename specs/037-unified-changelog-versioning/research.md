# Phase 0 Research: Unified Changelog with CI-Automated Versioning

No `[NEEDS CLARIFICATION]` markers remain in the spec (one clarification was
resolved in `/speckit-clarify` — see spec `## Clarifications`). The research
below resolves the implementation-level judgment calls the spec's Assumptions
section explicitly deferred to planning: which tool/mechanism computes the
version bump and changelog entry, and how it plugs into the existing
`.github/workflows/ci.yml`.

## Decision: Hand-rolled release script vs. an off-the-shelf tool (semantic-release / release-please / changesets)

- **Decision**: Implement a small, dependency-free Node.js script under
  `scripts/release/` that reads the commit(s) reaching `main`, classifies
  each by Conventional Commit type, computes the lockstep SemVer bump,
  writes both `package.json` files and the root `CHANGELOG.md`, then commits
  and tags. No new third-party release-automation package is added.
- **Rationale**:
  - The spec's clarified categorization rule (`feat`→`Added`, `fix`→`Fixed`,
    everything else that qualifies→`Changed`, as a single catch-all bucket)
    does not match any stock tool's default output. `semantic-release`'s
    `conventional-changelog-conventionalcommits` preset renders Angular-style
    groups (`Features`, `Bug Fixes`, `Performance Improvements`, ...) and
    always emits a *separate* `⚠ BREAKING CHANGES` block regardless of
    per-type config — forcing our exact 3-bucket rule would mean fighting
    the preset rather than using it.
  - Lockstep (one version shared by two `package.json` files) is not
    `semantic-release`'s default mental model (it assumes one
    package.json per run); `changesets`' fixed/lockstep mode exists but its
    core workflow expects a manual changeset file per PR, which directly
    contradicts FR-014 ("no manual editing"). `release-please` opens a
    release PR that a human must still merge as a second step, which is
    softer automation than "the pipeline updates it automatically" (FR-006).
  - Per Principle III (Simplicity, YAGNI & KISS), a ~150-line script with
    four pure functions (parse, classify, bump, format) plus a thin
    orchestrator is simpler to reason about, test, and modify than
    configuring a large plugin pipeline to override its defaults.
- **Alternatives considered**:
  - `semantic-release` — mature and widely used, but its changelog/notes
    plugins are opinionated about grouping and would need a custom
    writer plugin anyway to hit our exact category rule; also its
    "one package.json per project" model doesn't map cleanly onto lockstep
    dual-package versioning without extra glue (`@semantic-release/exec`
    run twice or a custom npm-version step), which erodes the "just use the
    tool" benefit.
  - `release-please` — rejected: introduces a second human-merge step
    (the release PR), which is a softer automation guarantee than what
    FR-006/FR-014 ask for.
  - `changesets` — rejected: core workflow requires a manual changeset
    Markdown file added per PR describing the change, which is exactly the
    manual step this feature exists to remove.

## Decision: Source of "commits since last release"

- **Decision**: Use lightweight annotated git tags (`vMAJOR.MINOR.PATCH`) as
  the durable marker of the last computed release. The migration in User
  Story 1 seeds tag `v0.22.1` at the merge commit that introduces the
  unified `CHANGELOG.md`. Each subsequent CI run diffs `git log
  <last-tag>..HEAD` on `main` to find qualifying commits.
- **Rationale**: Neither existing package.json nor the old changelogs used
  git tags, but tags are the standard, dependency-free way to answer
  "what's new since the last release" without parsing Markdown or trusting
  a mutable file's last heading. They're append-only and cheap, and this is
  exactly the mechanism `semantic-release` itself relies on internally —
  we get the same reliability without the plugin overhead.
- **Alternatives considered**: Parsing the latest `## [X.Y.Z]` heading out of
  `CHANGELOG.md` to find the "last released" SHA (rejected — fragile, and
  the file doesn't currently store a SHA per entry, so it can't answer
  "which commits are new" on its own); a separate JSON state file
  tracking the last processed SHA (rejected — a second source of truth that
  can drift from git history; a tag *is* git history).

## Decision: Where the release logic runs (workflow shape)

- **Decision**: Add a third job (`release`) to the existing
  `.github/workflows/ci.yml`, gated with `needs: [backend-test,
  frontend-test]` and `if: github.event_name == 'push' && github.ref ==
  'refs/heads/main'`. It checks out with full git history (`fetch-depth:
  0`) and write-permitted `contents: write`, runs the release script, and
  — only if it computed a bump — commits `CHANGELOG.md` +
  both `package.json` files, tags, and pushes.
- **Rationale**: Reuses the exact trigger/test gating that already exists
  (no duplicated `on:` block in a second workflow file); keeps release
  computation strictly after both test jobs pass, so a broken PR can never
  reach a version bump. A single workflow file is also simpler to reason
  about than coordinating two (Principle III).
- **Alternatives considered**: A separate `release.yml` workflow triggered
  independently on `push: branches: [main]` (rejected — duplicates the
  `on.push` trigger and loses the implicit "only after tests pass"
  ordering that `needs:` gives for free within one workflow).

## Decision: Avoiding an infinite CI loop from the release commit itself

- **Decision**: The release job's own commit message is prefixed
  `chore(release): vX.Y.Z [skip ci]`. GitHub Actions honors `[skip ci]` in
  a commit message pushed via `push`, so the workflow does not re-trigger
  itself. As a second, independent guard, the release script also exits
  as a no-op (FR-010 behavior) when the only commit(s) in range are
  release commits or non-qualifying types.
- **Rationale**: `[skip ci]` is the standard, zero-dependency GitHub
  Actions mechanism for exactly this problem; the second guard (type-based
  no-op) means even if `[skip ci]` were ever stripped by a force-push or
  rebase, the job still can't loop because a `chore(release):` commit by
  itself is a non-qualifying type per FR-010.
- **Alternatives considered**: Using a separate bot/PAT identity and
  branch-protection bypass rules to distinguish "release commits" from
  "human commits" (rejected — more moving parts than needed; `[skip ci]`
  already solves the immediate problem).

## Decision: Concurrency safety across rapidly-merged PRs (FR-012)

- **Decision**: Add a `concurrency: { group: release-main,
  cancel-in-progress: false }` block to the `release` job. Runs for
  different pushes queue and execute strictly one-at-a-time, each starting
  its git diff from the tag left by the previous run.
- **Rationale**: `cancel-in-progress: false` is essential here (unlike
  typical CI-cancellation use of `concurrency`) — a queued release run
  must still execute, not be cancelled, or a merged PR's version bump would
  be silently dropped. Sequential execution guarantees the second run's
  `<last-tag>..HEAD` diff always starts from a consistent, already-pushed
  state, eliminating the race the spec's edge case describes.
- **Alternatives considered**: Optimistic push-with-retry (fetch, rebase,
  retry on push rejection) without a concurrency gate (rejected — works
  but is strictly more complex than letting GitHub Actions serialize the
  jobs, for no added benefit here since release pushes are infrequent).

## Decision: Language/runtime for the script and its tests

- **Decision**: Plain Node.js (CommonJS, matching `backend`'s
  `"type": "commonjs"`), no TypeScript build step, using only Node built-ins
  (`fs`, `child_process` for `git` calls). Tests use Node's built-in test
  runner (`node --test`), not Jest/Vitest, so no new devDependency is
  required at all.
- **Rationale**: This script only runs inside CI, is not shipped to users,
  and has no dependency on either app's runtime — adding TypeScript
  compilation or a test framework dependency for ~4 small pure functions
  would be exactly the kind of premature infrastructure Principle III warns
  against. `node --test` has shipped stable in Node 18+, and CI already
  pins Node 20.
- **Alternatives considered**: TypeScript (rejected — no type-safety benefit
  proportional to the script's size, and adds a build step); Jest (rejected
  — already a devDependency in `backend/`, but pulling it into a new root
  package for 4 functions is unjustified weight); a shell script (rejected
  — Conventional Commit parsing and Markdown generation are meaningfully
  easier and more testable in Node than in `bash`/`awk`).

## Source material for the Historia 1 migration

Derived directly from the two existing changelogs to be merged:

- `backend/CHANGELOG.md`: 15 dated entries, `0.1.0` → `0.13.1`.
- `frontend/CHANGELOG.md`: 25 dated entries, `0.1.0` → `0.22.1`.
- Both already use Keep a Changelog categories and have no `[Unreleased]`
  section (per the constitution's existing "no Unreleased" rule, unchanged
  by this feature), so the merge is a straight chronological interleave by
  each entry's existing date, tagged with its originating package.
