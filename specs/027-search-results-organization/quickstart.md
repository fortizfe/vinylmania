# Quickstart: Validating Search Results Organization

## Prerequisites

- Backend and frontend dev servers running locally (see repo root `README.md` for standard `npm run dev` setup in `backend/` and `frontend/`), authenticated as a test user with a valid session.
- A search term known to return both master and release results in reasonable volume (e.g., a prolific artist name) so pagination/infinite-scroll behavior and master/release mixing are both observable in one session.

## Scenario 1 — Sticky header (User Story 1)

1. Navigate to any page with content taller than the viewport (e.g., `/app/search?q=<term>` after searching, or `/app/library`).
2. Scroll down.
3. **Expect**: the header (logo, search box, nav icons, hamburger menu, sign-out button) stays pinned to the top of the viewport and remains clickable; page content scrolls underneath it without ever being hidden behind it.
4. Open any modal from a page that has one (e.g., an edit dialog) while scrolled down.
5. **Expect**: the modal overlay still renders above the sticky header (header does not float over the modal).

## Scenario 2 — Infinite scroll (User Story 2)

1. Search for a term that returns more than 20 results.
2. **Expect**: on load, enough results appear to fill the visible viewport (more than one batch of 20 may load automatically if the viewport is tall) — no "Previous"/"Next" buttons are present anywhere on the page.
3. Scroll down toward the bottom of the currently loaded cards.
4. **Expect**: a loading indicator appears briefly and a further batch of results is appended automatically, without any click.
5. Keep scrolling until the search term's results are exhausted.
6. **Expect**: a clear "no more results" indicator appears; scrolling further does nothing.
7. While a batch is loading, use devtools to throttle/drop the network request for the next batch (or search a term guaranteed to error) and confirm an error message with a retry option is shown, and that previously loaded cards remain visible.
8. Change the search query or apply a filter while scrolled partway down.
9. **Expect**: the result list resets and infinite scroll restarts from the first batch of the new search.

## Scenario 3 — Masters first, no format badge (User Story 3)

1. Search a term whose results include both master and release entries (verify via the existing stacked-cover visual, which already distinguishes masters).
2. **Expect**: within the first loaded batch (and each subsequently loaded batch), every master card appears before every release card.
3. **Expect**: master cards do not show a format badge (e.g., "Vinyl", "LP") anywhere on the card.
4. **Expect**: release (non-master) cards continue to show their format badge exactly as before.
5. Search a term that returns only release results (no masters).
6. **Expect**: results appear in their existing (unchanged) order — no visible reordering effect when there are no masters.

## Automated coverage (see tasks.md for full breakdown)

- `frontend/tests/components/AppHeader.test.tsx` — asserts sticky positioning classes.
- `frontend/tests/pages/SearchResultsPage.test.tsx` — asserts scroll-triggered fetch-more behavior, loading/end-of-results indicators, no pagination buttons, and query/filter-change reset.
- `frontend/tests/components/SearchResultCard.test.tsx` — asserts no format badge when `resultType === 'master'`, badge still present otherwise.
- `backend/tests/routes/discogs.search.test.ts` — asserts a mixed master/release Discogs response is re-ordered masters-first before being returned, and an all-release response is unchanged.
- `e2e/tests/search-result-filters.spec.ts` (or a new sibling spec) — end-to-end scroll-triggered loading and sticky header across a real browser session.
