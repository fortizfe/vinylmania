# Implementation Plan: Search Result Filters

**Branch**: `021-search-result-filters` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-search-result-filters/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The search results screen (`SearchResultsPage`) gains a filter control with four free-text
fields — Artist, Genre, Style, and Format — submitted via an explicit "Apply filters" action.
Applying filters extends the existing catalog search request (already proxied through Discogs'
`/database/search` via `discogsClient.searchCatalog`) with the corresponding
`artist`/`genre`/`style`/`format` query parameters, rather than introducing a new search
integration. Filter state is held in the results URL (alongside the existing `q`/`page`
params) so it survives pagination, reload, and sharing, and can be cleared in one action.

## Technical Context

**Language/Version**: TypeScript (Node.js backend, React 18 frontend) — no version change; reuses the existing stack end-to-end.

**Primary Dependencies**: Express.js + axios + Zod (backend Discogs proxy), React + React Router + TanStack Query (frontend), Tailwind CSS v4 (UI), clsx.

**Storage**: N/A for persistence. Redis cache-aside (`withCache`) already caches Discogs search responses; the cache key MUST be extended to include the active filter values so filtered and unfiltered results don't collide in the cache.

**Testing**: Jest + Supertest + nock (`backend/tests/contract`), Vitest + Testing Library (`frontend/tests/unit`, `frontend/tests/integration`), Playwright (`e2e/tests`) — Test-First per Constitution Principle I.

**Target Platform**: Web (browser client + Node.js/Express server), deployed to Vercel.

**Project Type**: Web application (existing `backend/` + `frontend/` split — Option 2 structure below).

**Performance Goals**: No new performance target; filtered search must stay within the existing unfiltered-search latency envelope (same Discogs proxy call, same cache-aside path, same 2s rating-enrichment timeout budget already in place).

**Constraints**: Must not add a parallel/second search code path (spec FR-009) — filters are additional parameters on the existing `/database/search` call. Must not issue a request per keystroke — a filter change only re-runs search when the user triggers the explicit "Apply filters" action (spec FR-003). Filter values are opaque free text, trimmed only (spec FR-010); no client- or server-side enumeration/validation against a fixed vocabulary.

**Scale/Scope**: One existing endpoint (`GET /api/discogs/search`) gains four optional string query params; one existing screen (`SearchResultsPage`) gains one new filter control component. No new entities, no new persistent storage, no new routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Check | Status |
|---|---|---|
| I. Test-First | Backend contract tests (`discogsSearch.contract.test.ts`) and frontend unit/integration tests must be extended/added *before* implementation; a new e2e spec is required since `/frontend` changes (Development Workflow gate below) | PASS — planned in Phase 1/tasks |
| II. Discogs Integration-First & Modularity | Filters ride on the existing `discogsClient.searchCatalog` → `GET /database/search` integration; no alternate/manual catalog source introduced | PASS |
| III. Simplicity, YAGNI & KISS | No new abstractions beyond typed filter fields threaded through existing layers (route → client → API service → query hook → URL params → UI control) | PASS |
| IV. SOLID | Extends the existing `SearchCatalogOptions` interface additively; no modification of unrelated stable logic (rating enrichment, pagination) | PASS |
| V. Observability | Existing structured search log (`backend/src/routes/discogs.ts`) must note which filters were active, consistent with existing `meta` logging pattern | PASS — planned in tasks |
| VI. Versioning & Breaking Changes | Additive, backward-compatible query params → MINOR version bump in both `backend/package.json` and `frontend/package.json`, with matching `CHANGELOG.md` entries | PASS — planned in tasks |
| Web App Standards: API contracts documented before implementation | `contracts/discogs-search-filters-api.md` and `contracts/search-results-filter-ui.md` produced in Phase 1 | PASS |
| Dev Workflow: e2e coverage for `/frontend` changes | New Playwright spec under `e2e/tests/` covering apply/combine/clear filter flows | PASS — planned in tasks |
| Dev Workflow: CHANGELOG + version bump | Both packages touched (`backend`, `frontend`) → both changelogs + version bumps required | PASS — planned in tasks |
| UI Design System (Tailwind v4, atomic components, skeleton states, dark mode, no layout shift) | Filter control built from existing `Input`/`Button`/`Card` atoms; no new bespoke styling; loading/empty/error states reuse existing skeleton/error patterns | PASS |

No violations identified. Complexity Tracking table below is not needed.

**Post-Phase 1 re-check**: Phase 1 design (`data-model.md`, `contracts/`) introduced no new
entity, endpoint, or dependency beyond what this table already accounts for — the gate
re-evaluation after design confirms the same PASS result for every row above.

## Project Structure

### Documentation (this feature)

```text
specs/021-search-result-filters/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── discogs/
│   │   ├── discogsClient.ts   # extend SearchCatalogOptions + searchCatalog() + cache key
│   │   └── discogsMapper.ts   # unchanged — filters are request-side only
│   └── routes/
│       └── discogs.ts         # extend GET /search to parse+forward artist/genre/style/format
└── tests/
    └── contract/
        └── discogsSearch.contract.test.ts   # extend with filter param cases

frontend/
├── src/
│   ├── components/
│   │   └── SearchFiltersControl.tsx   # new: Artist/Genre/Style/Format fields + Apply/Clear
│   ├── hooks/
│   │   └── useSearchQueryParams.ts    # extend: parse/build filter params alongside q/page
│   ├── pages/
│   │   └── SearchResultsPage.tsx      # wire SearchFiltersControl + filtered empty state
│   ├── queries/
│   │   └── discogsQueries.ts          # extend useCatalogSearch signature with filters
│   └── services/
│       └── discogsApi.ts              # extend search() to send filter query params
└── tests/
    ├── unit/
    │   ├── useSearchQueryParams.test.tsx   # extend
    │   └── SearchFiltersControl.test.tsx   # new
    └── integration/
        └── searchResultsFlow.test.tsx      # extend with filter scenarios

e2e/
└── tests/
    └── search-result-filters.spec.ts       # new Playwright spec (Dev Workflow e2e gate)
```

**Structure Decision**: Existing Option 2 (web application: `backend/` + `frontend/`) is
reused as-is — this feature adds no new top-level project or package, only extends the
already-established Discogs proxy layer (backend) and search results screen (frontend)
along their existing seams.

## Complexity Tracking

*No Constitution Check violations — this table is not needed.*
