# Phase 0 Research: Persistent Header Search & Results Page

All ambiguities that would otherwise be `NEEDS CLARIFICATION` were resolved
during `/speckit-clarify` (see [spec.md](./spec.md) Clarifications section).
This document covers the remaining technical-approach decisions needed before
design.

## Decision 1: How the submitted query reaches the results page

**Decision**: Represent the active query (and page number) as a URL query
string on the results route, e.g. `/app/search?q=<term>&page=<n>`. The header
search box keeps only its own local input state; it does not need to share
state with the results page directly.

**Rationale**: A URL-encoded query satisfies the edge case already in the
spec — a user reaching the results page via back/forward navigation or a
bookmarked link must see a prompt/empty state rather than an error, which is
naturally satisfied when `q` is simply absent from the URL. It also keeps
`SearchResultsPage` self-contained: it can be tested and reasoned about from
its URL alone, and refreshing the page preserves the search.

**Alternatives considered**:
- *React Context / global state store*: rejected — adds a shared-state
  module for a single producer/consumer pair, violating Simplicity/YAGNI.
- *`location.state` (router-passed state, not in the URL)*: rejected — does
  not survive a page reload or a bookmark, which the spec's edge cases
  require to degrade gracefully rather than error.

## Decision 2: Resetting the header search box on navigation

**Decision**: `HeaderSearchBox` reads the current route via
`useLocation()`/`useMatch()` and clears its own local input state in a
`useEffect` whenever the pathname is not the search results route. On the
results route itself, it initializes its input from the `q` URL parameter
instead.

**Rationale**: Keeps the reset rule (FR-002a) colocated inside the one
component that owns the input, matching Single Responsibility — no other
page needs to know about or trigger the reset.

**Alternatives considered**:
- *Per-page reset effects in every other page component*: rejected — would
  require touching every existing page (`DashboardPage`, `WishlistPage`,
  `ProfilePage`, `RecordDetailPage`, `LibraryListPage`) instead of one shared
  component, the opposite of the intended simplification.

## Decision 3: Reusing existing search/result building blocks

**Decision**: `SearchResultsPage` is built by moving the existing
result-rendering logic out of `AddRecordPage` (results grid, skeleton,
empty/error states, pagination, add/preview actions) into the new page,
calling the same unchanged hooks (`useCatalogSearch`, `useCatalogRelease`,
`useCreateLibraryEntry`) and unchanged presentational components
(`SearchResultCard`, `SearchResultCardSkeleton`, `ReleasePreviewModal`).
`AddRecordPage` itself is deleted; nothing continues to reference it.

**Rationale**: Directly implements the "retire it entirely" clarification
and honors Simplicity/YAGNI (one search surface, not two) and Discogs
Integration-First (no changes to the integration modules themselves).

**Alternatives considered**:
- *Keep `AddRecordPage` as an internal implementation detail rendered at the
  new route*: rejected as unnecessary indirection — the page's only reason
  to exist was as the "add a record" destination, which no longer exists as
  a distinct concept once search lives in the header.

## Decision 4: New route path for the results page

**Decision**: Introduce `/app/search` as the new route, rendering
`SearchResultsPage`. Remove the `/app/library/add` route entirely (no
redirect route is registered for it).

**Rationale**: The route's purpose changed from "a library-scoped add
screen" to "a global catalog search result screen," so its path should read
that way rather than carry over the old, now-inaccurate `/library/add`
segment. The app has no existing catch-all/404 route today, so visiting the
old URL post-change behaves the same as visiting any other unknown path in
this app (renders nothing) — this is pre-existing behavior, not a regression
introduced by this feature.

**Alternatives considered**:
- *Add a redirect from `/app/library/add` to `/app/search`*: rejected —
  FR-011 requires the old route not remain reachable at all, and adding
  catch-all/redirect handling where none exists today is unrelated scope
  creep beyond what this feature asked for.

## Decision 5: e2e test migration

**Decision**: Update the three Playwright specs that currently call
`page.goto('/app/library/add')` (`library-discogs-sync.spec.ts`,
`caching-navigation.spec.ts`, `release-preview-gallery.spec.ts`) to instead
navigate to any authenticated page, type into the header search box, submit,
and assert against the `/app/search` results page.

**Rationale**: The constitution's Development Workflow gate requires e2e
coverage for the affected flow on every frontend PR and forbids leaving
pipeline e2e checks failing; these three specs directly exercise the route
being retired and will fail once it is removed unless updated in the same
change.

**Alternatives considered**: None — this is a required consequence of
Decision 4, not an open design choice.
