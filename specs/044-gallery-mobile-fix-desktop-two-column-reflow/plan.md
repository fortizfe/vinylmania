# Implementation Plan: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

**Branch**: `044-gallery-mobile-fix-desktop-two-column-reflow` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/044-gallery-mobile-fix-desktop-two-column-reflow/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Two independent frontend-only changes to the three detail pages
(`ReleaseDetailPage`, `MasterReleaseDetailPage`, `RecordDetailPage`) and the
shared `ReleaseImageGallery` component they all render: (1) fix a
WebKit/Safari-only rendering bug — confirmed via a real-browser
reproduction (research.md Decision 1), not present in Chromium — where the
gallery's `aspect-square` container grows to fit all thumbnails instead of
staying square once a release has more than 4 images, by adding a single
`overflow-hidden` class to the component's root element; (2) restructure
each page's top section from a single nested sub-grid (gallery full-width,
then a `lg:grid-cols-2` details+tracklist block, only becoming a true
3-panel row at `xl`) into one flat `grid-cols-1 lg:grid-cols-2 items-start`
grid where the gallery and the page's primary information are the two `lg`
columns and the tracklist/additional-info/versions-table sections move to
independent full-width rows below (research.md Decision 3).

## Technical Context

**Language/Version**: TypeScript ~6.0.2 (frontend, Vite 8 + React 19.2)

**Primary Dependencies**: React 19.2, Tailwind CSS v4 (existing
`ReleaseImageGallery`/page dependencies — no new dependency introduced)

**Storage**: N/A — no data/schema change; this is a pure CSS/layout change,
no new component state or props (see data-model.md)

**Testing**: Vitest + React Testing Library (frontend unit/component,
extends `frontend/tests/unit/ReleaseImageGallery.test.tsx`), Playwright
(`/e2e`, extends `release-detail-responsive.spec.ts`,
`master-release-detail-responsive.spec.ts`, and
`record-detail-responsive.spec.ts` — mandatory per constitution for any
`/frontend` change). This feature additionally requires a **WebKit**
Playwright project for the mobile-containment regression test
(research.md Decision 2) — the existing suite only runs Chromium, which is
exactly why the bug this fixes shipped undetected in spec `043`.

**Target Platform**: Web application (desktop + mobile browsers), existing
dual-layout responsive convention. Confirmed reproduction device for the
bug being fixed: Safari on iPhone 16; root cause is engine-level (WebKit),
not device-specific, so the fix and its regression test target the WebKit
rendering engine broadly.

**Project Type**: Web application — frontend-only change within the
existing `frontend/` React app and its `e2e/` Playwright suite; no
`backend/` change

**Performance Goals**: No new hard latency targets; no additional network
requests are introduced (both changes are CSS/markup restructuring of
already-rendered content)

**Constraints**: The `overflow-hidden` fix must be unconditional (applies
at every breakpoint, not just mobile), since spec FR-003 requires identical
containment behavior between mobile and desktop and the same WebKit bug is
not width-dependent — it reproduces at any viewport once a release has more
than 4 images. The two-column desktop reflow must use `items-start` (not
the CSS Grid default `align-items: stretch`) so the gallery and primary-info
columns never stretch to match each other's height, per the `/speckit-clarify`
resolution. No third layout state may exist between `lg` and `xl` (spec
FR-011) — achieved by removing the existing `xl:grid-cols-3`/`xl:col-span-*`
step entirely rather than adding a new one. No horizontal scroll at any
desktop viewport ≥1024px (spec FR-013).

