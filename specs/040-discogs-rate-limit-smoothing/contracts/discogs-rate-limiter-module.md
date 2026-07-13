# Contract: Discogs Rate Limiter Module (`backend/src/discogs/`)

No public REST API contracts change as part of this feature (every existing `/api/discogs/*` and
collection route keeps its current request/response shape and its current error bodies). The
contracts introduced here are **internal module interfaces** that `discogsClient.ts` and
`collectionClient.ts` (and their tests) program against.

## `backend/src/discogs/discogsRateLimiter.ts` (NEW)

```ts
export async function acquireSlot(): Promise<void>;
// Called once per outgoing HTTP attempt (original or retried), from the request
// interceptor of BOTH the catalog client and the collection client. Synchronously
// reserves a slot (decrements the in-memory `remaining` estimate) and resolves
// immediately (delay = 0) or after the computed spacing delay (research.md §2),
// capped at MAX_WAIT_MS. Never rejects — a fail-soft internal error resolves
// immediately (research.md §7 / FR-005).

export function recordRateLimitHeaders(headers: Record<string, unknown>): void;
// Called from the response interceptor of both clients on every response (success
// or error) that reaches it. Reads `x-discogs-ratelimit` / `x-discogs-ratelimit-remaining`
// (already-lowercased axios header keys, same casing both clients already log today)
// and, if present and numeric, corrects the shared `limit`/`remaining` state and
// re-anchors `windowResetAt`. A response with no rate-limit headers is a no-op.

export const DEFAULT_LIMIT = 60;
export const SAFETY_THRESHOLD_RATIO = 0.15;
export const MAX_WAIT_MS = 1_500;
export const WINDOW_MS = 60_000;

export function __resetRateLimiterForTests(): void;
// Test-only: restores limit=DEFAULT_LIMIT, remaining=DEFAULT_LIMIT, windowResetAt=now+WINDOW_MS.
```

**Behavior contract**:

| Scenario | `acquireSlot()` behavior |
|---|---|
| `remaining` (before this call) `>` `ceil(limit * SAFETY_THRESHOLD_RATIO)` | Resolves immediately (delay `0`). |
| `remaining` at or below the threshold | Resolves after `min(MAX_WAIT_MS, windowRemainingMs / max(remaining, 1))` ms; logs `outcome: 'throttled'` with `meta: { delayMs, remaining, limit }`. |
| Internal error while computing the delay | Resolves immediately (delay `0`); logs `outcome: 'throttle_unavailable'` (warn). |

| Scenario | `recordRateLimitHeaders()` behavior |
|---|---|
| Both headers present and numeric | `limit` and `remaining` updated to the reported values; `windowResetAt = now + WINDOW_MS`. |
| Either header missing/non-numeric | No-op (state unchanged). |

## `backend/src/discogs/discogsClient.ts` (MODIFIED — request interceptor only)

**Interceptor behavior contract** (extends, does not replace, feature 029's existing
retry/circuit-breaker interceptor):

| Scenario | Behavior |
|---|---|
| `!config.__skipResilience && shouldShortCircuit()` | Reject immediately (unchanged from feature 029) — `acquireSlot()` is **not** called; a request that will never leave the process shouldn't pay a throttle delay first. |
| Otherwise (breaker closed/half-open, or `__skipResilience` set) | `await acquireSlot()`, then let the request proceed — applies even to the rating lookup (`__skipResilience: true` only ever affected retry/circuit-breaker, never the throttle; research.md §3). |
| Any response received (success or error, with rate-limit headers) | `recordRateLimitHeaders(response.headers)` (success path) or `recordRateLimitHeaders(error.response.headers)` (error path), before any existing error mapping/retry logic runs. |

**Callers** (unchanged call sites — no code changes required, they transparently benefit):
`searchCatalog`, `getRelease`, `getMasterRelease`, `getMasterReleaseVersions`, `getArtist`,
`getReleaseRating` (all in `discogsClient.ts`); `libraryEnrichment.ts`'s `enrichEntry`
(transitively, via `getRelease`).

## `backend/src/discogs/collection/collectionClient.ts` (MODIFIED — request interceptor)

Same throttle contract as above (`await acquireSlot()` unconditionally in the request
interceptor before the request is sent, `recordRateLimitHeaders()` on every response) — see
`contracts/collection-client-resilience.md` for the retry/circuit-breaker additions to this file.

**Non-goals**: `backend/src/discogs/oauth/oauthHttpClient.ts` (used only for the one-shot OAuth
token-exchange flow, not the per-user collection sync path) is out of scope — the spec's FR-004/
FR-008 scope the shared budget to "the catalog client and the OAuth collection client," not the
initial link/authorize handshake, which is not a repeated, budget-relevant call pattern.
