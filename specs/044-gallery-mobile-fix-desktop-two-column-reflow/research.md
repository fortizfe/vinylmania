# Phase 0 Research: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

No `NEEDS CLARIFICATION` markers remain in the Technical Context (this is a
frontend-only presentational change to already-well-understood components;
language, dependencies, testing stack, and target platform all match the
existing `frontend`/`e2e` apps). This research instead resolves the root
cause the spec's own Assumptions section flagged as needing real-browser
verification, plus two implementation-approach decisions.

## Decision 1: Root cause of the mobile containment bug, and its fix

**Decision**: Add a single `overflow-hidden` class to `ReleaseImageGallery`'s
root `<div>` (`mx-auto flex aspect-square gap-3 lg:max-w-md` →
`... overflow-hidden ...`), applied unconditionally (all breakpoints, not
gated behind `lg:` or a mobile-only variant).

**Root cause — confirmed via real-browser reproduction, not CSS inference**:
The spec's Assumptions section flagged this as an open question ("conviene
revisarlo... con pruebas reales, no solo inferencia del CSS"). Investigation
during planning found:

1. An isolated HTML file reproducing `ReleaseImageGallery`'s exact
   production classes (`flex aspect-square gap-3` root; `aspect-square
   min-w-0 flex-1` main image; `flex w-16 min-h-0 flex-col gap-2
   overflow-y-auto` thumbnail strip — the same `min-h-0` fix spec `043`
   already added), tested in headless **Chromium** at 375×812 with up to 12
   thumbnails, both standalone and nested inside the real three-page CSS
   Grid structure: containment was already correct. The root stayed square;
   the thumbnail strip clipped and scrolled internally.
