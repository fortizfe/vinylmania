# Phase 1 Data Model: Library Domain Migrated to Hexagonal Architecture

This migration does not add, remove, or change the shape of any persisted or wire-format entity —
it relocates existing types (`backend/src/library/types.ts`) into `domain/library/types.ts`
unchanged (research.md Decision 2) and introduces four new *port* interfaces that describe how the
application layer talks to infrastructure. This document records both: the entities as they exist
today, and the port contracts that now sit between them.

## Domain Entities (relocated unchanged from `library/types.ts`)

### LibraryEntry

A user's record of an owned release, mirrored in Firestore from their Discogs collection.
Membership data only — per-copy data (rating, conditions, notes) lives on the Discogs collection
instance, not here.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Firestore document ID |
| `discogsReleaseId` | `number` | |
| `addedAt` | `string` (ISO 8601) | |
| `discogsInstanceId?` | `number` | The managed Discogs collection instance (lowest `instance_id`) |
| `discogsFolderId?` | `number` | Folder currently holding the managed instance |
| `legacyCondition?` | `string` | Pre-016 field, deleted once migrated to Discogs; never serialized to API responses |
| `legacyNotes?` | `string` | Same lifecycle as `legacyCondition` |
| `genre?` / `style?` / `format?` | `string[]` | Persisted at enrichment time (feature 038); absent until first successful enrichment |

**Validation rules**: unchanged — `discogsReleaseId` required on create; `legacyCondition`/`legacyNotes`
are write-once-then-cleared, never written to fresh entries.

**State transitions**: An entry's `legacyCondition`/`legacyNotes` transition from present → absent
exactly once, at first-sync migration (`application/library/syncLibrary.ts`'s
`migrateLegacyFields`), and only after the corresponding Discogs write succeeds. This transition is
unchanged by this feature (Requirement FR-007 in `spec.md`).

### LibraryFilters

`{ genre?: string[]; style?: string[]; format?: string[] }` — selection for filtering the listing.
AND across fields, OR within a field's selected values. The matching predicate
(`matchesLibraryFilters`) is a pure domain function (research.md Decision 1), unchanged.

### EntryDiscogsData

Per-copy data read fresh from the user's Discogs collection instance for the detail view: `instanceId`,
`folderId`, `rating` (0–5), `mediaCondition`, `sleeveCondition`, `notes`, and an `editable` flag set
per field name that Discogs' response is missing that field.

### EnrichedLibraryEntry

`LibraryEntry` plus `catalogStatus` (`'ok' | 'unavailable'`), `release` (catalog data, `null` on
lookup failure), and `discogs` (`EntryDiscogsData | null`). Built by
`application/library/enrichLibraryEntry.ts`, unchanged behavior: a failed catalog lookup degrades
to `catalogStatus: 'unavailable'` without failing the request (Constitution Principle VII).

### CreateLibraryEntryInput / PaginatedLibraryEntries / SyncResult

Unchanged shapes, relocated to `domain/library/types.ts` (`CreateLibraryEntryInput`,
`PaginatedLibraryEntries`) and `application/library/syncLibrary.ts` (`SyncResult` — an operation
result, not a persisted entity, so it stays with its producing use case rather than in `domain/`).

## Entities Owned by Other, Not-Yet-Migrated Domains (consumed, not redefined)

These are referenced by the new ports below but are **not** relocated or redefined by this
feature — they stay under `discogs/` until Historia 3/4 (parent user story) migrates them.

- **DiscogsConnection** (`discogs/oauth/types.ts`): a user's durable Discogs link (`uid`,
  `discogsUsername`, tokens, `linkedAt`, optional `initialLibrarySyncAt` — the flag that switches
  `syncLibrary` between first-sync/union-merge and steady-state/mirror mode).
- **CollectionInstance / InstanceRef / CollectionFieldMap** (`discogs/collection/collectionTypes.ts`):
  the shape of a Discogs collection instance, its write coordinates, and the user's resolved custom
  field IDs.

## Port Contracts (new)

Full method signatures are in `contracts/`. Summarized here as the "relationships" between the
domain/application layer and infrastructure:

| Port | Application-layer consumers | Adapter (this feature) | Wraps (unmoved) |
|---|---|---|---|
| `LibraryRepositoryPort` | `createLibraryEntry`, `getLibraryEntry`, `listLibraryEntries`, `updateLibraryEntry`, `deleteLibraryEntry`, `syncLibrary`, `enrichLibraryEntry` | `adapters/library/firestoreLibraryRepository.ts` | `config/firebase-admin.ts` (`getFirestoreDb`) |
| `DiscogsCollectionPort` | `createLibraryEntry`, `getLibraryEntry`, `updateLibraryEntry`, `deleteLibraryEntry`, `syncLibrary` | `adapters/library/discogsCollectionAdapter.ts` | `discogs/collection/collectionClient.ts` |
| `DiscogsConnectionPort` | `createLibraryEntry`, `getLibraryEntry`, `updateLibraryEntry`, `deleteLibraryEntry`, `syncLibrary` (all via a shared `requireConnection` helper) | `adapters/library/discogsConnectionAdapter.ts` | `discogs/oauth/discogsOauthService.ts` (`getConnection`, `markInitialLibrarySync`) |
| `CachePort` | `syncLibrary` (freshness marker only — today's `isMarkerFresh`/`setMarker`) | `adapters/library/cacheAdapter.ts` | `cache/redisClient.ts` (`getRedisClient`), called directly today rather than through `cacheAside.ts`'s `withCache` |

## Reconciliation State Machine (`syncLibrary`, unchanged)

Not a new state machine — recorded here because it's the most complex existing business rule this
feature relocates, to make explicit that its transitions are preserved exactly:

1. **Not linked** → `requireConnection` throws `DiscogsNotLinkedError` (via `DiscogsConnectionPort`).
2. **Linked, marker fresh, not forced** → sync skipped (`{ skipped: true, ... }`), no reads/writes.
3. **Linked, first sync** (`connection.initialLibrarySyncAt` absent) → union-merge: matched entries
   reconcile in place, unmatched local entries are pushed to Discogs (`pushEntryToDiscogs`), legacy
   fields migrate once per matched/pushed entry, then `markInitialLibrarySync` is called
   (via `DiscogsConnectionPort`) only if `result.failures === 0`.
4. **Linked, steady state** (`initialLibrarySyncAt` present) → mirror mode: matched entries
   reconcile in place, unmatched Discogs instances create new local entries, unmatched local
   entries are deleted.
5. **Any outcome with zero failures** → the freshness marker is set (via `CachePort`), regardless
   of whether the cache backend is actually available (fail-soft: a `CachePort` miss/outage never
   fails the sync itself).
