---

description: "Task list for 068 — Library redesign: sorting, infinite scroll, WCAG 2.1 AA & Apple HIG"
---

# Tasks: "My Library" Redesign — Sorting, Infinite Scroll, WCAG 2.1 AA & Apple HIG

**Input**: Design documents from `/specs/068-library-redesign-sort-scroll/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D22), data-model.md, contracts/library-list-api.md, contracts/library-ui.md, quickstart.md

**Tests**: REQUIRED (Constitution Principle I, Test-First, non-negotiable; HU §4). Every story's "Tests" block, e2e included, must be written, seen failing, and **reviewed/approved by the developer or reviewer** before its "Implementation" block starts. The checkpoint line "Red tests reviewed/approved before Implementation." marks each gate. Test tasks run only the named files. Full backend Jest+emulator runs are slow and happen only in the final Polish gate.

**Organization**: grouped by user story (US1–US4, all P1, in spec order). Each task ends with `— owner: <agent>` for `speckit-agent-assign-assign`. e2e helpers live in `e2e/helpers/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (story phases only)
- Paths are repo-relative: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`, `e2e/helpers/`

**Decision to revisit**: live sort/filter changes use `navigate(path, { replace: true })`, not push (data-model §5, contracts/library-ui §1). The user has not confirmed this. If push is preferred, only the page's `navigate` calls in T023 and T057 and their flow tests T014 and T050 change.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Record a green baseline for exactly the files this feature touches. No installs are needed (0 new dependencies).

- [X] T001 Run the targeted backend baseline `cd backend && npm test -- tests/unit/library tests/contract/library tests/integration/library tests/unit/collectionStats` and record any pre-existing failures in the PR notes before changing anything — owner: qa-agent
- [X] T002 [P] Run the targeted frontend baseline `cd frontend && npx vitest run tests/unit/hooks tests/unit/queries/libraryQueries.test.tsx tests/unit/FiltersControl.test.tsx tests/unit/filters tests/unit/motion tests/unit/ui/Modal.test.tsx tests/unit/RecordCard.test.tsx tests/unit/RecordListRow.test.tsx tests/unit/ViewModeToggle.test.tsx tests/integration/libraryListFlow.test.tsx tests/integration/recordDetailFlow.test.tsx tests/integration/searchResultsFlow.test.tsx` and record the result — owner: qa-agent

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared types and the sort-option catalogue that US1, US3 and US4 all consume. This phase is intentionally thin. Everything else is owned by a single story (research D3–D21).

**⚠️ CRITICAL**: US1 cannot start until this phase is complete.

- [X] T003 [P] Add `title?: string` to `LibraryEntry` (doc comment: mirrored from `basic_information.title` by the sync, backfilled, never cleared) and add `LibrarySort = { criterion: 'added' | 'artist' | 'album'; direction: 'asc' | 'desc' }` plus `DEFAULT_LIBRARY_SORT = { criterion: 'added', direction: 'desc' }` in backend/src/domain/library/types.ts (data-model §1–§2) — owner: backend-agent
- [X] T004 [P] Create frontend/src/constants/librarySortOptions.ts exporting the six options from contracts/library-ui.md §2 in display order. Each option has `sort`, `dir`, `group` ('Date added' | 'Artist' | 'Album'), `label` (with "→") and `announcement` ("Sorted by artist, A to Z."). Also export `LibrarySortCriterion`, `LibrarySortDirection`, `LibrarySortValue` and `DEFAULT_LIBRARY_SORT` (`added`/`desc`) (research D14) — owner: frontend-agent

**Checkpoint**: types and the option catalogue exist. Story work can begin.

---

## Phase 3: User Story 1 — Sort the library by artist, album or date added (Priority: P1) 🎯 MVP

**Goal**: the six sort orders are applied by the backend over the whole matching collection before slicing. Sort lives in the URL, can be picked from a native dropdown, and is announced politely. At this point it works with the existing Previous/Next pagination.

**Independent Test**: open `/app/library?sort=artist&dir=asc&genre=Rock`. The select shows "Artist (A → Z)", the Rock filter stays, and pages 1…N (using the still-present Next button) concatenate to the reference artist order with no duplicates. Change the select → the URL updates, the list restarts, and the status region says "Sorted by …". (spec US1 AS1–AS6)

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T005 [P] [US1] Create e2e/tests/library-sort-scroll.spec.ts, failing against today's UI (SC-006, SC-002): a `page.route('**/api/library*')` fixture of 205 records that honours `page`/`pageSize`/`sort`/`dir`/`genre`, with accented, mixed-case and leading-article names, missing artist/title, and `addedAt` ties, plus a reference sorter implementing data-model §3; scenario "deep link": in a fresh context, `/app/library?sort=artist&dir=desc&genre=Rock` shows the reference first 20 ids and the select `#library-sort` shows "Artist (Z → A)"; scenario "select change": the URL gains `sort`/`dir` and the first 20 match the reference; scenario "reorder paint < 100 ms": measure from the `/api/library` `responseEnd` (PerformanceObserver `resource`) to the MutationObserver record that shows the new first id — owner: qa-agent
- [X] T006 [P] [US1] Write failing unit tests in backend/tests/unit/library/domain/librarySort.test.ts covering every row of data-model.md §3 (FR-003, FR-003a, FR-004, FR-005): accents and case compare equal ("Motörhead"/"motorhead", "Björk"/"Bjork", "ac/dc"/"AC/DC"); one leading article is stripped (The, A, An, El, La, Los, Las, Die, Les; "The Clash" under C, "A Perfect Circle" under P), while "The" alone stays "The"; numbers compare naturally; missing or empty keys sort last in both `asc` and `desc`, newest first, then by id; artist ties → album asc → `addedAt` desc → `id` asc; album ties → artist asc → `addedAt` desc → `id` asc; `added` ties → `id` asc; the output for a shuffled input is identical and the input array is not mutated — owner: backend-agent
- [X] T007 [P] [US1] Write failing unit tests in backend/tests/unit/library/application/listLibraryEntries.test.ts using an in-memory `LibraryRepositoryPort` double with no `listEntries` (research D3, FR-002, SC-007): `listAllEntries` is called exactly once per call; the pipeline is filter (existing rule) → `sortLibraryEntries(sort)` → slice by `page`/`pageSize`; `totalItems` equals the filtered count; pages 1..⌈total/pageSize⌉ concatenate to the full ordered set; `syncLibrary` and `enrichEntries` are still called as today — owner: backend-agent
- [X] T008 [P] [US1] Extend backend/tests/unit/library/syncLibrary.facets.test.ts: `title` is passed to `persistCollectionFacets` when `basic_information.title` is non-empty after trim; an empty/whitespace title is omitted and never overwrites an existing value; it applies both to matched entries and to newly created ones (research D4) — owner: backend-agent
- [X] T009 [P] [US1] Add the 7 sort cases from contracts/library-list-api.md "Contract test cases" to backend/tests/contract/library/library.contract.test.ts: artist asc/desc with missing-last, album with tie-breaks, added asc and the default, silent fallback for `?sort=foo&dir=up`, `genre` + paging concatenation, and `title` on items after sync (FR-001, FR-002, FR-004, FR-007) — owner: backend-agent
- [X] T010 [P] [US1] Add a `title` round-trip case (`persistCollectionFacets` → `getEntry` and `listAllEntries`) to backend/tests/integration/library/adapters/firestoreLibraryRepository.integration.test.ts (research D4) — owner: backend-agent
- [X] T011 [P] [US1] Extend frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx for the interim US1 signature `buildLibraryPath(filters?, sort?, page = 1)` (FR-006, FR-007, data-model §2): `sort`/`dir` parse to `{criterion, direction}`; `?sort=foo` → default; `?sort=artist` without `dir` → `asc`; `?sort=added&dir=up` → `desc`; `buildLibraryPath` omits both params for the default and writes both `sort` and `dir` otherwise, plus `page` when > 1; filters are preserved in both directions — owner: frontend-agent
- [X] T012 [P] [US1] Extend frontend/tests/unit/queries/libraryQueries.test.tsx: `libraryApi.list` sends `sort` and `dir` query params, and the list query key includes the sort so two sorts never share cache (FR-002, FR-015) — owner: frontend-agent
- [X] T013 [P] [US1] Create frontend/tests/unit/LibraryToolbar.test.tsx with failing tests for the sort `<select>` (FR-001, FR-009a, US1 AS1–AS3): it has a visible `<label>` "Sort" and three `<optgroup>`s (Date added, Artist, Album) × two options, labelled from `librarySortOptions`; the current option is selected; `onChange` calls `onSortChange` with the chosen option's `{ criterion, direction }`; `ViewModeToggle` is rendered exactly once (a single `view-mode-toggle` testid) — owner: frontend-agent
- [X] T014 [P] [US1] Extend frontend/tests/integration/libraryListFlow.test.tsx (US1 AS2, AS5, AS6; FR-008): a deep link `/app/library?sort=artist&dir=asc&genre=Rock` requests `/api/library` with `sort=artist&dir=asc&genre=Rock` and shows that option selected; changing the select replaces the URL (history length unchanged, filters kept) and requests page 1; after the new data renders, the sr-only `role="status"` region reads "Sorted by artist, A to Z." exactly once, focus stays on the select, and initial load announces nothing; applying a filter keeps `sort`/`dir` in the URL — owner: frontend-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 1

