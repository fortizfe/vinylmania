# Implementation Plan: Fix CodeQL Code Quality Gate Alerts

**Branch**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-fix-codeql-quality-alerts/spec.md`

## Summary

Resolve all 25 alerts currently open in the repository's CodeQL code-quality gate report: wire `express-rate-limit` (two tiers — strict for login/OAuth entry points, standard for everything else, each constructed locally per file per research.md §2b) in front of the 17 flagged route handlers across 6 route files; fix `feedMapper.ts`'s entity-decoding order and multi-pass sanitization to remove the double-escaping / incomplete-sanitization defects; anchor two test host-substring checks to `URL.hostname`; remove one useless assignment and two unused test imports; and exclude the non-shipped `docs/` design-brief export from the CodeQL scan via the `codeql-action/init` step's `config:` input.

**Revision note**: the rate-limiting mechanism below was revised mid-implementation after the PR's own `code-quality` gate run proved a hand-rolled Redis limiter, while functionally correct, is invisible to CodeQL's `js/missing-rate-limiting` query (it only recognizes a small allowlist of npm packages — research.md §2b). This plan reflects the shipped `express-rate-limit`-based implementation.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend, `strict` mode via `backend/tsconfig.json`); the two test-only cleanups touch one plain JS file (`scripts/__tests__/run-with-timeout.test.js`) and one TSX test (`frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx`).

**Primary Dependencies**: Express 4.19 (routing/middleware), `express-rate-limit` 8.6 (new — required because CodeQL's `js/missing-rate-limiting` query only recognizes a fixed allowlist of rate-limiting packages, research.md §2b), `ioredis` 5.11 (already a backend dependency, reused via the existing `getRedisClient()`; a custom `INCR`/`PEXPIRE`-based `Store` — not `rate-limit-redis`, whose Lua-scripting requirement is incompatible with `ioredis-mock`, research.md §2c — backs the limiter when Redis is configured), Jest 29 / `ts-jest` (backend tests), `ioredis-mock` (existing dev dependency, used to test the Redis-configured store-construction path).

**Storage**: Redis (optional, via existing `REDIS_URL`/`getRedisClient()`) for rate-limit counters via a custom `INCR`/`PEXPIRE`-based `Store`, falling back to `express-rate-limit`'s own in-memory store when Redis isn't configured; N/A for everything else — this feature makes no Firestore schema changes.

**Testing**: Jest + `ts-jest` for backend unit/integration tests (existing `backend/package.json` `test` script, Firebase-emulator-wrapped); Vitest for the one frontend test file touched (unused-import removal only, no new test needed there).

**Target Platform**: Backend deployed as a single Vercel serverless function (`backend/vercel.json` rewrites `/(.*)` to `/api/index.ts`) — this is why an in-memory-only rate-limit store was rejected in favor of a Redis-backed one in production (research.md §2).

**Project Type**: Web application (existing `backend/` + `frontend/` split; this feature touches `backend/` and two test files only — no frontend production code changes).

**Performance Goals**: No explicit new performance target; the rate limiter adds at most one Redis round-trip per request on the 17 affected routes when Redis is configured, consistent with the existing cache adapter's per-request Redis usage pattern.

**Constraints**: Rate limiter MUST NOT hard-fail a request when Redis is unavailable (falls back to in-memory — research.md §2b); sanitizer fix MUST NOT change `Article` output shape (`feedMapper.ts`'s existing consumers are unaffected); the actual `rateLimit(...)` call MUST be constructed locally in each route file, not imported as a pre-built middleware instance, per the CodeQL cross-file false-negative documented in research.md §2b.

**Scale/Scope**: 25 alerts across 10 files (6 backend route files, 1 backend domain file, 1 backend adapter file, 2 backend test files) + 1 frontend test file + 1 CI workflow file; net-new code is `backend/src/adapters/rateLimit/` (`rateLimitOptions.ts`, `rateLimitStore.ts` — shared values/store only, no shared middleware instance) plus their tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. FR-008 requires a red→green test per fix; quickstart.md §1 lists the specific test files/suites to write first (rate limiter unit tests, `feedMapper` single-pass decode test, anchored-hostname test).
- **II. Discogs Integration-First & Modularity** — N/A. No catalog metadata touched; the two Discogs route files are only touched to add rate-limiting middleware, not to change Discogs integration logic.
- **III. Simplicity, YAGNI & KISS** — PASS, revised justification. One new dependency (`express-rate-limit`) was added despite the original plan's "no new dependency" goal — reversed once the PR's own gate run proved a hand-rolled limiter is invisible to the `js/missing-rate-limiting` query (research.md §2b). `rate-limit-redis` was evaluated but dropped in favor of a ~15-line custom store once it proved incompatible with `ioredis-mock` (research.md §2c) — one fewer dependency than the mid-implementation plan, and simpler than wiring a Lua-script-capable Redis client just for tests. Simplicity/YAGNI governs *unjustified* complexity; satisfying the concrete, external tool this feature exists to pass is a documented justification, not an exception to the principle. `docs/` exclusion remains a small addition to the existing `codeql-action/init` step instead of a new CodeQL config file (research.md §8).
- **IV. SOLID Design** — PASS. Each route file's rate limiter is a narrow, single-purpose `rateLimit(options)` call; the Redis-vs-in-memory store choice is isolated behind `createRateLimitStore()`, swappable without touching any route file's rate-limiting logic (Dependency Inversion on the store, not the whole middleware — see VIII below for why the middleware itself isn't behind a shared abstraction).
- **V. Observability** — PASS. 429 rejections are observable via the standard HTTP response and `express-rate-limit`'s standard headers; the Redis-vs-in-memory store decision reuses `getRedisClient()`'s existing connection-level error logging (`cache_unavailable`) rather than adding a redundant per-request log, consistent with `cacheAdapter`'s existing convention.
- **VI. Versioning & Breaking Changes** — PASS. No API contract or data schema changes; the new 429 response is additive (previously-unthrottled endpoints now also return 429 under abuse, which is not a breaking change to any documented success-path contract).
- **VII. Curated Ratings & Music News** — PASS. The `feedMapper.ts` fix strengthens (does not weaken) the "handle untrusted feed content safely" requirement; no change to graceful per-source degradation behavior.
- **VIII. Hexagonal Architecture (Ports & Adapters) — Backend** — PASS, with a noted, deliberate deviation from the usual port/adapter shape. Unlike `requireAuth` (a single shared middleware instance imported by every route file), each route file constructs its own local `rateLimit(...)` call — no shared `RateLimiterPort`/middleware export exists. This is a direct consequence of a documented CodeQL limitation (research.md §2b: the query fails to recognize a rate-limiting middleware instance that's built in one file and imported into another), not an architectural preference; only non-middleware values (config constants, a handler function, a store factory) are shared via `backend/src/adapters/rateLimit/`. Route files still depend on infra (`express-rate-limit`, `ioredis` via `createRateLimitStore()`) only at the adapter layer, consistent with the principle's core dependency rule — domain/application code imports none of this.
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
