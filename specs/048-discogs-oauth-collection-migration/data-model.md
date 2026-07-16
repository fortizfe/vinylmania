# Phase 1 Data Model: Discogs OAuth + Collection Domain Migrated to Hexagonal Architecture

This migration does not add, remove, or change the shape of any linking-flow or
collection entity — it relocates existing types unchanged and introduces two new
domain ports (`DiscogsConnectionPort`, `DiscogsCollectionPort`) plus an extension to
the existing `CachePort` (research.md Decisions 3 and 6).

## Domain Entities (relocated unchanged)

| Entity | Source file → destination | Key fields | Notes |
|---|---|---|---|
| `DiscogsConnection` | `discogs/oauth/types.ts` → `domain/discogsOauth/types.ts` | `uid`, `discogsUsername`, `discogsUserId`, `accessToken`, `accessTokenSecret`, `linkedAt`, `initialLibrarySyncAt?` | Token fields never leave the backend; stored in Firestore `discogsConnections/{uid}` |
| `PendingOAuthRequest` | `discogs/oauth/types.ts` → `domain/discogsOauth/types.ts` | `uid`, `requestTokenSecret`, `createdAt`, `expiresAt` | 15-minute validity window (`PENDING_TTL_MS`); stored in Firestore `discogsOAuthRequests/{oauthToken}` |
| `ConnectionStatus` | `discogs/oauth/types.ts` → `domain/discogsOauth/types.ts` | `{ connected: false }` \| `{ connected: true, discogsUsername, linkedAt }` | The only connection shape ever serialized to the browser — token fields structurally absent |
| `CollectionInstance` | `discogs/collection/collectionTypes.ts` → `domain/discogsOauth/collectionTypes.ts` | `releaseId`, `instanceId`, `folderId`, `rating` (0–5), `mediaCondition`, `sleeveCondition`, `notes`, `dateAdded` | The user's copy of a release; never persisted locally, always fetched from/written to Discogs |
| `InstanceRef` | `discogs/collection/collectionTypes.ts` → `domain/discogsOauth/collectionTypes.ts` | `folderId`, `releaseId`, `instanceId` | Coordinates every instance-level write |
| `CollectionFieldMap` | `discogs/collection/collectionTypes.ts` → `domain/discogsOauth/collectionTypes.ts` | `mediaConditionFieldId`, `sleeveConditionFieldId`, `notesFieldId` (each `number \| null`) | Resolved once per user from Discogs' own field list; cached (see Caching Map below) |

## Domain Errors (one new file, one relocated)

| Error | Source → destination | Notes |
|---|---|---|
| `DiscogsOauthFlowError` | Inline in `discogs/oauth/discogsOauthService.ts` → new `domain/discogsOauth/discogsOauthErrors.ts` | Codes: `invalid_request`, `expired_request`, `already_connected` — all three already thrown today; research.md Decision 2 adds one new throw site (`already_connected` from inside `startLink`/`completeLink` instead of the route) without changing the error type itself |
| `conditionGrading.ts` (grading vocabulary + `mapLegacyCondition`) | `discogs/collection/conditionGrading.ts` → `domain/discogsOauth/conditionGrading.ts` | Not an error type, but domain business logic — research.md Decision 5 |

## Port Contracts (new / extended)

| Port | Application-layer consumers | Adapter (this feature) | Wraps |
|---|---|---|---|
| `DiscogsConnectionPort` | `startLink`, `completeLink`, `getConnectionStatus`, `disconnectConnection` (this feature); `syncLibrary`, `createLibraryEntry`, `deleteLibraryEntry`, `getLibraryEntry`, `updateLibraryEntry` (library domain, import-path fix only, still calling `getConnection`/`markInitialLibrarySync`) | `adapters/discogsOauth/discogsConnectionAdapter.ts` | `firebase-admin` (Firestore, direct), `axios` (via the relocated `oauthHttpClient.ts`, direct) |
| `DiscogsCollectionPort` | `disconnectConnection` (this feature, for cache key construction only — not a data call); `syncLibrary`, `createLibraryEntry`, `deleteLibraryEntry`, `getLibraryEntry`, `updateLibraryEntry`, `discogsCopyData` (library domain, import-path fix only) | `adapters/discogsOauth/discogsCollectionAdapter.ts` | `axios` (direct), `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts` (unmoved, shared with the catalog domain), the relocated `oauthSignature.ts` |
| `CachePort` (extended) | `disconnectConnection` (new `invalidate` consumer, this feature); `discogsCollectionAdapter`'s `getFieldMap` (new `withCache` consumer, replacing a direct `cache/cacheAside.ts` import); `searchCatalogWithRatings`/`discogsCatalogAdapter` (existing `withCache` consumers, catalog domain, unaffected); `syncLibrary` (existing `has`/`set` consumer, unaffected) | `adapters/cache/cacheAdapter.ts` (extended in place, not relocated — already shared since Historia 3) | `cache/redisClient.ts` (`has`/`set`, unmoved), `cache/cacheAside.ts` (`withCache`/`invalidate`, unmoved) |

## `DiscogsConnectionPort` method inventory (research.md Decision 3)

