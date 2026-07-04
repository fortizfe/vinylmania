# Phase 1 Data Model: Release Preview Layout Redesign

This feature is presentation-only: it introduces no new persisted entities, no schema changes, and no changes to the `Release` shape consumed from the Discogs-backed API (`frontend/src/services/libraryApi.ts`). The "entities" below are the existing data groupings the redesigned UI reorganizes into sections, documented here for traceability from the spec's Key Entities to the props each component consumes.

## Release Preview (composition, not a data entity)

The `ReleasePreviewModal` composes the four presentation sections below from a single existing `Release` object (and its `loading`/absence states) — no new fields are read from or added to `Release`.

## Catalog Image (existing, unchanged)

Source: `CatalogImage` in `frontend/src/services/libraryApi.ts`.

| Field | Type | Notes |
|---|---|---|
| `url` | `string` | Image URL, used for both main image and thumbnail |
| `imageType` | `'primary' \| 'secondary'` | Used to pick the initial selected image (unchanged logic in `ReleaseImageGallery`) |

No changes. The gallery component's internal `selectedIndex` state and `initialIndex` logic are unchanged; only the surrounding layout (full width, square, hidden-scrollbar thumbnail strip) changes.

## Key Release Details (new grouping — existing fields, narrower component scope)

Rendered by `ReleaseDetailsSection` (existing component, narrowed scope: notes/identifiers/community move out to `ReleaseAdditionalInfoSection`).

| Field | Source | Type | Notes |
|---|---|---|---|
| `title` | `Release.title` | `string` | Required |
| `artists` | `Release.artists` | `ReleaseArtistCredit[]` | Rendered as one line per artist (unchanged) |
| `genres` | `Release.genres` | `string[]` | Rendered as badges (unchanged) |
| `styles` | `Release.styles` | `string[]` | Rendered as badges (unchanged) |
| `releaseDate` | `Release.releaseDate` | `string \| undefined` | Optional |
| `country` | `Release.country` | `string \| undefined` | Optional — already shown alongside date/label today |
| `labels` | `Release.labels` | `LabelCredit[]` | Rendered as badges with catalog number (unchanged) |

**Validation/degradation rule** (from spec FR-007 / Edge Cases): if none of `genres`, `styles`, `releaseDate`, `labels`, `country` are present, the meta row is omitted entirely (existing `hasMetaRow` guard in `ReleaseDetailsSection` is preserved); `title`/`artists` always render.

## Tracklist (new component, existing field)

Rendered by new `ReleaseTracklistSection` (extracted from `ReleasePreviewModal`'s current inline JSX).

| Field | Source | Type | Notes |
|---|---|---|---|
| `tracklist` | `Release.tracklist` | `Track[]` (`{ position, title, duration? }`) | Unchanged shape |

**Props**: `{ tracklist: Track[] }`.

**Rendering rule**: component renders `null` (omits the section) when `tracklist.length === 0`, per FR-007 and Edge Case "record with no tracklist data."

## Remaining Release Information (new component, existing fields)

Rendered by new `ReleaseAdditionalInfoSection`, extracted from the tail of the current `ReleaseDetailsSection`.

| Field | Source | Type | Notes |
|---|---|---|---|
| `notes` | `Release.notes` | `string \| undefined` | Optional free text |
| `identifiers` | `Release.identifiers` | `ReleaseIdentifier[]` | Optional list |
| `community` | `Release.community` | `CommunityStats \| undefined` | Optional have/want/rating |

**Props**: `{ notes?: string; identifiers: ReleaseIdentifier[]; community?: CommunityStats }`.

**Rendering rule**: component renders `null` (omits the section entirely) when `notes`, `identifiers`, and `community` are all absent/empty, per FR-007.

## Layout state (UI-only, not persisted)

- **Viewport breakpoint**: derived purely from CSS (`lg:` Tailwind breakpoint), not tracked in component state — no new client-side state variable is introduced for responsive behavior.
- **Selected gallery image index**: existing `useState` in `ReleaseImageGallery`, unchanged.
- **Scrollbar visibility**: purely a CSS utility class (`.scrollbar-hidden`), not component state.
