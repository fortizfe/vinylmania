# Phase 1 Data Model: Record Rating Badges on Search and Library Cards

This feature is presentation-focused. It introduces no new persisted entities and no schema migrations. The "model" changes are limited to card view-model inputs and one shared presentation helper.

## 1. Search Result Card View Model (extended API shape)

Source: `CatalogSearchResult` from the backend Discogs search contract and frontend `discogsApi.ts`.

| Field | Type | Source | Notes |
|---|---|---|---|
| `discogsId` | `number` | existing | Stable release identifier |
| `title` | `string` | existing | Primary card label |
| `artist` | `string \| undefined` | existing | Optional secondary label |
| `thumbnailUrl` | `string \| undefined` | existing | Thumbnail/placeholder zone |
| `year` | `number \| undefined` | existing | Metadata row |
| `formats` | `string[] \| undefined` | existing | Metadata row |
| `communityRating` | `{ average: number; count: number } \| undefined` | NEW | Additive enrichment from Discogs community rating endpoint |

**Validation rules**:
- `communityRating` is present only for release results whose rating lookup succeeds and whose `count > 0`.
- `average` must be numeric and within `0-5`.
- If `communityRating` is absent, the search-result card renders normally without a badge.

## 2. Library Card View Model (existing API shape, newly consumed field)

Source: `EnrichedLibraryEntry` from `frontend/src/services/libraryApi.ts`.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | existing | Card navigation target |
| `release.title` | `string` | existing | Primary card label |
| `release.artists[0]?.name` | `string \| undefined` | existing | Secondary label |
| `release.images[0]?.url` | `string \| undefined` | existing | Thumbnail/placeholder zone |
| `release.community.rating.average` | `number \| undefined` | existing | Existing community rating reused for badge |
| `release.community.rating.count` | `number \| undefined` | existing | Used to decide whether the rating is valid enough to show |

**Validation rules**:
- The badge is eligible only when `release.community.rating.count > 0` and `average` is within `0-5`.
- Unavailable catalog entries (`catalogStatus === 'unavailable'` or `release === null`) do not render a rating badge.

## 3. Shared Rating Badge Presentation Model

This is a UI-only derived model, not a persisted entity.

| Field | Type | Derived from | Notes |
|---|---|---|---|
| `rawAverage` | `number` | Search or library rating source | Used for band selection |
| `displayValue` | `string` | `rawAverage` | Compact one-decimal string, e.g. `4.2` |
| `band` | `'low' \| 'medium' \| 'high'` | `rawAverage` | Maps to red / yellow / green styling |
| `visible` | `boolean` | rating presence + count + range checks | Controls badge omission |

### Band mapping

| Range | Band | Background token | Text color | Contrast ratio (FR-013, ≥4.5:1) |
|---|---|---|---|---|
| `0.00-2.50` | `low` | `--color-rating-low` (`#DC2626`, Tailwind `red-600`) | white | 4.83:1 |
| `2.51-4.09` | `medium` | `--color-rating-medium` (`#FBBF24`, Tailwind `amber-400`) | near-black | 12.6:1 |
| `4.10-5.00` | `high` | `--color-rating-high` (`#15803D`, Tailwind `green-700`) | white | 5.02:1 |

See [research.md](./research.md) §8 for the contrast rationale and rejected alternatives.

### Omission rules

The badge is hidden when any of the following is true:

- Rating object is absent
- Rating `count <= 0`
- Average is not numeric
- Average is outside `0-5`

## 4. Rating Enrichment Outcome (backend transient model)

The backend search route needs one transient enrichment concept while composing the response.

| Field | Type | Notes |
|---|---|---|
| `releaseId` | `number` | Discogs release id to enrich |
| `communityRating.average` | `number` | Exact average returned by Discogs community rating endpoint |
| `communityRating.count` | `number` | Vote count used to distinguish valid rating from unrated release |
| `status` | `'enriched' \| 'omitted'` | `omitted` means the base search result is still returned without badge data |

`status` becomes `'omitted'` both when the per-release rating request fails outright and when it has not resolved within the 2-second per-lookup timeout (spec SC-006) — a timeout is not a distinct third state; it is treated identically to a failed lookup.

This enrichment outcome is not stored; it exists only while building the search response.

## 5. State transitions

The feature adds no user-editable state transitions. The only relevant UI state changes are:

1. Card data loads without rating.
2. If a valid rating source exists, a visible badge is derived.
3. If rating is unavailable or invalid, the card stays badge-free.

No card interaction flow changes because the badge is non-interactive and secondary.