- [X] T015 [US1] Implement backend/src/domain/library/librarySort.ts to make T006 pass (research D1–D2): one module-level `Intl.Collator('en', { sensitivity: 'base', numeric: true })`; a key normaliser: trim → empty = missing → strip `/^(the|a|an|el|la|los|las|die|les)\s+(?=\S)/i`; `sortLibraryEntries(entries, sort)` using decorate–sort–undecorate, a present/missing split and the tie-break chains — owner: backend-agent
- [X] T016 [US1] Persist the album title to make T008 and T010 pass (research D4): in backend/src/application/library/syncLibrary.ts, add `title` to `CollectionFacetPatch` and to `collectionFacets()` when `instance.title.trim()` is non-empty; in backend/src/ports/library/libraryRepositoryPort.ts, add `title?: string` to the `persistCollectionFacets` facets; in backend/src/adapters/library/firestoreLibraryRepository.ts, write `title` in `persistCollectionFacets` and map it in `toLibraryEntry` — owner: backend-agent
- [X] T017 [US1] Collapse to a single list path to make T007 pass (research D3, FR-002): rewrite backend/src/application/library/listLibraryEntries.ts as `listLibraryEntries(uid, page, pageSize, filters, sort, options)` → sync → `listAllEntries` → filter → `sortLibraryEntries` → slice → enrich; remove `hasActiveLibraryFilters`/`listEntriesFiltered`; add the comment `// ponytail: reads the whole per-user mirror per batch (~N reads); ceiling a few thousand records or read-quota pressure; upgrade: Redis-cached sorted id list per (uid, sort, filters) or persisted sort keys + Firestore cursors`; delete `listEntries` from backend/src/ports/library/libraryRepositoryPort.ts and backend/src/adapters/library/firestoreLibraryRepository.ts; delete `PaginatedLibraryEntries` from backend/src/domain/library/types.ts if it is now unused; remove the `listEntries: jest.fn()` stubs from backend/tests/unit/library/syncLibrary.facets.test.ts, backend/tests/unit/library/application/syncLibrary.test.ts, backend/tests/unit/library/application/createLibraryEntry.test.ts, backend/tests/unit/library/application/enrichLibraryEntry.test.ts and backend/tests/unit/collectionStats/application/getCollectionStatistics.test.ts — owner: backend-agent
- [X] T018 [US1] In backend/src/adapters/library/libraryRoutes.ts, add `parseLibrarySort(req)` next to `parseLibraryFilters` and pass the result to `listLibraryEntries`. Parsing: `sort ∈ {added, artist, album}` else `added`; `dir ∈ {asc, desc}` else the criterion default (`desc` for added, `asc` otherwise); never a 400. Extend the success log `meta` to `{ filters, sort, dir, page, totalItems }`. This makes T009 pass (research D6–D7, FR-007, Principle V) — owner: backend-agent
- [X] T019 [US1] Run `cd backend && npm test -- tests/unit/library tests/contract/library tests/integration/library tests/unit/collectionStats && npm run build` and fix until green, with `tsc` clean after the `listEntries` removal — owner: backend-agent
- [X] T020 [P] [US1] Add `sort` to frontend/src/hooks/useLibraryQueryParams.ts, using the parse/fallback rules of data-model §2 and `DEFAULT_LIBRARY_SORT` from frontend/src/constants/librarySortOptions.ts. Change the signature to the interim `buildLibraryPath(filters?, sort?, page = 1)`, writing both `sort`/`dir` only when non-default and `page` only when > 1, and update its existing callers. `page` is still returned; US2 removes it. This makes T011 pass (FR-006, FR-007, research D12) — owner: frontend-agent
- [X] T021 [US1] Add an optional `sort` argument to `list()` in frontend/src/services/libraryApi.ts (sets `sort`/`dir`). In frontend/src/queries/libraryQueries.ts, add the sort to `libraryKeys.list`, `useLibraryList` and `useRefreshLibrary`. This makes T012 pass — owner: frontend-agent
- [X] T022 [US1] Create frontend/src/components/LibraryToolbar.tsx as a single in-flow bar element (made capsule/sticky/translucent in US3) containing `ViewModeToggle` (mounted once) and a native `<label for="library-sort">Sort</label><select id="library-sort">` with one `<optgroup>` per criterion from `librarySortOptions`. The select is styled `min-h-11 rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 dark:border-border-dark dark:bg-surface-raised dark:text-stone-100 dark:[color-scheme:dark]` plus the shared `focusRing`, and `onChange` → `onSortChange({ criterion, direction })`. This makes T013 pass (research D14–D15, FR-009a) — owner: frontend-agent
- [X] T023 [US1] Wire sorting into frontend/src/pages/LibraryListPage.tsx to make T014 pass (FR-006, FR-008, FR-014): read `sort` from `useLibraryQueryParams` and render `LibraryToolbar` in place of the standalone `ViewModeToggle`; on sort change: `navigate(buildLibraryPath(filters, sort), { replace: true })`, then `window.scrollTo({ top: 0 })`; route filter apply/clear and Previous/Next through `buildLibraryPath(filters, sort, page)`; add one sr-only `<p role="status">` that is set to the option's `announcement` once the first page for a new sort has rendered (never on initial load, never moving focus) — owner: frontend-agent
- [X] T024 [US1] Run `cd frontend && npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/queries/libraryQueries.test.tsx tests/unit/LibraryToolbar.test.tsx tests/integration/libraryListFlow.test.tsx` and `cd e2e && npm test -- tests/library-sort-scroll.spec.ts`. The US1 scenarios of T005 must be green — owner: qa-agent

