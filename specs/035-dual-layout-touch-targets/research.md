# Phase 0 Research: Dual Desktop/Mobile Layout & 44px Touch Targets

All Technical Context fields were resolvable from the existing codebase and
constitution — no `NEEDS CLARIFICATION` markers remain. This document
records the design decisions made while translating the spec's requirements
into a concrete technical approach, based on the codebase survey summarized
below.

## 1. Single breakpoint-driven component vs. parallel desktop/mobile components

**Decision**: Each screen/component keeps one implementation with a full
Tailwind breakpoint stack (`grid-cols-1 sm:… md:… lg:… xl:…`, or
`flex-col md:flex-row`-style toggles), rather than two parallel
components (e.g. `SearchResultsPageDesktop` / `SearchResultsPageMobile`)
switched by breakpoint or JS media-query hook.

**Rationale**: This is the exact pattern already implemented and documented
for `DashboardPage`/`FeedArticleBoard` (spec 033), the one screen the brief
calls already-conformant. Its own `research.md` explicitly rejected the
two-component approach because it "doubles the surface area... risks the
two views drifting out of sync." Reusing the same approach keeps the codebase
consistent and satisfies Principle III (Simplicity/YAGNI).

**Alternatives considered**: Separate desktop/mobile component trees
(rejected — duplication risk, already rejected precedent in this codebase);
JS-based `useMediaQuery`/`matchMedia` hook driving conditional rendering
(rejected — spec FR-003 and the constitution both require breakpoint-only
CSS switching, not JS-computed device state, to avoid hydration/SSR
mismatches and keep the switch purely declarative).

## 2. Centralizing the 44px touch-target fix

**Decision**: Fix the touch-target floor primarily in the shared atomic
components — `Button` (`size="icon"` and the default `md` size, plus the
exported `iconButtonClassName()` helper), `Input`, `Checkbox` (row wrapper),
`ThemeToggle`, `StarRating`, `BackLink` — using Tailwind's existing
`min-h-11 min-w-11` utility (2.75rem = 44px, already used by
`FeedCategoryFilterBar`/`FeedSourceFilterBar`). Per-screen fixes are only
needed for hand-rolled controls that don't go through a shared atomic
(e.g. `MasterVersionsTable` row links, `LibraryLinkRequired`'s duplicated
button markup).

