# Phase 1 Data Model: Unified Record Detail Views

**Feature**: 063-record-detail-unification · **Date**: 2026-09-07

This feature **persists nothing new** and changes **no wire contract**. There are no
database entities, no schema migration, no new API field. What follows is the set of
**view-model shapes** the shared presentational components consume, and how each of
the three views derives them from data it already fetches.

Existing source types (unchanged): `Release`, `CommunityStats`, `EntryDiscogsData`,
`EnrichedLibraryEntry` (`frontend/src/services/libraryApi.ts`); `WantEntryDetail`
(`frontend/src/services/wantlistApi.ts`); `RatingPresentation` / `RatingBand`
(`frontend/src/lib/releaseRating.ts`).

---

## 1. `RecordDetailView` (discriminant)

```
type RecordDetailView = 'search' | 'library' | 'wishlist'
```

- `search` — `/app/releases/:discogsId`, release not in the user's wishlist and no
  library entry context.
- `wishlist` — `/app/releases/:discogsId`, `useWantlistEntry` returned an entry.
- `library` — `/app/library/records/:entryId`.

Drives: which action-bar variant renders, whether the personal rating is editable,
and whether the "Estado de mi copia" card renders.

---

## 2. `RatingCardModel`

Consumed by `RatingCard`. Always constructible (FR-004 — card always renders).

```
RatingCardModel {
  community: {
    presentation: RatingPresentation   // from presentRating(release.community?.rating)
    count: number                      // release.community?.rating.count ?? 0
    have: number | null                // release.community?.have ?? null
    want: number | null                // release.community?.want ?? null
  }
  personal?: {                         // omitted entirely in the `search` view
    value: number                      // 0..5; 0 renders as "not rated"
    onSave: (rating: number) => Promise<void>
    saving: boolean
  }
}
```

| View | `community` source | `personal` source |
|------|--------------------|-------------------|
| search | `release.community` | *(omitted)* |
| wishlist | `release.community` | `wantEntry.rating` + `useUpdateWantEntry(releaseId).mutateAsync({ rating })` |
| library | `entry.release.community` | `entry.discogs.rating` + `useUpdateLibraryEntry(entryId).mutateAsync({ rating })` |

Rules:
- `community.presentation.band === 'unrated'` ⟺ no votable community rating ⟺ show
  the neutral "not rated" state for that half (FR-005).
- `have` / `want` render only when non-null; a missing `community` object yields
  `null` for both and they are omitted (no "0 have / 0 want").
- `personal` absent ⟹ personal half shows a read-only "not rated" label, never an
  editable star control (FR-006).
- When `personal` is present and `value === 0`, show the editable star control in
  its empty state (user can set a rating) — this is distinct from the search-view
  read-only "not rated".
- Both halves absent of data (search + `unrated`) ⟹ the whole card shows the
  neutral placeholder; the card is still in the DOM (FR-004, no layout shift).

---

## 3. `MyCopyModel` (library view only)

Consumed by the trimmed `MyCopySection`. **No `rating` field** (FR-009).

```
MyCopyModel {
  mediaCondition: string | null
  sleeveCondition: string | null
  notes: string | null
  editable: { mediaCondition: boolean; sleeveCondition: boolean; notes: boolean }
  onSaveMediaCondition: (value: string | null) => Promise<void>
  onSaveSleeveCondition: (value: string | null) => Promise<void>
  onSaveNotes: (value: string) => Promise<void>
}
```

Source: `entry.discogs` (`EntryDiscogsData` minus `rating`) + the existing
`useUpdateLibraryEntry` patch calls. `editable` flags and the "not available on this
collection" messaging are preserved verbatim (FR-011).

When `entry.discogs === null` (copy gone from Discogs) the fields render disabled,
exactly as today.

---

## 4. `RecordDetailActionsModel`

Consumed by `RecordDetailActions`. One of three variants.

```
| view       | props                                                                        |
|------------|------------------------------------------------------------------------------|
| search     | onAddToLibrary, onAddToWishlist, addingToLibrary, addingToWishlist,          |
|            | addedToLibrary, addedToWishlist, gateMessage?, notice?, libraryError?,       |
|            | wishlistError?                                                              |
| wishlist   | onAddToLibrary, addingToLibrary, addedToLibrary, gateMessage?, notice?,      |
|            | libraryError?                                                              |
| library    | onRemove, removing, removeError?                                            |
```

- The page owns the mutations (`useCreateLibraryEntry`, `useAddToWantlist`,
  `useRemoveLibraryEntry`) and the `ApiError.code` → message mapping (`gateMessage`
  helper already exists in `ReleaseDetailPage`). `RecordDetailActions` is
  presentational: buttons + `role="status"` / `role="alert"` lines.
- `Remove from library` keeps the existing `window.confirm(...)` guard in the page
  handler before calling `onRemove`'s mutation.
- Messaging strings are unchanged from today (WISHLIST_REMOVAL_FAILED_NOTICE, the
  `gateMessage({variant, context})` outputs, etc.).

---

## 5. Section presence matrix (the shared contract)

DOM order is **always** top-to-bottom as listed; CSS (`RecordDetailLayout` variant)
moves the rail on desktop but never reorders the DOM (FR-022).

| # | Section | search | wishlist | library | Component |
|---|---------|:------:|:--------:|:-------:|-----------|
| 0 | Action bar | ✅ | ✅ | ✅ | `RecordDetailActions` |
| 1 | Image gallery | ✅ | ✅ | ✅ | `ReleaseImageGallery` (unchanged) |
| 2 | General information | ✅ | ✅ | ✅ | `ReleaseDetailsSection` (unchanged) |
| 2a | Estado de mi copia | — | — | ✅ | `MyCopySection` (trimmed) |
| 3 | Rating | ✅ | ✅ | ✅ | `RatingCard` (new) |
| 4 | Streaming services | ✅¹ | ✅¹ | ✅¹ | `StreamingLinksSection` (span class removed) |
| 5 | Tracklist | ✅ | ✅ | ✅ | `ReleaseTracklistSection` (unchanged) |
| 6 | Rest of catalog information | ✅² | ✅² | ✅² | `ReleaseAdditionalInfoSection` (trimmed) |
| 7 | Other users' reviews | — | — | — | *(not built, no slot — FR-017)* |

¹ Collapses to `null` when no streaming match (existing behavior).
² Renders `null` when there are no identifiers and no catalog notes (community line
removed).

"Estado de mi copia" (2a) sits immediately after the general-information card in
both the desktop right column and the mobile stack (spec Clarifications / FR-022).

---

## 6. What is explicitly NOT in the model

- No `reviews` / `criticas` field or slot (FR-017).
- No wishlist `notes` field anywhere in any model (FR-016). `WantEntryDetail.notes`
  is simply never read by the detail view after this change.
- No new persisted state, no new query key, no new endpoint.
