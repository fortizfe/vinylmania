# Quickstart: Validating Record Rating Badges on Search and Library Cards

This feature spans the Discogs search API contract and two frontend card surfaces. Validation should confirm both the additive search enrichment and the visible badge behavior.

## Prerequisites

- Backend dependencies installed in `backend/`
- Frontend dependencies installed in `frontend/`
- E2E dependencies installed in `e2e/`
- Local environment configured so authenticated search and library flows work
- Reference contracts and models available:
  - [contracts/discogs-search-rating-api.md](./contracts/discogs-search-rating-api.md)
  - [data-model.md](./data-model.md)

## Run the app locally

In separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

## Manual validation scenarios

### 1. Search-result cards show enriched rating badges

1. Sign in.
2. Open the add-record flow at `/app/library/add`.
3. Search for a query likely to return multiple rated releases.
4. Confirm cards with a valid community rating show a rounded-square badge in the thumbnail's upper-right corner.
5. Confirm the badge does not push the title, artist, year, format, or add/preview controls.
6. Confirm at least one low-, medium-, and high-rated card use the correct red, yellow, and green banding.

### 2. Search results degrade gracefully when a rating is unavailable

1. Use a result with no valid rating data, or a stubbed scenario where rating enrichment is omitted or fails.
2. Confirm the card still renders normally but without a badge.
3. Confirm the full search page still loads and remains interactive.
4. Using a stubbed per-release rating lookup that never resolves, confirm the affected result still returns within the 2-second budget (SC-006) without a badge, and does not block or delay the rest of the search response.

### 2b. Badge contrast meets WCAG AA

1. Render one card per band (red/yellow/green) and inspect the rendered badge text/background pairing.
2. Confirm each pairing meets at least 4.5:1 contrast (FR-013) — see [data-model.md](./data-model.md) band-mapping table for the exact tokens and computed ratios.

### 3. Library cards reuse existing rating data

1. Open `/app/library` with entries whose releases have community ratings.
2. Confirm library cards show the same style of badge in the same relative placement.
3. Confirm unavailable catalog entries still show the existing fallback card with no badge.

### 4. Responsive and interaction safety

1. Resize from desktop to mobile width.
2. Confirm badges stay contained inside the thumbnail zone and do not overlap text.
3. In search results, use both "Add to library" and "Preview details" on cards with badges and confirm behavior is unchanged.
4. In the library, open a record from a card with a badge and confirm the click target still works.

## Automated validation

```bash
# Backend contract/integration tests
cd backend
npm test
```

```bash
# Frontend unit/integration tests
cd frontend
npm test
```

```bash
# Frontend build/type validation
cd frontend
npm run build
```

```bash
# Browser-level flow validation
cd e2e
npm test
```

## Expected automated coverage

- Backend contract coverage for `GET /api/discogs/search` verifies the additive `communityRating` field and the unchanged error contract.
- Backend integration coverage verifies that partial rating enrichment omission — including a lookup exceeding the 2-second timeout (SC-006) — does not break a successful search response.
- Frontend unit coverage verifies:
  - band thresholds and one-decimal display formatting
  - badge omission for missing/invalid/unrated data
  - badge presence on both `SearchResultCard` and `RecordCard`
  - WCAG AA contrast (≥4.5:1) for each band's text/background pairing (FR-013)
- Frontend integration/e2e coverage verifies the badge is visible in real browsing flows and does not break add/preview/open-record interactions.

## Out of scope for this quickstart

- No database migrations or new persisted entities
- No rating editing workflow changes
- No sorting/filtering by rating