**Rationale**: The codebase survey found `size="icon"` (36px) is reused by
`HamburgerMenu`, `HeaderNavIcons`, `HeaderSearchBox`'s submit button,
`Modal`'s close button, `FilterActions` (×2), and `ResultCardActions` — a
single fix in `Button.tsx` resolves the majority of violations at once
instead of patching seven-plus call sites individually, satisfying
Principle III. `LibraryLinkRequired.tsx` currently hand-rolls Button's
primary-button styles instead of rendering `<Button>` — this is also an
existing violation of the constitution's "reusable atomic components" rule
independent of touch-target sizing, so this feature corrects it as part of
the reconstruction (in scope per the brief: "reconstrucción completa...
reutilizando los componentes atómicos ya existentes").

**Alternatives considered**: Overriding size per call site with ad-hoc
`className` overrides (rejected — repeats the same utility string across
many files, exactly what the constitution's "reusable atomic components"
rule prohibits); introducing a new `size="lg"`/`size="touch"` Button variant
used selectively only on mobile-relevant call sites (rejected — adds an
extra decision axis for no benefit, since 44px is a floor that's safe to
apply uniformly at every breakpoint, mirroring the Dashboard filter-chip
precedent of applying `min-h-11 min-w-11` unconditionally rather than only
under a `max-md:` variant).

## 3. Wide-desktop composition for detail pages (Record/Release/MasterRelease)

**Decision**: Extend the existing `grid-cols-1 lg:grid-cols-2` pattern
shared by `RecordDetailPage`, `ReleaseDetailPage`, and
`MasterReleaseDetailPage` with an additional `xl:` step that gives the
gallery, release data, tracklist, and additional-info sections a more
deliberate multi-panel arrangement at ≥1280px (e.g. gallery + core data as
one row, tracklist and additional info distributed alongside rather than
both spanning full width), and lift the outer container's `max-w-5xl` cap
so the composition can use more of the viewport at `xl:` and above.

**Rationale**: The survey found all three detail pages already share one
`lg:`-only 2-column grid pattern capped at `max-w-5xl`, with no `xl:` step —
i.e. a 1440px+ monitor renders identically to a 1024px laptop, leaving
horizontal space unused. Because all three pages share the same composite
sections (`ReleaseDetailsSection`, `ReleaseTracklistSection`,
`ReleaseAdditionalInfoSection`, `ReleaseImageGallery`), the same `xl:` grid
adjustment naturally applies to all three with minimal per-page divergence,
consistent with FR-001/SC-003 (deliberate multi-column desktop use) and the
brief's explicit call-out of this shared pattern.

**Alternatives considered**: A completely bespoke desktop layout per page
(rejected — the three pages share identical sections and data shape, so
divergent layouts would violate Principle III/DRY without a corresponding
UX benefit); leaving the `lg:`-only cap as-is and only fixing touch targets
(rejected — spec FR-001/SC-003 explicitly require a wide-desktop
composition that uses available space, and the brief explicitly flags this
container-width limitation as in-scope).

## 4. `MasterVersionsTable` mobile layout (horizontal-scroll table)

**Decision**: Replace the `overflow-x-auto`-wrapped `<table>` with a
Tailwind-breakpoint-driven composition: a stacked card/list presentation
below `md` (each version's fields shown as labeled rows inside a `Card`,
consistent with the app's card-based design system) and the existing table
presentation at `md:` and above.

**Rationale**: The survey flagged this as the one component that
structurally violates the "no horizontal scroll on mobile" rule (FR-005/
SC-002) today — a `<table>` in an `overflow-x-auto` wrapper is horizontal
scroll by construction once columns exceed viewport width. A responsive
card/list-below-`md`, table-at-`md`-and-above split keeps all the same data
and the `Link`/pagination behavior (FR-007) while eliminating the scroll
container on mobile.

**Alternatives considered**: Keeping the table at all breakpoints and only
shrinking column content/font size (rejected — doesn't reliably eliminate
horizontal scroll at 360px for a multi-column version table, and the spec's
success criteria treat any horizontal scroll on primary content as a
failure, not a matter of degree); a horizontally-swipeable carousel of
per-version cards on mobile (rejected — swipeable carousels are themselves a
form of horizontal scroll interaction on primary content, which SC-002 rules
out, and adds interaction complexity beyond what FR-011's "no new
functionality" constraint calls for).

## 5. Testing strategy for layout/geometry requirements

**Decision**: Pair each touched screen/component with (a) Vitest
component/unit tests asserting the presence of the relevant responsive
Tailwind classes and unchanged data/actions (jsdom has no layout engine, so
it can't measure pixels, but it can assert markup/class contracts and that
no functional element was removed), and (b) a Playwright e2e spec per
screen asserting real-viewport geometry: grid/flex column behavior at a
representative desktop width (≥1280px) vs. a representative mobile width
(360–430px), absence of horizontal scroll (`document.documentElement.
scrollWidth <= clientWidth`) at mobile widths, and `boundingBox()` width/
height ≥44 for every interactive control exercised on that screen — directly
extending the existing `dashboard-feed-grid.spec.ts` and
`header-responsive-nav.spec.ts` patterns.

**Rationale**: This satisfies Principle I (Test-First) using tools already
in the project (Vitest, Playwright) and an established in-repo precedent
for exactly this kind of assertion, and satisfies the Development Workflow
gate requiring e2e coverage for any `/frontend` PR. It also gives an
automatable, objective check for the spec's Success Criteria (SC-001
through SC-004) rather than relying solely on manual QA.

**Alternatives considered**: Manual/visual-only QA checklist without
automated geometry assertions (rejected — violates Principle I's
test-first requirement and leaves SC-001/SC-002 unverifiable in CI, risking
silent regressions on future PRs); a dedicated visual-regression/screenshot-
diff tool (rejected — no such tool is currently in the project's stack, and
introducing one would be a new dependency/infrastructure decision out of
scope for a layout-only reconstruction bounded by Principle III).

## 6. Skeleton loading states kept in sync with new layout shapes

**Decision**: Any skeleton component whose corresponding real content
changes shape as part of this reconstruction (notably
`SearchResultCardSkeleton` if the results grid's base column count changes,
and any gallery/detail-section skeletons affected by the new `xl:`
multi-panel composition) MUST be updated in the same task as its real
counterpart, keeping identical sizing classes (`w-*`/`h-*`/`min-h-*`) at
every breakpoint touched.

**Rationale**: Directly required by the constitution's "No layout shift"
rule ("All states of a given component... MUST share the same sizing
classes"). This is called out explicitly here so it is planned for and
tracked as part of Phase 1/tasks rather than discovered as a bug during
review.

**Alternatives considered**: None — this is a direct, non-negotiable
constitution requirement rather than a design choice with tradeoffs.
