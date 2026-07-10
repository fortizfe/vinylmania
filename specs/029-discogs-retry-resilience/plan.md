# Implementation Plan: Discogs Communication Resilience (Retry Policy)

**Branch**: `029-discogs-retry-resilience` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-discogs-retry-resilience/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Reduce the "catalog service is busy" errors collectors hit while browsing (most visibly on master release detail/version-list navigation) by adding a bounded, automatic retry-with-backoff policy plus an app-wide circuit breaker to the shared Discogs catalog HTTP client. Both live in a single place — the response interceptor of `getDiscogsHttpClient()` in `backend/src/discogs/discogsClient.ts` — so every scoped catalog read (search, release, master, master versions, artist) and the background library-enrichment path (`libraryEnrichment.ts`'s `getRelease` calls) benefit transparently with no call-site changes. A companion fix maps 401/403 responses to the existing `DiscogsAuthError` (mirroring `collectionClient.ts`'s existing pattern) so credential failures — which must never retry per FR-002 — are correctly distinguished from transient failures. Community-rating enrichment and the OAuth-based collection-sync path are explicitly untouched. All new behavior is observable through the existing structured logger.

## Technical Context

**Language/Version**: TypeScript ^5.6 (backend), Node.js

**Primary Dependencies**: Existing `axios` (Discogs HTTP client) and `ioredis`/`cacheAside.ts` (existing cache-aside layer, unchanged). No new production dependencies — retry and circuit-breaker logic are hand-rolled internal modules (research.md §2).

**Storage**: N/A — no Firestore or Redis schema changes. All new state (retry attempt count, circuit breaker state) is transient and in-memory (data-model.md).

**Testing**: Jest + `nock` (existing `backend/tests/{unit,contract,integration}`), plus Jest fake timers — a technique newly introduced to this backend suite to deterministically test backoff delays and the circuit breaker's rolling window/cooldown (research.md §10).

**Target Platform**: Vercel serverless functions (backend, single entry `backend/api/index.ts`) — unchanged deployment target. Circuit breaker state is per-warm-instance, not globally coordinated (research.md §7).

**Project Type**: Web application — backend-only change. No `/frontend` code, no new REST endpoints, no changed request/response contracts (FR-005); the existing frontend error/loading states are reused unchanged.

**Performance Goals**: No added latency when a request succeeds on its first attempt (FR-006/SC-003). When retries are needed, combined backoff-sleep time stays within ~5 seconds (FR-010); worst-case total time (3 attempts × 4s per-attempt timeout + backoff) stays bounded to avoid a perceptible hang (SC-002, research.md §4).

**Constraints**: Retry-eligible failures are limited to HTTP 429 and 5xx/network errors (FR-001); 404 (not found), 401/403 (auth), and validation errors must never retry (FR-002, research.md §5). Retries only ever occur on a live catalog call (cache miss) — the existing cache-aside/single-flight layer in `cacheAside.ts` is unmodified and retries ride along the single shared in-flight attempt (FR-006/FR-007). Circuit breaker is in-memory only, best-effort per serverless instance (research.md §7).

