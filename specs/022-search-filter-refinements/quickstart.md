# Quickstart: Validating Search Filter Refinements

**Feature**: 022-search-filter-refinements

This guide validates the feature end-to-end once implemented, building directly
on top of feature 021's already-working filter control. It assumes the same
local dev setup (backend + frontend + Discogs auth) already works.

## Prerequisites

- Same as `specs/021-search-result-filters/quickstart.md`: backend running with a
  valid `DISCOGS_TOKEN`, frontend pointed at the local backend, signed-in user
  session.
- Feature 021 already implemented and merged (this feature refines its filter
  control, it does not stand alone).

## Scenario 1: Format multi-select, AND semantics (spec User Story 1 / P1)

1. Sign in and search for a broad term, e.g. `nirvana`. Confirm results load on
   `/app/search?q=nirvana`.
2. Locate the filter control. Confirm it shows **Genre**, **Style**, and a
   **Format** trigger button (no Artist field) — see
   `contracts/search-results-filter-ui.md`.
3. Click the Format trigger. Confirm a modal opens listing the fixed set of ~33
   format names (Vinyl, CD, Cassette, ...), none checked.
4. Check "Vinyl" only, close the modal, click "Apply filters".
5. **Expected**: URL updates to include `format=Vinyl`; results only include
   releases matching that format.
6. Reopen the Format modal, also check "CD", close, click "Apply filters" again.
7. **Expected**: URL now shows `format=Vinyl,CD`; results narrow further, to
   releases available in *both* Vinyl and CD simultaneously (verified against
   live Discogs data during implementation, feature 022 T014 — this is AND
   matching, not OR; selecting more formats narrows results rather than
   widening them).
8. Uncheck both formats and click "Apply filters".
9. **Expected**: the `format` param is removed from the URL; results revert to
   matching only the still-active Genre/Style filters (or the plain query if
   none are active).

## Scenario 2: Artist filter is gone (spec User Story 2 / P2)

1. On the results screen, confirm the filter control never renders an Artist
   field, regardless of URL state.
2. Manually navigate to a URL that includes an obsolete `artist` parameter, e.g.
   `/app/search?q=nirvana&artist=Nirvana&genre=Rock`.
3. **Expected**: the page loads normally, no error is shown, the `genre=Rock`
   filter is still applied and shown as active, and the (ignored) `artist` value
   has no effect on results or on what's displayed as active.

## Scenario 3: Obsolete format value in an old link (spec Edge Case / FR-010)

1. Navigate to a URL with a mix of valid and invalid format values, e.g.
   `/app/search?q=nirvana&format=Vinyl,NotARealFormat`.
2. **Expected**: the page loads normally, no error is shown, "Vinyl" is shown as
   the only active/checked format (the unrecognized value is dropped), and
   results reflect only the Vinyl filter.

## Scenario 4: Selecting every format value (spec Edge Case)

1. Open the Format modal and check every listed value, then apply.
2. **Expected**: results narrow to releases simultaneously available in ALL
   ~33 formats at once (AND matching) — in practice this yields very few or
   zero results, behaving like an overly restrictive filter rather than like
   no filter at all. This is expected behavior, not a bug.

## Automated coverage checklist

- Backend contract test (`backend/tests/contract/discogsSearch.contract.test.ts`):
  `artist` param is never forwarded to Discogs even if present on the incoming
  request; a comma-joined `format` value is forwarded verbatim in one request
  (see `contracts/discogs-search-filters-api.md`).
- Frontend unit tests: `SearchFiltersControl` has no Artist field and renders a
  Format trigger + modal checklist (`SearchFiltersControl.test.tsx`); new
  `Checkbox` atom renders label and toggles state (`Checkbox.test.tsx`);
  `useSearchQueryParams` parses/builds comma-joined `format` arrays and drops
  values outside `FORMAT_OPTIONS`, and no longer recognizes `artist` at all
  (`useSearchQueryParams.test.tsx`).
- Frontend integration test (`searchResultsFlow.test.tsx`): multi-format
  selection re-runs `useCatalogSearch` with the expected comma-joined value;
  obsolete `artist`/invalid-format URL params load without error and don't
  appear as active filters.
- E2E spec (`e2e/tests/search-result-filters.spec.ts`): scenarios 1–2 above
  driven through the real UI (Scenarios 3–4 covered at the integration-test
  level, per the existing project convention of reserving e2e for the primary
  user-facing flows).

## Out of scope for this quickstart

- Any change to Genre/Style behavior (unchanged from feature 021).
- Per-format result counts (spec Assumptions: explicitly out of scope).
- Validating Discogs' actual comma-joined `format` matching behavior against
  live data beyond what the contract/integration tests stub — see `research.md`
  for the documented fallback if that assumption doesn't hold in production.
