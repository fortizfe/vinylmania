# Implementation Plan: RSS Dashboard Redesign — Responsive Layouts & New Sources

**Branch**: `033-rss-dashboard-redesign` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-rss-dashboard-redesign/spec.md`

## Summary

Replaces the per-category horizontal-carousel Dashboard layout (feature 025) with a single responsive CSS grid that collapses to one column on mobile — eliminating the separate carousel/mobile-list distinction as two components in favor of one grid whose column count (1 → 5, capped) is entirely breakpoint-driven. Adds a sticky category+source filter bar (both single-select, combinable), a new source filter alongside the existing category filter, and two new enabled feed sources (MetalSucks, Louder Sound) marked as "priority" sources (along with the existing Metal Injection) purely for filter-list ordering — never for card size/prominence. The backend's `GET /api/feeds/dashboard` contract is extended additively only (a new `priority` field on `FeedSourceConfig`/`SourceStatus`); the existing `categories`-grouped response shape is unchanged — the frontend flattens, sorts by recency, and filters client-side.

## Technical Context

**Language/Version**: TypeScript (Node.js/Express backend; React 19 + Vite frontend) — unchanged from features 024/025.

**Primary Dependencies**: No new dependencies. Backend reuses `rss-parser`, `axios`, `ioredis` (all already present). Frontend reuses React 19, `@tanstack/react-query`, Tailwind CSS 4, `clsx`; the new grid/list layout and card responsiveness are built entirely with Tailwind CSS Grid utilities and breakpoint variants — no carousel or grid library is introduced (Principle III). `FeedCarousel.tsx` (native-scroll carousel, added in 025) is removed as dead code since nothing renders it anymore.

**Storage**: None persistent. Same Redis cache-aside reuse as 024/025 (`withCache`, per-source ~20 min TTL); no Firestore schema changes.

**Testing**: Backend — Jest + `nock`, extending `feedSources`/`feedAggregator`/`feedsDashboard` test suites for the 2 new sources and the `priority` field. Frontend — Vitest + Testing Library for the new/modified components (`FeedArticleBoard`, responsive `FeedArticleCard`, `FeedSourceFilterBar`, updated `FeedCategoryFilterBar`, `DashboardPage`). E2E — Playwright; `e2e/tests/dashboard-feed-carousel.spec.ts` is replaced by `e2e/tests/dashboard-feed-grid.spec.ts` since the carousel interaction it tested no longer exists.

**Target Platform**: Web (existing Vercel-split frontend/backend deployment) — unchanged.

**Project Type**: Web application (existing `backend/` + `frontend/` split) — unchanged.

**Performance Goals**: SC-001 — at least 9 already-fetched articles fully visible with zero scrolling/clicking on a typical desktop-width first load (grid, not carousel, so no interaction-gated reveal). No change to feed fetch/cache latency characteristics.

**Constraints**: Desktop grid capped at 5 columns (clarified) via a bounded breakpoint stack (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`, nothing added beyond `xl:`), with the page container widened from `max-w-6xl` to `max-w-7xl` so 5 columns stay comfortably sized rather than cramped. Mobile filter controls MUST meet a 44×44 CSS px minimum touch target (clarified — WCAG 2.5.5/Apple HIG), satisfied with Tailwind's stock `h-11`/`min-h-11` utility (2.75rem = 44px is already on the default spacing scale, no `@theme` customization needed). No page-level horizontal scroll at any width down to 320px. Existing per-source fetch/cache/failure-isolation behavior is unchanged and must keep covering the 2 new sources automatically.

**Scale/Scope**: Adds 2 newly-enabled feed sources (MetalSucks, Louder Sound) to the existing 6 (Metal Injection + 5 Metal Storm categories), bringing total enabled sources to 8, all mapped to existing categories (both new sources use "News", per spec Assumptions). Still no pagination, no per-user personalization, one shared non-personalized cache/response.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Applies | Tasks phase MUST order failing tests before implementation for: the 2 new feed-source config entries + `priority` field, the flattening/sort/filter logic, the new `FeedArticleBoard` grid, the responsive `FeedArticleCard`, the new `FeedSourceFilterBar`, touch-target sizing on both filter bars, and the updated e2e spec. |
| II. Discogs Integration-First & Modularity | N/A for the RSS-fetch aspect | Same rationale as 024/025: this is editorial/news content, not catalog metadata, so it stays outside the Discogs client. The RSS integration remains its own modular package (`backend/src/feeds/`), extended rather than restructured. |
| III. Simplicity, YAGNI & KISS | Applies | No new dependencies. One responsive grid component replaces two presentation concepts (carousel + category sections) rather than building separate desktop/mobile component trees — mobile's "single-column list" is simply the grid's 1-column state, avoiding duplicated card/layout code. `FeedCarousel.tsx`/`FeedCategorySection.tsx` and their tests are deleted outright, not left dead or commented out. |
| IV. SOLID Design | Applies | `FeedArticleBoard` owns only grid layout + filtering/sorting orchestration; `FeedArticleCard` owns only one article's presentation (now responsive internally, still one component, one reason to change); `FeedSourceFilterBar` mirrors `FeedCategoryFilterBar`'s existing single-responsibility shape rather than merging the two filters into one component. Backend changes stay isolated to `feedSources.ts` (config) and `types.ts` (additive field). |
| V. Observability | Applies | No new failure modes: the 2 new sources flow through the existing `fetchSourceArticles`/`getDashboard` path, so existing `feed_unavailable` logging covers them automatically with no new logging code required. |
| VI. Versioning & Breaking Changes | Applies | Additive, backward-compatible response shape change only: `FeedSourceConfig`/`SourceStatus` gain a new `priority: boolean` field; `categories`/`sourceStatuses`/`generatedAt` field names and semantics are unchanged. MINOR change — CHANGELOG entries required in both `backend/CHANGELOG.md` and `frontend/CHANGELOG.md`, with matching `package.json` MINOR version bumps (per Development Workflow gates). |
| VII. Curated Ratings & Music News (Rock/Metal Focus) | Applies | MetalSucks and Louder Sound are both rock/metal-focused outlets, consistent with the constitution's default editorial focus and its explicit example precedent (Metal Injection, Metal Storm). Both new sources preserve attribution (source name badge, publish date, link-through to the original article, opened in a new tab) and MUST degrade gracefully per-source exactly like every existing source (FR-011, SC-006) — no change to that isolation mechanism is needed, only 2 new config entries flowing through it. |

