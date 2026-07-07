# API Contract: Discogs Search Filters

**Feature**: 021-search-result-filters | **Date**: 2026-07-07

This feature introduces an additive, backward-compatible contract change to
the existing authenticated search endpoint (already extended once for
rating enrichment in feature 017).

## Endpoint

`GET /api/discogs/search?q={query}&type=release&page={page}&perPage={perPage}&artist={artist}&genre={genre}&style={style}&format={format}`

- Firebase auth remains required (unchanged 401 behavior).
- `q`, `type`, `page`, `perPage` are unchanged from the existing contract.
- `artist`, `genre`, `style`, `format` are new, all optional, all strings.
- Any subset of the four new params may be present (including none, matching
  today's behavior exactly, or all four).
- Omitted, empty, or whitespace-only values for `artist`/`genre`/`style`/`format`
  are treated as not set and excluded from the underlying Discogs request —
  they MUST NOT be forwarded as empty-string parameters.
- The response body shape (`results`, `pagination`) is entirely unchanged.

## Request examples

```text
# Query only (existing behavior, unaffected)
GET /api/discogs/search?q=nirvana&type=release&page=1&perPage=20

# Query + single filter
GET /api/discogs/search?q=nirvana&type=release&page=1&perPage=20&genre=Rock

# Query + multiple filters
GET /api/discogs/search?q=nirvana&type=release&page=1&perPage=20&genre=Rock&format=Vinyl&style=Grunge

# Filter value with surrounding whitespace — trimmed before use
GET /api/discogs/search?q=nirvana&type=release&genre=%20Rock%20
```

## Response shape

Unchanged from the existing contract (see
`specs/017-record-rating-cards/contracts/discogs-search-rating-api.md`):

```jsonc
{
  "results": [
    {
      "discogsId": 249504,
      "resultType": "release",
      "title": "Never Gonna Give You Up",
      "artist": "Rick Astley",
      "thumbnailUrl": "https://...",
      "year": 1987,
      "formats": ["Vinyl"],
      "communityRating": { "average": 4.19, "count": 47 }
    }
  ],
  "pagination": { "page": 1, "pages": 12, "items": 240, "perPage": 20 }
}
```

No new fields are added to individual results or to `pagination` by this
feature — filters only affect *which* results Discogs returns, not their
shape.

## Downstream request to Discogs

The backend forwards the four filter values, unchanged, as same-named query
parameters on the existing `GET /database/search` call
(`discogsClient.searchCatalog`):

```text
GET https://api.discogs.com/database/search?q=nirvana&type=release&page=1&per_page=20&artist=Nirvana&genre=Rock&style=Grunge&format=Vinyl
```

This matches the parameter names documented in the Discogs Database →
Search API reference supplied for this feature.

## Cache-aside key

The Redis cache-aside key used by `searchCatalog()` MUST incorporate the
active filter values (in a stable, deterministic order) so that a filtered
and an unfiltered request for the same `query`/`page`/`perPage` never share
a cached response:

```text
discogs:search:{resultType}:{query}:{page}:{perPage}:{artist}:{genre}:{style}:{format}
```

An unset filter contributes an empty segment (e.g. `discogs:search:release:nirvana:1:20:::Rock:`
when only `style=Rock` is set) so the key remains stable and collision-free
across different filter combinations.

## Error behavior

Unchanged from the existing contract:

| Status | Body `error` | When |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid Firebase token |
| 502 | `catalog_unavailable` | Base Discogs search request fails or is rate-limited |
| 500 | `internal_error` | Unexpected backend failure |

Filters do not introduce any new error case — an invalid or non-matching
filter value simply produces zero (or fewer) results with a normal `200`
response, exactly as an overly specific search query does today.

## Observability

The existing structured log emitted by `GET /api/discogs/search`
(`backend/src/routes/discogs.ts`) MUST additionally record which of the four
filters were active (not their values, to avoid noisy/unbounded log
cardinality — e.g. `meta: { filters: ['genre', 'format'] }`), consistent
with Constitution Principle V (Observability).
