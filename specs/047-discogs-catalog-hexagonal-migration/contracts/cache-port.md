# Port Contract: `CachePort` (extended, relocated)

**Feature**: 047-discogs-catalog-hexagonal-migration | **Layer**: `ports/cache/cachePort.ts` (moved from `ports/library/cachePort.ts`)
**Adapter**: `adapters/cache/cacheAdapter.ts` (moved from `adapters/library/cacheAdapter.ts`; wraps `cache/redisClient.ts` for `has`/`set`, unmoved, and `cache/cacheAside.ts` for `withCache`, unmoved)
**Status**: Shared across domains starting with this feature (research.md Decision 3)
— `has`/`set` are unchanged from the library domain's original definition; `withCache`
is new.

```ts
export interface CachePort {
  /**
   * Fail-soft: MUST NOT reject. Returns `false` when the cache backend is
   * unconfigured, unavailable, or the key is simply absent. Unchanged from
   * the library domain's original definition.
   */
  has(key: string): Promise<boolean>;

  /**
   * Fail-soft: MUST NOT reject. A write failure (or no cache backend
   * configured) is silently swallowed. Unchanged from the library domain's
   * original definition.
   */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;

  /**
   * Read-through cache-aside (new in this feature): serves `key` from the
   * cache when present, otherwise calls `fetcher()`, caches its resolved
   * value for `ttlSeconds`, and returns it. Concurrent calls for the same
   * key while a fetch is in flight are coalesced into that one fetch rather
   * than each starting their own. Fail-soft: any cache error (or no cache
   * backend configured) falls back to calling `fetcher()` directly — a cache
   * outage MUST NOT fail the caller's request.
   */
  withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;
}
```

## Preconditions / Postconditions

- `has`/`set`: identical contract to the library domain's original `CachePort` —
  see that domain's own `syncLibrary.ts` consumer for the reference usage (freshness
  marker), unchanged by this feature.
- `withCache`: identical contract to today's `cache/cacheAside.ts`'s `withCache`
  export — this is a **relocation of an existing, already-tested behavior**, not a new
  design. `fetcher` is only ever called once per cache miss per coalescing window,
  regardless of how many concurrent callers requested the same `key`.

## Consumers introduced by this feature

- `application/discogsCatalog/searchCatalogWithRatings.ts` — the only consumer that
  wraps a whole business rule (enrichment) in `withCache`, not just a raw fetch (see
  `research.md` Decision 2 for why this specific call site owns its own cache-wrap
  rather than the port/adapter).
- `adapters/discogsCatalog/discogsCatalogAdapter.ts`'s other five methods
  (`getRelease`, `getArtist`, `getMasterRelease`, `getMasterReleaseVersions`,
  `getReleaseRating`) — each wraps its own HTTP call in `withCache` directly, exactly
  as `discogsClient.ts` does today, just via the injected port instead of importing
  `cache/cacheAside.ts` directly.

## Explicitly out of this port's surface

Cache invalidation (`cache/cacheAside.ts`'s `invalidateCache`, used today only by the
not-yet-migrated `discogsOauthService.ts` on disconnect) is not part of this port —
no consumer in either the library or catalog domain needs it yet. It stays a direct
`cache/cacheAside.ts` import for `discogsOauthService.ts` until Historia 4.
