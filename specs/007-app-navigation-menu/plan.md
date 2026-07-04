# Implementation Plan: App Navigation — Hamburger Menu, Dashboard & Back Navigation

**Branch**: `007-app-navigation-menu` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-app-navigation-menu/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Restructure the authenticated app's entry point and navigation: sign-in now
lands on a new Dashboard placeholder (reached at `/app`), with the existing
library moving to its own address (`/app/library`, along with its `add` and
`record detail` sub-routes). The header's logo continues to link to `/app`
(now Dashboard). A new hamburger menu in the header — built by extending the
existing `Modal` component with a slide-in "drawer" position rather than a
new overlay primitive — offers "My library", "My wishlist", and "Profile",
the latter two landing on new placeholder pages. A new `BackLink` atomic
component gives the two "go deeper" screens (record detail, add record) a
consistent, top-of-content back action to their parent library screen. No
backend change is required — this is entirely a frontend routing/UI feature.

## Technical Context

**Language/Version**: No change — frontend TypeScript ~6.0 (React 19, Vite,
Tailwind v4, React Router 6).

**Primary Dependencies**: No new dependency. Reuses the existing `Modal`
atomic component (extended with a `position` prop), `Button`, `Card`; new
hamburger/back/close icons are inline SVGs, matching the existing convention
established in feature 006 (no icon-library dependency).

**Storage**: N/A — no data model changes; Dashboard/Wishlist/Profile are
static placeholder pages with no persisted state.

**Testing**: Vitest + React Testing Library (existing pattern). Four existing
integration tests (`signInFlow`, `signOutFlow`, `recordDetailFlow`,
`addRecordFlow`) reference the routes/destinations this feature changes and
MUST be updated alongside the routes; new unit tests for `HamburgerMenu` and
`BackLink`, and a new integration test for the menu's navigation and the
Dashboard/Wishlist/Profile placeholders.

**Target Platform**: Web browser, both desktop and mobile viewport widths;
existing frontend deployment (feature 005) is unaffected.

**Project Type**: Web application — this feature is entirely frontend
(`frontend/`); no backend route, contract, or data change is required.

**Performance Goals**: N/A beyond existing UI Design System conventions — the
menu and placeholder pages are static content with no async loading, so no
skeleton state is needed for them specifically.

**Constraints**: Must follow the constitution's UI Design System rules
(Tailwind v4, reuse existing atomic components before adding new ones, dark
mode, no layout shift); the hamburger menu MUST remain structurally
impossible to reach from the landing page (already guaranteed today since
`AppHeader` — where the trigger lives — is only rendered inside
`AuthenticatedLayout`, never on `LandingPage`); existing route consumers
(links, `navigate()` calls, tests) MUST be updated consistently with the new
paths so nothing 404s.

