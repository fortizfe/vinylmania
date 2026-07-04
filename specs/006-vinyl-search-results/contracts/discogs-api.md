# API Contracts: Discogs Search & Release Preview

## `GET /api/discogs/search` (CHANGED)

**Auth**: Required (`requireAuth`) — unchanged.

**Query params**:

| Param | Type | Change |
|---|---|---|
| `q` | string | Unchanged |
| `type` | `'release' \| 'artist'` | Unchanged (defaults to `release`) |
| `page` | number | **NEW** — forwarded to `searchCatalog`; defaults to `1` when absent/invalid, matching `searchCatalog`'s own default |
| `perPage` | number | **NEW** — forwarded to `searchCatalog`; defaults to `20` when absent/invalid (frontend's chosen default per research.md §1; `searchCatalog`'s own internal default remains 50 for any other caller that omits it) |

**Response 200** (shape unchanged, one field addition per result):

```json
{
  "results": [
    {
      "discogsId": 1,
      "resultType": "release",
      "title": "Stockholm",
      "artist": "The Persuader",
      "thumbnailUrl": "https://...",
      "year": 1999,
      "formats": ["Vinyl"]
    }
  ],
  "pagination": { "page": 1, "pages": 3, "items": 47, "perPage": 20 }
}
```

- `artist` is omitted (not `null`) when it cannot be parsed from the raw
  title.
- Existing error responses (`401`, `502 catalog_unavailable`, `500
  internal_error`) are unchanged.

**Contract**:
- Sending no `page`/`perPage` MUST behave exactly as it does today from the
  caller's perspective for `page` (defaults to page 1); `perPage`'s backend
  default is unchanged at 50 for callers that don't specify it, so this is
  purely additive.
- `artist`, when present, MUST be the substring before the first `" - "` in
  the raw Discogs title; `title` MUST be the substring after it in that case.

## `GET /api/discogs/releases/:discogsId` (NEW)

**Auth**: Required (`requireAuth`), matching `/api/discogs/search`.

**Path param**: `discogsId` — the Discogs release id (number).

**Response 200**: the existing `Release` shape (identical to
`EnrichedLibraryEntry.release` for an `ok` catalog status):

```json
{
  "discogsId": 1,
  "title": "Stockholm",
  "year": 1999,
  "country": "Sweden",
  "artists": [{ "discogsArtistId": 1, "name": "The Persuader" }],
  "labels": [{ "discogsLabelId": 5, "name": "Svek", "catalogNumber": "SK032" }],
  "formats": [{ "name": "Vinyl", "descriptions": ["12\""] }],
  "genres": ["Electronic"],
  "styles": ["Deep House"],
  "tracklist": [{ "position": "A", "title": "Östermalm", "duration": "4:45" }],
  "images": [{ "url": "https://...", "imageType": "primary" }],
  "discogsUrl": "https://www.discogs.com/release/1"
}
```

**Response 404** (release not found):

```json
{ "error": "release_not_found", "message": "No release/artist found for that ID." }
```

**Response 502** (`catalog_unavailable`) / **500** (`internal_error`): same
shape/convention as every other Discogs-backed route in this codebase.

**Contract**:
- MUST call the existing `getRelease(discogsReleaseId)` — no new Discogs API
  interaction pattern is introduced.
- MUST NOT require the release to already exist in the caller's library —
  this is precisely for previewing releases that aren't there yet.
- MUST log success/not-found/error the same way `/api/discogs/search` does
  (Principle V, Observability).

## Frontend service contract (`frontend/src/services/discogsApi.ts`)

```ts
export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist';
  title: string;
  artist?: string;   // NEW
  thumbnailUrl?: string;
  year?: number;
  formats?: string[];
}

export async function search(
  query: string,
  resultType: 'release' | 'artist',
  page?: number,       // NEW
  perPage?: number,    // NEW
): Promise<CatalogSearchResponse>;

export async function getRelease(discogsId: number): Promise<Release>; // NEW
```

**Contract**: `search()`'s existing callers that don't pass `page`/`perPage`
continue to work unchanged (both become optional parameters).

## UI Component Contracts (`frontend/src/components/`)

### `Modal` (`ui/Modal.tsx`)

```ts
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
```

**Contract**: Renders nothing when `open` is `false`. When `open`, renders a
backdrop plus a `Card`-based content panel with `role="dialog"` and
`aria-modal="true"`; calls `onClose` on backdrop click, on a visible close
control, and on `Escape` keydown. Has no knowledge of what it contains.

### `ResultCardActions`

```ts
interface ResultCardActionsProps {
  onAdd: () => void;
  onPreview: () => void;
  adding: boolean;
  added: boolean;
}
```

**Contract**: Always renders both actions in the same position/order. The add
action is disabled and shows a busy state while `adding` is true, and is
replaced by an "added" confirmation state (still visually present, no longer
clickable) once `added` is true. The preview action is always independently
clickable regardless of the add action's state.

### `SearchResultCard`

```ts
interface SearchResultCardProps {
  result: CatalogSearchResult;
  onAdd: () => void;
  onPreview: () => void;
  adding: boolean;
  added: boolean;
}
```

**Contract**: Renders the result's thumbnail (or placeholder), title, artist
(when present), year, and format (when present) inside a `Card`, plus one
`ResultCardActions`. Passes `adding`/`added` straight through — it does not
own that state itself (the page/grid does, per result).

### `ReleasePreviewModal`

```ts
interface ReleasePreviewModalProps {
  open: boolean;
  onClose: () => void;
  release: Release | null;
  loading: boolean;
}
```

**Contract**: Renders a `Modal` whose content is a loading skeleton while
`loading` is true, the release's cover/title/artists/tracklist once `release`
is populated, or an error message if `release` is `null` and `loading` is
`false` (fetch failed).
