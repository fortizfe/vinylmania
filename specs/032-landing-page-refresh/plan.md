# Implementation Plan: Landing Page Refresh

**Branch**: `032-landing-page-refresh` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-landing-page-refresh/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refresh the unauthenticated landing page (`frontend/src/pages/LandingPage.tsx`)
from today's single no-scroll headline+CTA screen into a scrollable, sectioned
page that communicates Vinylmania's three product pillars (Discogs catalog,
personal ratings, curated rock/metal news) with a subtly darker, rock/metal-
inflected visual treatment layered on the existing Tailwind design tokens. The
existing Google sign-in mechanism is unchanged but moves into a new persistent
(sticky) header — brand + sign-in only, no nav links — so it stays reachable at
every scroll position (FR-003/FR-008). The refresh must meet WCAG 2.1 AA
contrast/keyboard requirements (FR-010) and introduces no imagery/illustration,
new backend data, or API surface — it is a frontend-only, presentational change.

## Technical Context

**Language/Version**: TypeScript 6.x with React 19 (existing `frontend/`
workspace; no version change)

**Primary Dependencies**: React 19, React Router 6 (`Navigate`, existing
redirect-if-authenticated behavior), Tailwind CSS v4 (`@theme` tokens), `clsx`,
existing `AuthContext`/`GoogleSignInButton`/`Button` components. One new e2e-
only dev dependency: `@axe-core/playwright` for the FR-010/SC-006 accessibility
scan (research.md §3). No new icon library (hand-authored inline SVGs, per
research.md §2) and no new imagery/asset pipeline (per spec clarifications).

**Storage**: N/A — no new persisted data; reuses existing Firebase-backed auth
session read-only via `AuthContext` for the redirect-if-authenticated check
(FR-006).

**Testing**: Vitest + React Testing Library for component/integration tests
(`frontend/tests/components`, `frontend/tests/integration`); Playwright for
e2e (`e2e/tests`), extended with an `@axe-core/playwright` accessibility scan.
Per Constitution Principle I (Test-First), failing tests are written before
implementation for each touched/new component and the updated e2e flow.

**Target Platform**: Web browser (responsive: mobile/tablet/desktop),
deployed via Vercel per the project's standard pipeline; no new platform
target introduced.

**Project Type**: Web application (existing `frontend/` + `backend/` + `e2e/`
monorepo). This feature touches `frontend/` and `e2e/` only — no `backend/`
changes.

**Performance Goals**: No new numeric performance target beyond the app's
existing SPA behavior; the refresh must not regress current landing page load
characteristics (no new heavy assets — no imagery, no new fonts, one small
e2e-only dev dependency).

**Constraints**: WCAG 2.1 AA contrast (≥4.5:1) and full keyboard operability
(FR-010); visual design must draw from existing `@theme` tokens rather than a
separate visual language (FR-002, spec Assumptions); no illustration/
photography (FR-009); sticky header limited to brand + sign-in, no additional
nav (FR-008); pillar sections limited to icon + short copy, no screenshots/
mockups (FR-007).

