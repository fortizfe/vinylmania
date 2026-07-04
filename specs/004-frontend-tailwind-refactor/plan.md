# Implementation Plan: Frontend Look-and-Feel Refactor (Design System Alignment)

**Branch**: `004-frontend-tailwind-refactor` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-frontend-tailwind-refactor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refactor Vinylmania's existing frontend (landing, library list, record detail,
add-record, and shared header/sign-in components) so its visual implementation
complies with the constitution's Tailwind CSS v4 / UI Design System rules: CSS-first
Tailwind configuration, a shared `<Card>`-based visual language, a small set of
reusable atomic components (`Card`, `Button`, `Badge`, `Avatar`, `Input`, `Skeleton`),
skeleton loading states with no layout shift, a light-default/dark-via-system-
preference theme built on `@theme` CSS variables, and Tailwind v4-current utility
naming. No backend, routing, data model, or user-facing behavior changes are in
scope — this is a presentation-layer-only refactor validated by the existing
integration test suite continuing to pass.

## Technical Context

**Language/Version**: TypeScript ~6.0 (existing `frontend/tsconfig.json`), React 19

**Primary Dependencies**: Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`), `clsx`
for conditional class composition, React Router 6 (existing), Vite 8 (existing)

**Storage**: N/A (no data/storage changes; Firebase/Discogs integrations untouched)

**Testing**: Vitest + React Testing Library (existing `frontend/tests/` unit and
integration suites), extended with unit tests for new atomic components

**Target Platform**: Web browser (existing Vinylmania web app, deployed on Vercel)

**Project Type**: Web application — frontend-only change within the existing
`frontend/` package (backend untouched)

**Performance Goals**: Skeleton placeholder visible on the same render pass a
data-dependent screen mounts (no intermediate blank frame); zero measurable
cumulative-layout-shift (CLS) when a screen transitions between skeleton, empty,
error, and loaded states

**Constraints**: No backend/API/data-model changes; all existing user journeys
(sign in, browse library, view record detail, add record) must keep working exactly
as today (FR-008); no `tailwind.config.js` unless a plugin strictly requires it; no
manual light/dark toggle (system-preference-driven only, per clarified FR-006/FR-007)

**Scale/Scope**: 4 existing pages (`LandingPage`, `LibraryListPage`,
`RecordDetailPage`, `AddRecordPage`) and 4 existing shared components (`AppHeader`,
`GoogleSignInButton`, `LandingHero`, `RecordCard`), refactored onto a new set of ~6
shared atomic components (`Card`, `Button`, `Badge`, `Avatar`, `Input`, `Skeleton`)
plus per-screen skeleton compositions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Requirement | This feature's compliance |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tests before implementation; no merge without a test that would have failed | New atomic components get unit tests first; existing integration tests act as the regression gate for FR-008/SC-006 (no behavior change) |
| II. Library-First & Modularity | Self-contained modules with clear single-purpose responsibility | Each atomic component (`Card`, `Button`, `Badge`, `Avatar`, `Input`, `Skeleton`) is one file with one responsibility and a typed prop contract |
| III. Simplicity, YAGNI & KISS | Simplest design for the stated requirement | `clsx` chosen over `tailwind-variants` (no variant matrices needed yet); no new abstractions beyond what the constitution's styling rules require |
| IV. SOLID Design | Single responsibility, open/closed, no leaking internals | Atomic components expose typed props only; screens compose them without reaching into internal class strings |
| V. Observability | Structured logs for key operations | No new operations/services introduced; existing logging untouched (pure presentation refactor) |
| VI. Versioning & Breaking Changes | Semantic versioning; breaking changes documented | No API/data-schema changes; this is a MINOR-scoped internal refactor with no external contract change |
| Technology Stack — Frontend/Styling | React+TypeScript required; Tailwind CSS v4 required | Confirmed as the only frontend/styling stack used |
| UI Design System & Styling (Tailwind v4) | CSS-first config, cards, reusable atomics, skeletons, no layout shift, theme-variable dark mode, v4 naming, no custom CSS w/o justification | This entire feature exists to satisfy this section; see research.md/data-model.md for the concrete design |
| Development Workflow | Conventional Commits; PRs verify compliance | Followed at commit/PR time; not a design-time gate |

**Result**: PASS — no violations requiring Complexity Tracking justification.

**Post-Design Re-check** (after Phase 1 data-model.md/contracts/quickstart.md):
No new dependency, abstraction, or deviation was introduced during design beyond
what this table already accounts for (`clsx`, the `ui/` atomic component set, and
Tailwind CSS v4 itself). Gate remains **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/004-frontend-tailwind-refactor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/                          # Untouched by this feature
├── src/
└── tests/

frontend/                         # This feature's scope
├── src/
│   ├── components/
│   │   ├── ui/                   # NEW: shared atomic components
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── AppHeader.tsx         # Refactored onto ui/ atomics
│   │   ├── GoogleSignInButton.tsx# Refactored onto ui/ atomics
│   │   ├── LandingHero.tsx       # Refactored onto ui/ atomics
│   │   └── RecordCard.tsx        # Refactored onto Card + Skeleton
│   ├── pages/
│   │   ├── LandingPage.tsx       # Refactored layout only
│   │   ├── LibraryListPage.tsx   # Refactored + skeleton loading state
│   │   ├── RecordDetailPage.tsx  # Refactored + skeleton loading state
│   │   └── AddRecordPage.tsx     # Refactored + skeleton loading state
│   └── styles/
│       └── global.css            # Rewritten CSS-first: @import "tailwindcss" + @theme
└── tests/
    ├── unit/                     # NEW: tests for ui/ atomic components
    └── integration/              # Existing suites, updated only where they assert on class names
```

**Structure Decision**: Single existing `frontend/` package (Vite + React), no new
package or directory boundary introduced. A new `src/components/ui/` folder holds the
shared atomic components mandated by the constitution's UI Design System section;
everything else (pages, routing, services, backend) keeps its current location and
responsibilities.

## Complexity Tracking

*No violations — table intentionally omitted.*
