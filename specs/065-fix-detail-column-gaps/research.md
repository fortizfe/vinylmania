# Research: Fix gaps in the two-column record detail layout

## R1 — Root cause of the reported gap

**Decision**: The defect is caused by CSS Grid row auto-placement sharing row height across two logically independent "columns" whose cards are assigned only a `grid-column` (via `lg:col-start-1` / `lg:col-start-2` utility classes), with no explicit `grid-row`. The grid's implicit row-placement algorithm walks the DOM in source order and drops each item into the next available cell in its specified column — so whenever a short "rail" card (e.g. `StreamingLinksSection`) and a tall "content" card (e.g. `ReleaseTracklistSection`) land in the same auto-generated row, that row's track height stretches to the taller item, leaving visible empty space under the shorter one. This reproduces on:
- `RecordDetailLayout.tsx` (shared by `ReleaseDetailPage` and `RecordDetailPage`): the full interleaved sequence gallery → generalInfo → (myCopy) → rating → streaming → tracklist → catalogInfo can pair mismatched cards into the same row at multiple points down the page.
- `RecordDetailSkeleton.tsx`: mirrors the exact same grid + column-class structure (by design, to avoid layout shift on the skeleton→content swap), so it reproduces the identical bug while loading.
- `MasterReleaseDetailPage.tsx`: a narrower case — only the top `gallery` + `info-stack` pair shares a CSS Grid row before the full-width `tracklist`/`versions`/`streaming` sections resume; `items-start` is already set, but that only stops the shorter card's *content* from stretching — the grid cell (and thus the gap beneath it) is unaffected by `align-items`.

**Rationale**: Confirmed by reading the grid auto-placement spec's behavior against the actual DOM order in each file (see `RecordDetailLayout.tsx:52-105`, `MasterReleaseDetailPage.tsx:96-144`) and cross-checking against the user's report ("a gap the size of the other column's card").

**Alternatives considered**: None — this is a diagnosis step, not a decision point.

## R2 — Fixing `MasterReleaseDetailPage` / `MasterReleaseDetailSkeleton`

**Decision**: Replace the single `grid grid-cols-1 lg:grid-cols-2` wrapper (which currently holds the top pair *and* the full-width sections via `lg:col-span-2`) with a plain outer `flex flex-col gap-4` stack, and nest the gallery + info-stack pair inside their own `flex flex-col lg:flex-row lg:items-start gap-4` row. The tracklist/versions/streaming cards become ordinary flow siblings after that row — no `col-span` needed since there's no longer an outer grid.

**Rationale**: Flexbox's cross-axis sizing (`items-start`) gives each of the two top-pair children its own natural height with no shared "row track" concept — unlike Grid, there's no invisible cell reserved to the height of the tallest sibling. Because the top pair is only ever two *adjacent* DOM siblings (no interleaving with later cards), this requires zero DOM reordering and zero new code — a pure, minimal CSS restructure consistent with Principle III (Simplicity/YAGNI).

**Alternatives considered**:
- Keep CSS Grid, add `grid-auto-rows: min-content` — rejected: does not stop row-track sharing between the two column items in the same row, only affects rows with no explicit sizing that already have no shared items.
- Apply the same JS-measured approach as R3 below — rejected as overkill: this page only has a single adjacent pair, which plain Flexbox already solves.

## R3 — Fixing `RecordDetailLayout` / `RecordDetailSkeleton`

