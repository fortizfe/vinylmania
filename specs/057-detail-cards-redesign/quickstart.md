# Quickstart: Validating the Detail Screens Card-Based Redesign

## Prerequisites

- `frontend/` dependencies installed (`npm install` in `frontend/`)
- A local dev environment able to reach the app's backend (or existing mocked/test data), per the project's standard `frontend` dev setup
- A library record and a master release you can navigate to (an existing seeded/test account works)

## Automated validation

Run from the repo root unless noted:

```bash
# Unit + integration tests for the three detail pages
cd frontend && npm test -- ReleaseDetailPage MasterReleaseDetailPage recordDetailFlow

# Full frontend unit/integration suite (regression check)
cd frontend && npm test

# e2e specs covering these screens (see plan.md Project Structure for the full list)
npx playwright test e2e/tests/record-detail-inline-edit.spec.ts \
  e2e/tests/record-detail-responsive.spec.ts \
  e2e/tests/release-detail.spec.ts \
  e2e/tests/release-detail-responsive.spec.ts \
  e2e/tests/master-release-detail-responsive.spec.ts
```

All of the above MUST pass before this feature is considered done (spec SC-002).

## Manual validation scenarios

1. **Library record (US1)** — Navigate to a library record's detail page (`/app/library/records/:entryId`).
   - Confirm gallery, main info, "your copy," tracklist, and (if the release has notes/identifiers/community data) "other details" each render as separate, lightly-bordered cards with a visibly tighter gap than the app's other multi-section pages.
   - Edit rating, media condition, sleeve condition, and notes inside the "your copy" card; confirm each save works exactly as before.
   - Remove the record from the library; confirm the existing confirmation + navigation behavior is unchanged.

2. **Master release (US2)** — Navigate to a master release's detail page (`/app/masters/:discogsId`).
   - Confirm gallery, main info (title/artist), other details (year/genres/styles + "View on Discogs" link), tracklist, and versions-list each render as separate cards.
   - Click the "View on Discogs" link; confirm it opens the master's Discogs page in a new tab.
   - Page through the versions list (if more than one page exists); confirm pagination behaves as before, and the mobile per-row cards use the same lighter card treatment as the rest of the page.

3. **Catalog release preview (US3)** — Navigate to a catalog release not yet in your library (`/app/releases/:discogsId`, e.g. via search results).
   - Confirm no "your copy" card is shown, and "Add to library" appears inside the main info card.
   - Add the release to the library; confirm the action completes as before and the page reflects the addition per existing behavior.

4. **Empty-data edge cases** — Find or construct a release with no Discogs notes/identifiers/community data, and a master with no year/genres/styles.
   - Confirm the "other details" card is entirely absent in each case (not rendered empty).

5. **Responsive + theme check** — For each of the three pages above:
   - Resize to a mobile viewport width; confirm cards stack in a single column with compact spacing and no horizontal scrolling, and every interactive control still meets the 44×44px touch target.
   - Toggle dark mode; confirm card boundaries remain visually distinguishable from the page background.

## Expected outcome

- Every scenario above renders correctly with no console errors, no layout overlap/clipping, and no regression in any existing interaction (spec SC-001–SC-004).
- The overall look matches the "subtle, lightly separated" card intent from the spec, confirmed against SC-005 in a design review with the requester before closing out this feature.