**Checkpoint**: US1 is fully functional with the existing pagination. This is the MVP.

---

## Phase 4: User Story 2 — Continuous loading with infinite scroll and zero layout shift (Priority: P1)

**Goal**: replace Previous/Next with 20-record batches loaded 300 px before the end, with in-list skeletons, an end message, a paused Retry on failure, Refresh reset, announcements, and a return path from record detail.

**Independent Test**: with more than 20 records, scroll: batches append automatically before the end, skeletons match the cards, CLS stays 0, and "You've reached the end of your collection — N records" appears. A failed batch keeps the records already shown and offers Retry. Opening a record and pressing Back returns to the same URL. This does not require US3's toolbar; if US1 has not landed, the list simply stays in default order.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T025 [P] [US2] Extend e2e/tests/library-sort-scroll.spec.ts with failing scenarios (SC-001, SC-007, SC-008, SC-009, FR-013): "global order": for each of the 6 sorts, scroll to the end, collect ids, check no duplicates, count = 205, order equals the reference, and the end text reads "— 205 records"; "prefetch": the page-2 request fires before the sentinel enters the viewport; "tall screen": at 1280×2400, batches load without scrolling until the viewport is filled; "retry": page 3 → 500 shows alert + Retry, makes no further requests, and Retry loads page 3; "back navigation": sort + filter, open a record, Back → same URL and same first ids; "CLS" (chromium only; skip on webkit): the `PerformanceObserver({type:'layout-shift', buffered:true})` sum of entries without `hadRecentInput` is 0 over 3 batches in grid and in list mode — owner: qa-agent
- [X] T026 [P] [US2] Migrate e2e/tests/library-list-responsive.spec.ts from the removed "Next" button flow (lines ~85 and ~179) to scroll-triggered loading, keeping its responsive-grid assertions (research D22) — owner: qa-agent
- [X] T027 [P] [US2] Extend frontend/tests/unit/queries/libraryQueries.test.tsx (research D8, D10, FR-014): `useLibraryList(sort, filters)` is an infinite query whose key has no page; `getNextPageParam` returns `page + 1` while `page * pageSize < totalItems`, otherwise `undefined`; `useRefreshLibrary` calls `list(1, 20, true, filters, sort)` and leaves the cache as exactly `{ pages: [page1], pageParams: [1] }` — owner: frontend-agent
- [X] T028 [P] [US2] Extend frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx: `page` is no longer returned, `?page=3` is ignored, and the final `buildLibraryPath(filters?, sort?)` never writes `page` (spec edge case "legacy ?page=N") — owner: frontend-agent
- [X] T029 [P] [US2] Extend frontend/tests/integration/libraryListFlow.test.tsx with a mocked `IntersectionObserver` (FR-010–FR-014, FR-028, US2 AS1–AS5, spec edge cases): the observer is created with `rootMargin: '0px 0px 300px 0px'`; intersecting appends batch 2, and while it loads `min(20, remaining)` skeleton `<li>`s render inside the same list (`library-record-grid` / `-list`); the Previous/Next buttons are gone; the end text reads "You've reached the end of your collection — 21 records" ("1 record" for N = 1), and no request is made after the end; at 0 results neither the end message nor the sentinel is rendered; a batch-2 500 keeps batch 1 on screen and shows `role="alert"` "Couldn't load more records. Please try again." plus a "Retry" button, with no automatic reload until Retry is clicked; a first-batch failure still shows the full-page error or the Discogs link gate; the status region says "20 more records loaded." and "… End of collection, N records.", and a single-batch result makes no end announcement — owner: frontend-agent
- [X] T030 [P] [US2] Extend frontend/tests/unit/RecordCard.test.tsx and frontend/tests/unit/RecordListRow.test.tsx: the new required `from` prop is carried as `state={{ from }}` on every record `Link`, including the catalog-unavailable variant (research D12) — owner: frontend-agent
- [X] T031 [P] [US2] Extend frontend/tests/integration/recordDetailFlow.test.tsx (FR-015a, US2 AS6): entering `/app/library/records/:id` with `state.from = '/app/library?sort=album&dir=desc&genre=Rock'` makes every Back link and the post-delete navigation go to that path; entering directly goes to `/app/library` — owner: frontend-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 2