| Method | Backs (today's function) | Infra |
|---|---|---|
| `createPendingRequest(uid): Promise<{ authorizeUrl: string }>` | `startLink`'s request-token call + Firestore write | `axios` (request-token HTTP call) + `firebase-admin` (pending-request write); reads `DISCOGS_OAUTH_CALLBACK_URL` from `process.env` internally |
| `getPendingRequest(oauthToken): Promise<PendingOAuthRequest \| null>` | `completeLink`'s pending-doc read | `firebase-admin` |
| `deletePendingRequest(oauthToken): Promise<void>` | `completeLink`'s pending-doc delete (on success or expiration) | `firebase-admin` |
| `exchangeAccessToken(oauthToken, requestTokenSecret, verifier): Promise<{ accessToken, accessTokenSecret }>` | `completeLink`'s access-token exchange call | `axios` |
| `fetchIdentity(accessToken, accessTokenSecret): Promise<{ discogsUserId, discogsUsername }>` | `completeLink`'s identity call | `axios` |
| `saveConnection(uid, connection): Promise<void>` | `completeLink`'s connection-doc write | `firebase-admin` |
| `getConnection(uid): Promise<DiscogsConnection \| null>` | `getConnection` (unchanged signature — already the library domain's provisional port method) | `firebase-admin` |
| `deleteConnection(uid): Promise<void>` | `disconnect`'s connection-doc delete | `firebase-admin` |
| `markInitialLibrarySync(uid): Promise<void>` | `markInitialLibrarySync` (unchanged signature — already the library domain's provisional port method) | `firebase-admin` |

Full preconditions/postconditions (expiration semantics, ownership-mismatch
non-deletion, the exact `already_connected` trigger) are in
`contracts/discogs-connection-port.md`.

## Caching Map (unchanged key/TTL, now read through `CachePort`)

| Lookup | Cache key | TTL | Port method |
|---|---|---|---|
| `getFieldMap` | `discogs:fields:{uid}` | 24 hours | `CachePort.withCache` (new — was a direct `cache/cacheAside.ts` call) |
| `disconnect`'s field-map invalidation | `discogs:fields:{uid}` (same key, via `fieldsCacheKey`, relocated to `domain/discogsOauth/collectionTypes.ts`) | n/a (delete) | `CachePort.invalidate` (new — research.md Decision 6) |

The other six `DiscogsCollectionPort` methods (`listAllInstances`,
`getInstancesForRelease`, `addReleaseToCollection`, `deleteInstance`, `setRating`,
`setFieldValue`) are uncached today and stay uncached — verified against
`collectionClient.ts`'s current implementation, none of the other six call `withCache`.

## Linking-Flow Rules (relocated unchanged, spec.md User Story 1)

Not new rules — recorded here to make explicit that each is preserved exactly across
the migration, now living in the application layer instead of inline in
`discogsOauthService.ts`:

1. **`startLink`**: if `DiscogsConnectionPort.getConnection(uid)` returns a connection,
   throw `DiscogsOauthFlowError('already_connected', ...)` (research.md Decision 2 —
   new throw site, same error). Otherwise call
   `DiscogsConnectionPort.createPendingRequest(uid)` (the port reads
   `DISCOGS_OAUTH_CALLBACK_URL` internally, not a caller-supplied argument) and return
   its `authorizeUrl`.
2. **`completeLink`**: if already connected, same `already_connected` check as
   `startLink`. Otherwise call `getPendingRequest(oauthToken)`; if absent, throw
   `invalid_request` ("unknown or already-consumed oauth token"). If
   `pending.uid !== uid`, throw `invalid_request` ("belongs to a different user")
   **without** deleting the pending record — its rightful owner may still complete it.
   If `pending.expiresAt < now`, delete the pending record and throw `expired_request`.
   Otherwise: call `exchangeAccessToken`, then `fetchIdentity`; if the access-token
   exchange itself fails with a Discogs 4xx (verified: today checked via
   `isAxiosError(err) && err.response.status >= 400 && err.response.status < 500`), the
   port throws `DiscogsOauthFlowError('expired_request', ...)` directly (never a raw
   `axios`-derived error, per Constitution Principle VIII) — `completeLink` catches it,
   deletes the pending record, then re-throws (Discogs' own signal for an
   expired/invalid verifier). On success: `saveConnection`, then
   `deletePendingRequest`, then return the resulting `ConnectionStatus`.
3. **`getConnectionStatus`**: call `getConnection(uid)`; if absent, return
   `{ connected: false }`; otherwise return
   `{ connected: true, discogsUsername, linkedAt }` (token fields dropped).
4. **`disconnectConnection`**: call `deleteConnection(uid)`, then
   `cache.invalidate(fieldsCacheKey(uid))` (research.md Decision 6 — was a direct
   `cache/cacheAside.ts` call).

## Edge Case: existing cross-domain consumers of the two provisional ports

Six library-domain application files import the `DiscogsCollectionPort` and/or
`DiscogsConnectionPort` **types** from `ports/library/discogsCollectionPort.ts` /
`discogsConnectionPort.ts` (verified by import, research.md Decision 7):
`createLibraryEntry.ts`, `deleteLibraryEntry.ts`, `getLibraryEntry.ts`,
`updateLibraryEntry.ts`, `syncLibrary.ts`, `discogsCopyData.ts`. The composition root
`adapters/library/libraryRoutes.ts` additionally imports and wires the two concrete
**adapter objects** (`discogsCollectionAdapter`, `discogsConnectionAdapter`). After
this migration, all seven files' imports point at the new
`ports/discogsOauth/discogsCollectionPort.ts` / `discogsConnectionPort.ts` and
`adapters/discogsOauth/discogsCollectionAdapter.ts` / `discogsConnectionAdapter.ts` —
an import-path fix per spec.md FR-011, not a redesign of how the library domain
consumes either port. `tests/contract/collectionClient.contract.test.ts` (this
domain's own test, verified — it imports collection functions directly, not via the
library domain) gets its import path fixed as part of its own relocation, not as a
cross-domain fix.
