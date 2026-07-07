# Phase 1 Data Model: Search Result Filters

This feature introduces no persisted entity and no database schema change.
The only "data model" is the shape of the **Search Filter Set** as it flows
through the existing search pipeline: URL → frontend state → API request →
Discogs request → (as request parameters only; Discogs responses are
unaffected in shape).

## Search Filter Set

An in-memory/URL-encoded value object — never persisted — representing the
currently active filters for one search.

| Field | Type | Required | Notes |
|---|---|---|---|
| `artist` | `string` | optional | Free text. Trimmed; empty/whitespace-only → omitted entirely. |
| `genre` | `string` | optional | Free text. Trimmed; empty/whitespace-only → omitted entirely. |
| `style` | `string` | optional | Free text. Trimmed; empty/whitespace-only → omitted entirely. |
| `format` | `string` | optional | Free text. Trimmed; empty/whitespace-only → omitted entirely. |

**Validation rules** (spec FR-010):
- Leading/trailing whitespace is trimmed before a value is considered "set."
- A trimmed-empty value is treated as "not set" and excluded from every
  downstream representation (URL query string, API request, Discogs
  request) — it is never sent as an empty-string parameter.
- No other validation is applied (no enum/allowlist check — see
  `research.md` → "No new validation beyond trim-and-drop-empty").

**Lifecycle**:
1. User edits one or more of the four fields in `SearchFiltersControl` (local,
   uncommitted UI state).
2. User selects "Apply filters" → the trimmed, non-empty subset of the four
   fields is committed to the results screen URL (alongside existing `q`,
   `page`) and `page` resets to `1`.
3. `useCatalogSearch` (extended) includes the committed filter values in its
   TanStack Query key and in the `discogsApi.search()` request.
4. The backend route (`GET /api/discogs/search`) parses the same four query
   params and forwards them, unchanged, into
   `searchCatalog(query, { resultType, page, perPage, artist, genre, style,
   format })`.
5. `discogsClient.searchCatalog()` includes the four values in both the Redis
   cache-aside key and the outbound `GET /database/search` request `params`.
6. "Clear filters" removes all four fields from the URL (and thus from the
   query key / request) in one action, leaving `q`/`page` untouched.

**Relationships**: None — the Search Filter Set has no relationship to any
persisted entity (`Release`, `Artist`, library records, etc.). It only
parameterizes a read-only catalog search request.

## Existing types touched (no shape change to persisted/response data)

- `SearchCatalogOptions` (`backend/src/discogs/discogsClient.ts`) gains four
  optional string fields: `artist`, `genre`, `style`, `format`.
- The `GET /api/discogs/search` request query accepts four new optional
  string params of the same names (response body shape is unchanged — see
  `contracts/discogs-search-filters-api.md`).
- `discogsApi.search()` (`frontend/src/services/discogsApi.ts`) gains a
  filters parameter mirroring the same four fields.
- `useSearchQueryParams` (`frontend/src/hooks/useSearchQueryParams.ts`)
  gains parsed `artist`/`genre`/`style`/`format` fields alongside the
  existing `query`/`page`, and `buildSearchPath` gains a matching optional
  filters argument.
