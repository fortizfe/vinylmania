# Implementation Notes — 068 Library redesign, sort & scroll

## Baseline (Setup)

Date: 2026-09-19 · Branch: `068-library-redesign-sort-scroll` (HEAD 2249630, no source changes yet)

### T001 — Backend (Jest + Firebase emulator)

Command as written in tasks.md:

```
cd backend && npm test -- tests/unit/library tests/contract/library tests/integration/library tests/unit/collectionStats
```

Result: **exit 1, no tests ran, no output from Firebase.** Cause: the `test` script is
`firebase emulators:exec --only auth,firestore "jest --detectOpenHandles --forceExit"`, so
`npm test -- <paths>` puts the paths after the quoted jest command. They go to
`emulators:exec`, not to jest. This is how the command is invoked, not a test failure.

Command actually used (same emulator mechanism, with the paths inside the jest command):

```
cd backend && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 300 -- npx firebase emulators:exec --only auth,firestore \
  "jest --detectOpenHandles --forceExit tests/unit/library tests/contract/library tests/integration/library tests/unit/collectionStats"
```

| Suites | Tests | Result |
|---|---|---|
| 14 passed / 14 | 147 passed / 147 | green (15.2 s) |

Covers unit (library, collectionStats), contract (library) and integration (library, running against the emulator). Nothing was skipped.
The console stack traces from `respondCollectionError` are expected logs from error-path tests, not failures.

### T002 — Frontend (Vitest)

```
cd frontend && npx vitest run tests/unit/hooks tests/unit/queries/libraryQueries.test.tsx tests/unit/FiltersControl.test.tsx tests/unit/filters tests/unit/motion tests/unit/ui/Modal.test.tsx tests/unit/RecordCard.test.tsx tests/unit/RecordListRow.test.tsx tests/unit/ViewModeToggle.test.tsx tests/integration/libraryListFlow.test.tsx tests/integration/recordDetailFlow.test.tsx tests/integration/searchResultsFlow.test.tsx
```

| Files | Tests | Result |
|---|---|---|
| 21 passed / 21 | 225 passed / 225 | green |

All 12 listed paths exist.

### Pre-existing failures

None in either baseline.

## US1 red tests — frontend

Date: 2026-09-19. Sort value shape used everywhere in the frontend: **`{ sort, dir }`** (`LibrarySortValue` from `frontend/src/constants/librarySortOptions.ts`, same names as the URL params). The `{ criterion, direction }` shape in data-model §2 is the backend domain type only. Tasks T011/T013/T022/T023 say `{ criterion, direction }`: read that as `{ sort, dir }` on the frontend.

Run: `cd frontend && npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/queries/libraryQueries.test.tsx tests/unit/LibraryToolbar.test.tsx tests/integration/libraryListFlow.test.tsx` → 4 files failed, 20 tests failed, 28 passed. oxlint clean.

### T011 — `frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx`

New `describe('useLibraryQueryParams sort …')`: "defaults to date added, newest first…", "parses a valid sort and dir pair as given", "falls back to the default for an unknown sort, never erroring", "uses the criterion default direction when dir is absent (asc for artist/album)", "uses the criterion default direction when dir is unknown (desc for added)", "keeps the filters alongside the sort".
Rewritten `describe('buildLibraryPath(filters?, sort?, page = 1) …')`: the existing cases were moved to the new argument order, plus "omits both sort and dir for the default sort", "writes both sort and dir for a non-default sort, even when dir is the criterion default", "writes sort, dir, filters and page together" and "round-trips filters, sort and page through a built URL". The existing "defaults to page 1 with no active filters…" now expects `{ page: 1, sort: DEFAULT_LIBRARY_SORT }`.
Red: `result.current.sort` is `undefined`, and `buildLibraryPath` still takes `(page, filters)`, so `sort`/`dir`/`genre`/`page` are never written (13 failing; 3 of them are existing cases that changed with the new signature).

### T012 — `frontend/tests/unit/queries/libraryQueries.test.tsx`

New `describe('sort …')`: "libraryApi.list sends sort and dir query params alongside page and filters" (real `list` via `vi.importActual`, with `authorizedFetch` mocked), "useLibraryList passes the sort to libraryApi.list", "two sorts never share a cache entry (the list key includes the sort)", "useRefreshLibrary forces a sync for the current sort and writes into that sort's cache".
Red: `list()` ignores a 5th argument (`sort` param is `null`); `useLibraryList`/`useRefreshLibrary` drop the sort, so the second sort is served from the first sort's cache (1 call, not 2).

### T013 — `frontend/tests/unit/LibraryToolbar.test.tsx` (new)

