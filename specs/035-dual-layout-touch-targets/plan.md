# Implementation Plan: Dual Desktop/Mobile Layout & 44px Touch Targets

**Branch**: `035-dual-layout-touch-targets` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-dual-layout-touch-targets/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rebuild the layout and interactive-control sizing of the 9 in-scope screens
(`LandingPage`, `SearchResultsPage`, `LibraryListPage`, `WishlistPage`,
`RecordDetailPage`, `ReleaseDetailPage`, `MasterReleaseDetailPage`,
`ProfilePage`, `DiscogsCallbackPage`) plus the authenticated app header
(`AppHeader` and its search/nav/hamburger/sign-out pieces) so each satisfies
the two new constitution rules (v2.2.0): a purpose-built desktop composition
that uses horizontal space deliberately (multi-column/panels, `xl:` and
below), a purpose-built single-column mobile composition with no horizontal
scroll (below `md`), and a 44×44 CSS px floor on every interactive control at
mobile widths. The technical approach follows the pattern already proven and
documented for the (already-conformant) `DashboardPage`/`FeedArticleBoard`:
one component per screen carrying a full Tailwind breakpoint stack, rather
than parallel desktop/mobile components; and a centralized `min-h-11
min-w-11` touch-target fix in the shared `Button` (`size="icon"` /
`iconButtonClassName()`) and `Input` primitives so most per-screen icon-button
violations are fixed at the component-library level instead of being
patched individually on every screen. No business logic, data, routes, or
API contracts change — this is a pure markup/class-level rework of existing
screens and shared UI components.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19.2 (frontend)

**Primary Dependencies**: Tailwind CSS v4.3 (CSS-first `@theme` config), Vite 8, React Router (existing app routing, unchanged)

**Storage**: N/A — no data/schema changes; feature is presentation-only

**Testing**: Vitest 4 (component/unit tests, `frontend/tests/**`, jsdom) for class/markup/behavior assertions; Playwright (`e2e/tests/**`) for real-viewport geometry assertions (grid column counts, `boundingBox()` ≥44px, `scrollWidth` vs `clientWidth` for horizontal-scroll checks) — same techniques already used in `e2e/tests/dashboard-feed-grid.spec.ts` and `e2e/tests/header-responsive-nav.spec.ts`

**Target Platform**: Web (responsive browser, existing Vercel-deployed SPA)

**Project Type**: Web application (existing `frontend/` + `backend/` split) — this feature is `frontend/`-only

**Performance Goals**: No new performance targets; layout changes MUST NOT introduce additional network requests, client-side data fetching, or measurable rendering regressions versus current screens

**Constraints**: No device-detection (user-agent sniffing) for layout switching — breakpoints only (Tailwind `sm`/`md`/`lg`/`xl`, default scale: 640/768/1024/1280px); no new custom CSS values outside Tailwind's default scale without a documented `@theme` justification; no changes to business logic, Firestore/Discogs data shapes, or API contracts; skeleton loading states must be updated in lockstep with any layout shape change to preserve the "no layout shift" rule

**Scale/Scope**: 9 pages + 1 header composite (4 sub-components) + centralized fixes to ~4 shared atomic components (`Button`, `Input`, `Checkbox` label wrapping, `ThemeToggle`) touched by most of the above

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Applies? | Assessment |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Yes | Tasks phase MUST sequence failing Vitest component tests (markup/class assertions) and failing Playwright e2e specs (geometry assertions: column counts, `boundingBox()` ≥44px, no horizontal scroll) *before* the corresponding layout implementation task, mirroring the existing `dashboard-feed-grid.spec.ts` pattern. PASS (planned, not yet violated). |
| II. Discogs Integration-First & Modularity | No | No Discogs calls, caching, or data modules touched. N/A. |
| III. Simplicity, YAGNI & KISS | Yes | Single-component-with-breakpoints approach (not parallel mobile/desktop component trees) keeps this simple and matches the documented Dashboard precedent; centralizing the 44px fix in `Button`/`Input` avoids repeating the same utility string across ~8 call sites. PASS. |
| IV. SOLID | Yes | No new class hierarchies; existing component boundaries (page vs. atomic vs. composite section) are preserved, only their internal className/JSX structure changes. PASS. |
| V. Observability | No | No new operations, errors, or logging surfaces introduced. N/A. |
| VI. Versioning & Breaking Changes | Yes | Frontend-only, backward-compatible (no schema/contract change) → MINOR bump to `frontend/package.json` + `frontend/CHANGELOG.md` entry required per Development Workflow gate. PASS (planned). |
| VII. Curated Ratings & Music News | No | Rating/news data and degrade-gracefully behavior unchanged; only the visual placement of rating badges/news cards changes. N/A. |
| UI Design System — Card-based layout | Yes | All content blocks continue to use `<Card>`; no hand-rolled card-pattern utility strings introduced. PASS. |
| UI Design System — Reusable atomic components | Yes | Reuse `Button`, `Card`, `Badge`, `Input`, `Checkbox`, etc.; the one duplicate found in research (`LibraryLinkRequired.tsx` hand-rolling Button's primary styles) MUST be converted to use `<Button>` as part of this work. PASS (planned fix, not a new violation). |
| UI Design System — Skeleton loading / no layout shift | Yes | Any screen whose desktop composition changes shape (e.g., `RecordDetailPage`/`ReleaseDetailPage`/`MasterReleaseDetailPage` galleries, `SearchResultsPage` grid) MUST have its skeleton counterpart updated to the same new shape in the same task, per the "share the same sizing classes" rule. Tracked explicitly in Phase 1 design. PASS (planned). |
| UI Design System — Dual responsive layout | Yes | This is the feature's Rule 1. Implemented via Tailwind breakpoint utilities only, no device detection. PASS (this is what's being built). |
| UI Design System — 44×44 touch target | Yes | This is the feature's Rule 2. Implemented via `min-h-11 min-w-11` (Tailwind default `11` = 2.75rem = 44px), no arbitrary values. PASS (this is what's being built). |
| UI Design System — v4-current utility naming | Yes | No deprecated v3 utilities to be introduced; existing v4 utilities audited during research remain v4-current. PASS. |
| UI Design System — No custom CSS without justification | Yes | All sizing fixes use Tailwind's existing default spacing scale (`min-h-11`/`min-w-11`); no new `@theme` values anticipated. PASS. |
| Dev Workflow — e2e coverage required for `/frontend` PRs | Yes | New/extended Playwright specs required per screen (geometry + no-scroll + touch-target assertions), following `dashboard-feed-grid.spec.ts` / `header-responsive-nav.spec.ts` precedent. PASS (planned). |
| Dev Workflow — CHANGELOG + version bump | Yes | `frontend/CHANGELOG.md` MINOR entry + matching `frontend/package.json` version bump required in the same PR. PASS (planned). |
| Dev Workflow — Conventional Commits | Yes | Implementation commits MUST use `feat(frontend):`/`fix(frontend):`/`test(frontend):` etc. PASS (process constraint, not a design gate). |

