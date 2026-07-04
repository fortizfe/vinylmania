# Phase 1 Data Model: Application Caching (Frontend State & Backend Responses)

This feature introduces no Firestore schema changes and no new persisted business entities — both entities below are transient cache state (client memory / Redis with TTL), derived entirely from data that already exists elsewhere (Firestore library entries, Discogs API responses). Fields are described for implementation clarity, not as a database migration.

## Client Query Cache Entry (frontend, in-memory, owned by TanStack Query)

Represents one cached read result, keyed by a query key produced by the factories in `frontend/src/queries/*`.

| Field | Type | Notes |
|---|---|---|
| `queryKey` | `readonly unknown[]` | e.g. `['library', 'list', page, pageSize]`, `['library', 'entry', entryId]`, `['discogs', 'search', type, query, page, perPage]`, `['discogs', 'release', discogsId]`. Must be structured/serializable so partial-key invalidation works (e.g. invalidating `['library']` clears all library queries). |
| `data` | resource-specific (`PaginatedLibraryEntries`, `EnrichedLibraryEntry`, `CatalogSearchResponse`, `Release`) | The last successfully fetched value; identical in shape to what the corresponding `services/*Api.ts` function already returns today (FR-010 — no shape changes). |
| `dataUpdatedAt` | `number` (epoch ms) | Managed internally by TanStack Query; used to compute staleness against `staleTime`. |
| `status` | `'pending' \| 'success' \| 'error'` | Standard TanStack Query status; `isFetching` (separate flag) distinguishes a background refresh from the initial `pending` load, which is what lets FR-002/FR-003 show cached data instantly while a refresh happens invisibly. |

**Relationships**: A `Client Query Cache Entry` for a library entry is invalidated (removed from "fresh" consideration) whenever a mutation hook for that same entry (update/remove) or the library list succeeds — see Research §2.

**Lifecycle**: created on first `useQuery` call for a key → marked stale after `staleTime` elapses or on explicit invalidation → garbage-collected after `gcTime` of no active observers (no component using that key).

## Cached Catalog Response (backend, Redis, TTL-bound)

Represents one cached external Discogs lookup, stored by `backend/src/cache/cacheAside.ts`.

| Field | Type | Notes |
|---|---|---|
| `key` | `string` | Deterministic string built from the function name + normalized arguments, e.g. `discogs:release:249504`, `discogs:search:release:aphex twin:1:50`. Never includes a user identifier — this cache is shared across users per FR-005/spec Assumptions (catalog data only). |
| `value` | JSON-serialized `Release \| Artist \| CatalogSearchResponse` | Identical shape to the live Discogs client return type (FR-010) — deserialized back to the same TypeScript type on read. |
| `ttlSeconds` | `number` | Set via Redis `EX` on write; see Research §5 for the two TTL tiers (releases/artists vs. search). Enforces FR-007 (bounded max age). |

**Relationships**: None to other entities — purely a derived, disposable cache of `discogsClient.ts` function outputs. Never written to from the library/Firestore side, and never used as a source of truth (constitution's Vinyl Data Source rule).

**Lifecycle**: written on cache miss after a live Discogs fetch → served on subsequent hits within `ttlSeconds` → expires automatically via Redis TTL (no explicit invalidation path needed, since Discogs catalog data has no user-triggered write path in this app).
