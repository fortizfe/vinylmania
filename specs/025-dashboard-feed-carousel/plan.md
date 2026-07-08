# Implementation Plan: Dashboard Feed Carousels & Metal Storm Categories

**Branch**: `025-dashboard-feed-carousel` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-dashboard-feed-carousel/spec.md`

## Summary

Extends the RSS Feed Dashboard MVP (feature 024) in three ways: (1) removes the redundant "Dashboard" page heading; (2) connects five additional, directly-reachable Metal Storm RSS feeds (News, Reviews, Interviews, Articles, Staff Picks) as new backend feed sources, letting the existing category-grouping logic merge same-labeled categories (e.g. "News") across sources exactly as it already supports; (3) replaces every category's fixed 5-item grid with a horizontally-scrollable, arrow-navigable carousel showing up to the 10 most recent articles per category, newest first, reusing the existing `FeedArticleCard` presentation unchanged. No new dependencies, no persistence changes, no new API endpoint — this is an additive extension of 024's existing `GET /api/feeds/dashboard` aggregation and its frontend rendering layer.

## Technical Context

**Language/Version**: TypeScript (Node.js, Express/ts-node-dev backend; React 19 + Vite frontend) — unchanged from feature 024.

**Primary Dependencies**: No new dependencies. Backend reuses `rss-parser`, `axios`, `ioredis` (all already added in 024). Frontend reuses React 19, `@tanstack/react-query`, Tailwind CSS 4, `clsx`; the new carousel is built with native browser scrolling (`overflow-x-auto` + `scrollBy`) and hand-written inline SVG chevron icons, following the same local-icon-component convention already used by `frontend/src/components/ui/BackLink.tsx` — no carousel or icon library is introduced (Principle III).

**Storage**: None persistent. Same Redis cache-aside reuse as 024 (`withCache`, per-source TTL); no Firestore schema changes.

**Testing**: Backend — Jest + `nock`, extending the existing `feedAggregator`/`feedsDashboard` test suites. Frontend — Vitest + Testing Library for the new carousel component and updated `DashboardPage`/`FeedCategorySection` integration tests. E2E — Playwright; feature 024 shipped without a dashboard e2e spec despite the constitution's mandatory e2e-for-frontend-PRs gate (Development Workflow), so this feature adds `e2e/tests/dashboard-feed-carousel.spec.ts` to close that gap for the affected flow.

**Target Platform**: Web (existing Vercel-split frontend/backend deployment, feature 005) — unchanged.

**Project Type**: Web application (existing `backend/` + `frontend/` split) — unchanged.

**Performance Goals**: No regression to 024's existing "content visible within 3s" target (spec 024 SC-001). Carousel navigation is a pure client-side scroll interaction (no network call per arrow click), so it must feel immediate regardless of backend latency.

**Constraints**: Per-category article cap rises from 5 to 10, but stays capped at 10 *after* merging all contributing sources for a category (spec FR-006, SC-005) — so combining Metal Injection's "News" with Metal Storm's "News" does not double the payload, it still yields at most 10. Each of the five new feed sources is fetched under the same independent per-source timeout/failure boundary as Metal Injection (spec FR-010), so one new source failing never blocks the others.

**Scale/Scope**: Adds 5 newly-enabled feed sources (all direct RSS/XML endpoints, not the Cloudflare-protected HTML listing page 024 struggled with) on top of the 1 existing enabled source (Metal Injection). Still no pagination, no per-user data, one shared non-personalized cache entry set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Applies | Tasks phase MUST order failing tests before implementation for: the updated feed-source config, the raised per-category cap/merge behavior, the new `FeedCarousel` component, the updated `DashboardPage` (title removal), and the new e2e spec. |
| II. Discogs Integration-First & Modularity | N/A for the external-fetch aspect | Same rationale as 024: this is editorial/news content, not catalog metadata, so it is not routed through the Discogs client. The RSS integration remains its own modular package (`backend/src/feeds/`), extended rather than restructured. |
| III. Simplicity, YAGNI & KISS | Applies | No new infra or dependencies; the carousel is native-scroll + plain buttons, matching the project's existing no-icon-library convention; the 5 new sources are added as plain config entries, reusing the existing fetch/merge/cap pipeline unchanged in structure (only the cap constant changes). |
| IV. SOLID Design | Applies | `FeedCarousel` is a new, single-responsibility presentational component (scroll/arrow behavior only); it does not modify `FeedArticleCard` (still single-responsibility for one article) and keeps `FeedCategorySection` limited to heading + grouping. Backend changes stay isolated to `feedSources.ts` (config) and one constant in `feedAggregator.ts`. |
| V. Observability | Applies | No new failure modes: the 5 new sources flow through the existing `fetchSourceArticles`/`getDashboard` path, so existing `feed_fetch_failed`/`feed_unavailable` logging covers them automatically with no new logging code required. |
| VI. Versioning & Breaking Changes | Applies, trivially | Additive, backward-compatible response shape change: existing fields are unchanged; `categories[].articles` may now contain up to 10 items instead of 5, and `sourceStatuses` gains new entries. MINOR change — CHANGELOG entries required in both `backend/CHANGELOG.md` and `frontend/CHANGELOG.md` per Development Workflow gates. |

No violations requiring justification — Complexity Tracking table is empty/omitted.

**Post-Phase 1 re-check**: research.md and data-model.md confirm no new dependencies, no persistence, and no new cross-module coupling — the change set is a config addition (`feedSources.ts`), one constant change (`feedAggregator.ts`), one new presentational component (`FeedCarousel.tsx`), and two small edits to existing components/pages. All six principles remain satisfied as assessed above — no changes to this table.

## Project Structure

### Documentation (this feature)

```text
specs/025-dashboard-feed-carousel/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   └── feeds-dashboard-delta.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── feeds/
│       ├── feedSources.ts       # MODIFIED: replace the disabled metal-storm listing-page entry
│       │                        # with 5 enabled entries (News, Reviews, Interviews, Articles, Staff Picks)
│       └── feedAggregator.ts    # MODIFIED: ARTICLES_PER_CATEGORY 5 → 10 (merge/sort logic unchanged)
└── tests/
    ├── unit/
    │   └── feedAggregator.test.ts          # MODIFIED: cap=10, multi-source same-category merge case
    ├── contract/
    │   └── feedsDashboard.contract.test.ts # MODIFIED: up to 10 items, new source ids
    └── integration/
        └── feedsDashboard.integration.test.ts  # MODIFIED: nock mocks for the 5 new feed URLs

