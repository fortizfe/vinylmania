# Quickstart: Validating the CodeQL Alert Remediation

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19

## Prerequisites

- On branch `056-fix-codeql-quality-alerts` with the remediation implemented.
- `gh` CLI authenticated against this repo (already used in earlier steps of this session).
- Backend dev dependencies installed (`cd backend && npm install`); Firebase emulator available for the full test run (`npm test` per `backend/package.json`).
- Optional: a local Redis (or leave `REDIS_URL` unset to exercise the fail-open path).

## 1. Automated tests (per-fix, fast feedback)

Each fix in this feature has a dedicated automated test — run them individually while implementing, per FR-008:

```bash
cd backend
npx jest tests/unit/rateLimit                       # new RateLimiterPort/adapter unit tests
npx jest tests/unit/feeds/domain/feedMapper          # decodeEntities / cleanText single-pass tests
npx jest tests/unit/feeds/domain/feedSources.test.ts # anchored hostname check
npx jest tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts
```

Expected: all pass; each new/modified test fails on the pre-fix code (confirm once with `git stash` if in doubt) and passes after.

## 2. Full backend suite (before opening the PR, not on every local iteration — matches this project's existing e2e/test-gating convention)

```bash
cd backend && npm test
```

Expected: green, including the existing `discogsRateLimitSmoothing` integration tests (unrelated outbound-rate-limiting feature — confirms the new inbound rate limiter doesn't collide with it).

## 3. Manual rate-limit check (one endpoint, local dev server)

```bash
cd backend && npm run dev &
# Hit a strict-tier endpoint past its threshold (10/60s):
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/auth/google/authorize; done
```

Expected: the first 10 responses are `302` (redirect to Google), the 11th and 12th are `429` with a `Retry-After` header.

## 4. Confirm the `docs/` scan-scope exclusion

```bash
grep -A2 "paths-ignore" .github/workflows/ci.yml
```

Expected: shows `docs/**` under the `code-quality` job's `codeql-action/init` step (see `contracts/codeql-scan-config.md`).

## 5. Confirm the gate against the live CodeQL report (post-merge to `main`, matching how the original alerts were discovered)

```bash
gh api repos/:owner/:repo/code-scanning/alerts --paginate \
  -q '.[] | select(.state == "open") | {number, rule: .rule.id, path: .most_recent_instance.location.path}'
```

Expected (SC-001/SC-002): no output — zero open alerts. Until this feature's PR is merged and `main` is re-scanned, this command still shows the pre-fix 25; run it against the feature branch's own PR-triggered scan (`gh api repos/:owner/:repo/code-scanning/alerts --paginate -q '.[] | select(.state == "open")'` scoped with `?ref=refs/pull/<PR#>/head` if verifying pre-merge) to confirm the fix before merging.

## 6. Confirm no regression on unrelated PRs (SC-005)

Not directly testable pre-merge — verified operationally after this feature merges: the next unrelated PR's `code-quality` job should pass without any pre-existing alert needing dismissal, since none remain open.
