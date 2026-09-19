# Contract: `GET /api/library` (068 diff)

Route, auth (`requireAuth`), rate limit (`standardRateLimit`), gate errors (`discogs_not_linked` / `discogs_link_invalid` / `discogs_unavailable` via `respondCollectionError`) and status codes are **unchanged**. Two optional query params are added and each item may carry one extra field → **MINOR** (Principle VI).

## Request

| Param | Type | Default | Validation | Status |
|---|---|---|---|---|
| `page` | int ≥ 1 | 1 | clamped (unchanged) | existing |
| `pageSize` | int 1–50 | 20 | clamped (unchanged) | existing |
| `refresh` | `'true'` | — | forces sync (unchanged) | existing |
| `genre`, `style`, `format` | comma-joined | — | passed through, unknown values match nothing (unchanged) | existing |
| `sort` | `added` \| `artist` \| `album` | `added` | unknown/absent → `added`, **silently** (no 400) | **NEW** |
| `dir` | `asc` \| `desc` | `desc` for `added`, `asc` otherwise | unknown/absent → criterion default, **silently** | **NEW** |

Ordering semantics: [data-model.md §3](../data-model.md). The order is computed over the **whole** filtered collection before `page`/`pageSize` slicing, for every `sort` (the default included). For a fixed collection, concatenating pages `1…⌈totalItems/pageSize⌉` yields each matching entry exactly once.

## Response 200 (shape unchanged)

```ts
interface LibraryListResponse {
  items: LibraryListItem[];   // ≤ pageSize, in the requested global order
  page: number;
  pageSize: number;
  totalItems: number;         // count of entries matching the filters
}
interface LibraryListItem {
  id: string;
  discogsReleaseId: number;
  addedAt: string;
  discogsInstanceId?: number;
  discogsFolderId?: number;
  genre?: string[]; style?: string[]; format?: string[];
  year?: number; label?: string[];
  primaryArtist?: string;
  title?: string;             // NEW — album title mirrored from the Discogs collection (absent until next sync)
  catalogStatus: 'ok' | 'unavailable';
  release: Release | null;
  discogs: null;
}
```

## Log line (Principle V)

The existing success line `route: '/api/library', outcome: 'success'` gains `meta: { filters: string[], sort, dir, page, totalItems }`.

## Contract test cases (`backend/tests/contract/library/library.contract.test.ts`)

1. `?sort=artist&dir=asc`: names with accents, case and a leading article sort as in data-model §3 ("The Clash" between "Björk" and "Motörhead"); entries without `primaryArtist` come last, newest first.
2. `?sort=artist&dir=desc`: the reverse of the present group; entries without the key are **still last**.
3. `?sort=album&dir=asc` uses `title`; ties break by artist, then `addedAt` desc, then `id`.
4. `?sort=added&dir=asc`: oldest first. No params: newest first (regression for today's default).
5. `?sort=foo&dir=up`: 200, same body as no params.
6. `?sort=artist&genre=Rock&pageSize=2`, pages 1–3: concatenation = filtered + sorted set, no duplicates, `totalItems` = filtered count.
7. Each item carries `title` after a sync whose `basic_information.title` is non-empty.
