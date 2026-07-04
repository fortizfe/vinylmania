# Implementation Plan: Release Preview Layout Redesign

**Branch**: `013-release-preview-layout-redesign` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-release-preview-layout-redesign/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Redesign the existing `ReleasePreviewModal` layout: the image gallery (main image + vertical thumbnail carousel) spans the full width of the two-column grid in a square format; below it, a two-column row places key release details (title, artist, genres, styles, date, label) on the left and the tracklist on the right; the remaining release information (notes, identifiers, community stats) spans full width beneath that. On mobile, all sections stack in order: gallery, key details, tracklist, remaining information. No scrollbar is ever visibly rendered anywhere in the preview (thumbnail strip, and the modal's own outer scroll container), while all content stays reachable via hidden-but-functional scrolling. This is a presentation-only change to existing React/Tailwind components — no new data, API, or backend work.

## Technical Context

**Language/Version**: TypeScript 5.x (React 19, Vite) — existing `frontend` package, no version change

**Primary Dependencies**: React, Tailwind CSS v4, clsx (all already in use by the components being redesigned)

**Storage**: N/A — presentation-only change; consumes the existing `Release` shape from `frontend/src/services/libraryApi.ts` unchanged

**Testing**: Vitest + React Testing Library for unit/component tests (`frontend/tests/unit/**`), Playwright for e2e (`e2e/tests/**`)

**Target Platform**: Web browser (desktop and mobile viewports), served by the existing Vite/React frontend

**Project Type**: Web application (existing `frontend` + `backend` structure; this feature touches `frontend` only)

**Performance Goals**: No new performance targets — must not regress existing preview open/interaction responsiveness (image swap on thumbnail click, modal open)

**Constraints**: No visible scrollbar anywhere in the preview (thumbnail strip and modal outer container) while remaining fully scrollable; must not alter the shared `Modal` component's default scrollbar behavior for its other call sites; no layout shift between loading and loaded states (Principle: Skeleton loading states)

**Scale/Scope**: Single feature-scoped UI redesign across 3 existing components (`ReleasePreviewModal`, `ReleaseImageGallery`, `ReleaseDetailsSection`) plus one new presentational component for the "remaining information" section; no new routes, entities, or API endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: Applies. Existing unit tests for `ReleasePreviewModal`, `ReleaseImageGallery`, `ReleaseDetailsSection`, and the `addRecordFlow` integration test already assert on the current layout/markup — they must be updated to fail against the new layout first, then made to pass by the implementation. A new component test is needed for the "remaining information" section. PASS (planned in tasks).
- **II. Library-First & Modularity**: Applies. The plan keeps the gallery, key details, tracklist, and remaining-info concerns in separate, single-purpose components (already true for gallery/details; tracklist and remaining-info become their own components rather than being inlined in the modal). PASS.
- **III. Simplicity, YAGNI & KISS**: Applies. No new abstraction beyond what's needed to express 4 layout sections and a reusable "hide scrollbar but keep it scrollable" utility. PASS.
- **IV. SOLID Design**: Applies at component-composition level (each section component has one reason to change). No class hierarchies involved. PASS.
- **V. Observability**: N/A for this presentation-only change — no new operations, errors, or sync events are introduced that would need structured logs.
- **VI. Versioning & Breaking Changes**: Applies per the changelog/version-bump workflow gate (below), not a data/API breaking change. PASS.
- **UI Design System & Styling (Tailwind CSS v4)**: Applies directly.
  - CSS-first config: any new scrollbar-hiding utility must be added as a `@utility`/theme addition in `frontend/src/styles/global.css`, not a new CSS file or `tailwind.config.js`.
  - Card-based layout: the redesigned sections continue to render inside the existing `<Card>`-based `Modal`; no ad-hoc card styling.
  - Reusable atomic components: `Badge`, `Card`, `Skeleton` are reused as-is; any new repeated utility pattern (e.g., section heading style, hidden-scrollbar class) must be centralized rather than repeated across the new components.
  - Skeleton loading states: the existing loading skeleton in `ReleasePreviewModal` must be reshaped to mirror the new section layout (gallery full-width, two-column row, full-width footer), per FR-009.
  - No layout shift: skeleton/empty/populated states must share sizing so the redesign doesn't introduce shift.
  - Theme-variable dark mode: all new/changed markup must keep `dark:` variants consistent with existing components.
  PASS — no exceptions needed.
- **Development Workflow gates**: This is a `frontend`-only change, so it MUST include: (a) updated/added Playwright e2e coverage for the redesigned preview flow (the existing untracked `e2e/tests/release-preview-gallery.spec.ts` must be extended or a new spec added to cover the new layout/order/no-scrollbar behavior), and (b) a `frontend/CHANGELOG.md` entry plus a matching `frontend/package.json` version bump (MINOR, since it's a backward-compatible UI enhancement) in the same change. Conventional Commit format applies to the eventual commit(s).

No violations requiring Complexity Tracking.

**Post-Phase 1 re-check**: research.md and data-model.md introduce no new entities, dependencies, or API surface beyond what's captured above — the scrollbar-hiding utility stays a single CSS addition, and the two new components (`ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`) are single-purpose extractions of existing markup. All gates above still PASS unchanged after design.

## Project Structure

### Documentation (this feature)

```text
specs/013-release-preview-layout-redesign/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── ReleasePreviewModal.tsx        # Composes the 4 sections into the new grid layout
│   │   ├── ReleaseImageGallery.tsx        # Full-width square gallery + hidden-scrollbar thumbnail strip
│   │   ├── ReleaseDetailsSection.tsx      # "Key details" column (title, artist, genres, styles, date, label)
│   │   ├── ReleaseTracklistSection.tsx    # NEW: extracted tracklist column (currently inlined in the modal)
│   │   ├── ReleaseAdditionalInfoSection.tsx # NEW: "remaining information" footer (notes, identifiers, community)
│   │   └── ui/
│   │       └── Modal.tsx                  # Gains an opt-in `hideScrollbar` prop (default false, other call sites unaffected)
│   └── styles/
│       └── global.css                     # Add a reusable hidden-scrollbar utility here (Tailwind v4 @theme/@utility)
└── tests/
    ├── unit/
    │   ├── ReleasePreviewModal.test.tsx           # Updated for new section order/grid
    │   ├── ReleaseImageGallery.test.tsx            # Updated for full-width square + hidden scrollbar
    │   ├── ReleaseDetailsSection.test.tsx           # Updated: no longer renders tracklist/notes/etc.
    │   ├── ReleaseTracklistSection.test.tsx         # NEW
    │   └── ReleaseAdditionalInfoSection.test.tsx    # NEW
    └── integration/
        └── addRecordFlow.test.tsx                  # Updated assertions for new preview structure

e2e/
└── tests/
    └── release-preview-gallery.spec.ts   # Extended: layout order (desktop/mobile), no visible scrollbar
```

**Structure Decision**: Web application structure (existing `frontend` + `backend` split; per Constitution's Technology Stack). This feature is `frontend`-only: it redesigns `ReleasePreviewModal` and its existing child components, extracts two new single-purpose section components (`ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`) to keep each section independently testable (Principle II), and adds one shared CSS utility for hiding scrollbars without removing scroll functionality (Principle III — no new abstraction beyond what four distinct layout sections and one repeated scroll behavior require).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
