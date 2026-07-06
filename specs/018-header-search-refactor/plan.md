# Implementation Plan: Persistent Header Search & Results Page

**Branch**: `018-header-search-refactor` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-header-search-refactor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move catalog search out of the standalone "Add a record" page and into an
always-visible, centered textbox in the app header, available on every
authenticated screen. Submitting a query navigates to a new, dedicated search
results page that reuses the existing result-card, pagination, add-to-library,
and preview behavior unchanged. The old "Add a record" page/route is retired
entirely, and its now-redundant link on "My Library" is removed. This is a
frontend-only UI restructuring — no backend or Discogs-integration contract
changes are needed; existing catalog search/release/library-entry endpoints
and hooks are reused as-is.

## Technical Context

**Language/Version**: TypeScript, React 19.2 (frontend only; no backend changes)

**Primary Dependencies**: `react-router-dom` v6 (routing/navigation + URL query
params), `@tanstack/react-query` v5 (existing `useCatalogSearch`/
`useCatalogRelease` hooks, reused unchanged), Tailwind CSS v4 (styling)

**Storage**: N/A — no schema or persistence changes; feature reuses existing
Discogs catalog search and Firebase-backed library-entry endpoints untouched

**Testing**: Vitest + React Testing Library for component/unit tests
(`frontend/tests`); Playwright for e2e (`/e2e`) — three existing specs
(`library-discogs-sync.spec.ts`, `caching-navigation.spec.ts`,
`release-preview-gallery.spec.ts`) navigate directly to `/app/library/add`
and must be updated to use the header search box and the new results route

**Target Platform**: Web (modern evergreen browsers), responsive from mobile
to desktop widths

**Project Type**: Web application (existing `frontend` + `backend` split);
this feature touches `frontend` only

**Performance Goals**: No regression vs. today's inline search — result
rendering latency on the new results page must match the current
`AddRecordPage` experience (same underlying query/hooks)

**Constraints**: Must preserve existing add-to-library, preview, and
pagination behavior byte-for-byte (FR-004, FR-010); header search box must
not cause layout shift or overflow at any viewport width, per the UI Design
System's "no layout shift" and "visual lightness" rules

**Scale/Scope**: One new page (search results), one modified shared component
(`AppHeader`), one simplified page (`LibraryListPage`), one retired page/route
(`AddRecordPage` / `/app/library/add`), and three e2e specs updated to match

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First**: PASS (with obligation). Tasks must add/adjust failing
  component tests for the header search box and the new results page, and
  update the three affected Playwright specs, before implementation — no new
  exception needed.
- **II. Discogs Integration-First & Modularity**: PASS. No new Discogs
  integration code is introduced; `discogsApi`/`useCatalogSearch`/
  `useCatalogRelease` are reused unchanged, preserving the existing
  rate-limit-aware, cached module boundary.
- **III. Simplicity, YAGNI & KISS**: PASS. The old "Add a record" page is
  retired rather than kept alongside the new one (per clarification), so the
  app ends up with one search surface, not two duplicated ones.
- **IV. SOLID Design**: PASS (design constraint carried into Phase 1). The
  header search input must stay a small, single-responsibility component
  (its own file) rather than inline JSX in `AppHeader`; the results page must
  reuse the existing `SearchResultCard`/`SearchResultCardSkeleton`/
  `ReleasePreviewModal` components and query hooks unmodified, rather than
  re-implementing their logic.
- **V. Observability**: PASS. No new server-side operations are introduced;
  existing error/empty-state handling on search is reused as-is.
- **VI. Versioning & Breaking Changes**: PASS (process obligation, not a
  gate failure). Removing a route/page and a library-page link is a
  user-facing behavior change but not an API/data-schema break; per the
  project's own practice this is a MINOR change and MUST be recorded with a
  `frontend/CHANGELOG.md` entry and matching `package.json` version bump in
  the implementing PR (Development Workflow gate), and the three updated e2e
  specs MUST keep the pipeline's mandatory e2e gate green.

No violations requiring justification — Complexity Tracking is left empty.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md,
contracts/) confirm no new server-side surface, no schema changes, and reuse
of existing Discogs/library contracts unmodified — all gates above still
PASS with no new violations introduced by the design.

## Project Structure

### Documentation (this feature)

```text
specs/018-header-search-refactor/
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
│   │   ├── AppHeader.tsx              # MODIFIED: adds centered HeaderSearchBox
│   │   ├── HeaderSearchBox.tsx        # NEW: header search input + submit → navigate
│   │   ├── SearchResultCard.tsx       # UNCHANGED, reused on the new results page
│   │   ├── SearchResultCardSkeleton.tsx # UNCHANGED, reused
│   │   └── ReleasePreviewModal.tsx    # UNCHANGED, reused
│   ├── pages/
│   │   ├── SearchResultsPage.tsx      # NEW: replaces AddRecordPage's inline results
│   │   ├── LibraryListPage.tsx        # MODIFIED: "Add a record" link removed
│   │   └── AddRecordPage.tsx          # REMOVED (retired per FR-011)
│   ├── queries/
│   │   └── discogsQueries.ts          # UNCHANGED, reused (useCatalogSearch/useCatalogRelease)
│   └── App.tsx                        # MODIFIED: route /app/library/add removed,
│                                       #   new /app/search route added
└── tests/                             # component tests for HeaderSearchBox,
                                        # SearchResultsPage, updated LibraryListPage

e2e/
└── tests/
    ├── library-discogs-sync.spec.ts     # MODIFIED: goto('/app/library/add') → header search flow
    ├── caching-navigation.spec.ts       # MODIFIED: same
    └── release-preview-gallery.spec.ts  # MODIFIED: same
```

**Structure Decision**: Web application, frontend-only change (existing
`frontend/` + `backend/` split; `backend/` is untouched by this feature). No
new top-level directories are introduced — the feature adds one component
(`HeaderSearchBox`), one page (`SearchResultsPage`), and retires one page
(`AddRecordPage`), updating `AppHeader`, `LibraryListPage`, `App.tsx`, and the
three e2e specs that hard-code the old route.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
