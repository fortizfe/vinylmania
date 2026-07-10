# Phase 1 Data Model: Discogs Communication Resilience (Retry Policy)

This feature introduces no Firestore schema changes and no new persisted business entities, consistent with the spec's Key Entities note ("this feature changes request-handling behavior only"). The two concepts below are transient, in-memory operational state — described here for implementation clarity, not as a database migration.

## Retry Attempt (backend, in-memory, per in-flight request)

Tracks how many times the current outbound Discogs request has been tried, scoped to a single logical request (one call to `searchCatalog`/`getRelease`/`getMasterRelease`/`getMasterReleaseVersions`/`getArtist`, or the `getRelease` call inside `libraryEnrichment.ts`).

| Field | Type | Notes |
|---|---|---|
| `attempt` | `number` (1–3) | Incremented on each try; attempt 1 is the original request, attempts 2–3 are retries. Carried on the axios request config across re-issues (mirrors how `axios-retry` tracks retry count), not stored anywhere durable. |
| `lastFailureReason` | `'rate_limited' \| 'unavailable'` | Set only when an attempt fails retryably; drives the fixed backoff schedule for the next attempt (research.md §3) — does not change the schedule's timing, only recorded for the final log line's `meta`. |

**Relationships**: Feeds the `meta.attempts` field on the existing structured log line (`backend/src/config/logger.ts`) once the request finally resolves (success or exhaustion) — see research.md §9. Also feeds one strike into **Circuit Breaker State** below, but only once, when a request's retries are fully exhausted (not once per attempt).

**Lifecycle**: created when a request enters the retry-aware interceptor → discarded the moment the request resolves (success) or exhausts its budget (failure) — never persisted beyond the single request's lifetime.

## Circuit Breaker State (backend, in-memory, app-wide singleton)

One shared state machine per warm backend process, covering every request that goes through the shared Discogs catalog HTTP client (`getDiscogsHttpClient()` in `discogsClient.ts`) — see research.md §6–7 for the accepted per-instance (not globally coordinated) scope.

| Field | Type | Notes |
|---|---|---|
| `state` | `'closed' \| 'open' \| 'half-open'` | Governs whether new requests get their normal retry budget (`closed`/`half-open`) or fail immediately without a network call (`open`). |
| `recentFailureTimestamps` | `number[]` (epoch ms) | One entry per request whose retries were fully exhausted; pruned to the last 30 seconds on each check. Length ≥ 5 within the window trips `closed → open`. |
| `openedAt` | `number \| null` (epoch ms) | Set when entering `open`; compared against the 20-second cooldown to decide when to move to `half-open`. `null` while `closed`. |

**Relationships**: Consulted by the retry-aware interceptor before every request (to short-circuit when `open`) and updated by it after every request resolves (recording a strike on exhaustion, or resetting on a successful `half-open` trial). Not linked to any Firestore/Redis entity — purely derived, disposable, process-local operational state.

**Lifecycle**: starts `closed` on process boot → accumulates strikes and may trip to `open` → after the cooldown, exactly one trial request moves it to `half-open` → resolves back to `closed` (trial succeeded) or `open` with a fresh cooldown (trial failed). State is lost on process restart/cold start, which is acceptable since it always starts from the safe default (`closed`).
