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

## US3 red tests — frontend (T045–T050)

RED phase only. No file under `frontend/src` was touched. Run with
`cd frontend && npx vitest run <files>`.

| Task | File | Tests added | Red reason (one line) |
|---|---|---|---|
| T045 | `frontend/tests/unit/motion/Overlay.test.tsx` | 4 (`Overlay — bottom variant (068 US3)`) | no `bottom` entry in `positionClasses`/`surfaceSizeClasses`, so the scrim lacks `items-end justify-center` and the surface lacks `max-h-[85dvh] w-full overflow-y-auto` |
| T045 | `frontend/tests/unit/motion/Sheet.test.tsx` | 5 (`Sheet — bottom sheet (068 US3)`) | `Sheet` hardcodes `variant="end"`, so a `dismissAxis="y"` sheet reports `data-variant="end"` |
| T046 | `frontend/tests/unit/ui/Modal.test.tsx` | 5 (`Modal › bottom sheet (068 US3)`) | `position="bottom"` is not a case, so it falls through to the centered `Overlay` (`data-variant="center"`, no `rounded-b-none` / safe-area padding) |
| T047 | `frontend/tests/unit/filters/SelectableListFilter.test.tsx` | 6 (`SelectableListFilter — inline disclosure (068 US3)`) | no `inline` prop: the facet still renders a trigger `Button` + nested `Modal`, never a `<details>/<summary>` |
| T048 | `frontend/tests/unit/FiltersControl.test.tsx` | 5 (`FiltersControl — live filters (068 US3)`) | no `live` prop: the collapsed `CollapsibleFilterPanel` + `<form>` + Apply are still rendered and there is no "Clear all filters" button |
| T049 | `frontend/tests/unit/LibraryToolbar.test.tsx` | 11 (`LibraryToolbar — dual layout bar and panel (068 US3)`) | the toolbar is still the US1 in-flow row: no `chrome-material` bar, no "Sort & Filter"/"Filters" triggers, no panel, no `matchMedia` listener |
| T050 | `frontend/tests/integration/libraryListFlow.test.tsx` | 7 (`Library header and live filters (feature 068, US3)`) | the header renders no record count and the page still mounts the standalone `FiltersControl` (Apply path), so there is no "Sort & Filter" panel and no "Showing N records." announcement |

Counts after this commit: Overlay 21 (2 red), Sheet 22 (2 red), Modal 28 (2 red),
SelectableListFilter 16 (6 red), FiltersControl 16 (5 red), LibraryToolbar 17
(11 red), libraryListFlow 35 (6 red). Every pre-existing test in these files is
still green, and `tests/integration/searchResultsFlow.test.tsx` is 27/27 green
(Search keeps its Apply button — unchanged by US3).

Notes for the implementation phase:

- `tests/unit/LibraryToolbar.test.tsx`'s existing `renderToolbar` helper was
  extended with the new `filters` / `onFiltersChange` / `onClear` props so the
  US1 sort-select tests keep passing once those props become required.
- Some added cases are green on purpose (they pin behaviour US3 must not
  break): the `shouldDismissSheet` thresholds restated for the downward axis,
  the y-axis handle geometry, `Modal`'s center/end variants, and
  "Refresh restarts the list from batch 1".
- `variant="bottom"` / `position="bottom"` / `inline` / `live` and the new
  `LibraryToolbar` props are type errors until T051–T056 land; Vitest strips
  types, so the failures above are genuine runtime assertion failures.

## US3 red tests — shared e2e migrations (T040–T044)

The five shared e2e specs that reached Library's filters through
`#filter-genre-trigger` (inside `CollapsibleFilterPanel`) were migrated per
research D22. The rule applied throughout: a case whose subject is **Library's
own overlay** re-points at the new Library surfaces (red now); a case whose
subject is a **shared primitive Library no longer shows** (centred
`SelectableListFilter` modal, `CollapsibleFilterPanel` disclosure) moves to
`/app/search`, which keeps both unchanged (green now — that green run is the
proof no coverage was lost). No production code was touched.

### Moved to `/app/search` — green now (10/10 passing)

| Task | File | Case | Vehicle on Search |
|---|---|---|---|
| T040† | `e2e/tests/overlay-focus-management.spec.ts` | "closing the centered Modal mid-enter reverses…" | `/app/search?q=modal` + `**/api/discogs/search*` mock (30 results), `Filters` → `#filter-genre-trigger` |
| T040† | `e2e/tests/overlay-focus-management.spec.ts` | the three `Modal: …` trap / focus-restore / scroll-lock cases (`openGenreModal`) | same; 30 results keep the page scrollable for the scroll-lock case |
| T041 | `e2e/tests/reduced-motion.spec.ts` | "the CollapsibleFilterPanel disclosure body reveals with no transform" | `/app/search?q=stockholm` + search mock |
| T041† | `e2e/tests/reduced-motion.spec.ts` | "the centered Modal opens with opacity only" | same |
| T043 | `e2e/tests/motion-performance.spec.ts` | "centered Modal enter + exit spring holds 60 fps" | `/app/search?q=modal` + search mock (30 results, so the DOM weight under 4× throttle matches the old Library grid) |
| T043 | `e2e/tests/motion-performance.spec.ts` | "CollapsibleFilterPanel disclosure holds 60 fps" | `/app/search?q=disclosure` + search mock |
| T044 | `e2e/tests/dark-mode-contrast.spec.ts` | "centered Modal content clears WCAG AA on its opaque surface" (light + dark) | `/app/search?q=overlay` + search mock, `assertOverlayContentContrast` unchanged |

† Beyond T040/T041's literal text. Both tasks say "its Library overlay vehicle
becomes the Filters drawer". Re-pointing those cases would have *deleted* the
only e2e coverage of the centred Modal's focus trap / focus restore / scroll
lock / interruptibility / reduced-motion path — and would have duplicated the
end-drawer cases that already exist in both files (the hamburger drawer). So
D22's shared-primitive rule was applied instead: the centred-Modal cases moved
to Search, and the Library drawer coverage T040/T041 ask for was **added** as
new red cases (below). Net: nothing lost, T040/T041's intent satisfied.

### Re-pointed at the new Library surfaces — red now (8/8 failing)

| Task | File | Case | Red reason |
|---|---|---|---|
| T040 | `e2e/tests/overlay-focus-management.spec.ts` | **new** "Library Filters drawer: focus is trapped and Escape restores focus to \"Filters\"" | today's "Filters" button is the `CollapsibleFilterPanel` toggle: `toHaveAttribute('aria-haspopup', 'dialog')` fails, no `dialog` named "Filters" exists |
| T041 | `e2e/tests/reduced-motion.spec.ts` | **new** "the Library Filters drawer opens with no slide translate under reduced motion" | `getByRole('dialog', { name: 'Filters' })` never appears |
| T041 | `e2e/tests/reduced-motion.spec.ts` | **new** "the Library \"Sort & Filter\" bottom sheet opens with no translate under reduced motion (390 px)" | the capsule's "Sort & Filter" button does not exist yet |
| T042 | `e2e/tests/overlay-contrast.spec.ts` | `openGenreModalOverBusyArt` → `openFiltersDrawerOverBusyArt`, feeding all 5 cases (AA contrast light/dark, axe light/dark, `prefers-contrast: more`) | `getByRole('dialog', { name: 'Filters' })` never appears |