"has a native select with the visible label \"Sort\"", "groups the six options in three optgroups, labelled from librarySortOptions", "selects the default option (\"Newest first\") for the default sort", "selects the current option for a non-default sort", "calls onSortChange with the chosen option as { sort, dir }", "renders the view mode toggle exactly once". Props contract: `{ mode, onModeChange, sort, onSortChange }`.
Red: `Failed to resolve import "../../src/components/LibraryToolbar"` (the module doesn't exist yet).

### T014 — `frontend/tests/integration/libraryListFlow.test.tsx`

New `describe('Sorting the library …')`: "a deep link requests the library with its sort and filters and shows that option selected", "announces nothing on the initial load", "changing the select replaces the URL (filters kept, page 1) and announces once after the new data renders, keeping focus", "applying a filter keeps sort and dir in the URL and in the request".
Red: `list` is called without the sort, there's no `combobox` named "Sort" on the page, and applying a filter drops `sort`/`dir` from the URL (3 failing). "announces nothing on the initial load" already passes: it guards against a regression and has nothing to go red on until the announcer exists.

### Existing assertions the implementation (T020, T021, T023) must update

If the page always passes the sort as a 5th argument, 3 current assertions will break. They pass today and were left as they are:
- `libraryQueries.test.tsx` "useLibraryList fetches and returns the paginated list": `toHaveBeenCalledWith(1, 20, false, {})`.
- `libraryListFlow.test.tsx` "offers a Refresh action…": `(1, 20, true, {})`.
- `libraryListFlow.test.tsx` "keeps filters active when navigating to another page": `(1|2, 20, false, { genre: ['Rock'] })`.

Update them to add the default sort, `{ sort: 'added', dir: 'desc' }`.

## US1 red tests — e2e

T005 · `e2e/tests/library-sort-scroll.spec.ts` · run 2026-09-19, chromium, against today's UI (no production changes).

Command (the `npm test -- <path>` form in tasks.md passes the path to `firebase emulators:exec`, not to Playwright; same issue as T001):

```
cd e2e && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 600 -- npx firebase --config ../backend/firebase.json emulators:exec \
  --only auth,firestore --project vinylmania-test "playwright test tests/library-sort-scroll.spec.ts"
```

Fixture: 205 records (`rec-001`…`rec-205`), `addedAt` ties in groups of 3, artists/albums with accents, mixed case,
leading articles (The/A/An/El/La/Los/Die/Les, plus bare "The"), natural numbers (`2Pac`/`10cc`, `Vol. 2`/`Vol. 10`),
`undefined` and blank values; genre Jazz / Rock / Rock+Pop. `page.route('**/api/library*')` honours `page`, `pageSize`,
`sort`, `dir` (silent fallback) and `genre` (OR within the field), ordered by `referenceSort` = data-model §3.
`mockLibrary()` returns the request URLs so T025 can reuse it.

| Scenario | Result | Failure reason |
|---|---|---|
| fixture is sound (205 unique ids, missing artists last in asc and desc, sorts differ on page 1, Rock set > 20) | green | self-check of the test fixture, not a product assertion |
| deep link `?sort=artist&dir=desc&genre=Rock` (SC-006) | **red** | first 20 ids are the Rock set in default order (`rec-002, rec-003, rec-005…`): the frontend sends `genre` but not `sort`/`dir`. Soft assertion 2: `#library-sort option:checked` not found |
| select change → "Album (A → Z)" | **red** | `#library-sort` not found (default first 20 did match the reference beforehand) |
| reorder paint < 100 ms (SC-002) | **red** | `#library-sort` not found |

Paint measurement: before the select changes, `page.evaluate` installs (1) a `PerformanceObserver({type:'resource'})`
that keeps `responseEnd` of the first `/api/library?…sort=artist…` entry and (2) a `MutationObserver` on `document.body`
(childList, subtree, `href`) that records `performance.now()` when the first record link points at the reference first id.
Latency = shownAt − responseEnd, asserted `≥ 0` and `< 100`. Probe checked with a throwaway spec (since deleted) that
used today's Next button: routed responses do produce a resource entry (`localhost:5173/api/library?page=2…`, via the Vite
proxy), latency 14.7 ms.

Notes: Redis is not involved (the API is mocked). Each Playwright test already gets a fresh browser context, which is the
"fresh session" for SC-006.

## US1 red tests — backend

Date: 2026-09-19. No production code under `backend/src` was changed. Unit files ran with `cd backend && npx jest <files>`. Contract and integration files ran with the emulator command from the Baseline section, passing only those two paths (7 failed, 42 passed, 49 total).

### T006: `backend/tests/unit/library/domain/librarySort.test.ts` (new, 11 tests, 28 cases after `it.each` expansion)
- Tests: treats "Motörhead"/"motorhead", "Björk"/"Bjork", "ac/dc"/"AC/DC" as the same artist (tie broken by album asc) · files names under the word after one leading article, and keeps "The" alone as "The" · strips the leading article "The/A/An/El/La/Los/Las/Die/Les" · compares numbers naturally ("Vol. 2" before "Vol. 10") · artist asc/desc, album asc/desc: present first, then missing/empty newest first, then by id · artist ties → album asc (missing album last) → addedAt desc → id asc; only the artist follows dir · album ties → artist asc (missing artist last) → addedAt desc → id asc; only the album follows dir · added: addedAt follows dir, ties → id asc in both directions · returns the same order for any permutation of the input (×6 sorts) · does not mutate the input array
- Red: the suite does not compile. `TS2307: Cannot find module '../../../../src/domain/library/librarySort'`.

### T007: `backend/tests/unit/library/application/listLibraryEntries.test.ts` (new, 5 tests)
- Tests: reads the mirror with listAllEntries exactly once per call, with or without filters · with no filters, sorts the whole mirror before slicing the page · filters first, then sorts, then slices; totalItems is the filtered count · pages 1..ceil(total/pageSize) concatenate to the full ordered set, without duplicates or gaps · still syncs first (passing options through) and enriches only the page items
- Red: the suite does not compile. `TS2322: Property 'listEntries' is missing` (the port still requires it), `TS2559: 'LibrarySort' has no properties in common with '{ force?: boolean }'`, and `TS2554: Expected 4-5 arguments, but got 6`. The use case has no `sort` parameter yet.

### T008: `backend/tests/unit/library/syncLibrary.facets.test.ts` (extended; 5 new tests, 5 existing expectations updated)
- New describe "syncLibrary: album title write-back (feature 068, research D4)": passes a non-empty basic_information.title to persistCollectionFacets for a matched entry · omits an empty / whitespace-only title for a matched entry, so the stored value is never overwritten (×2) · passes a non-empty title for a newly created (Discogs-only) entry · omits a whitespace-only title for a newly created entry
- Existing 061 tests updated: the `instance()` fixture always has `title: 'Release N'`, so the 4 exact `toHaveBeenCalledWith` facet expectations now include `title`. The "facet-less instance" test now sets `title: ''`. Without these changes, T016 would break them.
- Red: 6 of 12 fail. These are the 2 new positive tests and the 4 updated expectations. Each fails with `- "title": "…"` missing from the received `persistCollectionFacets` call. The 3 "omit" tests and the facet-less test pass today. They guard behaviour that is already correct and are not meant to be red.

