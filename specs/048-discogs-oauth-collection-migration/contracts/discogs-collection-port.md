# Port Contract: `DiscogsCollectionPort`

**Feature**: 048-discogs-oauth-collection-migration | **Layer**: `ports/discogsOauth/discogsCollectionPort.ts`
**Adapter**: `adapters/discogsOauth/discogsCollectionAdapter.ts` (wraps `axios` directly, plus the unmoved `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts`/`discogsErrors.ts`, and the relocated `oauthSignature.ts`)
**Status**: This is the *real* implementation of the interface the library domain
already defined provisionally (`ports/library/discogsCollectionPort.ts`, Historia 2) —
the method signatures below are unchanged from that provisional definition; only their
owning location and backing implementation change (research.md Decision 7).

```ts
export interface DiscogsCollectionPort {
  getFieldMap(connection: DiscogsConnection): Promise<CollectionFieldMap>;

  /** Walks every page of the user's "All" folder. */
  listAllInstances(
    connection: DiscogsConnection,
    prefetchedFieldMap?: CollectionFieldMap,
  ): Promise<CollectionInstance[]>;

  getInstancesForRelease(
    connection: DiscogsConnection,
    releaseId: number,
    prefetchedFieldMap?: CollectionFieldMap,
  ): Promise<CollectionInstance[]>;

  addReleaseToCollection(
    connection: DiscogsConnection,
    releaseId: number,
  ): Promise<{ instanceId: number; folderId: number }>;

  deleteInstance(connection: DiscogsConnection, ref: InstanceRef): Promise<void>;

  setRating(connection: DiscogsConnection, ref: InstanceRef, rating: number): Promise<void>;

  setFieldValue(
    connection: DiscogsConnection,
    ref: InstanceRef,
    fieldId: number,
    value: string,
  ): Promise<void>;
}
```

## Preconditions / Postconditions (unchanged from today's `collectionClient.ts`)

- `getFieldMap`: read-through cached via the shared `CachePort.withCache`
  (`discogs:fields:{uid}`, 24-hour TTL) — was a direct `cache/cacheAside.ts` call;
  behavior (including fail-soft on a cache outage) is otherwise identical.
- Every method signs its request per-call with a fresh nonce/timestamp via the
  relocated `oauthSignature.ts`'s `buildProtectedResourceHeader`, using the given
  `connection`'s `accessToken`/`accessTokenSecret` — never a shared, pre-signed client.
- Every method reuses the same shared preventive throttle, circuit breaker, and
  retry-with-backoff as the already-migrated catalog domain (`discogsRateLimiter.ts`/
  `discogsCircuitBreaker.ts`/`discogsRetry.ts`, unmoved) — `addReleaseToCollection`
  keeps its existing retry opt-out (`__skipRetry`, a non-idempotent write) while
  remaining circuit-breaker-eligible, exactly as today; this adapter-internal detail
  MUST NOT leak into the port signature.
- A 401/403 from Discogs maps to `DiscogsAuthError` (`auth_failed`) — distinct from the
  catalog port's error set, since this client acts as the linked user and a revoked
  credential is a real, expected failure mode here that the catalog's app-token client
  does not have.
- Every method may reject with a `DiscogsError` subclass (`not_found`/`rate_limited`/
  `unavailable`/`auth_failed`), unchanged, still imported from the unmoved
  `discogs/discogsErrors.ts`.

## Explicitly out of this port's surface

Rate-limit smoothing, circuit-breaker state, and retry/backoff scheduling are entirely
internal to the adapter, same as the catalog domain's own port. The other six methods
besides `getFieldMap` are not cached at any layer — verified against today's
`collectionClient.ts`, none of them call `withCache` — and this migration does not
introduce caching for them.
