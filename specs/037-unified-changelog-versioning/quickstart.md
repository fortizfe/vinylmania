# Quickstart: Validating the Unified Changelog & Automated Versioning

## Prerequisites

- Node.js 20 (matches `.github/workflows/ci.yml`)
- A local clone with full git history (`git fetch --unshallow` if you cloned shallow)
- No new global tools to install — the release script has no external dependencies

## Part 1 — Validating the Historia 1 migration (merged CHANGELOG.md)

1. Confirm the new root file exists and is well-formed:
   ```sh
   test -f CHANGELOG.md && echo "root CHANGELOG.md present"
   ```
2. Spot-check that every entry from both old files is represented:
   ```sh
   grep -c '^## \[' backend/CHANGELOG.md frontend/CHANGELOG.md CHANGELOG.md
   ```
   The root file's heading count should be `>=` the sum of the two old
   files' heading counts (equal, unless entries sharing an identical
   version+date were intentionally combined — see `data-model.md`).
3. Confirm the "Unified versioning" marker is present and precedes the
   merged historical section (see `data-model.md`'s file-structure diagram):
   ```sh
   grep -n "## Unified versioning" CHANGELOG.md
   grep -n "## Historical merged entries" CHANGELOG.md
   ```
4. Confirm both packages report the same starting version:
   ```sh
   node -p "require('./backend/package.json').version"
   node -p "require('./frontend/package.json').version"
   # both must print 0.22.1
   ```
5. Confirm the old per-package changelogs still exist untouched (frozen,
   not deleted):
   ```sh
   test -f backend/CHANGELOG.md && test -f frontend/CHANGELOG.md && echo "both preserved"
   ```

**Expected outcome**: a single root `CHANGELOG.md` with the full merged
history, a clear unified-versioning marker at `0.22.1`, and both
`package.json` files reporting `0.22.1`.

## Part 2 — Validating the release script locally (dry run, no push)

The pure functions are unit-tested directly; this section validates the
orchestrator end-to-end without touching the real `main` branch.

1. Run the unit tests:
   ```sh
   npm test --prefix . 2>/dev/null || node --test scripts/release
   ```
   **Expected**: all `parseCommit` / `classifyCommit` / `computeReleasePlan`
   / `renderChangelogSection` test cases pass, including fixtures for:
   `feat: ...` → `Added`/minor, `fix: ...` → `Fixed`/patch, `feat!: ...` →
   `Added`/major (breaking), `chore: ...` → excluded/no-op, `chore!: ...` →
   `Changed`/major (breaking overrides the exclusion), and a malformed
   subject with no recognizable type → warning + excluded.

2. Simulate a release computation against a throwaway range without
   pushing anything:
   ```sh
   git log v0.22.1..HEAD --format='%H%x1f%s%x1f%b%x1e' > /tmp/range.txt
   node -e "
     const { computeReleasePlan } = require('./scripts/release/compute-bump.js');
     // feed /tmp/range.txt through parseCommit/classifyCommit and print the ReleasePlan
   "
   ```
   **Expected**: the printed `ReleasePlan` shows the correct `bumpLevel`,
   `nextVersion`, and one `ChangelogEntry` per qualifying commit, matching
   what you'd expect from `git log` in that range.

3. Confirm a range with only non-qualifying commits (e.g. only `docs:`/
   `chore:` without `!`) produces `bumpLevel: "none"` and an empty
   `entries` array — this is the FR-010 no-op path.

## Part 3 — Validating the GitHub Actions integration

1. Open `.github/workflows/ci.yml` and confirm the new `release` job:
   - has `needs: [backend-test, frontend-test]`
   - has `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
   - has `concurrency: { group: release-main, cancel-in-progress: false }`
   - checks out with `fetch-depth: 0`
2. Push a throwaway `feat:`/`fix:` commit to a test branch, open and merge
   a PR to `main` in a scratch/fork context (do **not** do this against the
   real `main` for validation purposes unless intentionally releasing).
3. **Expected outcome**: the `release` job runs after both test jobs pass,
   computes the correct bump, commits `chore(release): vX.Y.Z [skip ci]`,
   tags it, and — because of `[skip ci]` — does not re-trigger the workflow.
   Vercel's own deploy trigger (a separate integration, out of scope here)
   still fires on the push exactly as before.

## Troubleshooting

- **Both `package.json` versions disagree before a run starts**: the
  script exits `1` and fails the job — this indicates manual drift and
  must be fixed by hand once, restoring the lockstep invariant (SC-002).
- **A commit doesn't show up in the changelog**: check the job log for a
  `::warning::` annotation — it was likely `malformed` (FR-013) or a
  non-qualifying type without `!` (FR-010), both by design.
