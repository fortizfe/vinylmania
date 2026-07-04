# Phase 1 Data Model: Vinyl Search Results — Cards, Actions & Pagination

## 1. Domain Types (backend, `backend/src/discogs/types.ts`)

### `CatalogSearchResult` (CHANGED — one new optional field)

| Field | Type | Notes |
|---|---|---|
| `discogsId` | `number` | Unchanged |
| `resultType` | `'release' \| 'artist'` | Unchanged |
| `title` | `string` | CHANGED in meaning only: when the raw Discogs title matches the `"Artist - Title"` convention, this is now just the release title (artist prefix stripped). When it doesn't match, unchanged (full original string). |
| `artist` | `string` (optional) | **NEW**. Present only when the artist could be parsed out of the raw title. |
| `thumbnailUrl` | `string` (optional) | Unchanged |
| `year` | `number` (optional) | Unchanged |
| `formats` | `string[]` (optional) | Unchanged |

### `CatalogSearchResponse` — unchanged shape

```ts
{ results: CatalogSearchResult[]; pagination: { page, pages, items, perPage } }
```

Only the *behavior* changes: `page`/`perPage` in the request now actually
influence which Discogs page is fetched (previously always page 1 / 50 per
page regardless of request).

### `Release` — unchanged, reused as-is

The existing `Release` type (already used for `EnrichedLibraryEntry.release`)
is reused verbatim as the response body of the new preview endpoint. No new
fields.

## 2. New Endpoint Contract Summary (see `contracts/` for full detail)

| Endpoint | Change | Purpose |
|---|---|---|
| `GET /api/discogs/search` | Changed | Now forwards `page`/`perPage` query params to `searchCatalog`; results include the new optional `artist` field |
| `GET /api/discogs/releases/:discogsId` | **New** | Returns the full `Release` for a given Discogs release id, for the preview action — independent of whether it's in the collector's library |

## 3. Frontend Component Model

| Component | Represents | Key Props | Composed from |
|---|---|---|---|
| `Modal` (new, `ui/`) | Generic centered overlay on a backdrop | `open`, `onClose`, `children`, `title?` | `Card` (for the content panel) |
| `ResultCardActions` (new) | The "botonera" — add + preview icon actions for one result | `onAdd`, `onPreview`, `adding` (bool), `added` (bool) | `Button` (icon-only variant) |
| `SearchResultCard` (new) | One search result rendered as a card | `result: CatalogSearchResult`, `onAdd`, `onPreview`, `adding`, `added` | `Card`, `Avatar` (or plain `img`/placeholder for the thumbnail), `Badge` (format), `ResultCardActions` |
| `SearchResultCardSkeleton` (new) | Loading placeholder matching `SearchResultCard`'s shape | none | `Card`, `Skeleton` |
| `ReleasePreviewModal` (new) | The preview overlay's content | `release: Release \| null`, `loading`, `open`, `onClose` | `Modal` |

## 4. Screen State Model — `AddRecordPage` results area

Same four-state model established in feature 004 (`loading | empty | error |
loaded`), now applied to the paginated results grid instead of a plain list:

| State | Trigger | Rendering |
|---|---|---|
| `loading` | A search or page-navigation request is in flight | A grid of `SearchResultCardSkeleton`, same column count as the loaded grid |
| `empty` | Search succeeded, zero results on this page (i.e. the whole search) | Existing "No results found" message, same grid footprint |
| `error` | Search or page-navigation request failed | Error message, same grid footprint |
| `loaded` | Search succeeded, ≥1 result | Grid of `SearchResultCard`, plus pagination controls (hidden/disabled when `pagination.pages <= 1`) |

Each card additionally carries its own small, independent state for the add
action (`idle | adding | added | error`), separate from the page-level state
above — adding one card never re-triggers the whole grid's loading state.

## 5. Relationships

- A `CatalogSearchResult` is never persisted; activating a card's add action
  calls the existing `POST /api/library` with `{ discogsReleaseId:
  result.discogsId }`, which (unchanged) creates a `LibraryEntry` server-side
  and triggers its own enrichment via `getRelease` — the same function this
  feature also exposes directly for previews.
- `ReleasePreviewModal` and `RecordDetailPage` both render a `Release`, but
  from different sources (a fresh `GET /api/discogs/releases/:id` call vs. an
  already-fetched `EnrichedLibraryEntry.release`) — no shared component is
  mandated between them by this feature, though extracting one is a
  reasonable future refactor if their rendering logic drifts apart.
