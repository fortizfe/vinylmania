# Quickstart: Validating Search Result Filters

**Feature**: 021-search-result-filters

This guide validates the feature end-to-end once implemented. It assumes
the existing local dev setup for this repo (backend + frontend + Discogs
auth) is already working — this feature changes no setup/auth prerequisites.

## Prerequisites

- Backend running locally with a valid `DISCOGS_TOKEN` (see
  `backend/src/discogs/discogsClient.ts` for env var usage) and Firebase
  auth emulator/config already set up for this repo.
- Frontend running locally (`frontend/`) pointed at the local backend.
- A signed-in user session (search requires auth, unchanged from today).

## Scenario 1: Apply a single filter (spec User Story 1 / P1)

1. Sign in and search for a broad term, e.g. `nirvana`, from the header
   search box. Confirm results load on `/app/search?q=nirvana`.
2. Locate the filter control on the results screen. Confirm four empty
   fields are shown: Artist, Genre, Style, Format.
3. Enter `Rock` into the Genre field and select "Apply filters".
4. **Expected**: the URL updates to include `genre=Rock` (and resets
   `page` to `1` if it was elsewhere); the results list refreshes to show
   only records matching both the query and the genre filter.

## Scenario 2: Combine multiple filters (spec User Story 2 / P2)

1. From the state above, also enter `Vinyl` into the Format field and
   select "Apply filters" again.
2. **Expected**: the URL now includes both `genre=Rock` and
   `format=Vinyl`; results reflect the intersection of both filters.
3. Clear only the Format field and select "Apply filters".
4. **Expected**: results revert to matching just the Genre filter; the
   `format` param is removed from the URL.

## Scenario 3: Pagination, reload, and clearing filters (spec User Story 3 / P3)

1. With one or more filters applied and multiple result pages available,
   click "Next page".
2. **Expected**: the same filters remain applied on the new page (URL
   still carries the filter params alongside the incremented `page`).
3. Copy the current URL (with filters and page applied) and open it in a
   new tab/reload.
4. **Expected**: the same filtered result set (same page, same filters)
   loads identically.
5. Select "Clear filters".
6. **Expected**: all four fields reset to empty, the URL drops all filter
   params, and results revert to the plain query-only result set.

## Scenario 4: No matches under active filters (spec edge case / FR-008)

1. Apply a filter combination unlikely to match anything for the current
   query (e.g. an implausible Style value).
2. **Expected**: a "no results" message is shown that acknowledges active
   filters (not the plain no-query-results message), with a way to adjust
   or clear filters.

## Automated coverage checklist

- Backend contract test (`backend/tests/contract/discogsSearch.contract.test.ts`):
  forwards `artist`/`genre`/`style`/`format` to the Discogs request when
  present; omits them when absent/blank; trims whitespace.
- Frontend unit tests: `SearchFiltersControl` renders four fields, Apply
  commits trimmed values, Clear resets all fields; `useSearchQueryParams`
  parses/builds the four new params.
- Frontend integration test (`searchResultsFlow.test.tsx`): applying a
  filter re-runs `useCatalogSearch` with the expected arguments; pagination
  preserves filters; clearing filters removes them.
- E2E spec (`e2e/tests/search-result-filters.spec.ts`): scenarios 1–4 above
  driven through the real UI.

## Out of scope for this quickstart

- The "artist" result-type search path (spec Assumptions: only `release`-type
  results are in scope).
- Any dropdown/autocomplete UI — all four filter fields are plain free-text
  inputs (see `spec.md` → Clarifications).