**Scale/Scope**: One shared HTTP client module modified (`backend/src/discogs/discogsClient.ts`), two new small internal modules (`discogsRetry.ts`, `discogsCircuitBreaker.ts`), one error-mapping addition (401/403 → `DiscogsAuthError`), and a `LogOutcome`/`meta.attempts` observability addition (`backend/src/config/logger.ts`). No new user-facing screens, no Firestore schema changes, no new REST endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS (must be honored in tasks) | New retry classifier, backoff schedule, and circuit-breaker state machine need failing tests first (Jest + `nock` + fake timers): retry-then-succeed, retry-exhausted, no-retry-on-404/401/403, circuit-open fail-fast, half-open trial success/failure. |
| II. Discogs Integration-First & Modularity | PASS | New logic lives in `backend/src/discogs/` behind the single shared HTTP client interceptor — directly implements this principle's "rate-limit-aware behavior" and "explicit error handling" mandate. Call sites (`routes/discogs.ts`, `libraryEnrichment.ts`) are unchanged. |
| III. Simplicity, YAGNI & KISS | PASS | Hand-rolled retry (one fixed backoff schedule, no per-failure-type branching, per Clarifications) and a minimal two-state-plus-cooldown circuit breaker — no new dependency, matching the `cacheAside.ts` precedent (feature 011) of small, fully-owned infra modules over a library. |
| IV. SOLID Design | PASS | Retry/circuit-breaker logic extends the existing axios interceptor via composition — `searchCatalog`/`getRelease`/`getMasterRelease`/`getMasterReleaseVersions`/`getArtist` are not modified (Open/Closed preserved). |
| V. Observability | PASS (must be honored in tasks) | FR-008 requires logging attempt outcome; extends `LogOutcome`/`meta` in `backend/src/config/logger.ts`, reusing the existing structured logger exactly as feature 011 did for cache hit/miss. |
| VI. Versioning & Breaking Changes | PASS | No API contract or schema changes (FR-005); additive/internal, MINOR-level version bump. |
| Web App Standards (contracts, migrations, error separation) | PASS | No REST contract changes; internal reliability behavior only. User-facing error message/status is unchanged (FR-005) — internal retry/circuit-breaker mechanics never leak to the client response body. |
| Tech Stack lock | PASS — no new dependency | Retry/circuit breaker hand-rolled within the existing Express/axios stack. |
| Frontend e2e coverage gate | N/A | No `/frontend` code changes in this feature — purely a backend reliability change; existing frontend error/loading UI is reused unchanged. |
| Changelog gate | PASS (must be honored in tasks) | Tasks MUST add a `backend/CHANGELOG.md` entry ("Added: automatic retry + circuit breaker for Discogs catalog requests") and bump `backend/package.json` from `0.10.0` to `0.11.0` (MINOR — new capability, no breaking change). |

No violations requiring Complexity Tracking. The circuit breaker (§6 in research.md) is new stateful infrastructure, but it is directly mandated by an explicit, user-confirmed functional requirement (FR-011) rather than speculative design — not a deviation from Principle III.

## Project Structure

### Documentation (this feature)

```text
specs/029-discogs-retry-resilience/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── discogs-resilience-module.md
│   └── observability-log-fields.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts          # MODIFIED: response interceptor gains retry-with-backoff
│   │   │                              #   + circuit-breaker short-circuit before final error mapping;
│   │   │                              #   401/403 → DiscogsAuthError added; per-attempt timeout tuned.
│   │   ├── discogsRetry.ts           # NEW: classifyForRetry() + backoffDelayMs() (pure functions)
│   │   ├── discogsCircuitBreaker.ts  # NEW: in-memory app-wide breaker (closed/open/half-open)
│   │   └── discogsErrors.ts          # UNCHANGED (existing DiscogsAuthError reused, not modified)
│   ├── library/
│   │   └── libraryEnrichment.ts      # UNCHANGED code path — benefits transitively via getRelease
│   └── config/
│       └── logger.ts                 # MODIFIED: LogOutcome gains 'circuit_open'; meta.attempts added
└── tests/
    ├── unit/
    │   ├── discogsRetry.test.ts          # NEW
    │   └── discogsCircuitBreaker.test.ts # NEW
    ├── contract/
    │   └── discogsClient.contract.test.ts # MODIFIED: retry/no-retry/exhaustion/circuit-breaker cases
    └── integration/
        └── discogsRetryResilience.test.ts # NEW: route-level end-to-end coverage of US1/US2/US3
```

**Structure Decision**: Backend-only change within the existing `backend/` project (no new top-level project, no `/frontend` changes) — follows the same modular layout convention established by `backend/src/discogs/` (feature 002) and `backend/src/cache/` (feature 011): small, single-purpose modules composed into the existing shared HTTP client rather than a rewrite.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
