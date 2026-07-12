# Implementation Plan: Shared Collapsible Filters with Selectable Lists

**Branch**: `038-shared-selectable-filters` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-shared-selectable-filters/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rebuild the Search/Library filter UI as a single shared, collapsible component (starts collapsed, shows an active-filter badge when collapsed, stays expanded until the user collapses it) and turn Genre/Style/Format from free-text/curated-33 into three multi-select checkbox lists backed by curated catalogs (15/757/51 values). The same component is mounted on both `SearchResultsPage` (P1, UI-only, reuses the existing Discogs search integration) and `LibraryListPage` (P2, requires persisting each library entry's genre/style/format at enrichment time so filtering can run against real, queryable data instead of live-only enrichment). Technical approach: generalize the existing `FormatFilter`/`Modal`/`Checkbox` pattern into a reusable selectable-list filter plus a new collapsible wrapper (research.md Decision 5); extend `LibraryEntry` with three new optional array fields written back on every successful enrichment, untouched on failure (Decisions 2–3); filter Library server-side by fetching the full per-user mirror and matching in application code rather than via unsupported multi-field Firestore compound queries (Decision 2); extend Genre/Style to the same comma-joined multi-value shape Format's search integration already uses (Decision 1).

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend, Vite 8 + React 19), TypeScript ^5.6 (backend, Node.js + Express 4.19)

**Primary Dependencies**: React 19, TanStack Query 5 (`@tanstack/react-query`), Tailwind CSS v4, Vitest (frontend unit tests); Express 4.19, firebase-admin 12, Jest 29 (backend unit tests); Playwright (e2e, `/e2e`)

**Storage**: Firestore (`users/{uid}/libraryEntries` — extended with `genre`/`style`/`format` fields, see data-model.md), Redis-backed cache-aside for Discogs responses (`withCache`, existing)

**Testing**: Jest (backend unit/contract), Vitest + React Testing Library (frontend unit/component), Playwright (`/e2e`, mandatory per constitution for any `/frontend` change)

**Target Platform**: Web application (desktop + mobile browsers), existing dual-layout responsive convention

**Project Type**: Web application — `frontend/` (React/TS) + `backend/` (Express/TS), existing split

**Performance Goals**: No new hard latency targets beyond existing Search/Library expectations; in-list search over the 757-value Style list must be instant (client-side substring filter, no network round-trip); Library's in-application filter/paginate path targets the existing "few hundred records per user, loads within a few seconds" bound established in spec 003 (no new indexing infrastructure needed at this scale — research.md Decision 2)

**Constraints**: No horizontal scrolling on any screen hosting the component, in any viewport (spec SC-005); 44×44px minimum touch targets (constitution); OR-within-filter / AND-across-filters combination semantics must match Format's existing Search behavior exactly (FR-015); enrichment failures must never clear previously persisted genre/style/format (FR-024, Clarifications)

**Scale/Scope**: 3 filter fields × 2 screens sharing 1 component; catalogs of 15 (Genre) / 757 (Style) / 51 (Format) static values; per-user library scale unchanged from existing "few hundred records" assumption; 2 existing REST endpoints get contract changes (no new endpoints)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | Tests for the new collapsible/selectable-list component (Vitest/RTL), the library filter-matching logic (Jest), and e2e coverage for both screens (Playwright) must be written before implementation, per constitution and this repo's existing convention (`e2e/tests/search-result-filters.spec.ts`) | PASS (planned in tasks phase) |
| II. Discogs Integration-First & Modularity | Genre/Style/Format remain Discogs-sourced per-release data (unchanged); the three static catalogs are curated *selectable-option vocabularies*, not an alternate source of per-release metadata — same precedent as the existing `FORMAT_OPTIONS` list, which this constitution already accepts. Library persistence adds zero new Discogs requests (write-back reuses already-fetched enrichment data, Decision 3) | PASS |
| III. Simplicity, YAGNI & KISS | Generalizes one existing component (`FormatFilter`) rather than tripling it (Decision 5); reuses `listAllEntries` + in-app filtering instead of new Firestore indexes (Decision 2); no migration script, no build-time codegen pipeline (Decisions 3–4) | PASS |
| IV. SOLID | One collapsible wrapper + one parameterized selectable-list component, each with a single responsibility; Library's filtered-vs-unfiltered branching is additive to the existing `listEntries` path, not a modification of its internals | PASS |
| V. Observability | Enrichment write-back failures/successes log through the existing `libraryEnrichment` logger path (extend, not replace) | PASS |
| VI. Versioning & Breaking Changes | All changes are additive: new optional Firestore fields (MINOR, no migration required — see data-model.md), Genre/Style search param shape change is backward-compatible (single value = one-element array) | PASS |
| VII. Curated Ratings & Music News | Not applicable — this feature does not touch ratings or news surfaces | N/A |
| UI Design System (Tailwind v4, atoms, touch targets, dual layout) | Reuses `Card`/`Modal`/`Checkbox`/`Button` atoms exclusively (FR-023); dual desktop/mobile treatment for the selectable lists is required (FR-012/FR-013), consistent with existing convention | PASS |
| e2e coverage gate | New/extended Playwright coverage required for both Search and Library filter flows before merge | PASS (planned in tasks phase) |

