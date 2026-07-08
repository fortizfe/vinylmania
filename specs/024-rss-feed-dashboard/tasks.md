---

description: "Task list for Music News Dashboard (RSS Feed Hub MVP)"

---

# Tasks: Music News Dashboard (RSS Feed Hub MVP)

**Input**: Design documents from `/specs/024-rss-feed-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/feeds-dashboard.md](./contracts/feeds-dashboard.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — this project's constitution (Principle I, Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change; the Constitution Check in plan.md reaffirms this for this feature.

**Organization**: Tasks are grouped by user story (P1/P2/P3 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Web app split (existing repo structure): `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and extend shared logging vocabulary — no feature code yet.

- [X] T001 Add `rss-parser` to `backend/package.json` dependencies and run `npm install` in `backend/` (research.md §1)
- [X] T002 [P] Extend the `LogOutcome` union in `backend/src/config/logger.ts` with `'feed_fetch_failed'` and `'feed_unavailable'` (research.md §6)

**Checkpoint**: Dependency installed, logging vocabulary ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, static feed-source config, and route plumbing that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create shared types `FeedSource`, `Article`, `SourceStatus`, `DashboardResponse` in `backend/src/feeds/types.ts` per data-model.md
- [X] T004 [P] Create static feed source config in `backend/src/feeds/feedSources.ts`: Metal Injection entry (`enabled: true`, category `"News"`) and Metal Storm entries (attempt to enumerate its sub-feeds per research.md §3's follow-up; ship with `enabled: false` stubs if `https://metalstorm.net/home/rss.php` is still Cloudflare-blocked at implementation time) — parallel with T005 once T003 is complete
- [X] T005 [P] Create `backend/src/routes/feeds.ts` exporting an Express `Router` mounted at `/api/feeds` in `backend/src/app.ts`, with `requireAuth` applied to its routes (matching `library.ts`'s pattern); leave the `GET /dashboard` handler body for Phase 3 (US1) to implement — parallel with T004 once T003 is complete

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse the latest heavy metal news in one place (Priority: P1) 🎯 MVP

**Goal**: A logged-in user opens `/app` and sees a single aggregated, click-through list of recent articles from Metal Injection (and Metal Storm when reachable), with graceful per-source degradation.

**Independent Test**: Navigate to `/app` and confirm articles appear with title, source name, publish date, and a working link to the original article; simulate one source failing and confirm the rest of the content and a non-blocking notice still render.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T006 [P] [US1] Unit test in `backend/tests/unit/feedMapper.test.ts`: maps a raw RSS item to an `Article` (plain-text title/excerpt, ISO `publishedAt`, `link`, extracted `imageUrl` from `enclosure`/`media:content`/first `<img>`), drops items missing `title` or `link`, and — using a fixture item containing a `<script>` tag, an `onerror=` attribute, and a `javascript:` image URI — asserts the mapped `Article` contains no tags/executable markup in `title`/`excerpt` and never accepts an unsafe image URL scheme (FR-008)
- [X] T007 [P] [US1] Unit test in `backend/tests/unit/feedClient.test.ts`: fetches and parses a feed URL via `nock`-mocked HTTP within an 8s timeout, and rejects/times out cleanly on a slow or erroring response
- [X] T008 [P] [US1] Unit test in `backend/tests/unit/feedAggregator.test.ts`: fans out across multiple configured sources with `Promise.allSettled`, isolates one failing source into `sourceStatuses` (`status: 'unavailable'`) without discarding the others' articles
- [X] T009 [P] [US1] Contract test in `backend/tests/contract/feedsDashboard.contract.test.ts`: `GET /api/feeds/dashboard` returns 200 with the shape from contracts/feeds-dashboard.md (`categories[].articles[]` with `title`/`sourceName`/`publishedAt`/`link`, plus `sourceStatuses[]`), and 401 without a bearer token
- [X] T010 [P] [US1] Integration test in `backend/tests/integration/feedsDashboard.integration.test.ts`: (a) `nock`-mock Metal Injection as healthy and Metal Storm as returning Cloudflare's 403 challenge; assert the response is still 200, contains Metal Injection's articles, and marks Metal Storm `'unavailable'`; (b) `nock`-mock every configured source as failing and assert the response is still 200 with `categories: []` and every `sourceStatuses` entry `'unavailable'` (FR-011)
- [X] T011 [P] [US1] Integration test in `frontend/tests/integration/DashboardPage.test.tsx`: renders a loading state, then a populated article list (title/source/date, clickable link opening in a new tab), then a non-blocking banner when a source is marked unavailable in the mocked response, and a graceful empty state when the mocked response has zero categories and every source unavailable (FR-011)

### Implementation for User Story 1

- [X] T012 [US1] Implement `backend/src/feeds/feedClient.ts`: axios GET with an 8s timeout, parses the response body with `rss-parser` (depends on T003)
- [X] T013 [US1] Implement `backend/src/feeds/feedMapper.ts`: raw feed item → `Article`, stripping HTML to a plain-text excerpt (truncated) and extracting one `imageUrl`, dropping items without `title`/`link` (depends on T003)
- [X] T014 [US1] Implement `backend/src/feeds/feedAggregator.ts`: for each enabled `FeedSource`, cache-aside (`withCache`, 20 min TTL) the fetch+parse+map pipeline; fan out with `Promise.allSettled`; for US1 scope, return one flat, date-sorted `Article[]` plus `sourceStatuses[]` (category grouping/cap arrives in US2) (depends on T004, T012, T013)
- [X] T015 [US1] Implement the `GET /dashboard` handler in `backend/src/routes/feeds.ts` calling `feedAggregator`, logging `success`/`feed_unavailable`/`feed_fetch_failed` outcomes per source (depends on T005, T014)
- [X] T016 [P] [US1] Implement `frontend/src/services/feedsApi.ts`: `authorizedFetch`-based call to `GET /api/feeds/dashboard`
- [X] T017 [P] [US1] Implement `frontend/src/queries/feedsQueries.ts`: `useDashboardFeeds()` TanStack Query hook (depends on T016)
- [X] T018 [US1] Implement `frontend/src/components/FeedArticleCard.tsx` (title, source name, publish date, a small category label/badge per FR-002, and a link opening the original article in a new tab — `target="_blank" rel="noopener noreferrer"`) and `frontend/src/components/FeedArticleCardSkeleton.tsx` (loading placeholder matching the card's layout, per plan.md's Project Structure and this repo's existing `*Skeleton.tsx` convention)
- [X] T019 [US1] Implement `frontend/src/components/FeedSourceStatusBanner.tsx`: non-blocking notice listing any `sourceStatuses` entries marked `'unavailable'`
- [X] T020 [US1] Replace the placeholder in `frontend/src/pages/DashboardPage.tsx` with a loading state (rendering several `FeedArticleCardSkeleton` instances), the flattened article list using `FeedArticleCard`, an empty-state message when there are zero articles across all sources (FR-011), and `FeedSourceStatusBanner` (depends on T017, T018, T019)

**Checkpoint**: User Story 1 is fully functional and independently testable — an aggregated, click-through news list with graceful degradation.

---

## Phase 4: User Story 2 - Understand content at a glance through categories and imagery (Priority: P2)

**Goal**: Articles are visually grouped into labeled categories (News, Reviews, Interviews, Tour Dates, …), each capped to a curated top 3-5, with images or a consistent placeholder.

**Independent Test**: Load the Dashboard and confirm articles are grouped under clearly labeled categories, each showing at most 3-5 items, with an image (or placeholder) per article card.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Extend `backend/tests/unit/feedAggregator.test.ts`: groups articles by `category`, sorts each group by `publishedAt` desc, caps each group to the top 3-5, and omits any category with zero articles from the response
- [X] T022 [P] [US2] Component test in `frontend/tests/components/FeedArticleCard.test.tsx`: renders the provided `imageUrl` when present, and a consistent placeholder graphic when `imageUrl` is absent

### Implementation for User Story 2

- [X] T023 [US2] Extend `backend/src/feeds/feedAggregator.ts` to group the flat article list into `categories: { category, articles }[]`, capped and sorted per FR-012, omitting empty categories (depends on T014)
- [X] T024 [P] [US2] Extend `frontend/src/components/FeedArticleCard.tsx` to render a placeholder graphic when `imageUrl` is undefined
- [X] T025 [US2] Implement `frontend/src/components/FeedCategorySection.tsx`: a labeled section wrapping one category's `FeedArticleCard` list (depends on T018)
- [X] T026 [US2] Update `frontend/src/pages/DashboardPage.tsx` to render one `FeedCategorySection` per category from the response instead of a flat list (depends on T023, T025)

**Checkpoint**: User Stories 1 and 2 both work independently — categorized, image-rich magazine-style layout.

---

## Phase 5: User Story 3 - Filter the dashboard down to one category or source (Priority: P3)

**Goal**: A user can narrow the Dashboard to a single category and clear the filter to restore the full view.

**Independent Test**: Select one category filter and confirm only its articles remain visible; clear the filter and confirm the full multi-category view returns.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Component test in `frontend/tests/components/FeedCategoryFilterBar.test.tsx`: selecting a category emits/applies that filter; clearing it restores the "all categories" state

### Implementation for User Story 3

- [X] T028 [US3] Implement `frontend/src/components/FeedCategoryFilterBar.tsx`: client-side category selector (tabs or select) built from the categories present in the loaded response
- [X] T029 [US3] Wire filter state into `frontend/src/pages/DashboardPage.tsx` so only the selected category's `FeedCategorySection` renders (or all, when cleared) (depends on T026, T028)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Run the full `quickstart.md` validation pass (backend curl checks + frontend manual walkthrough) and record any deviations
- [X] T031 [P] Review structured log output for the new `feed_fetch_failed`/`feed_unavailable` outcomes against Principle V's "actionable without a debugger" bar
- [X] T032 Run `backend` and `frontend` full test suites (`npm test` in each) and lint (`npm run lint` in each) to confirm everything is green before merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; extends US1's `feedAggregator`/`DashboardPage` output, so build after US1 for a clean incremental diff (not a hard technical requirement, but avoids rework)
- **User Story 3 (Phase 5)**: Depends on US2's category-grouped rendering existing to filter over
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation begins (Principle I)
- Types/config → client/mapper → aggregator → route → frontend service → query hook → components → page wiring

### Parallel Opportunities

- All Setup tasks marked [P] can run together
- T003-T005 in Foundational: T004 and T005 can run in parallel once T003 lands
- All test tasks within a story marked [P] can run in parallel (different files)
- T016/T017 (frontend service/hook) can proceed in parallel with T012-T015 (backend) once contracts/feeds-dashboard.md's shape is agreed (it already is, from Phase 1 planning)

---

## Parallel Example: User Story 1

```bash
# Tests first, all in parallel (different files):
Task: "Unit test in backend/tests/unit/feedMapper.test.ts"
Task: "Unit test in backend/tests/unit/feedClient.test.ts"
Task: "Unit test in backend/tests/unit/feedAggregator.test.ts"
Task: "Contract test in backend/tests/contract/feedsDashboard.contract.test.ts"
Task: "Integration test in backend/tests/integration/feedsDashboard.integration.test.ts"
Task: "Integration test in frontend/tests/integration/DashboardPage.test.tsx"

# Then backend and frontend implementation can proceed on separate tracks:
Task: "Implement backend/src/feeds/feedClient.ts"
Task: "Implement frontend/src/services/feedsApi.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md's backend + frontend checks for US1's acceptance scenarios
5. Deploy/demo the flat aggregated news list — this alone is a usable MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. User Story 1 → validate independently → deploy/demo (MVP)
3. User Story 2 → validate independently → deploy/demo (categorized, image-rich layout)
4. User Story 3 → validate independently → deploy/demo (category filtering)

---

## Notes

- No Firestore schema or migration work — all data is ephemeral (Redis cache-aside), per data-model.md
- Metal Storm's actual reachability at implementation time determines whether T004 ships it `enabled: true` or as a disabled stub — either way, US1-US3 tests must pass using Metal Injection alone plus a mocked Metal Storm (T010), since production reachability is not guaranteed (research.md §3)
- Avoid: rendering any feed-provided HTML directly (research.md §2) — always go through the plain-text excerpt + single extracted image fields
