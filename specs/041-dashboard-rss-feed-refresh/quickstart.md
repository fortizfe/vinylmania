# Quickstart: Dashboard RSS Feed Sources Refresh

Manual/end-to-end validation guide for this feature. Assumes the app is
already runnable locally per the repo's existing setup (backend + frontend
dev servers, Firebase auth configured).

## Prerequisites

- Backend and frontend dev servers running (`npm run dev` in each, per
  existing repo conventions).
- A logged-in collector session (Dashboard route requires auth, per
  existing `requireAuth` middleware).

## 1. Metal Storm is fully retired (User Story 1)

1. Open the Dashboard.
2. Confirm no article card, source-filter label, or unavailable-source
   banner mentions "Metal Storm".
3. Confirm only one category tab is visible (`News` — see
   `spec.md` → Assumptions for why the other 4 disappear as an expected
   consequence, not a bug).
4. Confirm Metal Injection, MetalSucks, and Louder Sound articles still
   render normally.

```
grep -ri "metal storm" backend/src/feeds/feedSources.ts frontend/src -r
# Expect: no matches
```

## 2. The 5 new sources appear (User Story 2)

1. On the Dashboard, open the source filter bar.
2. Confirm labels exist for: Heavy Mag, Metal Underground, Heavy Metal
   Overload, Femme Metal, MetalTalk (non-priority — listed after Metal
   Injection / MetalSucks / Louder Sound).
3. Click each label and confirm articles render (or, if a feed happens to
   be temporarily down at test time, confirm the unavailable state renders
   instead of breaking the page — per FR-007).
4. Confirm Metal Blade Records has **no** filter label (excluded per
   `research.md` §1 — confirmed unreachable during planning).

```
curl -s -o /dev/null -w "%{http_code}\n" https://heavymag.com.au/feed/
curl -s -o /dev/null -w "%{http_code}\n" https://feeds.feedburner.com/metalunderground
curl -s -o /dev/null -w "%{http_code}\n" https://heavymetaloverload.com/feed/
curl -s -o /dev/null -w "%{http_code}\n" https://femmetal.rocks/feed/
curl -s -o /dev/null -w "%{http_code}\n" https://www.metaltalk.net/feed
# Expect: 200 for all five
```

## 3. Selecting a source shows everything it has (User Story 3)

1. Pick a lower-frequency source whose articles are known to be absent
   from the general aggregated view (i.e., it didn't make the top-10 for
   its category).
2. Click that source's filter label.
3. Confirm its real articles render — not "No news right now."
4. Click "All sources" again and confirm the original aggregated view
   returns with no leftover filter state.
5. Repeat for a source that already appears in the general view — confirm
   the same set of articles renders (no duplicates, no different
   behavior).

Direct contract check:

```
curl -s <backend-base-url>/api/feeds/sources/heavy-mag \
  -H "Authorization: Bearer <token>" | jq
# Expect: { "sourceId": "heavy-mag", "sourceName": "Heavy Mag",
#           "status": "ok" | "unavailable", "articles": [...], "generatedAt": "..." }

curl -s <backend-base-url>/api/feeds/sources/does-not-exist \
  -H "Authorization: Bearer <token>" -w "\n%{http_code}\n"
# Expect: 404, { "error": "source_not_found", ... }
```

## 4. Automated checks

```
cd backend && npm test
cd frontend && npm test
```

Both suites must pass, including:
- Updated `feedSources.test.ts` (no Metal Storm, 5 new sources present).
- Updated `feedMapper.test.ts` (Metal Storm `data-image-url` block removed).
- New/updated contract test for `GET /api/feeds/sources/:sourceId`.
- New integration test covering a source excluded from the general view's
  top-10 still returning its articles via the direct endpoint.
- Updated frontend component tests (`FeedSourceFilterBar`,
  `FeedArticleBoard`, `FeedArticleCard`, `dashboardPageFlow`) reflecting the
  new catalog and the on-demand source query behavior.

e2e (`/e2e`) is out of scope for this feature per `spec.md`/HU, but existing
e2e tests referencing Metal Storm (`dashboard-feed-grid.spec.ts`) should be
revisited separately since they will fail against the new catalog.
