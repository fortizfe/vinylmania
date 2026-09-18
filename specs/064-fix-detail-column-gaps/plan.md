# Implementation Plan: Corregir huecos entre tarjetas en el layout de dos columnas del detalle de release

**Branch**: `064-fix-detail-column-gaps` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/064-fix-detail-column-gaps/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The two-column detail layout (`ReleaseDetailPage`, `RecordDetailPage`,
`MasterReleaseDetailPage`) currently mixes a top `lg:grid-cols-2` pair with
several `lg:col-span-2` full-width cards below it, sharing one CSS Grid row
coordinate system. Because a Grid row's height is the max of its cells,
the shorter of the top-row pair ends with a visible gap before the next
full-width card starts (research.md Decision 1) — the reported bug. Per
`/speckit-clarify`, the fix does not equalize column height; instead every
card is assigned, once and statically, to one of two fully independent
columns (research.md Decisions 2–3), implemented via a new shared
`DetailColumns` layout component (research.md Decision 4) used by all four
affected detail pages (including `MasterReleaseDetailPage`, added to scope
during planning). This necessarily changes the single-column mobile card
order to match the same column grouping (research.md Decision 5, confirmed
with the user) — there is no CSS mechanism that gives independent-height
desktop columns while keeping today's interleaved mobile order.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 (frontend, Vite + React 19.2)

**Primary Dependencies**: React 19.2, Tailwind CSS v4 (existing page/
component dependencies — no new dependency introduced)

**Storage**: N/A — no data/schema change; pure frontend layout fix (see
data-model.md)

**Testing**: Vitest + React Testing Library (frontend unit/component —
new `DetailColumns.test.tsx`, updated `RecordDetailPage`/
`ReleaseDetailPage`/`MasterReleaseDetailPage` tests, updated
`StreamingLinksSection.test.tsx` for the removed `CARD_SPAN` class),
Playwright (`/e2e` — mandatory per constitution for any `/frontend`
change; rewrites required in `record-detail-responsive.spec.ts`,
`release-detail-responsive.spec.ts`, and
`master-release-detail-responsive.spec.ts` per research.md Decision 8,
since several existing assertions encode the exact bug being fixed)

**Target Platform**: Web application (desktop + mobile browsers), existing
dual-layout responsive convention; same `lg` (1024px) breakpoint as today,
only the columns' internal composition changes

**Project Type**: Web application — frontend-only change within the
existing `frontend/` React app and its `e2e/` Playwright suite; no
`backend/` change

**Performance Goals**: No new hard latency targets; no additional network
requests (pure markup/CSS restructuring of already-rendered content)

**Constraints**: No stretching/height-equalization between columns (spec
FR-009); each column is a fixed, independently-stacked set of cards (spec
FR-007/FR-008); no shared full-width row survives below the two columns —
every card belongs to exactly one column (research.md Decision 2); the
single-column (`<lg`) layout keeps its stacking mechanics, spacing, and
usability unchanged but its card **order** changes to match the column
grouping (spec FR-005, research.md Decision 5); all existing `data-testid`
values are preserved exactly, only their DOM parent changes (see
contracts/DetailColumns.contract.md); fix applies to all four detail
surfaces named in FR-006, not just the three from the 063 unification.

