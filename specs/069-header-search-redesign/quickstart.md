# Quickstart: validate 069

## Prerequisites

- Dependencies installed in `backend/`, `frontend/` and `e2e/`.
- **No Firebase emulator is needed for this feature** — nothing here touches Firestore. The e2e suite still starts the emulators through its own scripts for sign-in.
- **Local e2e uses the dev Redis from `backend/.env`.** A stale entry can make a suggestion spec assert against yesterday's catalog. Flush just this feature's prefix before a local run; CI is unaffected:
  ```bash
  redis-cli --scan --pattern 'discogs:suggest:*' | xargs -r redis-cli del
  ```
- Contracts: [suggest-api.md](./contracts/suggest-api.md), [header-search-ui.md](./contracts/header-search-ui.md). Quota table, glossary and panel states: [data-model.md](./data-model.md). Decisions: [research.md](./research.md).

## 1. Backend — quota rule, use case, adapter, endpoint

```bash
cd backend
npm test -- tests/unit/discogsCatalog tests/contract/discogsCatalog
```

Expected:

- **`unit/discogsCatalog/domain/suggestionQuota.test.ts`** (new) — every row of [data-model §3](./data-model.md) passes, plus the invariants: length `= min(5, A + B)`, never more than 5, every output element came from the input, no duplicates, artists before albums, and the same input always gives the same output.
- **`unit/discogsCatalog/application/suggestCatalogMatches.test.ts`** (new):
  - exactly **one** `discogsCatalog.searchCatalog` call per cache miss, with `{ resultType: 'any', page: 1, perPage: 20 }`;
  - **zero** calls to `getReleaseRating` and `getMasterRelease` — the rating fan-out is not on this path;
  - the cache key is `discogs:suggest:{normalizedQuery}` with TTL `300`, and `"Iron "`, `"iron"`, `"IRON"` and `"iron  maiden"`/`"iron maiden"` collapse onto the same key;
  - a second call inside the TTL makes **no** further `searchCatalog` call;
  - a query with fewer than 2 non-whitespace characters returns `[]` without touching the cache or the port;
  - a `CachePort` that fails still returns a correct result (fail-soft).
- **`unit/discogsCatalog/adapters/discogsCatalogAdapter.test.ts`** (changed) — `resultType: 'any'` sends **no** `type` param upstream and keeps `release`, `master` and `artist` hits while dropping a `label` hit without throwing; `'release'` and `'artist'` behave exactly as before (regression guard for `/api/discogs/search`).
- **`contract/discogsCatalog/suggest.contract.test.ts`** (new) — the 10 cases in [suggest-api.md §7](./contracts/suggest-api.md), including the `429` case proving the `/suggest` burst does **not** consume `/api/discogs/search`'s budget.
- `tsc` passes with the widened `SearchCatalogOptions.resultType` across every test double.

## 2. Frontend — Vitest + RTL

```bash
cd frontend
npx vitest run tests/unit/HeaderSearchBox.test.tsx tests/unit/HeaderSuggestionPanel.test.tsx \
  tests/unit/queries/discogsQueries.test.tsx tests/unit/AppHeader.test.tsx \
  tests/integration/headerSearchFlow.test.tsx tests/integration/searchResultsFlow.test.tsx
```

Expected:

- **`HeaderSuggestionPanel`** — the five states of [data-model §5](./data-model.md) render as [header-search-ui.md §3](./contracts/header-search-ui.md) specifies: the `<ul role="listbox" id="header-search-listbox">` exists whenever the panel is displayed; loading renders 5 `aria-hidden` skeleton rows and **0** options; `empty` and `error` text sits outside the listbox; the error state exposes a "Retry" button and is **not** `role="alert"`; each option's accessible name ends in "Artist" or "Album" and that label is **text**, present with colour stripped; a loading panel and a loaded panel report the same height.
- **`HeaderSearchBox`**:
  - activation focuses the field with no second interaction, and on `/app/search` the pre-filled text is **selected** and **no** request is made (FR-004);
  - typing 10 characters at speed produces **≤ 3** lookups, and **0** while the timer has not elapsed (SC-004);
  - a paste of a long string is **one** lookup;
  - arrow keys move `aria-activedescendant` only — `document.activeElement` stays the input at every step; arrowing past either end clears the active option;
  - `Enter` with an active option navigates to that option's destination; with none it submits, calling `navigate` with exactly today's arguments (including filter preservation on the results screen);
  - `Escape` closes the panel and keeps the text, a second `Escape` collapses and returns focus to the opener; the backdrop click and a `focusout` to a target outside the container do the same at **both** widths;
  - emptying the field closes the panel and clears the `role="status"` region;
  - the announcement region carries exactly the strings of [header-search-ui.md §5](./contracts/header-search-ui.md).
