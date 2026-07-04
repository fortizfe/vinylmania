# API Contract: Discogs Release Detail (CHANGED)

## `GET /api/discogs/releases/:discogsId`

**Auth**: Required (`requireAuth`) — unchanged.

**Path param**: `discogsId` — the Discogs release id (number) — unchanged.

**Response 200** (shape extended, four new optional fields on `Release`;
all existing fields unchanged):

```json
{
  "discogsId": 1,
  "title": "Stockholm",
  "year": 1999,
  "country": "Sweden",
  "releaseDate": "1999-05-01",
  "artists": [{ "discogsArtistId": 1, "name": "The Persuader" }],
  "labels": [{ "discogsLabelId": 5, "name": "Svek", "catalogNumber": "SK032" }],
  "formats": [{ "name": "Vinyl", "descriptions": ["12\""] }],
  "genres": ["Electronic"],
  "styles": ["Deep House"],
  "notes": "Recorded at Stockholm Sound Studio.",
  "identifiers": [
    { "type": "Barcode", "value": "7 39051 23421 6" },
    { "type": "Matrix / Runout", "value": "SK032-A", "description": "Side A Runout" }
  ],
  "community": {
    "have": 214,
    "want": 58,
    "rating": { "average": 4.3, "count": 37 }
  },
  "tracklist": [{ "position": "A", "title": "Östermalm", "duration": "4:45" }],
  "images": [
    { "url": "https://...", "imageType": "primary" },
    { "url": "https://...", "imageType": "secondary" }
  ],
  "discogsUrl": "https://www.discogs.com/release/1"
}
```

- `releaseDate`, `notes`, and `community` are omitted (not `null`) when
  Discogs has no data for them on the given release.
- `identifiers` defaults to `[]` when Discogs returns none, matching the
  existing convention for `labels`/`formats`/`tracklist`/`images`.
- `images` already returns every image Discogs has for the release (no
  change here) — this contract change does not add or remove entries from
  that array, it only documents that consumers should now expect to use all
  of them (see spec FR-006/FR-007), not just the first.

**Response 404 / 502 / 500**: unchanged from the existing contract
(`release_not_found`, `catalog_unavailable`, `internal_error`).

**Contract**:
- Existing consumers reading only the previously-documented fields continue
  to work unchanged (purely additive response shape) — no MAJOR/breaking
  change.
- `releaseDate`/`notes`/`community` presence depends entirely on what
  Discogs has published for that specific release; callers MUST treat their
  absence as "unknown", not as an error.
