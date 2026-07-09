# Data Model: Search Results Organization

## Summary

This feature introduces **no new entities, fields, or schema changes**. It changes:
1. The *order* in which existing `CatalogSearchResult` entries are returned within a page/batch.
2. The *paging strategy* used to request more of them (accumulating pages via infinite scroll instead of discrete Previous/Next navigation) — a client-side request pattern, not a data shape change.
3. Which *existing* field (`formats`) is rendered on which card type — a presentation rule, not a data change.

## Existing Entity (reused, unmodified)

### `CatalogSearchResult` (`frontend/src/services/discogsApi.ts`, mirrored in `backend/src/discogs/types.ts`)

| Field | Type | Notes |
|---|---|---|
| `discogsId` | `number` | Discogs catalog identifier |
| `resultType` | `'release' \| 'artist' \| 'master'` | Already distinguishes masters from releases — the field this feature's ordering and badge-visibility rules key off of. No change. |
| `title` | `string` | |
| `artist` | `string?` | |
| `thumbnailUrl` | `string?` | |
| `year` | `number?` | |
| `formats` | `string[]?` | Source of the format badge; still populated for master results (Discogs may include it), but the UI now chooses not to render it for `resultType === 'master'`. |
| `communityRating` | `CommunityRating?` | Unaffected. |

No fields are added, removed, or retyped.

### `CatalogSearchResponse`

| Field | Type | Notes |
|---|---|---|
| `results` | `CatalogSearchResult[]` | **Ordering behavior changes**: within each page, `resultType === 'master'` entries are moved ahead of `resultType === 'release'`/`'artist'` entries; relative order within each group is preserved (stable partition, not a re-sort by other fields). |
| `pagination` | `{ page, pages, items, perPage }` | Unchanged shape; `perPage` remains 20 for the search-results page (per Clarifications). Still used by the frontend to compute `hasNextPage`/`getNextPageParam` for `useInfiniteQuery` instead of driving Previous/Next buttons. |

## State / Lifecycle

Not applicable — search results are a stateless, read-only projection of a Discogs API response for the duration of a single search session (no persisted state, no transitions). The only "state" introduced is client-side and ephemeral:

- **Accumulated pages** (frontend only, in-memory via `useInfiniteQuery`'s cache): the list of pages fetched so far for the current `(query, filters)` pair; reset automatically whenever `query` or `filters` change, since those form part of the query key.
- **Fetch status flags**: `isFetchingNextPage`, `hasNextPage`, `isError` (all provided by `useInfiniteQuery`) drive the loading indicator (FR-007), end-of-results indicator (FR-008), and retry affordance (FR-010) — no new persisted or derived data structures are needed.

## Validation Rules

No new validation rules. Existing request validation in `backend/src/routes/discogs.ts` (`parsePageParams`, `parseFilterParams`) is unchanged; the infinite-scroll client simply issues the same shaped requests (`q`, `type`, `page`, `perPage`, filter params) incrementally instead of on button click.