- [X] T032 [US2] Convert frontend/src/queries/libraryQueries.ts to make T027 pass (research D8, D10, D11): `libraryKeys.list(sort, filters)` has no page; `useLibraryList` → `useInfiniteQuery` with `initialPageParam: 1`, `retry: false` and the `getNextPageParam` from D8; `useRefreshLibrary(sort, filters)` resets to page 1 via `setQueryData`; add `// ponytail: invalidateQueries refetches every loaded page after a mutation; upgrade to resetQueries(lists) if deep scrolls + edits get slow` above the mutations' invalidation — owner: frontend-agent
- [X] T033 [US2] Remove `page` from frontend/src/hooks/useLibraryQueryParams.ts and drop the `page` parameter from `buildLibraryPath`, leaving `(filters?, sort?)`. This makes T028 pass — owner: frontend-agent
- [X] T034 [P] [US2] Add a required `from: string` prop to frontend/src/components/RecordCard.tsx and frontend/src/components/RecordListRow.tsx and pass `state={{ from }}` to every record `Link`. Both are Library-only; WishlistPage uses only `RecordCardSkeleton`. This makes T030 pass (research D12) — owner: frontend-agent
- [X] T035 [P] [US2] In frontend/src/pages/RecordDetailPage.tsx, compute `backTo = (location.state as { from?: string } | null)?.from ?? '/app/library'` and use it in every `BackLink`, the `backTo` prop and the post-delete `navigate`. This mirrors `ReleaseDetailPage` and makes T031 pass (FR-015a) — owner: frontend-agent
- [X] T036 [US2] Rebuild the list in frontend/src/pages/LibraryListPage.tsx to make T029 and T025/T026 pass (research D9, D12, D20, D21; FR-010–FR-014, FR-028): render `data.pages.flatMap(p => p.items)`; append next-batch skeletons in the same `<ul>` (8 on initial load, `min(20, totalItems − loaded)` for later batches); add a `<div aria-hidden="true">` sentinel (only when items exist and `hasNextPage`) observed with `rootMargin: '0px 0px 300px 0px'`, with effect deps `[hasNextPage, isFetchingNextPage, nextPageError, fetchNextPage]` so tall screens auto-fill, marked `// ponytail: duplicate of SearchResultsPage sentinel effect; extract a shared hook when a third infinite list appears`; add the end message (only when items exist) and the `role="alert"` + Retry block, and remove Previous/Next; pass `currentLibraryPath = buildLibraryPath(filters, sort)` as `from` to `RecordCard`/`RecordListRow`; extend the status region with the batch/end rows of contracts/library-ui §5 — owner: frontend-agent
- [X] T037 [US2] Run `cd frontend && npx vitest run tests/unit/queries/libraryQueries.test.tsx tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/RecordCard.test.tsx tests/unit/RecordListRow.test.tsx tests/integration/libraryListFlow.test.tsx tests/integration/recordDetailFlow.test.tsx` and `cd e2e && npm test -- tests/library-sort-scroll.spec.ts tests/library-list-responsive.spec.ts` until green — owner: qa-agent

**Checkpoint**: US1 and US2 both work. The library scrolls continuously in any sort.

---

## Phase 5: User Story 3 — Ergonomic dual layout toolbar (Priority: P1)

**Goal**: one bar element is a floating translucent capsule below 640 px (view toggle + "Sort & Filter" → bottom sheet with sort radios + live filters) and a sticky translucent toolbar from 640 px (view toggle, sort select, "Filters" → side drawer). On Library only, filters apply live. The header shows the count and Refresh.

