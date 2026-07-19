# Implementation Plan: Detail Screens Card-Based Redesign

**Branch**: `057-detail-cards-redesign` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/057-detail-cards-redesign/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the single large bordered container currently wrapping each of the three detail pages (`RecordDetailPage`, `ReleaseDetailPage`, `MasterReleaseDetailPage`) with several smaller, visually subtle `Card` components, one per coherent content group (gallery, main info, your-copy / other-details, tracklist, additional details / versions list), reusing the existing content sub-components unchanged. Cards use a lighter visual weight than the app's current default card style and sit closer together than the app's standard section spacing, per the clarified spec. No data, API, or business-logic changes are involved — this is a pure layout/composition change plus one small additive UI element (a "view on Discogs" link on the master release screen, per spec Clarification Q3).

## Technical Context

**Language/Version**: TypeScript (React 18+), matching the existing `frontend/` codebase

**Primary Dependencies**: React Router (existing routes), TanStack Query (existing `libraryQueries`/`discogsQueries` hooks — unchanged), Tailwind CSS v4, `clsx` (used by the existing `Card` component)

**Storage**: N/A — no data model or persistence changes; all data already flows through existing `Release`/`MasterRelease`/`EntryDiscogsData` types

**Testing**: Vitest + React Testing Library (`frontend/tests/unit/*.test.tsx`, `frontend/tests/integration/*.test.tsx`) for component/page behavior; Playwright (`e2e/tests/*.spec.ts`) for end-to-end flows, per constitution's mandatory e2e-on-frontend-PR rule

**Target Platform**: Web (existing Vercel-deployed frontend), responsive desktop + mobile

**Project Type**: Web application (existing `frontend/` + `backend/` split) — this feature touches `frontend/` only

**Performance Goals**: No new performance targets; must not regress existing page load/interaction responsiveness (purely a DOM/CSS restructuring of already-fetched data)

**Constraints**: Must preserve every existing interactive behavior (rating, condition editors, notes, remove/add-to-library, gallery, tracklist, versions pagination) exactly as-is; must satisfy constitution's card-based layout, dual responsive layout, 44×44px touch target, and dark-mode rules

**Scale/Scope**: 3 pages (`RecordDetailPage`, `ReleaseDetailPage`, `MasterReleaseDetailPage`), reusing 6 existing content components (`ReleaseImageGallery`, `ReleaseDetailsSection`, `MasterReleaseDetailsSection`, `MyCopySection`, `ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`, `MasterVersionsTable`) with no new data-fetching surface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Card-based layout** (UI Design System): SATISFIES — every new content group is rendered via the existing shared `<Card>` component (`frontend/src/components/ui/Card.tsx`); no hand-repeated card utility strings are introduced. "Not heavily marked" is achieved within the sanctioned styling (the component's existing `border-stone-200`/`shadow-sm` is already the lightest end of the constitution's allowed `shadow-sm`/`shadow-md` range) — no new visual variant or custom CSS is needed.
- **Visual lightness & spacing** (UI Design System: "spacing scale generously"): SATISFIES directly, no interpretation needed — the inter-card gap uses `gap-4` at all viewport widths, the constitution's own cited example of "generous" spacing (`gap-4`, `space-y-4`, `p-6`), just applied between cards instead of within one. This is a reduction from the pages' current `gap-6` (still comfortably satisfying the spec's "poca separación" request) without going below the constitution's named value. See research.md Decision 1. *(An earlier draft used `gap-3` on mobile and justified it via interpretation; `/speckit-analyze` flagged that as reinterpreting a MUST rather than adjusting the value, so it was corrected to `gap-4`.)*
- **Reusable atomic components**: SATISFIES — reuses `Card`, `Badge`, `Button`, `StarRating`, `InlineEditableField` as-is; no new atomic component is introduced beyond a small link element on the master "other details" card, which reuses existing link styling conventions already used elsewhere (see research.md Decision 3).
- **Skeleton loading states / No layout shift**: SATISFIES — `RecordDetailSkeleton` continues to render during loading (spec FR-013 explicitly keeps loading/error states as single-message, non-card layouts, matching current behavior for these already-narrow states); no shape mismatch is introduced because the skeleton was never meant to mirror card boundaries down to the sub-section level.
- **Dual responsive layout & 44×44 touch targets**: SATISFIES — the existing `grid-cols-1 lg:grid-cols-2` responsive pattern is preserved per card group; no interactive control's size changes.
- **Theme-variable dark mode**: SATISFIES — `Card` already implements `dark:border-border-dark dark:bg-surface-raised`; no new colors introduced.
- **Test-First / mandatory e2e on frontend PRs**: APPLIES — existing unit tests (`ReleaseDetailPage.test.tsx`, `MasterReleaseDetailPage.test.tsx`, `recordDetailFlow.test.tsx`) and e2e specs (`record-detail-*.spec.ts`, `release-detail*.spec.ts`, `master-release-detail-responsive.spec.ts`) reference `data-testid` values tied to the current single-container structure; these MUST be updated alongside the implementation, not left behind. See research.md Decision 2.
- **Principle II / VIII / IX (Discogs integration, hexagonal backend, frontend-backend-only)**: NOT IMPLICATED — no backend, API, or third-party SDK changes.

**Result**: PASS. No violations requiring Complexity Tracking.

**Post-Design Re-check** (after Phase 0/1 artifacts below): No new dependencies, components, or data structures were introduced beyond what was evaluated above — research.md's four decisions all resolve *within* the existing sanctioned Card/spacing scale, the existing external-link convention, and the existing test suites. Gate remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/057-detail-cards-redesign/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature introduces no new API, service, or public interface — it is a frontend-only presentational restructuring of data already served by existing endpoints.

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── RecordDetailPage.tsx           # restructure into multiple Cards
│   │   ├── ReleaseDetailPage.tsx          # restructure into multiple Cards
│   │   └── MasterReleaseDetailPage.tsx    # restructure into multiple Cards
│   └── components/
│       ├── ui/Card.tsx                    # reused as-is (no changes expected)
│       ├── ReleaseImageGallery.tsx        # reused as-is
│       ├── ReleaseDetailsSection.tsx      # reused as-is
│       ├── MasterReleaseDetailsSection.tsx # reused; may gain a "view on Discogs" link slot
│       ├── MyCopySection.tsx              # reused as-is
│       ├── ReleaseTracklistSection.tsx    # reused as-is
│       ├── ReleaseAdditionalInfoSection.tsx # reused as-is
│       └── MasterVersionsTable.tsx        # reused; mobile per-row Card gets same subtle treatment
└── tests/
    ├── unit/ReleaseDetailPage.test.tsx
    ├── unit/MasterReleaseDetailPage.test.tsx
    └── integration/recordDetailFlow.test.tsx

e2e/
└── tests/
    ├── record-detail-inline-edit.spec.ts
    ├── record-detail-responsive.spec.ts
    ├── release-detail.spec.ts
    ├── release-detail-responsive.spec.ts
    └── master-release-detail-responsive.spec.ts
```

**Structure Decision**: Existing `frontend/src/pages/*DetailPage.tsx` files are edited in place; no new components are required beyond the small "view on Discogs" link addition to `MasterReleaseDetailsSection` (or a sibling within the new "other details" card). No backend changes. Existing unit/integration/e2e test files are updated in place to match the new card structure and `data-testid` layout.

## Complexity Tracking

*No violations — table intentionally omitted.*
