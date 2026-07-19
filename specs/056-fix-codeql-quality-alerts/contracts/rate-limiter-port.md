# Contract: `RateLimiterPort` and rate-limiting Express middleware

**Feature**: `056-fix-codeql-quality-alerts` | **Date**: 2026-07-19

Mirrors the shape of the existing `backend/src/ports/cache/cachePort.ts` / `backend/src/adapters/cache/redisClient.ts` pair (same fail-soft contract, same optional-Redis convention). New files only — no change to `CachePort` itself.

## Port: `backend/src/ports/rateLimit/rateLimiterPort.ts`

```ts
export type RateLimitTier = 'strict' | 'standard';

export interface RateLimitDecision {
  /** true = request MUST be rejected with 429 */
  limited: boolean;
  /** seconds until the caller may retry; only meaningful when limited === true */
  retryAfterSeconds: number;
}

export interface RateLimiterPort {
  /**
   * Fail-soft: MUST NOT reject. Increments the counter for (tier, ip)'s
   * current fixed window and returns whether the tier's threshold was
   * exceeded. When the backing store is unavailable or unconfigured, MUST
   * return { limited: false, retryAfterSeconds: 0 } (fail OPEN) and log a
   * warning — a rate-limiter outage must not take down the endpoints it
   * protects, matching CachePort's existing fail-soft precedent.
   */
  checkAndIncrement(tier: RateLimitTier, ip: string): Promise<RateLimitDecision>;
}
```

## Adapter: `backend/src/adapters/rateLimit/redisRateLimiterAdapter.ts`

- Implements `RateLimiterPort` using the existing `getRedisClient()` from `backend/src/adapters/cache/redisClient.ts` (no new Redis connection).
- Algorithm: fixed 60-second window. Key: `` `ratelimit:${tier}:${ip}:${Math.floor(Date.now() / 60000)}` ``. On each call: `INCR` the key; if the result is `1`, `EXPIRE` the key at 60s. Compare the incremented count against the tier's threshold (`strict: 10`, `standard: 100`).
- When `getRedisClient()` returns `null`, or the `INCR`/`EXPIRE` calls throw: log `{ route: 'ratelimit', outcome: 'ratelimit_unavailable', message }` at `warn` level (same shape as the existing `cache_unavailable` log in `redisClient.ts`) and return `{ limited: false, retryAfterSeconds: 0 }`.

## Adapter: `backend/src/adapters/rateLimit/requireRateLimit.ts`

Express middleware factory, same call shape as `createRequireAuth`:

```ts
export function createRequireRateLimit(deps: { rateLimiter: RateLimiterPort }) {
  return (tier: RateLimitTier) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const decision = await deps.rateLimiter.checkAndIncrement(tier, req.ip);
      if (decision.limited) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res.status(429).json({
          error: 'rate_limited',
          message: 'Too many requests. Please try again shortly.',
        });
        return;
      }
      next();
    };
}

export const requireRateLimit = createRequireRateLimit({ rateLimiter: redisRateLimiterAdapter });
```

## Wiring contract (per flagged file)

Placed **before** `requireAuth` in the middleware chain (so it also throttles unauthenticated hits, e.g. repeated invalid tokens):

| File | Wiring |
|---|---|
| `backend/src/adapters/users/authRoutes.ts` | `requireRateLimit('standard')` added before `requireAuth` on all 3 routes (`/session`, `/preferences`, `/me`). |
| `backend/src/adapters/library/libraryRoutes.ts` | `requireRateLimit('standard')` added before `requireAuth` on all 5 routes. |
| `backend/src/adapters/googleAuth/googleAuthRoutes.ts` | `requireRateLimit('strict')` added as the first middleware on `/authorize` and `/complete` (no `requireAuth` exists here — these ARE the login entry points). |
| `backend/src/adapters/feeds/feedsRoutes.ts` | `requireRateLimit('standard')` added before `requireAuth` on both flagged routes. |
| `backend/src/adapters/discogsOauth/discogsRoutes.ts` | `requireRateLimit('strict')` added before the router-level `discogsOauthRouter.use(requireAuth)` for `/request` and `/complete`; `requireRateLimit('standard')` for `/connection` and `/status`. Router-level `.use(requireAuth)` stays as-is; rate limiting is per-route since tiers differ within this file. |
| `backend/src/adapters/discogsCatalog/discogsRoutes.ts` | `requireRateLimit('standard')` added before `requireAuth` on all 4 flagged routes. |

## HTTP response contract (all tiers)

On threshold exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds-until-window-reset>
Content-Type: application/json

{ "error": "rate_limited", "message": "Too many requests. Please try again shortly." }
```

Matches the existing `{ error, message }` shape used by every other error response in these route files (e.g. `requireAuth.ts`'s `401 { error: 'unauthorized', message }`).
