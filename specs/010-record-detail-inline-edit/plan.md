# Implementation Plan: Record Detail View Redesign with Inline Editing

**Branch**: `010-record-detail-inline-edit` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-record-detail-inline-edit/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Redesign the existing `RecordDetailPage` into four blocks (header image, disc
information, tracklist, my copy) that reflow between a single stacked column
(narrow viewports) and a two-column layout (wide viewports: full-width image,
left column = disc info + my copy, right column = tracklist) using Tailwind's
responsive utilities, with no JS-based device detection. Replace the existing
Edit/Save/Cancel form for "my copy" with per-field click/tap-to-edit inputs
that autosave on blur/Enter, show a hover (desktop) / permanent (touch) editable
affordance, a transient save confirmation, and Escape-to-cancel. All catalog
data needed (title, artist(s), year, formats, genres, images, tracklist)
already exists on the `Release` model; the existing `PATCH /api/library/:id`
endpoint already supports partial updates (`condition` and `notes`
independently), so this is a frontend-only change.

## Technical Context

**Language/Version**: TypeScript (React 19), per the existing `frontend/`
package — no version change

**Primary Dependencies**: React, react-router-dom, Tailwind CSS v4, `clsx` —
all already in `frontend/package.json`. No new dependency is introduced (no
new form library needed; per-field inline editing is implemented with local
component state).

**Storage**: N/A for this feature — reads/writes go through the existing
`frontend/src/services/libraryApi.ts` (`getOne`, `update`) and existing
backend `PATCH /api/library/:id` endpoint; no schema change.

**Testing**: Vitest + React Testing Library for component/unit behavior
(`frontend/tests/`), Playwright for e2e (`e2e/tests/`) — required by the
constitution's e2e quality gate for any `/frontend` change (see Constitution
Check below).

**Target Platform**: Web (responsive: phone through desktop viewport widths),
existing React SPA served by Vite/Vercel.

**Project Type**: Web application (existing `frontend/` + `backend/` split);
this feature only touches `frontend/`.

**Performance Goals**: No new performance target beyond existing UX
expectations — inline field saves should feel instantaneous (optimistic UI:
show the new value immediately, confirm/roll back based on the response).

**Constraints**: Layout transition MUST be driven by CSS responsive
breakpoints reacting to viewport width (no `navigator.userAgent`/device-type
branching); only one my-copy field editable at a time (FR-017); no new
backend endpoint or contract change.

**Scale/Scope**: One page component (`RecordDetailPage.tsx`) redesigned; a
small number of new presentational/interactive components (header image
block, disc-info block, two new inline-editable field components for
condition and notes); no new routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Test-First)**: Component tests for the new inline-edit field
  behavior (click-to-edit, autosave on blur, Escape-to-cancel, save
  confirmation) and for the responsive block ordering MUST be written before
  implementation. PASS (planned in Phase 1 / enforced in tasks).
- **Principle II (Library-First & Modularity)**: The redesign MUST extract the
  inline-editable field behavior into a small reusable component (e.g., an
  `InlineEditableField` used by both condition and notes) rather than
  duplicating click/blur/Escape logic twice. PASS (planned).
- **Principle III (Simplicity, YAGNI & KISS)**: No new state-management
  library, no new form library, no container-query polyfill — plain Tailwind
  responsive utilities and local component state are sufficient given this
  page has no independently-resizable side panel affecting its width. PASS.
- **Principle IV (SOLID)**: The inline-editable field component takes its
  value/onSave via props (single responsibility: edit-one-field UX), independent
  of *which* field (condition vs. notes) or *how* the value is persisted.
  PASS.
- **Principle V (Observability)**: A failed autosave (FR-016) MUST be logged
  (e.g., `console.error` with entryId/field context is the existing project
  convention for client-side failures) so failures are diagnosable, in
  addition to the required inline UI error indicator. PASS.
- **Principle VI (Versioning & Breaking Changes)**: No API contract changes;
  this is additive/backward-compatible UI behavior on the frontend only →
  MINOR change once released. PASS.
- **UI Design System (Tailwind v4)**: New blocks MUST use the existing `Card`
  component (no new ad-hoc card styling), MUST add a skeleton state for the
  header image and disc-info blocks matching `RecordDetailSkeleton`'s
  existing pattern, MUST support dark mode via `dark:` + `@theme` variables,
  MUST avoid layout shift between skeleton/read/edit states of the my-copy
  fields, and MUST NOT introduce a `tailwind.config.js` or custom CSS. PASS
  (planned; `RecordDetailSkeleton.tsx` will be updated to mirror the new
  4-block structure).
- **Development Workflow — e2e quality gate (constitution v1.6.0)**: Since
  this PR changes `/frontend`, it MUST add/update Playwright e2e coverage
  under `/e2e` for the affected flow (viewing a record's detail and editing
  condition/notes inline) before the feature is complete. PASS (planned in
  tasks; existing `e2e/tests/` auth specs show the project's Playwright +
  Firebase-emulator pattern to follow).
- **Development Workflow — CHANGELOG gate (constitution v1.7.0)**: This PR
  touches `/frontend`, so `frontend/CHANGELOG.md` (added in feature
  009-changelog-semver-setup) MUST get an `Unreleased` entry describing the
  redesign. PASS (planned as a task).
- **Technology Stack**: No deviation — stays within React/TypeScript/Tailwind
  v4 on the existing `frontend/` package. PASS.

No violations — Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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
│   ├── pages/
│   │   └── RecordDetailPage.tsx        # EDIT — restructure into 4-block responsive layout
│   ├── components/
│   │   ├── RecordDetailSkeleton.tsx    # EDIT — mirror new 4-block structure
│   │   ├── RecordHeaderImage.tsx       # NEW — header image block (+ placeholder state)
│   │   ├── DiscInfoCard.tsx            # NEW — read-only title/artist/year/format/genre
│   │   ├── TracklistCard.tsx           # NEW — read-only tracklist block (extracted from page)
│   │   └── ui/
│   │       └── InlineEditableField.tsx # NEW — reusable click/tap-to-edit + autosave + Escape-cancel
│   └── services/
│       └── libraryApi.ts               # NO CHANGE — update() already supports per-field partial saves
└── tests/
    ├── unit/                            # NEW/EDIT — InlineEditableField behavior tests
    └── integration/
        └── recordDetailFlow.test.tsx    # EDIT — cover inline edit + responsive block order

e2e/
└── tests/
    └── record-detail-inline-edit.spec.ts  # NEW — Playwright coverage per e2e quality gate

backend/                                  # NOT TOUCHED — Release model and PATCH endpoint
                                           # already expose everything this feature needs
```

**Structure Decision**: Existing Web application layout (`frontend/` +
`backend/`). This feature is frontend-only: it edits the existing detail page
and skeleton, adds a small set of new presentational/interactive components
under `frontend/src/components/`, and adds e2e coverage under the existing
`/e2e` Playwright project. No backend files are touched, since `Release`
already carries `formats`, `genres`, `images`, and `tracklist`, and the
`PATCH /api/library/:id` endpoint already accepts `condition`/`notes`
independently (verified in research.md).

## Complexity Tracking

> Not applicable — Constitution Check reported no violations.
