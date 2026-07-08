# Implementation Plan: Master Release Grouping & Detail Pages

**Branch**: `026-master-release-detail` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-master-release-detail/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Search results currently show every matching Discogs release as its own card, cluttering the grid with near-duplicate pressings of the same work, and clicking a card only opens a quick-look modal — there is no linkable "ficha" for a release or for the work as a whole. This increment (1) stops forcing the catalog search to `type=release`, so Discogs' own master/release indexing groups similar releases under a single result rendered with a stacked-covers visual, (2) retires the quick-look modal in favor of two new full pages — a release detail page and a master release detail page — reachable by clicking any search result, and (3) adds a 10-per-page version table to the master detail page so users can drill from "the work" down to a specific pressing's own detail page. Back-navigation on every new page uses the app's existing fixed-destination `BackLink` pattern, carrying the originating search (or master-page) location via router state.

## Technical Context

**Language/Version**: TypeScript (Node.js backend, React 18 frontend) — per constitution Technology Stack, no new language/runtime introduced.

**Primary Dependencies**: Express.js (backend routes), React + React Router (frontend pages/navigation), TanStack Query (data fetching/caching), Zod (Discogs response validation), Tailwind CSS v4 (styling) — all already in use; this feature adds no new dependency.

**Storage**: N/A for new persisted data — this feature is entirely a read-through view over the Discogs catalog (Principle II), cached in Redis via the existing `withCache` cache-aside helper. No Firestore schema changes.

**Testing**: Jest + React Testing Library (frontend unit/integration), Jest + Supertest-style route tests (backend contract/unit), Playwright (`/e2e`) — matching existing suites in `frontend/tests/` and `backend/tests/`.

**Target Platform**: Web application (existing Vercel-deployed frontend + backend), no platform change.

**Project Type**: Web application (frontend + backend), matching the existing repo layout.

**Performance Goals**: No new latency target beyond existing conventions — grouped-result rating enrichment reuses the existing 2-second timeout/omit-on-failure pattern (research Decision 3) so a slow master lookup never blocks the results grid.

**Constraints**: Must not increase Discogs API call volume per search page beyond what's needed for rating enrichment of grouped results (constitution Principle II: minimize redundant requests); must reuse the existing cache-aside/TTL conventions rather than introducing a new caching mechanism.

**Scale/Scope**: 2 new backend endpoints, 2 new frontend routes/pages, 1 new UI variant (stacked-covers card), 1 new paginated table component; no change to existing library/collection functionality.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Test-First | PASS (gate, not yet executed) — `/speckit-tasks` will sequence failing tests before implementation for: search grouping/mapper changes, the two new backend routes, the two new frontend pages, and the retired preview modal. |
| II. Discogs Integration-First & Modularity | PASS — all new data (master detail, master versions) comes from Discogs via the existing `discogsClient`/`discogsMapper`/`withCache` modules, extended rather than duplicated (research Decisions 1–6). No catalog metadata is hand-curated. |
| III. Simplicity, YAGNI & KISS | PASS — no version-table sort/filter controls, no client-side grouping algorithm, no new caching mechanism; stacked-covers effect is a fixed 2-layer visual with no per-card sibling-count lookup (research Decision 8). |
| IV. SOLID Design | PASS — `MasterRelease` is modeled as its own type instead of forcing an ill-fitting shape onto `Release`-shaped components; only genuinely shared shapes (`images`, `tracklist`) are reused as-is (research Decision 5). |
| V. Observability | PASS — new routes follow the existing `logger.info/warn/error` route/outcome/uid pattern already used by `/api/discogs/search` and `/api/discogs/releases/:discogsId`. |
| VI. Versioning & Breaking Changes | PASS — additive: `CatalogSearchResult.resultType` gains a value, two new backend endpoints, two new frontend routes. Removing the preview modal (FR-013) is a UI behavior change, not a data/schema break, but MUST be called out in the PR description and `CHANGELOG.md` per Development Workflow gates. |
| Web App Standards (API contracts documented pre-implementation) | PASS — see `contracts/discogs-catalog-api.md`. |
| Tailwind v4 / Card / Skeleton / dark-mode rules | PASS (gate, not yet executed) — new components (grouped-card stack, version table, its skeleton, detail-page skeletons) MUST follow the existing `Card`/`Skeleton`/`@theme` conventions; `/speckit-tasks` must include skeleton-loading tasks for both new detail pages per the constitution's "no spinners" rule. |
| e2e coverage for `/frontend` changes | PASS (gate, not yet executed) — `/speckit-tasks` must include a Playwright spec covering Scenarios 2–3 of `quickstart.md` (grouped result → master detail → version → release detail → back-chain), alongside the existing `search-result-filters.spec.ts`/`record-detail-inline-edit.spec.ts` style. |
| CHANGELOG + version bump | PASS (gate, not yet executed) — `/speckit-tasks` must include a `backend/CHANGELOG.md` + `backend/package.json` bump (new endpoints = MINOR) and a `frontend/CHANGELOG.md` + `frontend/package.json` bump (new pages/behavior change = MINOR, per Principle VI; the modal removal is backward-compatible from a data/contract standpoint). |

