# Contract: Rate limiting via `express-rate-limit`

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19 (revised after implementation — see research.md §2b)

**Revision note**: the original version of this contract specified a hand-rolled `RateLimiterPort`/adapter pair. That implementation was correct at runtime but invisible to CodeQL's `js/missing-rate-limiting` query, which only recognizes a small allowlist of npm packages (research.md §2b). This contract now describes the implementation that actually shipped: `express-rate-limit`, constructed locally in each route file, with a custom `INCR`/`PEXPIRE`-based store (research.md §2c — `rate-limit-redis`'s official store needs Lua scripting that `ioredis-mock` can't run).

## Shared values: `backend/src/adapters/rateLimit/rateLimitOptions.ts`

Plain constants and a handler function — **not** an Express middleware instance — so sharing them across files does not trigger CodeQL's documented cross-file false-negative (github/codeql#1949):

```ts
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_THRESHOLDS = { strict: 20, standard: 100 } as const; // strict raised from 10, see research.md §2c
export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';
export const rateLimitHandler: RateLimitExceededEventHandler = (_req, res, _next, options) => {
  res.status(options.statusCode).json({ error: 'rate_limited', message: options.message });
};
```

## Shared store factory: `backend/src/adapters/rateLimit/rateLimitStore.ts`

```ts
export function createRateLimitStore(): Store {
  return new LazyRedisOrMemoryStore(); // resolves Redis-vs-in-memory lazily, see below
}
```

`LazyRedisOrMemoryStore` wraps either a custom `RedisIncrExpireStore` (plain `INCR`/`PEXPIRE`/`PTTL`/`DECR`/`DEL` against the existing `getRedisClient()` — no Lua scripting, no new Redis connection) or `express-rate-limit`'s own `MemoryStore`, picked on the **first actual `increment()`/`get()`/etc. call, never at construction or at `init()`** (research.md §2c documents two real bugs caused by resolving too early: `express-rate-limit` calls `store.init(options)` synchronously the moment `rateLimit(...)` is called, which is still at route-module import time). When `REDIS_URL` isn't configured (local dev, tests), every route's limiter transparently uses the in-memory fallback, which is correct for a single-process dev server or a single Jest worker and simply degrades to per-instance (not globally distributed) counting — never a request failure.

## Per-file construction (the actual `rateLimit(...)` call — kept local to each file)

```ts
const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard, // or .strict
  standardHeaders: true, // also sets the Retry-After header automatically
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});
```

## Wiring contract (per flagged file)

Placed **before** `requireAuth` in the middleware chain (so it also throttles unauthenticated hits, e.g. repeated invalid tokens):

| File | Wiring |
|---|---|
| `backend/src/adapters/users/authRoutes.ts` | One local `standardRateLimit` applied before `requireAuth` on all 3 routes (`/session`, `/preferences`, `/me`). |
| `backend/src/adapters/library/libraryRoutes.ts` | One local `standardRateLimit` applied before `requireAuth` on all 5 routes. |
| `backend/src/adapters/googleAuth/googleAuthRoutes.ts` | One local `strictRateLimit` applied as the first middleware on `/authorize` and `/complete` (no `requireAuth` exists here — these ARE the login entry points). |
| `backend/src/adapters/feeds/feedsRoutes.ts` | One local `standardRateLimit` applied before `requireAuth` on both flagged routes. |
| `backend/src/adapters/discogsOauth/discogsRoutes.ts` | Two local limiters (`strictRateLimit`, `standardRateLimit`) declared in this file; `strictRateLimit` before `requireAuth` on `/request` and `/complete`, `standardRateLimit` before `requireAuth` on `/connection` and `/status`. |
| `backend/src/adapters/discogsCatalog/discogsRoutes.ts` | One local `standardRateLimit` applied before `requireAuth` on all 4 flagged routes. |

## HTTP response contract (all tiers)

On threshold exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds-until-window-reset>
Content-Type: application/json

{ "error": "rate_limited", "message": "Too many requests. Please try again shortly." }
```

`Retry-After` is set automatically by `express-rate-limit` (any truthy `standardHeaders`/`legacyHeaders` setting enables it) before the custom `handler` runs. The JSON body matches the existing `{ error, message }` shape used by every other error response in these route files (e.g. `requireAuth.ts`'s `401 { error: 'unauthorized', message }`).