**Result**: No violations requiring justification. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/035-dual-layout-touch-targets/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — N/A, no data model; documents why
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory is generated: this feature exposes no new or
changed API endpoints, CLI surface, or public interface — it is a pure
frontend presentation/markup change consumed only by end users through the
browser, so there is no producer/consumer interface contract to document.

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx                 # touched: desktop pillar layout
│   │   ├── SearchResultsPage.tsx           # touched: filters+grid desktop layout, mobile 1-col base
│   │   ├── LibraryListPage.tsx             # touched: explicit breakpoint grid (replace auto-fill), touch targets
│   │   ├── WishlistPage.tsx                # touched: placeholder container touch targets only
│   │   ├── RecordDetailPage.tsx            # touched: wide-desktop (xl:) multi-panel composition
│   │   ├── ReleaseDetailPage.tsx           # touched: same pattern as RecordDetailPage
│   │   ├── MasterReleaseDetailPage.tsx     # touched: same pattern + versions table mobile layout
│   │   ├── ProfilePage.tsx                 # touched: desktop side-by-side panels, mobile stacking
│   │   └── DiscogsCallbackPage.tsx         # touched: container touch-target/no-scroll only
│   ├── components/
│   │   ├── AppHeader.tsx                   # touched: verify/lock in 44px on all controls
│   │   ├── HeaderNavIcons.tsx              # touched: icon link touch targets
│   │   ├── HeaderSearchBox.tsx             # touched: submit button touch target
│   │   ├── HamburgerMenu.tsx               # touched: trigger + nav row touch targets
│   │   ├── LandingHeader.tsx               # touched: verify sign-in button touch target
│   │   ├── MasterVersionsTable.tsx         # touched: mobile no-horizontal-scroll layout
│   │   ├── ReleaseImageGallery.tsx         # touched: thumbnail touch targets
│   │   ├── FilterActions.tsx               # touched: icon button touch targets
│   │   ├── ResultCardActions.tsx           # touched: icon button touch target
│   │   ├── LibraryLinkRequired.tsx         # touched: switch to <Button> instead of hand-rolled link
│   │   ├── DiscogsConnectionCard.tsx       # touched: desktop panel composition on ProfilePage
│   │   ├── FeedArticleBoard.tsx            # reference only — NOT touched (already conformant)
│   │   └── ui/
│   │       ├── Button.tsx                  # touched: size="icon" + default "md" → min-h-11/min-w-11
│   │       ├── Input.tsx                   # touched: min-h-11
│   │       ├── Checkbox.tsx                # touched: ≥44px clickable row wrapper
│   │       ├── ThemeToggle.tsx             # touched: min-h-11
│   │       ├── StarRating.tsx              # touched: min-h-11/min-w-11 per star button
│   │       ├── Modal.tsx                   # touched: close button inherits Button icon fix
│   │       └── BackLink.tsx                # touched: min-h-11 tap target
│   └── ... (services/queries/hooks/auth unchanged — no logic touched)
└── tests/
    ├── unit/ui/...                          # extended: Button/Input/Checkbox/ThemeToggle size assertions
    ├── unit/...                             # extended: per-component class assertions where relevant
    └── integration/...                      # extended: page-level composition smoke tests

e2e/
└── tests/
    ├── landing-page-responsive.spec.ts            # new
    ├── search-results-responsive.spec.ts          # new
    ├── library-list-responsive.spec.ts            # new
    ├── wishlist-responsive.spec.ts                 # new
    ├── record-detail-responsive.spec.ts            # new
    ├── release-detail-responsive.spec.ts           # new
    ├── master-release-detail-responsive.spec.ts    # new
    ├── profile-responsive.spec.ts                  # new
    ├── discogs-callback-responsive.spec.ts         # new
    └── header-responsive-nav.spec.ts               # extended: add 44px assertions for all header controls

backend/  # untouched — no backend changes in this feature
```

**Structure Decision**: Existing `frontend/` + `backend/` + `e2e/` split
(Web application, Option 2) is unchanged. This feature is entirely contained
within `frontend/src/pages/**`, `frontend/src/components/**` (including
`components/ui/**` shared atomics), their corresponding `frontend/tests/**`
specs, and new/extended `e2e/tests/**` specs. `backend/` is not touched.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
