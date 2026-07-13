# Implementation Plan: Discogs Rate Limit Smoothing & Call Reduction

**Branch**: `040-discogs-rate-limit-smoothing` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/040-discogs-rate-limit-smoothing/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Stop relying on Discogs' 429 response as the only signal that the app is over budget. Add a
preventive, in-memory local throttle (`discogsRateLimiter.ts`) that reads the
`X-Discogs-Ratelimit*` headers Discogs already returns on every response and spaces out outgoing
requests once the remaining per-minute budget runs low — shared by both the catalog client
(`discogsClient.ts`) and the OAuth collection client (`collectionClient.ts`), since both consume
the same per-IP limit. Bound search-result rating-enrichment concurrency to 5 in-flight Discogs
calls (matching the existing library-enrichment concurrency), removing the single largest known
source of request bursts. Extend feature 029's existing retry-with-backoff and circuit-breaker
policy — today catalog-only — to the collection client's safely-idempotent calls (reads,
`setRating`, `setFieldValue`, `deleteInstance`), explicitly excluding the non-idempotent
`addReleaseToCollection` write from automatic retry. All three changes are internal,
request-handling behavior only — no REST contract, schema, or frontend changes.

## Technical Context

**Language/Version**: TypeScript ^5.6 (backend), Node.js

**Primary Dependencies**: Existing `axios` (both Discogs HTTP clients) only. No new production
dependencies — the local throttle, like feature 029's retry/circuit-breaker, is a hand-rolled
internal module (research.md §1).

**Storage**: N/A — no Firestore or Redis schema changes. All new state (rate-limit budget
estimate, retry attempt count reused from feature 029) is transient and in-memory
(data-model.md). The local throttle is explicitly per-process, not Redis-backed (spec
Assumptions/Out of Scope).

