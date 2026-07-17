# API Contract: Discogs Search — `country`/`labels` enrichment

**Feature**: 052-grid-list-view-toggle | **Date**: 2026-07-17

This feature introduces an additive, backward-compatible contract change to
the existing authenticated search endpoint (already extended for filters in
feature 021 and rating enrichment in feature 017).

## Endpoint

`GET /api/discogs/search?q={query}&type=release&page={page}&perPage={perPage}&artist={artist}&genre={genre}&style={style}&format={format}`

- Firebase-session auth remains required (unchanged 401 behavior).
- All existing query params (`q`, `type`, `page`, `perPage`, `artist`,
  `genre`, `style`, `format`) are unchanged.
- No new query param is introduced by this feature.

## Response body (extended)

Response shape (`{ results: CatalogSearchResult[], pagination }`) is
unchanged in structure. Each `CatalogSearchResult` item in `results` gains
two new **optional** fields:

```jsonc
{
  "results": [
    {
      "discogsId": 249504,
      "resultType": "release",
      "title": "Nevermind",
      "artist": "Nirvana",
      "thumbnailUrl": "https://...",
      "year": 1991,
      "formats": ["Vinyl", "LP", "Album"],
      "communityRating": { "average": 4.6, "count": 812 },
      "country": "US",          // NEW — omitted (not null/empty string) when Discogs has no value
      "labels": ["DGC"]          // NEW — omitted when Discogs has no value; array, may contain >1 entry
    }
  ],
  "pagination": { "page": 1, "pages": 12, "items": 231, "perPage": 20 }
}
```

- `country`: string, omitted when not available from Discogs. Never `null`
  or `""`.
- `labels`: array of strings, omitted (not `[]`) when Discogs provides no
  label. When present, always has at least one entry.
- For `resultType: "master"` results, `country`/`labels` are mapped the
  same way as `formats`/`year` already are today (no master-specific
  branching in the mapper) — present when Discogs provides them. The list
  view still renders masters as a simplified row without these fields
  (spec FR-012), but that is a presentation choice on the frontend, not a
  mapping-layer omission.
- `resultType: "artist"` results: unaffected — never had `formats` either;
  `country`/`labels` are simply never populated for this type, same as
  today's behavior for the other release-only fields.

## Backward compatibility

- Any existing consumer that does not read `country`/`labels` is
  unaffected — both fields are additive and optional (constitution
  Principle VI: MINOR change, not MAJOR).
- Response 401/429/502 behaviors (auth failure, rate limiting, Discogs
  unavailable) are entirely unchanged — this feature does not touch error
  handling in `discogsRoutes.ts` or `searchCatalogWithRatings.ts`.

## Request examples

```text
# Unaffected — response now simply includes country/labels when available
GET /api/discogs/search?q=nirvana&type=release&page=1&perPage=20
```

## Non-goals

- This contract does not change `GET /api/discogs/masters/{id}/versions`
  (`MasterReleaseVersion`, which already has `country`/`label` — see
  `research.md` R3) — that endpoint is out of scope (spec "Fuera de
  alcance").
- This contract does not add `country`/`labels` to any library endpoint —
  `GET /api/library` already returns the full `Release` shape, which
  already has `country`/`labels` (`labels: LabelCredit[]`) unchanged by
  this feature.