frontend/
├── src/
│   ├── components/
│   │   ├── FeedCarousel.tsx         # NEW: horizontal scroll container + prev/next arrow buttons,
│   │   │                            # wraps FeedArticleCard children unchanged
│   │   └── FeedCategorySection.tsx  # MODIFIED: renders FeedCarousel instead of the grid
│   └── pages/
│       └── DashboardPage.tsx        # MODIFIED: removes the "Dashboard" <h1>
└── tests/
    ├── components/
    │   └── FeedCarousel.test.tsx           # NEW
    └── integration/
        └── dashboardPageFlow.test.tsx       # MODIFIED: no title assertion; carousel arrow assertions

e2e/
└── tests/
    └── dashboard-feed-carousel.spec.ts  # NEW: closes the pre-existing e2e coverage gap for the
                                          # Dashboard flow (024 shipped without one)
```

**Structure Decision**: Pure extension of the existing `backend/` + `frontend/` split introduced by feature 024 — no new packages, routes, or top-level directories. The backend change is confined to the existing `src/feeds/` package (one config file, one constant). The frontend change adds exactly one new component (`FeedCarousel`) at the same layer as the existing `Feed*` components, and edits two existing files; no new services/queries/pages are needed since the API contract's shape is unchanged (same endpoint, same response fields, just more items/sources).

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