**Independent Test**: at 390 px, the capsule sits 16 px above the bottom, never hides the last records, end message or Retry, and "Sort & Filter" opens a drag-dismissible sheet whose radio and filter changes apply immediately. At 1280 px, the toolbar stays under the app header while scrolling and "Filters" opens the drawer. Search's filters still use Apply. Sort needs US1 to be meaningful; the capsule, sheet, drawer and live filters are testable without US2.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T038 [P] [US3] Create e2e/tests/library-toolbar.spec.ts with failing scenarios 1–3 from quickstart §3 (FR-016–FR-019, FR-024, SC-005): at 390×844: the capsule's bottom is 16 px above the viewport bottom, every interactive box is ≥ 44×44, and the last card, end text and Retry do not intersect the capsule rect; sheet: Escape, Close, scrim click and drag-down each dismiss it and return focus to "Sort & Filter"; a radio updates the URL with the sheet still open; a genre tick updates the badge and count with focus kept; at 1280×800: the toolbar top equals `--header-h` after scrolling 2000 px; the select updates the URL; "Filters" opens the drawer; "Clear all filters" clears and keeps focus; width: at 1440 px the toolbar width equals the `<main>` content width (`xl:max-w-7xl`), and at 1100 px it equals `max-w-4xl` (FR-018 as amended to ≥ 1280 px) — owner: qa-agent
- [X] T039 [P] [US3] Migrate e2e/tests/library-filters.spec.ts from `#filter-genre-trigger` + Apply to the live filters in the Library "Filters" drawer (1280 px) and the "Sort & Filter" sheet (390 px), asserting the URL, count and results update per tick (research D22, FR-021a) — owner: qa-agent
- [X] T040 [P] [US3] Migrate e2e/tests/overlay-focus-management.spec.ts so its Library overlay vehicle becomes the "Filters" drawer (open → focus trapped → Escape → focus back on "Filters") instead of `#filter-genre-trigger` (research D22) — owner: qa-agent
- [X] T041 [P] [US3] Migrate e2e/tests/reduced-motion.spec.ts (research D22, FR-027): its Library overlay case becomes the "Filters" drawer, and the bottom sheet at 390 px is added, both asserting no transform motion under `reducedMotion: 'reduce'` via `expectNoTransformMotion` from e2e/helpers/motion.ts; the "CollapsibleFilterPanel disclosure body" case (~L172–L187) moves to `/app/search` (which keeps the collapsible panel) with a search route mock — owner: qa-agent
- [X] T042 [P] [US3] Migrate e2e/tests/overlay-contrast.spec.ts so its Library overlay vehicle over busy covers becomes the "Filters" drawer instead of `#filter-genre-trigger` (research D22) — owner: qa-agent
- [X] T043 [P] [US3] Migrate e2e/tests/motion-performance.spec.ts: move "centered Modal enter + exit spring holds 60 fps" (~L250–L262) and "CollapsibleFilterPanel disclosure holds 60 fps" (~L312–L316) from `/app/library` to `/app/search` with a `**/api/discogs/search*` route mock. Search keeps the collapsible `FiltersControl` and the centred `SelectableListFilter` modal, so the shared primitives stay covered; leave the Library drawer (end) case as is (research D22) — owner: qa-agent
- [X] T044 [P] [US3] Migrate the Genre-modal surface contrast case in e2e/tests/dark-mode-contrast.spec.ts (~L130–L145) from `/app/library` to `/app/search` (same `#filter-genre-trigger` centred modal, with a search route mock), keeping `assertOverlayContentContrast` from e2e/helpers/contrast.ts in both themes (research D22) — owner: qa-agent
- [X] T045 [P] [US3] Extend frontend/tests/unit/motion/Overlay.test.tsx and frontend/tests/unit/motion/Sheet.test.tsx (research D16, FR-017, FR-027): `variant="bottom"` renders `data-variant="bottom"` with the bottom-anchored scrim/surface classes (`items-end`, `max-h-[85dvh] w-full overflow-y-auto`); `Sheet dismissAxis="y"` uses the bottom variant, shows its handle at the top, and dismisses on a downward drag of ≥ 45 % or ≥ 500 px/s; reduced motion is opacity-only; Escape, scrim click and Close restore focus — owner: frontend-agent
- [X] T046 [P] [US3] Extend frontend/tests/unit/ui/Modal.test.tsx (research D16): `position="bottom"` renders a Sheet surface with `data-variant="bottom"`, the grab handle, the title and the Close button; the surface class includes `rounded-b-none` and the safe-area bottom padding; existing `center` and `end` cases are unchanged — owner: frontend-agent
- [X] T047 [P] [US3] Extend frontend/tests/unit/filters/SelectableListFilter.test.tsx (research D13): with `inline`, it renders `<details><summary>` "Genre (2 selected)" containing the same checkbox list (plus the search input when `searchable`) and no dialog; without `inline`, behaviour is unchanged — owner: frontend-agent
- [X] T048 [P] [US3] Extend frontend/tests/unit/FiltersControl.test.tsx (FR-021a, research D13): with `live`, there is no Apply button, no collapsible wrapper and no `<form>`; toggling a checkbox calls `onApply` immediately with the full next selection, and focus stays on that checkbox; a text "Clear all filters" button is always rendered, `aria-disabled="true"` and inert when nothing is active, and calls `onClear` otherwise; without `live`, the existing tests stay green (Search unchanged) — owner: frontend-agent
- [X] T049 [P] [US3] Extend frontend/tests/unit/LibraryToolbar.test.tsx (FR-016–FR-018, FR-024, US3 AS1–AS3, AS7, research D15): there is exactly one bar element and one `ViewModeToggle`; a "Sort & Filter" button (`sm:hidden`) has `aria-haspopup="dialog"`, toggles `aria-expanded`, and its name includes the sr-only ", 2 active filters"; the sheet is a dialog titled "Sort & Filter" with a "Sort by" fieldset of three criterion fieldsets of native radios sharing one `name`; picking one calls `onSortChange` and the sheet stays open; the sheet contains `FiltersControl live`; the "Sort" select wrapper (`hidden sm:flex`) and a "Filters" button (`hidden sm:inline-flex`) opening a dialog titled "Filters" (end drawer) with the same live filters; a `matchMedia('(min-width: 640px)')` change closes an open panel; focus returns to the trigger on close — owner: frontend-agent
- [X] T050 [P] [US3] Extend frontend/tests/integration/libraryListFlow.test.tsx (FR-014, FR-015, FR-020, FR-021, FR-021a, FR-028; spec edge case "rapid sort/filter changes"): the header shows the "Your library" `h1`, a count "N records" equal to `totalItems` for the current filters, and "Refresh"; toggling a genre in the panel replaces the URL (sort kept), restarts from batch 1 and announces "Showing N records." ("No records match the active filters." for 0); two quick ticks where the first response is delayed until after the second resolves render only the second selection's ids and produce exactly one announcement; Refresh resets to batch 1; frontend/tests/integration/searchResultsFlow.test.tsx still passes with its Apply button — owner: frontend-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 3

