# Implementation Plan: Record Rating Badges on Search and Library Cards

**Branch**: `017-record-rating-cards` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-record-rating-cards/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a compact, modern rating badge to both discovery and ownership cards without changing their core interaction model. Library cards reuse the existing release community rating already present in enriched library payloads. Search-result cards require backend enrichment because the current Discogs search contract does not expose rating averages; the chosen design extends `/api/discogs/search` so each release result can optionally include a cached community-rating block fetched from Discogs' dedicated release-rating endpoint, with each per-release lookup bounded by a 2-second timeout (spec SC-006) so a slow or failed lookup degrades to the same "no rating available" omission as an unrated release. Frontend work then extracts a reusable badge component plus a small rating-presentation helper, overlays the badge in the thumbnail's upper-right corner using band colors chosen to meet WCAG AA text contrast (spec FR-013), updates skeletons to preserve layout, and extends backend, frontend, and e2e coverage. Sorting/filtering by rating and changes to the record detail page's existing rating display remain explicitly out of scope (spec "Out of Scope").

## Technical Context

**Language/Version**: TypeScript ^5.6 (backend, Node.js/Express), TypeScript ~6.0 (frontend, React 19 + Vite 8)

**Primary Dependencies**: Backend: Express 4, axios 1, zod 3, firebase-admin, ioredis-backed cache wrapper. Frontend: React 19, react-router-dom 6, @tanstack/react-query 5, Tailwind CSS 4, clsx.

**Storage**: No new persisted storage. Existing Discogs catalog API remains the source of truth for release metadata and community rating; existing backend cache layer remains the only caching surface touched. Firestore library data is unchanged.

**Testing**: Backend: Jest + supertest + nock under `backend/tests/{contract,integration,unit}`. Frontend: Vitest + React Testing Library under `frontend/tests`. E2E: Playwright under `e2e/tests` using Firebase emulators.

**Target Platform**: Web application deployed as Vercel frontend + Express API, with local development via frontend Vite server and backend Express dev server.

**Project Type**: Web application (`backend/` + `frontend/` + `e2e/`)

**Performance Goals**: Search-result rating enrichment must stay within normal page-load expectations for the default 20-result page while remaining inside Discogs' authenticated rate budget. Each per-release rating lookup is bounded by a 2-second timeout (SC-006); a lookup still pending past that point is treated identically to a failed/omitted lookup so the search response is never blocked or perceptibly delayed. Library card badges must add no extra network round trip because rating is already present in library release payloads. Badge rendering must introduce no layout shift.

**Constraints**: No manual catalog metadata duplication outside Discogs; no new persistence or background jobs; search pages must continue to render even when some per-release rating enrichments fail or time out past 2 seconds; badge placement must not displace titles, actions, or click targets; badge text MUST meet WCAG AA contrast (4.5:1) against each of the three band background colors (FR-013); sorting/filtering by rating and changes to the record detail page's existing rating display are explicitly out of scope; frontend and backend package changelogs and version bumps are required because both surfaces change.

**Scale/Scope**: Backend changes are localized to Discogs search types, mapper/client, route behavior, and search contract tests. Frontend changes are localized to two card components, two skeletons, a shared badge/presentation helper, and the tests/e2e coverage around add-record and library browsing flows.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Test-First | Contract tests for the expanded search payload, frontend unit tests for both card variants, and e2e coverage for visible badge behavior are planned before implementation. | PASS |
| II. Discogs Integration-First & Modularity | Rating remains sourced from Discogs only. Search enrichment is isolated behind the backend Discogs client and exposed as a typed contract rather than ad hoc frontend calls. | PASS |
| III. Simplicity, YAGNI & KISS | The feature adds one reusable UI component and one narrow backend enrichment path. No new screens, persistence, or speculative filtering/sorting by rating are introduced. | PASS |
| IV. SOLID | Badge rendering, rating formatting, and search enrichment remain separate concerns: UI badge component, value-to-band helper, and backend client/mapper extensions. | PASS |
| V. Observability | Partial enrichment failures are planned as structured log events so degraded cards can be diagnosed without failing the whole search response. | PASS |
| VI. Versioning & Breaking Changes | Search payload change is additive and optional, so no breaking API migration is needed. Frontend and backend changelog/version updates are still required because both packages change behavior. | PASS |
| Web App Standards | The API contract for search enrichment is documented before implementation, no persistence migration is needed, and user-facing degradation remains distinct from internal errors. | PASS |
| UI Design System | The badge is planned as a reusable atomic component using Tailwind v4 theme tokens, preserving card lightness, dark mode, and skeleton-first loading behavior. Band colors are chosen in research.md/data-model.md specifically to satisfy WCAG AA text contrast (FR-013). | PASS |

**Post-design re-check (after Phase 1)**: No new constitution violations were introduced. The design stays within the existing backend/frontend/e2e structure, adds no new storage systems, and keeps rating sourcing Discogs-first. The clarification-driven additions (2-second per-lookup timeout for SC-006, WCAG AA contrast tokens for FR-013, explicit out-of-scope boundary) are additive refinements to the same design and do not change the Constitution Check outcome.

## Project Structure

### Documentation (this feature)

```text
specs/017-record-rating-cards/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── discogs-search-rating-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts          # search enrichment helper + cached rating lookup
│   │   ├── discogsMapper.ts          # search-result mapping extended with optional community rating
│   │   └── types.ts                  # CatalogSearchResult shape extended
│   └── routes/
│       └── discogs.ts                # /api/discogs/search returns optional rating data
└── tests/
    ├── contract/
    │   └── discogsSearch.contract.test.ts
    └── integration/
        └── discogsCacheOutage.test.ts

frontend/
├── src/
│   ├── components/
│   │   ├── SearchResultCard.tsx
│   │   ├── RecordCard.tsx
│   │   ├── SearchResultCardSkeleton.tsx
│   │   ├── RecordCardSkeleton.tsx
│   │   └── ui/
│   │       └── ReleaseRatingBadge.tsx    # NEW atomic component
│   ├── lib/
│   │   └── releaseRating.ts              # NEW helper: visibility, banding, display label
│   ├── services/
│   │   └── discogsApi.ts                 # search result type extended
│   └── pages/
│       ├── AddRecordPage.tsx
│       └── LibraryListPage.tsx
└── tests/
    ├── unit/
    │   ├── SearchResultCard.test.tsx
    │   ├── RecordCard.test.tsx
    │   └── releaseRating.test.ts         # NEW helper coverage
    └── integration/
        └── addRecordFlow.test.tsx

e2e/
└── tests/
    ├── caching-navigation.spec.ts
    └── library-discogs-sync.spec.ts      # candidate flow to extend for library-card visibility
```

**Structure Decision**: Keep the existing web-application split. The feature adds one frontend atomic component and one frontend helper, and extends the current Discogs search API contract rather than introducing a new endpoint or service boundary.

## Complexity Tracking

> No constitution violations requiring justification. Table intentionally empty.
