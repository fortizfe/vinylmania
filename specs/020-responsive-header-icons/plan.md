# Implementation Plan: Responsive Header Navigation — Icons on Desktop, Hamburger on Mobile

**Branch**: `020-responsive-header-icons` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-responsive-header-icons/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the always-on hamburger menu in the authenticated header with a
width-driven presentation: at viewport widths of 768px and above, Profile,
My wishlist, and My library render as three separate flat outline-style icon
buttons on the right side of the header (matching the existing hamburger/
search icon style); below 768px, the existing hamburger menu remains the
sole entry point to those same three destinations. The switch is pure CSS
(Tailwind responsive utilities), so it reacts to resize/rotation instantly
with no JS media-query logic, no new dependencies, and no change to the
underlying routes or destinations.

## Technical Context

**Language/Version**: TypeScript 6 / React 19 (existing `frontend` package)

**Primary Dependencies**: react-router-dom v6 (navigation), Tailwind CSS v4
(responsive utilities), existing `Button` and `Modal` atomic UI components,
`clsx` (already a dependency, used only if conditional class composition is
needed)

**Storage**: N/A — no data, no new entities, no persistence change

**Testing**: Vitest + React Testing Library (unit, `frontend/tests/unit`),
Playwright (e2e, `/e2e/tests`) — both required per Constitution Principle I
and the Development Workflow's mandatory e2e-for-frontend-PRs gate

**Target Platform**: Web (responsive: mobile browsers up to large desktop
browsers), authenticated app header only

**Project Type**: Web application — frontend-only change within the existing
`frontend/` package of this monorepo (`backend/`, `frontend/`, `e2e/`)

**Performance Goals**: Layout switch must be instantaneous and driven purely
by CSS media queries (no measurable JS work, no layout thrash, no network
calls) — this is a presentational change with no new async work

**Constraints**: No new npm dependencies (icons are hand-authored inline SVGs
matching the existing stroke/`currentColor` style used by `HamburgerIcon` and
`SearchIcon`); Tailwind CSS v4 CSS-first configuration only (no
`tailwind.config.js`); must not regress the existing `HamburgerMenu`
accessibility/behavior contract already covered by
`frontend/tests/unit/HamburgerMenu.test.tsx`

**Scale/Scope**: Single shared component (`AppHeader`) used across every
authenticated route; 3 navigation destinations, 1 new breakpoint-driven
layout; no backend/API surface touched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Applies? | How this feature satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Yes | New unit tests for the icon-nav component and updated `AppHeader`/`HamburgerMenu` tests MUST be written (and seen failing) before implementation; a new/updated e2e spec MUST cover the responsive switch before it's built. |
| II. Discogs Integration-First & Modularity | No | Feature touches no catalog metadata and makes no Discogs calls. |
| III. Simplicity, YAGNI & KISS | Yes | Reuses the existing `Button`/`Modal` primitives and the CSS breakpoint already used by `HeaderSearchBox`; the layout switch is pure Tailwind (`hidden md:flex` / `flex md:hidden`) with no new JS media-query hook, state, or dependency. |
| IV. SOLID Design | Yes | New icon-nav presentation lives in its own component with a single responsibility (rendering the 3 destination icons); `HamburgerMenu` is extended (visibility only), not rewritten; the shared destination list is factored out once instead of duplicated. |
| V. Observability | No | Pure client-side presentational change with no operations to log (no writes, no external calls, no error states beyond existing routing). |
| VI. Versioning & Breaking Changes | Yes | Additive, backward-compatible UI change → MINOR bump to `frontend/package.json` plus a `frontend/CHANGELOG.md` entry under `Added`/`Changed`, per Development Workflow gates. |
| Web App Standards (Tech Stack lock-in) | Yes | Stays entirely within React+TypeScript, Tailwind CSS v4, and the existing component/testing stack — no deviation to justify. |
| UI Design System (Tailwind v4 rules) | Yes | New icons follow the current inline-SVG icon pattern (no icon library added); layout uses existing spacing/soft-shadow scale; dark mode support carried through via the existing `Button` variants; no custom CSS introduced. |
| Development Workflow — e2e for frontend PRs | Yes | A Playwright spec covering both the wide-viewport (icons) and narrow-viewport (hamburger) flows MUST be added/updated, consistent with the existing viewport-driven pattern in `e2e/tests/caching-navigation.spec.ts`. |
| Development Workflow — CHANGELOG + version bump | Yes | `frontend/CHANGELOG.md` gets a new dated entry and `frontend/package.json` version bumps MINOR in the same PR. |

No violations identified — Complexity Tracking table is not needed.

*Post-Phase-1 re-check*: The design artifacts (research.md, data-model.md,
quickstart.md) introduce no new dependency, entity, API surface, or JS
complexity beyond what's listed above — every gate above still holds
unchanged after design.

## Project Structure

### Documentation (this feature)

```text
specs/020-responsive-header-icons/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory is generated — this feature exposes no external
API, CLI, or service contract; it only changes client-side presentation of
existing navigation routes.

### Source Code (repository root)

```text
frontend/
├── src/
│   └── components/
│       ├── AppHeader.tsx        # Modified: renders both nav presentations
│       ├── HamburgerMenu.tsx    # Modified: trigger hidden at md+ via Tailwind
│       ├── HeaderNavIcons.tsx   # New: 3 icon links, shown at md+ via Tailwind
│       │                       #      (styled via ui/Button's shared
│       │                       #      iconButtonClassName, not a nested <button>)
│       ├── headerNavLinks.ts    # New: shared {label, to} destination list,
│       │                       #      reused by HamburgerMenu and HeaderNavIcons
│       └── ui/Button.tsx        # Modified: export iconButtonClassName so
│                                #      HeaderNavIcons' Links can reuse it
└── tests/unit/
    ├── AppHeader.test.tsx           # New or extended
    ├── HamburgerMenu.test.tsx       # Extended: trigger visibility class
    └── HeaderNavIcons.test.tsx      # New

e2e/tests/
└── header-responsive-nav.spec.ts   # New: wide-viewport icons vs narrow-viewport hamburger
```

**Structure Decision**: Frontend-only change inside the existing
`frontend/src/components` directory (no backend or e2e infrastructure
changes beyond one new Playwright spec). The three nav destinations are
factored into a single shared `headerNavLinks.ts` constant so
`HamburgerMenu` and the new `HeaderNavIcons` component consume the same
source of truth instead of duplicating labels/routes (Constitution
Principle III/IV).