`overlay-contrast.spec.ts` keeps the Library grid of busy cover art — the
subject there is the overlay *material over that art*, so the vehicle moves to
the drawer rather than to Search (D22).

T043's Library end-drawer case ("hamburger drawer (Sheet / end) enter + exit
slide") is unchanged, as the task requires.

### How this was verified

Two targeted runs (Firebase emulator + Playwright, chromium):

- green: `playwright test tests/overlay-focus-management.spec.ts tests/reduced-motion.spec.ts tests/motion-performance.spec.ts tests/dark-mode-contrast.spec.ts -g 'centered Modal|CollapsibleFilterPanel|Modal: '` → **10 passed (32.6 s)**
- red: `playwright test tests/overlay-focus-management.spec.ts tests/reduced-motion.spec.ts tests/overlay-contrast.spec.ts -g 'Library Filters drawer|Sort & Filter|busy cover art|prefers-contrast'` → **8 failed**, each on a missing new Library surface (reasons in the table above), none on an assertion about behaviour that already exists.

### Coverage note for the implementation phase

Nothing was dropped, but two expectations are now encoded in these specs and
must hold once T051–T056 land:

- the Library "Filters" trigger carries `aria-haspopup="dialog"` and its
  accessible name starts with "Filters" (the sr-only ", N active filters"
  suffix is matched by `/^filters(,|$)/i`); the bottom-sheet trigger likewise
  matches `/^sort & filter(,|$)/i`;
