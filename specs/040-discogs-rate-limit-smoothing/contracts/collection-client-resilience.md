# Contract: Collection Client Retry & Circuit Breaker Extension (`backend/src/discogs/collection/collectionClient.ts`)

Extends `collectionClient.ts`'s existing per-call `createClient()` interceptor pattern to reuse
feature 029's retry/circuit-breaker modules, unmodified (research.md §4).

## Request config flag (NEW)

```ts
interface ResilienceRequestState {
  __attempt?: number;
  __skipRetry?: boolean; // opts a call out of retry ONLY; circuit-breaker still applies.
}
```

Set only by `addReleaseToCollection`'s POST call (FR-016). Every other exported function
(`listAllInstances`, `getInstancesForRelease`, `getFieldMap`, `deleteInstance`, `setRating`,
`setFieldValue`) passes no flag.

## `createClient()` interceptor behavior contract

| Scenario | Behavior |
|---|---|
| `shouldShortCircuit()` is true | Reject immediately with the existing `DiscogsUnavailableError`, without issuing any HTTP request — applies to every call, including `addReleaseToCollection` (research.md §5: `__skipRetry` never skips the breaker). |
| `shouldShortCircuit()` is false | `await acquireSlot()` (shared throttle, contracts/discogs-rate-limiter-module.md), then send the request. |
| Request fails, `classifyForRetry(error)` is non-null, `!config.__skipRetry`, `attempt < MAX_ATTEMPTS` | Wait `backoffDelayMs(attempt + 1)` (same schedule as the catalog client), re-issue via `instance.request(config)` with `__attempt` incremented. |
| Request fails, `classifyForRetry(error)` is non-null, `!config.__skipRetry`, `attempt === MAX_ATTEMPTS` | Call `recordExhaustedFailure()`. Reject with the existing typed error (`DiscogsRateLimitError`/`DiscogsUnavailableError`), same mapping as today. |
| Request fails, `classifyForRetry(error)` is non-null, `config.__skipRetry` is true | Call `recordExhaustedFailure()` immediately (single attempt = exhausted). Reject with the existing typed error — **no retry**, regardless of attempt count (FR-016). |
| Request fails, `classifyForRetry(error)` is `null` (404, 401/403) | Reject immediately with the existing typed error (`DiscogsNotFoundError`/`DiscogsAuthError`) — unchanged from today, no retry, no circuit-breaker interaction (FR-013). |
| Request succeeds (any attempt) | Call `recordSuccess()`. |

**Callers** (unchanged call sites — no code changes required beyond the one new flag on
`addReleaseToCollection`): `librarySyncService.ts` and any route handler consuming
`collectionClient.ts`'s exports transparently benefit — their existing error handling (already
built around `DiscogsRateLimitError`/`DiscogsUnavailableError`/`DiscogsAuthError`/
`DiscogsNotFoundError`) is untouched, since retry/circuit-breaker resolve *before* an error ever
reaches them, exactly as feature 029 established for the catalog client.

**Shared state confirmation (FR-014)**: `shouldShortCircuit`/`recordSuccess`/
`recordExhaustedFailure` are imported from the same `discogsCircuitBreaker.ts` module singleton
already used by `discogsClient.ts` — no new breaker instance, no new import path, so both clients'
requests contribute to and are gated by one process-wide breaker state by construction.
