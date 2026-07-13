# Phase 1 Data Model: Discogs Rate Limit Smoothing & Call Reduction

This feature introduces no Firestore schema changes and no new persisted business entities,
consistent with the spec's Key Entities note (both entities below are described in the spec as
transient, request-handling concepts). The three concepts below are transient, in-memory
operational state — described here for implementation clarity, not as a database migration.

## Rate Limit Budget (backend, in-memory, app-wide singleton)

The current, shared understanding of how many Discogs requests remain in the present per-minute
window (spec Key Entities). One shared state per warm backend process, consulted and updated by
**both** `getDiscogsHttpClient()` (`discogsClient.ts`) and `createClient()`
(`collectionClient.ts`) — see research.md §1, §3.

| Field | Type | Notes |
|---|---|---|
| `limit` | `number` | Last known per-minute cap, from `X-Discogs-Ratelimit`. Defaults to `60` (documented authenticated limit, FR-006) until the first response is observed. |
| `remaining` | `number` | Last known/estimated requests left in the current window. Defaults to `limit`. Decremented by 1, synchronously, on every `acquireSlot()` call (one per outgoing HTTP attempt); corrected to the authoritative value whenever a response carries `X-Discogs-Ratelimit-Remaining`. May go negative between an underestimate and the next correction — treated as "at or past the safety threshold," not an error. |
| `windowResetAt` | `number` (epoch ms) | Approximate horizon for the current window, always `now + 60_000` — re-anchored on module load and on every real header observation (research.md §1). Not a true reset timestamp (Discogs does not expose one); used only to size the spacing delay. |

**Relationships**: Read and mutated by `acquireSlot()` (computes/applies a delay, decrements
`remaining`) and `recordRateLimitHeaders()` (corrects `remaining`/`limit`, re-anchors
`windowResetAt`) — both exported from the new `discogsRateLimiter.ts`. Feeds the `'throttled'`
structured log line (data-model.md → Observability, research.md §8) whenever a non-zero delay is
applied.

**Lifecycle**: created (defaulted) at module load → updated on every outgoing request and every
response with rate-limit headers → lost on process restart/cold start, which is acceptable since
it always restarts from the same safe default (FR-006). Not linked to any Firestore/Redis entity —
purely derived, disposable, process-local operational state, matching the existing **Circuit
Breaker State** entity from feature 029 (`discogsCircuitBreaker.ts`), which this feature leaves
unmodified and reuses as-is for both clients (FR-014).

## Enrichment Burst (backend, in-memory, per search request)

A group of related Discogs rating-lookup calls triggered by a single search's result page (spec
Key Entities), whose in-flight concurrency is bounded.

| Field | Type | Notes |
|---|---|---|
| `items` | `CatalogSearchResult[]` | The page's mapped, release/master-type-eligible search results awaiting rating enrichment. |
| `concurrency` | `number` | Fixed at `5` (`SEARCH_RATING_CONCURRENCY`, `discogsClient.ts`) — matches `libraryEnrichment.ts`'s existing `ENRICHMENT_CONCURRENCY` (research.md §6). |

**Relationships**: Consumed by the (relocated) `mapWithConcurrency` helper
(`backend/src/shared/concurrency.ts`) inside `searchCatalog()`; each worker calls the existing
`enrichWithRating()`, whose own per-call `getReleaseRating()` still goes through the shared **Rate
Limit Budget** above (research.md §3 — the throttle applies to every outgoing request, including
rating lookups run under this bounded concurrency).

**Lifecycle**: created per `searchCatalog()` invocation that has at least one eligible result and
a cache miss → discarded once every worker resolves (success or fail-soft omission) — never
persisted beyond the single search response's lifetime. Identical shape and discard semantics to
feature 038's existing `libraryEnrichment.ts` fan-out, just applied to a different call site.

## Retryable Collection Call (conceptual, not a stored entity)

Not new state, but a classification this feature adds consistency around: which
`collectionClient.ts` functions are retry+circuit-breaker-eligible versus retry-exempt
(FR-012/FR-016). Documented here because it governs a per-call request-config flag
(`__skipRetry`), not because it is persisted.

| Function | Retry-eligible? | Circuit-breaker-eligible? |
|---|---|---|
| `listAllInstances`, `getInstancesForRelease`, `getFieldMap` (reads) | Yes | Yes |
| `setRating`, `setFieldValue`, `deleteInstance` (idempotent mutations) | Yes | Yes |
| `addReleaseToCollection` (non-idempotent write) | **No** (`__skipRetry: true`) | Yes |

**Relationships**: Reuses feature 029's existing `discogsRetry.ts` classifier/backoff functions
and `discogsCircuitBreaker.ts` singleton unmodified (research.md §4/§5) — this table only records
which of `collectionClient.ts`'s existing exported functions passes the new `__skipRetry` flag on
its request config.
