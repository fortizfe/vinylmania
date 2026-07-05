# Implementation Plan: Record Detail View Aligned with Preview Layout

**Branch**: `014-record-detail-preview-layout` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-record-detail-preview-layout/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rebuild `RecordDetailPage` to reuse the same presentational components already introduced by the release preview redesign (`013-release-preview-layout-redesign`): a full-width square `ReleaseImageGallery`, a two-column row below it (`ReleaseDetailsSection` key details + tracklist), and a full-width `ReleaseAdditionalInfoSection`, all wrapped in a single shared bordered surface mirroring the preview modal's own `Card` container — per the clarification recorded in spec.md. The one deviation from an exact copy: a new `MyCopySection` component (extracted from the page's existing inline "Your copy" JSX) renders directly below the key details in the left column, preserving the existing inline-edit behavior (autosave, Escape-to-cancel, save confirmation, editable affordance) unchanged. `ReleaseDetailsSection` gains a `format` field (badges), since the current detail page shows format today and the spec's SC-005 forbids losing previously-visible information — this benefits the preview too. Three now-redundant components (`DiscInfoCard`, `RecordHeaderImage`, `TracklistCard`) and their tests are deleted. This is a frontend-only, presentation-layer change — no new data, API, or backend work.

## Technical Context

**Language/Version**: TypeScript 5.x (React 19, Vite) — existing `frontend` package, no version change

**Primary Dependencies**: React, Tailwind CSS v4, clsx, `@tanstack/react-query` (all already in use by the components being reused/changed)

**Storage**: N/A — presentation-only change; consumes the existing `EnrichedLibraryEntry`/`Release` shapes from `frontend/src/services/libraryApi.ts` unchanged

**Testing**: Vitest + React Testing Library for unit/component tests (`frontend/tests/unit/**`) and integration tests (`frontend/tests/integration/**`); Playwright for e2e (`e2e/tests/**`)

**Target Platform**: Web browser (desktop and mobile viewports), served by the existing Vite/React frontend

**Project Type**: Web application (existing `frontend` + `backend` structure); this feature touches `frontend` only

**Performance Goals**: No new performance targets — must not regress existing detail-page load/interaction responsiveness (gallery thumbnail swap, inline-edit autosave)

**Constraints**: The entire detail-page content area MUST render inside a single shared outer bordered surface (per spec Clarifications), with gallery/key-details/my-copy/tracklist/remaining-info as plain, unbordered sections inside it; the my-copy section's existing inline-edit behavior MUST be preserved byte-for-byte; no previously-visible field (including `format`, per SC-005) may be dropped; the page keeps normal browser page-level scrolling (only the gallery's internal thumbnail strip hides its scrollbar, inherited unchanged from `ReleaseImageGallery`); the stacked-vs-two-column breakpoint reuses the existing `lg:` (1024px) convention already used by the preview.

