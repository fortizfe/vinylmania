# Implementation Plan: Search Filter Refinements

**Branch**: `022-search-filter-refinements` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-search-filter-refinements/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refines the feature-021 search filter control on `SearchResultsPage`: (1) the Artist
filter field is removed entirely (backend and frontend no longer recognize an `artist`
filter parameter at all, so old links carrying one are silently ignored), and (2) the
Format filter changes from a free-text `Input` to a fixed, multi-select checklist drawn
from a static, curated list of ~33 standard Discogs format names, opened from a compact
trigger button inside the existing filter `Card` via the existing `Modal` component.
Multiple selected format values are joined into a single comma-separated string and sent
as one value in the existing `format` query parameter, preserving the single-request
integration with Discogs' `/database/search` established in feature 021. Live verification
against the real Discogs API during implementation (task T014) showed this combined
request narrows results to releases available in ALL selected formats simultaneously
(AND semantics), not ANY of them (OR) as originally assumed; this was accepted as the
final behavior and the spec was updated accordingly rather than switching to a
per-value-request-and-merge fallback. Genre and Style remain unchanged free-text inputs;
the explicit "Apply filters"/"Clear filters" actions and URL-persistence behavior are
unchanged.

## Technical Context

**Language/Version**: TypeScript (Node.js backend, React 18 frontend) — no version change; reuses the existing stack end-to-end.

**Primary Dependencies**: Express.js + axios + Zod (backend Discogs proxy), React + React Router + TanStack Query (frontend), Tailwind CSS v4 (UI), clsx. No new dependencies.

**Storage**: N/A for persistence. Redis cache-aside (`withCache`) already keys search responses by filter values (including `format`); the comma-joined multi-format string is just a different string value in that same key segment, so no cache-key structure change is needed.

**Testing**: Jest + Supertest + nock (`backend/tests/contract`), Vitest + Testing Library (`frontend/tests/unit`, `frontend/tests/integration`), Playwright (`e2e/tests`) — Test-First per Constitution Principle I.

**Target Platform**: Web (browser client + Node.js/Express server), deployed to Vercel.

**Project Type**: Web application (existing `backend/` + `frontend/` split — Option 2 structure, unchanged from feature 021).

**Performance Goals**: No new performance target; unchanged from feature 021 (same single Discogs proxy call, same cache-aside path, same 2s rating-enrichment timeout budget).

