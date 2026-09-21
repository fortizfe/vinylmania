---

description: "Task list for 069 — Header search redesign: instant suggestions, WCAG 2.1 AA & Apple HIG"
---

# Tasks: Header Search Bar Redesign — Instant Suggestions, WCAG 2.1 AA & Apple HIG

**Input**: Design documents from `/specs/069-header-search-redesign/`

**Prerequisites**: plan.md, spec.md (incl. Clarifications / Session 2026-09-21), research.md (D1–D18), data-model.md, contracts/suggest-api.md, contracts/header-search-ui.md, quickstart.md

**Tests**: REQUIRED (Constitution Principle I, Test-First, non-negotiable). Every story's "Tests" block — unit, flow and e2e — must be written, seen failing, and **reviewed/approved by the developer or reviewer** before its "Implementation" block starts. The line "Red tests reviewed/approved before Implementation." marks each gate. Test tasks run only the named files; the full suites are the Polish gate (T045–T047).

**Organization**: grouped by user story in spec priority order (US1 P1, US2 P1, US3 P1, US4 P2). Each task ends with `— owner: <agent>` for `speckit-agent-assign-assign`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`–`[US4]`, **story phases only**. Setup, Foundational and Polish carry no story label.
- Paths are repo-relative: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`, `e2e/helpers/`

---

## Assumptions adopted at this phase

The plan left six points open; the user advanced to tasks without objecting, so they are treated as decided here. Each is cheap to revert — the task that owns it is named.

1. **Collapsed entry point below 640 px is a 44×44 icon button** that opens the overlay, replacing today's cramped `w-28` field (contracts/header-search-ui.md §2, research D14). Owned by **T010**; asserted by **T004**, **T007**.
2. **Expanded desktop width is `sm:w-96`** (contracts/header-search-ui.md §2). Owned by **T010**; asserted by **T004**.
3. **Upstream page size is `perPage: 20`** (research D3). Owned by **T023**; asserted by **T013**, **T015**.
4. **Panel order is artists first, then albums** (data-model §3 step 4). Owned by **T021**; asserted by **T012**, **T015**, **T020**.
5. **Arrow keys do not wrap at either end** — past the last / before the first returns to "no active option", so `Enter` can always submit the typed query (contracts/header-search-ui.md §4). Owned by **T035**; asserted by **T031**, **T033**.
6. **The e2e work is split, not one monolithic task.** The functional scenarios land per story in `e2e/tests/header-search.spec.ts` (**T004** US1, **T020** US2, **T040** US4) and the accessibility + contrast matrix lands in its own file `e2e/tests/header-search-a11y.spec.ts` (**T033** US3, completed by **T041** US4). This is the one deviation from plan.md's file map, which listed a single new spec; a separate a11y spec file follows the repo's existing precedent (`dark-mode-contrast.spec.ts`, `overlay-contrast.spec.ts`) and keeps the tasks parallelisable.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: record a green baseline for exactly the files this feature touches. No installs (0 new dependencies, plan Technical Context).

- [ ] T001 Run the targeted backend baseline `cd backend && npm test -- tests/unit/discogsCatalog tests/contract/discogsCatalog` and record any pre-existing failure in the PR notes before changing anything. No Firebase emulator is needed for this feature (quickstart §Prerequisites) — owner: qa-agent
- [ ] T002 [P] Run the targeted frontend baseline `cd frontend && npx vitest run tests/unit/HeaderSearchBox.test.tsx tests/unit/AppHeader.test.tsx tests/unit/queries/discogsQueries.test.tsx tests/integration/headerSearchFlow.test.tsx tests/integration/searchResultsFlow.test.tsx` and record the result — owner: qa-agent

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the one shared type the backend lane (US2) and the frontend lane (US2/US4) both compile against. Deliberately a single task: everything else in this feature is owned by exactly one story (research D1–D18), and a phase of scaffolding "for later" is what Principle III forbids.

**⚠️ CRITICAL**: US2 cannot start until this is complete. US1 does not depend on it.

- [ ] T003 Add the `CatalogSuggestion` type to backend/src/domain/discogsCatalog/types.ts exactly as data-model.md §2 specifies — `discogsId: number`, `resultType: 'release' | 'master' | 'artist'`, `title: string`, optional `artist`, `year: number`, `format: string`, `thumbnailUrl: string`, optional fields omitted rather than `null`. No `communityRating`, no `kind` field (research D17), no pagination. Add a doc comment naming it as the wire shape of `GET /api/discogs/suggest` and the value cached in Redis — owner: backend-agent

**Checkpoint**: the suggestion type exists. Story work can begin.

---

## Phase 3: User Story 1 — Start a search from anywhere, on any screen size (Priority: P1) 🎯 MVP

**Goal**: the header search becomes one comfortably sized entry point at every width. It expands on `spring.sheet` over a blurred, non-modal backdrop, takes focus with no second interaction, presents as a full-width overlay below 640 px behind a 44×44 icon button, collapses on Escape / backdrop / focus-out with focus returned, and submits exactly as it does today. No suggestions yet.