No violations requiring justification — Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/026-master-release-detail/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── discogs-catalog-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── types.ts            # +MasterRelease, +MasterReleaseVersion(sPage), resultType 'master'
│   │   ├── discogsMapper.ts    # +mapMasterRelease, +mapMasterReleaseVersion; type enum gains 'master'
│   │   └── discogsClient.ts    # +getMasterRelease, +getMasterReleaseVersions; search no longer forces type=release; enrichWithRating handles 'master'
│   └── routes/
│       └── discogs.ts          # +GET /masters/:discogsId, +GET /masters/:discogsId/versions
└── tests/
    ├── unit/discogsMapper.test.ts          # extend: master mapping
    ├── contract/discogsMaster.contract.test.ts   # new
    └── contract/discogsSearch.contract.test.ts   # extend: master hits in search response

frontend/
├── src/
│   ├── services/discogsApi.ts       # +getMasterRelease, +getMasterReleaseVersions; CatalogSearchResult resultType gains 'master'
│   ├── queries/discogsQueries.ts    # +useCatalogMaster, +useCatalogMasterVersions
│   ├── components/
│   │   ├── SearchResultCard.tsx           # stacked-covers variant; click navigates instead of Preview/Add for master results
│   │   ├── MasterReleaseDetailsSection.tsx # new — master-only fields (research Decision 5)
│   │   ├── MasterVersionsTable.tsx         # new — paginated version table (FR-009/010/011)
│   │   ├── MasterVersionsTableSkeleton.tsx # new
│   │   └── ReleasePreviewModal.tsx         # removed (FR-013)
│   ├── pages/
│   │   ├── ReleaseDetailPage.tsx    # new — catalog release detail (distinct from RecordDetailPage)
│   │   └── MasterReleaseDetailPage.tsx  # new
│   └── App.tsx                      # +/app/releases/:discogsId, +/app/masters/:discogsId routes
└── tests/
    ├── unit/SearchResultCard.test.tsx        # extend: master variant, no Add button
    ├── unit/ReleaseDetailPage.test.tsx        # new
    ├── unit/MasterReleaseDetailPage.test.tsx  # new
    ├── unit/MasterVersionsTable.test.tsx      # new
    └── integration/searchResultsFlow.test.tsx # extend: click-through navigation, modal removal

e2e/
└── tests/
    ├── release-detail.spec.ts           # new — quickstart.md Scenario 2
    └── master-release-detail.spec.ts    # new — quickstart.md Scenario 3
```

**Structure Decision**: Existing `backend/` + `frontend/` + `e2e/` layout is reused unchanged (constitution-mandated stack; Option 2 "Web application" from the template). No new top-level project/package is introduced — every addition extends an existing module (`discogsClient`/`discogsMapper`/`discogs.ts` route; `discogsApi`/`discogsQueries`; new pages alongside existing ones in `frontend/src/pages/`).

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