**Scale/Scope**: Single route (`frontend/src/pages/LandingPage.tsx`) plus a
small number of new presentational components (sticky header, pillar section);
no new backend endpoints, no new Firestore collections, no new external
integrations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Gate |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Feature is fully testable with existing patterns (`frontend/tests`, `e2e/tests`); failing component/integration tests for new components (`LandingHeader`, `LandingPillarSection`) and an updated e2e/a11y check MUST be written before implementation. | PASS |
| II. Discogs Integration-First & Modularity | Not applicable — no catalog metadata is read, written, or displayed dynamically; pillar copy is static text (spec Assumptions). | PASS (N/A) |
| III. Simplicity, YAGNI & KISS | Reuses existing `Button`, `GoogleSignInButton`, `AuthContext`, and the `AppHeader` sticky-header pattern rather than inventing new mechanisms (research.md §1); no new icon library or asset pipeline (research.md §2). | PASS |
| IV. SOLID Design | New components (`LandingHeader`, `LandingPillarSection`) each have a single presentational responsibility; existing `LandingHero`/`GoogleSignInButton` are reused, not modified in ways that leak new responsibilities into them. | PASS |
| V. Observability | Not applicable — no new operations (no writes, no external calls) are introduced; existing sign-in logging in `AuthContext` is unchanged. | PASS (N/A) |
| VI. Versioning & Breaking Changes | No API contract, schema, or stored-data change. Frontend-only, additive/visual change → MINOR per `frontend/CHANGELOG.md` and `package.json` version bump (Development Workflow gate below). | PASS |
| VII. Curated Ratings & Music News (Rock/Metal Focus) | Landing copy references ratings and curated rock/metal news as product pillars but stays genre-neutral in tone/imagery (FR-009 clarification); does not alter actual rating/news feed behavior, which remains governed by this principle elsewhere in the app. | PASS |
| Web App Standards (API docs, migrations, error separation) | No new API, no schema change; existing `GoogleSignInButton` error-message pattern (user-facing vs internal) is reused unchanged (FR-004). | PASS |
| Tailwind v4 UI Design System | New color tokens for the rock/metal-inflected palette live in the `@theme` block (research.md §4), not ad-hoc CSS; sticky header and pillar sections reuse card/spacing/dark-mode conventions already established by `AppHeader`/other components. | PASS |
| Development Workflow (e2e + CHANGELOG + version bump) | This `/frontend`-touching feature MUST include e2e coverage (extending `e2e/tests/sign-in.spec.ts` or an equivalent spec) and a `frontend/CHANGELOG.md` entry with a matching `frontend/package.json` MINOR version bump in the same PR. | PASS (planned, enforced at tasks/implementation stage) |

No violations requiring Complexity Tracking justification.

**Post-Phase 1 re-check**: `research.md`, `data-model.md`, and `quickstart.md`
introduce no new dependencies, entities, or interfaces beyond what's assessed
above (one e2e-only dev dependency, `@axe-core/playwright`, justified in
research.md §3 by the FR-010/SC-006 accessibility gate). All gates remain PASS
after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/032-landing-page-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — no persisted entities; static content shapes only
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify + /speckit-clarify)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no API, CLI, or other external
interface — it is a purely internal, presentational frontend change (no new
endpoints, no schema, no contract to document).

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   └── LandingPage.tsx            # existing — modified to compose the new sticky header + hero + pillar sections
│   ├── components/
│   │   ├── LandingHero.tsx            # existing — restyled copy/visual treatment (FR-001, FR-009)
│   │   ├── GoogleSignInButton.tsx     # existing — reused unchanged (FR-004), now rendered inside LandingHeader
│   │   ├── LandingHeader.tsx          # NEW — sticky brand + sign-in header (FR-008)
│   │   └── LandingPillarSection.tsx   # NEW — reusable icon + title + copy block for the 3 pillars (FR-007)
│   └── styles/
│       └── global.css                 # existing — extend @theme with landing-specific tokens (research.md §4)
└── tests/
    ├── components/
    │   ├── LandingHero.test.tsx           # existing — updated for restyled copy
    │   ├── LandingHeader.test.tsx         # NEW
    │   └── LandingPillarSection.test.tsx  # NEW
    └── integration/
        └── landingLayout.test.tsx         # existing — rewritten: page is now scrollable/sectioned with a sticky header (research.md §6)

e2e/
└── tests/
    └── sign-in.spec.ts    # existing — extended to verify the sticky header stays visible after scrolling past the pillar sections, plus an @axe-core/playwright accessibility scan (FR-010/SC-006)
```

**Structure Decision**: Existing Option 2 (web application: `frontend/` +
`backend/` + `e2e/`) monorepo layout, unchanged. This feature only adds/
modifies files under `frontend/src/{pages,components,styles}`,
`frontend/tests/{components,integration}`, and `e2e/tests`; `backend/` is not
touched, consistent with the feature being purely presentational.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No Constitution Check violations were identified (see table above) — this
section is intentionally empty.