**Independent Test**: at 375 px and 1440 px, activate the header search from `/app`, `/app/library` and `/app/search`. One interaction reaches a focused field; the page behind is visibly de-emphasised and does not scroll (phone) or move (desktop); submitting lands on `/app/search` with filters re-applied when already there; Escape, a backdrop tap and moving focus away each collapse it and return focus to the opener. This is fully testable without any backend change.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T004 [P] [US1] Create e2e/tests/header-search.spec.ts with the US1 scenarios of quickstart.md §3, failing against today's header — scenario "entry point" (SC-001): at 375×812 and 1440×900, from `/app`, `/app/library` and `/app/search`, one click/tap reaches `document.activeElement` = the search input with no second interaction; scenario "phone overlay" (FR-005, SC-010, assumption 1+2): at 375 px the collapsed control is a ≥44×44 button named "Search", activation shows a full-width overlay, `document.scrollingElement.scrollWidth` equals the viewport width, every interactive box inside the search is ≥44×44, the page behind does not scroll while open and its scroll position is restored on collapse; scenario "non-modal" (clarification 3): the search container carries no `aria-modal` and no `role="dialog"`, the `<main>` landmark outside it stays in the accessibility tree, and `Tab` from the last element inside moves out (collapsing it) rather than cycling; scenario "wide layout" (FR-006, SC-008): at 1440 px the bounding box of the first element under the header is identical before, during and after expansion and a `PerformanceObserver({ type: 'layout-shift', buffered: true })` sums 0 (chromium only); scenario "collapse paths" (FR-007): Escape, backdrop click and focus-out each collapse and return focus to the opener at both widths — owner: qa-agent
- [ ] T005 [P] [US1] Extend frontend/tests/unit/HeaderSearchBox.test.tsx with failing tests for contracts/header-search-ui.md §1 (FR-002–FR-004, FR-007, FR-008): activation expands the form and focuses the input with no second interaction; on `/app/search` the field is pre-filled from `useSearchQueryParams().query` and its text is **selected** (`select()` after `focus()`) and **no** request is made (FR-004, clarification 4); the backdrop renders as `<div aria-hidden="true">` with `.overlay-scrim` + `backdrop-blur-xl` and clicking it collapses; Escape with no panel collapses and `useRestoreFocus` returns focus to the opener; a `focusout` whose `relatedTarget` is outside the search container collapses, while one inside does not; collapse clears `hasEdited`, releases the scroll lock and empties the `role="status"` region; submitting calls `navigate(buildSearchPath(trimmed, 1, onResultsPage ? activeFilters : undefined), { replace: onResultsPage })` with **exactly** today's arguments and then collapses — owner: frontend-agent
- [ ] T006 [P] [US1] Extend frontend/tests/unit/AppHeader.test.tsx with failing tests (FR-006, SC-008): the middle grid cell of the `grid-cols-[1fr_auto_1fr]` header can grow to hold the expanded form without the left and right cells changing their rendered order or the header's `h-(--header-h)`; the backdrop mounts below the header at `z-30` (under the header's `z-40`) and above nothing else; with the search collapsed the header markup is unchanged from today — owner: frontend-agent
- [ ] T007 [P] [US1] Extend e2e/tests/header-responsive-nav.spec.ts with a failing case (assumption 1, FR-001, SC-010): below 640 px the header's search cell is a single 44×44 icon button with the accessible name "Search" and `aria-expanded="false"`, not a text field, and the header's other cells keep their positions at 375 px — owner: qa-agent
- [ ] T008 [P] [US1] Extend e2e/tests/reduced-motion.spec.ts with a failing header-search case (FR-009): under `reducedMotion: 'reduce'`, `expectNoTransformMotion` from e2e/helpers/motion.ts holds across the search open and close, while the backdrop still appears, the field still takes focus and the collapse still restores focus — owner: qa-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 1

- [ ] T009 [US1] Update frontend/src/components/AppHeader.tsx to make T006 pass (plan Source Code map): let the middle `auto` grid cell grow so the expanded form fits without displacing the side cells, and mount the backdrop `<div aria-hidden="true">` with `fixed inset-0 z-30`, the existing `.overlay-scrim` class and `backdrop-blur-xl`, rendered only while the search is expanded. No new CSS class — `.overlay-scrim` in frontend/src/styles/global.css already carries the `@supports not (backdrop-filter)`, `prefers-reduced-transparency` and `prefers-contrast: more` fallbacks (research D12) — owner: frontend-agent
- [ ] T010 [US1] Rebuild the activation/collapse model of frontend/src/components/HeaderSearchBox.tsx to make T004, T005, T007 and T008 pass (FR-001–FR-009, research D10, D12–D14; assumptions 1, 2): an `expanded` boolean; below 640 px the collapsed control is a `min-h-11 min-w-11` icon `Button` named "Search" (`sm:hidden`) whose activation mounts a full-width overlay pinned under the header, and from 640 px up the field is visible and the form animates its width to `sm:w-96` on `spring.sheet` (`m.form` with `transition={spring.sheet}`); on activation `focus()` then `select()` the input and set `hasEdited = false`; wire the existing `useScrollLock(expanded && isPhoneWidth)`, `useRestoreFocus`, `useEscapeKey` and `usePrefersReducedMotion` hooks (do **not** use `motion/Overlay`, `Sheet` or `useFocusTrap` — clarification 3); collapse on Escape, backdrop activation and a `focusout` whose `relatedTarget` is outside the container, clearing `hasEdited` and the status region; backdrop and form cross-fade over `motionDuration.fade`, dropped entirely under reduced motion; leave the submit-and-navigate path untouched. Add the marker `// ponytail: animating width runs layout on the header row each frame; ceiling is a measurable header frame drop; upgrade path is ViewModeToggle's measured-transform approach` (research D13) — owner: frontend-agent
- [ ] T011 [US1] Run `cd frontend && npx vitest run tests/unit/HeaderSearchBox.test.tsx tests/unit/AppHeader.test.tsx tests/integration/searchResultsFlow.test.tsx` and `cd e2e && npm test -- tests/header-search.spec.ts tests/header-responsive-nav.spec.ts tests/reduced-motion.spec.ts` until the US1 scenarios are green — owner: qa-agent

**Checkpoint**: US1 is fully functional and shippable on its own — the header search is comfortable at every width, submits as before, and nothing below the header moves. This is the MVP.

---

## Phase 4: User Story 2 — See instant suggestions while typing (Priority: P1)

