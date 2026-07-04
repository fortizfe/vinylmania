# Phase 1 Data Model: Release Preview Popup — Full Details & Image Gallery

No new persisted entities or Firestore schema changes. This feature widens
the existing `Release` type (backend `backend/src/discogs/types.ts`, mirrored
1:1 in `frontend/src/services/libraryApi.ts`) — the same type already shared
by the search preview popup, the record detail page, and
`EnrichedLibraryEntry.release` — with fields sourced from Discogs'
`GET /releases/{id}` response that aren't captured today.

## `Release` (extended)

| Field | Type | Source (raw Discogs field) | Notes |
|---|---|---|---|
| `discogsId` … `discogsUrl` | *(unchanged)* | *(unchanged)* | All fields already modeled today are untouched. |
| `releaseDate` | `string \| undefined` (**new**) | `released` | Full date as Discogs provides it (may be a full date, year-month, or year-only string); passed through as-is, no reformatting. Omitted when Discogs has none. |
| `notes` | `string \| undefined` (**new**) | `notes` | Free-text release notes/description. Omitted when absent. |
| `identifiers` | `ReleaseIdentifier[]` (**new**) | `identifiers[]` | Defaults to `[]` when Discogs omits the array, matching the existing convention for `labels`/`formats`/etc. |
| `community` | `CommunityStats \| undefined` (**new**) | `community` | Omitted entirely when Discogs has no community data for the release (new/obscure releases may lack it). |

## `ReleaseIdentifier` (new entity)

| Field | Type | Source | Notes |
|---|---|---|---|
| `type` | `string` | `identifiers[].type` | e.g. `"Barcode"`, `"Matrix / Runout"`. |
| `value` | `string` | `identifiers[].value` | The identifier's value as text. |
| `description` | `string \| undefined` | `identifiers[].description` | Discogs' optional free-text qualifier (e.g. `"Side A Runout"`); omitted when absent. |

Zero or more per `Release`, ordered as Discogs returns them.

## `CommunityStats` (new entity)

| Field | Type | Source | Notes |
|---|---|---|---|
| `have` | `number` | `community.have` | Collectors who have this release. |
| `want` | `number` | `community.want` | Collectors who want this release. |
| `rating` | `{ average: number; count: number }` | `community.rating.average`, `community.rating.count` | Present together; Discogs always returns both when `community` is present. |

One optional instance per `Release` (undefined, not a zero-valued object,
when Discogs has no community data at all for the release).

## Relationships (unchanged)

- One `EnrichedLibraryEntry` still references exactly one `Release`
  (`discogsReleaseId` → `release`), as established in 010's data model.
- `CatalogSearchResult` (the search-list row shape) is **not** touched by
  this feature — the new fields only apply to the full `Release` fetched
  when a card's preview popup (or detail page) opens, exactly like the
  existing `labels`/`genres`/`styles`/`tracklist` fields today.

## New UI-only state: `ReleaseImageGallery` selection

Component-local state, not persisted data, introduced by the gallery
(FR-006/FR-007):

- **State**: `selectedIndex: number`, initialized to the index of the first
  `images` entry with `imageType === 'primary'` (falling back to `0` if none
  is marked primary), mirroring `RecordHeaderImage`'s existing primary-image
  selection rule.
- **Transition**: clicking thumbnail *i* sets `selectedIndex = i`; the
  primary image re-renders from `images[selectedIndex]`. No network call,
  no persistence — resets to the initial rule each time the popup is
  reopened (new `release` prop instance).

## Read-only display mapping additions (`ReleaseDetailsSection`)

Extends the mapping table established in 010's data-model.md, for the
fields introduced by this feature, all rendered only when present (FR-002):

| Spec field | Source field(s) | Display rule |
|---|---|---|
| Release date | `release.releaseDate?` | Shown as Discogs' raw string; omitted if absent. |
| Label / catalogue number | `release.labels: LabelCredit[]` | Already modeled; this feature is what starts surfacing it in the popup (each entry's `name` + `catalogNumber` when present). |
| Country | `release.country?` | Already modeled; newly surfaced in the popup. |
| Notes | `release.notes?` | Rendered as plain text/paragraph; omitted if absent. |
| Identifiers | `release.identifiers: ReleaseIdentifier[]` | Rendered as a list of `type: value` (plus `description` when present); section omitted entirely if the array is empty. |
| Community stats | `release.community?` | Rendered as have/want counts plus rating average (of count); omitted entirely if absent. |

No new fields are added anywhere else — this is purely how the popup reads
and renders the widened `Release` shape.
