# Implementation Plan: Theme Preference Toggle & Dark Mode Polish

**Branch**: `031-theme-toggle-preferences` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-theme-toggle-preferences/spec.md`

## Summary

Give signed-in users manual control over the app's light/dark theme via a new "Preferences" section on the Profile page, whose first control is a modern sun (blue sky + clouds) / moon (night sky + stars) toggle. Activating it immediately re-themes the entire application (not just the Profile page), the choice is persisted per-account in Firebase (extending the existing `users/{uid}` document, no new collection), and it is applied automatically — with no visible flash — the next time the user loads the app on any device, via a local paint-ahead cache reconciled against Firestore as the source of truth. Users who never make an explicit choice keep today's OS-driven behavior. Alongside the toggle, the general dark-mode palette is deliberately darkened and re-verified for WCAG 2.1 AA contrast across the app's major screens, and a non-blocking notice is shown if a preference save ultimately fails after retries.

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend, strict), TypeScript ^5.6 (backend, CommonJS)

**Primary Dependencies**: Frontend: React 19, Vite 8 (`@tailwindcss/vite`), Tailwind CSS v4, TanStack Query 5, `firebase` (client Auth SDK), `clsx`, `react-router-dom` 6. Backend: Express 4, `firebase-admin` 12 (Firestore), `zod`. No new runtime dependency required — no toast library, no icon library, no theme library (research.md R1/R4/R6).

**Storage**: Firestore (Admin SDK, backend-only writes) — extends the existing `users/{uid}` document with a new `themePreference: 'light' | 'dark'` field (research.md R2); no new collection. Client-side `localStorage` used only as a non-authoritative paint-ahead cache (research.md R3) — first use of browser storage in this codebase.

**Testing**: Backend: Jest + supertest + Firebase emulators (existing `npm test` convention). Frontend: Vitest + React Testing Library. E2E: Playwright (mandatory for `/frontend` changes per constitution's Development Workflow gate).

**Target Platform**: Web (Vite SPA + Express API, Vercel-hosted); modern evergreen browsers supporting `matchMedia` and `localStorage`.

**Project Type**: Web application — existing `backend/` + `frontend/` + `e2e/` workspaces.

**Performance Goals**: Theme switch and initial theme paint on load must be visually instantaneous — no full page reload on toggle (SC-001), no observable flash of the wrong theme on load for a user with an explicit preference (SC-002), achieved via a synchronous inline bootstrap script (research.md R1).

**Constraints**: Tailwind v4 CSS-first configuration only (no `tailwind.config.js`); no custom CSS without justification (darkening pass reuses Tailwind's built-in gray scale, no new `@theme` tokens — research.md R5); WCAG 2.1 AA text contrast in dark mode (FR-014/SC-004); toggle must be keyboard-operable and expose state to assistive technology (FR-009/SC-005); Firestore field addition must be additive/backward-compatible, no migration script (Principle VI).

**Scale/Scope**: One new boolean-ish preference per user account (two explicit states); one new backend endpoint; one new frontend atomic component + a theme context/provider; a mechanical darkening pass touching an estimated ~30+ existing component files' `dark:` utility usages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Notes |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Contract test for `PATCH /api/auth/preferences` (supertest + Firestore emulator), unit tests for `ThemeProvider`/`useThemePreference` resolution logic and `userService` field handling, frontend component tests for `ThemeToggle`, e2e scenarios for switch/persistence/fallback/failure-notice — all written before implementation. |
| II. Discogs Integration-First & Modularity | N/A | Feature does not touch catalog/Discogs metadata. |
| III. Simplicity, YAGNI & KISS | PASS | Two explicit states only, no "automatic" mode added; existing gray-scale steps reused instead of new `@theme` tokens; existing one-shot banner pattern reused instead of a new toast system; one new Firestore field instead of a new collection (research.md R2–R5). |
| IV. SOLID Design | PASS | `ThemeProvider`/`ThemeContext` (state), `useThemePreference` (persistence/reconciliation), and `ThemeToggle` (presentation) are separate single-responsibility modules; backend preference write is isolated in `userService`/`authRouter`, consistent with existing structure. |
| V. Observability | PASS | Backend logs `preference_saved` / `preference_save_failed` with `{ route, outcome, uid, message }`, mirroring the existing `authRouter` pattern; frontend surfaces failure to the user via FR-011's non-blocking notice rather than failing silently. |
| VI. Versioning & Breaking Changes | PASS | Additive only: new optional Firestore field, new endpoint, no changes to existing document shapes or endpoint contracts. Backend and frontend `package.json` MINOR bumps + dated `CHANGELOG.md` entries in the same PR. |
| VII. Curated Ratings & Music News | N/A | No ratings/news surface touched. |
| Tech stack (React+TS, Tailwind v4, Express, Firebase, Vercel) | PASS | No deviation; no new dependency added. |
| UI Design System (cards, atomic components, skeletons, dark mode, no layout shift) | PASS | `ThemeToggle` is a new reusable `components/ui` atom; Preferences section follows the existing `<section aria-label="...">` + `Card` composition already used for "Connected services"; dark mode via the constitution's `dark:` + `@theme` approach, elaborated with a class-based custom variant (research.md R1) rather than replaced. |
| Workflow gates (Conventional Commits, e2e for frontend changes, CHANGELOG + version bump) | PASS | E2E specs added under `/e2e` for the toggle/persistence/fallback/failure flows (quickstart.md); both changelogs + version bumps required in the same PR. |

**Post-Phase-1 re-check (after data-model.md, contracts/, quickstart.md)**: PASS — no violations introduced; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/031-theme-toggle-preferences/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── theme-preference-api.md   # REST contract for PATCH /api/auth/preferences + extended UserProfile
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   └── auth.ts                     # MODIFIED: new PATCH /preferences handler
│   ├── services/
│   │   └── userService.ts              # MODIFIED: UserProfile.themePreference field + updateThemePreference()
│   └── schemas/ (or inline zod)        # MODIFIED/NEW: validation for { themePreference: 'light' | 'dark' }
├── tests/
│   ├── unit/userService.test.ts        # MODIFIED: themePreference read/write coverage
│   └── contract/authPreferencesRoute.test.ts  # NEW
├── CHANGELOG.md                        # MODIFIED: new MINOR entry
└── package.json                        # MODIFIED: version bump

frontend/
├── index.html                          # MODIFIED: inline no-flash bootstrap script (research.md R1)
├── src/
│   ├── styles/global.css               # MODIFIED: @custom-variant dark; darkened dark: gray-scale steps across components
│   ├── theme/
│   │   ├── ThemeContext.tsx            # NEW: ThemeProvider + useTheme (resolved 'light' | 'dark', setTheme)
│   │   └── useThemePreference.ts       # NEW: localStorage <-> Firestore reconciliation, retry-on-failure logic
│   ├── components/
│   │   └── ui/
│   │       └── ThemeToggle.tsx         # NEW: sun/moon toggle with inline SVG artwork (research.md R6)
│   ├── pages/
│   │   └── ProfilePage.tsx             # MODIFIED: add "Preferences" section with ThemeToggle as first control; reuse/generalize OutcomeMessage for save-failure notice
│   ├── services/
│   │   └── themePreferenceApi.ts       # NEW: authorizedFetch wrapper for PATCH /api/auth/preferences
│   ├── queries/
│   │   └── themePreferenceQueries.ts   # NEW: TanStack Query mutation hook, retry policy
│   └── main.tsx                        # MODIFIED: wrap App in ThemeProvider
├── tests/ (co-located *.test.tsx per existing convention)
├── CHANGELOG.md                        # MODIFIED: new MINOR entry
└── package.json                        # MODIFIED: version bump

e2e/
└── tests/
    └── theme-preference.spec.ts        # NEW: toggle/persistence/fallback/failure-notice scenarios (quickstart.md)
```

**Structure Decision**: Follows the existing web-application split (`backend/`, `frontend/`, `e2e/`). Theme state lives in a new `frontend/src/theme/` module (its own concern, not folded into `auth/`), consumed by `main.tsx` at the app root and by the new `ThemeToggle` on the Profile page. The backend change is a narrow extension of the existing `authRouter`/`userService` pair rather than a new router, since the preference lives on the same document and is guarded by the same `requireAuth` middleware already used there.

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
