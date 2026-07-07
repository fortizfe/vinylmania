# Quickstart: Validating the Responsive Header Navigation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide validates the feature end-to-end once implemented. It does not
contain implementation code — see `tasks.md` for the build steps and
`research.md` / `data-model.md` for the design decisions being validated.

## Prerequisites

- `frontend` dependencies installed (`cd frontend && npm install`)
- A signed-in session (fake/Google auth per existing e2e helpers) to reach
  the authenticated app shell where `AppHeader` renders

## Manual validation

1. Run the frontend dev server: `cd frontend && npm run dev`.
2. Sign in and land on any authenticated page (e.g., `/app/library`).
3. **Wide viewport** (resize the browser window to ≥768px wide, or use
   desktop-sized DevTools device emulation):
   - Confirm three separate icon buttons are visible on the right side of
     the header (Profile, My wishlist, My library) — see FR-002.
   - Confirm the hamburger menu icon is **not** visible — see FR-002, FR-004.
   - Click each icon in turn and confirm it navigates to `/app/profile`,
     `/app/wishlist`, and `/app/library` respectively — see FR-007.
   - Tab through the header with the keyboard and confirm each icon has an
     announced accessible name (Profile / My wishlist / My library) — see
     FR-006, SC-004.
4. **Narrow viewport** (resize below 768px, or emulate a phone):
   - Confirm the hamburger menu icon is visible and the three individual
     icons are **not** — see FR-003, FR-004.
   - Open the hamburger menu and confirm the same three destinations are
     listed and navigate correctly — see User Story 2 acceptance scenarios.
5. **Resize across the threshold** while the page is open (no reload):
   - Confirm the header switches presentation immediately as the window
     crosses 768px in either direction, with exactly one control style
     visible at any instant — see User Story 3, FR-004, FR-008, SC-003.
6. **Sign-out control**: confirm the "Sign out" button keeps its current
   text-labeled appearance in both the wide and narrow layouts — see FR-010.

## Automated validation

- Unit tests: `cd frontend && npm test -- HeaderNavIcons HamburgerMenu AppHeader`
  — verifies accessible names, navigation targets, and the
  `hidden`/responsive classes that keep the two presentations mutually
  exclusive.
- E2E test: `cd e2e && npx playwright test header-responsive-nav` — drives
  the same wide/narrow viewport scenarios above against a running build,
  following the existing `page.setViewportSize(...)` pattern used in
  `e2e/tests/caching-navigation.spec.ts`.

## Expected outcome

All manual steps above match their acceptance scenarios in
[spec.md](./spec.md), and both the unit and e2e test commands pass with no
regressions in the pre-existing `HamburgerMenu` test suite.
