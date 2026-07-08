# Quickstart: Dashboard Feed Carousels & Metal Storm Categories

Validates that the Dashboard shows no page title, the five new Metal Storm categories, and a working horizontal carousel per category. Assumes feature 024's Dashboard MVP is already running (this feature only extends it).

## Prerequisites

- Backend and frontend dev servers running (same setup as feature 024's quickstart), with `REDIS_URL` configured (or the local dev Redis) so `withCache` has somewhere to write.
- A signed-in test user (Dashboard requires authentication, unchanged from 024).

## Steps

1. **Start both servers** (from repo root, or per-package as usual):
   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

2. **Sign in and open the Dashboard** (`/app` in the frontend). Confirm:
   - No "Dashboard" heading is shown at the top of the page (spec FR-001).
   - The category filter bar and category sections begin close to the top of the page content.

3. **Confirm the new categories are present**. Scan the page for: `News`, `Reviews`, `Interviews`, `Articles`, `Staff Picks`. Each should show recent articles (spec FR-002/FR-003).
   - If `metal-injection` is also healthy, the `News` category should show articles from both Metal Injection and Metal Storm interleaved by recency, not two separate "News" sections (spec FR-004).

4. **Exercise a carousel**. Pick any category with more than a handful of articles:
   - Confirm articles are laid out in a single horizontal row, most recent first (leftmost).
   - Click the "next" arrow repeatedly; confirm it scrolls toward older articles and becomes disabled/hidden once the oldest available article (up to the 10th) is reached (spec FR-007, User Story 1 AC3).
   - Click "previous" back to the start; confirm it is disabled/hidden once back at the newest article (User Story 1 AC2).
   - Tab to the arrow buttons with the keyboard and activate them with Enter/Space; confirm the same scrolling behavior works without a mouse (spec FR-009).

5. **Verify resilience is unchanged**. Temporarily point one Metal Storm feed URL at an invalid host (e.g. via a local override) and reload:
   - Confirm the Dashboard still renders the remaining categories.
   - Confirm the existing non-blocking "source unavailable" notice names the failing source (spec FR-010, unchanged from 024's FR-007).

6. **Run the automated checks**:
   ```bash
   cd backend && npm test -- feeds
   cd frontend && npm test -- Feed
   cd e2e && npx playwright test dashboard-feed-carousel.spec.ts
   ```

## Expected outcome

All steps above pass, the checklist in [checklists/requirements.md](./checklists/requirements.md) remains fully checked, and no regression is observed in feature 024's existing behaviors (authentication gate, sanitized content, per-source graceful degradation, article link-through in a new tab).
