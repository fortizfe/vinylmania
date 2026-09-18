# Research: Corregir huecos entre tarjetas en el layout de dos columnas del detalle de release

## Decision 1 — Root cause of the reported gap

**Decision**: The gap is a structural consequence of the current CSS Grid
composition, not a stray CSS bug. All four affected pages
(`ReleaseDetailPage.tsx`, `RecordDetailPage.tsx`,
`MasterReleaseDetailPage.tsx`) render one `grid grid-cols-1 items-start
gap-4 lg:grid-cols-2` container whose direct children are: (1) the gallery
card, (2) a `flex flex-col gap-4` wrapper holding 1–2 info cards, and (3)
one or more cards marked `lg:col-span-2` (tracklist, additional-info /
versions table, and `StreamingLinksSection`'s own internally-applied
`lg:col-span-2`). Because (1) and (2) sit in the grid's first implicit row,
that row's height is the CSS Grid default: the max of its two cells. With
`items-start`, neither cell stretches to fill that row height, so the
shorter of the two ends with visible empty space below it — and the next
`lg:col-span-2` card cannot start until that row completes, since a CSS
Grid's rows are a single shared coordinate system. That trailing empty
space *is* the "hueco" from the bug report.

**Rationale**: Confirmed by direct code inspection of all three pre-existing
detail pages (grep for `columns-`, `masonry`, `break-inside`, `grid-auto-flow:
dense` returned zero hits — this is plain CSS Grid auto-placement, not a
masonry/multi-column construct that merely misbehaves).

**Alternatives considered**: None — this is a factual diagnosis, not a
design choice.

## Decision 2 — Reject height-equalization; adopt independent, fixed-assignment columns

**Decision**: Per `/speckit-clarify` (spec Clarifications, session
2026-09-18), the fix does **not** stretch cards to equalize column height.
Instead every card is assigned, once and statically, to exactly one of two
columns; each column is its own independent vertical stack (its own
`flex flex-col gap-4` flow), and nothing renders as a shared full-width row
below the two columns — because any such shared row would recreate the
exact same "wait for the taller column" defect this feature fixes,
regardless of where it sits in the page.

**Rationale**: A CSS Grid's row tracks are a shared coordinate system by
construction — the only way to give two side-by-side columns fully
independent total heights is to make each one a single, self-contained
flow (one grid cell / flex item per column, containing its own stack), not
a set of items that share row lines. This was verified by ruling out every
grid-only alternative (see Alternatives).

**Alternatives considered**:

