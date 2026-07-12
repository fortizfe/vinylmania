# Quickstart: Validating Dual Layout & 44px Touch Targets

This guide describes how to run the app locally and manually/automatedly
verify the two constitution rules this feature implements, across all nine
in-scope screens and the app header. See [research.md](./research.md) for
the underlying design decisions and [plan.md](./plan.md) for the full file
list touched.

## Prerequisites

- Node.js + npm installed, repo dependencies installed (`npm install` in
  `frontend/`, `backend/`, and `e2e/` as applicable — see each package's own
  README/scripts).
- Firebase emulators available for auth/firestore (used by e2e specs), per
  existing `e2e/playwright.config.ts` setup (`firebase emulators:exec
  --only auth,firestore --project vinylmania-test`).
- A Discogs-linked test account (or the existing e2e fake-sign-in helper,
  `e2e/helpers/fakeGoogleSignIn.ts`) to reach authenticated screens
  (Library, Search, Record/Release/Master detail, Profile).

## Run the app

```bash
cd frontend && npm run dev
```

Then open the app in a browser (default `http://localhost:5173`).

## Manual validation per screen

For each of the following, open the screen, then:

1. Resize the browser to a desktop width (≥1280px) and confirm the content
   is arranged in multiple columns/panels using the available width (not a
   single centered column with large empty side margins).
2. Resize down to a mobile width (360–430px, or use browser device
   emulation) and confirm: the page is a single column, there is no
   horizontal scrollbar on the main content, and every button, link-acting-
   as-button, chip, input, and icon control looks/feels comfortably large
   enough to tap (visually at least 44×44 CSS px — see automated checks
   below for exact measurement).
3. Resize the window live across the `md` (768px) and `xl` (1280px)
   breakpoints and confirm the layout transitions smoothly with no page
   reload and no broken intermediate state.
4. Exercise the screen's existing functionality (see table below) and
   confirm nothing is missing or behaves differently than before.

| Screen | Route | Functionality to re-verify unchanged |
|---|---|---|
| Landing | `/` | Sign-in with Google button navigates/authenticates as before |
| Search results | `/app/search?...` | Filtering, infinite scroll, add-to-library action |
| My library | `/app/library` | Pagination, "link Discogs account" prompt when unlinked |
| Wishlist | `/app/wishlist` | Placeholder renders, no real wishlist functionality added |
| Record detail | `/app/library/:id` | Rating, edit condition, remove from library |
| Release detail | `/app/releases/:id` | Add to library |
| Master release detail | `/app/masters/:id` | Versions table pagination/navigation |
| Profile | `/app/profile` | Theme toggle, Discogs connect/disconnect |
| Discogs callback | `/app/discogs/callback` | Loader shows, then redirects as before |
| App header (all authenticated screens) | any `/app/*` | Search, nav icons/hamburger menu, sign out |

## Automated validation

Component/unit level (fast, no browser):

```bash
cd frontend && npm test
```

Confirms shared atomics (`Button`, `Input`, `Checkbox`, `ThemeToggle`, etc.)
carry the expected `min-h-11`/`min-w-11` sizing classes, and that page-level
markup/data-driven behavior (which fields/actions render) is unchanged.

Real-viewport geometry (desktop composition, no horizontal scroll, 44px
touch targets) — Playwright e2e, following the existing
`e2e/tests/dashboard-feed-grid.spec.ts` and
`e2e/tests/header-responsive-nav.spec.ts` patterns:

```bash
cd e2e && npm test
```

Each new/extended spec (see `plan.md`'s Project Structure) should, per
screen:
- Set viewport to a desktop width (e.g. 1280px+) and assert the computed
  grid/flex layout uses more than one column/panel.
- Set viewport to a mobile width (e.g. 375px) and assert
  `document.documentElement.scrollWidth <= document.documentElement.
  clientWidth` (no horizontal scroll).
- At the mobile width, assert `boundingBox()` width and height ≥44 for
  every interactive control exercised on that screen.
- Resize the viewport live across breakpoints and assert no navigation/
  reload event occurs.

## Expected outcome

All items in spec.md's Success Criteria (SC-001 through SC-005) hold for
all nine in-scope screens and the app header, with zero functional
regressions versus the pre-feature behavior of each screen.
