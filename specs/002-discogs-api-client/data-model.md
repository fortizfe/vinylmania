# Data Model: Discogs Catalog Client & Data Model

All entities below are Vinylmania's own internal shapes that Discogs' raw
JSON is mapped into (FR-004). None of these are persisted by this feature —
they are returned in-memory from the client's functions (see
[contracts/discogs-client.md](./contracts/discogs-client.md)). Field
sourcing is per the verified-empirically reference data in
[research.md](./research.md#verified-empirically-reference-data-for-data-modelmd-and-implementation).

## CatalogSearchResult

A lightweight entry from `searchCatalog()` — enough to recognize a match
before fetching its full detail (spec Key Entities: Catalog Search Result).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsId` | number | yes | Maps to Discogs `id`; usable directly with `getRelease`/`getArtist`. |
| `resultType` | `'release' \| 'artist'` | yes | Maps to Discogs `type`. |
| `title` | string | yes | Release title or artist name. |
| `thumbnailUrl` | string | no | Maps to `cover_image` or `thumb`; absent if Discogs has no image. |
| `year` | number | no | Release-only; absent for artist results. |
| `formats` | string[] | no | Release-only (e.g., `["Vinyl", "12\"", "33 ⅓ RPM"]`). |

**Validation rules**: `discogsId` and `title` required and non-empty;
unknown/missing optional fields are omitted rather than defaulted to
misleading placeholder values (per FR-010).

## Release

The full detail of a specific cataloged edition (spec Key Entities: Release;
User Story 2).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsId` | number | yes | |
| `title` | string | yes | |
| `year` | number | no | Discogs sometimes has no confirmed year. |
| `country` | string | no | |
| `artists` | `ReleaseArtistCredit[]` | yes (min 1) | Supports multi-artist/collaboration releases (edge case). |
| `labels` | `LabelCredit[]` | yes (may be empty) | |
| `formats` | `FormatDescriptor[]` | yes (min 1) | |
| `genres` | string[] | yes (may be empty) | |
| `styles` | string[] | yes (may be empty) | |
| `tracklist` | `Track[]` | yes (may be empty) | Empty when Discogs has no confirmed tracklist (edge case, FR-010). |
| `images` | `CatalogImage[]` | yes (may be empty) | |
| `masterId` | number | no | Reference to the broader Master Release grouping, when one exists. |
| `discogsUrl` | string | yes | Maps to `uri`; human-readable Discogs page for attribution/back-reference. |

## ReleaseArtistCredit

An artist's credit on a specific Release (part of `Release.artists`).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsArtistId` | number | yes | Usable with `getArtist()`. |
| `name` | string | yes | |
| `nameVariation` | string | no | Maps to Discogs `anv` (artist name as credited on this specific release, if different from their canonical name). |
| `joinPhrase` | string | no | Maps to Discogs `join` (e.g. `"&"`, `"feat."`) joining this credit to the next one. |

## Track

A single tracklist entry (spec Key Entities: Track).

| Field | Type | Required | Notes |
|---|---|---|---|
| `position` | string | yes | E.g. `"A1"`, `"B2"` — kept as a string; not all releases use numeric positions. |
| `title` | string | yes | |
| `duration` | string | no | Kept as Discogs' own `"m:ss"` string; absent when not documented. |

## LabelCredit

A label credit on a Release (spec Key Entities: Label).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsLabelId` | number | yes | |
| `name` | string | yes | |
| `catalogNumber` | string | no | Maps to Discogs `catno`. |

## FormatDescriptor

One physical/digital format entry for a Release.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | E.g. `"Vinyl"`, `"CD"`. |
| `quantity` | number | no | Maps to Discogs `qty` (e.g. `2` for a double LP). |
| `descriptions` | string[] | yes (may be empty) | E.g. `["12\"", "33 ⅓ RPM"]`. |

## CatalogImage

An image associated with a Release or Artist.

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | |
| `imageType` | `'primary' \| 'secondary'` | yes | |
| `width` | number | no | |
| `height` | number | no | |

## Artist

The full detail of a specific artist (spec Key Entities: Artist; User Story 3).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsId` | number | yes | |
| `name` | string | yes | |
| `realName` | string | no | Maps to Discogs `realname`; absent for many artists/groups. |
| `profile` | string | no | Biography text; may be empty. |
| `nameVariations` | string[] | yes (may be empty) | Maps to Discogs `namevariations`. |
| `aliases` | `ArtistAliasRef[]` | yes (may be empty) | Supports the "artist is an alias of another entry" edge case. |
| `images` | `CatalogImage[]` | yes (may be empty) | |
| `discogsUrl` | string | yes | Human-readable Discogs page, for attribution/back-reference. |

## ArtistAliasRef

A reference to a related/alias artist entry (part of `Artist.aliases`).

| Field | Type | Required | Notes |
|---|---|---|---|
| `discogsArtistId` | number | yes | Usable with `getArtist()` to fetch the alias's own full detail. |
| `name` | string | yes | |

## Relationships

- A `Release` has one or more `ReleaseArtistCredit` (many-to-many in
  practice — one artist can appear on many releases, one release can credit
  several artists).
- A `Release` references zero-or-one `Master Release` via `masterId`; the
  Master Release itself is not a separately fetchable entity in this
  version (spec Assumptions).
- An `Artist` can reference other `Artist` entries via `aliases`, which is a
  loose, non-hierarchical relationship (an alias is just another artist ID,
  not a distinct sub-type).
- `CatalogSearchResult` is not linked by foreign key to `Release`/`Artist` —
  it is a transient, unpersisted summary; a caller turns it into a full
  `Release`/`Artist` by calling `getRelease(discogsId)` /
  `getArtist(discogsId)` with its `discogsId`.