**Scale/Scope**: One new shared component
(`frontend/src/components/DetailColumns.tsx`); four page files updated to
use it (`ReleaseDetailPage.tsx`, `RecordDetailPage.tsx`,
`MasterReleaseDetailPage.tsx`) — no prop or testid removals beyond
`StreamingLinksSection`'s internal, unexported `CARD_SPAN` constant; three
e2e spec files reworked (their "two-column composition" tests specifically,
not the whole file).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | New Vitest+RTL coverage for `DetailColumns` (written first: two-column composition, `<lg` stacking order, no `col-span` leakage); updated Playwright coverage for all three responsive spec files, replacing assertions that encoded the bug (research.md Decision 8), written/updated before the markup changes | PASS (planned in tasks phase) |
| II. Discogs Integration-First & Modularity | No change to how catalog data is sourced or shaped; pure presentation/layout change to already-modular components | PASS |
| III. Simplicity, YAGNI & KISS | Introduces exactly one new component (`DetailColumns`) that removes triplicated grid markup across three pages rather than adding a fourth copy; removes now-dead `CARD_SPAN` code (research.md Decision 6); rejected more complex alternatives (dynamic/masonry balancing, dual-markup-per-breakpoint) in favor of the simplest mechanism that satisfies the resolved requirements (research.md Decisions 2, 4, 5) | PASS |
| IV. SOLID | `DetailColumns` has a single responsibility (two independent stacked columns) and an Open/Closed prop contract (`left`/`right` `ReactNode`, no page-specific logic inside it); no existing component's public prop contract changes except the internal, unexported `CARD_SPAN` removal in `StreamingLinksSection` | PASS |
| V. Observability | N/A — pure client-side CSS/layout change; no new operation worth structured logging | N/A |
| VI. Versioning & Breaking Changes | Additive/behavioral only: no props, testids, or exported types are removed (barring the unexported `CARD_SPAN` constant); this is a `fix` per Conventional Commits — the mobile card-order change is called out explicitly in the PR description as an intentional UI behavior change, not a silent side effect | PASS |
| VII. Curated Ratings & Music News | Not applicable — this feature does not touch ratings or news surfaces | N/A |
| UI Design System (Tailwind v4, atoms, touch targets, dual layout) | `DetailColumns` uses standard Tailwind grid/flex utilities already established in the codebase (`grid-cols-1 lg:grid-cols-2 items-start gap-4`, `flex flex-col gap-4`); no new custom CSS; centralizing the pattern directly satisfies the "reusable atomic components" rule (a repeated utility-class combination must be extracted once it appears more than once); 44×44px touch targets and dual responsive layout are unaffected — same `lg` breakpoint, same single-column collapse mechanism | PASS |
| e2e coverage gate | New/updated Playwright coverage required across all three affected responsive spec files before merge, replacing assertions that encoded the pre-fix behavior | PASS (planned in tasks phase) |

No violations requiring justification — Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/064-fix-detail-column-gaps/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── DetailColumns.contract.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── DetailColumns.tsx              # NEW — shared { left, right } two-column layout
│   │   │                                  #   (research.md Decision 4; contracts/DetailColumns.contract.md)
│   │   └── StreamingLinksSection.tsx      # remove CARD_SPAN ('lg:col-span-2') — dead once
│   │                                      #   always nested inside a DetailColumns wrapper
│   └── pages/
│       ├── ReleaseDetailPage.tsx          # replace hand-rolled grid with <DetailColumns
│       │                                  #   left={Gallery+Tracklist+OtherDetails}
│       │                                  #   right={MainInfo+WantlistPanel?+Streaming} />
│       ├── RecordDetailPage.tsx           # same, right={MainInfo+YourCopy+Streaming}
│       └── MasterReleaseDetailPage.tsx    # same, left={Gallery+Tracklist+VersionsTable},
│                                          #   right={MainInfo+OtherDetails?+Streaming}
├── tests/
│   └── unit/
│       ├── DetailColumns.test.tsx         # NEW
│       └── StreamingLinksSection.test.tsx # updated: no CARD_SPAN assertion
# No backend/ changes — no props, data, or business logic touched.

e2e/
└── tests/
    ├── release-detail-responsive.spec.ts          # rework the two-column composition test:
    ├── record-detail-responsive.spec.ts           #   assert per-column stacking instead of
    └── master-release-detail-responsive.spec.ts   #   "waits for both columns" (research.md
                                                    #   Decision 8); add an uneven-height
                                                    #   regression case per column
```

**Structure Decision**: No new top-level directories or projects. All
source changes live inside the existing `frontend/` app (one new shared
component, four page files, one existing component trimmed) and the
existing `e2e/` Playwright suite (three existing spec files reworked, no
new spec files or browser projects needed). `backend/` is untouched.

## Complexity Tracking

> Not applicable — Constitution Check reported no violations.
