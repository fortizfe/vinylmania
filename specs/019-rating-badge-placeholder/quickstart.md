# Quickstart: Validating the Placeholder Rating Badge

This feature is frontend-only, extending the feature-017 rating badge. Validation should confirm both the still-unchanged "rated" appearance and the new "unrated" placeholder appearance, on both card surfaces.

## Prerequisites

- Frontend dependencies installed in `frontend/`
- E2E dependencies installed in `e2e/`
- Local environment configured so authenticated search and library flows work
- Reference model: [data-model.md](./data-model.md)

## Run the app locally

```bash
cd frontend
npm run dev
```

Backend is unchanged by this feature; run it only if needed to serve real search/library data:

```bash
cd backend
npm run dev
```

## Manual validation scenarios

### 1. Search-result cards show the placeholder for unrated/errored releases

1. Sign in and open the add-record flow at `/app/library/add`.
2. Search for a query that returns a mix of rated and unrated releases (or stub a result with no `communityRating`).
3. Confirm every result card shows a badge in the thumbnail's upper-right corner — none are empty.
4. Confirm unrated/errored cards show `-` on a soft gray background, in the same size/shape/position as a rated badge.
5. Confirm rated cards are unchanged: numeric value on the existing red/yellow/green band.

### 2. Library cards show the placeholder for releases with no community rating

1. Open `/app/library` with at least one entry whose release has no `community.rating` data.
2. Confirm that card's badge shows `-` on a soft gray background instead of an empty thumbnail corner.
3. Confirm entries with a valid rating are unchanged.
4. Confirm unavailable catalog entries (`catalogStatus === 'unavailable'`) still show their existing fallback card with no badge at all — this feature does not add a badge to that fallback state.

### 3. Placeholder contrast and distinguishability

1. Render one card in the `unrated` state and inspect the rendered `-` text against its gray background, in both light and dark mode.
2. Confirm the pairing meets at least 4.5:1 contrast (FR-005) — see [data-model.md](./data-model.md) band-mapping table for the exact tokens and computed ratios.
3. Confirm the gray background is visually distinguishable from the existing red/amber/green band colors (FR-003, SC-002).

### 4. Accessibility label

1. Using a screen reader or the accessibility tree inspector, confirm an unrated/errored badge announces "Rating not available" rather than "Rating - out of 5".

### 5. No layout shift or interaction regressions

1. Resize from desktop to mobile width; confirm placeholder badges stay contained inside the thumbnail zone like rated badges do.
2. In search results, use "Add to library" and "Preview details" on cards showing the placeholder and confirm behavior is unchanged.
3. In the library, open a record from a card showing the placeholder and confirm the click target still works.

## Automated validation

```bash
# Frontend unit tests
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

- Frontend unit coverage verifies:
  - `presentRating` never returns `null`; it returns the `unrated` presentation for missing/invalid/zero-count ratings
  - `ReleaseRatingBadge` renders `-` on the gray background token for the `unrated` band
  - WCAG AA contrast (≥4.5:1) for the new `unrated` token pairing, alongside the existing low/medium/high assertions
  - the `unrated` band's distinct `Rating not available` accessible label
- Frontend e2e coverage extends the existing feature-017 rating describe blocks in `caching-navigation.spec.ts` and `library-discogs-sync.spec.ts` to assert the placeholder badge is visible (not absent) for an unrated search result and an unrated library entry.

## Out of scope for this quickstart

- No backend or API contract changes
- No changes to the record detail page's existing rating display
- No sorting/filtering by rating
- No changes to the "unavailable catalog entry" fallback card (still badge-free)
