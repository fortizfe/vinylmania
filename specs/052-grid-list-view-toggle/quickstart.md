# Quickstart: Modo carátula / modo lista en Resultados de búsqueda y Mi biblioteca

**Feature**: 052-grid-list-view-toggle | **Date**: 2026-07-17

Validation scenarios proving User Story 1 (toggle control + persistence),
User Story 2 (Mi biblioteca list mode) and User Story 3 (Resultados de
búsqueda list mode, incl. the backend `country`/`labels` extension) all
work end-to-end. See `contracts/discogs-search-api.md` for the extended
response shape and `contracts/view-mode-toggle-ui.md` for component/testid
contracts.

## Prerequisites

- Frontend dev server running (`cd frontend && npm run dev`), backend dev
  server running (`cd backend && npm run dev`), pointing at Firebase
  emulators (no new emulator/env requirement — same setup as any other
  library/search feature).
- A signed-in test user with at least a few library entries (for Mi
  biblioteca scenarios) — reuse existing seed/fixture data.

## Scenario 1 — Toggle appears, indicates active state, switches instantly (User Story 1)

```bash
cd frontend && npx vitest run ViewModeToggle.test.tsx
```

Drive manually:
1. Open `/app/search`, run a query. Confirm `[data-testid="view-mode-toggle"]`
   is visible top-right next to the page title, with the grid option
   `aria-checked="true"` by default.
2. Click the list option. Confirm the grid (`search-results-grid`)
   disappears and a list container (`search-results-list`) appears
   immediately, with the same already-loaded results, no network request
   fired (check the Network tab — no new `/api/discogs/search` call).
3. Reload the page. Confirm list mode is still active (localStorage key
   `vinylmania:view-mode:search` read on mount).
4. Open `/app/library` in a new tab. Confirm it shows **grid** mode (not
   list) — the two screens' preferences are independent (spec FR-003).
5. Tab to the toggle with keyboard only; confirm arrow keys move the
   selection between the two options and the currently-selected option is
   announced by a screen reader (`role="radio"`/`aria-checked`).

**Expected**: matches spec US1 AC1–AC9.

## Scenario 2 — Mi biblioteca list mode (User Story 2)

```bash
cd frontend && npx vitest run RecordListRow.test.tsx
cd e2e && npx playwright test library-list-responsive.spec.ts
```

Drive manually:
1. On `/app/library`, switch to list mode. Confirm each row shows cover
   (left), then title + artist (bold/larger) and format, country, year,
   label (secondary style) on the right.
2. Find (or seed) an entry with more than one format/label/artist —
   confirm all values are shown comma-joined, not just the first.
3. Find (or seed) an entry missing country or label — confirm that field
   is simply absent from the row (no empty gap, no `"undefined"` text).
4. Click a row — confirm navigation to `/app/library/records/{id}`.
5. Find (or seed) an entry with `catalogStatus: "unavailable"` — confirm
   the row shows the existing warning copy and "Open record" link.
6. Use Previous/Next pagination in list mode — confirm it still works,
   paginating rows.
7. Resize to a mobile viewport (375×812) — confirm no horizontal scroll,
   title/artist remain legible, cover shrinks if needed.

**Expected**: matches spec US2 AC1–AC9.

## Scenario 3 — Resultados de búsqueda list mode + backend `country`/`labels` (User Story 3)

```bash
cd backend && npx jest discogsMapper.test.ts
cd frontend && npx vitest run SearchResultListRow.test.tsx
cd e2e && npx playwright test search-results-responsive.spec.ts
```

Verify the backend contract directly:

```bash
curl -s "http://localhost:PORT/api/discogs/search?q=nirvana&type=release&page=1&perPage=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.results[0] | {title, country, labels}'
```

**Expected**: a `release`-type result includes `country` (string) and
`labels` (array of ≥1 string) when Discogs provides them, absent
otherwise — never `null` or an empty placeholder (contract
`discogs-search-api.md`).

Drive manually:
1. On `/app/search`, run a query with mixed result types, switch to list
   mode. Confirm individual (`release`) results show the same six fields
   as Mi biblioteca (cover, title, artist, format, country, year, label).
2. Confirm a result missing country/label omits that field cleanly.
3. Click an individual result row — confirm navigation to the release
   detail page.
4. Click "Add to library" from within a row — confirm the "adding…" →
   "added" states render correctly in the row layout, and the row does
   not navigate away when the button (not the rest of the row) is
   clicked.
5. Find a `master` (grouped) result — confirm it renders as a
   simplified row: stacked-cover visual, title, artist, "Multiple
   editions" badge, no "Add to library" action.
6. Scroll to the bottom — confirm infinite scroll still loads more rows,
   showing "loading more" and (once exhausted) "no more results" states.
7. Trigger a next-page load failure (e.g. throttle/offline) — confirm the
   existing error + "Retry" UI still appears in list mode.
8. Apply a Format/Genre/Style filter — confirm filtering behaves
   identically in list mode; apply a filter with no matches — confirm the
   existing empty-state message appears unchanged.
9. Resize to a mobile viewport — confirm no horizontal scroll, same
   legibility priority as Mi biblioteca.

**Expected**: matches spec US3 AC1–AC9.

## Scenario 4 — Cross-cutting edge cases

Drive manually:
1. Start "Add to library" on a search result, then switch to list mode
   mid-request — confirm the add operation completes normally (no
   cancel/duplicate).
2. Start an infinite-scroll page load in grid mode, switch to list mode
   before it resolves — confirm the newly loaded results appear correctly
   in list mode, no duplicates.
3. Resize the browser window across the mobile/desktop breakpoint while
   list mode is active — confirm the mode selection is retained and no
   broken intermediate layout appears.
4. Find (or seed) a release with many formats/labels/artists — confirm
   the row does not overflow horizontally or grow disproportionately
   taller than sibling rows.

**Expected**: matches spec Edge Cases section.

## Full regression check

```bash
cd frontend && npm run test:unit
cd backend && npm run test
cd e2e && npx playwright test search-result-filters.spec.ts library-filters.spec.ts
```

**Expected**: all existing filter/state-management tests still pass
unmodified in behavior — this feature changes only presentation and one
additive backend field pair (spec FR-014, SC-005).
