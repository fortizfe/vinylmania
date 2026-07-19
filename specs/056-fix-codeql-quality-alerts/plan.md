# Implementation Plan: Fix CodeQL Code Quality Gate Alerts

**Branch**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-fix-codeql-quality-alerts/spec.md`

## Summary

Resolve all 25 alerts currently open in the repository's CodeQL code-quality gate report: add a new Redis-backed, fail-soft `RateLimiterPort`/adapter (two tiers — strict for login/OAuth entry points, standard for everything else) wired in front of the 17 flagged route handlers across 6 route files; fix `feedMapper.ts`'s entity-decoding order and multi-pass sanitization to remove the double-escaping / incomplete-sanitization defects; anchor two test host-substring checks to `URL.hostname`; remove one useless assignment and two unused test imports; and exclude the non-shipped `docs/` design-brief export from the CodeQL scan via a one-line `paths-ignore` addition to the existing `code-quality` job.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend, `strict` mode via `backend/tsconfig.json`); the two test-only cleanups touch one plain JS file (`scripts/__tests__/run-with-timeout.test.js`) and one TSX test (`frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx`).

**Primary Dependencies**: Express 4.19 (routing/middleware), `ioredis` 5.11 (already a backend dependency, reused for the new rate limiter — no new dependency added, see research.md §2), Jest 29 / `ts-jest` (backend tests), `ioredis-mock` (existing dev dependency, used to test the Redis-unavailable fail-open path without a real Redis instance).

**Storage**: Redis (optional, via existing `REDIS_URL`/`getRedisClient()`) for ephemeral rate-limit counters only; N/A for everything else — this feature makes no Firestore schema changes.

**Testing**: Jest + `ts-jest` for backend unit/integration tests (existing `backend/package.json` `test` script, Firebase-emulator-wrapped); Vitest for the one frontend test file touched (unused-import removal only, no new test needed there).

**Target Platform**: Backend deployed as a single Vercel serverless function (`backend/vercel.json` rewrites `/(.*)` to `/api/index.ts`) — this is why an in-memory rate-limit store was rejected in favor of Redis (research.md §2).

**Project Type**: Web application (existing `backend/` + `frontend/` split; this feature touches `backend/` and two test files only — no frontend production code changes).

**Performance Goals**: No explicit new performance target; the rate limiter adds at most one Redis round-trip (`INCR`+conditional `EXPIRE`) per request on the 17 affected routes, consistent with the existing cache adapter's per-request Redis usage pattern.

**Constraints**: Rate limiter MUST be fail-soft (never reject a request due to a Redis outage — research.md §2); sanitizer fix MUST NOT change `Article` output shape (`feedMapper.ts`'s existing consumers are unaffected); no new npm dependency.

**Scale/Scope**: 25 alerts across 10 files (6 backend route files, 1 backend domain file, 1 backend adapter file, 2 backend test files) + 1 frontend test file + 1 CI workflow file; net-new code is one port + one adapter pair (~2 files) plus their tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. FR-008 requires a red→green test per fix; quickstart.md §1 lists the specific test files/suites to write first (rate limiter unit tests, `feedMapper` single-pass decode test, anchored-hostname test).
- **II. Discogs Integration-First & Modularity** — N/A. No catalog metadata touched; the two Discogs route files are only touched to add rate-limiting middleware, not to change Discogs integration logic.
- **III. Simplicity, YAGNI & KISS** — PASS. Rate limiter implemented with 2 Redis commands and no new dependency instead of pulling in `express-rate-limit`/`rate-limiter-flexible` (research.md §2); `docs/` exclusion is a 1-line addition to an existing step instead of a new CodeQL config file (research.md §8).
- **IV. SOLID Design** — PASS. `RateLimiterPort` is a narrow, single-purpose interface (`checkAndIncrement`); the Redis adapter is swappable without touching any route file (Dependency Inversion), mirroring the existing `CachePort` precedent exactly.
- **V. Observability** — PASS. Rate-limiter fail-open path logs a structured `ratelimit_unavailable` warning (same shape as the existing `cache_unavailable` log), and 429 rejections are observable via the standard HTTP response; no silent failure mode introduced.
- **VI. Versioning & Breaking Changes** — PASS. No API contract or data schema changes; the new 429 response is additive (previously-unthrottled endpoints now also return 429 under abuse, which is not a breaking change to any documented success-path contract).
- **VII. Curated Ratings & Music News** — PASS. The `feedMapper.ts` fix strengthens (does not weaken) the "handle untrusted feed content safely" requirement; no change to graceful per-source degradation behavior.
- **VIII. Hexagonal Architecture (Ports & Adapters) — Backend** — PASS, with a noted caveat. New `RateLimiterPort` (interface only) + `backend/src/adapters/rateLimit/` (Redis implementation + Express middleware translator) follows the exact existing `CachePort`/cache-adapter shape; route files depend on the port's exported middleware, never on `ioredis` directly. Caveat: the principle's text reserves the "transversal, no port needed" exception for modules with *no infrastructure dependency* (logger, pure algorithms) and otherwise calls for "one subfolder per business domain" — a Redis-backed, non-domain-named module like `cache/` (and now `rateLimit/`) doesn't cleanly fit either category on a literal reading. This is a pre-existing tension inherited from the already-accepted `cache/` precedent, not something this feature introduces; `rateLimit/` deliberately mirrors that precedent rather than inventing a third convention. Flagged here for visibility, not treated as a blocking violation.
- **IX. Frontend Network Requests — Backend-Only** — N/A. No frontend network code touched.
- **Development Workflow (Quality Gates)** — PASS. This entire feature exists to make the `code-quality` gate (introduced under this same workflow section) pass; commit messages will follow Conventional Commits as already practiced across specs 001–055.

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/056-fix-codeql-quality-alerts/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   ├── rate-limiter-port.md         # Phase 1 output
│   └── codeql-scan-config.md        # Phase 1 output
├── checklists/requirements.md
└── tasks.md                         # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing hexagonal `backend/` layout (Principle VIII), extended with one new cross-cutting port/adapter pair mirroring the existing `cache` one; all other changes are edits to existing files:

```text
backend/
├── src/
│   ├── ports/
│   │   ├── cache/cachePort.ts                          # existing, unchanged — pattern to mirror
│   │   └── rateLimit/rateLimiterPort.ts                 # NEW
│   ├── adapters/
│   │   ├── cache/redisClient.ts                         # existing, unchanged — getRedisClient() reused
│   │   ├── rateLimit/
│   │   │   ├── redisRateLimiterAdapter.ts                # NEW
│   │   │   └── requireRateLimit.ts                       # NEW (Express middleware factory)
│   │   ├── users/authRoutes.ts                           # EDIT: wire requireRateLimit('standard')
│   │   ├── library/libraryRoutes.ts                      # EDIT: wire requireRateLimit('standard')
│   │   ├── googleAuth/googleAuthRoutes.ts                # EDIT: wire requireRateLimit('strict')
│   │   ├── feeds/feedsRoutes.ts                          # EDIT: wire requireRateLimit('standard')
│   │   ├── discogsOauth/discogsRoutes.ts                 # EDIT: wire requireRateLimit (mixed tiers)
│   │   ├── discogsCatalog/discogsRoutes.ts                # EDIT: wire requireRateLimit('standard')
│   │   └── discogsOauth/discogsCollectionAdapter.ts        # EDIT: remove useless `pages` initializer
│   └── domain/
│       └── feeds/feedMapper.ts                            # EDIT: single-pass decode, reorder strip/decode
├── tests/
│   ├── unit/
│   │   ├── rateLimit/                                     # NEW: port/adapter unit tests
│   │   └── feeds/domain/
│   │       ├── feedMapper.test.ts                         # EDIT (file already exists): sanitization tests
│   │       └── feedSources.test.ts                        # EDIT: anchor hostname check (js/incomplete-url-substring-sanitization)
│   └── integration/
│       └── feeds/feedsDashboardExpandedSources.integration.test.ts  # EDIT: same anchoring fix
scripts/
└── __tests__/run-with-timeout.test.js                     # EDIT: remove unused `spawn`

frontend/
└── tests/unit/filters/CollapsibleFilterPanel.test.tsx      # EDIT: remove unused `vi` import

.github/workflows/ci.yml                                    # EDIT: add paths-ignore: [docs/**] to code-quality job
```

**Structure Decision**: All backend changes live inside the existing 4-layer hexagonal structure (Principle VIII) — the only new module (`rateLimit`) gets its own port + adapter pair placed at the same top level as the existing `cache` pair, since it's a cross-cutting infrastructure concern used by 6 different business domains, not owned by any single one of them. No new top-level directories, no frontend production-code changes, no new domain folder.

## Complexity Tracking

No violations — the Constitution Check above passed with no items requiring justification, so this section is intentionally empty.