**Constraints**: Must not introduce a parallel/second search path or a request-per-selected-format-value pattern (spec FR-011) — all selected formats travel in one request via the existing single `format` parameter. Artist parsing/forwarding must be removed, not merely hidden in the UI, so old links carrying `artist` are truly ignored rather than erroring (spec FR-009). The fixed format list is a static, curated, frontend-owned constant — no new endpoint or dynamic fetch (consistent with feature 021's Assumptions that no Discogs endpoint enumerates valid format values).

**Scale/Scope**: One existing endpoint (`GET /api/discogs/search`) loses one recognized query param (`artist`) and keeps `format` as a single string (now potentially comma-joined). One existing component (`SearchFiltersControl`) drops one field and replaces one `Input` with a new modal-based multi-select. One new UI atom (`Checkbox`) and one new static constants file (format list). No new entities, no new persistent storage, no new routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Check | Status |
|---|---|---|
| I. Test-First | Backend contract tests and frontend unit/integration tests updated/added *before* implementation; existing e2e spec extended for the new multi-select flow and updated for Artist removal | PASS — planned in Phase 1/tasks |
| II. Discogs Integration-First & Modularity | Format multi-select still rides the existing `discogsClient.searchCatalog` → `GET /database/search` integration via the existing single `format` parameter (clarification: comma-joined single request, not one call per value); no alternate/manual catalog source or parallel request path introduced | PASS |
| III. Simplicity, YAGNI & KISS | Reuses existing `Modal`/`Card`/`Button` atoms; only one new atom (`Checkbox`) and one static data file are added — no new state-management library or abstraction layer | PASS |
| IV. SOLID | `SearchFilters`/`SearchCatalogOptions` are narrowed (artist removed) and format's shape changes additively at the type level (`string` → `string[]` at the UI/URL boundary, still a single string at the Discogs-request boundary); no modification of unrelated stable logic (genre/style handling, pagination, rating enrichment) | PASS |
| V. Observability | Existing structured search log (`backend/src/routes/discogs.ts`) continues to note active filter keys; `artist` simply stops appearing in that set once removed | PASS |
| VI. Versioning & Breaking Changes | Removing the `artist` query param from recognized filters is backward-compatible at the API level (old requests with `artist` just have it ignored, no error) but is a user-facing feature removal + the Format filter's accepted values/shape changes — treated as MINOR in both `backend/package.json` and `frontend/package.json` (additive-compatible request handling, no schema/storage break), with `CHANGELOG.md` entries in both packages calling out the Artist removal and Format multi-select change explicitly | PASS — planned in tasks |
| Web App Standards: API contracts documented before implementation | `contracts/discogs-search-filters-api.md` (delta from feature 021) and `contracts/search-results-filter-ui.md` produced in Phase 1 | PASS |
| Dev Workflow: e2e coverage for `/frontend` changes | Existing Playwright spec (`e2e/tests/search-result-filters.spec.ts`) updated: Artist-field assertions removed, new format multi-select scenarios added | PASS — planned in tasks |
| Dev Workflow: CHANGELOG + version bump | Both packages touched (`backend`, `frontend`) → both changelogs + version bumps required | PASS — planned in tasks |
| UI Design System (Tailwind v4, atomic components, skeleton states, dark mode, no layout shift) | New `Checkbox` atom follows existing atom conventions (Tailwind v4 utilities, dark mode support); format picker uses the existing `Modal` atom (already dark-mode-aware) so the compact trigger button in the filter `Card` keeps the control's height stable regardless of how many formats are selected (no layout shift) | PASS |

No violations identified. Complexity Tracking table below is not needed.

**Post-Phase 1 re-check**: Phase 1 design (`data-model.md`, `contracts/`) introduced no new
entity, endpoint, or dependency beyond what this table already accounts for (one new static
list, one new UI atom, no new routes) — the gate re-evaluation after design confirms the
same PASS result for every row above.

## Project Structure

### Documentation (this feature)

```text
specs/022-search-filter-refinements/
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
│   │   └── discogsClient.ts   # remove `artist` from SearchCatalogOptions/cache key/request params;
│   │                          # `format` stays a single string param (now potentially comma-joined
│   │                          # by the frontend) — no structural change here
│   └── routes/
│       └── discogs.ts         # remove 'artist' from FILTER_PARAM_NAMES so it's no longer parsed/forwarded
└── tests/
    └── contract/
        └── discogsSearch.contract.test.ts   # remove artist-specific cases; add comma-joined multi-format case

frontend/
├── src/
│   ├── constants/
│   │   └── formatOptions.ts           # new: static FORMAT_OPTIONS list (~33 canonical Discogs format names)
│   ├── components/
│   │   ├── ui/
│   │   │   └── Checkbox.tsx           # new atom: labeled checkbox input (Tailwind v4, dark mode)
│   │   └── SearchFiltersControl.tsx   # remove Artist Input; replace Format Input with a trigger
│   │                                  # button + Modal containing a FORMAT_OPTIONS checklist
│   ├── hooks/
│   │   └── useSearchQueryParams.ts    # SearchFilters: drop `artist`, `format` becomes string[];
│   │                                  # parse comma-joined format param, drop values not in
│   │                                  # FORMAT_OPTIONS (FR-010), join on build
│   ├── pages/
│   │   └── SearchResultsPage.tsx      # update FILTER_LABELS/active-filter summary for format array;
│   │                                  # drop artist references
│   ├── queries/
│   │   └── discogsQueries.ts          # SearchFilters type flows through unchanged (already generic)
│   └── services/
│       └── discogsApi.ts              # encode filters.format (string[]) as one comma-joined query value
└── tests/
    ├── unit/
    │   ├── useSearchQueryParams.test.tsx      # extend: format array parse/build/drop-unknown; artist removed
    │   ├── SearchFiltersControl.test.tsx      # extend: no Artist field, format modal multi-select behavior
    │   └── components/ui/Checkbox.test.tsx    # new: renders label, toggles checked state
    └── integration/
        └── searchResultsFlow.test.tsx         # extend: multi-format OR scenario, artist absence, obsolete-value links

e2e/
└── tests/
    └── search-result-filters.spec.ts       # update: remove Artist assertions, add format multi-select flow
```

**Structure Decision**: Existing Option 2 (web application: `backend/` + `frontend/`) is
reused as-is — this feature adds no new top-level project or package, only refines the
already-established filter control (frontend) and its existing Discogs proxy passthrough
(backend) along the same seams feature 021 introduced.

## Complexity Tracking

*No Constitution Check violations — this table is not needed.*