### T009: `backend/tests/contract/library/library.contract.test.ts` (new describe "GET /api/library sort (feature 068, US1)", 7 tests)
- `?sort=artist&dir=asc` … → expected `[3,2,1,4,5]`, received `[4,1,2,3,5]` (sort ignored; `addedAt` desc order).
- `?sort=artist&dir=desc` … → the entry with no artist comes first instead of last.
- `?sort=album&dir=asc` … → received the `addedAt` desc order instead of title → artist → addedAt.
- `?sort=added&dir=asc` … → received newest first. The no-params assertion comes after this one and is not reached.
- `?sort=foo&dir=up falls back silently` → **passes today**. It is a regression guard: today every request gets the default order.
- `?sort=artist&genre=Rock&pageSize=2` pages 1–3 → `totalItems` is 5 and there are no duplicates, but the pages concatenate in `addedAt` order.
- `each item carries the album title …` → `title` is `undefined` on every item.

### T010: `backend/tests/integration/library/adapters/firestoreLibraryRepository.integration.test.ts` (1 new test)
- Test: persists title via persistCollectionFacets and maps it back in getEntry and listAllEntries
- Red: `getEntry` returns no `title` (`- "title": "Stockholm"`). The adapter neither writes nor maps it. The facets are passed as a variable, so the call compiles against today's port type.

## US1 red-test approval gate

- 2026-09-19: Red tests T005–T014 reviewed and **approved by the developer (Fernando Ortiz)** before implementation (Constitution Principle I). Implementation T015–T024 may start.

## US1 implementation — backend

Date: 2026-09-19. T015–T019 done. No red test was changed.

### Files changed
- `backend/src/domain/library/librarySort.ts` (new, T015): `sortLibraryEntries(entries, sort)`. It uses one module-level `Intl.Collator('en', { sensitivity: 'base', numeric: true })`, a key normaliser (trim, blank = missing, strip one leading article) and decorate–sort–undecorate. Present keys come before missing ones, and missing ones are ordered `addedAt` desc then `id` asc. Only the primary key follows `direction`.
- `backend/src/application/library/syncLibrary.ts` (T016): `CollectionFacetPatch.title`. `collectionFacets()` writes the **trimmed** title, and only when it is non-empty.
- `backend/src/ports/library/libraryRepositoryPort.ts` (T016/T017): `title?` added to the `persistCollectionFacets` facets. `listEntries` and the `PaginatedLibraryEntries` import removed. The `listAllEntries` docstring now says "by the library listing".
- `backend/src/adapters/library/firestoreLibraryRepository.ts` (T016/T017): `persistCollectionFacets` writes `title`, and `toLibraryEntry` maps it back. `listEntries` deleted.
- `backend/src/application/library/listLibraryEntries.ts` (T017): one path, `listLibraryEntries(uid, page, pageSize, filters, sort, options)`: sync → `listAllEntries` → filter → sort → slice → enrich. It carries the `ponytail:` read-cost comment. `hasActiveLibraryFilters` and `listEntriesFiltered` removed.
- `backend/src/domain/library/types.ts` (T017): `PaginatedLibraryEntries` deleted (nothing used it any more).
- `backend/src/adapters/library/libraryRoutes.ts` (T018): `parseLibrarySort(req)` next to `parseLibraryFilters`, with silent fallback and never a 400. The success log `meta` is now `{ filters, sort, dir, page, totalItems }`.
- Test doubles (T017): removed the `listEntries: jest.fn()` stub from the 5 files listed in the task. No other `listEntries` reference is left in `backend/src` or `backend/tests`, apart from a comment in the T007 test.

### T019 results
- Targeted run (Baseline emulator command, paths `tests/unit/library tests/contract/library tests/integration/library tests/unit/collectionStats`): **16/16 suites, 193/193 tests passed**. The baseline was 14 suites / 147 tests; the difference is the T006–T010 additions. All T006–T010 tests are green.
- `npm run build` (tsc): clean.
- ESLint on touched src and test files: clean. Prettier: `librarySort.ts` formatted. `syncLibrary.ts` and `libraryRoutes.ts` already failed `prettier --check` at HEAD and were not reformatted, to keep the diff small.

## US1 implementation — frontend

T020–T023 done (frontend-agent).

Files changed:
- `frontend/src/hooks/useLibraryQueryParams.ts`: parses `sort` using the data-model §2 fallback table. Interim `buildLibraryPath(filters?, sort = DEFAULT, page = 1)` writes `sort`+`dir` only when the sort is not the default.
- `frontend/src/services/libraryApi.ts`: `list(page, pageSize, refresh, filters, sort?)` sets `sort`/`dir`.
- `frontend/src/queries/libraryQueries.ts`: the sort (default `DEFAULT_LIBRARY_SORT`) is in `libraryKeys.list`, `useLibraryList` and `useRefreshLibrary`.
- `frontend/src/components/LibraryToolbar.tsx` (new): a single in-flow bar with `ViewModeToggle` (mounted once) and a native labelled `<select id="library-sort">` with three optgroups.
- `frontend/src/pages/LibraryListPage.tsx`: renders `LibraryToolbar` instead of the standalone toggle. A sort change calls `navigate(..., { replace: true })` and then `window.scrollTo({ top: 0 })`. Filter apply/clear and Previous/Next go through `buildLibraryPath(filters, sort, page)`. There is one sr-only `<p role="status">`, and its text is derived during render (`sortChanged && data ? option.announcement : ''`), not set in an effect. Because it comes from the current sort, several quick changes produce one announcement, for the latest selection. Filter and page navigation reset it.
- Tests: only the three approved assertions were updated to include `{ sort: 'added', dir: 'desc' }` (libraryQueries "useLibraryList fetches…", and in libraryListFlow the Refresh and "keeps filters active when navigating…" tests).