**Scale/Scope**: One shared component (`ReleaseImageGallery.tsx`, one-class
change) plus three page files' grid restructuring
(`ReleaseDetailPage.tsx`, `MasterReleaseDetailPage.tsx`,
`RecordDetailPage.tsx` — no prop or testid removals, only class/nesting
changes); `e2e/playwright.config.ts` gains a WebKit project scoped to the
gallery-responsive tests; six existing e2e responsive tests need rework
(three "lg-range"/"mobile" containment tests generalized to the new
unconditional fix, three "multi-panel composition wider than the lg-only
cap" tests rewritten since that composition no longer exists as a distinct
state — the HU's own notes flagged this).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Test-First | New/updated Vitest+RTL coverage for the `overflow-hidden` root class; new WebKit Playwright regression test for the >4-image containment bug (written first, confirmed red against the pre-fix code via the research.md repro, confirmed green after); updated Playwright coverage for the new two-column grid structure on all three pages, written before the grid markup changes | PASS (planned in tasks phase) |
| II. Discogs Integration-First & Modularity | No change to how images are sourced (`release.images`/`master.images`, Discogs-derived, untouched); pure presentation/layout change to already-modular components | PASS |
| III. Simplicity, YAGNI & KISS | Mobile fix is a one-class CSS change (`overflow-hidden`) addressing a confirmed root cause, not a speculative rewrite; desktop reflow flattens an existing nested grid into a single grid rather than introducing a new abstraction or state | PASS |
| IV. SOLID | `ReleaseImageGallery`'s public prop contract is untouched (Open/Closed — internal fix only); each page's grid restructuring stays local to that page's own JSX, no shared layout abstraction is forced across pages with different right-column content (search/master/library) | PASS |
| V. Observability | N/A — pure client-side CSS/layout change; no new operation worth structured logging, consistent with how the existing gallery's layout is already unlogged | N/A |
| VI. Versioning & Breaking Changes | Additive/behavioral only: no props, testids, or exported types are removed; page-level testids used by existing e2e specs are preserved (some move to different DOM positions/parents, documented in contracts/DetailPageLayout.contract.md) | PASS (documented as PATCH/fix + reflow as a UI behavior change, no data/contract break) |
| VII. Curated Ratings & Music News | Not applicable — this feature does not touch ratings or news surfaces | N/A |
| UI Design System (Tailwind v4, atoms, touch targets, dual layout) | Two-column reflow uses standard Tailwind grid utilities (`grid-cols-1 lg:grid-cols-2 items-start`), matching the existing `lg` breakpoint convention already used elsewhere on the same pages; no new custom CSS; 44×44px touch targets unaffected (no interactive-control sizing changes) | PASS |
| e2e coverage gate | New/updated Playwright coverage (including the new WebKit project) required for both the mobile containment fix and the desktop reflow, on all three detail pages, before merge | PASS (planned in tasks phase) |

No violations requiring justification — Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/044-gallery-mobile-fix-desktop-two-column-reflow/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ReleaseImageGallery.contract.md
│   └── DetailPageLayout.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── ReleaseImageGallery.tsx        # root: add overflow-hidden (research.md Decision 1)
│   └── pages/
│       ├── ReleaseDetailPage.tsx          # flatten grid to grid-cols-1 lg:grid-cols-2 items-start;
│       │                                  #   gallery + details as the two lg columns; tracklist
│       │                                  #   and additional-info become full-width lg:col-span-2
│       │                                  #   rows below (research.md Decision 3)
│       ├── MasterReleaseDetailPage.tsx    # same restructuring; right column = master details;
│       │                                  #   tracklist + versions table become full-width rows
│       └── RecordDetailPage.tsx           # same restructuring; right column = release details +
│                                          #   MyCopySection; tracklist + additional-info become
│                                          #   full-width rows
├── tests/
│   └── unit/
│       └── ReleaseImageGallery.test.tsx   # extended: overflow-hidden on root container
# No backend/ changes — no props, data, or business logic touched.

e2e/
├── playwright.config.ts                   # add a WebKit project scoped to the gallery-responsive
│                                          #   tests (research.md Decision 2)
└── tests/
    ├── release-detail-responsive.spec.ts          # rework: replace the xl-only "multi-panel"
    ├── master-release-detail-responsive.spec.ts   #   test with an lg-onward two-column assertion;
    ├── record-detail-responsive.spec.ts           #   generalize the containment test to run on
    │                                              #   both Chromium and the new WebKit project;
    │                                              #   add a >4-image case to reproduce the fixed bug
    └── (WebKit-only test file or project-scoped block, see research.md Decision 2)
```

**Structure Decision**: No new top-level directories or projects. All
source changes live inside the existing `frontend/` app (one shared
component, three page files) and the existing `e2e/` Playwright suite,
which gains one new browser project (WebKit) scoped to the affected tests
rather than a project-wide addition, to keep CI runtime bounded per
Principle III. `backend/` is untouched.

## Complexity Tracking

> Not applicable — Constitution Check reported no violations.
