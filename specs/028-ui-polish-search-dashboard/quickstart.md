# Quickstart: UI Polish – Search Results & Dashboard Cards

Manual + automated validation steps for the four changes in this feature.
Assumes the local dev environment is already set up (`frontend/` deps
installed, backend running or mocked per existing project conventions).

## Prerequisites

```bash
cd frontend && npm install   # if not already installed
```

## Run automated checks

```bash
cd frontend
npm test                     # Vitest unit/component tests
npm run lint                 # oxlint
```

```bash
cd e2e
npx playwright test search-result-filters.spec.ts dashboard-feed-carousel.spec.ts
```

## Manual validation scenarios

Start the app (`npm run dev` in `frontend/`, backend per project convention),
then in a browser:

### 1. Search batch size (FR-001, FR-009, SC-001)

1. Search for a common term (e.g., "Beatles") that returns 40+ results.
2. Open browser devtools → Network tab, filter to the search request.
3. Confirm the initial request's page-size parameter is `40` and the response
   contains up to 40 results before any scroll.
4. Scroll to the bottom of the loaded results; confirm the next network
   request also requests 40 and results are appended (masters-first ordering
   preserved, no duplicates).
5. Search a rare term returning < 40 total results; confirm all results
   render with no errors and no empty placeholder cards.

### 2. Fixed-height search result cards + "Multiple editions" label (FR-002, FR-002a, FR-003)

1. Search a term that returns a mix of master and release results (grouped
   search, per feature 026/027).
2. Visually confirm every card in the grid — across all rows, not just within
   one row — renders at the same height.
3. Confirm master cards show a "Multiple editions" label where release cards
   show a format badge + add-to-library button.
4. Resize the browser (or use devtools responsive mode) across mobile/tablet/
   desktop breakpoints; confirm all cards remain equal height at each size
   (the height value may change between breakpoints, but stays uniform within
   one).

### 3. Enhanced stacked-covers effect (FR-004, FR-005, FR-006, SC-003)

1. On the same mixed results grid, glance at the page for ~2 seconds.
2. Confirm master (grouped) cards are immediately distinguishable from
   release cards via the stacked-covers visual effect, without zooming in.
3. Confirm release cards never show the stacked-covers effect.
4. Confirm the effect isn't clipped by the card's fixed-height boundary from
   scenario 2.

### 4. Fixed-height RSS dashboard cards (FR-007, FR-008, SC-004)

1. Navigate to the dashboard and locate a feed carousel with articles of
   varying title/excerpt lengths.
2. Confirm all article cards in the carousel render at the same height.
3. Find (or note) an article with a long title/excerpt; confirm it's
   truncated to 2 lines (title) and 2 lines (excerpt) with an ellipsis,
   rather than growing the card.
4. Find (or note) an article with a short title and no excerpt; confirm its
   card still matches the height of longer-content cards (no visible
   shrinking).

## Expected outcome

All four scenarios pass visually and via the extended automated test suites,
with no regressions to existing search ordering, infinite scroll, or
add-to-library interactions (SC-005).
