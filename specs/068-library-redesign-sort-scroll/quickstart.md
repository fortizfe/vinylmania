# Quickstart: validate 068

## Prerequisites

- Dependencies installed in `backend/`, `frontend/` and `e2e/`; Firebase emulators available (the backend and e2e test scripts start them).
- Local e2e uses the dev Redis from `backend/.env`. If lists look stale, flush the `discogs:libsync:*` keys (CI is unaffected).
- Contracts: [library-list-api.md](./contracts/library-list-api.md), [library-ui.md](./contracts/library-ui.md). Ordering rules: [data-model.md §3](./data-model.md).

## 1. Backend — sort rule, single path, title facet, API

```bash
cd backend
npm test -- tests/unit/library tests/contract/library tests/integration/library
```

Expected:
- `unit/library/domain/librarySort.test.ts` (new):
  - covers every row of data-model §3: diacritics and case compare equal; one leading article is stripped, while "The" alone and "A Perfect Circle" → "Perfect Circle" behave as documented;
  - missing keys sort last in both directions, newest first;
  - every tie resolves by `id`;
  - property check: sorting a shuffled input gives the same output.
- `unit/library/application/listLibraryEntries.test.ts` (new):
  - `repository.listAllEntries` is called once per request and there is no `listEntries`;
  - filter → sort → slice, with `totalItems` = the filtered count;
  - the pages concatenate to the full ordered set.
- `syncLibrary.facets.test.ts`: `title` is persisted when non-empty; `''` is not persisted and does not overwrite an existing value.
- `firestoreLibraryRepository.integration.test.ts`: `title` round-trips (the file has no `listEntries` cases to remove).
- `library.contract.test.ts`: the 7 cases in the API contract pass, and the unknown `sort`/`dir` case returns 200 with the default order.
- `tsc` passes with `listEntries` removed from the port and every test double.

## 2. Frontend — Vitest + RTL

```bash
cd frontend
npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/queries/libraryQueries.test.tsx \
  tests/unit/LibraryToolbar.test.tsx tests/unit/FiltersControl.test.tsx tests/unit/filters \
  tests/unit/motion/Overlay.test.tsx tests/unit/motion/Sheet.test.tsx tests/unit/ui/Modal.test.tsx \
  tests/unit/RecordCard.test.tsx tests/unit/RecordListRow.test.tsx tests/unit/ViewModeToggle.test.tsx \
  tests/integration/libraryListFlow.test.tsx tests/integration/recordDetailFlow.test.tsx \
  tests/integration/searchResultsFlow.test.tsx
```

Expected:
- **URL**: `?sort=foo&dir=up` → default; `?sort=artist` → `asc`; `?page=3` is ignored. `buildLibraryPath` omits the defaults and writes both `sort` and `dir` otherwise.
- **Infinite query**: key without a page; `getNextPageParam` stops at `totalItems`; refresh leaves exactly `[page 1]`.
- **Toolbar**:
  - `ViewModeToggle` is mounted exactly once (a single `view-mode-toggle` testid) at every width;
  - the select exposes 3 optgroups × 2 options; changing it calls `onSortChange` with `{ criterion, direction }`;
  - the sheet radios share one `name`;
  - the "Sort & Filter" name includes the active count and `aria-expanded` toggles;
  - crossing the 640 px media query closes the panel.
- **`FiltersControl live`**:
  - no Apply button;
  - ticking a checkbox calls `onApply` immediately and focus stays on that checkbox;
  - "Clear all filters" stays in the DOM, with `aria-disabled` when nothing is active.
  - Without `live`, the existing Search tests are unchanged and green.
- **Overlay / Sheet / Modal**: `variant="bottom"` / `dismissAxis="y"` / `position="bottom"` gives `data-variant="bottom"` with a top handle; reduced motion is opacity-only; Escape and the close button restore focus; existing `center`/`end` call sites are unchanged.
- **libraryListFlow**:
  - scrolling the sentinel appends batch 2, with skeletons inside the same list;
  - the end text reads "…— 21 records", and "1 record" when N = 1;
  - a batch-2 failure keeps batch 1 on screen and shows `role="alert"` + Retry; Retry loads batch 2;
  - a sort or filter change replaces the URL (history length unchanged; **replace is pending user confirmation**);
  - the status region reads "Sorted by artist, A to Z." after a sort change and "Showing N records." after a filter change; initial load and single-batch results make no end announcement;
  - two quick filter ticks where the first response is delayed render only the second selection's ids and announce once;
  - at 0 results there is neither an end message nor a sentinel;
  - a first-batch failure still shows the full-page error or gate.
- **recordDetailFlow**: opening a record from `/app/library?sort=album&dir=desc&genre=Rock`, then Back or delete, returns to that URL. Opening the detail directly, Back goes to `/app/library`.
- **searchResultsFlow**: unchanged (a regression guard for the shared filter component).

## 3. End-to-end — Playwright (chromium + webkit)

```bash
cd e2e
npm test -- tests/library-sort-scroll.spec.ts tests/library-toolbar.spec.ts \
  tests/library-list-responsive.spec.ts tests/library-filters.spec.ts \
  tests/reduced-motion.spec.ts tests/overlay-focus-management.spec.ts tests/overlay-contrast.spec.ts \
  tests/view-mode-toggle.spec.ts tests/motion-performance.spec.ts tests/dark-mode-contrast.spec.ts
```

