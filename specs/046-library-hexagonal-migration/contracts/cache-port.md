# Port Contract: `CachePort`

**Feature**: 046-library-hexagonal-migration | **Layer**: `ports/library/cachePort.ts`
**Adapter**: `adapters/library/cacheAdapter.ts` (wraps `cache/redisClient.ts`'s `getRedisClient()`, unmoved)
**Status**: Library-scoped for now — Historia 6 (parent user story) consolidates one shared
`CachePort` after Historias 2-5 have each defined and consumed their own (research.md Decision 4).

This models exactly what `librarySyncService.ts`'s `isMarkerFresh`/`setMarker` do today — a raw,
fail-soft get/set-with-TTL over the sync-freshness marker key. It intentionally does **not** model
`cache/cacheAside.ts`'s broader `withCache<T>(key, ttl, fetcher)` read-through pattern, which no
file under `library/*` calls today (that pattern stays inside the unmoved `collectionClient.ts`).

```ts
export interface CachePort {
  /**
   * Fail-soft: MUST NOT reject. Returns `false` when the cache backend is
   * unconfigured, unavailable, or the key is simply absent — callers cannot
   * and MUST NOT distinguish those three cases (parity with today's
   * `isMarkerFresh`, which treats "no Redis" and "Redis errored" and "key
   * missing" identically).
   */
  has(key: string): Promise<boolean>;

  /**
   * Fail-soft: MUST NOT reject. A write failure (or no cache backend
   * configured) is silently swallowed — the caller has no way to observe it
   * and MUST NOT need to (parity with today's `setMarker`).
   */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
```

## Preconditions / Postconditions

- Both methods are safe to call unconditionally — there is no "is the cache available" check the
  caller needs to perform first; that check lives entirely inside the adapter, exactly as it does
  in today's `getRedisClient() === null` guards.
- `set`'s `ttlSeconds` is always provided by the caller (today: `SYNC_MARKER_TTL_SECONDS = 300`,
  defined in `application/library/syncLibrary.ts`, not in the port or adapter).

## Explicitly out of this port's surface

Discogs field-map caching (`collectionClient.ts`'s `getFieldMap`, via `cacheAside.ts`'s `withCache`)
and cache invalidation on disconnect (`discogsOauthService.ts`'s `disconnect`, via `cacheAside.ts`'s
`invalidateCache`) are both inside not-yet-migrated modules this feature does not touch — they keep
importing `cache/cacheAside.ts` directly, unaffected by this port's introduction.
