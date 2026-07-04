# Contract: Backend Cache Module (`backend/src/cache/`)

No public REST API contracts change as part of this feature (FR-010 — all existing `/api/discogs/*` and `/api/library/*` request/response shapes are unchanged; see `backend/src/routes/discogs.ts` and `backend/src/routes/library.ts`). The contract introduced here is the **internal module interface** other backend code (routes, `libraryEnrichment.ts`) programs against.

## `backend/src/cache/redisClient.ts`

```ts
export function getRedisClient(): Redis; // ioredis instance, lazily created and memoized per process
```

- MUST return the same instance across calls within one serverless function invocation/warm container (connection reuse — see research.md §3).
- MUST read connection info from `process.env.REDIS_URL` only; no other configuration surface.
- MUST NOT throw synchronously on construction if Redis is unreachable — connection errors surface asynchronously to callers of `cacheAside`, which MUST handle them (see below).

## `backend/src/cache/cacheAside.ts`

```ts
export function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T>;
```

**Behavior contract**:

| Scenario | Behavior |
|---|---|
| Key present in Redis, deserializes successfully | Return the cached value. Do NOT call `fetcher`. Log `cache_hit` with the key. |
| Key absent | Call `fetcher()`, store the JSON-serialized result in Redis with `EX ttlSeconds`, return the result. Log `cache_miss` with the key. |
| Redis GET/SET throws or times out | Call `fetcher()` directly (do not attempt to write to Redis again). Return its result. Log `cache_unavailable` (warn level) with the key and error message. MUST NOT propagate the Redis error to the caller. |
| `fetcher()` itself throws (e.g., `DiscogsNotFoundError`) | Propagate the error unchanged to the caller; do NOT cache errors. |

**Callers** (unchanged call sites, only their internals wrap the Discogs functions):

- `backend/src/discogs/discogsClient.ts`: `searchCatalog`, `getRelease`, `getArtist` — each wraps its existing HTTP-fetching body in `withCache(key, ttl, () => /* existing logic */)`.
- `backend/src/routes/discogs.ts` and `backend/src/library/libraryEnrichment.ts`: **no changes required** — they already call `searchCatalog`/`getRelease` and will transparently benefit.

**Non-goals**: This module does not cache `backend/src/library/libraryService.ts` (Firestore reads/writes) or any other per-user data — per FR-006, that data MUST NOT enter the shared Redis cache.