Results: full frontend suite 109 files / 898 tests pass. `tsc -b --noEmit` is clean. oxlint is clean on the touched files. Prettier is clean on the touched files; 12 other files already had Prettier issues before this work. jsdom prints "Not implemented: window.scrollTo" as console noise during the sort flow test, and nothing fails.

## US1 verification (T024)

Date: 2026-09-19 (qa-agent). No production or test code was changed.

### Frontend (Vitest)

```
cd frontend && npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/queries/libraryQueries.test.tsx tests/unit/LibraryToolbar.test.tsx tests/integration/libraryListFlow.test.tsx
```

**4/4 files, 54/54 tests passed.** At the red phase the run showed 48 tests (20 failed, 28 passed), because `LibraryToolbar.test.tsx` failed on import and contributed 0 tests. 48 + its 6 tests = 54, so no test was added or dropped. The only noise is jsdom's "Not implemented: window.scrollTo".

### E2E (Playwright, one emulator run)

The `npm test -- <path>` form in tasks.md is wrong (see T005). I used the T005 command with all four specs in a single run:

```
cd e2e && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 900 -- npx firebase --config ../backend/firebase.json emulators:exec \
  --only auth,firestore --project vinylmania-test \
  "playwright test tests/library-sort-scroll.spec.ts tests/library-list-responsive.spec.ts tests/library-filters.spec.ts tests/view-mode-toggle.spec.ts --reporter=list,json"
```

Only chromium ran. The webkit project's `testMatch` is limited to the three detail-page responsive specs, so none of these four specs runs on webkit.

| Spec | Tests | Result |
|---|---|---|
| library-sort-scroll.spec.ts (US1: fixture check, deep link SC-006, select change, reorder paint SC-002) | 4 | 4 passed |
| library-list-responsive.spec.ts (regression) | 7 | 7 passed |
| library-filters.spec.ts (regression) | 18 | 18 passed |
| view-mode-toggle.spec.ts (regression) | 13 | 13 passed |
| **Total** | **42** | **42 passed, 0 flaky, 0 skipped (70.7 s)** |

**sort-paint-ms = 7.3** (SC-002 budget < 100 ms). This is the `sort-paint-ms` annotation from the JSON reporter.

### Red-test audit (Principle I)

Verdict: **pass, no weakening found.**
- Every test named in the T011–T014 red notes is still present. There is no `.skip`, `.only`, `.todo` or `it.fails`. The key assertions are intact: deep-link request plus the selected option; `REPLACE` navigation with filters kept and page dropped; no announcement before data arrives, then exactly one announcement in `role="status"`; focus stays on the select; the cache key includes the sort; toolbar optgroups and options come from `LIBRARY_SORT_OPTIONS`; the toggle is mounted once.
- The only edits to pre-existing assertions are the approved `{ sort: 'added', dir: 'desc' }` additions. They cover 3 tests and 4 assertion lines: the libraryQueries "useLibraryList fetches…" test; the libraryListFlow Refresh test; and "keeps filters active…" for page 1 and page 2.
- Backend: `syncLibrary.facets.test.ts` and `syncLibrary.test.ts` differ from HEAD only by the T008 changes and the `listEntries: jest.fn()` stubs removed in T017 (the approved port change). Nothing was loosened.
- Limit: the red-phase state was never committed, so this check compares the current content with the red notes and with HEAD. It is not a byte-for-byte diff against the red snapshot.

### Bugs found

None.

## US2 red tests — frontend

Red phase only (Constitution Principle I). No production code under `frontend/src` was touched. Run: `cd frontend && npx vitest run tests/unit/queries/libraryQueries.test.tsx tests/unit/hooks/useLibraryQueryParams.test.tsx tests/integration/libraryListFlow.test.tsx tests/unit/RecordCard.test.tsx tests/unit/RecordListRow.test.tsx tests/integration/recordDetailFlow.test.tsx` → **6 files failed, 24 failed / 81 passed (105)**. Every pre-existing test still passes.

| Task | File | Tests added | Red reason (1 line) |
|---|---|---|---|
| T027 | `frontend/tests/unit/queries/libraryQueries.test.tsx` | 5, in `libraryQueries — infinite library list (feature 068, US2)`: key without page; `useLibraryList(sort, filters)` is infinite; `getNextPageParam` advances then stops; no next page for a single batch; `useRefreshLibrary(sort, filters)` resets the cache to `{ pages: [page1], pageParams: [1] }` | `useLibraryList`/`useRefreshLibrary`/`libraryKeys.list` still take `(page, pageSize, …)` and return a plain `useQuery`, so the key carries a page, `result.current.fetchNextPage` is not a function and `list()` is called with the sort object as its page argument |
| T028 | `frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx` | 4, in `useLibraryQueryParams without paging (feature 068, US2)`: no `page` in the returned object; `?page=3` ignored; `buildLibraryPath` never writes `page`; round-trip without paging | the hook still returns `page: 1` (and `3` for `?page=3`) and `buildLibraryPath(undefined, undefined, 3)` still produces `/app/library?page=3` |
| T029 | `frontend/tests/integration/libraryListFlow.test.tsx` | 10, in `Infinite scroll on the library (feature 068, US2)`, plus a file-level `IntersectionObserver` stub that records each observer's options: 300 px `rootMargin`; batch append with `min(20, remaining)` skeletons in the same `<ul>`; no Previous/Next; end message + no request after the end; singular "1 record"; no end message/sentinel at 0 results; batch failure → `role="alert"` + Retry with loading paused; first-batch failure still full-page error; batch/end announcements; no end announcement for a single batch | the page is still a paginated `useQuery`: it creates no `IntersectionObserver`, never requests page 2, renders no end message, no next-batch skeletons, no Retry alert, no batch announcements — and still renders Previous/Next. 8 of the 10 fail; the two "nothing is rendered" edge-case guards (no sentinel at 0 results, full-page error on a first-batch failure) pass today by construction and stay as regression guards |
| T030 | `frontend/tests/unit/RecordCard.test.tsx`, `frontend/tests/unit/RecordListRow.test.tsx` | 2 + 2: the required `from` prop is carried as `state={{ from }}` on the record `Link`, including the catalog-unavailable variant (asserted by clicking through to a location probe) | neither component accepts `from` nor sets `state` on its `Link`, so the probe reads `undefined` |
| T031 | `frontend/tests/integration/recordDetailFlow.test.tsx` | 4: Back points at `state.from` in the loaded, loading, not-found and catalog-unavailable states; post-delete navigation goes there; direct entry falls back to `/app/library` | `RecordDetailPage` hard-codes `/app/library` in every `BackLink`, in `backTo` and in the post-delete `navigate`. 3 of the 4 fail; the fallback test passes today and stays as a regression guard |

