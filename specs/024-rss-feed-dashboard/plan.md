# Implementation Plan: Music News Dashboard (RSS Feed Hub MVP)

**Branch**: `024-rss-feed-dashboard` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-rss-feed-dashboard/spec.md`

## Summary

Fill Vinylmania's existing authenticated home route (`/app`, currently the "Under construction" `DashboardPage`) with a categorized, image-rich aggregation of heavy metal news pulled server-side from Metal Injection's RSS feed (guaranteed at launch) and Metal Storm's RSS feeds (best-effort — its feed-listing page is behind Cloudflare bot-detection and may be unreachable). The backend fetches, parses, and cache-asides (Redis, ~20 min TTL) a small curated set (top 3-5) of recent articles per category, exposing one aggregate JSON endpoint; the frontend renders it as labeled category sections with thumbnails, client-side category filtering, and click-through to the original article on the source's site in a new tab. Reuses the project's existing Discogs-client conventions (axios + cache-aside + structured logging) rather than introducing new infrastructure.

## Technical Context

**Language/Version**: TypeScript (Node.js 26, backend on Express/ts-node-dev; React 19 + Vite on the frontend) — matches the rest of the repo.

**Primary Dependencies**: Backend — Express, axios, ioredis (all existing), plus a new `rss-parser` dependency for RSS/Atom parsing. Frontend — React 19, `@tanstack/react-query`, Tailwind CSS 4, `react-router-dom`, `clsx` (all existing; no new frontend dependency needed).

**Storage**: None persistent. Redis cache-aside only (ephemeral, ~20 min TTL per feed source), reusing `backend/src/cache/cacheAside.ts` and `redisClient.ts`. No Firestore schema changes.

**Testing**: Backend — Jest + `nock` (HTTP mocking for feed fetches) + `ioredis-mock` (existing devDependencies, same pattern as `discogsClient`). Frontend — Vitest + Testing Library, mocking `apiClient`/`fetch` the same way existing query/service tests do.

**Target Platform**: Web (existing Vercel-split frontend/backend deployment, feature 005).

**Project Type**: Web application (existing `backend/` + `frontend/` split).

**Performance Goals**: Dashboard content visible within 3s of navigation under normal network conditions (spec SC-001) — achieved via parallel per-source fetches (`Promise.allSettled`) with a per-source timeout (8s) and a warm Redis cache serving the common case in well under 500ms.

**Constraints**: Each feed source is fetched with an independent timeout and failure boundary so one slow/blocked source (notably Metal Storm's Cloudflare protection) never blocks or fails the other sources (spec FR-007). No feed-provided HTML is ever rendered as markup — see research.md's sanitization decision.

**Scale/Scope**: 2 configured sources at launch (Metal Injection certain; Metal Storm best-effort, multiple sub-feeds), top 3-5 articles per category, one shared non-personalized cache entry set serving all users. Negligible scale — no pagination, no per-user data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Applies | Tasks phase MUST order failing tests before implementation for the feed client, cache-aside usage, aggregate route, and frontend components/hooks. |
| II. Discogs Integration-First & Modularity | N/A for the external-fetch aspect | This feature touches editorial/news content, not catalog metadata — it MUST NOT be forced through the Discogs client. The *modularity* half of the principle still applies by analogy: the RSS integration is built as its own reusable, independently-testable module (mirrors `discogs/` shape: client + mapper + errors), not scattered inline in the route. |
| III. Simplicity, YAGNI & KISS | Applies | No new infra (no message queue, no scheduled job, no admin UI for managing sources); static config list of feed sources; no HTML sanitizer dependency — see research.md. |
| IV. SOLID Design | Applies | Feed client (fetch+parse), category mapping, and cache-aside stay in separate, single-responsibility modules mirroring the existing `discogs/` package split. |
| V. Observability | Applies | Reuses `logger` with new `LogOutcome` values (`feed_fetch_failed`, `feed_unavailable`) for per-source fetch success/failure, mirroring Discogs rate-limit/unavailable logging. |
| VI. Versioning & Breaking Changes | Applies, trivially | No schema/data-contract changes to existing endpoints; this is a new, additive `/api/feeds/dashboard` endpoint and a filled-in existing frontend route. MINOR change. |

No violations requiring justification — Complexity Tracking table is empty/omitted.

**Post-Phase 1 re-check**: data-model.md and contracts/feeds-dashboard.md introduce no persistence, no new services beyond the single `feeds/` package, and one new dependency (`rss-parser`, justified in research.md §1). All six principles remain satisfied as assessed above — no changes to this table.

## Project Structure

### Documentation (this feature)

```text
specs/024-rss-feed-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── feeds-dashboard.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── feeds/
│   │   ├── feedSources.ts       # Static config: id, name, feedUrl, category, per-source enabled flag
│   │   ├── feedClient.ts        # Fetch + parse one feed URL (axios + rss-parser), timeout-bounded
│   │   ├── feedMapper.ts        # Raw feed item -> Article (title, plain-text excerpt, image, date, link, category)
│   │   ├── feedAggregator.ts    # Fan-out fetch across all sources (Promise.allSettled), cache-aside per source, group into categories, cap top 3-5
│   │   └── types.ts             # FeedSource, Article, Category, DashboardResponse
│   └── routes/
│       └── feeds.ts             # GET /api/feeds/dashboard
└── tests/
    ├── unit/
    │   ├── feedMapper.test.ts
    │   └── feedAggregator.test.ts
    ├── contract/
    │   └── feedsDashboard.contract.test.ts
    └── integration/
        └── feedsDashboard.integration.test.ts   # nock-mocked Metal Injection + Metal Storm responses, including a simulated source failure

frontend/
├── src/
│   ├── services/
│   │   └── feedsApi.ts          # authorizedFetch wrapper for GET /api/feeds/dashboard
│   ├── queries/
│   │   └── feedsQueries.ts      # useDashboardFeeds() TanStack Query hook
│   ├── components/
│   │   ├── FeedCategorySection.tsx
│   │   ├── FeedArticleCard.tsx
│   │   ├── FeedArticleCardSkeleton.tsx
│   │   ├── FeedCategoryFilterBar.tsx
│   │   └── FeedSourceStatusBanner.tsx   # "Metal Storm unavailable" style non-blocking notice
│   └── pages/
│       └── DashboardPage.tsx    # Replaces the "Under construction" placeholder with the real layout
└── tests/
    ├── components/
    │   ├── FeedArticleCard.test.tsx
    │   └── FeedCategoryFilterBar.test.tsx
    └── integration/
        └── DashboardPage.test.tsx
```

**Structure Decision**: Extends the existing `backend/` + `frontend/` split (no new top-level project). Backend gets a new `src/feeds/` package mirroring the shape of `src/discogs/` (client / mapper / types, no service layer needed since there's no persistence). Frontend fills the existing `pages/DashboardPage.tsx` placeholder and adds a small set of presentational components plus one query hook, following the same services → queries → components → pages layering used by the Discogs/library features.

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