- the drawer/sheet dialogs are named exactly "Filters" and "Sort & Filter"
  (via `Modal`'s `title` → `aria-labelledby`) and expose `data-variant="end"`
  / `data-variant="bottom"`.

---

## US3 red tests — e2e (T038–T039)

Two Playwright runs (Firebase emulator, chromium):

- regression after the fixture extraction: `playwright test tests/library-sort-scroll.spec.ts` → **16 passed (37.9 s)**
- red: `playwright test tests/library-toolbar.spec.ts tests/library-filters.spec.ts` → **32 failed, 1 passed (2.9 min)**, then two test-side fixes re-run (`-g 'not in the page flow|remain active while more batches'` → 1 failed, 1 passed) for a final **32 red / 1 green** across the two files.

### Shared fixture extracted (no behaviour change)

`e2e/helpers/libraryFixture.ts` (new) now holds what `library-sort-scroll.spec.ts`
had inline: the 205-record `/api/library` mock (honours `page`/`pageSize`/`sort`/
`dir`/`genre`, with a `failPages` switch), the data-model §3 reference sorter,
`expectedIds`, `renderedIds`/`RECORD_LINKS`, `signIn`, `END_MESSAGE`/`endMessage`,
`scrollToBottom`/`scrollUntil`/`itemCount` and `DEFAULT_ORDER`. `library-sort-scroll.spec.ts`
imports them instead (pure move — the 16 US1/US2 scenarios stay green), and
`library-toolbar.spec.ts` reuses them rather than duplicating the fixture.

### How the bar is located (T038)

Not by a testid: the controls bar is the nearest **`fixed`** (below 640 px) or
**`sticky`** (≥ 640 px) ancestor of the single `ViewModeToggle`. That is exactly
what FR-016/FR-018 require, so the locator is itself the assertion — today's
in-flow US1 bar has no such ancestor, and `requireBar` fails with "no
fixed/sticky controls bar wraps the view toggle".

### T038 — `e2e/tests/library-toolbar.spec.ts` (new, 16 scenarios, all red)

| Scenario (quickstart §3) | Red reason today |
|---|---|
| 1. capsule bottom is 16 px above the viewport bottom, holds the toggle + "Sort & Filter", the select is hidden at 390 px | no `fixed` bar (US1 bar is in flow); no "Sort & Filter" button |
| 1. every interactive box in the capsule ≥ 44 × 44 (SC-005) | no capsule to scope the measurement to |
| 1. last record and end message not overlapped by the capsule (AS5, FR-019) | no capsule rect; `--capsule-clearance` (T055) does not exist |
| 1. Retry/alert not overlapped by the capsule (FR-019) | same |
| 2. Escape / Close / scrim click / drag-down each dismiss the sheet and return focus to the trigger (4 tests, AS2) | no "Sort & Filter" trigger and no `Modal position="bottom"` |
| 2. a sort radio applies live and the sheet stays open (FR-017) | no sheet, no radio group (sort is only the desktop `<select>` today) |
| 2. a genre tick updates the badge + record count, focus stays on the checkbox (AS7) | no sheet, no live filters, no header count (FR-020, T057) |
| 3. toolbar top = `--header-h` after scrolling 2000 px (AS3) | the bar is not `sticky` |
| 3. the select is inside the toolbar and updates the URL | the select exists (US1) but has no sticky bar around it |
| 3. "Filters" opens the end drawer (`data-variant="end"`), a tick applies live, Escape restores focus (AS3, AS7) | today's "Filters" is the `CollapsibleFilterPanel` trigger: no `aria-haspopup="dialog"`, no dialog |
| 3. "Clear all filters" clears and keeps focus, then goes `aria-disabled` (FR-021a) | today's control is "Clear filters" inside `FilterActions`, behind Apply |
| 3. toolbar width = `<main>` content width at 1440 px (`xl:max-w-7xl` → 1216 px) and 1100 px (`max-w-4xl` → 832 px) (FR-018) | no fixed/sticky bar |

Scenarios 4–7 of quickstart §3 (keyboard walk, axe, material contrast, reduced
motion) are **T062** and are deliberately not in this file yet.

### T039 — `e2e/tests/library-filters.spec.ts` migrated (17 scenarios: 16 red, 1 green)

Migrated off `#filter-genre-trigger` + "Apply filters" to the live filters,
parameterised over both surfaces (`SURFACES`): the **"Filters" drawer at
1280 px** and the **"Sort & Filter" sheet at 390 px**. The per-test route
handlers were replaced by one `mockLibrary(page, records, pageSize)` that
honours `genre`/`style`/`format` and `page`.

| Scenario | Red reason today |
|---|---|
| filters are not in the page flow: "Filters" carries `aria-haspopup="dialog"`, no free-text genre/style, no `#filter-genre-trigger`, no checkbox, no Apply before opening | the "Filters" button is the collapsible trigger and has no `aria-haspopup` |
| ticking a genre applies live — URL, record count, badge, results (× 2 surfaces) | no dialog; no header count; no live apply |
| unticking restores the unfiltered list (× 2 surfaces) | same |
| "Clear all filters" clears every facet, keeps focus, then `aria-disabled` (× 2 surfaces) | same; the current control is "Clear filters" behind Apply |
| no horizontal scroll while the Style disclosure is open (SC-005) (× 2 surfaces) | no dialog to open the `<details>` in |
| a no-match combination shows "no results for the active filters" | no dialog |
| genre narrows list-mode rows the same way (052 US2) | no dialog |
| empty/no-match messages unchanged in list mode (052 US2) | no dialog |
| axe: 0 serious/critical with the drawer open, light + dark (058 US1) | no drawer |
| Genre option checkbox border contrast vs the drawer surface, light + dark (058 US2) | no drawer |
| **filters remain active while more batches load on scroll (FR-022)** | **green** — this is the test that was failing under US2 because it drove the removed Next button; driven by scroll it passes against today's code |

### Tests dropped, and why

Four cases asserted Library UI that US3 removes outright; none of them has an
equivalent on the new surfaces, and the shared primitive they covered stays
covered on `/app/search` through T041/T043/T044:

- "Filter panel disclosure motion" × 2 (expand animates height+opacity; reduced
  motion is opacity-only) — the Library facets become native `<details>`, which
  D13 defines as instant with nothing to animate or reduce. `reduced-motion.spec.ts`
  (T041) and `motion-performance.spec.ts` (T043) keep the `CollapsibleFilterPanel`
  covered at `/app/search`.
- "collapsed filter panel border" contrast × 2 themes and "Genre filter trigger
  border" contrast × 2 themes — neither the collapsed panel Card nor the Genre
  trigger `Button` exists on Library any more (the facet is a `<summary>`). The
  toolbar's own material/border contrast is **T062** (research D17 floors).

**Not covered by any task**: T039's text only mentions the `#filter-genre-trigger`
+ Apply flow, but this file also contained those four cases; they were handled
here because no other US3/US4 task touches `library-filters.spec.ts`.

### Expectations this adds for the implementation phase (T051–T057)

Beyond the ones already listed under T040–T044:

- the controls bar is a **single element** that is `position: fixed` below 640 px
  (bottom edge 16 px above the viewport bottom) and `position: sticky` at
  `top: var(--header-h)` from 640 px up, wrapping the one `ViewModeToggle`, and
  at ≥ 640 px its width equals `<main>`'s content-box width;
- the header renders the record count as its own element whose whole text is
  `"N records"` / `"1 record"` (FR-020, T057) — several scenarios read it;
- the facet disclosure's `<summary>` text is exactly `"Genre"` or
  `"Genre (N selected)"`, and each option checkbox is labelled by the option value;
- "Clear all filters" is the exact accessible name, stays in the DOM and focusable,
  and exposes `aria-disabled="true"` when nothing is active;
- the panel trigger's accessible name carries the count, matched as `/N active filter/`.

## US3 red-test approval gate

- 2026-09-20: Red tests T038–T050 reviewed and **approved by the developer (Fernando Ortiz)** before implementation (Constitution Principle I), including the reviewed deletion of 4 library-filters cases whose components Library drops (shared primitives stay covered on /app/search). Implementation T051–T059 may start.

## US3 implementation — primitives (T051–T054)

Shared primitives only; the Library screen itself (T055–T058) is a separate lane.

- **T051 `Overlay` / `Sheet` bottom variant** (`frontend/src/motion/Overlay.tsx`,
  `frontend/src/motion/Sheet.tsx`) — `variant: 'center' | 'end' | 'bottom'`.
  `bottom` adds `items-end justify-center` to the scrim's position classes and
  `max-h-[85dvh] w-full overflow-y-auto` to the surface size classes, and
  animates `y: '100%' → 0 → '100%'` on the existing `spring.sheet`. The
  reduced-motion branch is untouched (opacity only, no translation), as is the
  `max-w-lg` fallback (still `center`-only). `Sheet` now derives
  `variant={dismissAxis === 'y' ? 'bottom' : 'end'}`; its drag/dismiss
  thresholds (`shouldDismissSheet`, 45 % / 500 px/s), rubber-band, scroll-boundary
  veto, `spring.momentum` fling exit and the existing top-anchored handle for
  `y` are all reused unchanged — no new motion code.
- **T052 `Modal position="bottom"`** (`frontend/src/components/ui/Modal.tsx`) —
  the `end` branch now also serves `bottom`: `dismissAxis` is derived from the
  position and the surface class is
  `rounded-b-none pb-[env(safe-area-inset-bottom)]` instead of `rounded-none`.
  `center`/`end` call sites are unchanged.
- **T053 `SelectableListFilter inline`**
  (`frontend/src/components/filters/SelectableListFilter.tsx`) — the search
  `Input` + `Checkbox` list was extracted into one `optionList` value now shared
  by the `Modal` path and the new `inline` path, so the two can never drift. The
  inline path renders `<details><summary>` with the summary text
  `"Genre"` / `"Genre (N selected)"` (a single text node, no nested span),
  `min-h-11` + `focusRing` + `pressableRow`, and no `Modal`. The native
  disclosure triangle is kept as the expanded affordance (state is never colour
  alone, nothing to reduce under `prefers-reduced-motion`).
- **T054 `FiltersControl live`** (`frontend/src/components/FiltersControl.tsx`) —
  `live` drops `CollapsibleFilterPanel`, the `<form>` and `FilterActions`; the
  three facets render `inline` inside a plain `div`, each tick calls
  `onApply(toPayload(next))` with the full next selection (emptied facets are
  dropped, so "nothing selected" is `{}`), and a text `Button`
  "Clear all filters" is always rendered — `aria-disabled` (never `disabled`)
  when nothing is active, so focus is never dropped when the last filter clears.
  The payload builder `toPayload` is shared with the Apply path. Without `live`,
  Search's behaviour is byte-for-byte unchanged.

Facet options are always rendered (not gated on `<details>` being open): the
approved T047 tests toggle a checkbox inside a closed disclosure, and the full
757-option Style list costs ~4 s across the whole `FiltersControl` suite — not
worth the extra state.

## US3 implementation — toolbar & page (T055–T058)

- **T055 `--capsule-clearance`** (`frontend/src/styles/global.css`) — added
  next to `--header-h` as `calc(6rem + env(safe-area-inset-bottom))`, sharing
  that block's comment (the documented `:root` exception, plan UI Design
  System row): a value that both CSS (`env()` arithmetic) and a JS-set
  `scroll-padding` read cannot live in a utility class.