**Scale/Scope**: Single feature-scoped page redesign. Changes: `RecordDetailPage.tsx` (rewritten composition), `RecordDetailSkeleton.tsx` (reshaped to match), one new component (`MyCopySection.tsx`), one extended shared component (`ReleaseDetailsSection.tsx` gains `format`). Deletions: `DiscInfoCard.tsx`, `RecordHeaderImage.tsx`, `TracklistCard.tsx` and their unit tests. No new routes, entities, or API endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: Applies. `frontend/tests/integration/recordDetailFlow.test.tsx` and the three now-deleted component test files must be updated/replaced first to assert the new structure (single outer surface, format badges, my-copy positioned under key details, additional-info section present) and fail against the old markup, then made to pass by the implementation. New unit tests are needed for `MyCopySection`. PASS (planned in tasks).
- **II. Library-First & Modularity**: Applies. Each section (gallery, key details, my copy, tracklist, remaining info) remains a single-purpose, independently testable component; `MyCopySection` is extracted rather than left inline, matching the pattern already established by the preview's section components. `DiscInfoCard`, `RecordHeaderImage`, `TracklistCard` are deleted outright rather than left as dead code once superseded. PASS.
- **III. Simplicity, YAGNI & KISS**: Applies. No new abstraction beyond what reusing four existing section components plus one new my-copy section requires; no new configuration or extensibility points. PASS.
- **IV. SOLID Design**: Applies at component-composition level (each section has one reason to change). No class hierarchies involved. PASS.
- **V. Observability**: N/A — presentation-only change; no new operations, errors, or sync events requiring structured logs.
- **VI. Versioning & Breaking Changes**: Applies per the changelog/version-bump workflow gate below; this is a backward-compatible UI enhancement, not a data/API breaking change.
- **UI Design System & Styling (Tailwind CSS v4)**: Applies directly.
  - Card-based layout: the whole detail-page content area is wrapped in one `<Card>` (mirroring the preview modal's own container), per the spec's Clarifications — this satisfies "primary content blocks MUST be a Card" at the page's single primary content block, rather than one Card per section.
  - Reusable atomic components: `Card`, `Badge`, `Skeleton` are reused as-is; no per-section card styling is reintroduced.
  - Skeleton loading states: `RecordDetailSkeleton` is reshaped to mirror the new section proportions (gallery, two-column row, remaining-info block) inside the same single-card structure, so no layout shift occurs between loading and loaded states.
  - No layout shift: skeleton/error/populated states share the same sizing classes.
  - Theme-variable dark mode: all new/changed markup keeps `dark:` variants consistent with the reused components (already dark-mode-correct).
  PASS — no exceptions needed.
- **Development Workflow gates**: This is a `frontend`-only change, so it MUST include: (a) updated Playwright e2e coverage in `e2e/tests/record-detail-inline-edit.spec.ts` (or a new spec) for the redesigned layout and preserved inline-edit behavior, (b) a `frontend/CHANGELOG.md` entry plus a matching `frontend/package.json` version bump (MINOR, backward-compatible UI enhancement) in the same change, and (c) Conventional Commit format for the eventual commit(s).

No violations requiring Complexity Tracking.

**Post-Phase 1 re-check**: research.md and data-model.md introduce no new entities, dependencies, or API surface beyond what's captured above — `MyCopySection` is a single-purpose extraction of existing inline JSX/behavior, and the `format` addition to `ReleaseDetailsSection` is a small, additive prop-driven rendering change reusing the existing `Badge` component. All gates above still PASS unchanged after design.

## Project Structure

### Documentation (this feature)

```text
specs/014-record-detail-preview-layout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   └── RecordDetailPage.tsx           # Rewritten: composes gallery/details/my-copy/tracklist/additional-info in one shared Card
│   └── components/
│       ├── RecordDetailSkeleton.tsx        # Reshaped to mirror the new single-card, 5-section layout
│       ├── MyCopySection.tsx               # NEW: extracted "Your copy" inline-edit block (condition, notes, remove action)
│       ├── ReleaseDetailsSection.tsx       # Extended: adds `format` badges (used by both preview and detail page)
│       ├── ReleaseImageGallery.tsx         # Reused unchanged
│       ├── ReleaseTracklistSection.tsx     # Reused unchanged
│       ├── ReleaseAdditionalInfoSection.tsx # Reused unchanged
│       ├── DiscInfoCard.tsx                # DELETED — superseded by ReleaseDetailsSection
│       ├── RecordHeaderImage.tsx           # DELETED — superseded by ReleaseImageGallery
│       └── TracklistCard.tsx               # DELETED — superseded by ReleaseTracklistSection
└── tests/
    ├── unit/
    │   ├── MyCopySection.test.tsx           # NEW
    │   ├── ReleaseDetailsSection.test.tsx   # Updated: add format-badge assertions
    │   ├── RecordDetailSkeleton.test.tsx    # Updated for new shape, if a dedicated test exists (else covered via integration)
    │   ├── DiscInfoCard.test.tsx            # DELETED
    │   ├── RecordHeaderImage.test.tsx       # DELETED
    │   └── TracklistCard.test.tsx           # DELETED
    └── integration/
        └── recordDetailFlow.test.tsx        # Updated: single-card structure, format field, additional-info section, unchanged inline-edit assertions

e2e/
└── tests/
    └── record-detail-inline-edit.spec.ts   # Extended or added: layout parity assertions, inline-edit behavior unchanged
```

**Structure Decision**: Web application structure (existing `frontend` + `backend` split; per Constitution's Technology Stack). This feature is `frontend`-only: it rewrites `RecordDetailPage` to compose the release preview's existing section components (Principle II — no duplicated presentation logic between preview and detail), extracts one new single-purpose component (`MyCopySection`) for the page's one interactive concern, and deletes three components that become dead code once superseded (no half-finished or parallel implementations, per Principle III).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
