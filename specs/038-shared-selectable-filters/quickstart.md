# Quickstart: Shared Collapsible Filters with Selectable Lists

Validates both user stories end-to-end. Assumes the local dev stack is already runnable per the repo's existing setup (frontend `npm run dev`, backend `npm run dev`, Firebase emulator/Firestore + Redis available as usual for this repo).

## Prerequisites

- A signed-in test user.
- For User Story 2: the test user's Discogs account linked (feature 015) with a synced library containing at least a few records with distinct genres/styles/formats (feature 016).

## User Story 1 — Search filters (collapsible + selectable lists)

1. Sign in and navigate to Search Results (with or without an active text search).
2. **Expect**: the filter component renders collapsed (compact trigger only), no active-filter badge.
3. Expand the panel. **Expect**: Genre, Style, Format render as selectable (checkbox) lists, plus Apply/Clear.
4. Open the Style list and type a few characters into its in-list search. **Expect**: the 757-value list narrows to matching entries only.
5. Select one Genre value, one Style value, and two Format values, then press Apply. **Expect**: results reload filtered, URL reflects all three selections (comma-joined `genre`/`style`/`format` params), panel stays expanded.
6. Reload the page from the URL. **Expect**: the same filter selections and results reappear (URL round-trip, `contracts/search-api.md`).
7. Collapse the panel manually. **Expect**: the collapsed trigger shows an active-filters indicator (count/summary), matching the existing Format-trigger summary pattern.
8. Press Clear. **Expect**: all three selections clear, URL returns to unfiltered, indicator disappears.
9. Resize to a mobile viewport and repeat step 3–4. **Expect**: each list opens as a full-screen modal (existing `Modal` pattern); no horizontal scroll appears anywhere on the page (`SC-005`).

## User Story 2 — Library filtering (real, persisted)

1. Navigate to My Library. **Expect**: the same filter component appears above the grid, collapsed by default.
2. Note the genre/style/format of a couple of visible records (via their release info).
3. Expand the panel, select a Genre value known to match at least one but not all visible records, press Apply. **Expect**: only matching entries show; pagination totals reflect the filtered subset, not the full library (`contracts/library-api.md`).
4. Pick a filter combination expected to match zero entries. **Expect**: the "no results for the active filters" message appears (not the empty-library message).
5. With a filter still active, navigate to page 2 (if the filtered subset has enough entries) or back to page 1. **Expect**: the same filter stays active across the page change.
6. Clear filters. **Expect**: the library returns to its normal unfiltered, paginated view.
7. **Pre-existing entry backfill**: pick a library entry added before this feature shipped (or simulate by manually clearing its `genre`/`style`/`format` fields in Firestore for a test entry). Load the library once (unfiltered) so it gets enriched at least once, then apply a filter matching its real genre/style/format. **Expect**: the entry is now included (Decision 3 write-back-on-enrichment backfill).
8. Press the existing Refresh button. **Expect**: a fresh sync/enrichment pass runs; any entry whose genre/style/format changed on discogs.com since the last load now reflects the new values in filtered results.

## Notes

- No new environment variables, seed data, or infrastructure are required beyond what features 015/016/021 already need.
- See `research.md` Decision 1 for the residual risk around Discogs' live search API and multi-value genre/style — the contract/integration test referenced there should be run as part of validating User Story 1 before considering it done.