**Scale/Scope**: 3 new placeholder pages (Dashboard, Wishlist, Profile), 1
new `HamburgerMenu` component + 1 small `Modal` extension, 1 new `BackLink`
atomic component, ~6 route path/link updates across existing files, updates
to 4 existing integration tests, ~3 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Requirement | This feature's compliance |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | Tests before implementation | New unit tests for `HamburgerMenu`/`BackLink`/placeholder pages, and updated integration tests for sign-in/sign-out/record-detail/add-record, are written and observed to fail before the corresponding routing/component changes land |
| II. Library-First & Modularity | Self-contained modules, single purpose | `HamburgerMenu` only knows how to render/trigger the three nav options; `BackLink` only knows how to render a labeled back affordance to a given path; neither knows about the pages they link to or from |
| III. Simplicity, YAGNI & KISS | Simplest design for the stated requirement | Reuses `Modal` (extended, not duplicated) for the menu's overlay behavior; no new icon library; placeholder pages are a single shared "under construction" presentational pattern, not three bespoke pages |
| IV. SOLID Design | Single responsibility, no leaking internals | `Modal`'s new `position` prop is additive and backward-compatible (existing `ReleasePreviewModal` usage is unaffected); `BackLink` exposes only a `to` prop, no page-specific logic |
| V. Observability | Structured logs for key operations | No new server-side operation is introduced; navigation is client-side routing with no logging requirement beyond what already exists |
| VI. Versioning & Breaking Changes | Breaking changes documented | No API/data contract changes. Route path changes are internal to the frontend (no external consumers of `/app`'s old meaning exist outside this app itself) and are treated as a MINOR, additive restructuring, fully covered by updating this app's own links/tests in the same change |
| Technology Stack — Frontend/Styling | React+TypeScript, Tailwind v4 required | Confirmed as the only stack touched |
| UI Design System & Styling (Tailwind v4) | Card-based layout, reusable atomics, skeleton loading, no layout shift, dark mode | Placeholder pages use the existing `Card`; the menu and back link both support dark mode via the existing `dark:` convention; no async content here, so no skeleton is needed (Performance Goals) |
| Development Workflow | Conventional Commits; PR review | Followed at commit time; not a design-time gate |

**Result**: PASS — no violations requiring Complexity Tracking.

**Post-Design Re-check** (after Phase 1 data-model.md/contracts/quickstart.md):
Design confirmed no new dependency or deviation beyond what this table
already covers (the additive `Modal` `position` prop, and the new
`HamburgerMenu`/`BackLink`/`UnderConstruction` components, all built on
existing atomics). Gate remains **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/007-app-navigation-menu/
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
│   │   ├── ui/
│   │   │   ├── Modal.tsx              # CHANGED: adds a `position` prop ('center' | 'end')
│   │   │   └── BackLink.tsx           # NEW: shared back-navigation atomic component
│   │   ├── AppHeader.tsx              # CHANGED: adds the hamburger trigger + HamburgerMenu
│   │   ├── HamburgerMenu.tsx          # NEW: the nav drawer (My library/My wishlist/Profile)
│   │   ├── RecordCard.tsx             # CHANGED: link path updated to /app/library/records/:id
│   │   └── UnderConstruction.tsx      # NEW: shared "under construction" presentational piece
│   ├── pages/
│   │   ├── DashboardPage.tsx          # NEW: placeholder, new sign-in destination
│   │   ├── WishlistPage.tsx           # NEW: placeholder, reached from the menu
│   │   ├── ProfilePage.tsx            # NEW: placeholder, reached from the menu
│   │   ├── LibraryListPage.tsx        # CHANGED: "Add a record" link path updated
│   │   ├── AddRecordPage.tsx          # CHANGED: adds a BackLink to the library
│   │   └── RecordDetailPage.tsx       # CHANGED: adds a BackLink; post-remove navigate() path updated
│   └── App.tsx                        # CHANGED: route table restructured (see data-model.md §2)
└── tests/
    ├── unit/
    │   ├── HamburgerMenu.test.tsx     # NEW
    │   └── ui/BackLink.test.tsx       # NEW
    └── integration/
        ├── signInFlow.test.tsx        # CHANGED: expects the Dashboard, not the library, post sign-in
        ├── signOutFlow.test.tsx       # CHANGED: same expectation update
        ├── recordDetailFlow.test.tsx  # CHANGED: new route path; asserts the BackLink
        ├── addRecordFlow.test.tsx     # CHANGED: new route path; asserts the BackLink
        └── navigationMenu.test.tsx    # NEW: menu open/select/close, and landing-page absence
```

**Structure Decision**: No new top-level directory. This feature stays inside
the existing `frontend/` app: two new atomic components under
`components/ui/` (`BackLink`, plus the `Modal` extension), one new
app-specific `HamburgerMenu` component, one shared `UnderConstruction`
presentational piece reused by the three new placeholder pages, and route
table changes in `App.tsx` plus the existing pages/links/tests that reference
the paths being restructured.

## Complexity Tracking

*No violations — table intentionally omitted.*
