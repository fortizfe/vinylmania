# Contract: `GET /api/discogs/search` (delta from feature 021)

**Feature**: 022-search-filter-refinements

This documents only the **changes** to the request/response contract established
in `specs/021-search-result-filters/contracts/discogs-search-filters-api.md`. All
other aspects of that contract (endpoint path, `q`/`type`/`page`/`perPage`,
response shape, error responses, caching behavior) are unchanged.

## Request

`GET /api/discogs/search?q={query}&type=release&page={page}&perPage={perPage}&genre={genre}&style={style}&format={format}`

- **`artist`**: **Removed.** The backend no longer parses or forwards this
  parameter (spec FR-001, FR-009). If a request includes `artist=...` (e.g. from
  an old bookmarked link), it is silently ignored — not read, not validated, not
  forwarded to Discogs, and does not affect the response. This is a backward
  -compatible change at the HTTP level: no error is returned for its presence.
- **`format`**: Unchanged in shape (still a single optional string), but its
  **content** may now be a comma-separated list of format values (e.g.
  `format=Vinyl,CD`) representing a multi-select query (spec FR-004, FR-011).
  Verified against the live Discogs API during implementation (feature 022,
  T014): Discogs matches this as AND semantics (only releases available in
  *all* listed formats simultaneously), not OR — see `research.md` for the
  measured item counts that confirmed this. The backend does not parse,
  validate, or split this value — it is trimmed (as before) and forwarded
  as-is to Discogs' `/database/search` `format` parameter, unchanged from
  feature 021's passthrough behavior.
- **`genre`, `style`**: Unchanged from feature 021.

## Response

Unchanged from feature 021 — same `CatalogSearchResponse` shape
(`results`, `pagination`).

## Caching

Unchanged structurally — the cache key
(`discogs:search:{resultType}:{query}:{page}:{perPage}:{artist}:{genre}:{style}:{format}`)
drops the `artist` segment (always empty going forward) and the `format` segment
now naturally varies by the full comma-joined string, so different multi-format
selections produce distinct cache entries as expected.

## Example

```text
GET /api/discogs/search?q=nirvana&type=release&page=1&perPage=20&genre=Rock&format=Vinyl,CD
```

forwards to Discogs as:

```text
GET https://api.discogs.com/database/search?q=nirvana&type=release&page=1&per_page=20&genre=Rock&format=Vinyl,CD
```

## Backend contract test coverage (feature 022 delta)

- `artist` query param present on a request → asserted absent from the outbound
  Discogs request params (no forwarding, no error).
- `format=Vinyl,CD` → asserted forwarded to Discogs verbatim as `format=Vinyl,CD`
  (single request, no splitting/multiple calls).
- Cache key no longer varies by `artist` (two requests differing only by
  `artist` value hit the same cache entry) — documents the now-inert segment;
  removing the segment outright is an acceptable alternative implementation.
