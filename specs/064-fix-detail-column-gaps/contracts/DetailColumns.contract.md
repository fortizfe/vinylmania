# Contract: `DetailColumns` layout + per-page column membership

This document is the DOM/behavior contract for the shared two-column
layout introduced by this feature. It is not a network/API contract — no
backend endpoint is involved.

## `DetailColumns` component contract

New file: `frontend/src/components/DetailColumns.tsx`.

```ts
interface DetailColumnsProps {
  left: ReactNode;
  right: ReactNode;
}
```

- Renders exactly one outer element: `grid grid-cols-1 items-start gap-4
  lg:grid-cols-2`.
- Renders exactly two direct children, in this order: a left-column
  wrapper (`flex flex-col gap-4`) containing `left`, and a right-column
  wrapper (`flex flex-col gap-4`) containing `right`.
- No child of either wrapper carries a `col-span`/`lg:col-span-*` class —
  there is no full-width row inside `DetailColumns`; a page that needs a
  true full-width element (e.g. `BackLink`) renders it as a sibling of
  `DetailColumns`, outside it.
- Below `lg`: the outer grid collapses to one column, so the left wrapper
  renders first, then the right wrapper — i.e. all of `left`'s cards, then
  all of `right`'s cards, in that fixed order (research.md Decision 5).
- Neither wrapper stretches to match the other's total height (`items-start`
  on the outer grid); a difference in total height between `left` and
  `right` is expected and MUST NOT be corrected (research.md Decision 2).

## Per-page column membership (fixed, per research.md Decision 3)

| Page | `left` | `right` |
|---|---|---|
| `ReleaseDetailPage` | Gallery card, Tracklist card, Additional-info card (conditional on `hasOtherDetails`) | Main-info card (incl. Add to library / Add to wishlist buttons and their status messages), WantlistPanel card (conditional on an existing wantlist entry), `StreamingLinksSection` |
| `RecordDetailPage` | Gallery card, Tracklist card, Additional-info card (conditional on `hasOtherDetails`) | Main-info card, Your-copy card (`MyCopySection`), `StreamingLinksSection` |
| `MasterReleaseDetailPage` | Gallery card, Tracklist card, Versions-table card | Main-info card, Other-details card (conditional on `masterHasOtherDetails`), `StreamingLinksSection` |

All existing `data-testid` values are preserved exactly (e.g.
`record-detail-tracklist-card`, `release-detail-streaming-card`) — only
their DOM parent changes, from a direct child of the old shared grid to a
child of one of `DetailColumns`' two wrapper `<div>`s. No component listed
above changes its props or internal behavior.

## `StreamingLinksSection` change

`CARD_SPAN = 'lg:col-span-2'` (and its application via `clsx(CARD_SPAN,
RESERVED_HEIGHT)`) is removed — the component is always mounted inside one
of `DetailColumns`' wrapper `<div>`s now, never a direct grid child, so the
class has no remaining effect (research.md Decision 6). `RESERVED_HEIGHT`
(`min-h-[4.5rem]`) is unaffected and stays.

## Consumers

- `frontend/src/components/DetailColumns.tsx` — new file.
- `frontend/src/pages/ReleaseDetailPage.tsx`,
  `frontend/src/pages/RecordDetailPage.tsx`,
  `frontend/src/pages/MasterReleaseDetailPage.tsx` — each replaces its
  hand-rolled grid with `<DetailColumns left={...} right={...} />` per the
  table above.
- `frontend/src/components/StreamingLinksSection.tsx` — drops `CARD_SPAN`.
- `e2e/tests/release-detail-responsive.spec.ts`,
  `e2e/tests/record-detail-responsive.spec.ts`,
  `e2e/tests/master-release-detail-responsive.spec.ts` — existing
  assertions that a full-width card's `y` is greater than *both* columns'
  `y` (encoding the old shared-row behavior) are replaced with assertions
  that each card sits in its assigned column (matching `x`) and that a
  height difference between columns produces no gap within either column's
  own stack (research.md Decision 8).

## Backward compatibility

Behavioral/visual layout change — the feature's core purpose, called out
in the PR description per the Development Workflow gates (Principle VI).
No component prop or exported type is removed except
`StreamingLinksSection`'s internal, unexported `CARD_SPAN` constant (not
part of any public contract). Existing `data-testid`s are preserved, though
each moves to a different DOM parent — any test relying on DOM ancestry
rather than `getByTestId` must be checked against this contract. The
single-column (mobile) card **order** changes per research.md Decision 5 —
this is an intentional, user-confirmed behavior change, not a regression.
