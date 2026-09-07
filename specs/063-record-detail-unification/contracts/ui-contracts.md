# Phase 1 UI Contracts: Unified Record Detail Views

**Feature**: 063-record-detail-unification · **Date**: 2026-09-07

This is a UI feature, so the "contracts" are component prop/behavior contracts plus
the layout, section-order, `data-testid`, and accessibility contracts that `/frontend`
and `/e2e` code must honor. No HTTP contract changes.

---

## C1. Section-order contract (all three views)

The visible top-to-bottom order and the **DOM order** MUST both be:

```
back-link
action bar            (RecordDetailActions)
1  image gallery       (ReleaseImageGallery)
2  general information (ReleaseDetailsSection)
2a estado de mi copia  (MyCopySection)      — library view only, right after §2
3  rating              (RatingCard)
4  streaming services  (StreamingLinksSection)  — may render null
5  tracklist           (ReleaseTracklistSection)
6  rest of catalog info(ReleaseAdditionalInfoSection) — may render null
```

- No CSS `order` property may be used to visually reorder sections away from DOM
  order (FR-022). The only permitted spatial rearrangement is moving the whole rail
  group as a grid column on `lg:` and up.
- Adding a section, or a view-specific card other than §2a, is out of scope.

---

## C2. `RecordDetailLayout`

```tsx
interface RecordDetailLayoutProps {
  backTo: string;
  actions: ReactNode;        // RecordDetailActions
  gallery: ReactNode;
  generalInfo: ReactNode;
  myCopy?: ReactNode;        // present ⟺ library view
  rating: ReactNode;         // RatingCard — always provided
  streaming: ReactNode;      // StreamingLinksSection — always provided (may render null)
  tracklist: ReactNode;
  catalogInfo: ReactNode;    // may render null
}
```

Behavior:
- Renders `<main>` → `<BackLink to={backTo}/>` → `{actions}` → the section grid.
- Children are rendered in the C1 DOM order **always**, regardless of viewport.
- **Mobile (`< lg`)**: single column, `flex-col gap-4` (or the project's standard
  card gap), every child full width.
- **Desktop (`lg:` and up)**: CSS grid, two tracks. Left track = a **sticky rail**
  (`position: sticky; top: <safe>; align-self: start`) containing `gallery`,
  `rating`, `streaming`. Right track (normal flow) = `generalInfo`, `myCopy?`,
  `tracklist`, `catalogInfo`. Achieve this with `lg:` grid placement classes on
  the wrappers — **not** by reordering the JSX.
- The `<main>` max-width matches today's detail pages
  (`max-w-5xl … xl:max-w-7xl`) and padding (`p-6 sm:p-8`).
- No entrance animation. If a rail/column edge treatment is added it is a static
  divider (research R8).
- `data-testid="record-detail-layout"` on the section grid;
  `data-testid="record-detail-rail"` on the rail wrapper.

Test (`RecordDetailLayout.test.tsx`, write first):
1. Given all slots, the rendered DOM order of the slot wrappers equals C1.
2. Given `myCopy` omitted, no §2a wrapper is in the DOM.
3. Given `myCopy` provided, the §2a wrapper renders between `generalInfo` and
   `rating` in the DOM.
4. The action bar wrapper is the first child after the back-link.

---

## C3. `RecordDetailActions`

```tsx
type RecordDetailActionsProps =
  | { view: 'search';   /* onAddToLibrary, onAddToWishlist, addingToLibrary,
                            addingToWishlist, addedToLibrary, addedToWishlist,
                            gateMessage?, notice?, libraryError?, wishlistError? */ }
  | { view: 'wishlist'; /* onAddToLibrary, addingToLibrary, addedToLibrary,
                            gateMessage?, notice?, libraryError? */ }
  | { view: 'library';  /* onRemove, removing, removeError? */ };
```

Behavior / contract:
- Renders as a horizontal bar (`flex flex-wrap gap-2`) directly under the back-link,
  full content width, above the gallery. Not wrapped in a `<Card>` (it is chrome,
  not content — "Not everything is a card").
- Uses the existing `<Button>` atom: primary = "Add to library" / "Remove from
  library"; secondary = "Add to wishlist".
