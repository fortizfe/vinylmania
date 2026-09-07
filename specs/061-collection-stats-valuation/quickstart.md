# Quickstart: Mi colección en cifras

Validation guide for feature 061. Assumes the monorepo is set up per the root `README.md`
(Node, backend `.env` with Discogs consumer credentials + Firebase emulator config,
frontend `.env` pointing at the local backend, Redis reachable or intentionally absent).

## Prerequisites

- Backend deps installed, Firebase emulator + Redis running (`docker-compose up`), backend on `:8080`.
- Frontend on `:5173`.
- A test user signed in with a **linked Discogs account** whose Discogs collection has a
  spread of releases (varied years, genres, styles, labels, artists; several with a
  recorded Media Condition; at least one release with no marketplace data).
- For the valuation: the linked Discogs account has **seller settings configured**
  (otherwise Block 2 correctly shows the seller-settings notice — itself a scenario below).

## Backend checks

```bash
cd backend
npm test -- collectionStats          # pure aggregators + use cases + routes
npm run lint && npm run typecheck
```

Expected: `aggregateStatistics` and `computeValuation` unit suites green (decade/unknown-year,
multi-valued facet counting, "Various Artists" exclusion, per-period + cumulative growth,
top-N + "Otros", missing-condition exclusion, no-market-data exclusion, currency pick-up,
multi-instance valuation); route integration tests green for the link gate, the
`refresh` path, the chunked cursor loop, and `seller_settings_required`.

## API smoke (with a valid session cookie/header in `$AUTH`)

```bash
# Block 1 — no Discogs catalog/marketplace call is made
curl -s -H "$AUTH" localhost:8080/api/collection-stats/statistics | jq '{totalRecords, decades: .byDecade.buckets, topArtist: .mostPresentArtist, growthTail: .growth.points[-1]}'

# Block 2 — first chunk, then follow nextCursor until status != "partial"
curl -s -H "$AUTH" "localhost:8080/api/collection-stats/valuation?cursor=0" | jq '{status, nextCursor, valuation: {currency, estimatedTotal, coveredCount, totalCount}}'
```

Expected:
- `/statistics` returns immediately; backend logs show **no** `route:"…discogs.com/releases…"` catalog fetch and no `price_suggestions` call for this endpoint.
- `/valuation?cursor=0` returns `status:"partial"` with a `nextCursor`; repeating with the cursor eventually returns `status:"complete"` and a `perDisc` array. A second full run within 7 days reports `fromCacheThisBatch == pricedThisBatch` on every chunk (SC-005).
- `coveredCount + uncovered.noMarketData + uncovered.noCondition == totalCount` on the complete page.

## Frontend / UX checks (`localhost:5173/app/stats`)

1. **Nav** — "Collection stats" appears in the header (desktop icon + label) and the hamburger menu, at the same level as "My library" / "My wishlist" (FR-001, SC scenarios).
2. **Unlinked account** — sign in as a user with no Discogs link → the page shows only the link-account card (reused `LibraryLinkRequired`, `context:'stats'`), no stats, no valuation (FR-002, SC-008).
3. **Block 1** — with a linked, populated account: total record count; decade / genre / style / label breakdowns ordered by count, each long list showing ~12 rows + an expandable "Otros (N)"; most-present artist + top list (no "Various Artists" row); growth chart with a working per-period ⇄ cumulative toggle. Verify the chart exposes a visually-hidden data table and an `aria-label` summary; tab to the toggle and operate it by keyboard; check focus ring visibility and 4.5:1 contrast; set OS "reduce motion" and reload — no count-up / bar-grow animation.
4. **Block 1 timing** — for a ~300-record collection the statistics render in well under 2 s with no spinner after the library data is present (SC-002).
5. **Block 2 progressive** — on opening the section the valuation starts on its own (no button); the total and "estimado sobre X de Y" update over successive chunks with a polite live-region announcement; the statistics block stays fully interactive throughout (FR-020, FR-023).
6. **Block 2 coverage** — with a collection containing a release with no market data and a copy with no condition: the total excludes both and the label reads e.g. "estimado sobre 42 de 50 discos" (FR-016, FR-017, FR-018, SC-004). "Most valuable records" highlights render; "Ver todos" opens the full per-disc breakdown dialog (FR-015).
7. **Currency** — every monetary figure (total, highlights, breakdown) shows the same currency, matching the linked account's Discogs seller currency (FR-019, SC-007).
8. **Seller settings missing** — sign in as the account without seller settings → Block 1 works; Block 2 shows the "complete your Discogs seller settings" notice, not an error (plan.md deviation 1).
9. **Discogs down** — with the Discogs stub returning 503 for `price_suggestions`: Block 1 still renders; Block 2 shows a non-blocking "couldn't estimate value right now" message with retry; no error page (FR-025, SC-009).
10. **Re-open within cache window** — leave and return to `/app/stats`; the valuation completes with no new price-suggestion calls in the backend log (SC-005).

## E2E

```bash
cd e2e
npx playwright test collection-stats
```

Covers: nav presence, unlinked gate, Block 1 breakdowns from seeded `basic_information`,
growth chart data table, progressive valuation reaching "complete", coverage label with a
data-less release, and the seller-settings notice — all against the hermetic Discogs stub
(`/marketplace/price_suggestions/:releaseId` + enriched collection `basic_information`).

## Definition of done

- [ ] All spec FRs exercised by an automated test (see `tasks.md` traceability).
- [ ] `npm test`, `lint`, `typecheck` green in `backend/` and `frontend/`; `e2e` green.
- [ ] Constitution re-check in `plan.md` still PASS after implementation.
- [ ] Backend logs confirm Block 1 makes zero Discogs requests and Block 2 respects the shared throttle/breaker.
- [ ] WCAG 2.1 AA pass on `/app/stats` (keyboard, contrast, chart alt-representation, reduced-motion); `apple-design` review of the chart + progressive-count motion.