2. Running the project's *existing* e2e suite confirmed this: `record-
   detail-responsive.spec.ts`'s "mobile: the thumbnail column never exceeds
   the main image height, even with many images (spec 043, US1)" test
   (375×812, 12 images) — added in the same commit that shipped spec `043`
   (`06ecac5`) — **passes** against the real app in Chromium today, as do
   the equivalent "lg-range desktop" tests for the release/master pages.
3. The stakeholder confirmed the bug reproduces on **Safari, iPhone 16**,
   with releases of **more than 4 images**. Re-running the identical
   isolated repro under Playwright's **WebKit** engine reproduced the exact
   symptom and threshold: at 3 thumbnails, WebKit stays square (277×277,
   matching Chromium); at 5+ thumbnails, WebKit's root container grows to
   the thumbnail strip's full content height (352px at 5, 568px at 8, 856px
   at 12) while Chromium stays square (277×277) at every count. The
   threshold — broken starting at 5 images, correct at ≤4 — matches the
   stakeholder's report exactly.

This is a WebKit-specific interaction between `aspect-ratio`, a flex
container whose child has `min-height: 0` + `overflow-y: auto`, and that
child's automatic minimum size resolution: WebKit does not clamp the flex
row's own automatic block size to the aspect-ratio-derived value once a
descendant has scrollable overflow content, and instead sizes the row to
that descendant's full content height. Chromium (and, per the isolated
repro, Firefox was not tested but is not the reported browser) resolves the
same markup correctly. This is why the bug was invisible to the project's
Chromium-only e2e suite (Decision 2) and why it affects **both** mobile and
desktop widths in Safari — the underlying WebKit sizing bug is not
width-dependent, only content-count-dependent (>4 images), so a user on
desktop Safari would hit the identical bug once past that image count. The
spec's assumption that "desktop already handles this correctly" therefore
only holds for Chromium; the unconditional fix here also protects desktop
Safari, which is a superset of the spec's stated requirement (mobile
parity) rather than a conflict with it.

**Fix verification**: Adding `overflow: hidden` to the root container
(`gallery-repro-5-fix.html` in the investigation) fixed WebKit at every
tested count (3/5/8/12 images) while leaving Chromium's already-correct
behavior unchanged, with the thumbnail strip's internal scroll still intact
in both engines (`scrollHeight` continues to exceed `clientHeight`, clipped
to the container's height).

**Rationale**: `overflow: hidden` on a box with `overflow: visible`
elsewhere in its ancestry is a well-established, minimal way to force a
browser to treat the box's own content as not contributing to its
automatic (`auto`) size — the same category of fix as `min-h-0` on the
child (spec `043` Decision 2), just applied one level up, on the parent
whose own automatic sizing was the actual defect. One class, no behavior
change for Chromium, no change to the thumbnail strip's own scroll
mechanism, no change to `lg:max-w-md`'s desktop cap — satisfies spec
FR-001/FR-002/FR-003 (identical containment behavior, mobile and desktop)
with the smallest possible diff (Principle III).

**Alternatives considered**:
- *Explicit `max-height` matching computed width via JS (ResizeObserver)* —
  rejected: reintroduces exactly the runtime-measurement complexity the
  CSS-only `aspect-ratio` approach was chosen to avoid; the CSS-only fix is
  simpler and fully declarative (KISS).
- *Switch the root from CSS `aspect-ratio` to the legacy padding-bottom
  aspect-ratio trick* — rejected: a larger, more invasive rewrite of a
  working pattern to fix what turned out to be a one-property gap;
  `overflow-hidden` is strictly smaller and lower-risk.
- *Scope the fix to `lg:overflow-hidden` or a mobile-only variant* —
  rejected: the root cause is not width-dependent (confirmed above), and
  spec FR-003 explicitly requires identical mobile/desktop behavior — a
  conditional fix would leave desktop Safari broken, contradicting both the
  root-cause finding and the spec.

## Decision 2: Regression coverage for a WebKit-only bug

**Decision**: Add a second Playwright project, `webkit`, to
`e2e/playwright.config.ts`, scoped via `testMatch` to only the three
`*-detail-responsive.spec.ts` files (not the full e2e suite), and add a new
test case in each — "more than 4 images" containment, mirroring the exact
reproduction that surfaced this bug — that runs under both the existing
`chromium` project and the new `webkit` project.

**Rationale**: This bug shipped in spec `043` undetected because the
project's e2e suite only exercises Chromium (`playwright.config.ts`'s
`projects` array has a single `chromium` entry) while the actual defect is
WebKit-only. A Vitest/RTL unit test cannot catch this class of bug either —
jsdom does not perform real CSS layout, so it cannot compute `aspect-ratio`
or flex/overflow box sizes at all; only a real-engine Playwright run can.
Scoping the new WebKit project to just the three responsive-layout specs
(rather than running the entire e2e suite twice) keeps the CI runtime cost
proportional to the actual coverage gap being closed, consistent with
Principle III and the constitution's e2e gate (mandatory coverage for the
affected flow, not blanket duplication).

**Alternatives considered**:
- *Run the full e2e suite under both `chromium` and `webkit`* — rejected:
  roughly doubles e2e CI time for coverage that, outside this specific
  aspect-ratio/flex/overflow interaction, is not known to differ between
  engines in this codebase; disproportionate to the problem (YAGNI).
- *Manual-only verification (no automated WebKit coverage)* — rejected:
  violates the constitution's Test-First principle and e2e coverage gate,
  and is exactly how this bug shipped unnoticed the first time.
- *A dedicated new spec file instead of extending the existing
  `*-detail-responsive.spec.ts` files* — rejected: the existing files
  already own "responsive layout" coverage for each page including the
  prior `043` containment tests; adding the new case alongside them keeps
  related assertions together rather than fragmenting per-page responsive
  coverage across more files.

## Decision 3: Desktop two-column reflow — grid restructuring

**Decision**: On all three detail pages, replace the current
`grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3` outer grid (with the
gallery at `lg:col-span-2 xl:col-span-1` and a nested
`grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-2` sub-grid for
details+tracklist) with a single flat
`grid grid-cols-1 items-start gap-6 lg:grid-cols-2` grid, where:
- the gallery wrapper and the page's primary-information wrapper become the
  two `lg`-breakpoint columns (no `col-span`/`xl:` classes needed — each
  naturally occupies one of the two tracks), and
- the tracklist, additional-info, and (for the master page) versions-table
  sections move out of the old nested sub-grid and become direct children
  of the flat grid with `lg:col-span-2`, rendering full-width below the
  gallery/info row at every desktop width from `lg` onward.

**Rationale**: This is the most direct way to satisfy spec FR-005/FR-006/
FR-010/FR-011 (two columns from `lg`, gallery left/info right, no
intermediate `xl` state, everything else full-width below) without
introducing a new grid nesting level or nonstandard breakpoint — it reuses
the exact `lg` breakpoint the page's own info+tracklist sub-grid already
used, just flattened into the outer grid instead of nested inside it
(matching the HU's own planning note). `items-start` overrides CSS Grid's
default `align-items: stretch` — without it, the gallery and info columns
would stretch to match each other's height by default, which is the
opposite of what `/speckit-clarify` resolved (top-aligned columns, shorter
column leaves whitespace, no stretching). No page-level component
(`ReleaseDetailsSection`, `MasterReleaseDetailsSection`, `MyCopySection`,
`ReleaseTracklistSection`, etc.) needs internal changes — only the
grid/wrapper classes around them.

**Alternatives considered**:
- *Keep the nested sub-grid, just change its breakpoint from implicit-`xl`
  to `lg`* — rejected: would still leave tracklist visually paired with
  details in a sub-grid, which no longer matches "gallery left, info
  right, everything else full-width below" — the sub-grid's own 2-column
  split (details | tracklist) is a different composition than the outer
  2-column split this spec asks for (gallery | info), and keeping both
  would either produce a 4-way arrangement or require the sub-grid to
  collapse to 1 column at `lg`, adding complexity for no benefit over
  flattening.
- *Introduce a dedicated `<DetailPageLayout>` wrapper component shared by
  all three pages* — rejected as premature: the three pages already differ
  in what their right column contains (button vs. no button vs.
  `MyCopySection`) and in whether a fourth full-width section exists
  (versions table vs. additional-info); a shared layout component would
  need slot props for all of these differences, adding an abstraction
  layer for three call sites that only share a grid class string —
  violates Principle III (YAGNI) given the current scope. Revisit only if
  a fourth consumer emerges.

## Decision 4: Column height alignment — CSS mechanism

**Decision**: `items-start` (Tailwind) → `align-items: start` on the flat
grid from Decision 3, applied grid-wide (not per-row), confirming the
`/speckit-clarify` resolution.

**Rationale**: CSS Grid's default `align-items` is `stretch`, which would
silently make the shorter of the gallery/info columns stretch to match the
taller one's height — the opposite of the clarified requirement. Because
the tracklist/additional-info rows below are single-column-spanning
(`lg:col-span-2`) and alone in their own grid row, `items-start` has no
visible effect on them (nothing to stretch against in a single-item row),
so one grid-wide utility is sufficient — no per-item `self-start` overrides
are needed.

**Alternatives considered**:
- *Per-item `self-start` only on the gallery* — rejected: equivalent
  result but requires the same override twice as many places (once per
  page) for no benefit over a single grid-wide `items-start`.
