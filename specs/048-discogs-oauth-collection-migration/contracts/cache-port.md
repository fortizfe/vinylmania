# Port Contract: `CachePort` (extended in place)

**Feature**: 048-discogs-oauth-collection-migration | **Layer**: `ports/cache/cachePort.ts` (unchanged location — already shared since Historia 3)
**Adapter**: `adapters/cache/cacheAdapter.ts` (unchanged location; gains one new method delegating to the unmoved `cache/cacheAside.ts`)
**Status**: `has`/`set` (Historia 2) and `withCache` (Historia 3) are unchanged by this
feature. `invalidate` is new — Historia 3's own research.md named this exact gap and
deferred it here by name (research.md Decision 6).

```ts
export interface CachePort {
  has(key: string): Promise<boolean>;

  set(key: string, value: string, ttlSeconds: number): Promise<void>;

  withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;

  /**
   * Fail-soft: MUST NOT reject. Deletes `key` if present; a cache outage or
   * absent backend is silently swallowed — the caller has no way to observe
   * it and MUST NOT need to, matching `has`/`set`'s existing fail-soft
   * contract.
   */
  invalidate(key: string): Promise<void>;
}
```

## Preconditions / Postconditions

- `invalidate`: identical contract to today's `cache/cacheAside.ts`'s `invalidateCache`
  export — a relocation of an existing, already-tested behavior behind the shared
  port, not a new design.

## Consumers introduced by this feature

- `application/discogsOauth/disconnectConnection.ts` — the only new `invalidate`
  consumer, replacing `discogsOauthService.ts`'s current direct
  `cache/cacheAside.ts` import.
- `adapters/discogsOauth/discogsCollectionAdapter.ts`'s `getFieldMap` — a new
  `withCache` consumer (extending, not introducing, this method — see
  `discogs-collection-port.md`).

## Unaffected by this feature

`has`/`set` (library domain's sync-marker freshness check) and `withCache`'s other
five consumers in the catalog domain are untouched — this feature only adds one method
and two call sites.
