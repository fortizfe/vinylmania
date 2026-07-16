---

description: "Task list template for feature implementation"
---

# Tasks: Feeds/RSS Domain Migrated to Hexagonal Architecture

**Input**: Design documents from `/specs/049-feeds-hexagonal-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE) applies to
this project. See "Migration Strategy" below for how Test-First applies to a mostly-structural
refactor with one genuine internal-contract change (the feed source port's return type).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story. All paths are relative to the repository root; `backend/` is implied for
every `src/`/`tests/` path below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Migration Strategy (read before starting)

This feature relocates already-tested, already-live production code, following the same
copy-then-cutover pattern the library (046), catalog (047), and OAuth+Collection (048) migrations
validated: `backend/src/feeds/*` and `backend/src/routes/feeds.ts` keep serving all traffic,
completely unmodified, until Phase 5's cutover. Phases 3 and 4 build the new `ports/feeds/`,
`domain/feeds/`, `application/feeds/`, and `adapters/feeds/` files **additively**, alongside the
untouched originals.

Unlike Historia 4 (which genuinely split business logic that hadn't previously been isolated), this
feature is closer to Historia 2/3's shape — a relocation of already-correct logic — with exactly one
genuine internal-contract change: per spec.md's Clarifications session and research.md Decision 1,
`FeedSourcePort.fetchFeed` returns a new domain-owned `RawFeedItem[]`, not `rss-parser`'s own
`Parser.Output`/`Parser.Item` types. This changes two things beyond a pure file move: (a)
`feedMapper.mapFeedItem`'s parameter type and its one `item.enclosure?.url` read (becomes
`item.enclosureUrl`), and (b) `feedClient.test.ts`'s return-shape assertions (`feed.items[0]` →
`feed[0]`). Every other file in this domain (`feedSources.ts`, the aggregation rules themselves, all
six contract/integration tests) relocates with no behavioral change, only import-path fixes.

Per research.md Decision 2, `getDashboard` and `getSourceArticles` stay in one combined
`application/feeds/getFeedsDashboard.ts` factory rather than the one-factory-per-file split Historia
4 used — they already share one private helper (`fetchSourceArticles`) today, and splitting them
would duplicate it rather than reuse it.

## Phase 1: Setup

**Purpose**: Establish a pre-migration baseline to measure "no regression" against.

- [X] T001 Run
  `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/feeds"` and confirm
  all 10 files named in the parent user story's "Prueba independiente" pass today. This is the
  baseline spec.md FR-008/SC-001 must not regress. **Note**: pre-migration files are flat (not yet
  under a `feeds/` subfolder), so the literal pattern above only matches 7/10 files case-insensitively;
  confirmed the true baseline with
  `--testPathPattern="tests/(unit|integration|contract)/(feedAggregator|feedClient|feedMapper|feedSources|feedsDashboard|feedsSource)"`
  — 10 suites / 50 tests passed.
- [X] T002 Run `grep -rn "jest.mock(" backend/tests/unit/feedAggregator.test.ts
  backend/tests/unit/feedClient.test.ts backend/tests/unit/feedMapper.test.ts
  backend/tests/unit/feedSources.test.ts backend/tests/contract/feedsDashboard.contract.test.ts
  backend/tests/contract/feedsSource.contract.test.ts
  backend/tests/integration/feedsDashboard.integration.test.ts
  backend/tests/integration/feedsDashboardExpandedSources.integration.test.ts
  backend/tests/integration/feedsDashboardNewSources.integration.test.ts
  backend/tests/integration/feedsSourceDirect.integration.test.ts` and confirm the known set of
  path-sensitive mocks: `feedAggregator.test.ts` mocks both `feeds/feedSources` and `feeds/feedClient`
  by path (this file is rewritten in Phase 3, not just path-fixed — see T007);
  `feedsDashboard.contract.test.ts`, `feedsSource.contract.test.ts`,
  `feedsDashboard.integration.test.ts`, and `feedsDashboardNewSources.integration.test.ts` each mock
  only `feeds/feedSources` by path (path-fixed in Phase 5, T013/T014/T015/T017);
  `feedsSourceDirect.integration.test.ts` mocks `feeds/feedSources` (path-fixed, T018) plus `ioredis`
  (unrelated to this migration, left untouched); `feedMapper.test.ts`, `feedSources.test.ts`, and
  `feedsDashboardExpandedSources.integration.test.ts` have zero `jest.mock()` calls (pure
  relocation+import-path fixes only) — spec.md's Edge Case "How does this migration confirm no
  existing test relies on a `jest.mock()` call keyed to a module's current file path?". This task
  makes that check explicit and re-runnable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the domain types and the port interface both User Story 1 and User Story 2
depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/src/domain/feeds/types.ts` — copy `FeedSourceConfig`, `Article`,
  `SourceStatus`, `CategoryGroup`, `DashboardResponse`, `SourceFeedResponse` unchanged from
  `backend/src/feeds/types.ts`, **plus** add the new `RawFeedItem` interface (research.md Decision 1):
  `{ title?: string; link?: string; guid?: string; isoDate?: string; pubDate?: string; content?:
  string; contentSnippet?: string; summary?: string; enclosureUrl?: string }`. Leave the original file
  in place (still imported by `feeds/feedMapper.ts`, `feeds/feedAggregator.ts`, `feeds/feedClient.ts`,
  `feeds/feedSources.ts`) until Phase 5 deletes it.
- [X] T004 [P] Define `backend/src/ports/feeds/feedSourcePort.ts` per `contracts/feed-source-port.md`
  (interface only): `FeedSourcePort { fetchFeed(feedUrl: string, timeoutMs?: number):
  Promise<RawFeedItem[]> }`, importing `RawFeedItem` from `../../domain/feeds/types`.

**Checkpoint**: `domain/feeds/types.ts` (with `RawFeedItem`) and `ports/feeds/feedSourcePort.ts`
exist. `feeds/*` and `routes/feeds.ts` still exist, unmodified, still serving production traffic.

---

## Phase 3: User Story 1 - Dashboard aggregation rules isolated behind a feed source port (Priority: P1)

**Goal**: `getDashboard` and `getSourceArticles` — one combined application-layer use case — depend
only on `FeedSourcePort` and the shared `CachePort`, preserving every existing rule (per-source
fan-out via `Promise.allSettled`, per-source failure isolation, category grouping, the per-category
cap, the single-source lookup's not-found/unavailable shapes) exactly.

**Independent Test**: Run `getDashboard`/`getSourceArticles` against a fake `FeedSourcePort` and a
fake `CachePort`, confirming category grouping, the per-category cap, and per-source degradation are
each exercised without a real network call or real cache instance (spec.md US1). Depends on Phase 2
only — does not need Phase 4's real adapter to exist.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T005 [P] [US1] Copy `backend/tests/unit/feedMapper.test.ts` to
  `backend/tests/unit/feeds/domain/feedMapper.test.ts`, updating its imports (`mapFeedItem` from
  `../../../src/domain/feeds/feedMapper`, `FeedSourceConfig` from `../../../src/domain/feeds/types`)
  and its one `enclosure: { url: '...' }` fixture (the `'prefers enclosure.url over an inline <img>'`
  case) to the flat `enclosureUrl: 'https://cdn.example.com/enclosure.jpg'` shape `RawFeedItem` uses —
  every other fixture and assertion is unchanged (they already use plain field names that match
  `RawFeedItem` structurally). Run the new copy and confirm it fails (module not found). Leave the
  original file in place until Phase 5 deletes it.
- [X] T006 [P] [US1] Copy `backend/tests/unit/feedSources.test.ts` to
  `backend/tests/unit/feeds/domain/feedSources.test.ts`, updating its import from
  `../../src/feeds/feedSources` to `../../../src/domain/feeds/feedSources`. Run the new copy and
  confirm it fails (module not found). Leave the original file in place until Phase 5 deletes it.
- [X] T007 [P] [US1] Write `backend/tests/unit/feeds/application/getFeedsDashboard.test.ts` — new
  test file, rewritten from `backend/tests/unit/feedAggregator.test.ts`'s scenarios against a
  hand-built fake `FeedSourcePort` (`fetchFeed: jest.fn()`) and a fake `CachePort` (mirroring
  `searchCatalogWithRatings.test.ts`'s `fakeCache()` pattern — `withCache` as a passthrough calling
  `fetcher()` directly) instead of `jest.mock('feeds/feedSources')`/`jest.mock('feeds/feedClient')`;
  pass a literal `FeedSourceConfig[]` fixture directly into the use case factory's test setup instead
  of module-mocking `FEED_SOURCES`. Cover the same behaviors as today's suite: fan-out across every
  enabled source merging articles and marking each `'ok'`; one failing source isolated into
  `sourceStatuses` as `'unavailable'` without discarding the healthy source's articles; category
  grouping and the per-category cap; `getSourceArticles` returning `null` for an unknown/disabled id,
  `'ok'` with sorted uncapped articles on success, `'unavailable'` with an empty array on failure. Run
  it and confirm it fails (module not found).

### Implementation for User Story 1

- [X] T008 [US1] Create `backend/src/domain/feeds/feedMapper.ts` — relocate `mapFeedItem` unchanged
  from `backend/src/feeds/feedMapper.ts` except its parameter type
  (`item: Parser.Item` → `item: RawFeedItem`, importing `RawFeedItem`/`Article`/`FeedSourceConfig`
  from `./types` instead of `rss-parser`) and `extractImageUrl`'s enclosure read
  (`item.enclosure?.url` → `item.enclosureUrl`) — every other function (`decodeEntities`, `stripHtml`,
  `cleanText`, `truncate`, `resolvePublishedAt`) and the sanitization/truncation rules themselves are
  byte-for-byte unchanged. Run T005 and confirm it now passes.
- [X] T009 [P] [US1] Create `backend/src/domain/feeds/feedSources.ts` — relocate `FEED_SOURCES`
  unchanged from `backend/src/feeds/feedSources.ts` (research.md Decision 3 — no port needed). Run
  T006 and confirm it now passes.
- [X] T010 [US1] Implement `backend/src/application/feeds/getFeedsDashboard.ts` — factory
  `createFeedsAggregationUseCase(deps: { feedSource: FeedSourcePort; cache: CachePort })` returning
  `{ getDashboard, getSourceArticles }` (research.md Decision 2). Relocate unchanged from
  `feeds/feedAggregator.ts`: the constants `CACHE_TTL_SECONDS = 20 * 60` and
  `ARTICLES_PER_CATEGORY = 10`; the private `fetchSourceArticles(source)` helper (now calling
  `deps.cache.withCache(\`feeds:${source.id}\`, CACHE_TTL_SECONDS, async () => { const items = await
  deps.feedSource.fetchFeed(source.feedUrl); return items.map(item => mapFeedItem(item,
  source)).filter((a): a is Article => a !== undefined); })`, importing `mapFeedItem` from
  `../../domain/feeds/feedMapper`); the private `groupByCategory(articles)` helper (unchanged
  Map-based grouping, sort by `publishedAt` descending, slice to `ARTICLES_PER_CATEGORY`); `getDashboard()`
  (filters `FEED_SOURCES` — imported from `../../domain/feeds/feedSources` — to `enabled`,
  `Promise.allSettled` over `fetchSourceArticles`, builds `sourceStatuses` with `'ok'`/`'unavailable'`,
  preserves the exact `logger.warn({ route: 'feeds:aggregator', outcome: 'feed_unavailable', meta: {
  sourceId }, message })` call on a rejection, returns `{ categories: groupByCategory(allArticles),
  sourceStatuses, generatedAt: new Date().toISOString() }`); `getSourceArticles(sourceId)` (looks up
  an enabled source by id, returns `null` on no match, calls `fetchSourceArticles` and returns `{
  sourceId, sourceName, status: 'ok', articles: <sorted, uncapped>, generatedAt }` on success or `{
  sourceId, sourceName, status: 'unavailable', articles: [], generatedAt }` on a caught failure,
  logging via the same `logger.warn` shape as `getDashboard`). Run T007 and confirm it now passes.

**Checkpoint**: `FeedSourcePort`-dependent aggregation logic exists and is proven against a fake port
and a fake cache (T007), and the relocated `feedMapper`/`feedSources` domain files are proven (T005,
T006). Nothing is wired into production routes yet — `feeds/feedAggregator.ts` and `routes/feeds.ts`
are unaffected.

---

## Phase 4: User Story 2 - Raw feed retrieval isolated behind an adapter (Priority: P1)

**Goal**: `feeds/feedClient.ts`'s HTTP fetch + RSS/Atom parsing becomes
`adapters/feeds/feedSourceAdapter.ts`, implementing `FeedSourcePort` and translating each parsed
`rss-parser` item into a domain-owned `RawFeedItem` at the boundary (research.md Decision 1), with
its per-call timeout behavior preserved exactly.

**Independent Test**: Stub the outbound HTTP call (`nock`) the adapter depends on and confirm it
parses RSS/Atom items into `RawFeedItem[]` correctly and enforces its timeout (spec.md US2). Depends
on Phase 2 only (`ports/feeds/feedSourcePort.ts`, T004) — independent of Phase 3.

### Tests for User Story 2 ⚠️ (write first, confirm it fails)

- [X] T011 [US2] Copy `backend/tests/unit/feedClient.test.ts` to
  `backend/tests/unit/feeds/adapters/feedSourceAdapter.test.ts`, updating its import
  (`fetchFeed` from `../../../src/adapters/feeds/feedSourceAdapter`) and its return-shape assertions
  in the first test case (`expect(feed.items).toHaveLength(1)` → `expect(feed).toHaveLength(1)`;
  `expect(feed.items[0].title)`/`expect(feed.items[0].link)` → `expect(feed[0].title)`/
  `expect(feed[0].link)`) — since the port returns `RawFeedItem[]` directly instead of `rss-parser`'s
  `{ items: [...] }` wrapper (spec.md FR-012). The other three test cases (server error, timeout,
  network error — all asserting a rejection) are unchanged. Run the new copy and confirm it fails
  (module not found). Leave the original file in place until Phase 5 deletes it.

### Implementation for User Story 2

- [X] T012 [US2] Implement `backend/src/adapters/feeds/feedSourceAdapter.ts` — implements
  `FeedSourcePort`. Relocate from `feeds/feedClient.ts` unchanged: `DEFAULT_TIMEOUT_MS = 8_000`, the
  module-level `rss-parser` `Parser` instance, the `axios.get` call with its timeout/`responseType`/
  `User-Agent` header. After `parser.parseString(response.data)`, map each `Parser.Item` in the
  result's `items` array to a `RawFeedItem` (`{ title: item.title, link: item.link, guid: item.guid,
  isoDate: item.isoDate, pubDate: item.pubDate, content: item.content, contentSnippet:
  item.contentSnippet, summary: item.summary, enclosureUrl: item.enclosure?.url }`) and return that
  array — never the raw `Parser.Output`. Export as `fetchFeed` plus
  `export const feedSourceAdapter: FeedSourcePort = { fetchFeed }`. Run T011 and confirm it now
  passes.

**Checkpoint**: `FeedSourcePort` and its adapter exist and are proven against `nock` (T011), returning
`RawFeedItem[]` exactly as `contracts/feed-source-port.md` specifies. `feeds/feedClient.ts` is
unaffected — still serving `feeds/feedAggregator.ts`'s production traffic through its old import
path.

---

## Phase 5: User Story 3 - HTTP layer depends on application-level use cases, not the old module (Priority: P2)

**Goal**: `routes/feeds.ts` becomes a thin driving adapter (one use-case call → existing
200/404/500 response mapping); this is the cutover that retires every pre-migration file in this
domain.

**Independent Test**: Every route handler body is limited to invoking the application use case and
mapping its result/errors to the existing response shapes; the existing feeds unit, contract, and
integration suites pass unchanged against the migrated code (spec.md US3). Depends on Phase 3 AND
Phase 4 — matches spec.md's explicit statement that US3 depends on US1 and US2.

### Tests for User Story 3 ⚠️ (relocate first; they must keep passing throughout this phase)

**Discovered during implementation**: 5 of the 6 relocated tests below (all except
`feedsDashboardExpandedSources.integration.test.ts`, which reads `FEED_SOURCES` directly
rather than `jest.mock`-ing it) `jest.mock()` the feed source catalog to inject fixture
sources. Repointing that mock at the new `domain/feeds/feedSources` path has no effect
on the still-untouched OLD production code (which imports the OLD `feeds/feedSources.ts`)
— so those 5 tests correctly **fail red** immediately after relocation (asserting
fixture sources, but the running app still serves the real catalog), not "still pass" as
originally anticipated. This is expected Test-First behavior, not a relocation defect:
they turn green only after T019/T020 cut production over to the new domain path. Each
task below still records "confirm it fails/still passes" per its own actual mock usage.
All six also need one additional import-path fix beyond what's listed per-task:
`'../helpers/authEmulator'` → `'../../helpers/authEmulator'` (one more directory level
of nesting).

- [X] T013 [P] [US3] Copy `backend/tests/contract/feedsDashboard.contract.test.ts` to
  `backend/tests/contract/feeds/feedsDashboard.contract.test.ts`, updating its imports
  (`invalidateCache` from `../../../src/cache/cacheAside`, `FeedSourceConfig` from
  `../../../src/domain/feeds/types`, `createApp` from `../../../src/app`) and its
  `jest.mock('../../src/feeds/feedSources', ...)` call to
  `jest.mock('../../../src/domain/feeds/feedSources', ...)`. Run the new copy and confirm it still
  passes (routes aren't migrated yet — this only proves the relocation is correct). Leave the original
  file in place until this phase's cleanup task deletes it.
- [X] T014 [P] [US3] Copy `backend/tests/contract/feedsSource.contract.test.ts` to
  `backend/tests/contract/feeds/feedsSource.contract.test.ts`, same import and `jest.mock` path fixes
  as T013. Run the new copy and confirm it still passes. Leave the original file in place until this
  phase's cleanup task deletes it.
- [X] T015 [P] [US3] Copy `backend/tests/integration/feedsDashboard.integration.test.ts` to
  `backend/tests/integration/feeds/feedsDashboard.integration.test.ts`, same import and `jest.mock`
  path fixes as T013. Run the new copy and confirm it still passes. Leave the original file in place
  until this phase's cleanup task deletes it.
- [X] T016 [P] [US3] Copy `backend/tests/integration/feedsDashboardExpandedSources.integration.test.ts`
  to `backend/tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts`, updating its
  imports (`invalidateCache` from `../../../src/cache/cacheAside`, `FEED_SOURCES` from
  `../../../src/domain/feeds/feedSources`, `createApp` from `../../../src/app`) — no `jest.mock` call
  to fix (it uses the real `FEED_SOURCES`). Run the new copy and confirm it still passes. Leave the
  original file in place until this phase's cleanup task deletes it.
- [X] T017 [P] [US3] Copy `backend/tests/integration/feedsDashboardNewSources.integration.test.ts` to
  `backend/tests/integration/feeds/feedsDashboardNewSources.integration.test.ts`, same import and
  `jest.mock` path fixes as T013. Run the new copy and confirm it still passes. Leave the original
  file in place until this phase's cleanup task deletes it.
- [X] T018 [P] [US3] Copy `backend/tests/integration/feedsSourceDirect.integration.test.ts` to
  `backend/tests/integration/feeds/feedsSourceDirect.integration.test.ts`, updating its imports
  (`invalidateCache` from `../../../src/cache/cacheAside`, `createApp` from `../../../src/app`) and
  its `jest.mock('../../src/feeds/feedSources', ...)` call to
  `jest.mock('../../../src/domain/feeds/feedSources', ...)` — its `jest.mock('ioredis', ...)` call is
  unrelated to this migration and stays unchanged. Run the new copy and confirm it still passes. Leave
  the original file in place until this phase's cleanup task deletes it.

### Implementation for User Story 3

- [X] T019 [US3] Implement `backend/src/adapters/feeds/feedsRoutes.ts` — the driving adapter,
  relocated from `backend/src/routes/feeds.ts`: instantiate
  `createFeedsAggregationUseCase({ feedSource: feedSourceAdapter, cache: cacheAdapter })` once at
  module load (importing `feedSourceAdapter` from `./feedSourceAdapter` and `cacheAdapter` from
  `../cache/cacheAdapter`). `GET /dashboard` → call `getDashboard()`, log `success` exactly as today,
  respond 200 with the result; on a caught error, log `error` and respond 500 with
  `{ error: 'internal_error', message: 'Something went wrong. Please try again.' }` (unchanged). `GET
  /sources/:sourceId` → call `getSourceArticles(req.params.sourceId)`; if `null`, respond 404 with `{
  error: 'source_not_found', message: 'This source is not part of the current feed catalog.' }`
  (unchanged); otherwise log `success` and respond 200 with the result; on a caught error, log `error`
  and respond 500 identically to `/dashboard`'s. Preserve `requireAuth` on both routes and every
  existing `logger.info`/`logger.error` field (`route`, `outcome`, `uid`, `meta`, `message`) verbatim.
- [X] T020 [US3] Update `backend/src/app.ts`: change
  `import { feedsRouter } from './routes/feeds'` to
  `import { feedsRouter } from './adapters/feeds/feedsRoutes'` (export name `feedsRouter` unchanged).
- [X] T021 [US3] Delete the now-superseded old source files: `backend/src/feeds/feedClient.ts`,
  `backend/src/feeds/feedAggregator.ts`, `backend/src/feeds/feedMapper.ts`,
  `backend/src/feeds/feedSources.ts`, `backend/src/feeds/types.ts`, `backend/src/routes/feeds.ts`.
  Also remove the now-empty `backend/src/feeds/` directory.
- [X] T022 [US3] Delete the now-superseded old test files: `backend/tests/unit/feedAggregator.test.ts`,
  `backend/tests/unit/feedClient.test.ts`, `backend/tests/unit/feedMapper.test.ts`,
  `backend/tests/unit/feedSources.test.ts`, `backend/tests/contract/feedsDashboard.contract.test.ts`,
  `backend/tests/contract/feedsSource.contract.test.ts`,
  `backend/tests/integration/feedsDashboard.integration.test.ts`,
  `backend/tests/integration/feedsDashboardExpandedSources.integration.test.ts`,
  `backend/tests/integration/feedsDashboardNewSources.integration.test.ts`,
  `backend/tests/integration/feedsSourceDirect.integration.test.ts` — each one's coverage now lives at
  its Phase 3/4/5-relocated path.
- [X] T023 [US3] Run
  `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/feeds"` and confirm
  every relocated/new test (T005, T006, T007, T011, T013–T018) passes against the now fully-wired new
  code — the FR-008/SC-001 regression gate for this domain (quickstart.md step 4).

**Checkpoint**: All three user stories functional; every pre-migration file in this domain no longer
exists; `adapters/feeds/feedsRoutes.ts` serves `/api/feeds` unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] Run
  `grep -rnE "from '(axios|rss-parser)'" backend/src/domain/feeds backend/src/application/feeds backend/src/ports/feeds`
  and confirm zero matches (spec.md SC-002; quickstart.md step 1).
- [X] T025 [P] Run `grep -rn "rss-parser" backend/src/domain/feeds` and confirm zero matches — no
  domain-level file references `rss-parser`'s own types (spec.md FR-012; quickstart.md step 3).
- [X] T026 [P] Run `ls backend/src/feeds backend/src/routes/feeds.ts 2>&1` and confirm both report "No
  such file or directory"; run
  `grep -rn "from '.*feeds/feedClient'\|from '.*feeds/feedAggregator'\|from '.*routes/feeds'" backend/src backend/tests`
  and confirm zero matches (spec.md SC-004; quickstart.md step 2).
- [X] T027 Run `cd backend && npm test` (full suite, no path filter) once and confirm every backend
  test file passes, including every domain this feature didn't touch (`auth`/`users`, and the
  already-migrated `library`/`discogsCatalog`/`discogsOauth` domains) — proving no cross-domain blast
  radius (spec.md SC-001; quickstart.md step 5).
- [X] T028 [P] Manually review `backend/src/adapters/feeds/feedsRoutes.ts`: confirm each handler body
  is limited to one use-case call and the existing 200/404/500 response mapping, with no per-source
  retry, grouping, or status logic inline in the route (spec.md US3; quickstart.md step 7). Confirmed:
  both handlers are limited to a use-case call, logging, and 200/404/500 response mapping — no
  aggregation, grouping, or per-source logic lives in the route.
- [X] T029 Manually verify quickstart.md step 6: the app boots cleanly with the new
  `adapters/feeds/feedsRoutes.ts` wiring, and `GET /api/feeds/dashboard`/`GET
  /api/feeds/sources/:sourceId` return identical shapes/status codes to before this migration —
  confirmed either via a live `curl` walkthrough (if a valid Firebase ID token is available) or via
  the already-green `feedsDashboard.contract.test.ts`/`feedsSource.contract.test.ts` suites, which
  exercise the identical `createApp()`/route code path against a real Firebase Auth emulator and
  `nock`-stubbed feed sources (spec.md SC-005). Confirmed: `createApp()` boots cleanly
  (`TS_NODE_TRANSPILE_ONLY=true ts-node -e "createApp().listen(0)"` succeeded); no live Discogs-style
  credentials were needed here since this domain has none, and the two contract suites (T023/T027,
  all green) already exercise the exact request/response pairs against a real Auth emulator.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. Independent of US2/US3 — its test uses a fake
  `FeedSourcePort`, so it never needs Phase 4's real adapter.
- **User Story 2 (Phase 4)**: Depends on Phase 2 only. Independent of US1/US3.
- **User Story 3 (Phase 5)**: Depends on Phase 3 AND Phase 4 (needs the real `getFeedsDashboard` use
  case and `feedSourceAdapter` to wire into routes) — matches spec.md's explicit statement that US3
  depends on US1 and US2.
- **Polish (Phase 6)**: Depends on Phase 5.

### Parallel Opportunities

- T003, T004 (Phase 2) — different files.
- T005, T006, T007 (Phase 3 tests) — different files, all only need Phase 2.
- T013–T018 (Phase 5 test relocations) — different files.
- T024, T025, T026, T028 (Phase 6) — independent checks.
- **Phase 3 and Phase 4 as a whole** can run in parallel (different engineers/sessions) once Phase 2
  is complete — neither reads or writes the other's files.

---

## Parallel Example: Phase 2 foundational files

```bash
Task: "Create domain/feeds/types.ts (with RawFeedItem)"
Task: "Define ports/feeds/feedSourcePort.ts"
```

## Parallel Example: User Story 1 and User Story 2 as whole phases

```bash
Task: "Complete Phase 3 (User Story 1 — dashboard aggregation against a fake FeedSourcePort)"
Task: "Complete Phase 4 (User Story 2 — feedSourceAdapter against nock)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: T005/T006/T007 pass; the aggregation use case is proven against a fake port
   and cache; production traffic is still served by the untouched old code, so this is safe to pause
   on or merge as an incremental, behavior-invisible step.

### Incremental Delivery

1. Setup + Foundational → `RawFeedItem`/`FeedSourcePort` ready.
2. User Story 1 → aggregation logic proven, zero production risk (additive only).
3. User Story 2 → adapter proven against `nock`, zero production risk (additive only) — independent
   of US1, can be built in parallel.
4. User Story 3 → the cutover: routes rewritten, `app.ts` repointed, old files deleted. This is the
   only phase that changes what actually serves `/api/feeds` traffic.
5. Polish → static-import checks, full-suite regression run, manual route-handler review, manual HTTP
   smoke test.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every implementation task in Phases 3-4 has a preceding test task that fails until it lands
  (Constitution Principle I).
- Commit after each checkpoint (end of Phase 2, 3, 4, 5, 6) rather than after every single task.
- Do not delete anything under `backend/src/feeds/`, `backend/src/routes/feeds.ts`, or the ten Phase 1
  original test files before T021/T022 — every earlier phase depends on the old code and its original
  tests continuing to serve/cover production traffic unmodified.
- The feed source port's return-type change (`Parser.Output`/`Parser.Item` → `RawFeedItem[]`,
  research.md Decision 1) is a genuine, deliberate internal-contract change, not a pure move — its
  test impact is confined to `feedMapper.test.ts` (one fixture) and `feedClient.test.ts` → 
  `feedSourceAdapter.test.ts` (return-shape assertions), both called out explicitly above.