- *Stretch to equal height* (`align-items: stretch`) — rejected explicitly
  in `/speckit-clarify` ("no se debe forzar que ambas columnas midan lo
  mismo").
- *Explicit `grid-row` placement per card, `grid-auto-flow: column`* — still
  shares row tracks across both columns for any row index with content on
  both sides, reproducing the same gap at a different point.
- *CSS multi-column (`columns-2`) with `column-fill: balance`* — content
  auto-balances by the browser, contradicting FR-007's requirement that the
  column assignment be fixed rather than computed from content height.

## Decision 3 — Column assignment ("por temática", confirmed with user)

**Decision**: Cards are grouped thematically, confirmed interactively
during planning:

| Page | Left column (disc content) | Right column (info / personal / actions) |
|---|---|---|
| `ReleaseDetailPage` | Gallery, Tracklist, Additional info (conditional) | Main info + Add-to-library/wishlist buttons, WantlistPanel (conditional), Streaming |
| `RecordDetailPage` | Gallery, Tracklist, Additional info (conditional) | Main info, Your Copy, Streaming |
| `MasterReleaseDetailPage` | Gallery, Tracklist, Versions table | Main info, Other details (conditional), Streaming |

**Rationale**: Groups by what the card is *about* — the release's musical/
physical content (images, tracklist, catalog/technical details, pressing
versions) on the left, versus catalog-descriptive and personal/action
content (title/artist/label info, the user's own copy or wishlist state,
where-to-stream) on the right. Confirmed with the user rather than assumed,
since it's a visual/product decision, not a technical one.

## Decision 4 — Mechanism: two grid cells, not a shared multi-item grid

**Decision**: Keep the existing `grid grid-cols-1 items-start gap-4
lg:grid-cols-2` outer container (minimal diff from the current, established
pattern — see spec 044's `DetailPageLayout.contract.md`), but reduce it to
**exactly two direct children**: a left-column wrapper and a right-column
wrapper, each `flex flex-col gap-4` holding its fixed card list per
Decision 3. No child is ever `lg:col-span-2` any more — there is nothing
left to span across, since every card belongs to one column.

A new shared component, `frontend/src/components/DetailColumns.tsx`
(`{ left: ReactNode; right: ReactNode }`), centralizes this container so
the four consuming pages stop hand-repeating the same grid/column utility
classes — required by the constitution's "Reusable atomic components" rule
once a class combination repeats more than once, and it directly reduces
the risk that caused this bug: three pages independently re-implementing
the same layout and drifting apart.

**Rationale**: This is the smallest change that satisfies FR-001/002/003/
007/008/009 simultaneously: two grid cells never share a row track with
each other's internal content, so neither column's height affects where
the other column's cards land, while the outer grid itself still handles
the `lg` breakpoint switch and the `<lg` single-column collapse for free
(no separate mobile code path).

**Alternatives considered**: See Decision 2's alternatives (they apply here
too, since they were evaluated as full mechanisms, not just as height
policies).

## Decision 5 — Mobile card order changes to match the column grouping

**Decision**: Per `/speckit-clarify`-style confirmation captured in the
plan phase (spec Clarifications, session 2026-09-18, third entry), the
single-column (`<lg`) layout renders the same two column-wrappers stacked
vertically (left wrapper's cards, then right wrapper's cards), rather than
today's interleaved order. This changes the mobile reading order from
Gallery → Main info → Your copy → Tracklist → Additional info → Streaming
to Gallery → Tracklist → Additional info → Main info → Your copy →
Streaming (per-page equivalents per Decision 3's table).

**Rationale**: A CSS Grid cell's content is a single, indivisible box in
document flow — there is no available technique that lets a `<lg` grid
collapse the two cells' children back into today's interleaved order while
still giving the two columns independent heights at `lg`+. The only way to
preserve today's exact mobile order would be to render the affected cards
twice (once in the old flat order, hidden at `lg`+; once grouped, hidden
below `lg`) — rejected as an accessibility and maintenance anti-pattern
(duplicate headings/ids/data-fetching hooks in the DOM). The user confirmed
unifying the order is preferable to that complexity.

**Alternatives considered**: Duplicate/conditionally-rendered markup per
breakpoint (rejected, see Rationale); explicit CSS Grid row placement
(rejected, see Decision 2).

## Decision 6 — `StreamingLinksSection`'s internal `CARD_SPAN` becomes dead code

**Decision**: Remove the `CARD_SPAN = 'lg:col-span-2'` constant and its
application in `StreamingLinksSection.tsx`, along with its explanatory
comment ("All three detail-page mount points lay their content out in the
same `lg:grid-cols-2` grid..."). The component is now always mounted one
level inside a column wrapper (never a direct child of the outer grid), so
`lg:col-span-2` is inert there.

**Rationale**: YAGNI — a class with no remaining effect, and a comment
describing a layout contract that no longer exists, is dead code/dead
documentation once all four consumers move to Decision 4's structure.

## Decision 7 — Loading skeleton needs no change

**Decision**: `RecordDetailSkeleton.tsx` is left as-is.

**Rationale**: The constitution's skeleton rule requires mirroring "the
exact shape and dimensions of the final content (same card structure, same
approximate number of lines/blocks)" — a standard this skeleton already
meets only loosely today (one image block, two side-by-side info blocks,
one decorative bottom bar; it does not model tracklist/additional-info/
streaming as distinct blocks). Reassigning which named section renders in
which column does not change the skeleton's already-approximate shape, so
no change is required to stay compliant.

## Decision 8 — Existing e2e responsive assertions must be rewritten, not merely extended

**Decision**: `e2e/tests/record-detail-responsive.spec.ts`,
`release-detail-responsive.spec.ts`, and
`master-release-detail-responsive.spec.ts` each contain assertions that
encode the *old*, now-fixed behavior directly, e.g.
(`record-detail-responsive.spec.ts:101-103`):

```ts
expect(tracklistBox!.y).toBeGreaterThan(galleryBox!.y);
expect(tracklistBox!.y).toBeGreaterThan(yourCopyBox!.y); // <- asserts the bug's own mechanism
expect(otherDetailsBox!.y).toBeGreaterThan(tracklistBox!.y);
```

The second line asserts that the tracklist waits for *both* columns to
finish — literally the defect being fixed. These must be replaced with
assertions that (a) tracklist/other-details sit in the same column as the
gallery (same `x`, monotonically increasing `y` within that column only),
independent of the right column's height, and (b) a regression case proves
no gap appears within a column even when the opposite column is much
taller (e.g., a fixture with a very short "your copy"/no rating vs. a long
tracklist, and vice versa).

**Rationale**: Required by the constitution's mandatory e2e-coverage gate
for any `/frontend` change, and because leaving the old assertions in place
would either fail immediately (good, but uninformative) or — worse — get
silently adjusted without re-deriving what "correct" now means.
