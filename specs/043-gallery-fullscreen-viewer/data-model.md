# Phase 1 Data Model: Shared Image Gallery — Contained Size & Fullscreen Viewer

This feature introduces no persisted data, no Firestore/Discogs schema
change, and no new backend entity. Per spec.md's Key Entities section, the
two "entities" involved are the existing `release.images`/`master.images`
Discogs-sourced list (read-only input, unchanged) and a purely client-side
UI state shape. This document captures that state shape and the component
prop contracts it flows through, since it is what the new fullscreen
behavior is built on.

## Existing input (unchanged)

**Release images collection** (`CatalogImage[]`, from
`frontend/src/services/libraryApi.ts`, already defined):

| Field | Type | Notes |
|---|---|---|
| `url` | `string` | Image source URL (Discogs-hosted) |
| `imageType` | `string` (e.g. `'primary'`, `'secondary'`) | Used by the existing `initialIndex()` to pick the default main image; unchanged by this feature |

## New/changed component-local state

**`ReleaseImageGallery` internal state** (React `useState`, not persisted,
not lifted to a parent/store — Decision 5 in research.md):

| State | Type | Owner | Notes |
|---|---|---|---|
| `selectedIndex` | `number` | `ReleaseImageGallery` (already exists) | Index into `images` of the currently displayed main image. Shared, unchanged, by both the embedded view and the fullscreen view — this is what makes FR-006/FR-011 (fullscreen opens on/returns the current selection) hold without extra synchronization. |
| `isFullscreenOpen` | `boolean` | `ReleaseImageGallery` (new) | Toggled `true` on main-image click/Enter/Space (FR-005), `false` on X click, Escape, or backdrop click (FR-009/FR-010/FR-014). Resizing the viewport MUST NOT change this value (FR-013). |

State transitions:

```
closed --(click/Enter/Space on main image, images.length > 0)--> open
open --(click X | Escape | click backdrop)--> closed
open --(click a thumbnail)--> open (selectedIndex changes, isFullscreenOpen unchanged)
closed --(viewport resize)--> closed (no-op)
open --(viewport resize)--> open (no-op; selectedIndex unchanged)
```

There is no `closed --(no images)--> open` transition: per FR-005/AC9, the
no-cover-image placeholder is not clickable, so `isFullscreenOpen` can only
become `true` when `images.length > 0`.

## Component prop contracts

See `contracts/ReleaseImageGallery.contract.md` for the full public prop
and DOM-contract (testid) documentation of `ReleaseImageGallery` (unchanged
props) and the new `GalleryFullscreenViewer` (internal, not exported
outside `ReleaseImageGallery`).
