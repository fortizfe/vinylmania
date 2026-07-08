# Quickstart: Master Release Grouping & Detail Pages

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/discogs-catalog-api.md](./contracts/discogs-catalog-api.md)

## Prerequisites

- Backend and frontend running locally per the repo's existing dev setup (`backend`: `npm run dev`; `frontend`: `npm run dev`), with a valid `DISCOGS_TOKEN` configured (see `backend/.env`).
- A logged-in test user with a linked Discogs account (needed to exercise "Add to library" on the release detail page — spec FR-007).
- Redis available (optional — caching degrades gracefully without it, per existing `withCache` behavior); useful for validating the TTL decisions in `research.md`.

## Scenario 1 — Grouped results appear in search (User Story 1)

1. Sign in and open `/app/search`.
2. Search for an artist known to have multiple pressings of the same album (e.g. `Linkin Park`).
3. **Expect**: at least one result card shows the stacked-covers effect (Decision 8) and no "Add to library" button; other, non-grouped results render exactly as before (SC-001, SC-002).
4. Search for a release known to have no other editions.
5. **Expect**: that result renders as a standalone card, unchanged from current behavior (FR-003).

## Scenario 2 — Standalone release → release detail page (User Story 2)

1. From the Scenario 1 search results, click a standalone (non-stacked) card.
2. **Expect**: navigation to `/app/releases/:discogsId`, showing images, artist/label credits, formats, genres/styles, tracklist, identifiers, community stats, and notes (FR-006), plus an "Add to library" button (FR-007).
3. Click "Add to library".
4. **Expect**: same success/"added" state and same not-linked/relink error handling as today's search-results Add action (FR-007, Acceptance Scenario 3).
5. Click the back link.
6. **Expect**: return to `/app/search` with the same query, filters, and page as before navigating away (FR-012, SC-006).
7. Reload the release detail page directly via its URL (simulating a bookmark).
8. **Expect**: page loads correctly; its back link now goes to `/app/search` in its default (empty) state (Clarifications, FR-012).
9. Navigate to a release id with no catalog data (e.g. an invalid/removed id).
10. **Expect**: a clear not-found message, no broken layout (FR-015, Acceptance Scenario 5).

## Scenario 3 — Grouped result → master detail page → version → release detail (User Story 3)

1. From Scenario 1's grouped result, click the stacked-covers card.
2. **Expect**: navigation to `/app/masters/:discogsId` (not a release detail page) (FR-005), showing the master's title/artists/genres/styles/images/tracklist in the same compact layout style as the release detail page (FR-008).
3. Scroll to the end of the page.
4. **Expect**: a paginated table of the master's releases, 10 rows per page, each identifying at least format and year (FR-009, FR-010).
5. If more than 10 versions exist, page forward.
6. **Expect**: the next 10 rows load without leaving the master detail page (Acceptance Scenario 4).
7. Click a row.
8. **Expect**: navigation to that release's `/app/releases/:discogsId` detail page (FR-011).
9. Click the back link on the release detail page.
10. **Expect**: return to the master detail page, on the same version-table page it was on before navigating away — not to the original search results (Acceptance Scenario 5, Edge Cases).
11. From the master detail page, click its back link.
12. **Expect**: return to `/app/search` with the original query/filters/page preserved (Acceptance Scenario 6, SC-006).

## Scenario 4 — Preview modal retirement (FR-013)

1. On `/app/search`, confirm no "Preview" quick-look control remains on any result card.
2. **Expect**: the only way to see a result's full information is via the new detail pages from Scenarios 2–3.

## Validating enrichment/caching decisions (optional, backend-focused)

1. Hit `GET /api/discogs/masters/:id` twice for the same id within 6 hours.
2. **Expect**: second call is served from cache (check Redis key `discogs:master:{id}` or logs for `outcome: cache_hit`), per research Decision 6.
3. Search for a query with several grouped (master) results and inspect the `communityRating` field on those hits.
4. **Expect**: it reflects the main/key release's rating (or is omitted if that lookup times out/fails), per research Decision 3 — never blocks the overall search response beyond the existing 2s enrichment timeout.