No violations requiring justification — Complexity Tracking table is empty/omitted.

**Post-Phase 1 re-check**: research.md and data-model.md confirm no new dependencies, no persistence changes, and no new cross-module coupling — the change set is a config/type addition on the backend (`feedSources.ts`, `types.ts`), a client-side flatten/sort/filter step on the frontend, one new grid component, one responsive-card rewrite, one new filter-bar component, and deletion of the now-unused carousel/section components. All seven principles remain satisfied as assessed above — no changes to this table.

## Project Structure

### Documentation (this feature)

```text
specs/033-rss-dashboard-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   └── feeds-dashboard-delta.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── feeds/
│       ├── types.ts             # MODIFIED: add `priority: boolean` to FeedSourceConfig and SourceStatus
│       ├── feedSources.ts       # MODIFIED: add MetalSucks + Louder Sound entries (category "News",
│       │                        # enabled: true); set priority: true on metal-injection + the 2 new
│       │                        # entries, priority: false on the existing Metal Storm entries
│       └── feedAggregator.ts    # MODIFIED: propagate `priority` from FeedSourceConfig into SourceStatus
└── tests/
    ├── unit/
    │   └── feedAggregator.test.ts          # MODIFIED: priority propagation, 2 new source ids
    ├── contract/
    │   └── feedsDashboard.contract.test.ts # MODIFIED: priority field present, new source ids
    └── integration/
        └── feedsDashboard.integration.test.ts  # MODIFIED: nock mocks for the 2 new feed URLs

frontend/
├── src/
│   ├── components/
│   │   ├── FeedArticleBoard.tsx      # NEW: flattens categories→articles, applies category+source
│   │   │                             # filters (AND) and recency sort, renders the responsive grid
│   │   │                             # (grid-cols-1 sm:2 md:3 lg:4 xl:5), sticky filter bar, empty state
│   │   ├── FeedArticleCard.tsx       # MODIFIED: internally responsive (row/compact image on mobile,
│   │   │                             # column/full-width image on sm:+), same content/behavior (FR-007)
│   │   ├── FeedSourceFilterBar.tsx   # NEW: single-select source filter ("All sources" + one button per
│   │   │                             # source, priority sources listed first), 44px min touch target
│   │   ├── FeedCategoryFilterBar.tsx # MODIFIED: 44px min touch target (h-11/min-h-11), no behavior change
│   │   ├── FeedCarousel.tsx          # REMOVED (no longer rendered by anything)
│   │   └── FeedCategorySection.tsx   # REMOVED (superseded by FeedArticleBoard's flat grid)
│   ├── services/feedsApi.ts          # MODIFIED: add `priority` to the SourceStatus type
│   └── pages/
│       └── DashboardPage.tsx         # MODIFIED: renders FeedArticleBoard instead of the
│                                     # FeedCategoryFilterBar + FeedCategorySection loop
└── tests/
    ├── components/
    │   ├── FeedArticleBoard.test.tsx       # NEW
    │   ├── FeedArticleCard.test.tsx        # MODIFIED: responsive layout assertions
    │   ├── FeedSourceFilterBar.test.tsx    # NEW
    │   ├── FeedCategoryFilterBar.test.tsx  # MODIFIED: touch-target assertions
    │   └── FeedCarousel.test.tsx           # REMOVED
    └── integration/
        └── dashboardPageFlow.test.tsx      # MODIFIED: grid rendering, combined filter behavior

e2e/
└── tests/
    ├── dashboard-feed-carousel.spec.ts  # REMOVED (carousel interaction no longer exists)
    └── dashboard-feed-grid.spec.ts      # NEW: desktop grid density, mobile single-column + no
                                          # horizontal scroll, category+source filter combination,
                                          # empty state, MetalSucks/Louder Sound presence
```

**Structure Decision**: Pure extension of the existing `backend/` + `frontend/` split. The backend change is confined to `src/feeds/` (one additive type field, one config addition, one propagation line) — no new endpoint, no response-shape restructuring. The frontend replaces the carousel/per-category-section presentation layer with one new grid component and a responsive rewrite of the existing card, plus one new filter component mirroring the existing one; no new pages, services, or routes are introduced, since the API contract's field set is unchanged (all filtering/sorting/flattening happens client-side over the same `categories`/`sourceStatuses` payload).

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
