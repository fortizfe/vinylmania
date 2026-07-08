# Contract: Catalog API additions/changes

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Backend surface is `backend/src/routes/discogs.ts` (mounted under `/api/discogs`, `requireAuth`-gated like the two existing routes). All responses follow the existing route conventions: `200` on success, `404` with `{ error: 'release_not_found' | 'master_not_found', message }` when the catalog id doesn't resolve, `502` with `{ error: 'catalog_unavailable', message }` on Discogs rate-limit/outage, `500` with `{ error: 'internal_error', message }` on unexpected failure.

## Changed: `GET /api/discogs/search`

No path/param contract change. Behavior change only: the backend no longer forces `type=release` — it requests the underlying Discogs search without a type restriction and keeps only `release`/`master` hits itself, dropping anything else Discogs returns unfiltered (research Decision 1). Response shape (`CatalogSearchResponse`) is unchanged except `results[].resultType` may now be `'master'` (data-model.md).

```jsonc
// Existing response envelope, now with a master hit example
{
  "results": [
    {
      "discogsId": 1234,           // master id, when resultType is "master"
      "resultType": "master",
      "title": "Hybrid Theory",
      "artist": "Linkin Park",
      "thumbnailUrl": "https://...",
      "year": 2000,
      "formats": ["Vinyl"],
      "communityRating": { "average": 4.5, "count": 812 } // from the master's main release
    }
  ],
  "pagination": { "page": 1, "pages": 12, "items": 234, "perPage": 20 }
}
```

## New: `GET /api/discogs/masters/:discogsId`

Returns `MasterRelease` (data-model.md).

- **Auth**: required (`requireAuth`, same as existing catalog routes).
- **Path params**: `discogsId` (number, the Discogs master id).
- **200 response body**:

```jsonc
{
  "discogsId": 1234,
  "title": "Hybrid Theory",
  "year": 2000,
  "artists": [{ "discogsArtistId": 1, "name": "Linkin Park" }],
  "genres": ["Rock"],
  "styles": ["Nu Metal"],
  "images": [{ "url": "https://...", "imageType": "primary" }],
  "tracklist": [{ "position": "1", "title": "Papercut" }],
  "mainReleaseId": 5678,
  "discogsUrl": "https://www.discogs.com/master/1234"
}
```

- **404** `{ "error": "master_not_found", "message": "No master release found for that ID." }`

## New: `GET /api/discogs/masters/:discogsId/versions`

Returns a paginated `MasterReleaseVersionsPage` (data-model.md). Backs the master detail page's version table (FR-009).

- **Auth**: required.
- **Path params**: `discogsId` (number, the Discogs master id).
- **Query params**:
  - `page` (optional, default `1`)
  - `perPage` (optional, default `10` — matches FR-009; callers should not need to override this for the version table, but the param exists for consistency with the search endpoint's pagination style)
- **200 response body**:

```jsonc
{
  "results": [
    {
      "discogsId": 5678,
      "title": "Hybrid Theory",
      "format": "Vinyl, LP, Album",
      "year": 2000,
      "label": "Warner Bros. Records",
      "country": "US",
      "thumbnailUrl": "https://..."
    }
  ],
  "pagination": { "page": 1, "pages": 3, "items": 27, "perPage": 10 }
}
```

- **404** `{ "error": "master_not_found", "message": "No master release found for that ID." }`

## Frontend consumption contract

`frontend/src/services/discogsApi.ts` gains:

```ts
getMasterRelease(discogsId: number): Promise<MasterRelease>
getMasterReleaseVersions(discogsId: number, page?: number): Promise<MasterReleaseVersionsPage>
```

`frontend/src/queries/discogsQueries.ts` gains matching `useCatalogMaster(discogsId)` and `useCatalogMasterVersions(discogsId, page)` hooks (React Query), following the existing `useCatalogRelease` pattern (cache key, `enabled` guard on a defined id).

## Routing contract (frontend)

| Route | Page | Reads |
|---|---|---|
| `/app/releases/:discogsId` | Release detail page (new) | `useCatalogRelease` (existing hook, reused) |
| `/app/masters/:discogsId` | Master release detail page (new) | `useCatalogMaster`, `useCatalogMasterVersions` (new hooks) |

Both routes sit under the existing `AuthenticatedLayout` wrapper in `frontend/src/App.tsx`, alongside `/app/search`.
