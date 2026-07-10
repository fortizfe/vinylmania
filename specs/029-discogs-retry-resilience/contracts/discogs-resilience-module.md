# Contract: Discogs Resilience Modules (`backend/src/discogs/`)

No public REST API contracts change as part of this feature (FR-005 — every existing `/api/discogs/*` route keeps its current request/response shape and its current "temporarily unavailable" error body once retries are exhausted). The contracts introduced here are **internal module interfaces** that `discogsClient.ts` (and its tests) program against.

## `backend/src/discogs/discogsRetry.ts` (NEW)

```ts
export type RetryableFailureReason = 'rate_limited' | 'unavailable';

export function classifyForRetry(error: unknown): RetryableFailureReason | null;
// Returns null for anything not retryable (404, 401/403 auth, validation errors,
// or any error that isn't a Discogs transient failure) — see research.md §3, §5.

export function backoffDelayMs(attempt: number): number;
// attempt is the *next* attempt number about to be made (2 or 3).
// Returns the fixed-schedule delay with jitter (research.md §3):
//   attempt 2 → ~300ms (±20%)
//   attempt 3 → ~900ms (±20%)

export const MAX_ATTEMPTS = 3;
export const PER_ATTEMPT_TIMEOUT_MS = 4_000;
```

**Behavior contract**:

| Scenario | `classifyForRetry` result |
|---|---|
| HTTP 429 response | `'rate_limited'` |
| HTTP 5xx response, or network error (no response) | `'unavailable'` |
| HTTP 404 response | `null` (never retry) |
| HTTP 401/403 response | `null` (never retry — see `discogsErrors.ts` `DiscogsAuthError` mapping, research.md §5) |
| Any other axios rejection reaching the interceptor | `null` (never retry) |

**Note**: `DiscogsValidationError` (malformed/unexpected response body) is *not* a case `classifyForRetry` ever sees or decides on. It is thrown by the mapper functions (`mapMasterRelease()`, `mapSearchResult()`, etc.) after axios has already resolved the HTTP call successfully — i.e. in the success path, outside the response-error interceptor entirely. It is therefore structurally never retried, not because the classifier rejects it.

## `backend/src/discogs/discogsCircuitBreaker.ts` (NEW)

```ts
export function shouldShortCircuit(): boolean;
// true when the breaker is `open` and the cooldown has not yet elapsed.
// A single call is also responsible for the `open` → `half-open` transition
// once the cooldown elapses (checked lazily on the next call, no background timer).

export function recordExhaustedFailure(): void;
// Call exactly once per request whose retries were fully exhausted (not once
// per attempt). May trip `closed` → `open`, or reopen from `half-open`.

export function recordSuccess(): void;
// Call once per request that ultimately succeeds. Closes the breaker if it
// was `half-open` (the trial request passed); a no-op if already `closed`.
```

**Behavior contract**: see data-model.md "Circuit Breaker State" for the full state machine (5 strikes / 30s window trips `open`; 20s cooldown before a `half-open` trial).

## `backend/src/discogs/discogsClient.ts` (MODIFIED)

**Interceptor behavior contract** (replaces the current "map error and reject" logic in `createDiscogsHttpClient()`'s response error handler):

| Scenario | Behavior |
|---|---|
| `shouldShortCircuit()` is true | Reject immediately with the existing `DiscogsUnavailableError`, without issuing any HTTP request. Log `outcome: 'circuit_open'` (warn). |
| Request fails, `classifyForRetry` returns non-null, attempt < `MAX_ATTEMPTS` | Wait `backoffDelayMs(attempt + 1)`, re-issue the same request with the next attempt count. No error surfaced to the caller yet. |
| Request fails, `classifyForRetry` returns non-null, attempt === `MAX_ATTEMPTS` | Call `recordExhaustedFailure()`. Reject with the existing typed error (`DiscogsRateLimitError`/`DiscogsUnavailableError`), same message as today. Log the existing `outcome` (`rate_limited`/`unavailable`) with `meta.attempts` set to `MAX_ATTEMPTS`. |
| Request fails, `classifyForRetry` returns `null` (404, 401/403, validation) | Reject immediately with the existing typed error (`DiscogsNotFoundError`/`DiscogsAuthError`/`DiscogsValidationError`), unchanged from today. No retry, no circuit-breaker interaction. |
| Request succeeds (any attempt) | Call `recordSuccess()`. Log `outcome: 'success'` with `meta.attempts` set to the attempt number it succeeded on (1 if first try). |

**Callers** (unchanged call sites — no code changes required, they transparently benefit):

- `backend/src/discogs/discogsClient.ts`: `searchCatalog`, `getRelease`, `getMasterRelease`, `getMasterReleaseVersions`, `getArtist` — all go through the same modified interceptor.
- `backend/src/library/libraryEnrichment.ts`: `enrichEntry` (calls `getRelease`) — no changes required, benefits transitively per FR-009's clarified scope.
- `backend/src/routes/discogs.ts`: no changes required — the existing `DiscogsRateLimitError`/`DiscogsUnavailableError` → 502 mapping is unchanged; it now simply triggers less often.

**Non-goals**: This module does not touch `backend/src/discogs/collection/collectionClient.ts` or `backend/src/discogs/oauth/oauthHttpClient.ts` (separate axios instances used for per-user OAuth collection sync) — out of scope per research.md §8. The community-rating lookup (`getReleaseRating`) is untouched — its own 2-second timeout and fail-soft behavior are preserved exactly as-is.