`page.route('**/api/library*')` serves a 205-record fixture that honours `page`/`pageSize`/`sort`/`dir`/filters. The fixture contains accented, mixed-case and article names, missing artist/title, and `addedAt` ties.

`library-sort-scroll.spec.ts` (new):
1. **Global order (SC-007)**: for each of the 6 sorts, scroll to the end, collect every rendered record id, and check no duplicates, count = 205, and the order equals the fixture's reference order. The end message reads "— 205 records".
2. **Deep link (SC-006)**: in a fresh context, `/app/library?sort=artist&dir=desc&genre=Rock` shows the same first 20 ids as the reference and the select shows "Artist (Z → A)".
3. **Prefetch (SC-008)**: the request for page 2 fires before the sentinel enters the viewport (it is within 300 px of the viewport bottom).
4. **Tall screen**: at a 1280 × 2400 viewport, batches load without scrolling until the viewport is filled.
5. **Retry**: page 3 returns 500 → the alert and Retry appear, no further requests are made, and Retry loads page 3.
6. **Back navigation (SC-009)**: sort + filter, open a record, click Back → same URL and the same first ids.
7. **CLS (SC-001, chromium only; webkit has no `layout-shift` entries)**: a `PerformanceObserver({ type: 'layout-shift', buffered: true })` summing `value` for entries without `hadRecentInput`, over scrolling through 3 batches in grid and list modes. Expected: `0`.
8. **Reorder paint (SC-002)**: install a `PerformanceObserver('resource')` for `/api/library` and a `MutationObserver` on the list. On a sort change, measure from the response `responseEnd` to the mutation that shows the new first id. Expected: `< 100 ms`.

`library-toolbar.spec.ts` (new):
1. **390 × 844**:
   - the capsule's bottom is 16 px above the viewport bottom and it contains the view toggle and "Sort & Filter";
   - every interactive element's box is ≥ 44 × 44 (SC-005);
   - at the end of the list, the last card, the end message and Retry are not overlapped by the capsule's rect.
2. **Sheet**:
   - opens from "Sort & Filter" and closes via Escape, the Close button, a scrim click and a drag down (≥ 45 % of its height); focus returns to the trigger each time;
   - picking a radio updates the URL and keeps the sheet open;
   - ticking a genre updates the badge and the count while focus stays on the checkbox.
3. **1280 × 800**:
   - the toolbar stays at `top = --header-h` after scrolling 2000 px;
   - at 1440 px, the toolbar width equals the `<main>` content width (`xl:max-w-7xl`); at 1100 px it equals `max-w-4xl`;
   - the select change updates the URL;
   - "Filters" opens the side drawer, and "Clear all filters" clears the filters and keeps focus.
4. **Keyboard only (SC-004)**: Tab to the select → change the sort → Tab to "Filters" → Enter → tick and untick a genre → Escape → Tab to a record → scroll with Space until a batch loads → force a failure → Tab to Retry → Enter. There is no trap, and the focus ring is visible at each step (`helpers/focusRing.ts`).
5. **Axe (SC-003)**: `runAxeScan` reports 0 violations in light and dark themes, at 390 and 1280 px, in the loading, loaded, end, error, and sheet/drawer-open states.
6. **Material contrast**: `helpers/contrast.ts` checks the toolbar text/border pairings over a fixture cover (a solid black PNG, then a white one) against the D17 floors. Under `page.emulateMedia({ contrast: 'more' })`, the toolbar's computed `backdrop-filter` is `none` and it has a 1 px border. `page.emulateMedia({ reducedTransparency })` is silently ignored (Playwright 1.61), but CDP `Emulation.setEmulatedMedia` with the `prefers-reduced-transparency` feature does work and was used ad hoc in T070; missing `backdrop-filter` support cannot be emulated in Chromium at all. Both fallbacks stay on the manual list (§4); the reduced-transparency one could be added to this suite as a chromium-only case if wanted.
7. **Reduced motion (FR-027)**: with `reducedMotion: 'reduce'`, opening and closing the sheet shows no transform motion (`helpers/motion.ts` `expectNoTransformMotion`).

Updated specs (research D22):
- the Next-button flow becomes a scroll;
- Apply becomes live;
- Library-overlay cases (`overlay-focus-management`, `overlay-contrast`, the Library case in `reduced-motion`) move to the Library "Filters" drawer;
- shared-primitive cases (the centred Modal and `CollapsibleFilterPanel` in `motion-performance`, the Genre modal in `dark-mode-contrast`, the `CollapsibleFilterPanel` case in `reduced-motion`) move to `/app/search`, which keeps those primitives;
- `view-mode-toggle` is unchanged, since the toggle is mounted once.

All helpers live in `e2e/helpers/`.

## 4. Manual check

Run `npm run dev` in `backend/` and `frontend/` and sign in with a linked Discogs account.
- **Artist (A → Z)**: "The Beatles" sits under B and "Motörhead" next to "Motorpsycho".
- **Rotation**: rotate the phone (or resize across 640 px) with the sheet open. It closes, and the sort, filters and loaded records stay.
- **Transparency and contrast settings**: turn on macOS "Reduce transparency". The toolbar and capsule become opaque. With "Increase contrast" they gain a border.