### Existing tests that the US2 implementation (T032–T036) must update or remove

- `frontend/tests/unit/hooks/useLibraryQueryParams.test.tsx`: `parses the page number from the URL`; `defaults to page 1 with no active filters…` (expects `{ page: 1, sort }`); `includes the page number when greater than 1`; `omits the page number when it is 1`; `writes sort, dir, filters and page together`; `round-trips filters, sort and page through a built URL (FR-022, FR-006)`; and the whole `buildLibraryPath(filters?, sort?, page = 1) (feature 068 interim signature)` describe title. `resets to page 1 in the built path when filters change (FR-010)` still holds and can stay.
- `frontend/tests/unit/queries/libraryQueries.test.tsx`: `useLibraryList fetches and returns the paginated list`; `useLibraryList passes the sort to libraryApi.list`; `two sorts never share a cache entry (the list key includes the sort)`; `useRefreshLibrary forces a sync for the current sort and writes into that sort's cache` — all four call the old `(page, pageSize, filters, sort)` signature and assert page-keyed cache entries. The `libraryApi.list` URL test is unaffected.
- `frontend/tests/integration/libraryListFlow.test.tsx`: `keeps filters active when navigating to another page (FR-022)` drives the removed **Next** button and must be rewritten as a scroll-triggered batch; the US1 sort test `changing the select replaces the URL (filters kept, page 1)…` starts from `/app/library?genre=Rock&page=2` and asserts `page` is dropped — still valid, but the `page=2` entry becomes meaningless.
- `frontend/tests/unit/RecordCard.test.tsx` / `RecordListRow.test.tsx`: the shared `renderCard` / `renderRow` helpers omit the now-required `from`; TypeScript (`tsc`, `npm run lint`) will flag every existing call until the helper passes one. Vitest itself does not typecheck, so they still run green today.

None of these were deleted: no file was made unrunnable by the red tests.

## US2 red tests — e2e

T025 (`e2e/tests/library-sort-scroll.spec.ts`) and T026 (`e2e/tests/library-list-responsive.spec.ts`), red phase. Run:

```
cd e2e && node ../scripts/check-emulator-ports.js && node ../scripts/run-with-timeout.js 900 -- \
  npx firebase --config ../backend/firebase.json emulators:exec --only auth,firestore --project vinylmania-test \
  "playwright test tests/library-sort-scroll.spec.ts tests/library-list-responsive.spec.ts --reporter=list"
```