- [X] T051 [US3] Add `variant: 'bottom'` to frontend/src/motion/Overlay.tsx: position `items-end justify-center`, surface `max-h-[85dvh] w-full overflow-y-auto`, motion `y: '100%' → 0 → '100%'` on `spring.sheet`, and the existing reduced-motion path. Make frontend/src/motion/Sheet.tsx pass `variant = dismissAxis === 'y' ? 'bottom' : 'end'`. This makes T045 pass (research D16) — owner: frontend-agent
- [X] T052 [US3] Add `position?: 'center' | 'end' | 'bottom'` to frontend/src/components/ui/Modal.tsx: `bottom` → `<Sheet dismissAxis="y" showHandle surfaceClassName="rounded-b-none pb-[env(safe-area-inset-bottom)]">`; existing call sites are unchanged. This makes T046 pass (depends on T051) — owner: frontend-agent
- [X] T053 [P] [US3] Add the `inline?: boolean` prop to frontend/src/components/filters/SelectableListFilter.tsx: a native `<details>`/`<summary>` (label + "(N selected)" when N > 0, `min-h-11`, `focusRing`, `pressableRow`) wrapping the same search `Input` and `Checkbox` list, with no `Modal`. This makes T047 pass — owner: frontend-agent
- [X] T054 [US3] Add the `live?: boolean` prop to frontend/src/components/FiltersControl.tsx. When set: no `CollapsibleFilterPanel`, no `<form>`/`FilterActions`; each facet `onChange` updates local state and calls `onApply(next)` immediately; facets get `inline`; a text `Button` "Clear all filters" is always rendered with `aria-disabled` when inactive. This makes T048 pass (depends on T053; research D13, FR-021a) — owner: frontend-agent
- [X] T055 [US3] Add `:root { --capsule-clearance: calc(6rem + env(safe-area-inset-bottom)); }` next to `--header-h` in frontend/src/styles/global.css, with a comment citing FR-019 and the documented `:root` exception (plan UI Design System row). This is required by T038's no-overlap assertion (research D18) — owner: frontend-agent
- [X] T056 [US3] Complete frontend/src/components/LibraryToolbar.tsx as ONE bar element restyled by breakpoint, making T049 pass (research D15–D18; FR-016–FR-018): Base (capsule): `fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-fit items-center gap-2 rounded-full p-2 shadow-lg ring-1 ring-stone-950/5 dark:ring-white/10 chrome-material bg-white/90 dark:bg-surface/90 backdrop-blur-xl backdrop-saturate-150`; `sm:` (toolbar): `sm:sticky sm:inset-x-auto sm:bottom-auto sm:top-(--header-h) sm:mx-0 sm:h-15 sm:w-full sm:gap-3 sm:rounded-2xl sm:px-3 sm:shadow-none`; Children: `ViewModeToggle` (once), the "Sort & Filter" button (`sm:hidden`) with an amber count badge plus sr-only " active filters", the "Sort" select wrapper (`hidden sm:flex`), and the "Filters" button (`hidden sm:inline-flex`) with its badge; Panel: one `Modal`, `position="bottom"` below 640 px (title "Sort & Filter": sort radios in fieldsets + `FiltersControl live`) or `position="end"` otherwise (title "Filters": `FiltersControl live`); A `matchMedia` listener closes the panel when the breakpoint is crossed — owner: frontend-agent
- [X] T057 [US3] Update frontend/src/pages/LibraryListPage.tsx to make T050 pass (FR-014, FR-019–FR-021a; research D18, D21): header: `h1` + "N records"/"1 record" + Refresh on all viewports; place `LibraryToolbar` directly after the header inside `<main>` and remove the standalone `FiltersControl`; pass filters, `onFiltersChange` and `onClear` (both `navigate(..., { replace: true })` then `scrollTo({top:0})`) to `LibraryToolbar`; `<main>` gets `pb-(--capsule-clearance) sm:pb-8`; add a mount effect that sets `document.documentElement.style.scrollPaddingTop = 'calc(var(--header-h) + 3.75rem)'` and `scrollPaddingBottom = 'var(--capsule-clearance)'`, cleared on unmount; the status region announces "Showing N records." after a filter change renders, only for the latest selection — owner: frontend-agent
- [X] T058 [P] [US3] Update the `dismissible-layer` and `disclosure` sections of frontend/src/motion/README.md (research D13, D16–D17): document the `bottom` Overlay/Modal variant; document the translucent chrome material (`bg-*/90` + `backdrop-blur-xl backdrop-saturate-150` + `.chrome-material` fallbacks); record the native `<details>` facets of `SelectableListFilter inline` as a documented exception under `disclosure` (instant, native expanded state, no height animation, nothing to reduce) — owner: frontend-agent
- [X] T059 [US3] Run `cd frontend && npx vitest run tests/unit/motion tests/unit/ui/Modal.test.tsx tests/unit/filters tests/unit/FiltersControl.test.tsx tests/unit/LibraryToolbar.test.tsx tests/integration/libraryListFlow.test.tsx tests/integration/searchResultsFlow.test.tsx` and `cd e2e && npm test -- tests/library-toolbar.spec.ts tests/library-filters.spec.ts tests/overlay-focus-management.spec.ts tests/reduced-motion.spec.ts tests/overlay-contrast.spec.ts tests/motion-performance.spec.ts tests/dark-mode-contrast.spec.ts tests/view-mode-toggle.spec.ts` until green — owner: qa-agent

