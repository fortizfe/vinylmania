# Port Contract: `DiscogsCollectionPort`

**Feature**: 046-library-hexagonal-migration | **Layer**: `ports/library/discogsCollectionPort.ts`
**Adapter**: `adapters/library/discogsCollectionAdapter.ts` (wraps `discogs/collection/collectionClient.ts`, unmoved)
**Status**: Provisional — Historia 4 (parent user story) formally migrates `collectionClient.ts`
itself and consolidates this port's final home (research.md Decision 3). This feature only stops
the **library** domain from importing `collectionClient.ts` directly; the client's own `axios`
dependency is untouched.

Signatures are a direct extraction of `collectionClient.ts`'s current exported functions.

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

`DiscogsConnection`, `CollectionFieldMap`, `CollectionInstance`, `InstanceRef` are imported, not
redefined — see `data-model.md`'s "Entities Owned by Other, Not-Yet-Migrated Domains."

## Error semantics (unchanged, preserved through the adapter)

Every method may reject with a `DiscogsError` subclass (`discogs/discogsErrors.ts`) —
`DiscogsAuthError` on 401/403, `DiscogsNotFoundError` on 404, `DiscogsRateLimitError` on 429,
`DiscogsUnavailableError` otherwise — exactly as `collectionClient.ts` throws them today. This port
does not translate or wrap these errors differently; the application layer and the driving adapter's
`respondCollectionError` continue to catch the same concrete error classes as today.

## Explicitly out of this port's surface

`getFieldMap`'s underlying use of `CachePort` (via `collectionClient.ts`'s own `withCache` call) is
internal to the adapter, not exposed here — the application layer does not need to know the field
map is cached. The resilience internals (`discogsRateLimiter`, `discogsCircuitBreaker`,
`discogsRetry`, and `collectionClient.ts`'s own OAuth-signing `createClient()`) are entirely inside
the unmoved `collectionClient.ts` and are not part of this port's contract at all.