- Disabled/added state: a button shows "Added to library" / "Added to wishlist" and
  is `disabled` once its `added*` flag is true (today's behavior).
- Messages render **below** the buttons: `role="status"` for `gateMessage` and
  `notice`; `role="alert"` for `*Error`. Copy strings are unchanged from the
  current `ReleaseDetailPage`.
- `Remove from library`: the page's `onRemove` handler keeps the existing
  `window.confirm('Remove this record from your library? This cannot be undone.')`
  before mutating. `RecordDetailActions` just calls the prop.
- Every button meets 44×44 at mobile width (via `<Button>`).
- `data-testid="record-detail-actions"` on the bar.

Test (`RecordDetailActions.test.tsx`, write first):
1. `view='search'` renders both add buttons; `view='wishlist'` renders only
   "Add to library"; `view='library'` renders only "Remove from library".
2. `gateMessage` → a `role="status"` node; `libraryError` → a `role="alert"` node.
3. `addedToLibrary` → the library button reads "Added to library" and is disabled.
4. `view='library'` clicking Remove calls `onRemove` (confirm is the page's concern
   — assert the prop is invoked).

---

## C4. `RatingCard`

```tsx
interface RatingCardProps {
  community: {
    presentation: RatingPresentation;  // presentRating(...)
    count: number;
    have: number | null;
    want: number | null;
  };
  personal?: {
    value: number;                     // 0..5
    onSave: (rating: number) => Promise<void>;
    saving: boolean;
  };
}
```

Behavior / contract:
- Rendered inside a `<Card>` (same `padding` as the other detail cards). Always
  rendered by the layout — never returns `null` (FR-004).
- One `<section aria-labelledby>` with a single heading (e.g. `<h2>Valoración</h2>`)
  — heading level consistent with the other cards (C7).
- **Community half** — labeled ("Comunidad de Discogs"): renders
  `<ReleaseRatingBadge displayValue={presentation.displayValue}
  band={presentation.band} />`. When `presentation.band !== 'unrated'`, also show
  `({count})`. When `band === 'unrated'`, the badge already shows the neutral
  placeholder; show a short "Sin valoraciones" text, no count.
- **have/want** — rendered only for non-null values, as text with a non-color
  label: `{have} lo tienen · {want} lo quieren` (exact copy at implementation time,
  must not rely on color).
- **Personal half**:
  - `personal` omitted → labeled "Tu valoración" + read-only "Sin valorar" text.
    No interactive control, not focusable.
  - `personal` present → labeled "Tu valoración" + `<StarRating value={value}
    onChange={onSave} disabled={saving} ariaLabel="Tu valoración" />`.
  - On `onSave` rejection: show `role="alert"` "No se pudo guardar tu valoración."
    + a "Reintentar" button that re-invokes `onSave` with the last attempted value
    (mirror `WantlistPanel`'s current retry pattern) — satisfies FR-007.
- Layout: community and personal halves side by side on `sm:` and up, stacked on
  mobile; both share fixed min-height so the empty/populated/error states don't
  shift layout (FR-021 / SC-008).
- Rating severity/state is never conveyed by color alone: the numeric value and the
  text labels carry it (FR-008, Principle X).
- `data-testid="record-detail-rating-card"`.

Test (`RatingCard.test.tsx`, write first):
1. `personal` omitted → no `role="slider"`/star control; "Sin valorar" text present.
2. `personal` present, `value=3` → editable star control at value 3; calling
   `onChange` invokes `onSave`.
3. `community.presentation.band='unrated'` → placeholder badge, no `(count)`,
   "Sin valoraciones" text.
4. `community` valid, `count=812` → badge shows value + "(812)".
5. `have=1200, want=340` → both rendered; `have=null` → neither "lo tienen" line.
6. `onSave` rejects → `role="alert"` + "Reintentar"; clicking it re-calls `onSave`.
7. Both halves empty (search + unrated) → card still renders with its heading.

---

## C5. `MyCopySection` (trimmed)

```tsx
interface MyCopySectionProps {
  discogs: EntryDiscogsData | null;   // rating field is ignored here now
  onSaveMediaCondition: (value: string | null) => Promise<void>;
  onSaveSleeveCondition: (value: string | null) => Promise<void>;
  onSaveNotes: (value: string) => Promise<void>;
}
```

- **Removed**: the `Rating` field/label/`StarRating`, the `onSaveRating` prop, and
  the "Remove from library" `<Button>` + `onRemove` prop (Remove moves to
  `RecordDetailActions`).
- **Kept unchanged**: heading "Your copy" / "Estado de mi copia", media-condition
  `<select>`, sleeve-condition `<select>`, notes `InlineEditableField`, the
  `editable.*` disabled states and the "not available on this collection" copy
  (FR-011), the `discogs === null` disabled behavior.
- `data-testid="record-detail-your-copy-card"` retained on its `<Card>` wrapper.

Test (`MyCopySection.test.tsx`, write first):
1. No element with role/label "Rating" / "Valoración" is rendered.
2. No "Remove from library" button is rendered.
3. Changing media condition calls `onSaveMediaCondition`; notes blur calls
   `onSaveNotes`.
4. `editable.notes=false` + `discogs!=null` → the "not available on this collection"
   note is shown and the field is disabled.

---

## C6. `ReleaseAdditionalInfoSection` (trimmed)

```tsx
interface ReleaseAdditionalInfoSectionProps {
  notes?: string;
  identifiers: ReleaseIdentifier[];
  // `community` prop REMOVED
}
```

- **Removed**: the `community` prop and the
  `{have} have / {want} want · rating {average} ({count})` line.
- Renders `null` when `!notes && identifiers.length === 0` (previously also
  considered `community`).
- Callers stop passing `community`.

Test (`ReleaseAdditionalInfoSection.test.tsx`, write first):
1. Given only `community` data would have existed (no notes, no identifiers) →
   renders `null`.
2. Given identifiers → renders them; given notes → renders them.
3. No "have" / "want" / "rating" aggregate text anywhere in the output.

---

## C7. Accessibility contract (Principle X — hard gate)

- Each content card is a `<section>` with exactly one heading; heading levels are
  consistent and non-skipped across the page (page `<h1>` is the record title in
  `ReleaseDetailsSection` / page header; each card uses `<h2>`).
- DOM order == C1 order == reading order == tab order (no `tabindex > 0`, no CSS
  reorder).
- The action bar: every control has a visible text label; error/status text is in
  a live region (`role="alert"` / `role="status"`) adjacent to the controls.
- `RatingCard`: the editable `StarRating` keeps its accessible name; the read-only
  "not rated" states are plain text, not disabled controls; the community badge
  keeps `ReleaseRatingBadge`'s `role="status"` + `aria-label`.
- Contrast: reuse existing theme tokens / `border-stone-500` card boundary; no new
  color values.
- Touch targets: every button and the star control ≥ 44×44 CSS px at mobile width.
- Motion: any skeleton→content cross-fade is ≤200ms opacity-only and removed under
  `@media (prefers-reduced-motion: reduce)`; the sticky rail uses no animation.
- `prefers-reduced-transparency` / `prefers-contrast`: no translucent surfaces are
  introduced, so nothing extra is needed — do not add a blurred rail edge.

---

## C8. `data-testid` map (for mechanical e2e updates)

| Section | testid | Change vs today |
|---------|--------|-----------------|
| Layout grid | `record-detail-layout` | new |
| Sticky rail | `record-detail-rail` | new |
| Action bar | `record-detail-actions` | new |
| Gallery card | `record-detail-gallery-card` | unify (was also `release-detail-gallery-card`) |
| General info card | `record-detail-main-info-card` | unify (was also `release-detail-main-info-card`) |
| Rating card | `record-detail-rating-card` | new |
| Estado de mi copia | `record-detail-your-copy-card` | unchanged (library only) |
| Streaming card | `record-detail-streaming-card` | unify (was `release-detail-streaming-card`) |
| Tracklist card | `record-detail-tracklist-card` | unify |
| Catalog info card | `record-detail-other-details-card` | unify |

Both page components emit the **same** testids for the same section so the two e2e
suites can share selectors. The old `release-detail-*` / `record-detail-*` split is
collapsed to a single `record-detail-*` set. `release-detail-wantlist-panel-card` is
**removed** (panel deleted).

---

## C9. Regression guard

`MasterReleaseDetailPage` and `master-release-detail*.spec.ts` MUST remain byte-for-
byte unchanged (FR-023). `MasterReleaseDetailsSection` / `MasterReleaseOtherDetailsSection`
are not touched. If a shared component they import is edited, the master page's
render + e2e must still pass unchanged.
