# API Contract: Discogs Search Rating Enrichment

**Feature**: 017-record-rating-cards | **Date**: 2026-07-06

This feature introduces an additive contract change to the existing authenticated search endpoint used by the add-record flow.

## Endpoint

`GET /api/discogs/search?q={query}&type=release&page={page}&perPage={perPage}`

- Firebase auth remains required.
- Request parameters and top-level pagination shape are unchanged.
- Only release-type results are eligible for rating enrichment.

## Response shape

### Existing shape (unchanged fields)

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
      "formats": ["Vinyl"]
    }
  ],
  "pagination": {
    "page": 1,
    "pages": 12,
    "items": 240,
    "perPage": 20
  }
}
```

### Additive field introduced by this feature

Release results MAY now include:

```jsonc
"communityRating": {
  "average": 4.19,
  "count": 47
}
```

### Full example

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
      "communityRating": {
        "average": 4.19,
        "count": 47
      }
    },
    {
      "discogsId": 3058947,
      "resultType": "release",
      "title": "Nevermind",
      "artist": "Nirvana"
      // no communityRating: result stays valid, just unrated/not enriched
    }
  ],
  "pagination": {
    "page": 1,
    "pages": 2,
    "items": 31,
    "perPage": 20
  }
}
```

## Enrichment rules

- `communityRating` is optional and additive. Existing consumers that ignore unknown fields remain valid.
- The backend includes `communityRating` only when Discogs returns a valid rating object with `count > 0`.
- If the base search succeeds but one or more per-release rating lookups fail, the endpoint still returns `200` with those affected results missing `communityRating`.
- Each per-release rating lookup is bounded by a 2-second timeout (spec SC-006). A lookup still pending past that point is treated identically to a failed lookup: the endpoint still returns `200`, and the affected result omits `communityRating`. The search response as a whole is never delayed past what the base search plus this per-lookup budget requires.
- If the base Discogs search call itself fails or is rate-limited, the endpoint preserves the existing `502 catalog_unavailable` behavior.

## Error behavior

Top-level endpoint errors are unchanged:

| Status | Body `error` | When |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid Firebase token |
| 502 | `catalog_unavailable` | Base Discogs search request fails or is rate-limited |
| 500 | `internal_error` | Unexpected backend failure |

Per-release rating enrichment failure is not surfaced as a top-level error. It is treated as partial metadata omission and logged server-side.

## Frontend consumption notes

- Search-result cards should derive badge visibility from `communityRating.average` and `communityRating.count`.
- Library cards do not consume this contract; they continue using `release.community.rating` from the library API.
- The feature should not introduce a second frontend network request per card. Search cards read rating only from the enriched search payload.