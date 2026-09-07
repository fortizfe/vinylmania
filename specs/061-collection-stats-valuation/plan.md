# Implementation Plan: Mi colección en cifras — Collection Stats & Estimated Market Value

**Branch**: `061-collection-stats-valuation` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/061-collection-stats-valuation/spec.md`

## Summary

A new authenticated section, **"Mi colección en cifras"**, with two blocks.

**Block 1 — Collection statistics.** Totals and breakdowns (by decade, genre, style, label, most-present artist, and growth over time) computed with **zero new Discogs requests**. The key enabler: the library's collection sync already walks every page of `GET /users/{username}/collection/folders/0/releases`, whose `basic_information` object carries each release's `year`, `labels`, `artists` (and `genres`/`styles`) — the adapter simply doesn't map them today. The sync is extended to map those facets and persist `year` / `label` / `primaryArtist` onto each Firestore `LibraryEntry` (exactly the write-back pattern feature 038 already uses for `genre`/`style`/`format`), and to reconcile each entry's `addedAt` from the instance `date_added` so records added on discogs.com are dated correctly. A pure domain aggregator turns the persisted entries into the statistics payload.

**Block 2 — Estimated market value.** For each owned copy, `GET /marketplace/price_suggestions/{release_id}` (OAuth-signed, returns a value per condition grade **in the user's Discogs seller currency**) is cross-referenced with the copy's real `mediaCondition` (from the collection instance, feature 016) to produce a per-disc estimate; the covered estimates are summed. Price suggestions are cached in Redis with a **7-day TTL** (far longer than the catalog's minutes-scale cache) and fetched through the **existing** resilience machinery (shared circuit breaker + preventive throttle + retry/backoff from specs 029/040). Computation is **progressive and unbounded**: the frontend calls a chunked valuation endpoint in a loop, each call pricing the next batch of not-yet-cached releases and returning updated running totals, so the screen never blocks and a huge collection just takes several rounds (partial results persist in the cache across navigation).

Technically this is a new `collectionStats` slice plus one new Discogs adapter (`discogsMarketplaceAdapter`), following the hexagonal split and the resilience-reuse precedent set by feature 060's wantlist adapter. Frontend adds one route/page, a nav entry, an inline-SVG growth chart (no charting library), and the valuation UI.

## Technical Context

**Language/Version**: TypeScript on Node.js (backend: Express.js; frontend: React 19 + Vite)

**Primary Dependencies**: Backend — Express, `axios` (adapters only), `zod`, `ioredis` via `cacheAdapter`, `firebase-admin` via the library repository. Frontend — React 19, React Router v6, TanStack Query v5, Tailwind CSS v4, `motion`. **No new dependency** — the growth chart is hand-rolled SVG (KISS; consistent with the `dataviz` guidance and the absence of any chart lib in `frontend/package.json`).

**Storage**: Redis (via `cacheAdapter`) for the 7-day price-suggestion cache and a short valuation/stats freshness reuse of the existing library sync marker. Firestore `LibraryEntry` documents gain three **additive, backfilled** fields (`year`, `label`, `primaryArtist`) — same schemaless additive pattern as feature 038's `genre`/`style`/`format`; no migration, no new collection.

**Testing**: Backend — Jest + `supertest`, Discogs stub (the Firebase emulator is only needed for the library-repository touchpoints). Frontend — Vitest + React Testing Library. E2E — Playwright against the real backend with `e2e/helpers/discogsOauthStub.ts` extended for `/marketplace/price_suggestions/:releaseId` and richer `basic_information`.

**Target Platform**: Web application deployed on Vercel (frontend + backend as separate projects, feature 005).

**Project Type**: Web application — `backend/` (hexagonal Express API) + `frontend/` (React SPA) + `e2e/` (Playwright).

**Performance Goals**: Block 1 renders from Firestore with no external calls — SC-002 target < 2 s for up to 1,000 records. Re-opening the section within the 7-day price window issues **zero** new price-suggestion calls (SC-005). A valuation batch call prices ≤ ~25 releases and returns promptly; the loop paces itself through the existing throttle.

**Constraints**: All Discogs calls share the one per-IP rate-limit budget and circuit breaker — no separate quota (FR-021). The valuation must never block the section load (FR-020) and must impose no cap on releases valued (FR-023a). Every failure path degrades gracefully: Block 1 always renders; Block 2 shows a specific, non-blocking notice on outage or missing seller settings, never an error page (FR-025, SC-009). WCAG 2.1 AA + Apple HIG apply to all new UI, including the chart (Principles X, XI).

**Scale/Scope**: Personal collections — typically tens to a few hundred records, but the valuation is designed to be correct (if slow) for several thousand. ~1 new backend slice (2 routes, 1 new port, 1 new adapter, 2 use cases, ~3 pure domain modules), 2 modified backend files (`syncLibrary` mapping, `discogsCollectionAdapter` instance mapping) + the library repository, ~10 new/modified frontend components, 1 new page + nav wiring.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Pure aggregators (`aggregateStatistics`, `computeValuation`) are trivially unit-testable and authored test-first with fixture collections. Adapter tests hit the extended Discogs stub; use-case tests use fake ports; routes get `supertest` integration tests; RTL covers the page, the breakdown/"Otros" expansion, the chart's accessible table, and the progressive valuation loop; Playwright covers the linked/unlinked/large-collection/seller-settings-missing paths. No implementation task precedes its failing test. |
| **II. Discogs Integration-First & Modularity** | PASS. Every number derives from Discogs data (collection `basic_information` + `mediaCondition` + `price_suggestions`); nothing is curated locally (the persisted entry facets are a cache of Discogs values, backfilled from Discogs, exactly like feature 038). The new marketplace integration is a focused port + adapter; rate-limit / retry / breaker behavior is **reused verbatim**, not reinvented (FR-021). Price cache uses a longer TTL because market value changes slowly (FR-022). |
| **III. Simplicity, YAGNI & KISS** | PASS. No charting library (inline SVG). No streaming/WebSocket/job infra — a plain chunked endpoint polled by the client gives progressive fill (research §5). No new cache mechanism — `cacheAdapter.withCache` with a different TTL. Stats reuse the library's existing sync-on-read + marker. Out-of-scope items (price alerts, value history, export, comparison, marketplace-stats endpoint) explicitly deferred. |
| **IV. SOLID** | PASS. `DiscogsMarketplacePort` is a one-method interface (ISP); use cases depend on ports, not adapters (DIP); the two use cases are separate (SRP — stats never needs the marketplace, valuation never needs the aggregator); `syncLibrary` is extended by mapping more fields, its reconciliation logic untouched (OCP-friendly). |
| **V. Observability** | PASS. Structured logs for `stats_computed` (with record count), `valuation_batch` (priced / cached / covered / failed counts), `price_suggestion_missing`, `seller_settings_required`, and every error, with `uid` context — matching existing `syncLibrary.ts` / adapter log shapes. |
| **VI. Versioning & Breaking Changes** | PASS. Additive only — new routes, new frontend surface, three backward-compatible Firestore fields, richer `CollectionInstance`. No contract or schema break → MINOR bump (`feat`). |
| **VII. Curated Ratings & Music News (Rock/Metal)** | PASS. No change to rating semantics or news. The section is analytics over the user's own collection; the rock/metal editorial lens is irrelevant to arithmetic over whatever the user owns. |
| **VIII. Hexagonal Architecture — Backend** | PASS. Domain: `domain/collectionStats/{types,statsErrors,aggregateStatistics,computeValuation}.ts` — pure, no SDKs. Application: `application/collectionStats/{getCollectionStatistics,getCollectionValuation}.ts` — ports only. Ports: `ports/discogsOauth/discogsMarketplacePort.ts` (+ reuse `discogsCollectionPort`, `libraryRepositoryPort`, `cachePort`). Adapters: `adapters/discogsOauth/discogsMarketplaceAdapter.ts`, `adapters/collectionStats/collectionStatsRoutes.ts` (driving; HTTP↔use-case + domain-error→status only). |
| **IX. Frontend Network Requests — Backend-Only** | PASS. All new frontend calls target `/api/collection-stats/*`. No Discogs SDK or direct Discogs call from `frontend/`. |
| **X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE)** | PASS (planned). The growth chart ships with a visually-hidden data table and `img`-role + `aria-label` summary; per-period vs cumulative is a real toggle control, not color-only; breakdown bars encode value as length + text, never color alone; "Otros (N)" is a real `<button>`/`<details>` with an accessible name; the valuation progress uses `aria-live="polite"`; contrast reuses tokens audited in features 058/059; the chart animation respects `prefers-reduced-motion`. |
| **XI. Apple Design Principles Compliance** | PASS (planned). `apple-design` / `emil-design-eng` consulted before building the chart, the breakdown lists, and the progressive-count transition; `animate` for the count-up and bar-grow motion (spring easing, interruptible, reduced-motion aware); reuses `Card`, `Button`, existing typography/spacing tokens and `LibraryLinkRequired`. |

**Deviations from the spec surfaced during planning** (see research §2 and §7 — recommend confirming, not blocking):

1. **Seller-settings requirement.** `GET /marketplace/price_suggestions` requires the linked user to have **Discogs seller settings configured**, not merely a linked account. The spec's gating ("solo con la cuenta vinculada") is necessary but not sufficient. Plan: Block 1 always works with just a link; when the marketplace endpoint returns 401/403 for missing seller settings, Block 2 shows a distinct, non-blocking notice ("Discogs only provides price estimates once you've completed your seller settings on discogs.com") instead of the generic outage message. Recommend adding this as an explicit FR + edge case via `/speckit-clarify` or a spec edit.
2. **`addedAt` accuracy.** For the rare entry created in Vinylmania and pushed to Discogs on first sync, `addedAt` is the Vinylmania creation time until reconciled. The plan reconciles `addedAt` from the instance `date_added` on every sync, making all entries Discogs-accurate after one sync — consistent with FR-010's intent.

**Result**: PASS — no constitutional violations. Complexity Tracking not required (the chunked valuation endpoint is justified inline below, not a violation).

**Post-design re-check (after Phase 1)**: still PASS. `data-model.md` and `contracts/` confirm the four-layer split (pure `aggregateStatistics`/`computeValuation` in `domain/`, ports-only use cases, SDK use confined to `discogsMarketplaceAdapter`), frontend calls only `/api/collection-stats/*` (Principle IX), the persistence change is three additive backfilled fields (Principle VI → MINOR), and no dependency is added (Principle III). Accessibility obligations for the chart are written into the contract and quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/061-collection-stats-valuation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── collection-stats-api.md        # /api/collection-stats HTTP contract
│   └── discogs-marketplace-client.md  # DiscogsMarketplacePort ↔ Discogs price_suggestions contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── collectionStats/
│   │   ├── types.ts                    # NEW — CollectionStatistics, StatBreakdown, GrowthSeries,
│   │   │                               #       CollectionValuation, PerDiscValue, ValuationStatus
│   │   ├── statsErrors.ts              # NEW — re-export DiscogsNotLinkedError; SellerSettingsRequiredError
│   │   ├── aggregateStatistics.ts      # NEW — pure: LibraryEntry[] → CollectionStatistics
│   │   └── computeValuation.ts         # NEW — pure: instances + suggestions map → running CollectionValuation
│   └── discogsOauth/
│       └── collectionTypes.ts          # MODIFIED — CollectionInstance gains basic_information facets
├── application/
│   ├── collectionStats/
│   │   ├── getCollectionStatistics.ts  # NEW — sync-on-read + list entries + aggregate
│   │   └── getCollectionValuation.ts   # NEW — list instances + batch price suggestions + accumulate
│   └── library/
│       ├── syncLibrary.ts              # MODIFIED — persist year/label/primaryArtist; reconcile addedAt
│       └── enrichLibraryEntry.ts       # (unchanged; write-back already covers genre/style/format)
├── ports/
│   ├── discogsOauth/
│   │   ├── discogsCollectionPort.ts    # (unchanged — listAllInstances already returns what we need)
│   │   └── discogsMarketplacePort.ts   # NEW — getPriceSuggestions(connection, releaseId)
│   └── library/
│       └── libraryRepositoryPort.ts    # MODIFIED — persistCollectionFacets (year/label/primaryArtist)
└── adapters/
    ├── discogsOauth/
    │   ├── discogsCollectionAdapter.ts # MODIFIED — mapInstance maps basic_information facets
    │   └── discogsMarketplaceAdapter.ts# NEW — OAuth-signed price_suggestions client, reuses resilience
    ├── library/
    │   └── firestoreLibraryRepository.ts # MODIFIED — persistCollectionFacets
    └── collectionStats/
        └── collectionStatsRoutes.ts    # NEW — GET /statistics, GET /valuation (chunked)
backend/src/app.ts                       # MODIFIED — app.use('/api/collection-stats', collectionStatsRouter)

frontend/src/
├── services/
│   └── collectionStatsApi.ts           # NEW — getStatistics / getValuationChunk
├── queries/
│   └── collectionStatsQueries.ts       # NEW — useCollectionStatistics, useProgressiveValuation
├── pages/
│   └── CollectionStatsPage.tsx         # NEW — the section (gate + two blocks)
├── components/
│   ├── headerNavLinks.ts               # MODIFIED — add { key:'stats', label:'Collection stats', to:'/app/stats' }
│   ├── HeaderNavIcons.tsx              # MODIFIED — ICONS.stats
│   ├── LibraryLinkRequired.tsx         # MODIFIED — add context:'stats' copy
│   ├── stats/
│   │   ├── CollectionTotals.tsx        # NEW — total records + headline figures
│   │   ├── StatBreakdownList.tsx       # NEW — reusable ranked bars + "Otros (N)" expand
│   │   ├── TopArtistsList.tsx          # NEW — most-present artists
│   │   └── CollectionGrowthChart.tsx   # NEW — inline SVG, per-period ⇄ cumulative toggle, a11y table
│   └── valuation/
│       ├── CollectionValuationCard.tsx # NEW — total + "estimado sobre X de Y" + progressive state
│       ├── MostValuableRecords.tsx     # NEW — highlight list
│       ├── ValuationBreakdownDialog.tsx# NEW — full per-disc list on expand
│       └── ValuationUnavailableNotice.tsx # NEW — seller-settings / outage notice
└── App.tsx                             # MODIFIED — <Route path="/app/stats" ...>

e2e/
├── helpers/discogsOauthStub.ts         # MODIFIED — /marketplace/price_suggestions/:id + rich basic_information
└── tests/collection-stats.spec.ts      # NEW
```

**Structure Decision**: Web application layout (Option 2). The backend follows the mandatory hexagonal four-layer split under `backend/src/{domain,application,ports,adapters}/collectionStats/` with the Discogs marketplace integration living beside the other OAuth adapters in `adapters/discogsOauth/`. The frontend adds one route/page under the existing `frontend/src/pages` + `components` structure, grouping the new components in `stats/` and `valuation/` subfolders for clarity.

## Chunked valuation endpoint — rationale (not a constitution violation)

FR-020 (never block the load), FR-023a (no cap), and FR-021 (reuse rate limiting) together rule out a single synchronous "compute the whole valuation" call: for a multi-thousand-record collection that call would run for minutes and time out. The three realistic designs are (a) server-sent events / streaming, (b) a background job with a poll endpoint, (c) a stateless chunked endpoint the client calls in a loop. (a) and (b) add infrastructure (long-lived connections or a job store) the project doesn't have and YAGNI discourages. (c) is a plain `GET` that prices the next ~25 uncached releases, writes them to the 7-day cache, and returns running totals + a `nextCursor`; the client (TanStack Query) loops until `status === 'complete'`, updating the UI each round. Partial progress lives in the shared price cache, so navigating away and back resumes for free. This is the simplest thing that satisfies all three requirements.

## Phase 0 — see [research.md](research.md)

## Phase 1 — see [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

## Complexity Tracking

No constitutional violations require justification. The chunked valuation endpoint is discussed above as the simplest design meeting FR-020 / FR-021 / FR-023a, not as added complexity over a viable simpler option.
