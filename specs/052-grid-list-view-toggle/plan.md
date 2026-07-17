# Implementation Plan: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

**Branch**: `052-grid-list-view-toggle` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-grid-list-view-toggle/spec.md`

## Summary

Add a second, per-screen presentation mode ("list") to `SearchResultsPage`
and `LibraryListPage`, alongside the existing "grid" (carátula) mode, via a
new accessible two-option toggle control (User Story 1). Each screen gets a
new sibling row component (`SearchResultListRow`, `RecordListRow`) that
reuses the same data, the same "Add to library"/rating/unavailable-catalog
sub-components, and the same infinite-scroll/pagination/filter logic as
today — this is purely a rendering-layer addition (User Stories 2 and 3).
The one non-presentational change is a backend extension: the Discogs
search-result mapper (`discogsMapper.ts`) starts capturing `country` and
`labels` so `CatalogSearchResult` reaches feature parity with the
library's already-complete `Release` type, which the list view in
Resultados de búsqueda needs to show the same six fields as Mi biblioteca.
The chosen mode per screen persists independently in `localStorage`,
following the existing `ThemeContext` pattern.

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend, Vite); TypeScript 5.6
(backend, Node.js `v26`, CommonJS/ES2022 target)

**Primary Dependencies**: React 19.2 + `react-router-dom` 6.26 + Tailwind
CSS v4.3 (frontend, unchanged — no new production dependency; the toggle
icons are hand-rolled inline SVG per existing convention, no icon library
added); Express 4.19 + `zod` 3.23 (backend, unchanged — `country`/`label`
are added to an existing Zod schema, no new dependency).

**Storage**: No new storage. View-mode preference is client-only
(`window.localStorage`, two new independent keys:
`vinylmania:view-mode:search`, `vinylmania:view-mode:library`) — never
sent to Firebase or the backend. Firestore/Discogs data model is unchanged
(no new fields persisted; `country`/`labels` on search results are derived
per-request from the Discogs API response, not stored).

**Testing**: Vitest + React Testing Library (frontend unit — new
`ViewModeToggle.test.tsx`, `SearchResultListRow.test.tsx`,
`RecordListRow.test.tsx`, plus extensions to
`SearchResultsPage`/`LibraryListPage` tests if any exist); Jest +
Firebase emulator (backend — extended `discogsMapper.test.ts`); Playwright
(`e2e/` — extended `search-results-responsive.spec.ts` /
`library-list-responsive.spec.ts` plus new touch-target/persistence
coverage, mirroring `profile-responsive.spec.ts`'s `ThemeToggle`
`boundingBox()` assertions).

**Target Platform**: Web — existing Vercel-deployed `frontend/` +
`backend/` split, unchanged.

**Project Type**: Web application (existing `frontend/` + `backend/`
split).

**Performance Goals**: No new performance target. Mode switching is a pure
client-side re-render with already-loaded data (spec FR-002) — no
additional network request is introduced by switching modes.

**Constraints**: 44×44px minimum touch target for each toggle option
(constitution's UI Design System rule + spec `035-dual-layout-touch-targets`
precedent, spec FR-016); no layout shift between modes/states (constitution
"No layout shift" rule); Principle VIII (hexagonal architecture) governs
the backend mapper change — only the Discogs adapter may read the raw
`country`/`label` field names.

**Scale/Scope**: Two screens, one new shared hook
(`useViewModePreference`), one new shared control (`ViewModeToggle`), two
new row components, two extended type definitions (frontend
`CatalogSearchResult`, backend domain + adapter `CatalogSearchResult`),
one extended Zod schema/mapper function. No new page, route, or backend
domain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | New components (`ViewModeToggle`, `SearchResultListRow`, `RecordListRow`) and the extended `discogsMapper` schema/mapper get failing tests written first, following the existing `SearchResultCard.test.tsx`/`RecordCard.test.tsx`/`discogsMapper.test.ts` conventions (enforced in tasks.md). | PASS |
| II. Discogs Integration-First & Modularity | `country`/`labels` are sourced from the existing Discogs search adapter (`discogsMapper.ts`), not hand-curated; no new alternate catalog source is introduced. | PASS |
| III. Simplicity, YAGNI & KISS | New row components are separate, single-purpose siblings rather than a `variant` prop branching inside the existing (already non-trivial) card components (R5); `useViewModePreference` is a plain parameterized hook, not a new Context, avoiding two near-duplicate Contexts for two independent, page-scoped values (R1). | PASS |
| IV. SOLID | `SearchResultListRow`/`RecordListRow` each have one reason to change (their own layout); they delegate the "Add to library" state machine and rating badge to the existing, unchanged `ResultCardActions`/rating-badge components (R6) rather than re-implementing that logic. | PASS |
| V. Observability | No new operation requiring structured logging is introduced — view-mode switching is a pure client-side UI state change with no server round trip; the backend mapper change reuses `discogsMapper.ts`'s existing error/validation handling for the extended schema. | PASS (N/A for new logging) |
| VI. Versioning & Breaking Changes | `CatalogSearchResult` gains two new **optional** fields (`country?`, `labels?`) — additive, backward-compatible for any other consumer of the search endpoint. This is a MINOR change, not MAJOR; no migration needed. | PASS |
| VII. Curated Ratings & Music News | Not touched — the community rating badge (FR-018) is reused unchanged from its existing component, not reimplemented. | PASS (N/A) |
| VIII. Hexagonal Architecture (Backend) | Only `discogsMapper.ts` (adapter) reads the raw Discogs `country`/`label` field names; `domain/discogsCatalog/types.ts` gains the new fields with no infra knowledge; `application/discogsCatalog/searchCatalogWithRatings.ts` and `discogsRoutes.ts` require no change since both already pass `CatalogSearchResult` objects through untouched (R4). | PASS |
| Additional Constraints (API documented first) | `contracts/discogs-search-api.md` documents the extended response contract before implementation. | PASS |
| Technology Stack | No stack deviation; no new dependency (icons hand-rolled SVG per existing `ThemeToggle`/`CloseIcon` convention, R2). | PASS |
| UI Design System (Tailwind v4, touch targets, dual layout, no layout shift, skeletons) | `ViewModeToggle` reuses `ThemeToggle`'s 44px sizing/`focus-visible:ring` pattern (R2); list-mode rows share sizing classes across loading/empty/populated states per the "No layout shift" rule; existing skeleton loaders (`search-results-skeleton`) get a list-shaped variant when list mode is active, mirroring the mandatory "skeleton mirrors final content shape" rule. | PASS |
| Development Workflow (e2e gate) | New frontend behavior (toggle, both row components, touch targets) gets e2e coverage before merge (`quickstart.md` scenarios), extending the existing responsive specs. | PASS (enforced in tasks.md) |

No violations requiring justification — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/052-grid-list-view-toggle/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── discogs-search-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/src/
├── domain/discogsCatalog/
│   └── types.ts                       # CHANGED: CatalogSearchResult gains country?, labels?
├── adapters/discogsCatalog/
│   └── discogsMapper.ts               # CHANGED: rawSearchResultSchema + mapSearchResult
└── tests/unit/discogsCatalog/adapters/
    └── discogsMapper.test.ts          # CHANGED: new assertions for country/labels

frontend/src/
├── services/
│   └── discogsApi.ts                  # CHANGED: CatalogSearchResult gains country?, labels?
├── hooks/
│   └── useViewModePreference.ts       # NEW: localStorage-backed { mode, setMode }
├── components/
│   ├── ui/
│   │   └── ViewModeToggle.tsx         # NEW: two-option radiogroup control
│   ├── SearchResultCard.tsx           # UNCHANGED
│   ├── SearchResultListRow.tsx        # NEW: list-mode row for search results
│   ├── RecordCard.tsx                 # UNCHANGED
│   └── RecordListRow.tsx              # NEW: list-mode row for library entries
├── pages/
│   ├── SearchResultsPage.tsx          # CHANGED: mode toggle + branch grid/list rendering
│   └── LibraryListPage.tsx            # CHANGED: mode toggle + branch grid/list rendering
└── tests/unit/
    ├── ViewModeToggle.test.tsx        # NEW
    ├── SearchResultListRow.test.tsx   # NEW
    ├── RecordListRow.test.tsx         # NEW
    ├── SearchResultCard.test.tsx      # UNCHANGED
    └── RecordCard.test.tsx            # UNCHANGED

e2e/tests/
├── search-results-responsive.spec.ts  # CHANGED: list-mode + toggle touch-target coverage
├── library-list-responsive.spec.ts    # CHANGED: list-mode + toggle touch-target coverage
├── search-result-filters.spec.ts      # CHANGED (if needed): confirm filters unaffected by mode
└── library-filters.spec.ts            # CHANGED (if needed): confirm filters unaffected by mode
```

**Structure Decision**: Existing `frontend/` + `backend/` web application
split (Option 2 of the template), unchanged. All new files land in the
existing flat conventions confirmed by research (`R5`, `R7`): row
components alongside their card siblings in `frontend/src/components/`,
the toggle in `frontend/src/components/ui/`, the preference hook in
`frontend/src/hooks/`, no new backend domain/port/adapter folder (existing
`discogsCatalog` domain/adapter is extended in place, per Principle VIII).

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