**Checkpoint**: US1–US3 work. The redesigned layout is complete on phone and desktop.

---

## Phase 6: User Story 4 — Rigorous accessibility and system preferences (Priority: P1)

**Goal**: the redesigned surfaces meet WCAG 2.1 AA over translucent material in both themes, degrade to opaque surfaces for reduced transparency, higher contrast or missing blur support, are fully keyboard-operable, and never rely on colour alone.

**Independent Test**: run the axe matrix (light/dark × 390/1280 × loading/loaded/end/error/panel open) with 0 violations, complete sort → filter → load more → retry by keyboard only, and repeat with reduced motion. This depends on US3's surfaces existing: it is a verification-and-hardening pass over US1–US3, not a standalone feature.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T060 [P] [US4] Extend frontend/tests/unit/ViewModeToggle.test.tsx: the radiogroup track carries opaque `bg-white` and `dark:bg-surface` classes so the primary pill keeps ≥ 3:1 over translucent chrome (research D17, FR-023) — owner: frontend-agent
- [ ] T061 [P] [US4] Extend frontend/tests/unit/LibraryToolbar.test.tsx with the names/roles/states table of contracts/library-ui.md §4 (FR-026, FR-029): every row's accessible name, role and state; the active-filter count is exposed as text, not colour; the selected sort is exposed as the select value and a checked radio; "Clear all filters" stays focusable when disabled — owner: frontend-agent
- [ ] T062 [P] [US4] Extend e2e/tests/library-toolbar.spec.ts with quickstart §3 scenarios 4–7 (SC-003, SC-004, FR-023, FR-025, FR-027): keyboard-only walk (no trap; e2e/helpers/focusRing.ts visible at each step); `runAxeScan` from e2e/helpers/axe.ts reports 0 violations for light/dark × 390/1280 × loading/loaded/end/error/sheet or drawer open; e2e/helpers/contrast.ts toolbar text/border pairings over solid-black and solid-white fixture covers against the research D17 floors; `emulateMedia({ contrast: 'more' })` → computed `backdrop-filter: none` and a 1 px border on the bar; `reducedMotion: 'reduce'` → the sheet has no transform motion — owner: qa-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 4

- [ ] T063 [P] [US4] Add `bg-white dark:bg-surface` to the radiogroup container in frontend/src/components/ui/ViewModeToggle.tsx, with a comment citing the research D17 ratios (pill 6.29:1 light / 3.14:1 dark). This makes T060 pass and is visually a no-op on Search — owner: frontend-agent
- [ ] T064 [P] [US4] Add three unlayered `.chrome-material` blocks to frontend/src/styles/global.css, next to the `.overlay-scrim` fallbacks and with a justification comment. This makes the `contrast: 'more'` case of T062 pass (research D17, FR-023): `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` → opaque `#fff` / `.dark` `#0b0b10`; `@media (prefers-reduced-transparency: reduce)` → opaque, no blur; `@media (prefers-contrast: more)` → opaque, no blur, `border: 1px solid currentColor` — owner: frontend-agent
- [ ] T065 [US4] Close every gap found by T061/T062 in frontend/src/components/LibraryToolbar.tsx and frontend/src/pages/LibraryListPage.tsx against contracts/library-ui.md §4–§6 (FR-025, FR-026, FR-028, FR-029): names, sr-only suffixes, `aria-haspopup`/`aria-expanded`, fieldset legends, `aria-disabled`; announcements only after results render and never moving focus; scroll-padding keeping focus clear of the chrome — owner: frontend-agent
- [ ] T066 [US4] Run `cd frontend && npx vitest run tests/unit/ViewModeToggle.test.tsx tests/unit/LibraryToolbar.test.tsx` and `cd e2e && npm test -- tests/library-toolbar.spec.ts` until green — owner: qa-agent

**Checkpoint**: all four stories pass their independent tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: full gates, the manual checks the tooling cannot emulate, and release hygiene.

