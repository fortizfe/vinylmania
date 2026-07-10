# Implementation Plan: UI Polish – Search Results & Dashboard Cards

**Branch**: `028-ui-polish-search-dashboard` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-ui-polish-search-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Four presentational polish changes to the frontend, no backend or data changes:
(1) raise the search-results infinite-scroll batch size from 20 to 40
(`PAGE_SIZE` in `SearchResultsPage.tsx`); (2) make search result cards a fixed
height across the whole grid, filling the gap on master (grouped) cards with a
static "Multiple editions" label instead of the omitted format badge/actions
(`SearchResultCard.tsx`); (3) increase the visual contrast of the existing
stacked-covers effect on master cards (same file, `translate`/`rotate`
offsets); (4) make RSS feed article cards on the dashboard a fixed height with
2-line clamps on title and excerpt (`FeedArticleCard.tsx`). All four are
CSS/Tailwind and small JSX changes to existing components; no new components,
routes, or API contracts are introduced.

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend), React 19.2

**Primary Dependencies**: React 19, React Router 6, TanStack Query 5, Tailwind CSS v4, clsx

**Storage**: N/A — presentation-only change; no data model or persistence changes

**Testing**: Vitest + React Testing Library (`frontend/tests/**`); Playwright e2e (`e2e/tests/**`)

**Target Platform**: Web (browser), responsive (mobile/tablet/desktop breakpoints per Tailwind `sm`/`lg`/`xl`)

**Project Type**: Web application (existing `frontend/` + `backend/` split; this feature touches `frontend/` only)

**Performance Goals**: No perceptible regression in search results scroll/paint performance despite doubling batch size (20 → 40 items per fetch)

**Constraints**: Must preserve existing masters-first ordering and infinite-scroll behavior (FR-009); stacked-covers effect and fixed-height cards must not clip or visually break at any supported breakpoint (FR-003, FR-006)

**Scale/Scope**: 4 existing components touched (`SearchResultsPage.tsx`, `SearchResultCard.tsx`, `FeedArticleCard.tsx`, `FeedCarousel.tsx`); no new pages or routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Test-First)**: PASS — existing unit tests for the touched components
  (`tests/unit/SearchResultCard.test.tsx`, `tests/components/FeedArticleCard.test.tsx`,
  `tests/components/FeedCarousel.test.tsx`) will be extended with failing
  assertions (fixed height class/style present, "Multiple editions" label
  renders only for masters, line-clamp classes present) before implementation.
- **Principle II (Discogs Integration-First)**: PASS — no new Discogs data is
  fetched; the "Multiple editions" label is a static string keyed off the
  already-known `result.resultType === 'master'` flag, per the clarification
  that ruled out a live release-count call.
- **Principle III (Simplicity/YAGNI)**: PASS — changes are constrained to
  existing components' Tailwind classes and one conditional label; no new
  abstractions, config flags, or components are introduced.
- **Principle IV (SOLID)**: PASS — no structural changes to responsibilities;
  `SearchResultCard` and `FeedArticleCard` keep their existing single
  responsibility (rendering one card).
- **Principle V (Observability)**: N/A — purely visual/layout change, no new
  operations to log.
- **Principle VI (Versioning)**: PATCH-level — backward-compatible visual
  refinements to existing UI, no schema/contract changes. `frontend/CHANGELOG.md`
  entry + `package.json` PATCH bump required per Development Workflow gates.
- **Web Application Standards / Tailwind v4 rules**: PASS — all sizing changes
  use Tailwind utilities (fixed height via `h-*`/`min-h-*`, truncation via
  `line-clamp-*`), consistent with "No layout shift" and "No custom CSS
  without justification" rules. No `tailwind.config.js` or custom CSS needed.
- **e2e coverage**: Existing specs `e2e/tests/search-result-filters.spec.ts`
  and `e2e/tests/dashboard-feed-carousel.spec.ts` cover the affected flows;
  they will be extended (not replaced) to assert the new fixed-height/label
  behavior per Development Workflow gates (frontend PRs require e2e coverage
  of the affected user flow).

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/028-ui-polish-search-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — skipped, no external interface change
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   └── SearchResultsPage.tsx        # PAGE_SIZE 20 → 40 (FR-001, FR-009)
│   ├── components/
│   │   ├── SearchResultCard.tsx         # fixed height, "Multiple editions" label,
│   │   │                                 # enhanced stacked-covers (FR-002, FR-002a,
│   │   │                                 # FR-003..FR-006)
│   │   ├── SearchResultCardSkeleton.tsx # matched height so skeleton == populated state
│   │   ├── FeedArticleCard.tsx          # fixed height, title/excerpt line-clamp (FR-007, FR-008)
│   │   ├── FeedArticleCardSkeleton.tsx  # matched height so skeleton == populated state
│   │   └── FeedCarousel.tsx             # no code change — explicit fixed height on
│   │                                     # FeedArticleCard (not flex-stretch) makes
│   │                                     # this file's behavior irrelevant to FR-007
│   └── queries/discogsQueries.ts        # perPage threading, unchanged contract
└── tests/
    ├── unit/SearchResultCard.test.tsx
    └── components/
        └── FeedArticleCard.test.tsx

e2e/
└── tests/
    ├── search-result-filters.spec.ts    # extend: fixed-height + label assertions
    └── dashboard-feed-carousel.spec.ts  # extend: fixed-height + line-clamp assertions
```

**Structure Decision**: Existing `frontend/` + `backend/` web-application split
(per constitution Technology Stack) is unchanged. This feature is entirely
frontend-only — no `backend/` files are touched, since no data/contract
changes are required (the "Multiple editions" label and batch-size increase
both use data/parameters already available to the frontend).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — Constitution Check found no violations.
