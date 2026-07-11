# Quickstart: RSS Dashboard Redesign — Responsive Layouts & New Sources

Validates the new responsive grid/list Dashboard, the combined category+source filter bar, and the two new feed sources (MetalSucks, Louder Sound). Assumes features 024/025's Dashboard is already running (this feature replaces its carousel presentation, not its data-fetching pipeline).

## Prerequisites

- Backend and frontend dev servers running, with `REDIS_URL` configured (or local dev Redis) so `withCache` has somewhere to write.
- A signed-in test user (Dashboard requires authentication, unchanged).
- A browser (or devtools device toolbar) able to test both a desktop-width window (≥1280px) and a narrow mobile width (down to 320px).

## Steps

1. **Start both servers**:
   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

2. **Sign in and open the Dashboard** (`/app`) at a desktop-width window. Confirm:
   - Articles render in a multi-column grid (not horizontal carousels) — at least 9 articles fully visible with no scrolling or clicking (spec SC-001).
   - Scroll down the page: the category and source filter controls stay visible (sticky) (FR-003).
   - Resize the window very wide (ultra-wide simulation): the grid caps at 5 columns; cards grow wider rather than adding a 6th column (spec Clarifications, Edge Cases).

3. **Switch to a mobile-width viewport** (e.g. 375px, then 320px). Confirm:
   - Articles render in a single vertical column, no horizontal carousel (FR-004).
   - The page never scrolls horizontally at any point, including at 320px (SC-002).
   - Each card uses a more compact layout than the desktop card (e.g. smaller/side-positioned image) while still showing title, excerpt, source, category, and date (FR-005).
   - Tap the category and source filter buttons: each meets a comfortable ~44×44px touch target and doesn't accidentally trigger a neighboring control (FR-006).

4. **Confirm MetalSucks and Louder Sound appear**. On either layout, scan for articles badged `MetalSucks` and `Louder Sound` alongside `Metal Injection` and the existing Metal Storm categories — all cards the same size regardless of source (FR-010, SC-004, SC-007).

5. **Exercise the source filter**:
   - Open the source filter; confirm every configured source is listed, with Metal Injection, MetalSucks, and Louder Sound listed first (FR-012, data-model.md's `FilterSelection`).
   - Select a single source (e.g. Louder Sound); confirm only its articles show, on both desktop and mobile widths (User Story 4 AC2).
   - With a source selected, also select a category; confirm the result narrows to articles matching both (FR-013).
   - Pick a combination with zero matches; confirm a clear empty-state message appears instead of a blank area (FR-015).
   - Clear the source filter; confirm the full article set returns (FR-014).

6. **Verify resilience is unchanged**. Temporarily point one new source's feed URL at an invalid host (local override) and reload:
   - Confirm the Dashboard still renders the remaining sources/categories normally (FR-011, SC-006).

7. **Run the automated checks**:
   ```bash
   cd backend && npm test -- feeds
   cd frontend && npm test -- Feed
   cd e2e && npx playwright test dashboard-feed-grid.spec.ts
   ```

## Expected outcome

All steps above pass, the checklist in [checklists/requirements.md](./checklists/requirements.md) remains fully checked, and no regression is observed in existing Dashboard behaviors (authentication gate, sanitized feed content, per-source graceful degradation, article link-through in a new tab).