**Decision**: Introduce a small reusable hook, `useIndependentColumnLayout` (`frontend/src/hooks/`), that:
- Takes an ordered list of `{ ref, column: 'rail' | 'content' }` entries — one per existing card slot, in the exact current DOM order.
- On viewports `>= lg` (matched via `window.matchMedia('(min-width: 1024px)')`, consistent with the codebase's existing `lg:` Tailwind usage), computes each card's `top` offset as the running total height of the same-column cards that precede it, and applies it via inline `position: absolute` styling on a `position: relative` wrapper — never the CSS `order` property, and never a DOM move.
- Recomputes offsets whenever any tracked card's height changes, via one `ResizeObserver` per card (covers async image loads, tracklist expansion, font swap, etc.), and whenever the `matchMedia` listener reports a breakpoint crossing.
- Sets the wrapper's own height to `max(railColumnHeight, contentColumnHeight)` so following page content is not overlapped.
- On viewports `< lg`, is a no-op: cards render in normal document flow exactly as today (`flex flex-col gap-4`), untouched.

The same hook (and the wrapper component built on it) is used by both `RecordDetailLayout` (real content) and `RecordDetailSkeleton` (loading state), so the two can never drift apart and both automatically satisfy the "no layout shift on swap" requirement (FR-008/SC-005) by construction — they run the same code, not a hand-kept-in-sync copy.

**Rationale**: This is the only approach found that satisfies both hard constraints simultaneously: (a) zero visible gap regardless of column height mismatch (FR-001/002), and (b) the DOM/keyboard/screen-reader order stays byte-for-byte identical to today (FR-005/006), because the cards are never moved or grouped in the DOM — only their visual position is set via CSS, which is exactly how position-independent-of-source-order is supposed to be done accessibly (screen readers and Tab order follow DOM order, not CSS position/transform).

**Alternatives considered**:
- **Group cards into two column-wrapper `<div>`s** (industry-standard two-independent-flex-columns pattern; this is what the earlier, closed attempt at this same fix did): rejected — nesting cards under two column containers necessarily changes DOM order from today's interleaved sequence to a column-grouped one, which conflicts with the explicit FR-005/006 requirement to preserve today's order exactly (a requirement reaffirmed during this feature's `/speckit-clarify` and plan-time decision, precisely to avoid relitigating the accessibility/reading-order question this same trade-off likely raised before).
- **CSS Grid Level 3 `masonry` value**: rejected — not implemented in any shipping version of Chromium or WebKit as of this writing; the project's e2e suite explicitly covers WebKit, so a Chromium/WebKit-only feature is not viable.
- **Third-party masonry library** (e.g. `react-masonry-css`, `masonic`): rejected per Principle III (YAGNI) — these libraries solve automatic, balanced item distribution across N columns; this feature needs a fixed, role-based column assignment (rail vs. content) that's already known statically, which a ~100-line custom hook covers without adding a dependency.
- **CSS Grid with explicit non-overlapping row ranges per column** (e.g. rail uses rows 1–3, content uses rows 4–7): rejected — this stacks each column with no shared gap, but visually pushes the second column's first card down to start below the entire first column, destroying the intended side-by-side desktop layout (the exact case the constitution's "Dual responsive layout" rule requires).

## R4 — Testing `ResizeObserver`-based layout in Vitest/jsdom

**Decision**: jsdom (the project's Vitest environment) does not implement `ResizeObserver`. Add a minimal test-only `ResizeObserver` stub (constructor + `observe`/`unobserve`/`disconnect`, capturing the callback so tests can invoke it manually to simulate a size change) to `frontend/tests/setup.ts`, alongside the existing `window.matchMedia` polyfill already there for the same reason.

**Rationale**: Consistent with the existing pattern in `tests/setup.ts` (the `matchMedia` stub was added for exactly this class of problem — a browser API jsdom doesn't provide that a component under test depends on). Keeping the stub in the shared setup file (rather than per-test mocks) avoids repeating boilerplate across `RecordDetailLayout.test.tsx`, `RecordDetailSkeleton.test.tsx`, and the new hook's own unit tests.

**Alternatives considered**: Per-test `vi.stubGlobal('ResizeObserver', ...)` — rejected as the default because every test touching this layout would need to repeat it; still available as an escape hatch for a test that needs a custom observer behavior.

## R5 — Verifying the fix end-to-end

**Decision**: Extend the three existing responsive e2e specs (`release-detail-responsive.spec.ts`, `record-detail-responsive.spec.ts`, `master-release-detail-responsive.spec.ts`) with a regression assertion per page: render fixture data with a deliberately short rail card and a deliberately long content card (and the reverse pairing), then assert there is no gap — e.g. by asserting the pixel distance between the bottom of one rail card and the top of the next rail card equals the design system's card gap (not the height of an unrelated content-column card).

**Rationale**: These specs already run at the `lg` breakpoint and already cover chromium + webkit per the constitution's e2e mandate for any `/frontend` PR; adding assertions to them is more consistent than creating parallel spec files, and directly encodes SC-001/SC-002 as automated checks.

**Alternatives considered**: A dedicated new e2e spec file for gap-regression only — rejected as unnecessary duplication of page navigation/auth/fixture setup already present in the existing specs.
