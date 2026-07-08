# Quickstart: Music News Dashboard (RSS Feed Hub MVP)

Validation guide for proving the feature works end-to-end once implemented. See [contracts/feeds-dashboard.md](./contracts/feeds-dashboard.md) for the API shape and [data-model.md](./data-model.md) for entity details.

## Prerequisites

- Backend and frontend dependencies installed (`npm install` in `backend/` and `frontend/`), including the new `rss-parser` dependency added to `backend/package.json`.
- Local Redis running (or `REDIS_URL` unset — the app already degrades to a no-cache passthrough per `cacheAside.ts`, so Redis is optional for a smoke test but recommended to validate the ~20 min TTL behavior).
- A logged-in Vinylmania session (the Dashboard route requires authentication, same as `/app/library`).

## Backend validation

1. Start the backend: `cd backend && npm run dev`.
2. Confirm the new route responds (replace `<ID_TOKEN>` with a valid Firebase ID token from a logged-in session, same as used against `/api/discogs/search`):
   ```bash
   curl -H "Authorization: Bearer <ID_TOKEN>" http://localhost:<port>/api/feeds/dashboard
   ```
3. Expected: HTTP 200, JSON body matching the contract, with a `categories` array containing at least a `"News"` category populated from Metal Injection.
4. Simulate Metal Storm being unreachable (it may already be, per research.md §3) and confirm:
   - The response still returns 200 with Metal Injection's categories present.
   - `sourceStatuses` includes an entry for Metal Storm sources with `"status": "unavailable"`.
   - No 500 error and no empty/broken response — this proves FR-007's graceful degradation.
5. Run the automated suite: `npm test` — should include `feedMapper.test.ts` (plain-text/image extraction, malformed-item dropping), `feedAggregator.test.ts` (parallel fetch, per-source failure isolation, top 3-5 cap, empty-category omission), and `feedsDashboard.contract.test.ts` / `feedsDashboard.integration.test.ts` (nock-mocked end-to-end route behavior).

## Frontend validation

1. Start the frontend: `cd frontend && npm run dev`, log in, and navigate to `/app` (the existing header logo already links here).
2. Expected: the former "Under construction" placeholder is replaced by categorized sections (e.g. "News", and "Reviews"/"Interviews"/"Tour Dates" when Metal Storm is reachable), each showing up to 5 article cards with an image (or placeholder graphic when the source had none), title, source name, and publish date.
3. Click an article card: it MUST open the original article on the source's own site in a new tab (verify `target="_blank" rel="noopener noreferrer"` and that Vinylmania does not render the full article body itself).
4. Use the category filter control: selecting one category MUST hide all others; clearing it MUST restore the full view (User Story 3).
5. Throttle/disable network to a source (or use a dev-mode mock returning a failed source) and confirm a non-blocking banner/notice appears for the unavailable source while the rest of the page still renders (User Story 1, Acceptance Scenario 4).
6. Run the automated suite: `npm test` — should include component tests for `FeedArticleCard`/`FeedCategoryFilterBar` and an integration test for `DashboardPage` (loading state → populated state → degraded-source state).

## Success criteria mapping

- **SC-001** (content visible within 3s): time the initial `/app` navigation-to-render in the browser's network panel against a warm cache.
- **SC-002** (95% of loads show all healthy sources): exercised structurally by the integration test's per-source-failure-isolation case; not something to manually re-derive per load.
- **SC-004** (categories visually distinguishable at a glance): visually confirm in step 2 above — category headers must be legible without opening any article.
- **SC-005** (one click to original article): confirmed in frontend validation step 3.
