# Quickstart: Validating Vinyl Search Results

This guide validates the feature once implemented, per
[spec.md](./spec.md), [data-model.md](./data-model.md), and
[contracts/discogs-api.md](./contracts/discogs-api.md).

## Prerequisites

- `backend/.env` configured with a real `DISCOGS_TOKEN` (see
  `specs/002-discogs-api-client/quickstart.md` if not already set up)
- Both apps running locally: `cd backend && npm run dev`,
  `cd frontend && npm run dev` (see root `README.md`)
- A signed-in test user (see `specs/001-landing-google-login/quickstart.md`)

## Automated validation

```bash
cd backend && npm test    # contract tests for /api/discogs/search and /api/discogs/releases/:id
cd frontend && npm test   # unit tests for Modal/SearchResultCard/ResultCardActions + updated integration test
```

**Expected outcome**: All suites pass, including the updated
`addRecordFlow.test.tsx` (now asserting card-grid rendering and no
auto-navigation after add) and new unit tests for the three new components.

## Manual validation scenarios

### 1. Cards show the right information (User Story 1 / SC-001)

1. Sign in, go to "Add a record", and search for a common artist (e.g.
   "Miles Davis").
2. Confirm each result renders as a card with a cover thumbnail (or
   placeholder), title, artist, and year.
3. Confirm a result with a known format shows it as a secondary detail on the
   card without crowding the title/artist/year.

### 2. Add and preview actions work independently (User Story 2 / SC-002, SC-003)

1. On a result card, click the preview action. Confirm an overlay opens
   showing the release's fuller details (artists, tracklist if available,
   cover) without navigating away from the search results.
2. Close the overlay and confirm you're back on the same results/page you
   were viewing.
3. On a (different) result card, click the add action. Confirm:
   - The card shows a busy state while the request is in flight.
   - Once it succeeds, the card shows an "added" confirmation and you remain
     on the search results (no navigation to the library).
4. Navigate to the library yourself and confirm the added record is there.

### 3. Pagination avoids long scrolling (User Story 3 / SC-004)

1. Search for a very common term (e.g. "love") likely to return far more
   than 20 results.
2. Confirm only the first page's cards render, with pagination controls to
   move to subsequent pages.
3. Move to page 2 and confirm new cards load without a full browser reload
   and without needing to re-type the search.
4. Run a new search and confirm pagination resets to page 1.

### 4. Space usage (SC-005)

1. Compare the results grid at a narrow (mobile-width) viewport vs. a wide
   (desktop-width) viewport.
2. Confirm visibly more cards per row appear at the wider viewport, and that
   every card remains fully readable (no cut-off text/overlapping actions) at
   the narrow one.

### 5. Contract checks

```bash
# Pagination pass-through
curl -s "http://localhost:3001/api/discogs/search?q=love&type=release&page=2&perPage=10" \
  -H "Authorization: Bearer <idToken>" | jq '.pagination'
# Expected: {"page":2, ...} with perPage reflecting 10

# Preview endpoint
curl -s "http://localhost:3001/api/discogs/releases/<a-known-discogs-release-id>" \
  -H "Authorization: Bearer <idToken>" | jq '.title, .artists'
```

## Rollback

All changes are additive (new fields/routes/components) except the removed
post-add navigation in `AddRecordPage`. Reverting the corresponding commits
restores today's plain-list, auto-navigating behavior with no backend impact
beyond the two changed endpoints.