Result: **14 failed, 9 passed (3.1 min, chromium only** — the webkit project's `testMatch` covers only the three detail-page responsive specs**)**. Every failure is a missing-behaviour failure, not a broken fixture.

### Fixture/mock changes (shared with US1, no behaviour change for the US1 scenarios)

- `mockLibrary` now returns `{ requests, failPages }` instead of the bare `URL[]`. `failPages` is a mutable `Set<number>`: a page number in it is answered `500` until it is removed again (the retry scenario adds 3, then deletes it before pressing Retry). The US1 scenarios ignore the return value.
- `mockLibrary` also routes `**/api/library/rec-*` (record detail) from the same fixture — the list glob `**/api/library*` stops at the next `/`, so the detail request was previously unmocked. Needed by the back-navigation scenario.
- Helpers: `END_MESSAGE` regex (`reached the end of your collection — N records`, apostrophe-agnostic), `scrollToBottom` (a **programmatic** `window.scrollTo`, never `mouse.wheel`, so layout shifts are not flagged `hadRecentInput`), `scrollUntil(page, check)` (scroll + poll, 12 s).

### T025 — new scenarios in `library-sort-scroll.spec.ts`

| Scenario | Red reason (today's UI) |
|---|---|
| `global order: scrolling <sort>/<dir> to the end …` × 6 (added desc/asc, artist asc/desc, album asc/desc) — no duplicates, 205 ids, equal to the reference order, end text `— 205 records` (SC-007, FR-013) | The end message never appears: scrolling loads nothing, the list stays at the 20 records of page 1 behind Previous/Next. Fails in `scrollUntil` (predicate false after 12 s). |
| `prefetch: page 2 is requested while the end of the loaded content is still below the fold` (SC-008) | Scrolling to 250 px short of the bottom (inside the future 300 px `rootMargin`, end of content still off-screen — asserted: `belowFold > 200`) requests nothing: `pagesRequested()` stays `[1]`. |
| `tall screen: at 1280×2400 batches keep loading until the viewport is filled, with no scrolling` | Item count stays at 20 (`expect > 20, received 20`); no sentinel, so no auto-fill. |
| `retry: a 500 on page 3 keeps the loaded records, shows the alert and Retry, and requests nothing more until Retry is pressed` | The `role="alert"` "Couldn't load more records…" never appears — page 3 is never requested at all, since scrolling loads nothing. Fails in `scrollUntil`. |
| `back navigation: opening a record and pressing Back returns to the same sorted, filtered list` (SC-009) | Deep link, first record click and the detail page all work; `Back` lands on `http://localhost:5173/app/library` — `RecordDetailPage`'s `BackLink to="/app/library"` is hardcoded and the record links carry no `state.from`, so `sort`/`dir`/`genre` are lost. |
| `CLS: loading 3 more batches by scrolling shifts nothing already on screen, in grid mode` / `in list mode` (SC-001, chromium-only via `test.skip(browserName !== 'chromium')`) | The precondition — 80 records loaded by scrolling (initial batch + 3) — is never reached, so the test fails in `scrollUntil` **before** reading the CLS sum. Deliberate: without it a `cls === 0` assertion would pass vacuously on a list that never grows. The `PerformanceObserver({ type: 'layout-shift', buffered: true })` only counts entries with `startTime >= ` install time and `!hadRecentInput`, so the first paint and the grid→list switch are excluded. |

### T026 — `library-list-responsive.spec.ts` migrated off Previous/Next (research D22)

- `buildLibraryResponse(count)` → `buildLibraryItems(count)` + `routeLibrary(page, items)`, which now honours `page`/`pageSize` and slices (the old mock returned the whole collection for every request, which makes paging meaningless). `buildListResponse()` → `buildListItems()`: the detailed "Stockholm" row (id `entry-stockholm`) followed by 24 filler items, still `totalItems: 25`.
- Line ~85, `mobile: … pagination controls meet 44x44px` → `mobile: single column, no horizontal scroll, and scrolling loads the rest of the collection (Scenario 6)`: 20 records, then scroll until 25 plus the `— 25 records` end message. The 44×44 touch-target check moved from the removed "Next" button to the view-mode toggle, which survives the redesign. **Red**: the count stays at 20.
- Line ~179, `shows all six fields per row and pagination still works` → `… and scrolling loads the next batch`: the six-field assertions are untouched; `expect(Next).toBeEnabled()` became scroll-to-25 + end message. **Red**: same, count stays at 20.

### What stays green (9 passed)

- US1 (T005): fixture soundness, deep link SC-006, select change, reorder paint SC-002 — all 4 still pass.
- `library-list-responsive.spec.ts`, 5 tests untouched and passing: desktop 5-column grid + no horizontal scroll; the unlinked-Discogs 44×44 link gate; mobile list mode without horizontal scroll; both axe WCAG scans (light + dark).
- Inside the 2 migrated tests, every assertion that does not depend on paging still passes before the new scroll block: the single-column grid and no-horizontal-scroll checks (mobile) and the six per-row fields (list mode). Only the scroll block at the end of each is red.

## US2 red-test approval gate

- 2026-09-20: Red tests T025–T031 reviewed and **approved by the developer (Fernando Ortiz)** before implementation (Constitution Principle I). Committed as the red-state snapshot. Implementation T032–T037 may start.

## US2 implementation — frontend

T032–T036, green phase. Run: `cd frontend && npx vitest run` (whole suite) → **109 files, 922 tests, all passing**; `npx tsc -b --noEmit` clean; `npx oxlint` reports 0 errors (only the pre-existing `react(only-export-components)` warnings, none in touched files); Prettier clean on every touched file.

### Files changed (`frontend/`)

| Task | File | What changed |
|---|---|---|
| T032 | `src/queries/libraryQueries.ts` | `PAGE_SIZE = 20` module constant. `libraryKeys.list(sort, filters)` drops page/pageSize. `useLibraryList(sort, filters)` is a `useInfiniteQuery` (`initialPageParam: 1`, D8 `getNextPageParam`, `retry: false`). `useRefreshLibrary(sort, filters)` fetches page 1 with `refresh=true` and `setQueryData(key, { pages: [data], pageParams: [1] })`. `// ponytail: invalidateQueries refetches every loaded page after a mutation; upgrade to resetQueries(lists) if deep scrolls + edits get slow` above the mutation invalidations. `libraryApi.list` keeps its `(page, pageSize, refresh, filters, sort)` signature. |
| T033 | `src/hooks/useLibraryQueryParams.ts` | `page` removed from the returned object and from `buildLibraryPath`, now `(filters?, sort?)`. A legacy `?page=N` is read by nobody and never written back (D12). |
| T034 | `src/components/RecordCard.tsx`, `src/components/RecordListRow.tsx` | Required `from: string` prop, passed as `state={{ from }}` on both `Link`s in each component (record link + catalog-unavailable "Open record"). |
| T035 | `src/pages/RecordDetailPage.tsx` | `backTo = (location.state as { from?: string } \| null)?.from ?? '/app/library'`, used by all three `BackLink`s, the `RecordDetailLayout` `backTo` prop and the post-delete `navigate`. |
| T036 | `src/pages/LibraryListPage.tsx` | Rebuilt: `data.pages.flatMap(p => p.items)`; skeletons appended **inside the same `<ul>`** (8 initially, `min(pageSize, totalItems − loaded)` for a later batch, D20); `<div ref={sentinelRef} aria-hidden="true" data-testid="library-load-sentinel">` rendered only when items exist and `hasNextPage`, observed with `rootMargin: '0px 0px 300px 0px'` and deps `[hasNextPage, isFetchingNextPage, nextPageError, fetchNextPage]`, marked `// ponytail: duplicate of SearchResultsPage sentinel effect; extract a shared hook when a third infinite list appears`; end message (contracts §4, em dash, singular "1 record"); `role="alert"` + Retry block for a failed batch, with the full-page error now gated on `!data && isError`; Previous/Next removed; `currentLibraryPath = buildLibraryPath(filters, sort)` passed as `from`; status region extended with the batch/end rows of contracts §5 (`batchAnnouncement \|\| sortAnnouncement` in the single `<p role="status" class="sr-only">`, D21). |

`data-testid="library-load-sentinel"` was added at qa-agent's request so T025's prefetch scenario can assert on the sentinel directly. It keeps `aria-hidden="true"`, so it stays out of the accessibility tree (contracts §4).

Design skills consulted (`apple-design`, `emil-design-eng`): no new motion in this pass (that is US3/US4). Presentation follows the existing `SearchResultsPage` pattern — skeletons geometrically identical to the real card/row so an appended batch shifts nothing (CLS = 0, D20); the end message is quiet centered secondary text rather than a banner (restraint); the batch failure pairs text with a Retry button and never signals state by colour alone (WCAG 1.4.1).

### Existing tests updated (and why)

- `tests/unit/queries/libraryQueries.test.tsx` — the four US1 tests that called `useLibraryList(1, 20, …)` / `useRefreshLibrary(1, 20, …)` / `libraryKeys.list(1, 20, …)` moved to the new `(sort, filters)` signature; their assertions read `data.pages[0]` and the refresh cache now holds `{ pages: [...], pageParams: [1] }`. All coverage kept, including "two sorts never share a cache entry".
- `tests/unit/hooks/useLibraryQueryParams.test.tsx` — `parses the page number from the URL`, `includes the page number when greater than 1` and `omits the page number when it is 1` removed (the behaviour is gone; the US2 block's `ignores a legacy ?page=3` and `never writes a page param` replace them). `defaults to page 1 …`, `writes sort, dir, filters and page together` and the round-trip test dropped their `page` expectations; the describe title is now `buildLibraryPath(filters?, sort?)`. `resets to page 1 in the built path when filters change (FR-010)` kept unchanged.
- `tests/integration/libraryListFlow.test.tsx` — `keeps filters active when navigating to another page (FR-022)` rewritten as `keeps filters active when the next batch is loaded (FR-022)`: same filter assertions, but the second batch now arrives via `scrollToSentinel()` instead of the removed **Next** button. The US1 sort test's initial entry lost its meaningless `&page=2`; its `page` assertion stays as a regression guard.
- `tests/unit/RecordCard.test.tsx` / `RecordListRow.test.tsx` — the shared `renderCard` / `renderRow` helpers now pass the required `from="/app/library"`.

### Deviation — one line added to an approved red test (T027)

`libraryQueries.test.tsx` › `getNextPageParam advances while page * pageSize < totalItems, then stops` could not pass as written, for a reason unrelated to the implementation. TanStack Query only notifies an observer about **result properties that have been read** (`notifyOnChangeProps` tracking); `renderHook`'s probe reads none during render, so after the first `waitFor(() => result.current.isSuccess)` only `isSuccess` is tracked. When page 2 lands, `isSuccess` is unchanged, no notification fires, and `result.current.data` stays pinned at one page forever — the cache genuinely holds 2 then 3 pages (verified: `fetchNextPage()` resolves with `pages: 2`, `calls: [1, 2]`). The sibling test in `discogsQueries.test.tsx` avoids this only incidentally, by reading `hasNextPage` (which flips there) before fetching.

Fix applied — one assertion added after the first `waitFor`, before the first `fetchNextPage`:

```ts
expect(result.current.data?.pages).toHaveLength(1);
```

It reads `data`, which subscribes the observer to it, and additionally pins the first batch to exactly one page. Nothing was weakened or removed, and no production code was bent for the harness (the alternative, `notifyOnChangeProps: 'all'` on `useLibraryList`, was rejected as test-driven production config). Flagged here for qa-agent/developer sign-off.

## US2 verification (T037)

Date: 2026-09-20 · Branch `068-library-redesign-sort-scroll` (US2 implementation T032–T036 in the working tree, red tests committed at 25d0761).

### 1. Frontend (Vitest) — PASS

```
cd frontend && npx vitest run tests/unit/queries/libraryQueries.test.tsx \
  tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/RecordCard.test.tsx \
  tests/unit/RecordListRow.test.tsx tests/integration/libraryListFlow.test.tsx \
  tests/integration/recordDetailFlow.test.tsx
```

| Files | Tests | Result |
|---|---|---|
| 6 passed / 6 | 102 passed / 102 | green (1.5 s) |

One non-failing jsdom log: `Error: Not implemented: window.scrollTo` from `LibraryListPage.tsx:151` (`changeSort`). jsdom has no scroll implementation; the sort tests still pass. Noise, not a defect — worth a `vi.stubGlobal('scrollTo', …)` in the frontend setup file if it ever hides a real error.

### 2 + 3. E2E (Playwright) — 52 passed, 2 failed

`npm test -- <path>` in tasks.md is still wrong (T001/T005); all four specs ran in one emulator boot:

```
cd e2e && node ../scripts/check-emulator-ports.js && \
  PLAYWRIGHT_JSON_OUTPUT_NAME=<scratch>/e2e-us2.json \
  node ../scripts/run-with-timeout.js 1200 -- npx firebase --config ../backend/firebase.json \
  emulators:exec --only auth,firestore --project vinylmania-test \
  "playwright test tests/library-sort-scroll.spec.ts tests/library-list-responsive.spec.ts \
   tests/library-filters.spec.ts tests/view-mode-toggle.spec.ts --reporter=list,json"
```

Chromium only (the webkit project's `testMatch` covers just the three detail-page responsive specs). Duration 2.2 min.

| Spec | Passed | Failed |
|---|---|---|
| `library-sort-scroll.spec.ts` (US1 + US2) | 15 | 1 |
| `library-list-responsive.spec.ts` (US2) | 7 | 0 |
| `library-filters.spec.ts` (regression, migrated in US3) | 17 | 1 |
| `view-mode-toggle.spec.ts` (regression, migrated in US3) | 13 | 0 |
| **Total** | **52** | **2** |

**CLS (SC-001): `cls-grid = 0`, `cls-list = 0`** — both CLS scenarios green, exactly 0 after 3 scroll-loaded batches in each mode. The retry scenario, the prefetch scenario, the no-duplicates/no-gaps scenarios, the end message and the back-navigation scenario all pass.

#### Failure 1 — `library-filters.spec.ts:210` "filters remain active across a page change (FR-022)"

```
> 233 |     await page.getByRole('button', { name: /^next$/i }).click();
```

Cause: the spec drives pagination through the **Next** button, which T036 removed. This is the expected consequence of US2 (the spec is only migrated in US3, T041), not a regression in library behaviour: the same requirement is covered green at the integration layer by `libraryListFlow.test.tsx` › `keeps filters active when the next batch is loaded (FR-022)`, which asserts `list(2, 20, false, { genre: ['Rock'] }, DEFAULT_SORT)` after the sentinel fires. Filters themselves are unaffected — the other 17 tests in the spec pass, including the `genre=Rock` URL round-trip. Fix in US3: replace the Next click with `scrollToBottom`/`scrollUntil` and drop `page` from the mock's `totalItems: 40` shape. No production change needed.

#### Failure 2 — `library-sort-scroll.spec.ts:326` "tall screen: at 1280×2400 batches keep loading until the viewport is filled, with no scrolling"

```
> 333 |     await expect.poll(() => renderedIds(page)).toEqual(DEFAULT_ORDER.slice(0, 20));
    - Expected  -  0
    + Received  + 20      (rec-021 … rec-040 already rendered)
```

**Defect in the approved red test, not in the implementation.** The test sets a 2400 px viewport *before* `goto`, so the sentinel is inside the viewport (and its 300 px `rootMargin`) on first paint and page 2 auto-loads immediately — which is precisely the behaviour the test's *next* two assertions demand (`itemCount > 20` while `scrollY === 0`). The precondition "exactly the first 20 are rendered" can therefore never hold stably on a tall screen; the 5 s poll timed out with 40 items on screen. The implementation is correct and is in fact over-satisfying the scenario.

Suggested fix (test-only, left unapplied here — T037 was scoped to one test change, see below): drop line 333 and let the existing
```ts
await expect.poll(() => itemCount(page), { timeout: 10_000 }).toBeGreaterThan(20);
expect(await page.evaluate(() => window.scrollY)).toBe(0);
const ids = await renderedIds(page);
expect(ids).toEqual(DEFAULT_ORDER.slice(0, ids.length));
```
carry the scenario — the last assertion already proves order and prefix-correctness without pinning the count. Alternatively assert `.toEqual(DEFAULT_ORDER.slice(0, 20))` against the *first* page response rather than the DOM.

### Test change made under T037

One, as authorised: `e2e/tests/library-sort-scroll.spec.ts` › T025 prefetch scenario (SC-008). The off-screen check measured the **document end** (`scrollHeight - (scrollY + innerHeight) > 200`), a proxy. It now measures the **sentinel itself** via the new `data-testid="library-load-sentinel"`, in the same `page.evaluate` as the (synchronous) `window.scrollTo`, so the rect reflects the new scroll offset:

```ts
const sentinel = document.querySelector('[data-testid="library-load-sentinel"]');
if (sentinel === null) return null;
return sentinel.getBoundingClientRect().top - window.innerHeight;
```
with `expect(sentinelBelowFold).not.toBeNull()` + `.toBeGreaterThan(200)`. Strictly sharper: it now fails if the sentinel is missing or on-screen, neither of which the document-end proxy could detect. Passes.

### TDD audit — PASS

Baseline: commit `25d0761` ("Red state approved before implementation per Constitution Principle I"), which touches **test files and spec docs only** — no `src/` file. Test-first order holds: red committed, implementation left in the working tree.

Diff `25d0761..worktree` over `frontend/tests` and `e2e/tests`:

| File | `it(` red → now | Verdict |
|---|---|---|
| `unit/queries/libraryQueries.test.tsx` | 15 → 15 | signature migration only |
| `unit/hooks/useLibraryQueryParams.test.tsx` | 24 → 21 | the 3 documented page tests removed |
| `unit/RecordCard.test.tsx` | 9 → 9 | `from` prop in helper |
| `unit/RecordListRow.test.tsx` | 11 → 11 | `from` prop in helper |
| `integration/libraryListFlow.test.tsx` | 28 → 28 | Next → `scrollToSentinel()` |
| `integration/recordDetailFlow.test.tsx` | 18 → 18 | untouched |
| `e2e/tests/*` | — | untouched since 25d0761 except the T025 tightening above |

Every change falls inside the pre-agreed allowance, and nothing beyond it:

- Signature migrations to `useLibraryList(sort, filters)` / `libraryKeys.list(sort, filters)` / `buildLibraryPath(filters?, sort?)` — assertions carried over, not dropped (e.g. "two sorts never share a cache entry" still compares the two keys; the refresh test still asserts the cache payload, now `{ pages: [refreshed], pageParams: [1] }`).
- Removal of deleted page behaviour — exactly the 3 named tests (`parses the page number from the URL`, `includes the page number when greater than 1`, `omits the page number when it is 1`). No fourth removal.
- Next-button flow rewritten as scroll-triggered, keeping both `mockList` argument assertions.
- `from` added to the card/row render helpers.
- The one added line `expect(result.current.data?.pages).toHaveLength(1)` in the `getNextPageParam` test. **Signed off.** The `notifyOnChangeProps` diagnosis is correct — TanStack only notifies on read result props, so without a `data` read the observer never sees pages 2 and 3. It is an added constraint, not a relaxed one, and it was preferred over `notifyOnChangeProps: 'all'` in production, which is the right call (no production config bent to suit the harness).
- Regression guards kept: `expect(currentParams().get('page')).toBeNull()` in the US1 sort test; `resets to page 1 in the built path when filters change (FR-010)` untouched.
- No test weakened, no `.skip`/`.only`/`.todo` introduced (the single `test.skip` in `library-sort-scroll.spec.ts:399` is the pre-existing chromium-only guard on the Layout Instability API, present in the red commit).

**Verdict: no Principle I violation. One test defect (tall-screen precondition) and one expected US3-migration failure; no production bug found.**

- Follow-up to T037: removed the self-contradicting "first 20 only" precondition in the tall-screen scenario (e2e/tests/library-sort-scroll.spec.ts); spec re-run green 16/16. library-filters.spec.ts "filters remain active across a page change" still drives the removed Next button — migrated in US3 (T041).
