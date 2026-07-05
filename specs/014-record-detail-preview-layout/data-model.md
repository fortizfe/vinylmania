# Phase 1 Data Model: Record Detail View Aligned with Preview Layout

This feature is presentation-only: it introduces no new persisted entities, no schema changes, and no changes to the `EnrichedLibraryEntry`/`Release` shapes consumed from `frontend/src/services/libraryApi.ts` — with one additive exception (Decision 2 in research.md): `ReleaseDetailsSection` starts reading the already-existing `Release.formats` field it previously ignored. The "entities" below are the existing data groupings the redesigned page reorganizes into sections, documented here for traceability from the spec's Key Entities to the props each component consumes.

## Record Detail View (composition, not a data entity)

`RecordDetailPage` composes the sections below from a single `EnrichedLibraryEntry` (its `release` sub-object, plus its own `condition`/`notes`) inside one shared `<Card>` — no new fields are read from or added to `EnrichedLibraryEntry` or `Release` beyond `formats` (already present, newly rendered).

## Catalog Image (existing, unchanged)

Source: `CatalogImage` in `frontend/src/services/libraryApi.ts`. Rendered by `ReleaseImageGallery`, reused unchanged from the preview (full-width, square, hidden-scrollbar thumbnail strip, `selectedIndex` state internal to the component).

## Key Release Details (existing component, extended scope)

Rendered by `ReleaseDetailsSection` (existing component, shared with the preview; scope extended per Decision 2 in research.md).

| Field | Source | Type | Notes |
|---|---|---|---|
| `title` | `Release.title` | `string` | Required |
| `artists` | `Release.artists` | `ReleaseArtistCredit[]` | One line per artist (unchanged) |
| `formats` | `Release.formats` | `FormatDescriptor[]` | **NEW to this component** — rendered as badges (`name` + joined `descriptions`, same formatting `DiscInfoCard` used), so the detail page loses no previously-visible information (SC-005) |
| `genres` | `Release.genres` | `string[]` | Rendered as badges (unchanged) |
| `styles` | `Release.styles` | `string[]` | Rendered as badges (unchanged) |
| `releaseDate` | `Release.releaseDate` | `string \| undefined` | Optional |
| `country` | `Release.country` | `string \| undefined` | Optional |
| `labels` | `Release.labels` | `LabelCredit[]` | Rendered as badges with catalog number (unchanged) |

**Validation/degradation rule** (spec FR-007 / Edge Cases): the meta row (formats, country, releaseDate, labels, genres, styles) is omitted entirely when none of those fields are present; `title`/`artists` always render, matching the existing `hasMetaRow` guard extended to also check `formats.length > 0`.

## My Copy (new component, existing fields)

Rendered by new `MyCopySection`, extracted from `RecordDetailPage`'s current inline "Your copy" JSX (research.md Decision 3). Positioned directly below Key Release Details in the left column (FR-002), as a plain section with no independent border (Decision 1).

| Field | Source | Type | Notes |
|---|---|---|---|
| `condition` | `EnrichedLibraryEntry.condition` | `string \| undefined` | Closed set of grading options; edited via existing `InlineEditableField` + `<select>`, unchanged interaction |
| `notes` | `EnrichedLibraryEntry.notes` | `string \| undefined` | Free text; edited via existing `InlineEditableField` + `<textarea>`, unchanged interaction |

**Props (indicative)**: `{ condition?: string; notes?: string; onSaveCondition: (value: string) => Promise<void>; onSaveNotes: (value: string) => Promise<void>; onRemove: () => void }`.

**Behavior rule** (FR-005): autosave on confirm, Escape-to-cancel, transient save confirmation, hover/permanent editable-field affordance, and the existing single-field-editing-at-a-time coordination (via `InlineEditableFieldHandle.commit()`) are preserved exactly as implemented today — this is a relocation and extraction of existing behavior, not a behavioral change.

## Tracklist (existing component, unchanged)

Source: `Release.tracklist` (`Track[]`). Rendered by `ReleaseTracklistSection`, reused unchanged from the preview — renders `null` (section omitted) when `tracklist.length === 0`, per FR-007. This replaces `TracklistCard`, which previously showed a "No tracklist available" message instead of omitting the section; the omit-when-empty behavior is an intentional, spec-directed change (FR-007) to match the preview's degrade-gracefully convention.

## Remaining Release Information (existing component, newly surfaced on this page)

Source: `Release.notes`, `Release.identifiers`, `Release.community`. Rendered by `ReleaseAdditionalInfoSection`, reused unchanged from the preview. Per spec Assumptions, this section did not previously appear on the detail page at all — adopting it is part of achieving layout parity with the preview (FR-003).

**Rendering rule**: component renders `null` (section omitted) when `notes`, `identifiers`, and `community` are all absent/empty.

## Layout state (UI-only, not persisted)

- **Viewport breakpoint**: derived purely from CSS (`lg:` Tailwind breakpoint, per research.md Decision 6) — no new client-side state variable.
- **Selected gallery image index**: existing `useState` in `ReleaseImageGallery`, unchanged.
- **My-copy field edit mode**: existing `InlineEditableField` internal state (`read`/`editing`/`saving`/`saved`/`error`), unchanged; only its position in the page's DOM tree moves.
