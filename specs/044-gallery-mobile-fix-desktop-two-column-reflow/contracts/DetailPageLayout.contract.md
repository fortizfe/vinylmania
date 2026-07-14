# Contract: Detail page top-section layout (`ReleaseDetailPage`, `MasterReleaseDetailPage`, `RecordDetailPage`)

This document is the DOM/behavior contract for the outer content grid all
three detail pages render, since it changes structurally in this feature
(research.md Decision 3/4). It is not a network/API contract — no backend
endpoint is involved.

## Shared grid contract (all three pages)

- Outer grid: `grid grid-cols-1 items-start gap-6 lg:grid-cols-2` (was
  `grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3`).
- Below `lg`: single column, unchanged visual order — gallery first, then
  primary information, then tracklist, then any remaining full-width
  sections. No behavior change from today at this range (spec FR-012/AC8).
- From `lg` onward (no separate `xl` state): the grid has exactly two
  columns.
  - **Column 1**: the gallery wrapper (existing testid, e.g.
    `release-detail-gallery`) — no `col-span`/`xl:` classes needed; it
    occupies one track by default.
  - **Column 2**: the page's primary-information wrapper (existing testid,
    e.g. `release-detail-details`) — same, one track by default.
  - Both columns are top-aligned (`items-start` on the parent grid); neither
    stretches to match the other's height (`/speckit-clarify` resolution).
  - **Full-width rows below**: tracklist, additional-info, and (master
    page only) the versions table each become a direct child of this same
    grid with `lg:col-span-2`, rendering full-width immediately below the
    gallery/info row. These sections keep their exact current props,
    internal behavior, and testids — only their grid membership/nesting
    changes (they move out of the old nested details+tracklist sub-grid).
- No horizontal scroll at any viewport ≥1024px (spec FR-013).
- No third, visually distinct layout state between `lg` and `xl` (spec
  FR-011) — achieved by removing the old `xl:grid-cols-3`/`xl:col-span-*`
  step entirely, not by adding a new one.

## Per-page right-column contents (unchanged data/components, changed grid position)

| Page | Right column (`lg` column 2) contents | Full-width rows below |
|---|---|---|
| `ReleaseDetailPage` | `ReleaseDetailsSection` + "Add to library" button (`release-detail-details`) | `ReleaseTracklistSection` (`release-detail-tracklist`), `ReleaseAdditionalInfoSection` (`release-detail-additional-info`) |
| `MasterReleaseDetailPage` | `MasterReleaseDetailsSection` (`master-detail-details`) | `ReleaseTracklistSection` (`master-detail-tracklist`), `MasterVersionsTable` (`master-detail-versions`) |
| `RecordDetailPage` | `ReleaseDetailsSection` + `MyCopySection` (`record-detail-details`) | `ReleaseTracklistSection` (`record-detail-tracklist`), `ReleaseAdditionalInfoSection` (`record-detail-additional-info`) |

None of the listed components change props or internal behavior — only the
wrapper `<div>` classes around them change (removing `col-span`/`xl:`
classes, adding `lg:col-span-2` to the full-width rows).

## Consumers

- `frontend/src/pages/ReleaseDetailPage.tsx`,
  `frontend/src/pages/MasterReleaseDetailPage.tsx`,
  `frontend/src/pages/RecordDetailPage.tsx` — the three files whose grid
  markup changes per this contract.
- `e2e/tests/release-detail-responsive.spec.ts`,
  `e2e/tests/master-release-detail-responsive.spec.ts`,
  `e2e/tests/record-detail-responsive.spec.ts` — the existing "desktop:
  ...form a multi-panel composition wider than the lg-only cap" test in
  each file asserted the *old* xl-only 3-panel-in-one-row composition; that
  assertion is no longer true (tracklist is now a full-width row, not a
  third panel in the same row, at any desktop width) and must be replaced
  with an assertion that gallery + details form a two-column row starting
  at `lg` (1024px, not 1280px) and that the tracklist renders as a
  full-width row below both, at both `lg`- and `xl`-range viewports (no
  distinct state between them).

## Backward compatibility

Behavioral/visual layout change (Principle VI: this is the feature's core
purpose, not incidental — call out as a UI behavior change in the PR
description per the Development Workflow gates). No component prop,
exported type, or Discogs/Firebase data contract changes. Existing testids
are preserved (same identifiers), though some move to a different parent
element in the DOM tree — any e2e assertion relying on a specific DOM
ancestry (rather than `getByTestId`) must be checked against this contract.