- **T056 `LibraryToolbar`** (`frontend/src/components/LibraryToolbar.tsx`) —
  one bar element with the D18 class pairs (capsule → `sm:` toolbar), holding
  `ViewModeToggle` (once), the `sm:hidden` "Sort & Filter" trigger, the
  `hidden sm:flex` "Sort" label + `<select>` (US1's, moved verbatim) and the
  `hidden sm:inline-flex` "Filters" trigger. Both triggers carry
  `aria-haspopup="dialog"` + `aria-expanded`; the count is an `aria-hidden`
  amber badge plus an sr-only `, N active filter(s)`, so state is never colour
  alone and the name matches `/^Filters(,|$)/`.
  - Two `useState`s: `open` and the last-opened `panel` (`'sheet' | 'drawer'`).
    Keeping them apart means the title and anchor edge do not flip mid-exit.
    The panel variant follows the trigger, not `matchMedia`, because only one
    trigger is reachable per breakpoint — matchMedia is used solely for the
    change listener that closes an open panel when 640 px is crossed.
  - The `Modal` is a **sibling** of the bar, not a child: the bar's `z-30`
    opens a stacking context that would trap the overlay's `z-50` under the
    app header.
  - Sheet body: `<fieldset legend="Sort by">` wrapping one fieldset per
    criterion, six native radios sharing `name="library-sort"` (arrow keys
    rove the whole set natively), then `<FiltersControl live>`. Drawer body:
    `<FiltersControl live>` only. No new motion code — press feedback is the
    shared `pressableRow`/`pressable`, the sheet reuses `spring.sheet`.
- **T057 `LibraryListPage`** (`frontend/src/pages/LibraryListPage.tsx`) —
  header gains the "N records" / "1 record" total (rendered only once `data`
  exists, so a loading header never claims "0 records"); the standalone
  `FiltersControl` is gone and `LibraryToolbar` sits directly after the header
  with `filters` / `onFiltersChange` / `onClear`; `<main>` gets
  `pb-(--capsule-clearance) sm:pb-8`; a mount effect sets
  `scroll-padding-top/bottom` on `<html>` and clears them on unmount. A
  `filtersChanged` flag mirrors `sortChanged`: "Showing N records." (or "No
  records match the active filters.") is derived from the *current* query's
  `totalItems`, so a late response for an abandoned selection can neither
  render nor announce (FR-015).
- **T058 `motion/README.md`** — `dismissible-layer` now documents the `bottom`
  variant (single detent, `85 dvh`, same-edge enter/exit, handle at the top,
  `Sheet` picking the variant from `dismissAxis`); `disclosure` records the
  native `<details>` facets of `SelectableListFilter inline` as a documented
  exception (instant, native expanded state, nothing to reduce); a new pattern
  7 `chrome-material` documents the translucent chrome, its three fallbacks
  and the "colour only on opaque layers" rule.

### Perf fix that T049/T050 forced (`SelectableListFilter`)

`getByLabelText` is super-linear in jsdom (measured on this repo: 50 labelled
inputs → 24 ms, 200 → 0.8 s, 400 → 6.6 s, 800 → 54 s). The live panel mounts
all 823 facet options, so every `within(dialog).getByLabelText('Rock')` in the
approved T049/T050 tests took ~65 s and blew the 5 s timeout — the tests could
not pass against any implementation that mounts the full catalogue.

Fix: inside an `inline` disclosure, a **`searchable`** facet (the marker this
codebase already uses for "long list" — Style's 757 values) mounts its
checkboxes only while the `<details>` is open (`onToggle` → state). The search
`Input` itself always renders, and short facets (Genre 15, Format 51) are
unchanged, so every approved T047/T048 assertion — including the ones that
query options inside a *closed* disclosure — stays green. Panel option count
drops 823 → 66; `getByLabelText` drops 65 s → 82 ms. It is also the right
behaviour in the browser (no 757 invisible checkboxes in the sheet). e2e is
unaffected: `facetOption()` clicks the `<summary>` before querying.

### Pre-existing Library tests re-pointed (Apply path → live panel)

`frontend/tests/integration/libraryListFlow.test.tsx`, assertions kept
verbatim, only the vehicle changed (Search keeps Apply; `searchResultsFlow`
is untouched and green):

| Test | Change |
|---|---|
| describe "Shared collapsible filters on My Library (038 US2)" | renamed to "Shared filters on My Library (feature 038, US2 — via the 068 panel)" + an `openFilters(user)` helper |
| "renders the same collapsible filter component (collapsed by default)…" | renamed "keeps the filters behind a panel trigger rather than in the page flow (FR-016)"; assertions unchanged (they already only required a "Filters" button and no "Genre" *button*) |
| "applying a Genre filter narrows the displayed entries…" | Filters → dialog → tick Rock; the `#filter-genre-trigger` hop and "Apply filters" click dropped (neither exists on Library any more) |
| "shows a 'no results for the active filters' message…" | same |
| "applying a filter keeps sort and dir in the URL and in the request" (US1) | same |

### One approved assertion is wrong and was left red (T050, FR-015)

`libraryListFlow.test.tsx` ~line 1074–1083 expects the two quick ticks
Rock → Jazz to produce `genre=Rock,Jazz` (and the request key `Rock+Jazz`).
Filter values are serialized in **canonical catalogue order** by
`hooks/catalogFilterParams.ts` (features 022/038, shared with Search), and
`GENRE_OPTIONS` lists Jazz (index 8) before Rock (index 13) — so the URL is
`genre=Jazz,Rock` and the key is `Jazz+Rock`. Preserving click order would
mean changing that shared serializer, which US3 does not ask for and Search
depends on.

Verified: replacing the three literals `Rock+Jazz` → `Jazz+Rock` and
`'Rock,Jazz'` → `'Jazz,Rock'` makes the test pass with no other change, and
nothing about its strength or intent changes. The approved text was left in
place (red) rather than edited unilaterally.

### Run (T055–T058)

| Command | Result |
|---|---|
| `cd frontend && npx vitest run` | **964 passed / 965**, 108 files passed / 109 — the single failure is the canonical-order assertion above |
| `npx tsc -b --noEmit` | clean |
| `npm run lint` (oxlint) | 0 errors; 8 pre-existing `only-export-components` warnings, none in touched files |
| `npx prettier --write` on touched files | no changes |

e2e was not run here (T059, qa-agent).

### For T059 / US4 (T060–T066)

- **T038's 44 × 44 scan will fail as written.** It collects
  `button, a, select, summary, input` inside the bar and asserts every box is
  ≥ 44 × 44, but at 390 px the `hidden sm:*` sort `<select>` and "Filters"
  button are `display: none` → `getBoundingClientRect()` is 0 × 0. They must
  stay in the DOM (the US1 select tests and T049's class assertions require
  CSS-only hiding at both breakpoints), so the scan needs a visibility filter
  (`el.checkVisibility()`, or drop zero-area boxes). Test-side fix; not
  touched here.
- `.chrome-material` is applied but has **no CSS yet** — T064 adds the three
  `global.css` blocks, and the `prefers-contrast: more` e2e case stays red
  until then.
- `ViewModeToggle`'s track is still transparent (T063): on the capsule the
  primary pill currently sits on translucent material (2.49:1). T063's
  `bg-white dark:bg-surface` closes it.
- Names/roles already in place for T061: `aria-haspopup="dialog"` +
  `aria-expanded` on both triggers, visible digit + sr-only ", N active
  filter(s)", `<fieldset legend="Sort by">` ▸ three criterion fieldsets ▸ six
  radios sharing `name="library-sort"`, "Clear all filters" always focusable
  with `aria-disabled` (from T054).

## US3 verification (T059)

Date: 2026-09-20 · Branch `068-library-redesign-sort-scroll` · implementation
T051–T058 in the working tree, red tests committed at `06d2b73`.

### 1. Frontend (Vitest) — PASS

```
cd frontend && npx vitest run tests/unit/motion tests/unit/ui/Modal.test.tsx \
  tests/unit/filters tests/unit/FiltersControl.test.tsx \
  tests/unit/LibraryToolbar.test.tsx tests/integration/libraryListFlow.test.tsx \
  tests/integration/searchResultsFlow.test.tsx
```

| Files | Tests | Result |
|---|---|---|
| 14 passed / 14 | 219 passed / 219 | green (3.3 s) |

The FR-015 race assertion is green after the developer's literal fix
(`Jazz,Rock` / `Jazz+Rock`, the shared serializer's canonical catalogue
order). The only log noise is the pre-existing jsdom
`Error: Not implemented: window.scrollTo`, now also raised from
`LibraryListPage.changeFilters` — non-failing, same finding as the US2 run.

### 2. E2E (Playwright) — 109 passed / 110, one emulator boot

```
cd e2e && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 1500 -- npx firebase --config ../backend/firebase.json \
  emulators:exec --only auth,firestore --project vinylmania-test \
  "playwright test tests/library-toolbar.spec.ts tests/library-filters.spec.ts \
   tests/overlay-focus-management.spec.ts tests/reduced-motion.spec.ts \
   tests/overlay-contrast.spec.ts tests/motion-performance.spec.ts \
   tests/dark-mode-contrast.spec.ts tests/view-mode-toggle.spec.ts \
   tests/library-sort-scroll.spec.ts tests/library-list-responsive.spec.ts --reporter=list"
```

Chromium only. Duration 3.8 min, all ten specs in a single emulator boot.

| Spec | Passed | Failed |
|---|---|---|
| `library-toolbar.spec.ts` (T038, US3) | 16 | 0 |
| `library-filters.spec.ts` (T041, US3 migration) | 16 | 1 |
| `overlay-focus-management.spec.ts` (T039) | 14 | 0 |
| `reduced-motion.spec.ts` (T040) | 8 | 0 |
| `overlay-contrast.spec.ts` | 8 | 0 |
| `motion-performance.spec.ts` | 4 | 0 |
| `dark-mode-contrast.spec.ts` | 7 | 0 |
| `view-mode-toggle.spec.ts` (US1/US3 regression) | 13 | 0 |
| `library-sort-scroll.spec.ts` (US1/US2 regression) | 16 | 0 |
| `library-list-responsive.spec.ts` (US2 regression) | 7 | 0 |
| **Total** | **109** | **1** |

No US1/US2 regression from the layout change: `library-sort-scroll` (16/16,
including both CLS scenarios) and `library-list-responsive` (7/7) are fully
green against the new capsule/toolbar.

### Test change made under T059 (authorised)

`e2e/tests/library-toolbar.spec.ts` — the SC-005 44 × 44 scan now filters the
collected `button, a, select, summary, input` nodes through
`node.checkVisibility()` before measuring. At 390 px the `hidden sm:*` sort
`<select>` and "Filters" trigger stay in the DOM (CSS-only hiding, asserted by
T049) but are `display: none`, so their `getBoundingClientRect()` is 0 × 0 and
the scan failed on elements the user cannot hit. Strictly a correction of the
scan's population, not of its threshold: every element that *is* hittable is
still required to be ≥ 44 × 44. The spec is now 16/16.

### Failure — `library-filters.spec.ts:356` "Genre option checkbox border meets WCAG UI component contrast in light mode"

```
Error: Genre option checkbox border (light): backgroundColor contrast ratio
1.00:1 (backgroundColor rgba(0, 0, 0, 0) vs adjacent surface rgba(0, 0, 0, 0))
```

**Defect in the approved red test (T041), not in the implementation, and not
a US4 item.** The migrated test compares the checkbox against
`page.getByTestId('sheet-surface')`. That testid is on `Overlay`'s *animating
wrapper* (`motion/Overlay.tsx` ~line 246), which carries layout and motion
only — the painted background is on the inner `<Card className="overlay-surface">`
it wraps. So the comparison surface computes to `rgba(0, 0, 0, 0)`.

The light-mode checkbox background is *also* transparent by design and by
prior decision (see the comment block in `frontend/src/components/ui/Checkbox.tsx`,
spec 058 T028 finding #10) — transparent vs transparent is 1.00:1, so the
assertion cannot pass against any implementation. The pre-068 version of this
test used `dialog.locator('> div').first()`, i.e. the painted card, and was
green. The dark-mode twin passes only *by accident*: `toRgb` resolves
`rgba(0,0,0,0)` to black, and the dark checkbox fill (`dark:bg-stone-300`)
contrasts strongly with black.

Suggested fix (test-only, left unapplied — outside T059's authorised change):
point the comparison at the painted card, matching `overlay-contrast.spec.ts`,
which does exactly this and is green:

```ts
page.locator('[data-testid="sheet-surface"] .overlay-surface')
```

No production change needed; the rendered contrast is correct in both themes.

### Deferred to US4 (T060–T066)

Both pre-declared reds turned out **not to be red** — and neither is actually
covered by a test today, which is itself the finding:

- **T064 (`.chrome-material` has no CSS).** `overlay-contrast.spec.ts`'s
  `prefers-contrast: more` case passed: its assertions key on `.overlay-scrim`
  / `.overlay-surface`, whose `@media (prefers-contrast: more)` block ships
  from spec 059 (`global.css` ~line 222). Nothing currently asserts that
  `.chrome-material` degrades at all, so T064 lands with **no failing test
  in front of it** — T064 must add one (Principle I) rather than only add CSS.
- **T063 (ViewModeToggle track still transparent).** Both
  `view-mode-toggle.spec.ts` "active option fill meets WCAG UI component
  contrast" cases passed, for the same reason the dark checkbox case above
  passes: the toggle container is transparent, `toRgb` reads that as black,
  and the primary pill contrasts with black. The tests also run at the default
  1280 px viewport, i.e. the sticky toolbar, never the translucent capsule
  where the ~2.49:1 was measured. T063 therefore needs a red test at a
  < 640 px viewport comparing the pill against the *effective* (composited)
  capsule background, not the transparent track.

### TDD audit — PASS

Baseline: commit `06d2b73` ("test(068): add failing tests for library toolbar,
sheet and live filters (US3)"), which touches test files and spec docs only —
no file under `frontend/src`. Test-first order holds: red committed,
implementation left in the working tree.

Diff `06d2b73..worktree` over `frontend/tests` and `e2e/tests` — exactly two
files changed, both inside the pre-agreed allowance:

| File | Change | Verdict |
|---|---|---|
| `frontend/tests/integration/libraryListFlow.test.tsx` | the developer's `Jazz,Rock` / `Jazz+Rock` literal fix; the documented Apply-path → live-panel re-pointing (describe rename + `openFilters` helper, one test title reworded, the `#filter-genre-trigger` hop and "Apply filters" click dropped in 4 tests) | allowed |
| `e2e/tests/library-toolbar.spec.ts` | the `checkVisibility()` filter above | allowed |

Checks run:

- No `it`/`test` removed or added: the re-pointed tests keep their assertion
  bodies verbatim (`Rock Only` visible / `Jazz Only` absent; the no-matches
  message; `genre=Rock` + `sort=album` + `dir=asc` in URL and request). Only
  the navigation steps that no longer exist on Library were dropped.
- No `.skip` / `.only` / `.todo` / `test.fail` introduced anywhere in the US3
  suites. The single `test.skip` in `library-sort-scroll.spec.ts:161` is the
  pre-existing chromium-only guard on the Layout Instability API.
- No timeout raised, no retry added, no assertion loosened. The one scan
  narrowed (44 × 44) was narrowed in population, not in threshold.
- `searchResultsFlow.test.tsx` untouched and green — Search keeps the Apply
  path, so the shared primitives are still covered on both flows.

**Verdict: no Principle I violation.** One test defect found
(`library-filters.spec.ts:356`, comparison locator), one authorised test fix
applied, no production bug found.

- Follow-up to T059: the Genre-checkbox contrast case now measures against `[data-testid="sheet-surface"] .overlay-surface` (the painted Card; the sheet-surface wrapper has no background). library-filters 17/17 green.
- US4 note: T063/T064 currently have NO failing test (the existing contrast cases pass via the transparent→black artefact and run at 1280px only). US4 must add red tests at 390px measuring against the composited capsule background, and a test that `.chrome-material` degrades under prefers-contrast/reduced-transparency, before implementing.

## US4 red tests — frontend (T060–T061)

Date: 2026-09-20 · Branch `068-library-redesign-sort-scroll` · US3 committed at
`e0607ec`. RED phase only: no file under `frontend/src` was touched.

```
cd frontend && npx vitest run tests/unit/ViewModeToggle.test.tsx tests/unit/LibraryToolbar.test.tsx
→ 2 failed | 42 passed (44), 1 file failed / 1 passed
```

### T060 — ViewModeToggle opaque track (RED, 2 tests)

`frontend/tests/unit/ViewModeToggle.test.tsx`, both new tests fail on the same
missing classes:

```
Expected the element to have class: bg-white dark:bg-surface
Received: relative inline-flex gap-1 rounded-xl border border-stone-500 p-1
```

- "gives the track an opaque background so the pill keeps 3:1 over translucent
  chrome (US4)" — `screen="library"`.
- "keeps the track opaque on Search too, so both instances stay identical
  (US4)" — `screen="search"`, so T063 cannot satisfy the first test by gating
  the class on `screen === 'library'` (T063 says the change is a visual no-op
  on Search).

This is the genuinely failing test the US3 verification note asked for: the
prior e2e contrast cases passed through the transparent→black measurement
artefact and only ran at 1280 px, never at the 390 px capsule where the
~2.49:1 was measured.

**Ceiling of the unit level.** jsdom loads no Tailwind stylesheet and does no
compositing, so `getComputedStyle` returns nothing for `bg-white` and a real
ratio cannot be derived from the DOM. Asserting the opaque-layer *classes* is
the strongest check available here; the composited 390 px measurement is
T062's (qa-agent, e2e). Documented in the test's doc comment so the class
assertion is not mistaken for a contrast measurement.

### T061 — contracts §4 names/roles/states (GREEN regression guards, 14 tests)

New nested describe `accessible names, roles and states (contracts §4)` in
`frontend/tests/unit/LibraryToolbar.test.tsx`. **All 14 pass on the US3 code as
committed** — US3 (T054/T056) already satisfies every toolbar row of the §4
table, so these land as regression guards, not as red tests.

Rows covered (all green): view toggle radiogroup name + per-radio names +
`aria-checked`; sort `combobox` named "Sort" with `group` per optgroup and the
selected option as its value; the same selection as a checked radio in the
sheet, all six labels asserted; "Sort & Filter" / "Filters" names with the
count rendered as words (`/^Filters\s*,\s*1 active filter$/`) and the amber
digit `aria-hidden` so the name is not doubled (FR-029); `aria-expanded`
flipping only on the trigger that owns the open panel; the panel as
`aria-modal="true"` labelled by its own heading element; facets as native
`<details>`/`<summary>` named "Genre (1 selected)" with native `open` state;
facet options as `checkbox` named by value and checked from `filters`; the
style search as a `textbox` named "Search style" with no visible label;
"Clear all filters" carrying `aria-disabled="true"` while never `disabled`
and still `.focus()`-able, and dropping `aria-disabled` once a filter is
active; the §4 footer (`min-h-11` + shared `focusRing` on every control in the
bar); and the §6 tab order view toggle → panel trigger.

**Consequence for T065**: no unit-level gap to close in
`LibraryToolbar.tsx`. Whatever T065 fixes must come from T062's e2e findings.

### §4 rows NOT testable in this file

- **Record count, live announcer (`role="status"`), next-batch failure
  `alert` + Retry, end-of-list text, load sentinel** — owned by
  `LibraryListPage`, not `LibraryToolbar`; already covered by the US2/US3 flow
  tests in `frontend/tests/integration/libraryListFlow.test.tsx`.
- **"arrow keys rove natively" across the three sort fieldsets** — jsdom does
  not implement native radio-group arrow navigation. Only the precondition
  (one shared `name`) is asserted, by the US3 test; the behaviour itself is
  e2e-only.
- **Contrast ratios, `prefers-contrast`/`prefers-reduced-transparency`
  degradation, drag-to-dismiss, scroll-padding clearance, real 44 px box
  sizes** — all need layout or compositing; T062.
- **Facet-option touch target**: the `Checkbox` row is `min-h-11` but the
  `<input>` itself is `h-4 w-4` and the pointer target is input + label text.
  Not asserted: `Checkbox` is shared with Search (feature 038) and is outside
  T065's scope (`LibraryToolbar.tsx` / `LibraryListPage.tsx`), so a red test
  here would have no authorised fix. Flagged for a future spec.

Search is unaffected: no production file changed, and the only other tests
touching the toggle (`tests/integration/libraryListFlow.test.tsx:391`,
`tests/integration/searchResultsFlow.test.tsx:770`) assert its presence, not
its class list.

## US4 red tests — e2e (T062)

`e2e/tests/library-toolbar.spec.ts` now carries quickstart §3 scenarios 4–7
(SC-003, SC-004, FR-023, FR-025, FR-027). Run:
`cd e2e && npm test -- tests/library-toolbar.spec.ts` (chromium; one emulator
boot). Production code untouched.

### Red (must drive T063–T065)

| Scenario | Test | Why it fails today |
|---|---|---|
| 6 — material contrast, dark | "every 390 px / 1280 px control clears its D17 floor over #ffffff covers in dark mode" | `active view pill fill (primary): 2.49:1` over the composited capsule `rgb(35, 35, 39)`, floor 3:1 — exactly research D17's predicted 2.49. Layer stack printed by the test: `rgb(11,11,16)` page → `rgb(22,22,31)` card → `#ffffff` cover → `oklab(… / 0.9)` chrome. **T063** (`bg-white dark:bg-surface` on the radiogroup track) is what makes it pass. |
| 6b — `emulateMedia({ contrast: 'more' })` | "under prefers-contrast: more the bar drops its blur and gains a 1 px border" | `backdrop-filter` computes to `blur(24px) saturate(1.5)`; `.chrome-material` has no CSS at all. **T064** must add the three unlayered blocks (opaque background, `backdrop-filter: none`, `border: 1px solid currentColor`). The test also asserts the bar background is no longer translucent. |

### Green regression guards (US3 already satisfies them)

- Scenario 4, both keyboard walks (sort select → "Filters" → drawer trap →
  facet tick/untick → Escape → trigger; and records → Space-scroll a batch →
  Retry). Focus rings and the drawer's trap already hold.
- Scenario 5, the whole axe matrix: light/dark × 390/1280 ×
  {loading, loaded, panel open} and × {end, batch error} — 8 tests, 0
  serious/critical violations. T065 therefore has no axe gap to close; its
  remaining work is whatever T061 finds at unit level.
- Scenario 6 in **light** mode at both widths: every D17 pairing clears its
  floor (14.01 / 8.24 / 3.84 / 5.04 / 8.14 — the D17 table reproduced to two
  decimals).
- Scenario 7, sheet open *and* close under `reducedMotion: 'reduce'` (the
  close half is new; `reduced-motion.spec.ts` only covered opening).

### Notes on the measurement (why the old cases were false greens)

- The composite walks `elementsFromPoint` in paint order and alpha-blends
  each layer on a 1 × 1 canvas over a *known solid* cover colour — a flat
  fill is unchanged by blur and saturation, so the result is D17's worst
  case by construction (light → `#e6e6e6`, dark → `#232327`). Reading the
  toggle track's own computed background instead yields `rgba(0,0,0,0)`,
  which `toRgb` resolves to black and which is what kept
  `view-mode-toggle.spec.ts` green at 2.49:1.
- `helpers/libraryFixture.ts`'s `mockLibrary` takes an optional `coverUrl`
  (default: none, so every other spec is unchanged).
- Two traps found while writing this, both fixed in the test: a `fillStyle`
  handed an unparseable value silently keeps the previous colour (now caught
  by a sentinel and asserted), and `ArrowDown` on a native `<select>` opens
  the OS popup on macOS instead of changing the value (the walk uses
  type-ahead, which behaves the same on CI and locally).

## US4 red-test approval gate

- 2026-09-20: Red tests T060–T062 reviewed and **approved by the developer (Fernando Ortiz)** before implementation (Constitution Principle I). The composited-contrast measurement exposed the real 2.49:1 view-pill failure that the previous transparent-background assertions had masked. Implementation T063–T066 may start.

## US4 implementation (T063–T065)

Date: 2026-09-20 · Branch `068-library-redesign-sort-scroll` · red tests
approved at `9263ff2`. Two files changed, both under `frontend/src`.

```
cd frontend && npx vitest run
→ 109 files passed | 981 tests passed (0 failed)
npx tsc -b --noEmit → clean
npm run lint → exit 0 (8 pre-existing react/only-export-components warnings,
               none in a touched file)
npx prettier --check on both touched files → clean
```

### T063 — opaque toggle track (done)

`frontend/src/components/ui/ViewModeToggle.tsx`: the radiogroup container
gains `bg-white` + `dark:bg-surface`, with a comment citing research D17 —
the `bg-primary` pill measures 2.49:1 against the composited translucent
`chrome-material` over worst-case artwork (under the 3:1 floor of WCAG
1.4.11), and 6.29:1 light / 3.14:1 dark on an opaque track. The class is
unconditional, not gated on `screen`, per T060's second test: Search sits on
exactly those page colours, so it is a visual no-op there and the two
instances stay byte-identical. apple-design §12 — colour goes on a solid
layer, never on the translucent foreground.

Both T060 tests now pass; the two other specs that touch the toggle
(`libraryListFlow`, `searchResultsFlow`) assert its presence, not its class
list, and are unaffected.

### T064 — `.chrome-material` fallbacks (done)

`frontend/src/styles/global.css`: three unlayered blocks added directly after
the `.overlay-scrim` ones, under their own justification header (Tailwind has
no variant for unsupported-`backdrop-filter`, `prefers-reduced-transparency`
or `prefers-contrast`, so custom CSS is the only route — same argument the
`.overlay-scrim` header already makes).

- `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` → `background-color: #fff`, `.dark` `#0b0b10`, both `backdrop-filter` properties `none`. No `!important`: unlayered already beats the `bg-white/90` utility.
- `@media (prefers-reduced-transparency: reduce)` → the same opaque pair, blur dropped, `!important` mirroring `.overlay-scrim`.
- `@media (prefers-contrast: more)` → opaque, blur dropped, plus `border: 1px solid currentColor` so the bar has a defined edge where content scrolls under it (WCAG 1.4.11; the soft `ring-1`/`shadow-lg` is not one). `currentColor` adapts per theme, exactly like `.overlay-surface`.

This covers all four assertions of T062's `contrast: 'more'` case:
`backdrop-filter` and `-webkit-backdrop-filter` resolve to `none`,
`border-top-style: solid`, `border-top-width: 1px`, and the background is a
hex with no alpha so the `/,\s*0?\.\d+\s*\)$/` translucency check fails as
required. Per apple-design §14 the degraded bar is a deliberate solid
surface: geometry, shadow, ring and contents are untouched, only the material
changes, and every D17 pairing still holds because the bar's contents already
sit on opaque layers.

### T065 — no gap found (nothing changed)

Both red-test reports state there is no remaining accessibility gap (axe clean
across light/dark × 390/1280 × 3 states × 2 list states; both keyboard walks
green; all 14 §4 unit rows green). That claim was re-verified here by reading
`contracts/library-ui.md` §4–§6 against `LibraryToolbar.tsx` and
`LibraryListPage.tsx` row by row, not taken on trust:

- **§4, toolbar rows** — radiogroup name/radios/`aria-checked`; `<select id="library-sort">` with its visible `<label for>` and one `<optgroup>` per group; sheet `fieldset` "Sort by" wrapping one `fieldset` per criterion with a single shared `name="library-sort"`; both triggers carrying `aria-haspopup="dialog"` and an `aria-expanded` scoped to the panel they own; the count rendered as an `aria-hidden` digit plus an sr-only "N active filter(s)" suffix; the panel delegated to the existing `Modal`. All present.
- **§4, page rows** — `{totalItems} record/records`; `<p role="status" class="sr-only">`; the next-batch `role="alert"` with the contract's exact sentence plus a "Retry" `Button`; the end message with the `record` singular; the sentinel `aria-hidden="true"`.
- **§5** — the announcer renders one string at a time and every branch is gated on `data`, so a selection announces only once its own results render, rapid changes collapse to the latest, initial load says nothing, and the batch effect's `pages.length > 1` guard keeps a single-batch result from announcing an end. Nothing in the path touches focus.
- **§6** — DOM order gives header → bar → records → Retry/end; the mount effect sets `scroll-padding-top: calc(var(--header-h) + 3.75rem)` and `scroll-padding-bottom: var(--capsule-clearance)` on `<html>` and clears both on unmount; trap, Escape and focus restore come from `Modal`; the native `<select>` keeps native keyboard behaviour.

No real gap, so **no edit was made** to either file (Constitution Principle
III — no invented work to fill a task slot). T065 is closed as verified.

The one item still open from T061 is out of T065's scope and unchanged: the
facet `Checkbox`'s `<input>` is `h-4 w-4` inside a `min-h-11` row, and
`Checkbox` is shared with Search (feature 038). Flagged there for a future
spec, not touched here.

## US4 verification (T066)

Date: 2026-09-20 · Branch `068-library-redesign-sort-scroll` · red tests
committed at `9263ff2`, implementation T063–T065 in the working tree
(`frontend/src/components/ui/ViewModeToggle.tsx`,
`frontend/src/styles/global.css`).

### 1. Frontend (Vitest) — PASS

```
cd frontend && npx vitest run tests/unit/ViewModeToggle.test.tsx tests/unit/LibraryToolbar.test.tsx
```

| Files | Tests | Result |
|---|---|---|
| 2 passed / 2 | 44 passed / 44 | green (1.3 s) |

Both T060 reds (opaque track; the class is unconditional so Library and
Search stay byte-identical) are green, and the 14 T061 contracts §4
regression guards still pass.

### 2 + 3. E2E (Playwright) — 51 passed / 52, one emulator boot

```
cd e2e && node ../scripts/check-emulator-ports.js && \
  node ../scripts/run-with-timeout.js 1500 -- npx firebase --config ../backend/firebase.json \
  emulators:exec --only auth,firestore --project vinylmania-test \
  "playwright test tests/library-toolbar.spec.ts tests/view-mode-toggle.spec.ts \
   tests/dark-mode-contrast.spec.ts --reporter=list"
```

Chromium only (the webkit project's `testMatch` covers just the three
detail-page responsive specs). Duration 1.7 min.

| Spec | Passed | Failed |
|---|---|---|
| `library-toolbar.spec.ts` (T038 US3 + T062 US4) | 31 | 1 |
| `view-mode-toggle.spec.ts` (T063 regression — the toggle is shared with Search) | 13 | 0 |
| `dark-mode-contrast.spec.ts` (T063 regression) | 7 | 0 |
| **Total** | **51** | **1** |

Both T062 reds are green:

- **Material contrast over solid cover art (4 tests, light/dark × 390/1280): all pass.**
  The red pairing, `active view pill fill (primary)`, now measures
  **3.12:1** in dark mode at **both** 390 px and 1280 px (was 2.49:1;
  research D17 predicted ~3.14:1, floor 3:1). The composited backdrop under
  the pill is now `rgb(11, 11, 16)` — the opaque `dark:bg-surface` track
  from T063 — instead of the translucent chrome's `rgb(35, 35, 39)`. Light
  mode: **6.29:1** over `rgb(255, 255, 255)` at both widths. Every other
  D17 pairing still clears its floor (dark 390: track border 3.27, inactive
  icon 7.59, "Sort & Filter" label 14.35 / border 3.26, badge text 8.14;
  dark 1280 adds "Sort" label 10.51, select text 16.47 / border 3.96,
  "Filters" label 14.35 / border 3.26).
  The 3.12 vs 3.14 gap is rounding in the oklch→sRGB path of the surface
  token, not a different colour: the measurement is over the real painted
  pixel, D17's figure over the nominal hex.
- **`prefers-contrast: more` (library-toolbar.spec.ts:936): passes.**
  `backdrop-filter` and `-webkit-backdrop-filter` resolve to `none`,
  `border-top: 1px solid`, background opaque.

No regression from T063's shared change: `view-mode-toggle.spec.ts` 13/13
(including the four spec-058 UI-component/focus-indicator contrast cases on
Search) and `dark-mode-contrast.spec.ts` 7/7, both unchanged from the T059
run. The 8 axe scans and both keyboard walks in `library-toolbar.spec.ts`
also stay green.

### Failure — `library-toolbar.spec.ts:232` "the capsule does not cover the retry alert when a batch fails (FR-019)"

```
Error: the capsule overlaps the alert
> 246 | expect(overlaps(await rectOf(alert), bar.rect), 'the capsule overlaps the alert').toBe(false);
```

**Flaky test, pre-existing (from the US3 red commit `06d2b73`), not a US4
regression and not a production bug.** Re-ran in isolation with
`--grep 'retry alert' --repeat-each=5`: **4 failed / 1 passed**. It was
green at T059 by timing luck (single run); nothing about it changed since —
`git diff 9263ff2 -- e2e frontend/tests` is empty, and the T062 fixture
change (`mockLibrary({ coverUrl })`) is opt-in and not used by this test.
T063/T064 change colour and media-gated CSS only, no geometry.

Cause: the test waits with `scrollUntil(page, () => retry.isVisible())`, but
Playwright's `isVisible()` means "in the DOM with a non-empty box", not "in
the viewport". Inside one poll iteration `scrollToBottom()` runs *before* the
failed batch renders, so the alert + Retry are appended after the last scroll,
the document grows, and the page is no longer at the bottom when the rects are
read — the alert lands in the band the fixed capsule covers (see
`test-results/.../test-failed-1.png`: the alert text is half behind the
capsule and Retry is off-screen). At rest at the bottom the layout is correct:
`LibraryListPage`'s `<main>` carries `pb-(--capsule-clearance)`, and the
sibling AS5 test (end message) asserts exactly that and passes — though it
shares the same latent race.

Suggested fix (test-only, left unapplied — T066 authorises no test changes):
require the scroll to have reached the bottom as well, so the loop takes one
more `scrollToBottom()` after the alert appears:

```ts
await scrollUntil(
  page,
  async () =>
    (await retry.isVisible()) &&
    (await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
    )),
);
```

No timeout raised, no assertion weakened, no production change needed. The
same guard is worth applying to the AS5 end-message test at line 212.

### TDD audit (Principle I) — PASS

- `git diff 9263ff2 -- e2e frontend/tests` is **empty**: not one character of
  the approved red tests changed during implementation. No `.skip`, `.only`,
  `.todo`, `test.fail` or `toPass()` anywhere in
  `library-toolbar.spec.ts`, `ViewModeToggle.test.tsx` or
  `LibraryToolbar.test.tsx`; no floor lowered (the D17 pairings still read
  3 / 4.5), no timeout or retry added.
- Order holds: `9263ff2` touches only `e2e/`, `frontend/tests/` and
  `specs/` — no file under `frontend/src` — and the implementation sits in
  the working tree after it.
- Working-tree production diff is exactly the two files T063/T064 declare
  (plus `.gitignore`, which only adds an `.agents/**/mcp_config.json`
  ignore, and the two spec docs). Nothing in `frontend/src` was touched to
  make a test pass.
- T065 claiming "no gap found" is consistent with this run: the 8 axe scans,
  both keyboard walks and all 14 §4 unit rows are green without a change.

**Verdict: no Principle I violation.** One flaky test found
(`library-toolbar.spec.ts:232`, scroll-position race, fix suggested above),
no production bug.

- Follow-up to T066: fixed the flaky FR-019/AS5 geometry tests (e2e/tests/library-toolbar.spec.ts) — `scrollUntil` now also waits for the document to be settled at the bottom (`atBottom` helper), since a batch rendered after the last scroll grows the page. 20/20 across 5 repeats.
