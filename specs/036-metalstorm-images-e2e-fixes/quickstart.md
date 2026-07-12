# Quickstart: Validating Metal Storm Images & E2E Suite Stabilization

This guide describes how to validate both fixes locally. See
[research.md](./research.md) for the underlying root-cause analysis and
[plan.md](./plan.md) for the full file list touched.

## Prerequisites

- Node.js + npm installed, dependencies installed in `backend/`,
  `frontend/`, and `e2e/`.
- Firebase emulators available (used by both the backend Jest suite and
  the e2e Playwright suite), per each package's existing `test` script.

## Validating the Metal Storm image fix

Backend unit tests (fast, no network):

```bash
cd backend && npm test -- feedMapper
```

Confirms `extractImageUrl`'s new `data-image-url` tier resolves a relative
path to an absolute URL for a Metal Storm-shaped fixture, and that a
fixture with no `ms-link`/`data-image-url` markup (representative of the
Reviews/Interviews/Articles/Staff Picks feeds) still returns `undefined`.

Manual/live check (optional, confirms against the real feed):

```bash
cd backend && npm run dev
# In another terminal, hit the Dashboard feed endpoint and inspect the
# Metal Storm News category's articles for a populated imageUrl:
curl -s http://localhost:3001/api/feeds/dashboard | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0)); \
    console.log(d.categories.find(c=>c.category==='News').articles.filter(a=>a.sourceId==='metal-storm-news').map(a=>({title:a.title,imageUrl:a.imageUrl})))"
```

Expected: Metal Storm News articles show a populated `imageUrl` (an
absolute `https://metalstorm.net/images/...` URL); articles from
`metal-storm-reviews`/`interviews`/`articles`/`picks` correctly show
`imageUrl: undefined` (feed has no image data) and still render the
placeholder in the UI — this is expected, not a remaining bug.

## Validating the e2e suite stabilization

```bash
cd e2e && npm test
```

Run it **twice in a row** (per spec.md FR-010/SC-003) to confirm stability,
not just a single green run.

Expected: **0 failures** (previously 9), across both runs. Specifically:

| Cluster | File | What to check |
|---|---|---|
| A | `sign-in.spec.ts`, `returning-session.spec.ts` | Assert against real current Dashboard content, not a "Dashboard" heading |
| B | `record-detail-inline-edit.spec.ts` (×5) | No Playwright strict-mode violations on the release title locator |
| C | `caching-navigation.spec.ts` (cache/edit test) | "Your copy" heading appears after navigating from the library list; no unhandled render error in the console/webserver log |
| D | `caching-navigation.spec.ts` (narrow-viewport badge test) | Clicking "Search" at 375px succeeds without "Sign out" intercepting the click |

Also re-run the existing header/touch-target regression suite to confirm
the `HamburgerMenu` restructuring introduces no regression:

```bash
cd e2e && npx playwright test tests/header-responsive-nav.spec.ts
```

Expected: all existing assertions still pass, including the 44×44px
touch-target checks and the desktop-icons/mobile-hamburger dual-layout
behavior — "Sign out" should now appear as a row inside the hamburger
menu's modal at narrow widths, and MUST also meet the 44×44px floor there.

## Expected outcome

All items in spec.md's Success Criteria (SC-001 through SC-005) hold: Metal
Storm images render when the feed provides them, the placeholder remains
correct where it doesn't, the full e2e suite passes 100% across two
consecutive runs, no test asserts against removed UI, and the mobile header
search control is reliably clickable.