- **`discogsQueries`** — `discogsKeys.suggest(query)`; `enabled` is false below 2 trimmed characters and false until `hasEdited`; `staleTime` 5 min; `retry: false`.
- **`headerSearchFlow`** — a delayed first response followed by a faster second renders **only** the second query's rows and announces once (FR-013, SC-005); clearing the field mid-flight leaves nothing rendered or announced when the response lands (FR-015); a failed lookup shows the error plus Retry, and Retry returns the panel to the loading state (FR-019); with the lookup failing, submitting still reaches `/app/search` (FR-020, SC-009).
- **`searchResultsFlow`** and **`AppHeader`** — unchanged and green: the results screen and the header's other cells are regression guards.

## 3. End-to-end — Playwright (chromium + webkit)

```bash
cd e2e
npm test -- tests/header-search.spec.ts tests/header-responsive-nav.spec.ts \
  tests/reduced-motion.spec.ts tests/dark-mode-contrast.spec.ts
```

`page.route('**/api/discogs/suggest*')` serves a fixture that honours `q` and can be switched per test to: a 5-result mix, an artists-only set, an albums-only set, an empty set, a `502`, and a delayed response.

`header-search.spec.ts` (new):

1. **Entry point at every width (SC-001)** — at 375 px and 1440 px, from `/app`, `/app/library` and `/app/search`: one interaction reaches a focused field, with no second tap to place the cursor.
2. **Phone overlay (FR-005, SC-010)** — at 375 px the overlay is full width, `document.scrollingElement.scrollWidth` equals the viewport width (no horizontal scroll), every interactive box is ≥ 44×44, the page behind does not scroll while open, and the scroll position is restored on collapse.
3. **Non-modal (clarification 3)** — with the overlay open, the search container carries **no** `aria-modal` and no `role="dialog"`; a `<main>` landmark outside it is still reachable in the accessibility tree; `Tab` from the last element inside the search moves out of it (and collapses it) rather than cycling.
4. **Wide layout (FR-006, SC-008)** — at 1440 px, the bounding box of the first element under the header is identical before, during and after expansion; a `PerformanceObserver({ type: 'layout-shift', buffered: true })` sums `0` (chromium only).
5. **Panel size stability (FR-014, SC-008)** — with the delayed fixture, the panel's height while loading equals its height once loaded.
6. **Three interactions to a record (SC-002)** — activate, type, click an album suggestion → `/app/releases/:id` or `/app/masters/:id`. An artist suggestion → `/app/search?q=<name>`.
7. **Keyboard-only, SC-006** — at 375 px and 1440 px, with no pointer: Tab to the search, type, `ArrowDown` through the list, `Enter`, then reopen and `Escape` twice. After **every** state change (loading, results, empty, error) assert the `role="status"` region's text against [header-search-ui.md §5](./contracts/header-search-ui.md), and assert `aria-expanded` and `aria-activedescendant` (and the matching `aria-selected="true"` option) at each step. `helpers/focusRing.ts` confirms the indicator is visible in both themes.
8. **Quota shape (SC-011)** — the artists-only fixture with 6 hits fills the panel to 5; the mixed fixture shows 2 artists then 3 albums.
9. **Lookup counting (SC-004, SC-005)** — count `/api/discogs/suggest` requests while typing a 10-character query at normal speed: ≤ 3. In a 20-keystroke type-and-delete run, the rendered rows always belong to the text currently in the field (0 stale lists).
10. **Failure never blocks submit (SC-009)** — with the `502` fixture, submitting reaches `/app/search` for that query, 100 % of attempts.
11. **Axe (SC-007)** — `helpers/axe.ts` reports **0** WCAG 2.1 AA violations in light and dark, at 375 px and 1440 px, in all five states (idle, loading, suggestions, empty, error).
12. **Contrast (FR-025)** — `helpers/contrast.ts` checks the two new pairings of [header-search-ui.md §8](./contracts/header-search-ui.md) against their floors, both themes.

Updated specs:

- `header-responsive-nav.spec.ts` — the collapsed entry point below 640 px is a 44×44 icon button, and the header's other cells keep their positions.
- `reduced-motion.spec.ts` — with `reducedMotion: 'reduce'`, `helpers/motion.ts`'s `expectNoTransformMotion` on the search open/close, while the backdrop still appears and focus behaviour is unchanged (FR-009).
- `dark-mode-contrast.spec.ts` — the panel's five states in dark mode.

All helpers live in `e2e/helpers/`.

## 4. Manual check (recommended, not a merge gate — clarification 5)

Run `npm run dev` in `backend/` and `frontend/` and sign in.

- **Screen reader pass** (VoiceOver on macOS/iOS, NVDA on Windows): open the search, type "iron", arrow through the list, choose one, then `Escape` out. The result count, the empty state and the error state should each be spoken politely without cutting off typing. This is the pass the clarification marks recommended.
- **Without a linked Discogs account**, suggestions still appear (spec Assumptions).
- **Repeat a query** typed a minute ago: the panel fills with no visible delay, and the backend log shows no new upstream call.
- **macOS "Reduce transparency" and "Increase contrast"**: the backdrop turns near-solid and loses its blur, inherited from `.overlay-scrim`.
- **Rotate the phone** (or resize across 640 px) with the search open: it re-lays out to the other layout without losing the typed text.
