# Data Model: Master Release Grouping & Detail Pages

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature extends the existing Discogs-sourced catalog types (`backend/src/discogs/types.ts`, mirrored in `frontend/src/services/discogsApi.ts`); it introduces no new persisted (Firebase) entities. All entities below are read-through views over the Discogs catalog (Principle II).

## CatalogSearchResult (extended)

Existing entity; `resultType` gains a third value and two fields become meaningful for it.

| Field | Type | Notes |
|---|---|---|
| `discogsId` | number | For a `master` result, this is the **master id**, not a release id. |
| `resultType` | `'release' \| 'artist' \| 'master'` | New `'master'` value (spec FR-001/FR-005). |
| `title` | string | Unchanged. |
| `artist` | string? | Unchanged. |
| `thumbnailUrl` | string? | Unchanged. |
| `year` | number? | For `master`, the master's own representative year as provided by the catalog (spec Clarifications). |
| `formats` | string[]? | For `master`, the master's own representative format(s) as provided by the catalog; omitted if the catalog doesn't provide one (no extra lookup — research Decision 2). |
| `communityRating` | `CommunityRating`? | For `master`, sourced from the master's main/key release rating (research Decision 3); omitted under the same failure/timeout rules as today. |

**Validation rule**: A result with `resultType === 'master'` MUST NOT expose an "Add to library" affordance (spec Assumptions) — enforced at the UI layer (`SearchResultCard`), not by omitting a field, since the card still needs its id/title/etc.

## MasterRelease (new)

Represents a Discogs master release group. Sourced from `GET /masters/{master_id}`.

| Field | Type | Notes |
|---|---|---|
| `discogsId` | number | The master id. |
| `title` | string | |
| `year` | number? | Master's representative year. |
| `artists` | `ReleaseArtistCredit[]` | Same shape as `Release.artists` (reused type). |
| `genres` | string[] | |
| `styles` | string[] | |
| `images` | `CatalogImage[]` | Same shape as `Release.images` (reused type) — feeds `ReleaseImageGallery` as-is (research Decision 5). |
| `tracklist` | `Track[]` | Same shape as `Release.tracklist` (reused type) — feeds `ReleaseTracklistSection` as-is. |
| `mainReleaseId` | number | Discogs' `main_release` — the release id used for FR-002's rating enrichment; also usable as a "view the main edition" affordance if useful during implementation. |
| `discogsUrl` | string | Mirrors `Release.discogsUrl`. |

**Explicitly absent** (per research Decision 5 — these are per-version, not per-master, concepts on Discogs): `labels`, `formats`, `identifiers`, `community`, `country`, `notes`.

## MasterReleaseVersion (new)

One row of a master's paginated version list. Sourced from `GET /masters/{master_id}/versions`.

| Field | Type | Notes |
|---|---|---|
| `discogsId` | number | The **release id** of this specific version — used to navigate to the release detail page (FR-011). |
| `title` | string | |
| `format` | string? | Satisfies FR-010's minimum ("format and year"). |
| `year` | number? (from Discogs `released`) | |
| `label` | string? | Satisfies FR-010's "when available". |
| `country` | string? | Satisfies FR-010's "when available". |
| `thumbnailUrl` | string? | For visual consistency with the rest of the app's list rows. |

## MasterReleaseVersionsPage (new)

Pagination envelope for the version table, mirroring the existing `CatalogSearchResponse.pagination` shape for consistency.

| Field | Type | Notes |
|---|---|---|
| `results` | `MasterReleaseVersion[]` | Up to `perPage` entries. |
| `pagination.page` | number | |
| `pagination.pages` | number | |
| `pagination.items` | number | Total version count — also answers the Edge Case "master with a single known version" (still renders the table with 1 row). |
| `pagination.perPage` | number | Fixed at 10 by the backend endpoint default (FR-009). |

## Relationships

```text
CatalogSearchResult (resultType: 'master') ──id──> MasterRelease
MasterRelease ──mainReleaseId──> Release (used only for rating enrichment, research Decision 3)
MasterRelease ──1:N (paginated)──> MasterReleaseVersion ──discogsId──> Release (detail page target, FR-011)
```

No new state transitions or lifecycle rules are introduced — every entity here is a stateless, cached read-through of Discogs catalog data (Principle II), refreshed by TTL expiry rather than by explicit invalidation.
