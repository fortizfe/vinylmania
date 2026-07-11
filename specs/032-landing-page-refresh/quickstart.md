# Quickstart: Validating the Landing Page Refresh

## Prerequisites

- Repo checked out on branch `032-landing-page-refresh`.
- `frontend/` dependencies installed (`npm install` in `frontend/`).
- For the e2e check: `e2e/` dependencies installed and Playwright browsers
  available (`npx playwright install` in `e2e/` if not already done).

## 1. Run the app locally

```bash
cd frontend
npm run dev
```

Open the printed local URL in a browser while signed out (or in an incognito
window) so the landing route (`/`) renders instead of redirecting to `/app`.

## 2. Manual validation scenarios

Walk through each and compare against the acceptance scenarios in
`spec.md`:

1. **First impression (US1)** — Load the page. Within the first screen you
   should see a headline + supporting copy describing Vinylmania's purpose
   (Discogs catalog, ratings, curated rock/metal news), styled with the
   app's existing design tokens in both light and dark mode (toggle your OS/
   browser theme to check).
2. **Sign-in always reachable (US2)** — Scroll all the way down through the
   pillar sections. The header containing the Vinylmania wordmark and the
   "Sign in with Google" button must stay pinned at the top of the viewport
   at every scroll position. Click sign-in from a scrolled position and
   confirm the existing Google auth flow still completes into `/app`.
3. **Product glimpse (US3)** — Confirm three distinct sections are present,
   each with an icon, a short title, and one–two lines of copy, covering:
   the Discogs-backed catalog, personal ratings, and curated rock/metal news.
4. **Already-authenticated redirect (FR-006)** — While signed in, navigate to
   `/`; you should be redirected straight to `/app` without seeing the
   landing content.
5. **Responsive check (FR-005)** — Use browser dev tools to check mobile
   (~375px), tablet (~768px), and desktop (~1280px+) widths. The sticky
   header and sign-in button must remain usable and uncramped at every size.

## 3. Automated checks

```bash
# Component/integration tests
cd frontend
npm run test

# Type-check + build
npm run build

# Lint
npm run lint
```

```bash
# End-to-end (from repo root or e2e/, per e2e/README.md)
cd e2e
npx playwright test sign-in.spec.ts
```

## 4. Accessibility check (FR-010 / SC-006)

The e2e sign-in spec (per research.md §3) runs an automated `@axe-core/
playwright` scan against the landing route. A passing run with zero serious/
critical violations is the acceptance bar for FR-010/SC-006. Run it via the
same `npx playwright test sign-in.spec.ts` command above and check the
report output (or `npx playwright show-report` from `e2e/`) for the
accessibility assertion results.

## Expected outcome

All automated checks pass, and every manual scenario above matches the
described behavior. If any step fails, compare against the relevant FR-00x /
SC-00x in `spec.md` before changing behavior — the spec (as clarified) is the
source of truth for what "correct" looks like here.
