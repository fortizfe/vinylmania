# Contract: `ReleaseImageGallery` component

This feature does not change `ReleaseImageGallery`'s **public props** — all
three consuming pages (`ReleaseDetailPage`, `RecordDetailPage`,
`MasterReleaseDetailPage`) require zero code changes. It changes the
component's internal rendering (contained size, capped/scrollable
thumbnails, clickable main image) and adds a new internal-only
`GalleryFullscreenViewer`. This document is the DOM/behavior contract other
code (tests, e2e specs) can rely on, not a network/API contract — there is
no backend endpoint involved in this feature.

## Props (unchanged)

```ts
interface ReleaseImageGalleryProps {
  images: CatalogImage[];
  alt: string;
}
```

No new props. No new required imports for consumers.

## DOM contract — embedded (normal) viewer

- Root element: unchanged wrapping — page-level testids
  (`release-detail-gallery`, `record-detail-gallery`,
  `master-detail-gallery`) remain on the **consuming page's** wrapper `div`,
  not inside `ReleaseImageGallery` itself — unaffected by this feature.
- No-image state: unchanged — `role="img"` placeholder div with the
  "No cover image available" accessible name; **not** clickable (no
  fullscreen affordance).
- Main image: now rendered inside a `<button type="button" aria-label="View
  {alt} fullscreen">` wrapping the existing `<img alt={alt}>`. The `<img>`
  keeps its accessible name (`alt`), so `getByRole('img', { name: alt })`
  continues to resolve it. The new wrapping `<button>` is what receives the
  click/Enter/Space activation.
- Thumbnail column: same `<button>`-per-thumbnail structure as today,
  `aria-label="Show image {n} of {total}"`, `aria-current` on the selected
  one — unchanged. Container gains `min-h-0` (research.md Decision 2) so it
  never exceeds the viewer's height; `scrollbar-hidden`/`overflow-y-auto`
  are unchanged.
- Root container gains `lg:max-w-md mx-auto` (research.md Decision 1);
  `aspect-square` unchanged.

## DOM contract — fullscreen viewer (new)

Rendered by `ReleaseImageGallery` when `isFullscreenOpen` is `true` and
`images.length > 0` (never rendered for the no-image placeholder state).

| Testid / selector | Element | Behavior |
|---|---|---|
| `gallery-fullscreen-viewer` | Root overlay `div` (`fixed inset-0`, edge-to-edge, no `Card`/max-width wrapper) | Present only while open. Clicking it directly (the backdrop, not a descendant) closes the viewer (FR-014). Pressing Escape while open closes it (FR-010), via the shared `useEscapeKey` hook. |
| `gallery-fullscreen-close` | `<button aria-label="Close">` (reuses the extracted `CloseIcon` + existing `Button` atom, `size="icon"`) | Always visible (not scroll-dependent); click closes the viewer (FR-009). |
| (large image) | `<img>`, same `src`/`alt` as the current `selectedIndex` | Clicking the image itself must **not** close the viewer (click must be stopped from bubbling to the backdrop handler), consistent with `Modal`'s existing inner-content `stopPropagation` pattern. |
| (thumbnail strip) | Same `<button>`-per-thumbnail structure/labels as the embedded viewer, only rendered when `images.length > 1` (FR-007/FR-008) | Clicking a thumbnail updates the shared `selectedIndex`; viewer stays open. |

Closing (by X, Escape, or backdrop) sets `isFullscreenOpen` to `false`
without changing `selectedIndex` — the embedded viewer then shows whatever
was last selected (FR-011).

## Consumers

- `frontend/src/pages/ReleaseDetailPage.tsx`,
  `frontend/src/pages/RecordDetailPage.tsx`,
  `frontend/src/pages/MasterReleaseDetailPage.tsx` — no changes required;
  they already render `<ReleaseImageGallery images={...} alt={...} />` and
  automatically get the new behavior.
- `frontend/tests/unit/ReleaseImageGallery.test.tsx` — extended with cases
  for: contained root sizing class, `min-h-0` on the thumbnail column,
  main-image click/Enter/Space opening fullscreen, thumbnail click inside
  fullscreen updating the image while staying open, X/Escape/backdrop
  closing and preserving selection, no-fullscreen-affordance on the
  placeholder state.
- `frontend/tests/unit/GalleryFullscreenViewer.test.tsx` — new, isolated
  coverage of the overlay component's own props/behavior.
- `e2e/tests/release-detail.spec.ts` and the `*-responsive.spec.ts` specs
  for all three detail pages — extended with `gallery-fullscreen-viewer`/
  `gallery-fullscreen-close` assertions per spec's testing notes.

## Backward compatibility

Purely additive/behavioral (Principle VI: MINOR). No prop, testid, or
exported type is removed or renamed; existing page-level testids and the
component's public prop shape are unchanged.
