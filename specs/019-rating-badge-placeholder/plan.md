# Implementation Plan: Placeholder Rating Badge for Unrated Releases

**Branch**: `019-rating-badge-placeholder` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-rating-badge-placeholder/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend the existing `ReleaseRatingBadge` component and `releaseRating` presentation helper (introduced in feature 017) so that every search-result and library card always renders a badge, instead of omitting it when no rating is available. `presentRating` changes from "return `null` to signal omission" to "always return a presentation": releases with a valid community rating keep today's numeric value and low/medium/high color band; releases with no rating, an invalid/out-of-range rating, or a failed/timed-out rating lookup get a new `unrated` presentation — the same badge shape showing a dash ("-") on a soft, WCAG AA-compliant gray background. `SearchResultCard` and `RecordCard` drop their `rating &&` conditional guard so the badge renders unconditionally. No backend, API contract, or data-fetching changes are required — this is a pure frontend presentation change built on data the app already has.

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend, React 19 + Vite 8). No backend/Node changes.

**Primary Dependencies**: React 19, Tailwind CSS 4, clsx (all existing; no new dependencies).

**Storage**: N/A — no persistence or API contract changes; the placeholder state is derived entirely from rating data (or its absence/error) the frontend already receives.

**Testing**: Vitest + React Testing Library under `frontend/tests/unit` (component and helper coverage). Playwright e2e under `/e2e/tests`, extending the existing feature-017 rating specs in `caching-navigation.spec.ts` (search results) and `library-discogs-sync.spec.ts` (library cards).

**Target Platform**: Web application (Vercel-deployed frontend).

**Project Type**: Web application — frontend-only change (`frontend/`); no `backend/` code paths are touched.

**Performance Goals**: N/A beyond existing card render performance. No new network calls and no new loading states are introduced beyond the current skeleton → rated/unrated flow.

**Constraints**: No backend/API changes — the existing `communityRating` / `community.rating` payload shapes and the existing 2-second per-release rating-lookup timeout (feature 017) are unchanged. No layout shift versus the current rated/skeleton states (the badge occupies the identical position and size in every state). The placeholder background MUST meet WCAG AA text contrast (>=4.5:1) and MUST be visually distinguishable from the existing low/medium/high band colors (spec FR-003, FR-005, SC-002). Frontend changelog entry + version bump required (Development Workflow gate). E2E coverage of the affected search-result and library card flows is required (Development Workflow gate).

**Scale/Scope**: Localized to `frontend/src/lib/releaseRating.ts`, `frontend/src/components/ui/ReleaseRatingBadge.tsx`, `frontend/src/components/SearchResultCard.tsx`, `frontend/src/components/RecordCard.tsx`, one new theme token in `frontend/src/styles/global.css`, and the existing rating-related unit + e2e tests. Skeleton components (`SearchResultCardSkeleton.tsx`, `RecordCardSkeleton.tsx`) do not reference the rating badge today and need no changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Test-First | New unit tests for `releaseRating`'s `unrated` branch (no rating, zero count, out-of-range, non-finite) and for `ReleaseRatingBadge`'s placeholder rendering/contrast, plus e2e additions to the existing feature-017 specs, are planned before implementation. | PASS |
| II. Discogs Integration-First & Modularity | No new integration surface. The placeholder is derived purely from rating data already sourced from Discogs (or the absence/failure of that lookup); no manual catalog data is introduced. | PASS |
| III. Simplicity, YAGNI & KISS | Reuses the existing badge component and helper; adds one new presentation branch rather than a parallel component or a new prop-driven visibility toggle in each card. | PASS |
| IV. SOLID | Presentation logic (rated vs. unrated decision, band vs. placeholder) stays centralized in `releaseRating.ts`; rendering stays in `ReleaseRatingBadge.tsx`; card components remain simple, unconditional consumers. | PASS |
| V. Observability | Existing structured logging for rating-lookup failures/timeouts (feature 017) is unchanged; this feature only changes the visual outcome of an already-logged condition, not the logging itself. | PASS |
| VI. Versioning & Breaking Changes | Additive, non-breaking presentation change (a previously empty region now renders content). Frontend `CHANGELOG.md` entry and a PATCH/MINOR version bump are required per the Development Workflow gate. | PASS |
| Web App Standards | No persistence/schema change; no user-facing/internal error conflation is introduced — the placeholder is a normal UI state, not an error message. | PASS |
| UI Design System | The new gray token is added to the `@theme` block in `global.css` (not hardcoded inline); the change reuses the existing atomic `ReleaseRatingBadge` component; the no-layout-shift and dark-mode requirements are preserved. | PASS |

**Post-design re-check (after Phase 1)**: No new constitution violations. The design adds a single new `@theme` token and a single new branch to an existing helper/component pair; it introduces no new storage, no new API surface, and no new screens.

## Project Structure

### Documentation (this feature)

```text
specs/019-rating-badge-placeholder/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── lib/
│   │   └── releaseRating.ts             # presentRating always returns a presentation; new 'unrated' state
│   ├── components/
│   │   ├── ui/
│   │   │   └── ReleaseRatingBadge.tsx   # new 'unrated' visual variant (dash text, soft gray background)
│   │   ├── SearchResultCard.tsx         # remove `rating &&` guard; badge always rendered
│   │   └── RecordCard.tsx               # remove `rating &&` guard; badge always rendered
│   └── styles/
│       └── global.css                   # new --color-rating-unrated (+ text color) theme tokens
└── tests/
    └── unit/
        ├── ReleaseRatingBadge.test.tsx  # extend: unrated variant contrast + rendering + a11y label
        └── releaseRating.test.ts        # extend: presentRating never returns null; unrated branch coverage

e2e/
└── tests/
    ├── caching-navigation.spec.ts       # extend feature-017 describe block: unrated search-result card shows placeholder
    └── library-discogs-sync.spec.ts     # extend: unrated library card shows placeholder
```

**Structure Decision**: Keep the existing web-application split. No `contracts/` artifact is produced — this feature changes no API contract, request/response shape, or external interface; it only changes how already-available (or already-absent) rating data is presented on two existing frontend components. All changes are additive extensions of the feature-017 badge/helper pair.

## Complexity Tracking

> No constitution violations requiring justification. Table intentionally empty.
