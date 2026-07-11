# Implementation Plan: Adopt New Vinylmania Logo Branding

**Branch**: `035-logo-rebranding` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-logo-rebranding/spec.md`

## Summary

Replaces the plain-text "Vinylmania" label used today in the authenticated app header (`AppHeader`), the landing page's sticky header (`LandingHeader`), and the landing hero (`LandingHero`) with the new brand mark defined in `docs/Vinylmania design brief/Vinylmania Logo - Final.dc.html`: a circular "VM" icon (light/dark variants driven by the app's existing theme mechanism) paired with an "VINYLMANIA" wordmark in the brief's "Anton" display font. The app header and landing header use the small, non-grunge, icon+wordmark "lockup" (icon-only on mobile, per the clarified breakpoint-driven rule); the landing hero uses the larger "general logo" arrangement with the brief's grunge filter effect on the wordmark. The browser-tab favicon is replaced with a static SVG derived from the icon's light-context variant. This is a frontend-only, purely presentational change — no backend, no new persisted data, no new API surface.

## Technical Context

**Language/Version**: TypeScript 6.x with React 19 (existing `frontend/` workspace; no version change)

**Primary Dependencies**: React 19, Tailwind CSS v4 (`@theme` tokens), existing `ThemeContext`/`dark` class mechanism, existing `AppHeader`/`LandingHeader`/`LandingHero` components. One new external font dependency: Google Fonts "Anton" (per spec Clarifications — loaded via `<link>` tags in `frontend/index.html`, the same pattern the design brief itself uses). No icon library — the new brand icon is a hand-authored inline SVG component, consistent with the existing `HeaderNavIcons.tsx` convention (research.md §1).

**Storage**: N/A — no new persisted data, no backend changes.

**Testing**: Vitest + React Testing Library for component tests (`frontend/tests/components`, `frontend/tests/unit`); Playwright for e2e (`e2e/tests`), extending the existing `dark-mode-contrast.spec.ts` (which already queries the header brand by accessible name) and `header-responsive-nav.spec.ts`. Per Constitution Principle I (Test-First), failing tests are written before implementation for each new/modified component.

**Target Platform**: Web browser (responsive: mobile/tablet/desktop), deployed via Vercel per the project's standard pipeline; no new platform target.

**Project Type**: Web application (existing `frontend/` + `backend/` + `e2e/` monorepo). This feature touches `frontend/` and `e2e/` only — no `backend/` changes.

**Performance Goals**: No new numeric performance target; the new "Anton" font load MUST NOT cause a visible container-level layout shift (FR-010) — achieved by giving every brand-mark container a fixed height anchored by the icon's fixed pixel size (independent of the wordmark's font metrics), plus `font-display: swap` so text is never blocked/invisible while the font loads.

**Constraints**: Grunge filter effect scoped to large-format placements only, clean typography at header size (FR-012, per Clarifications); header lockup renders at one fixed size (36px icon / 20px wordmark) at every desktop width, never scaling with viewport (FR-011); 44×44 CSS px minimum touch target on any interactive brand-mark link, per the constitution's touch-target rule; existing header sticky positioning, sign-in CTA, and nav elements unchanged (spec Assumptions).

**Scale/Scope**: Three existing components modified (`AppHeader.tsx`, `LandingHeader.tsx`, `LandingHero.tsx`), a small number of new shared brand-mark components, one new `@theme` addition, one font `<link>` addition in `index.html`, and one replaced static asset (`frontend/public/favicon.svg`). No new backend endpoints, no new Firestore collections, no new external integrations beyond the Google Fonts asset request.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Gate |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Failing component tests for the new `VinylmaniaIcon`/`VinylmaniaWordmark` components and updated tests for `AppHeader`/`LandingHeader`/`LandingHero`, plus an updated e2e assertion, MUST be written before implementation. | PASS |
| II. Discogs Integration-First & Modularity | Not applicable — no catalog metadata involved; this is a static brand asset change. | PASS (N/A) |
| III. Simplicity, YAGNI & KISS | No icon library, no new asset pipeline; the icon's light/dark variants are one markup with `dark:` utility classes (no duplicated SVGs, no JS branching) (research.md §2); monochrome brief variants are explicitly out of scope (spec Assumptions), so they are not built. | PASS |
| IV. SOLID Design | `VinylmaniaIcon` (icon only) and `VinylmaniaWordmark` (wordmark only) are separate, single-responsibility atoms; each header/hero composes them directly with its own layout classes rather than a single over-configurable "logo" component covering unrelated layouts (research.md §3). | PASS |
| V. Observability | Not applicable — no new operations, no writes, no external service calls beyond a static font asset request. | PASS (N/A) |
| VI. Versioning & Breaking Changes | No API contract, schema, or stored-data change. Frontend-only, additive/visual change → MINOR per `frontend/CHANGELOG.md` and `package.json` version bump (Development Workflow gate). | PASS |
| VII. Curated Ratings & Music News (Rock/Metal Focus) | Not applicable — this feature only changes the brand mark, not news/rating features or their rock/metal editorial focus. | PASS (N/A) |
| Web App Standards | No new API, no schema change. | PASS |
| Tailwind v4 UI Design System | New values (`--color-brand-icon-dark-bg`, `--font-display`) are added to the `@theme` block, not ad-hoc CSS (research.md §4); the icon reuses existing `--color-landing-surface`/`--color-landing-accent`/`--color-primary` tokens wherever the brief's hex values already match them (research.md §4) — confirming the brief was designed against this app's existing palette. | PASS |
| Dual responsive layout & 44×44 touch target (v2.2.0) | The header/mobile split is exactly this feature's User Story 1 — icon-only on mobile, icon+wordmark on desktop, breakpoint-driven (research.md §5). The app-header brand `Link` gets an explicit `min-h-11 min-w-11` hit area (T006/T011) — the 28px mobile icon alone does not reach 44×44px, so this is not left to incidental header padding. | PASS |
| Development Workflow (e2e + CHANGELOG + version bump) | This `/frontend`-touching feature MUST include e2e coverage (extending `dark-mode-contrast.spec.ts`/`header-responsive-nav.spec.ts`) and a `frontend/CHANGELOG.md` entry with a matching MINOR version bump in the same PR. | PASS (planned, enforced at tasks/implementation stage) |

No violations requiring Complexity Tracking justification.

**Post-Phase 1 re-check**: `research.md` and `data-model.md` introduce no new dependencies beyond the single Google Fonts request (justified above and in research.md §6), no persisted entities, and no new cross-module coupling. All gates remain PASS after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/034-logo-rebranding/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — no persisted entities; static content shapes only
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify + /speckit-clarify)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no API, CLI, or other external interface — it is a purely internal, presentational frontend change (no new endpoints, no schema, no contract to document), consistent with feature 032's precedent.

### Source Code (repository root)

```text
frontend/
├── index.html                                # MODIFIED: add Google Fonts preconnect + "Anton" stylesheet link (FR-010)
├── public/
│   └── favicon.svg                           # REPLACED: new circular "VM" icon (light-context variant), same file path (FR-004)
├── src/
│   ├── components/
│   │   ├── brand/
│   │   │   ├── VinylmaniaIcon.tsx            # NEW: circular "VM" icon, size prop, dark:-variant fill colors (research.md §2)
│   │   │   ├── VinylmaniaWordmark.tsx        # NEW: "VINYLMANIA" text in Anton, optional grunge prop (research.md §3)
│   │   │   └── VinylmaniaGrungeFilter.tsx    # NEW: shared, visually-hidden SVG <filter> def, mounted once (research.md §3)
│   │   ├── AppHeader.tsx                     # MODIFIED: brand Link renders VinylmaniaIcon (28px mobile / 36px at md:+) + VinylmaniaWordmark (hidden below md:, visible md:+ — same breakpoint HeaderNavIcons/hamburger already switch at) (FR-001, FR-005, FR-006, FR-011, FR-012)
│   │   ├── HeaderSearchBox.tsx               # MODIFIED (discovered during implementation, research.md §9): base width w-40 → w-28, restoring 320px headroom the brand mark's required touch target no longer absorbs via truncate
│   │   ├── LandingHeader.tsx                 # MODIFIED: brand span renders the same icon+wordmark lockup (FR-002, FR-011, FR-012)
│   │   └── LandingHero.tsx                   # MODIFIED: heading renders VinylmaniaIcon (120px) + VinylmaniaWordmark (grunge) in the brief's stacked "general logo" arrangement (FR-002, FR-007, FR-009)
│   ├── App.tsx                               # MODIFIED: mounts <VinylmaniaGrungeFilter /> once at the app root
│   └── styles/
│       └── global.css                        # MODIFIED: add `--color-brand-icon-dark-bg` and `--font-display` to @theme (research.md §4)
└── tests/
    ├── components/
    │   ├── brand/
    │   │   ├── VinylmaniaIcon.test.tsx         # NEW
    │   │   ├── VinylmaniaWordmark.test.tsx     # NEW
    │   │   └── VinylmaniaGrungeFilter.test.tsx # NEW
    │   ├── LandingHeader.test.tsx               # MODIFIED: brand mark assertions
    │   └── LandingHero.test.tsx                 # MODIFIED: brand mark assertions (existing heading textContent check still passes)
    └── unit/
        └── AppHeader.test.tsx                   # MODIFIED: brand mark assertions (icon always visible, wordmark hidden below md:, accessible name, 44×44 touch target)

e2e/
└── tests/
    ├── dark-mode-contrast.spec.ts            # MODIFIED: header brand contrast check still resolves the wordmark's text color (FR-003, SC-002)
    └── header-responsive-nav.spec.ts         # MODIFIED: asserts the icon-only vs icon+wordmark switch at the existing mobile/desktop breakpoint (FR-001, FR-008, SC-005)
```

**Structure Decision**: Existing Option 2 (web application: `frontend/` + `backend/` + `e2e/`) monorepo layout, unchanged. This feature only adds/modifies files under `frontend/src/components/{brand,}`, `frontend/index.html`, `frontend/public/favicon.svg`, `frontend/src/styles/global.css`, `frontend/tests/**`, and `e2e/tests`; `backend/` is not touched, consistent with the feature being purely presentational.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No Constitution Check violations were identified (see table above) — this section is intentionally empty.