No violations requiring justification — Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/038-shared-selectable-filters/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── search-api.md
│   └── library-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── library/
│   │   ├── types.ts               # LibraryEntry gains genre/style/format
│   │   ├── libraryEnrichment.ts   # write-back genre/style/format on successful lookup
│   │   ├── libraryService.ts      # new filtered-listing path alongside existing listEntries
│   │   └── librarySyncService.ts  # unchanged entry-creation path (fields populate via enrichment, not here)
│   ├── routes/
│   │   ├── library.ts             # GET / gains genre/style/format query params + filtered branch
│   │   └── discogs.ts             # GET /search: genre/style params become multi-value (reuses existing parseFilterParams)
│   └── discogs/
│       └── discogsClient.ts       # genre/style comma-join treated like format (Decision 1)
└── tests/                          # Jest: enrichment write-back, filter-matching logic, route contract tests

frontend/
├── src/
│   ├── components/
│   │   ├── filters/
│   │   │   ├── FormatFilter.tsx        # generalized into a reusable selectable-list filter
│   │   │   ├── SelectableListFilter.tsx  # new, parameterized (label/options/value/onChange/searchable)
│   │   │   ├── CollapsibleFilterPanel.tsx  # new: expand/collapse state + active-filter badge
│   │   │   └── FilterActions.tsx       # unchanged (Apply/Clear)
│   │   └── SearchFiltersControl.tsx    # composes collapsible wrapper + 3x SelectableListFilter
│   ├── constants/
│   │   ├── formatOptions.ts    # regenerated: 51 values (was 33)
│   │   ├── genreOptions.ts     # new: 15 values
│   │   └── styleOptions.ts     # new: 757 values
│   ├── pages/
│   │   ├── SearchResultsPage.tsx   # genre/style destructured as arrays
│   │   └── LibraryListPage.tsx     # gains CollapsibleFilterPanel + filter query params
│   ├── hooks/
│   │   ├── useSearchQueryParams.ts # genre/style: string -> string[]
│   │   └── useLibraryQueryParams.ts # new: page/genre/style/format URL state for Library (FR-010/FR-022)
│   ├── queries/
│   │   └── libraryQueries.ts   # useLibraryList gains filters in its query key
│   └── services/
│       ├── discogsApi.ts       # genre/style comma-joined like format
│       └── libraryApi.ts       # gains genre/style/format params
└── tests/                       # Vitest/RTL: CollapsibleFilterPanel, SelectableListFilter, updated pages

e2e/
└── tests/
    ├── search-result-filters.spec.ts   # extended: multi-select genre/style, collapse/expand, badge
    └── library-filters.spec.ts         # new: Library filter flow (mirrors Search coverage)
```

**Structure Decision**: Existing `frontend/` + `backend/` split is unchanged (Option 2, web application). No new top-level directories. All changes are additive extensions of existing modules/files listed above; no new services or projects are introduced.