**Testing**: Jest + `nock` + fake timers (existing `backend/tests/{unit,contract,integration}`
pattern, continuing feature 029's precedent for this exact area of the codebase). Per the spec's
Assumptions, the Playwright e2e suite (`/e2e`) is **not** run during this feature's local
implementation loop — a pre-existing, unrelated e2e bug must be fixed first (tracked separately);
this is a backend-only feature so no e2e coverage is owed regardless (Constitution's e2e gate only
applies to `/frontend`-changing PRs).

**Target Platform**: Vercel serverless functions (backend, single entry `backend/api/index.ts`) —
unchanged deployment target. The rate-limit budget, like the existing circuit breaker, is
per-warm-instance, not globally coordinated across serverless instances (spec Edge Cases,
Assumptions).

**Project Type**: Web application — backend-only change. No `/frontend` code, no new REST
endpoints, no changed request/response contracts.

**Performance Goals**: No added latency for a request when the budget is ample (throttle delay
`0`, FR-003/Acceptance Scenario 3). When spacing is needed, a single request's added delay is
capped at `MAX_WAIT_MS = 1_500`ms (FR-003a), staying inside the existing `PER_ATTEMPT_TIMEOUT_MS`
(4000ms)/`RATING_LOOKUP_TIMEOUT_MS` (2000ms) budgets. Search-result rating enrichment stays
bounded to 5 concurrent Discogs calls per search (FR-009/SC-002), keeping a cold-cache search
feeling fast.

**Constraints**: The throttle must degrade fail-soft (FR-005) — never block indefinitely, never
drop a request. Cold start assumes the documented authenticated limit (60/min) as the default
budget (FR-006). `addReleaseToCollection` (non-idempotent) must never auto-retry (FR-016), even
though it remains circuit-breaker-eligible. The existing reactive retry/circuit-breaker for the
catalog client is reused unchanged, not replaced (FR-007).

**Scale/Scope**: One new small internal module (`discogsRateLimiter.ts`), targeted modifications
to two existing HTTP client interceptors (`discogsClient.ts`, `collectionClient.ts`), one
concurrency-bounding change in `searchCatalog()`, one file relocation
(`library/concurrency.ts` → `shared/concurrency.ts`), and an observability addition
(`config/logger.ts`). No new user-facing screens, no Firestore schema changes, no new REST
endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS (must be honored in tasks) | New throttle delay formula, header-correction logic, and the collection client's retry/breaker extension need failing tests first (Jest + `nock` + fake timers): threshold crossing, `MAX_WAIT_MS` cap, fail-soft fallback, retry-then-succeed/exhaustion parity with the catalog client, `addReleaseToCollection` retry exclusion, shared breaker state across both clients, and bounded search-enrichment concurrency. |
| II. Discogs Integration-First & Modularity | PASS | New logic lives in `backend/src/discogs/` (rate limiter) and extends the existing modular client/interceptor layers — directly implements this principle's "rate-limit-aware behavior" mandate, and is exactly the kind of "reduce redundant Discogs requests" optimization the principle calls for. |
| III. Simplicity, YAGNI & KISS | PASS | Hand-rolled throttle (no new dependency, one delay formula, no per-endpoint tuning) matching the `cacheAside.ts`/`discogsCircuitBreaker.ts` precedent; retry/breaker extension to the collection client reuses feature 029's existing pure functions/singleton unmodified rather than building a new shared interceptor abstraction for two call sites (research.md §4). |
| IV. SOLID Design | PASS | Throttle and retry/breaker reuse are added via composition (new module + interceptor extensions), not by rewriting `discogsClient.ts`'s or `collectionClient.ts`'s existing exported functions — none of `searchCatalog`/`getRelease`/`getMasterRelease`/`getArtist`/`listAllInstances`/`setRating`/etc. change signature or call-site usage. The `mapWithConcurrency` relocation (research.md §6) corrects an existing cross-domain dependency-direction smell rather than introducing one. |
| V. Observability | PASS (must be honored in tasks) | FR-001–FR-003a's spacing behavior and FR-005's fail-soft fallback need to be independently verifiable per SC-003; adds `'throttled'`/`'throttle_unavailable'` to `LogOutcome` (`backend/src/config/logger.ts`), reusing the existing structured logger exactly as feature 029 did for `circuit_open`. |
| VI. Versioning & Breaking Changes | PASS | No API contract or schema changes; additive/internal behavior only — MINOR-level change (new capability, no breaking change). |
| Web App Standards (contracts, migrations, error separation) | PASS | No REST contract changes; internal reliability/performance behavior only. User-facing error messages/status codes are unchanged — a request that used to eventually 429 now more often just succeeds, slightly later. |
| Tech Stack lock | PASS — no new dependency | Throttle and retry/breaker extension hand-rolled within the existing Express/axios stack. |
| Frontend e2e coverage gate | N/A | No `/frontend` code changes in this feature — purely a backend reliability/performance change; existing frontend error/loading UI is reused unchanged. |
| Changelog / version-bump gate | PASS — no manual action | Per the current Development Workflow gate, `backend/CHANGELOG.md`/`package.json` version are derived automatically from Conventional Commit messages in CI; tasks MUST NOT hand-edit either (unlike feature 029's now-superseded manual step). |

No violations requiring Complexity Tracking. The new `discogsRateLimiter.ts` singleton is new
stateful infrastructure, but it is directly mandated by explicit, user-confirmed functional
requirements (FR-001–FR-006) rather than speculative design — not a deviation from Principle III.

## Project Structure

### Documentation (this feature)

```text
specs/040-discogs-rate-limit-smoothing/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── discogs-rate-limiter-module.md
│   ├── collection-client-resilience.md
│   ├── search-rating-concurrency.md
│   └── observability-log-fields.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts              # MODIFIED: request interceptor gains acquireSlot() throttle
│   │   │                                  #   call (unconditional, before/independent of the existing
│   │   │                                  #   circuit-breaker short-circuit check); response interceptor
│   │   │                                  #   calls recordRateLimitHeaders() on every response.
│   │   │                                  #   searchCatalog() switches rating enrichment from
│   │   │                                  #   Promise.all to mapWithConcurrency (SEARCH_RATING_CONCURRENCY=5).
│   │   ├── discogsRateLimiter.ts         # NEW: acquireSlot() + recordRateLimitHeaders() singleton
│   │   ├── discogsRetry.ts               # UNCHANGED (existing pure functions reused by collectionClient.ts)
│   │   ├── discogsCircuitBreaker.ts      # UNCHANGED (existing singleton reused by collectionClient.ts)
│   │   ├── discogsErrors.ts              # UNCHANGED
│   │   └── collection/
│   │       └── collectionClient.ts       # MODIFIED: createClient() gains retry-with-backoff +
│   │                                      #   circuit-breaker + throttle in its interceptors, reusing
│   │                                      #   discogsRetry.ts/discogsCircuitBreaker.ts/
│   │                                      #   discogsRateLimiter.ts; addReleaseToCollection's request
│   │                                      #   passes __skipRetry: true.
│   ├── shared/
│   │   └── concurrency.ts                # NEW location for mapWithConcurrency (relocated, unchanged
│   │                                      #   implementation, from library/concurrency.ts)
│   ├── library/
│   │   ├── concurrency.ts                # REMOVED (relocated to shared/concurrency.ts)
│   │   └── libraryEnrichment.ts          # MODIFIED: import path only (mapWithConcurrency from shared/)
│   └── config/
│       └── logger.ts                     # MODIFIED: LogOutcome gains 'throttled'/'throttle_unavailable'
└── tests/
    ├── unit/
    │   └── discogsRateLimiter.test.ts         # NEW
    ├── contract/
    │   ├── discogsClient.contract.test.ts     # MODIFIED: throttle-under-pressure + search-concurrency cases
    │   └── collectionClient.contract.test.ts  # NEW: retry/exhaustion/no-retry/shared-breaker cases
    └── integration/
        └── discogsRateLimitSmoothing.test.ts  # NEW: route-level end-to-end coverage of US1/US2/US3
```

**Structure Decision**: Backend-only change within the existing `backend/` project (no new
top-level project, no `/frontend` changes) — follows the same modular layout convention
established by `backend/src/discogs/` (feature 002) and extended by feature 029
(`discogsRetry.ts`/`discogsCircuitBreaker.ts`). The one new `backend/src/shared/` directory holds
`mapWithConcurrency`, now used by two domains (`discogs/` and `library/`) — see research.md §6 for
why it moves out of `library/` rather than being imported cross-domain in place.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No Constitution Check violations — this section is intentionally empty.