- [ ] T067 Run the full backend suite and build: `cd backend && npm test && npm run lint && npm run build`. This is the only full Jest+emulator run; fix regressions — owner: backend-agent
- [ ] T068 [P] Run the full frontend gates: `cd frontend && npm test && npm run lint && npm run build` (tsc -b + vite build); fix regressions, including Search (feature 038's shared-filter tests) — owner: frontend-agent
- [ ] T069 Run the full e2e suite `cd e2e && npm test` on chromium + webkit. If local runs show stale lists, flush dev Redis `discogs:libsync:*` — owner: qa-agent
- [ ] T070 [P] Do the manual checks from quickstart §4 and record the results in the PR description: macOS "Reduce transparency" makes the bar opaque, and "Increase contrast" adds the border; a browser without `backdrop-filter` (or the rule disabled in DevTools) shows the opaque fallback; rotating the phone or resizing across 640 px with the sheet open closes it and keeps sort, filters and records; "The Beatles" sorts under B, and "Motörhead" sorts next to "Motorpsycho" — owner: qa-agent
- [ ] T071 [P] Audit the TDD trail and the `ponytail:` markers: for every story, the Tests block was seen failing **and approved by the developer or reviewer** (an approval comment or review on the red-test commit) before any Implementation commit (Principle I); markers exist for D3 in backend/src/application/library/listLibraryEntries.ts, D9 in frontend/src/pages/LibraryListPage.tsx and D11 in frontend/src/queries/libraryQueries.ts; `grep -rn "listEntries(" backend/src backend/tests` returns nothing — owner: qa-agent
- [ ] T072 Release hygiene (Principle VI, Additional Constraints, Development Workflow): do NOT hand-edit `version` in backend/package.json or frontend/package.json, or either CHANGELOG. Use Conventional Commits `feat(068): …` so CI derives a **MINOR** bump. The PR description must state: the additive `sort`/`dir` params and `title` field on `GET /api/library` (contracts/library-list-api.md); the **documented deviation from "reversible migration script"**: the Firestore `title` field is additive and optional and is backfilled by the existing sync; rollback = ignore the field; precedent features 038/061 (plan.md Constitution Check); the replace-vs-push history decision is still open — owner: qa-agent

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: none.
- **Foundational (T003–T004)**: after Setup; blocks US1 (T003 → backend US1 tasks; T004 → T020/T022 and the US3/US4 sort UI).
- **US1 (T005–T024)**: after Foundational.
- **US2 (T025–T037)**: after US1's frontend tasks T020–T023, because both stories edit `useLibraryQueryParams.ts`, `libraryQueries.ts` and `LibraryListPage.tsx`. It does not depend on US1's backend: US2 works against the unchanged API in default order.
- **US3 (T038–T059)**: its Tests block may start after Foundational. Its Implementation starts after the US3 approval checkpoint; T056–T057 also need US2's T036 (same `LibraryListPage.tsx`).
- **US4 (T060–T066)**: its Tests block needs US3's T056–T057. T063 and T064 start only after T060/T062 have been written, seen failing and approved (no fallback CSS before its failing test).
- **Polish (T067–T072)**: after all stories.

### Within each story

- Tests block (unit, flow and e2e) → seen failing → **"Red tests reviewed/approved before Implementation"** → Implementation → targeted run task (T024, T037, T059, T066).
- Backend US1: T015 (domain) → T016 (title) → T017 (single path + port removal + test doubles) → T018 (route) → T019 (targeted run).
- Frontend US1: T020 → T021 → T022 → T023 → T024.
- US2: T032 → T033 → T036. T034 and T035 are parallel to each other and to T032/T033. Then T037.
- US3: T051 → T052. T053 → T054. T055. Then T056 → T057. T058 is parallel. Then T059.
- US4: T063 and T064 are parallel; T065 follows them; then T066.

### Agent hand-offs

- backend-agent owns T003, T006–T010, T015–T019, T067.
- frontend-agent owns T004, T011–T014, T020–T023, T027–T036, T045–T058, T060–T061, T063–T065, T068.
- qa-agent owns T001–T002, T005, T024–T026, T037–T044, T059, T062, T066, T069–T072.
- docs-agent: no task. The project keeps no end-user library doc (`docs/` has `wishlist.md` and `collection-stats.md` only), and the spec does not ask for one.

---

## Parallel Examples

### User Story 1

```text
# All US1 test tasks together (different files):
T005 e2e/tests/library-sort-scroll.spec.ts
T006 backend/tests/unit/library/domain/librarySort.test.ts
T007 backend/tests/unit/library/application/listLibraryEntries.test.ts
T008 backend/tests/unit/library/syncLibrary.facets.test.ts
T009 backend/tests/contract/library/library.contract.test.ts
T010 backend/tests/integration/library/adapters/firestoreLibraryRepository.integration.test.ts
T011 frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx
T012 frontend/tests/unit/queries/libraryQueries.test.tsx
T013 frontend/tests/unit/LibraryToolbar.test.tsx
T014 frontend/tests/integration/libraryListFlow.test.tsx
# Approval gate, then backend (T015→T019) and frontend (T020→T023) in two parallel lanes; T024 closes.
```

### User Story 2

```text
T025 library-sort-scroll.spec.ts ∥ T026 library-list-responsive.spec.ts ∥ T027 libraryQueries.test.tsx
T028 useLibraryQueryParams.test.tsx ∥ T029 libraryListFlow.test.tsx ∥ T030 RecordCard/RecordListRow tests ∥ T031 recordDetailFlow.test.tsx
# Approval gate. Implementation: T034 ∥ T035 ∥ (T032 → T033 → T036); T037 closes.
```

### User Story 3

```text
# e2e: T038 ∥ T039 ∥ T040 ∥ T041 ∥ T042 ∥ T043 ∥ T044
# unit/flow: T045 ∥ T046 ∥ T047 ∥ T048 ∥ T049 ∥ T050
# Approval gate. Implementation lanes: (T051 → T052) ∥ (T053 → T054) ∥ T055 ∥ T058, then T056 → T057; T059 closes.
```

### User Story 4

```text
T060 ViewModeToggle test ∥ T061 LibraryToolbar a11y test ∥ T062 e2e a11y scenarios
# Approval gate. T063 ∥ T064, then T065; T066 closes.
```

---

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 US1: backend global sort + title persistence + sort select + URL + announcement, still on Previous/Next pagination.
3. **Stop and validate**: T019 (backend targeted run) and T024 (frontend + e2e targeted run). This is shippable on its own: the collection becomes sortable and deep-linkable.

### Incremental delivery

1. US1: sortable library (MVP).
2. US2: continuous loading replaces pagination, and Back from a record returns to the same state.
3. US3: capsule, sheet and sticky toolbar (one bar element), plus live filters on Library.
4. US4: accessibility hardening and system preferences (the WCAG merge gate, Principle X).
5. Polish: full gates, manual checks, release notes.

Every increment keeps all existing tests green. US4 must be complete before merge to `main` (Principle X is a hard gate), so if the four stories ship in separate PRs, the redesign's UI (US3) must not merge without US4.

### Parallel team strategy

After Foundational:
- the backend-agent runs US1's backend lane (T006–T010, T015–T019) while the frontend-agent runs US1's frontend lane (T011–T014, T020–T023) and the qa-agent writes T005;
- after approval of US3's tests, the frontend-agent can pre-build US3's independent pieces (T051–T054) while US2 finishes.

---

## Notes

- `[P]` = different files and no dependency on an incomplete task. `[US#]` appears only in story phases.
- Commit after each task or logical group with Conventional Commits (`test(068): …` for the red tests, then `feat(068): …`). The approval of the red-test commit is what T071 audits.
- Never run the full backend Jest+emulator suite during story work. Use the targeted paths above; the full run is T067.