**Goal**: a new `GET /api/discogs/suggest` endpoint returns up to 5 shaped matches (2 artists + 3 albums, cross-filled) for **one** upstream Discogs request per cache miss and zero rating lookups, and the header panel renders them 300 ms after the collector pauses, going straight to the record or to its results when one is chosen.

**Independent Test**: type a 2-character fragment of a known artist, pause, and confirm a panel of up to 5 rows appears without leaving the page, each labelled "Artist" or "Album"; a fragment that matches albums only still fills to 5. Choosing an album row lands on `/app/releases/:id` or `/app/masters/:id`, an artist row on `/app/search?q=<name>`. Typing 10 characters at speed makes ≤ 3 lookups and a rapid type-and-delete run never renders a stale list. The backend half is independently testable with `curl` + the contract suite; the frontend half against the `page.route` fixture.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [ ] T012 [P] [US2] Create backend/tests/unit/discogsCatalog/domain/suggestionQuota.test.ts with failing tests for `allocateSuggestions` covering every row of data-model.md §3's truth table (FR-011, SC-011, assumption 4): (A≥2,B≥3)→2+3, (0,≥5)→0+5, (1,≥4)→1+4, (≥2,1)→4+1, (≥5,0)→5+0, (1,1)→1+1, (0,0)→0+0, (≥2,2)→3+2; plus the invariants asserted directly — output length `= min(5, A + B)`, never more than 5, every output element is present in the input, no duplicates, **artists before albums** with Discogs' order preserved inside each group, the same input always gives the same output, and the input array is not mutated — owner: backend-agent
- [ ] T013 [P] [US2] Create backend/tests/unit/discogsCatalog/application/suggestCatalogMatches.test.ts with failing tests over a `DiscogsCatalogPort` and `CachePort` double (FR-010, FR-016, FR-017, SC-011, research D3, D5; assumption 3): exactly **one** `searchCatalog` call per cache miss, with `{ resultType: 'any', page: 1, perPage: 20 }`; **zero** calls to `getReleaseRating` and `getMasterRelease`; the cache key is `discogs:suggest:{normalizedQuery}` with TTL `300`, and `"Iron "`, `"iron"`, `"IRON"` and `"iron  maiden"` / `"iron maiden"` collapse onto the same key; a second call inside the TTL makes no further `searchCatalog` call; a query with fewer than 2 non-whitespace characters returns `[]` without touching the cache or the port; a `CachePort` that throws still returns a correct result (fail-soft) — owner: backend-agent
- [ ] T014 [P] [US2] Extend the `describe('Discogs client contract: searchCatalog')` block of backend/tests/contract/discogsCatalog/discogsClient.contract.test.ts with failing cases for the new `resultType: 'any'` (contracts/suggest-api.md §5, research D2): `'any'` sends **no** `type` param upstream and keeps raw `release`, `master` and `artist` hits while dropping a `label` hit without throwing `DiscogsValidationError`; and the regression guard for `/api/discogs/search` — `'release'` still sends no `type` and still filters to `release|master`, `'artist'` still sends `type=artist` and is unfiltered, both byte-for-byte as today. (This is the existing home for `searchCatalog` adapter behaviour; plan.md's map named a `discogsCatalogAdapter.test.ts` that does not exist — see Notes) — owner: backend-agent
- [ ] T015 [P] [US2] Create backend/tests/contract/discogsCatalog/suggest.contract.test.ts with the 10 failing cases of contracts/suggest-api.md §7 (assumptions 3, 4): shape and ≤5 items with no `communityRating`, no `pagination`, no `q` echo; exactly 1 `/database/search` request with no `type` and `per_page=20`; 0 requests to `/releases/*/rating` and `/masters/*`; `q=i` and `q=%20%20` → `200 { "suggestions": [] }` with 0 upstream requests; the three quota fixtures (4 artists + 9 albums → 2 then 3; 0 artists + 9 albums → 5 albums; 6 artists + 1 album → 4 then 1); a `label` raw hit dropped without failing; a second identical request inside the TTL → same body, 0 further upstream requests; `DiscogsRateLimitError`/`DiscogsUnavailableError` → `502 catalog_unavailable` and an unexpected throw → `500 internal_error`; a rejected linked credential → `401 discogs_link_invalid` identical in shape to `/api/discogs/search`'s; no `Authorization` → `401`, over-limit → `429 rate_limited`, and a burst on `/suggest` does **not** consume `/api/discogs/search`'s budget — owner: backend-agent
- [ ] T016 [P] [US2] Create frontend/tests/unit/HeaderSuggestionPanel.test.tsx with failing tests for the `idle`, `loading` and `suggestions` states of data-model.md §5 (FR-011, FR-014, SC-008; empty and error are US4's T038): `idle` renders nothing; `loading` renders 5 `<li role="presentation" aria-hidden="true">` skeleton rows (`bg-stone-200 dark:bg-surface-raised animate-pulse rounded-md`) inside the listbox and exposes **0** options; `suggestions` renders 1–5 rows with the primary label, the secondary detail (artist / year / format) and the kind label as **text** ("Artist" / "Album") that survives colour being stripped (FR-025); a loading panel and a loaded panel report the **same height**; the surface is the existing `<Card>` with `shadow-lg`, never `SearchResultCard` (research D16) — owner: frontend-agent
- [ ] T017 [P] [US2] Extend frontend/tests/unit/queries/discogsQueries.test.tsx with failing tests for `discogsKeys.suggest` and `useCatalogSuggestions` (research D8, FR-013, FR-017, SC-005): the key is per trimmed query string so two queries never share a cache entry; `enabled` is false below 2 trimmed characters and false until `hasEdited`; `staleTime` is `5 * 60_000`; `retry` is `false`; the request goes through `authorizedFetch` to `/api/discogs/suggest?q=…` and nowhere else (Principle IX, FR-016) — owner: frontend-agent
- [ ] T018 [P] [US2] Extend frontend/tests/unit/HeaderSearchBox.test.tsx with failing debounce and gating tests (FR-004, FR-010, FR-015, SC-004, research D9, D10): typing a 10-character query at normal speed produces **≤ 3** lookups and **0** while the 300 ms timer has not elapsed; a paste of a long string is exactly **one** lookup; `hasEdited` is false until the first `onChange` after activation, so activating on `/app/search` with a pre-filled ≥2-character query fires no lookup and shows no panel; emptying the field closes the panel, discards the outstanding lookup and clears the `role="status"` region — owner: frontend-agent
- [ ] T019 [P] [US2] Extend frontend/tests/integration/headerSearchFlow.test.tsx with failing flow tests (FR-012, FR-013, FR-015, SC-002, SC-005, research D17): a delayed first response followed by a faster second renders **only** the second query's rows; clearing the field mid-flight leaves nothing rendered or announced when the first response lands; choosing a `master` row navigates to `/app/masters/:discogsId`, a `release` row to `/app/releases/:discogsId` and an `artist` row to `buildSearchPath(title)`, and each choice also collapses the search — owner: frontend-agent
- [ ] T020 [P] [US2] Extend e2e/tests/header-search.spec.ts with the suggestion scenarios of quickstart.md §3 (assumptions 3, 4): add the `page.route('**/api/discogs/suggest*')` fixture that honours `q` and can be switched per test to a 5-result mix, an artists-only set, an albums-only set, an empty set, a `502` and a delayed response; scenario "panel size stability" (FR-014, SC-008): with the delayed fixture the panel's height while loading equals its height once loaded; scenario "three interactions to a record" (SC-002): activate → type → click an album suggestion reaches `/app/releases/:id` or `/app/masters/:id`, and an artist suggestion reaches `/app/search?q=<name>`; scenario "quota shape" (SC-011, assumption 4): the artists-only fixture with 6 hits fills the panel to 5, and the mixed fixture shows 2 artists then 3 albums in that order; scenario "lookup counting" (SC-004, SC-005): ≤ 3 `/api/discogs/suggest` requests while typing a 10-character query at normal speed, and in a 20-keystroke type-and-delete run the rendered rows always belong to the text currently in the field — owner: qa-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 2

- [ ] T021 [US2] Create backend/src/domain/discogsCatalog/suggestionQuota.ts exporting the pure `allocateSuggestions(hits: CatalogSearchResult[]): CatalogSuggestion[]` to make T012 pass (research D4, data-model §3, assumption 4): partition preserving Discogs order into artists (`resultType === 'artist'`) and albums (`release | master`); base allowance `artists.slice(0, 2)` and `albums.slice(0, 3)`; cross-fill to 5 taking the next unused album first, then the next unused artist; output the taken artists then the taken albums. No clock, no randomness, no I/O — owner: backend-agent
- [ ] T022 [US2] Widen `SearchCatalogOptions.resultType` to `'release' | 'artist' | 'any'` in backend/src/ports/discogsCatalog/discogsCatalogPort.ts and handle it in `searchCatalog` in backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts to make T014 pass (contracts/suggest-api.md §5, research D2): `'any'` sends **no** `type` param upstream and filters the raw response to the kept set `release | master | artist` before `mapSearchResult`, so a `label` hit degrades to "not included" instead of throwing; the existing per-mode filter stays per-mode so `'release'` and `'artist'` are unchanged. No new port method, no new adapter file — owner: backend-agent
- [ ] T023 [US2] Create backend/src/application/discogsCatalog/suggestCatalogMatches.ts exporting `createSuggestCatalogMatchesUseCase({ discogsCatalog, cache })` to make T013 pass (research D1, D3, D5; assumption 3): normalise the query (trim → collapse internal whitespace → lower-case), short-circuit to `[]` below 2 non-whitespace characters without touching the cache or the port, then `cache.withCache('discogs:suggest:' + normalized, 300, () => discogsCatalog.searchCatalog(credential, query, { resultType: 'any', page: 1, perPage: 20 }).then(r => allocateSuggestions(r.results)))`, caching the **shaped** ≤5-item payload. `searchCatalogWithRatings` is **not** on this path. Add the marker `// ponytail: the suggest cache entry is shared across collectors (no credential in the key, matching discogs:search:*); ceiling is Discogs personalising /database/search; upgrade path is adding the credential type to the key` (research D5) — owner: backend-agent
- [ ] T024 [US2] Add the `GET /suggest` handler to backend/src/adapters/discogsCatalog/discogsRoutes.ts to make T015 pass (contracts/suggest-api.md §1, §3, §4, §6; research D1, D6, D7): declare a second local `rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_THRESHOLDS.standard, store: createRateLimitStore(), handler: rateLimitHandler })` instance — **not** shared with `standardRateLimit`, and declared inline per the CodeQL note in rateLimitOptions.ts — and apply it before `requireAuth`; resolve the credential with the existing `resolveCatalogCredential`, call the use case, respond `{ suggestions }`; map failures with the file's existing branches — `respondDiscogsAuthError(credential.type, err)` → `401`, `DiscogsRateLimitError`/`DiscogsUnavailableError` → `502 catalog_unavailable`, anything else → `500 internal_error`; log `logger.info({ route: '/api/discogs/suggest', outcome: 'success', uid, meta: { queryLength, artists, albums, returned } })` on success and reuse the file's `auth_failed`/`unavailable`/`error` shapes otherwise. **Never log `q`** (research D7). `/api/discogs/search` and the other three routes are untouched — owner: backend-agent
- [ ] T025 [US2] Run `cd backend && npm test -- tests/unit/discogsCatalog tests/contract/discogsCatalog && npm run build` and fix until green, with `tsc` clean across every `SearchCatalogOptions` test double after the widened `resultType` — owner: backend-agent
- [ ] T026 [P] [US2] Add `suggest(query: string): Promise<CatalogSuggestion[]>` to frontend/src/services/discogsApi.ts, calling `GET /api/discogs/suggest?q=…` through the existing `authorizedFetch` and returning `body.suggestions`, plus the mirrored `CatalogSuggestion` wire type from data-model.md §2. No Discogs URL or SDK in `frontend/` (Principle IX, FR-016) — owner: frontend-agent
- [ ] T027 [US2] Add `discogsKeys.suggest(query)` and `useCatalogSuggestions(query, enabled)` to frontend/src/queries/discogsQueries.ts to make T017 pass (research D8): `queryKey` per trimmed query string, `queryFn: () => discogsApi.suggest(query)`, `enabled`, `staleTime: 5 * 60_000`, `retry: false`. No new hook file — owner: frontend-agent
- [ ] T028 [P] [US2] Create frontend/src/components/HeaderSuggestionPanel.tsx to make T016 pass (research D15, D16; contracts/header-search-ui.md §3, §7): a `<Card id="header-search-panel" className="shadow-lg">` containing `<ul role="listbox" id="header-search-listbox" aria-label="Search suggestions">`, rendered whenever the panel is displayed; `loading` fills it with 5 `<li role="presentation" aria-hidden="true">` skeleton rows of the same shape and height as a real row; `suggestions` renders one `<li>` per item with thumbnail (`<img>`), primary label, secondary detail and the kind label as visible text; every state shares the panel's width and row height so it never resizes. The `role="option"`/`aria-selected`/`id` wiring is US3's T036; the empty and error states are US4's T042 — owner: frontend-agent
- [ ] T029 [US2] Wire suggestions into frontend/src/components/HeaderSearchBox.tsx to make T018, T019 and T020 pass (FR-010, FR-012, FR-013, FR-015; research D9, D10, D17): an eight-line `useState`+`useEffect`+`setTimeout` 300 ms debounce over the field value (no hook file, no dependency); a `hasEdited` boolean set on the first `onChange` after activation and cleared on collapse; feed `useCatalogSuggestions(debounced.trim(), hasEdited && debounced.trim().length >= 2)`; render `HeaderSuggestionPanel` below the field; choosing a suggestion navigates by `resultType` — `master` → `/app/masters/:discogsId`, `release` → `/app/releases/:discogsId`, `artist` → `buildSearchPath(title)` — and collapses the search; emptying the field closes the panel and clears the status region — owner: frontend-agent
- [ ] T030 [US2] Run `cd frontend && npx vitest run tests/unit/HeaderSuggestionPanel.test.tsx tests/unit/queries/discogsQueries.test.tsx tests/unit/HeaderSearchBox.test.tsx tests/integration/headerSearchFlow.test.tsx` and `cd e2e && npm test -- tests/header-search.spec.ts` until green. If a local e2e run asserts against stale data, flush the feature's cache prefix first: `redis-cli --scan --pattern 'discogs:suggest:*' | xargs -r redis-cli del` (quickstart §Prerequisites) — owner: qa-agent

**Checkpoint**: US1 and US2 both work. The header proposes matches while typing, at one Discogs request per cache miss.

---

## Phase 5: User Story 3 — Operate the whole search with keyboard or screen reader (Priority: P1)

**Goal**: the repo's first WAI-ARIA 1.2 combobox. DOM focus never leaves the field, arrows move `aria-activedescendant` only, Enter opens the active option or submits the typed query, Escape closes the panel then collapses, every state change is announced politely, and the whole surface passes axe in both themes at both widths.

**Independent Test**: with the pointer unused, Tab to the search, type a query, arrow through the suggestions, confirm one with Enter, reopen and press Escape twice — asserting at each step that `document.activeElement` is still the input, that `aria-expanded` and `aria-activedescendant` match the highlighted option's `aria-selected="true"`, and that the `role="status"` region carries the current result count. Then run the axe matrix over the three states that exist after US2. This is a hardening pass over US1+US2's surfaces, not a standalone screen.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [ ] T031 [P] [US3] Extend frontend/tests/unit/HeaderSearchBox.test.tsx with failing tests for contracts/header-search-ui.md §4 and §5 (FR-021–FR-024, assumption 5): the input carries `role="combobox"`, `aria-expanded`, `aria-controls="header-search-listbox"`, `aria-autocomplete="list"` and a persistent accessible name "Search Discogs" via the existing `Input label` + `hideLabel`; `ArrowDown`/`ArrowUp` move `aria-activedescendant` only and `document.activeElement` stays the input at **every** step; arrowing past the last option, or before the first, returns to **no active option** rather than wrapping; `Enter` with an active option opens it and `Enter` with none submits the typed query; `Escape` with the panel open closes the panel and keeps the text and the focus in the field, and a second `Escape` collapses and returns focus to the opener; the announcement region is one `<p role="status" class="sr-only">` carrying exactly "Searching…", "N suggestions available." / "1 suggestion available.", and nothing at all on activation with a pre-filled query — owner: frontend-agent
- [ ] T032 [P] [US3] Extend frontend/tests/unit/HeaderSuggestionPanel.test.tsx with failing tests for contracts/header-search-ui.md §3 (FR-022, FR-024): each row is `<li role="option" id="header-search-option-{index}">` whose accessible name is "<title>, <secondary detail>, Artist|Album"; `aria-selected="true"` is on the active option only and on at most one row; the `<ul role="listbox" id="header-search-listbox">` is present whenever the panel is displayed so `aria-controls` never dangles; the skeleton rows expose 0 options — owner: frontend-agent
- [ ] T033 [P] [US3] Create e2e/tests/header-search-a11y.spec.ts with failing scenarios (assumption 6; SC-006, SC-007, FR-025), reusing the suggest fixture from T020: scenario "keyboard-only" (SC-006, clarification 5): at 375×812 and 1440×900 with no pointer, Tab to the search, type, `ArrowDown` through the list, `Enter`, then reopen and `Escape` twice — after **every** state change assert the `role="status"` text against contracts/header-search-ui.md §5 and assert `aria-expanded`, `aria-activedescendant` and the matching `aria-selected="true"` option, with `expectVisibleFocusRing` from e2e/helpers/focusRing.ts in both themes and no keyboard trap at either width; scenario "axe" (SC-007): `runAxeScan` from e2e/helpers/axe.ts reports **0** WCAG 2.1 AA violations in light and dark, at 375 px and 1440 px, in the `idle`, `loading` and `suggestions` states (the `empty` and `error` states are added by US4's T041); scenario "contrast" (FR-025): e2e/helpers/contrast.ts checks the two pairings of contracts/header-search-ui.md §8 — field text over the expanded field above the backdrop at 4.5:1, and the field and panel borders against the scrim at 3:1 — in both themes — owner: qa-agent
- [ ] T034 [P] [US3] Extend e2e/tests/dark-mode-contrast.spec.ts with a failing header-search case (FR-025, SC-007): the suggestion panel's `loading` and `suggestions` states in dark mode, asserting the row text, the secondary detail and the kind label against their floors with e2e/helpers/contrast.ts — owner: qa-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 3

- [ ] T035 [US3] Add the combobox interaction model to frontend/src/components/HeaderSearchBox.tsx to make T031 and T033 pass (research D11; contracts/header-search-ui.md §3–§5; assumption 5): `role="combobox"`, `aria-expanded`, `aria-controls="header-search-listbox"`, `aria-autocomplete="list"` and `aria-activedescendant` on the existing `<input type="search">`; an `activeIndex: number | null` moved by `ArrowDown`/`ArrowUp` with **no wrap** — past either end returns to `null` so `Enter` can always submit; `Enter` opens the active option or submits; `Escape` closes the panel first and collapses on the second press; one `<p role="status" class="sr-only">` inside the container set to exactly one string per state change and cleared on collapse or on the field emptying. Arrow keys must never move DOM focus — owner: frontend-agent
- [ ] T036 [US3] Add the listbox semantics to frontend/src/components/HeaderSuggestionPanel.tsx to make T032 and T034 pass (contracts/header-search-ui.md §3): `role="option"` and `id="header-search-option-{index}"` per row, `aria-selected="true"` on the active row only, the accessible name ending in the text kind label, and the `<ul role="listbox" id="header-search-listbox" aria-label="Search suggestions">` always rendered while the panel is displayed — owner: frontend-agent
- [ ] T037 [US3] Run `cd frontend && npx vitest run tests/unit/HeaderSearchBox.test.tsx tests/unit/HeaderSuggestionPanel.test.tsx` and `cd e2e && npm test -- tests/header-search-a11y.spec.ts tests/dark-mode-contrast.spec.ts` until green — owner: qa-agent

**Checkpoint**: US1–US3 work. The whole flow is keyboard- and screen-reader-operable and passes axe in three states.

---

## Phase 6: User Story 4 — Understand when there is nothing to show or something went wrong (Priority: P2)

**Goal**: a 2+ character query with zero matches shows an accessible empty state naming the searched text; a failed lookup shows a non-intrusive, replace-not-stack error with a working Retry; and neither ever blocks submitting the typed query.

**Independent Test**: with the empty fixture, type a query that matches nothing and confirm the empty state names the text and is announced politely; switch to the `502` fixture and confirm an error message with a Retry button that returns the panel to loading, while submitting the typed query still reaches `/app/search` every time. Both states are testable against US2's panel without touching US3's keyboard model.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T038 [P] [US4] Extend frontend/tests/unit/HeaderSuggestionPanel.test.tsx with failing tests for the `empty` and `error` states of data-model.md §5 (FR-018, FR-019, SC-008): `empty` renders a `<p>` **outside** the listbox naming the searched text and suggesting how to broaden the search; `error` renders a `<p>` plus a `<button>` "Retry" outside the listbox and is **not** `role="alert"` (FR-023 requires a polite announcement); both states report the **same panel height** as the loading and loaded states; consecutive errors replace rather than stack the message — owner: frontend-agent
- [ ] T039 [P] [US4] Extend frontend/tests/integration/headerSearchFlow.test.tsx with failing flow tests (FR-019, FR-020, FR-023, SC-009): a rejected lookup shows the error state and announces "Suggestions are unavailable. Retry is available."; activating "Retry" calls `refetch()` for the **same** query and returns the panel to the loading state; a zero-result response announces "No suggestions for “<typed text>”."; with the lookup failing, submitting the typed query still calls `navigate(buildSearchPath(...))` and reaches `/app/search`; a session-expired rejection is handled by the app's existing sign-in path and does **not** render the `error` state (spec edge case) — owner: frontend-agent
- [ ] T040 [P] [US4] Extend e2e/tests/header-search.spec.ts with failing scenarios using the empty and `502` fixtures from T020 (FR-018, FR-019, SC-009): the empty fixture shows the empty state naming the query; the `502` fixture shows the error with a Retry button, Retry re-issues exactly one `/api/discogs/suggest` request for the same `q`, and submitting the typed query reaches `/app/search?q=…` on 100 % of attempts across repeated runs — owner: qa-agent
- [ ] T041 [P] [US4] Extend e2e/tests/header-search-a11y.spec.ts with the two remaining states so the SC-007 matrix is complete (assumption 6): `runAxeScan` reports 0 WCAG 2.1 AA violations for the `empty` and `error` states in light and dark at 375 px and 1440 px, the status region carries the empty and error strings of contracts/header-search-ui.md §5, and the "Retry" button is reachable by `Tab` from the field and is ≥ 44×44 — owner: qa-agent

Red tests reviewed/approved before Implementation.

### Implementation for User Story 4

- [ ] T042 [US4] Add the `empty` and `error` states to frontend/src/components/HeaderSuggestionPanel.tsx to make T038 pass (FR-018, FR-019; contracts/header-search-ui.md §3): both rendered **outside** the listbox inside the same `<Card>`; the empty text names the searched string and suggests broadening it; the error text is accompanied by a `min-h-11 min-w-11` "Retry" `<button>` calling an `onRetry` prop; neither uses `role="alert"`; both keep the panel's width and height — owner: frontend-agent
- [ ] T043 [US4] Wire the two states into frontend/src/components/HeaderSearchBox.tsx to make T039, T040 and T041 pass (FR-019, FR-020, FR-023): pass `onRetry={refetch}` from `useCatalogSuggestions`; set the status region to "No suggestions for “<typed text>”." and "Suggestions are unavailable. Retry is available." per contracts/header-search-ui.md §5, replacing rather than stacking; leave the submit path reachable in every state so a failing lookup never blocks it — owner: frontend-agent
- [ ] T044 [US4] Run `cd frontend && npx vitest run tests/unit/HeaderSuggestionPanel.test.tsx tests/integration/headerSearchFlow.test.tsx` and `cd e2e && npm test -- tests/header-search.spec.ts tests/header-search-a11y.spec.ts` until green — owner: qa-agent

**Checkpoint**: all four stories pass their independent tests. The SC-007 axe matrix now covers all five panel states.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: full gates, the checks the tooling cannot emulate, and release hygiene.

- [ ] T045 Run the full backend suite and build `cd backend && npm test && npm run lint && npm run build` and fix regressions. This is the only full Jest run for this feature — nothing here touches Firestore, so the emulator is only needed by the suites that already required it — owner: backend-agent
- [ ] T046 [P] Run the full frontend gates `cd frontend && npm test && npm run lint && npm run build` (tsc -b + vite build) and fix regressions, including the results screen (`searchResultsFlow`) and the header's other cells (`AppHeader`), which are this feature's regression guards — owner: frontend-agent
- [ ] T047 Run the full e2e suite `cd e2e && npm test` on chromium + webkit. Flush the dev cache prefix first if a local run asserts against stale catalog data: `redis-cli --scan --pattern 'discogs:suggest:*' | xargs -r redis-cli del`; CI is unaffected — owner: qa-agent
- [ ] T048 [P] Do the manual checks of quickstart.md §4 and record the results in the PR description (clarification 5 — recommended, not a merge gate): a VoiceOver or NVDA pass over open → type "iron" → arrow → choose → Escape, confirming the count, empty and error states are spoken politely without cutting off typing; suggestions work without a linked Discogs account; repeating a query typed a minute ago fills with no visible delay and no new upstream call in the backend log; macOS "Reduce transparency" and "Increase contrast" turn the backdrop near-solid; resizing across 640 px with the search open re-lays out without losing the typed text — owner: qa-agent
- [ ] T049 [P] Audit the TDD trail and the `ponytail:` markers: for every story the Tests block was seen failing **and approved** before any Implementation commit (Principle I); the two markers exist — D13 in frontend/src/components/HeaderSearchBox.tsx and D5 in backend/src/application/discogsCatalog/suggestCatalogMatches.ts; `grep -rn "searchCatalogWithRatings" backend/src/application/discogsCatalog/suggestCatalogMatches.ts backend/src/adapters/discogsCatalog/discogsRoutes.ts` shows the suggest path never reaches it; `grep -rn "aria-modal\|role=\"dialog\"\|useFocusTrap" frontend/src/components/HeaderSearchBox.tsx frontend/src/components/HeaderSuggestionPanel.tsx` returns nothing (clarification 3) — owner: qa-agent
- [ ] T050 Release hygiene (Principle VI, Development Workflow): do NOT hand-edit `version` in backend/package.json or frontend/package.json, or either CHANGELOG. Use Conventional Commits `feat(069): …` so CI derives a **MINOR** bump. The PR description must state the new `GET /api/discogs/suggest` endpoint and the additive `resultType: 'any'` on the internal `DiscogsCatalogPort` (contracts/suggest-api.md §5), that `/api/discogs/search` and its response are byte-for-byte unchanged, that no stored data changes so no migration is required, and the six assumptions above with the task that owns each — owner: qa-agent

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: none.
- **Foundational (T003)**: after Setup. Blocks US2's backend lane (T012–T015, T021–T025) and the frontend wire type (T026). Does **not** block US1.
- **US1 (T004–T011)**: after Setup. Independent of Foundational and of the backend entirely.
- **US2 (T012–T030)**: backend lane after T003; frontend lane after **US1's T010**, because US2's panel mounts inside the expanded container US1 creates and both edit `HeaderSearchBox.tsx`. The two lanes are otherwise parallel — the frontend works against contracts/suggest-api.md and the `page.route` fixture, not against a running endpoint (plan "Implementation notes for agents").
- **US3 (T031–T037)**: its Tests block may be written after US2's tests are approved; its Implementation needs US2's T028–T029 (same two components).
- **US4 (T038–T044)**: needs US2's T027–T029 (the query's error/empty results and the panel). Independent of US3 — T041 extends US3's a11y spec file and therefore runs after T033.
- **Polish (T045–T050)**: after all four stories.

### Story completion order

`US1 → US2 → US3 → US4`. US1 is shippable alone; US2 adds the capability; US3 is the Principle X merge gate over US1+US2's surfaces; US4 completes the five-state matrix. **US3 must be complete before merge to `main`** (Principle X is a hard gate), so if the stories ship in separate PRs, the redesigned UI must not merge without it.

### Within each story

Tests block → seen failing → **"Red tests reviewed/approved before Implementation"** → Implementation → targeted run task (T011, T030, T037, T044).

- Backend US2: T021 (domain) → T022 (port + adapter) → T023 (use case) → T024 (route) → T025 (targeted run).
- Frontend US2: T026 → T027 → T029; T028 is parallel to T026/T027; then T030.
- US1: T009 → T010 → T011.
- US3: T035 and T036 are parallel; T037 closes.
- US4: T042 → T043 → T044.

### Agent hand-offs

- **backend-agent** owns T003, T012–T015, T021–T025, T045.
- **frontend-agent** owns T005, T006, T009, T010, T016–T019, T026–T029, T031, T032, T035, T036, T038, T039, T042, T043, T046.
- **qa-agent** owns T001, T002, T004, T007, T008, T011, T020, T030, T033, T034, T037, T040, T041, T044, T047–T050.
- **docs-agent**: no task. `docs/` holds end-user guides for features with their own screens; this feature adds no screen, and neither the spec nor the ticket asks for a doc. Add one if collectors ask what the panel is.

---

## Parallel execution examples

### User Story 1

```text
# All five US1 test tasks together (different files):
T004 e2e/tests/header-search.spec.ts
T005 frontend/tests/unit/HeaderSearchBox.test.tsx
T006 frontend/tests/unit/AppHeader.test.tsx
T007 e2e/tests/header-responsive-nav.spec.ts
T008 e2e/tests/reduced-motion.spec.ts
# Approval gate, then T009 → T010 (same lane, AppHeader before the box); T011 closes.
```

### User Story 2

```text
# Backend tests ∥ frontend tests ∥ e2e (nine files, all independent):
T012 suggestionQuota.test.ts ∥ T013 suggestCatalogMatches.test.ts ∥ T014 discogsClient.contract.test.ts ∥ T015 suggest.contract.test.ts
T016 HeaderSuggestionPanel.test.tsx ∥ T017 discogsQueries.test.tsx ∥ T018 HeaderSearchBox.test.tsx ∥ T019 headerSearchFlow.test.tsx
T020 header-search.spec.ts
# Approval gate. Two implementation lanes in parallel:
#   backend-agent: T021 → T022 → T023 → T024 → T025
#   frontend-agent: (T026 → T027) ∥ T028, then T029
# T030 closes both.
```

### User Story 3

```text
T031 HeaderSearchBox.test.tsx ∥ T032 HeaderSuggestionPanel.test.tsx ∥ T033 header-search-a11y.spec.ts ∥ T034 dark-mode-contrast.spec.ts
# Approval gate. T035 ∥ T036 (different components); T037 closes.
```

### User Story 4

```text
T038 HeaderSuggestionPanel.test.tsx ∥ T039 headerSearchFlow.test.tsx ∥ T040 header-search.spec.ts ∥ T041 header-search-a11y.spec.ts
# Approval gate. T042 → T043 (panel before its wiring); T044 closes.
```

### Polish

```text
T046 frontend gates ∥ T048 manual checks ∥ T049 TDD/marker audit, alongside T045 then T047.
```

---

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup, then Phase 2 Foundational (one task).
2. Phase 3 US1: expandable header search, blurred non-modal backdrop, auto-focus, phone overlay behind a 44×44 icon button, all collapse paths, reduced motion, submit path untouched.
3. **Stop and validate**: T011. This is shippable on its own — the complaint US1 opens with (a cramped field at phone width, no sense of entering a search mode) is fixed, and no backend change has been deployed.

### Incremental delivery

1. **US1 — MVP**: a comfortable search entry point at every width. Demo: activate from three screens at 375 px and 1440 px; submit reaches the results screen with filters preserved.
2. **US2**: instant suggestions. Demo: type "iron", get 2 artists + 3 albums, click one and land on the record; show the backend log proving one upstream call per cache miss and none on a repeat.
3. **US3**: the keyboard and screen-reader pass. Demo: the whole flow with no pointer, plus a green axe matrix in both themes at both widths.
4. **US4**: empty and error states. Demo: a zero-match query, a forced `502` with a working Retry, and the typed query still reaching `/app/search`.
5. **Polish**: full gates, the manual screen-reader and system-preference checks, release notes.

Every increment keeps the existing tests green; `/api/discogs/search` and the results screen are untouched throughout (spec Out of scope: `VINYLMANIA-7`, `-8`, `-9`).

### Parallel team strategy

After Foundational, the backend-agent runs US2's backend lane (T012–T015, T021–T025) against contracts/suggest-api.md while the frontend-agent lands US1 (T005, T006, T009, T010) and the qa-agent writes T004, T007, T008 and, later, T020. The two lanes only meet at T030.

---

## Notes

- `[P]` = different files and no dependency on an incomplete task. `[US#]` appears only in Phases 3–6.
- Commit after each task or logical group with Conventional Commits (`test(069): …` for the red tests, then `feat(069): …`). The approval of each red-test commit is what T049 audits.
- **Deviation from plan.md's file map**, both driven by what is actually on disk or by assumption 6: the `resultType: 'any'` adapter tests go into the existing `backend/tests/contract/discogsCatalog/discogsClient.contract.test.ts`, which already owns the `searchCatalog` contract, rather than into a `backend/tests/unit/discogsCatalog/adapters/discogsCatalogAdapter.test.ts` that does not exist; and the e2e a11y + contrast matrix lives in its own `e2e/tests/header-search-a11y.spec.ts`.
- Never run the full backend Jest suite during story work — use the targeted paths in T025. The full run is T045.
- Local e2e uses the dev Redis from `backend/.env`; flush `discogs:suggest:*` before a local suggestion run (T030, T047).
