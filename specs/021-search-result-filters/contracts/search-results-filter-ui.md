# UI Contract: Search Results Filter Control

**Feature**: 021-search-result-filters | **Date**: 2026-07-07

This feature adds no new route. It extends the existing `/app/search` route
and its `SearchResultsPage` component with a filter control, plus extends
the existing URL/query-params contract established in feature 018.

## Route contract (extended)

| Route | Component | Query params | Notes |
|---|---|---|---|
| `/app/search` | `SearchResultsPage` | `q` (string, required for results), `page` (number, optional, default `1`), `artist` (string, optional), `genre` (string, optional), `style` (string, optional), `format` (string, optional) | `artist`/`genre`/`style`/`format` are new (this feature); all other params unchanged from feature 018. |

Reloading, bookmarking, or sharing a URL that includes any of the four
filter params MUST reproduce the same filtered result set (spec FR-007).

## `SearchFiltersControl` component contract (new)

- **Fields**: four text inputs — Artist, Genre, Style, Format — each backed
  by the existing `Input` atomic component (`frontend/src/components/ui/Input.tsx`).
- **Initial values**: on mount/route entry, each field initializes from the
  corresponding URL query param (if present), matching how `HeaderSearchBox`
  already initializes from `q` (feature 018 contract).
- **Apply action**: a primary `Button` ("Apply filters"). On click (or
  submitting the filter form, e.g. via Enter):
  1. Each of the four field values is trimmed.
  2. Trimmed-empty values are dropped (not sent as empty-string params).
  3. The results screen navigates to the same `q`, with `page` reset to `1`,
     and the trimmed non-empty filter values set on the URL — using the
     same `replace`-style navigation `SearchResultsPage` already uses for
     pagination (no new history entry per filter change).
  4. This is the *only* trigger that re-runs the search — editing a field
     without clicking Apply (or submitting) MUST NOT trigger a request
     (spec FR-003).
- **Clear action**: a secondary `Button` ("Clear filters"). On click:
  - All four fields reset to empty (both the local uncommitted UI state and
    the URL params).
  - Results revert to the unfiltered, query-only result set for the current
    `q` (spec FR-005).
- **Pagination interaction**: navigating to another results page
  (`goToPage` in `SearchResultsPage`) MUST carry the currently-applied
  filter values forward unchanged (spec FR-006).
- **Empty/no-results state**: when applied filters produce zero results,
  the existing "No results found" message is replaced with a variant that
  acknowledges active filters (spec FR-008) — e.g. naming which filters are
  active and suggesting the user adjust or clear them.
- **Loading/error states**: unchanged from the existing contract — the
  existing skeleton grid and `catalog_unavailable` error message apply
  identically whether or not filters are active.

## Reused, unchanged contracts

- `discogsApi.search(query, type, page, perPage, filters?)` via
  `useCatalogSearch` (`frontend/src/queries/discogsQueries.ts`) — extended
  with an additional optional `filters` argument; existing call sites that
  omit it are unaffected.
- `discogsApi.getRelease(discogsId)` / `useCatalogRelease` — unchanged.
- `useCreateLibraryEntry` — unchanged.
- Header search box contract (feature 018) — unchanged; the header search
  box continues to control only `q`, not filters. Submitting a new query
  from the header while filters are active preserves the active filters
  (spec edge case: "user changes the search query while filters are
  active").

## Removed surface

None. This feature only adds to the existing search results screen.
