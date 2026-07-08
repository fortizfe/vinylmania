# Implementation Plan: Refine Search Filters Usability

**Branch**: `023-refine-search-filters` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-refine-search-filters/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Reorder and rebuild the search results filter bar so Format — the highest-priority filter — leads (FR-001), carries a live selection summary label that switches between a full comma-separated list and an abbreviated "First (+N)" form as it stops fitting (FR-002–FR-007), while Genre/Style shrink to free space for it (FR-008–FR-009) and the Apply/Clear actions become icon-only (FR-010–FR-013). All existing filter matching/URL-persistence behavior is preserved unchanged (FR-014). The technical approach: split the existing monolithic `SearchFiltersControl` into independent, reusable filter components (FR-015–FR-016) composed by a slimmer filter-bar container, reusing the project's existing UI kit (`Button`, `Input`, `Checkbox`, `Modal`) and hand-written inline-SVG icon convention (no new icon library dependency).

## Technical Context

**Language/Version**: TypeScript 6.x on React 19 (existing `frontend` package; no version change)

**Primary Dependencies**: React 19, React Router 6 (existing `useSearchQueryParams` hook), Tailwind CSS v4, `clsx`. No new runtime dependencies are introduced — icons are implemented as hand-written inline SVG components, matching the existing convention in `HeaderNavIcons.tsx`/`HamburgerMenu.tsx` (the project has no icon library such as lucide-react/react-icons/heroicons installed).

**Storage**: N/A — filter state continues to live only in the URL query string via the existing `useSearchQueryParams` hook; no new persistence layer.

**Testing**: Vitest + React Testing Library for component/unit tests (`frontend/tests/unit/`, extending `SearchFiltersControl.test.tsx` and adding tests for the new sub-components); Playwright for e2e (`/e2e/tests/search-result-filters.spec.ts`), extended per the constitution's mandatory e2e coverage for `/frontend` changes.

**Target Platform**: Web (existing Vite/React SPA), responsive desktop and mobile layouts — no new breakpoints introduced (spec Assumptions).

**Project Type**: Web application (frontend + backend already present at repo root) — this feature is frontend-only.

**Performance Goals**: N/A beyond existing behavior — this is a UI layout/labeling refinement; no new network calls or debounced/automatic search triggers are introduced (filters remain explicit-Apply per FR-002/FR-014).

**Constraints**: No new external dependency for icons (Principle III, Simplicity/YAGNI) — reuse the inline-SVG pattern; new filter sub-components must be reusable atomic components per the UI Design System rules (dark mode, no layout shift, Tailwind utilities only); existing filter matching/URL-persistence contract (FR-014) must not change.

**Scale/Scope**: One existing component (`SearchFiltersControl.tsx`) refactored into ~4 focused components (a generic text-filter component reused for Genre/Style, the Format filter with its live summary label, an icon-only filter-actions group, and a slimmed filter-bar container that composes them) plus their unit tests, one extended e2e spec, and the mandatory `frontend/CHANGELOG.md` entry + `package.json` MINOR version bump (0.13.0 → 0.14.0) per the constitution's versioning workflow gate.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Task breakdown (`/speckit-tasks`) MUST sequence a failing unit/e2e test before each implementation task for the new components and label logic. |
| II. Discogs Integration-First & Modularity | PASS | No Discogs integration or matching logic changes (FR-014); the new component split directly satisfies the modularity requirement (FR-015/016). |
| III. Simplicity, YAGNI & KISS | PASS | No new dependency added for icons; reuses existing inline-SVG + `Button` `size="icon"` pattern already present in the codebase. |
| IV. SOLID Design | PASS | Splitting Format/Genre/Style/Actions into single-responsibility components with a composing container is the direct mechanism for FR-015/016. |
| V. Observability | PASS (N/A) | No new async operations, error states, or failure modes are introduced; existing search error/empty-state handling is unchanged. |
| VI. Versioning & Breaking Changes | PASS | Additive, backward-compatible UI change → MINOR bump; no schema/API/URL-contract break (FR-014 keeps existing query params unchanged). |
| UI Design System (Tailwind v4) | PASS | New sub-components must use existing atomic components (`Button`, `Input`, `Checkbox`, `Modal`, `Card`) and Tailwind utilities only, with dark-mode variants and no layout shift, per FR-008/FR-009/FR-010–013. |
| Dev Workflow: e2e coverage mandatory | PASS (planned) | `/e2e/tests/search-result-filters.spec.ts` MUST be extended to cover: Format-first ordering, live label text/abbreviation, icon-only Apply/Clear. |
| Dev Workflow: CHANGELOG + version bump | PASS (planned) | `frontend/CHANGELOG.md` MUST get a new `[0.14.0]` entry and `frontend/package.json` version MUST bump to `0.14.0` in the same PR (Principle VI: MINOR). |

No violations requiring justification — Complexity Tracking is not needed for this feature.

**Post-Design Re-check** (after Phase 1 `research.md`/`data-model.md`/`quickstart.md`): No new dependencies, entities, or external contracts were introduced during design — `data-model.md` describes only in-memory UI state reshaping existing `SearchFilters`, and no `contracts/` were needed. All gates above remain PASS with no changes.

## Project Structure

### Documentation (this feature)

```text
specs/023-refine-search-filters/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory is generated for this feature: it does not add, change, or remove any external interface (API endpoint, Discogs request shape, or URL query-param contract) — FR-014 explicitly keeps the existing search/filter contract unchanged. This is a frontend-only presentation/component-structure refinement.

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── SearchFiltersControl.tsx   # Slimmed to a filter-bar container: composes the sub-components below in Format-first order (FR-001)
│   │   └── filters/                   # New: library-first, independently reusable filter components (FR-015, FR-016)
│   │       ├── FormatFilter.tsx       # Format trigger + live summary label (FR-002–FR-007) + its selection Modal
│   │       ├── TextFilterField.tsx    # Generic compact free-text filter, reused for Genre and Style (FR-008)
│   │       └── FilterActions.tsx      # Icon-only Apply/Clear controls (FR-010–FR-013)
│   └── constants/
│       └── formatOptions.ts           # Existing fixed FORMAT_OPTIONS list — unchanged
└── tests/
    └── unit/
        ├── SearchFiltersControl.test.tsx  # Updated: ordering + composition
        └── filters/
            ├── FormatFilter.test.tsx      # New: label states (empty/one/many/abbreviated) per FR-002–FR-007
            ├── TextFilterField.test.tsx   # New: compact Genre/Style behavior per FR-008
            └── FilterActions.test.tsx     # New: icon-only + accessible-name behavior per FR-010–FR-013

e2e/
└── tests/
    └── search-result-filters.spec.ts  # Extended: Format-first order, live label text, icon-only actions
```

**Structure Decision**: Web application structure (Option 2 — `frontend/` + `backend/` already present at the repo root); this feature touches `frontend/` only. Rather than adding new top-level directories, the existing `SearchFiltersControl.tsx` is decomposed into a `frontend/src/components/filters/` subfolder holding the new independent, reusable filter components, keeping `SearchFiltersControl.tsx` itself as the thin composing container (filter-bar), consistent with the project's existing flat `components/` + `components/ui/` convention.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — Constitution Check reported no violations for this feature.
