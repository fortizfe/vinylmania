# Implementation Plan: Dashboard RSS Feed Sources Refresh

**Branch**: `041-dashboard-rss-feed-refresh` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/041-dashboard-rss-feed-refresh/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Retire Metal Storm (5 catalog entries + its dedicated image-extraction
logic) from the Dashboard's RSS feed system, add 5 of the 6 candidate
replacement sources (Metal Blade Records is confirmed unreachable — see
`research.md` §1 — and is excluded rather than shipped disabled), and fix
the source filter so clicking a source label queries that source's feed
directly and shows everything it has, instead of only whatever survived
the general view's per-category top-10 cutoff. The direct query reuses the
existing per-source cache and 8-second timeout (`feedAggregator.ts` /
`feedClient.ts`) via a new, narrowly-scoped endpoint
(`GET /api/feeds/sources/:sourceId`), keeping the existing
`GET /api/feeds/dashboard` contract untouched.

## Technical Context

**Language/Version**: TypeScript (Node.js backend, React frontend) — per constitution's required stack.

**Primary Dependencies**: Backend: Express.js, `axios`, `rss-parser`, Redis-backed `withCache` (`cacheAside.ts`). Frontend: React, `@tanstack/react-query`, `clsx`, Tailwind CSS v4.

**Storage**: N/A — no persistent storage change. Existing Redis cache-aside layer (`feeds:${sourceId}` keys, 20-minute TTL) is reused as-is, not modified.

**Testing**: Backend: Jest (`npm test`, unit/integration/contract, run inside Firebase emulators). Frontend: Vitest + React Testing Library (`npm test`).

**Target Platform**: Web application (Vercel-deployed frontend, Node.js backend).

**Project Type**: Web application (existing `backend/` + `frontend/` split).

**Performance Goals**: No new performance targets beyond what already exists — the direct per-source query reuses the same 8s timeout and 20-minute cache TTL as the general dashboard load, so a source already loaded during the general view is typically served from cache (no added network round trip).

**Constraints**: Reuse existing per-source cache key and timeout constant rather than introducing new ones (per clarifications in `spec.md`); no change to `ARTICLES_PER_CATEGORY` or to `GET /api/feeds/dashboard`'s existing contract.

