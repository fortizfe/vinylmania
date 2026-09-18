# Implementation Plan: Fix gaps in the two-column record detail layout

**Branch**: `065-fix-detail-column-gaps` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/065-fix-detail-column-gaps/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The desktop two-column layout on the release, library-record, and master-release detail pages shows a visible empty gap in one column whenever a card next to it in the other column is taller — root-caused to CSS Grid sharing row height across the two logical columns because cards are placed with only `grid-column`, never `grid-row` (see `research.md` R1). The fix is two-pronged: `MasterReleaseDetailPage`/`MasterReleaseDetailSkeleton` swap their top gallery/info CSS Grid pair for a plain Flexbox row (zero JS, zero DOM change — R2); `RecordDetailLayout`/`RecordDetailSkeleton` (the interleaved, multi-card case shared by `ReleaseDetailPage` and `RecordDetailPage`) adopt a new small `useIndependentColumnLayout` hook that positions cards via measured (`ResizeObserver`) offsets instead of CSS Grid rows, preserving the exact current DOM/tab/mobile order per FR-005/006 (R3) — a constraint reaffirmed during this feature's clarification and planning precisely because grouping cards into column-wrapper `<div>`s (the simpler, industry-standard fix, and what an earlier closed attempt at this bug did) would have changed that order.

## Technical Context

**Language/Version**: TypeScript ~6.0 (`frontend/package.json`), React 19.2

**Primary Dependencies**: React 19, Tailwind CSS v4, `clsx` — no new dependency added; `ResizeObserver`/`matchMedia` are native browser APIs (see `research.md` R3 for why a masonry library was rejected)

**Storage**: N/A — client-side layout only, no data model changes (`data-model.md`)

**Testing**: Vitest + React Testing Library (unit/integration, Test-First per Constitution Principle I), Playwright e2e (chromium + webkit, mandatory for any `/frontend` PR per the constitution's Development Workflow gate)

**Target Platform**: Web browsers (desktop + mobile viewports), Vercel-hosted SPA

**Project Type**: Web application monorepo (`frontend/` + `backend/`) — this feature touches `frontend/` only

**Performance Goals**: Layout recomputation triggered only by `ResizeObserver`/breakpoint-change events (no polling); cost bounded by the fixed, small number of cards per page (≤ 7) — not a scale-sensitive path

**Constraints**: MUST preserve today's DOM/keyboard/screen-reader order and mobile card order exactly (spec FR-005/006); MUST NOT introduce a shared-row gap on any card-height combination (FR-001/002); MUST apply identically to the loading skeleton (FR-008); MUST meet WCAG 2.1 AA (constitution Principle X, already governs this UI)

**Scale/Scope**: 3 pages (`ReleaseDetailPage`, `RecordDetailPage`, `MasterReleaseDetailPage`) plus their 2 skeleton components; no user/data scale dimension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Test-First | PASS | New `useIndependentColumnLayout` hook and every changed component get failing tests first (contract in `contracts/useIndependentColumnLayout.contract.md`); e2e specs extended with regression assertions (R5). |
| II. Discogs Integration-First & Modularity | N/A | No catalog data touched. |
| III. Simplicity, YAGNI & KISS | PASS (with justification) | `MasterReleaseDetailPage` gets the simplest possible fix (pure Flexbox, R2). The JS-measured hook is used *only* where a pure-CSS fix is architecturally impossible given FR-005/006 (R3) — see Complexity Tracking below. |
| IV. SOLID Design | PASS | The hook is a single-responsibility layout primitive consumed identically by two components (open/closed: neither `RecordDetailLayout` nor `RecordDetailSkeleton` needs to know *how* positions are computed). |
| V. Observability | N/A | No new operations to log; this is a pure rendering fix with no server-side or async-operation surface. |
| VI. Versioning & Breaking Changes | PASS | No API/schema contract changes; this is a PATCH-level UI bug fix (`fix:` commit type). |
| VII. Curated Ratings & Music News | N/A | Not touched. |
| VIII. Hexagonal Architecture (Backend) | N/A | No `backend/` changes. |
| IX. Frontend Network Requests — Backend-Only | N/A | No new network calls introduced. |
| X. Accessibility — WCAG 2.1 AA (NON-NEGOTIABLE) | PASS | The chosen approach (R3) is specifically the one that preserves DOM/tab order exactly, which is what this principle requires; verified via User Story 3 / FR-005 test expectations. |
| XI. Apple Design Principles Compliance | PASS | No visual/motion changes — cards keep their existing design; no animation is introduced (consistent with `RecordDetailLayout`'s existing "no entrance animation" rule). |
| Dual responsive layout (UI Design System) | PASS | Desktop two-column and mobile single-column states both preserved; the fix only corrects desktop column-stacking mechanics. |

No unresolved violations. One Simplicity trade-off is justified below (Complexity Tracking).

*Re-checked post-Phase-1 design (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`): no new violations introduced by the concrete hook contract or the Flexbox restructure — the table above already reflects this post-design state.*

## Project Structure

### Documentation (this feature)

```text
specs/065-fix-detail-column-gaps/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── useIndependentColumnLayout.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── hooks/
│   │   └── useIndependentColumnLayout.ts        # NEW — R3
│   ├── components/
│   │   └── recordDetail/
│   │       ├── RecordDetailLayout.tsx            # MODIFIED — consumes the new hook
│   │       └── RecordDetailSkeleton.tsx          # MODIFIED — consumes the new hook
│   └── pages/
│       └── MasterReleaseDetailPage.tsx           # MODIFIED — Flexbox restructure (R2)
│           # (MasterReleaseDetailSkeleton.tsx follows the same restructure)
└── tests/
    ├── setup.ts                                  # MODIFIED — add ResizeObserver test stub (R4)
    └── unit/
        ├── useIndependentColumnLayout.test.ts    # NEW
        ├── RecordDetailLayout.test.tsx            # MODIFIED (existing file)
        └── RecordDetailSkeleton.test.tsx          # MODIFIED (existing file, if present)

e2e/
└── tests/
    ├── release-detail-responsive.spec.ts          # MODIFIED — gap regression assertions (R5)
    ├── record-detail-responsive.spec.ts           # MODIFIED — gap regression assertions (R5)
    └── master-release-detail-responsive.spec.ts   # MODIFIED — gap regression assertions (R5)
```

**Structure Decision**: Web application monorepo, `frontend/` only (Option 2 shape, backend untouched). No new top-level directories — the new hook lives alongside the project's existing `frontend/src/hooks/` convention, and every other change is a modification to a file already touched by the pages/components this bug affects.

## Complexity Tracking

> Justifying the one Simplicity (Principle III) trade-off flagged in the Constitution Check above.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A ~100-line custom `ResizeObserver`-based positioning hook, instead of a pure-CSS fix, for `RecordDetailLayout`/`RecordDetailSkeleton` only | These two components interleave rail and content cards across multiple positions down the page (not just one adjacent pair), so achieving independent per-column stacking heights requires either grouping cards into two column-wrapper `<div>`s or measuring/positioning them in JS | Grouping into column wrappers (the standard CSS-only two-column pattern, and what `MasterReleaseDetailPage` uses instead, R2) would change the DOM/tab/reading order from today's interleaved sequence to a column-grouped one — which conflicts with spec FR-005/FR-006, reaffirmed during `/speckit-clarify` and the plan-time decision on this exact trade-off. CSS Grid `masonry` (which would need no JS) is not supported by any shipping Chromium or WebKit release, and the project's e2e suite covers WebKit. |