**Scale/Scope**: Feed source catalog goes from 8 entries (3 existing + 5 Metal Storm) to 8 entries (3 existing + 5 new), all in a single `News` category until a future feature reintroduces category variety (documented tradeoff, `spec.md` → Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Assessment |
|---|---|
| I. Test-First | Tasks phase MUST generate failing tests first for: catalog removal/addition (`feedSources.test.ts`), removed image-extraction logic (`feedMapper.test.ts`), new endpoint (contract + integration tests), and frontend behavior (`FeedSourceFilterBar`, `FeedArticleBoard`, new query hook). No implementation task before its test task. |
| II. Discogs Integration-First | N/A — this feature does not touch catalog/Discogs data. |
| III. Simplicity, YAGNI & KISS | Satisfied: Metal Blade Records is excluded rather than added as a dead `enabled: false` entry (research.md §1); the new endpoint has one narrow responsibility instead of overloading the dashboard endpoint. |
| IV. SOLID | New per-source read path is a separate function/route (single responsibility) reusing, not modifying, `fetchSourceArticles`/`fetchFeed`/`mapFeedItem`. |
| V. Observability | New endpoint MUST log the same way `getDashboard`/`fetchSourceArticles` already do (`logger.warn` on per-source failure, `logger.info`/`logger.error` at the route level) — no new logging pattern introduced. |
| VI. Versioning & Breaking Changes | Additive (new endpoint) + config-only removal (Metal Storm) + config-only addition (5 sources). No stored-data or existing-contract change; `GET /api/feeds/dashboard`'s response shape is unchanged. Conventional commits (`feat:`/`fix:`) drive the version bump automatically, no manual changelog/version edits. |
| VII. Curated Ratings & Music News | Preserved: attribution (source name, publish date, link) unchanged; per-source graceful degradation extended (not weakened) to the new direct-query path; all 5 new sources are rock/metal publications, consistent with the project's default editorial focus. |
| UI Design System (Tailwind v4) | The new "source unavailable" filtered-view state reuses existing card/skeleton/dark-mode/no-custom-CSS patterns already used by `FeedSourceStatusBanner` and the existing empty-state paragraph in `FeedArticleBoard` — no new component class patterns introduced. |
| Dev Workflow — mandatory e2e coverage for `/frontend` PRs | **Deviation.** Per explicit user decision (2026-07-13), e2e coverage is out of scope for this feature, matching the source HU's explicit scoping. Recorded below under Complexity Tracking so the PR reviewer sees it explicitly, per the constitution's deviation-justification rule. `e2e/tests/dashboard-feed-grid.spec.ts` (which references Metal Storm) is left as-is and will need a follow-up fix since it will fail against the new catalog — tracked as an explicit known gap, not silently ignored. |

**Result**: No blocking violations. One explicitly acknowledged deviation (e2e coverage), documented in Complexity Tracking per user decision.

## Project Structure

### Documentation (this feature)

```text
specs/041-dashboard-rss-feed-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── feeds-source.md  # GET /api/feeds/sources/:sourceId contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── feeds/
│   │   ├── feedSources.ts     # Catalog: remove Metal Storm, add 5 new sources
│   │   ├── feedAggregator.ts  # Add getSourceArticles(sourceId); export fetchSourceArticles reuse
│   │   ├── feedMapper.ts      # Remove DATA_IMAGE_URL_PATTERN / data-image-url tier
│   │   ├── feedClient.ts      # Unchanged (existing timeout reused as-is)
│   │   └── types.ts           # Add SourceFeedResponse type
│   └── routes/
│       └── feeds.ts           # Add GET /sources/:sourceId route
└── tests/
    ├── unit/feedSources.test.ts        # Remove Metal Storm cases, add 5 new
    ├── unit/feedMapper.test.ts         # Remove "Metal Storm data-image-url extraction" block
    ├── unit/feedAggregator.test.ts     # Add getSourceArticles unit coverage
    ├── contract/feedsDashboard.contract.test.ts       # Remove Metal Storm assertions
    ├── contract/feedsSource.contract.test.ts          # New: GET /sources/:sourceId contract
    ├── integration/feedsDashboardNewSources.integration.test.ts # Extend/replace with the 5 new sources
    └── integration/feedsDashboardMetalStormCategories.integration.test.ts # Delete (Metal Storm-only file)

frontend/
├── src/
│   ├── services/feedsApi.ts        # Add getSourceFeed(sourceId), SourceFeedResponse type
│   ├── queries/feedsQueries.ts     # Add useSourceFeed(sourceId)
│   └── components/
│       ├── FeedArticleBoard.tsx    # Use useSourceFeed when selectedSource is set
│       ├── FeedSourceFilterBar.tsx # No structural change (new labels come from data)
│       └── FeedArticleCard.tsx     # No change expected (same Article shape)
└── tests/components/
    ├── FeedSourceFilterBar.test.tsx  # Remove Metal Storm cases, add 5 new
    ├── FeedArticleBoard.test.tsx     # Add direct-query / unavailable-state coverage
    └── FeedArticleCard.test.tsx      # Remove Metal Storm-specific image extraction cases
```

**Structure Decision**: Existing `backend/` + `frontend/` web application
split is unchanged. This feature only touches the existing `feeds` module
on the backend and the existing feed-related components/services/queries
on the frontend — no new top-level module or directory is introduced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| No e2e coverage added or updated for this `/frontend`-touching change (Dev Workflow gate) | The source HU explicitly scoped e2e out of this feature, and the user confirmed (2026-07-13) documenting the deviation rather than adding e2e tasks now | N/A — explicit product decision; adding e2e coverage here would exceed the agreed scope of this feature. The existing Metal-Storm-referencing e2e test (`e2e/tests/dashboard-feed-grid.spec.ts`) is left failing-by-omission and flagged as a known follow-up rather than silently ignored |
