---

description: "Task list for 067 RSS News View Redesign & Reliable Article Images"
---

# Tasks: RSS News View Redesign & Reliable Article Images

**Input**: Design documents from `/specs/067-rss-view-redesign/`

**Prerequisites**: plan.md, spec.md, research.md (§5 D1–D14), data-model.md, contracts/feeds-api.md, quickstart.md

**Tests**: REQUIRED — constitution Principle I (Test-First, non-negotiable). Every "Tests" block must be written, seen failing, and reviewed/approved before its "Implementation" block starts.

**Organization**: grouped by user story; each story is independently testable. Agents: `backend-agent` (backend/), `frontend-agent` (frontend/), `qa-agent` (e2e/ and test/quality gates).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md
- Paths are repo-relative (`backend/…`, `frontend/…`, `e2e/…`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies, config or scaffolding are needed (plan.md: 0 new deps). The only setup is a green baseline, so that later red tests really are red because of new behaviour.

- [X] T001 qa-agent: run `cd backend && npm test -- tests/unit/feeds tests/contract/feeds tests/integration/feeds`, `cd frontend && npx vitest run tests/components tests/integration/dashboardPageFlow.test.tsx tests/unit/statusMessageEntrance.test.tsx` and `cd e2e && npm test -- tests/dashboard-feed-grid.spec.ts`; confirm all green on the branch before any change (flush `feeds:*` in the dev Redis first if local e2e is flaky).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None. The stories only share files that are already in place (`feedsApi.ts` types and `/api/feeds/*` routes are unchanged per contracts/feeds-api.md). Each blocking piece lives in the first story that needs it. Cross-story ordering is listed under Dependencies.

**Checkpoint**: baseline green (T001) → user stories can start.

---

## Phase 3: User Story 1 — Every news item shows its real image, whatever the source (Priority: P1) 🎯 MVP

**Goal**: generic image discovery (feed fields, then an SSRF-guarded article-page lookup), a per-link cache, the logo discard rule, and a monogram placeholder with an `onError` fallback in the current view (FR-001–FR-008).

**Independent Test**: with the view layout unchanged, Heavy Metal Overload and Femme Metal articles show real images, Metal Underground shows the "MU" placeholder, and a deliberately broken image URL shows the placeholder instead of a broken icon (quickstart §1–§4).

### Tests for User Story 1 (write first, must fail) ⚠️

Red tests reviewed/approved before Implementation.

- [X] T002 [P] [US1] backend-agent: in `backend/tests/unit/feeds/domain/feedMapper.test.ts` add `mapFeedItem` image-ladder cases per D2/FR-003:
  - an `image/*` enclosure is used, and an `audio/mpeg` enclosure is skipped;
  - `mediaContent`: `medium="image"` wins, the largest `width` wins, and `media:group` children are included;
  - `mediaThumbnails` are used next, then `itunesImage`, then the first `<img>` in `contentEncoded`, then the first `<img>` in `content`/`summary`;
  - an `<img width="1" height="1">` is skipped (under 50 px);
  - `javascript:`, `data:` and relative URLs are rejected;
  - precedence: when several fields are present, the higher rung wins.
- [X] T003 [US1] backend-agent: in the same file `backend/tests/unit/feeds/domain/feedMapper.test.ts` add cases for:
  - `extractPreviewImage(html, baseUrl)`: `og:image`, then `twitter:image`; either attribute order (`property`/`name` before `content` and after); `&amp;` decoded; a relative URL resolved against `baseUrl`; non-http(s) rejected; `undefined` when there is none;
  - `dropSharedPreviewImages(results: Map<link, string | null>)` (D6): a URL shared by ≥ 2 links becomes `null` for all of them; unique URLs and existing `null`s are kept; the input map is not mutated.
- [X] T004 [P] [US1] backend-agent: in `backend/tests/unit/feeds/adapters/feedSourceAdapter.test.ts` add two nock fixtures and assert that `fetchFeed` maps them into `RawFeedItem.mediaContent`, `mediaThumbnails`, `itunesImage`, `contentEncoded`, `enclosureUrl` and `enclosureType` (D1, data-model.md, FR-002):
  - an RSS 2.0 fixture shaped like Heavy Metal Overload: `media:content` with `medium`/`width`, `media:thumbnail`, `media:group`, `itunes:image href`, `content:encoded`, an enclosure with a `type`;
  - an Atom fixture: an `<entry>` with `<link rel="enclosure" type="image/jpeg" href>` and `media:thumbnail`.
- [X] T005 [US1] backend-agent: in the same file `backend/tests/unit/feeds/adapters/feedSourceAdapter.test.ts` add `fetchArticleHead(url, timeoutMs, resolve)` cases with an injected fake resolver (D3, FR-004a, quickstart §1):
  - resolved addresses `10.0.0.5`, `127.0.0.1`, `169.254.169.254`, `::1`, `fd00:ec2::254` and `::ffff:127.0.0.1` → returns `null` and nock sees no request;
  - a `ftp:` URL → `null`;
  - a 302 to a host that resolves private → `null`;
  - a 4th redirect → `null`;
  - `content-type: application/json` → `null`;
  - 404 → `null`;
  - 503, a delayed reply beyond `timeoutMs`, and a resolver that resolves after `timeoutMs` → all reject;
  - a 300 KB body with no `</head>` → at most 256 KB returned;
  - a body with `og:image` early → returns without reading the rest;
  - a public address → returns the head HTML.
- [X] T006 [P] [US1] backend-agent: in `backend/tests/unit/feeds/application/getFeedsDashboard.test.ts` add cases using a fake `FeedSourcePort` and an in-memory `CachePort` (D4, D5, D6, D13):
  - `fetchArticleHead` is called only for articles without a feed image, newest first, with `timeoutMs` 1000;
  - a source with 18 image-less articles and an empty cache triggers exactly 8 `fetchArticleHead` calls; the other 10 are not cached and are looked up on the next refresh;
  - `withCache` key is `feeds:img:<link>` with TTL 604800;
  - a cached `null` is not looked up again and does not count towards the 8;
  - a rejected lookup leaves the article without an image and is retried on the next refresh;
  - a page image shared by 2 links is dropped, while an identical feed-ladder image is kept;
  - duplicate links or guids within a source appear once (FR-014);
  - exactly one `logger.info` with `outcome: 'feed_images_resolved'` and meta `{ sourceId, articles, fromFeed, fromPage, placeholders, lookups, lookupTimeouts, logoDiscarded }` per source refresh.
- [X] T007 [P] [US1] backend-agent: in `backend/tests/integration/feeds/feedsDashboard.integration.test.ts` add a nock scenario (D3):
  - one source whose feed only has `media:content`, one whose items have no image but whose article pages carry `og:image`, and one whose pages all share the same `og:image`;
  - stub DNS with `jest.mock('node:dns', () => ({ ...jest.requireActual('node:dns'), promises: { ...jest.requireActual('node:dns').promises, lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]) } }))`, because `feedsRoutes.ts` uses the adapter module directly;
  - assert `GET /api/feeds/dashboard` returns the right `imageUrl` values, and none for the shared-logo source.
- [X] T008 [P] [US1] frontend-agent: create `frontend/tests/unit/newsLayout.test.ts` with `sourceMonogram` cases: "Metal Underground" → "MU", "MetalSucks" → "M", "Heavy Metal Overload" → "HM", leading/trailing spaces ignored, empty → "?".
- [X] T009 [P] [US1] frontend-agent: in `frontend/tests/components/FeedArticleCard.test.tsx` add cases (FR-007, FR-008, D9) that must fail against today's `alt={article.title}`:
  - the `<img>` has `alt=""` and `queryByRole('img', { name: article.title })` is `null`;
  - the image has `referrerPolicy="no-referrer"`;
  - with no `imageUrl` the placeholder shows the monogram, is `aria-hidden` and keeps the `feed-article-thumbnail-placeholder` test id;
  - firing `error` on the `<img>` swaps it for the placeholder in the same fixed-aspect box.
- [X] T010 [US1] qa-agent: in `e2e/tests/dashboard-feed-grid.spec.ts` add a scenario (FR-007, SC-002): stub `**/api/feeds/dashboard` with one article whose `imageUrl` is routed to a 404; assert the card shows the monogram placeholder, no `<img>` in a broken state (`naturalWidth === 0` never visible), and an unchanged card bounding box before and after the error.

### Implementation for User Story 1

- [X] T011 [US1] backend-agent: extend `RawFeedItem` in `backend/src/domain/feeds/types.ts` with `enclosureType?`, `contentEncoded?`, `mediaContent?: { url: string; medium?: string; type?: string; width?: number }[]`, `mediaThumbnails?: string[]` and `itunesImage?` (data-model.md).
- [X] T012 [US1] backend-agent: rewrite `extractImageUrl` in `backend/src/domain/feeds/feedMapper.ts` as the D2 ladder. Reuse `SAFE_IMAGE_URL_PATTERN`, and skip `<img>` tags whose `width`/`height` attribute is under 50. Makes T002 pass.
- [X] T013 [US1] backend-agent: add the exported pure functions `extractPreviewImage(html, baseUrl)` (reusing the file's `decodeEntities`) and `dropSharedPreviewImages(results: Map<string, string | null>): Map<string, string | null>` to `backend/src/domain/feeds/feedMapper.ts`. Makes T003 pass.
- [X] T014 [US1] backend-agent: add `fetchArticleHead(url: string, timeoutMs: number): Promise<string | null>` to `FeedSourcePort` in `backend/src/ports/feeds/feedSourcePort.ts`, with the JSDoc from contracts/feeds-api.md.
- [X] T015 [US1] backend-agent: in `backend/src/adapters/feeds/feedSourceAdapter.ts`, construct `new Parser({ customFields: { item: [...] } })` per D1 and map `mediaContent` (including `media:group` children), `mediaThumbnails`, `itunesImage`, `contentEncoded` (`item['content:encoded']`), `enclosureUrl` and `enclosureType` for RSS and Atom items. Makes T004 pass.
- [X] T016 [US1] backend-agent: implement `fetchArticleHead(url, timeoutMs, resolve = dnsLookupAll)` in `backend/src/adapters/feeds/feedSourceAdapter.ts` per D3 and export it on `feedSourceAdapter`:
  - DNS from `node:dns` (`promises.lookup(host, { all: true })`), raced against the same `AbortSignal.timeout(timeoutMs)` used for the whole lookup;
  - check the `http(s)` protocol, then check addresses against a `net.BlockList` for the listed IPv4/IPv6 ranges, including IPv4-mapped;
  - axios `lookup` option pinned to the validated address, `maxRedirects: 0`, manual redirect loop of at most 3 hops that re-checks each hop;
  - `responseType: 'stream'`, `text/html` or `application/xhtml+xml` only, stop at `</head>`, an `og:image`/`twitter:image` match or 256 KB;
  - return `null` for definitive failures, reject on transient ones;
  - log a blocked host at `warn` with `outcome: 'validation_error'` and `meta: { host }`.
  Makes T005 pass.
- [X] T017 [P] [US1] backend-agent: add `'feed_images_resolved'` to the `LogOutcome` union in `backend/src/config/logger.ts` (D13).
- [X] T018 [US1] backend-agent: in `backend/src/application/feeds/getFeedsDashboard.ts`, inside `fetchSourceArticles`' existing `feeds:<id>` fetcher:
  - dedupe mapped articles by `link`, then `id`;
  - for image-less articles, newest first, use `mapWithConcurrency` (from `backend/src/shared/concurrency.ts`, limit 8) to resolve `cache.withCache('feeds:img:' + link, 604800, fetcher)`, catching rejections so they are not cached;
  - `fetcher` increments a per-refresh `lookups` counter and throws without fetching once 8 have started (D5); otherwise it calls `fetchArticleHead(link, 1000)` → `extractPreviewImage(html, link)` → URL or `null`;
  - build the `Map<link, url | null>` of results, apply `dropSharedPreviewImages`, then merge into the articles;
  - emit the `feed_images_resolved` log line.
  Makes T006 and T007 pass.
- [X] T019 [P] [US1] frontend-agent: create `frontend/src/lib/newsLayout.ts` exporting a pure `sourceMonogram(name)` (D9). Makes T008 pass.
- [X] T020 [US1] frontend-agent: in `frontend/src/components/FeedArticleCard.tsx`:
  - replace the `<img>`/grey box with an image-or-placeholder block: fixed `aspect-*` box; `<img alt="" decoding="async" loading="lazy" referrerPolicy="no-referrer">`; local `failed` state set by `onError`;
  - the placeholder is a neutral `stone-100`/dark `stone-800` surface with `sourceMonogram(article.sourceName)`, `aria-hidden`, and the `feed-article-thumbnail-placeholder` test id.
  Makes T009 and T010 pass.

**Checkpoint**: US1 is shippable on its own in today's grid; quickstart §1–§3 and T010 pass.

---

## Phase 4: User Story 2 — Scan the latest news clearly with minimal interaction (Priority: P1)

**Goal**: 7-day, fair, capped dashboard selection (FR-010) and the Portada layout (FR-009, FR-011, FR-012, FR-013 category removal, FR-015 skeletons, FR-016, FR-017) per plan.md "UI decisions".

**Independent Test**: at 390×844 the lead and at least 3 more titles are visible without scrolling, the page never scrolls horizontally and the chip bar is one row; at 1280×800 the lead sits beside a 2×2 tile block with Latest below; every article shows its title, source, relative age and image or placeholder; axe reports 0 violations in light and dark (quickstart §4).

### Tests for User Story 2 (write first, must fail) ⚠️

Red tests reviewed/approved before Implementation.

- [X] T021 [P] [US2] backend-agent: create `backend/tests/unit/feeds/domain/selectDashboardArticles.test.ts` with cases for `selectDashboardArticles(articles, now)` (D7, FR-010, FR-014):
  - `now − 7d` is included and `now − 7d − 1ms` excluded;
  - a 100-item source cannot push out another source's 3 newest;
  - a source with fewer than 3 contributes all it has;
  - output length ≤ 60, newest first;
  - duplicates by `link` and by `id` removed.
- [X] T022 [P] [US2] backend-agent: in `backend/tests/contract/feeds/feedsDashboard.contract.test.ts` assert:
  - the response shape is unchanged (`categories[].articles[]`, `sourceStatuses[]`, `generatedAt`);
  - at most 60 articles in total, none older than 7 days;
  - a source with nothing in 7 days is absent from `categories` but present in `sourceStatuses` (contracts/feeds-api.md).
- [X] T023 [US2] backend-agent: move every existing dashboard fixture off fixed July 2026 dates (D7 "Time source"):
  - `backend/tests/contract/feeds/feedsDashboard.contract.test.ts`, `backend/tests/integration/feeds/feedsDashboard.integration.test.ts`, `feedsDashboardNewSources.integration.test.ts`, `feedsDashboardExpandedSources.integration.test.ts` and `feedsSourceDirect.integration.test.ts`: dates relative to `Date.now()`;
  - `backend/tests/unit/feeds/application/getFeedsDashboard.test.ts`: pass a fixed `now: () => new Date(...)` to `createFeedsAggregationUseCase` and build fixtures relative to it;
  - replace the obsolete 10-cap assertions (`feedsDashboardNewSources.integration.test.ts:126` `toBeLessThanOrEqual(10)`, `feedsSourceDirect.integration.test.ts:126` `toHaveLength(10)`, `getFeedsDashboard.test.ts:176` and `:219` `toHaveLength(10)`) with FR-010 expectations: ≤ 60, within 7 days, each source's 3 newest present.
  After T022 (same contract file). These fail until T030.
- [X] T024 [P] [US2] frontend-agent: in `frontend/tests/unit/newsLayout.test.ts` add cases (D8, D10):
  - `assignPortadaSlots`: lead = newest with `imageUrl`; up to 4 secondaries, at most one per source while other sources have candidates; placeholder-only articles only in `latest`; `latest` newest first; empty input → no lead;
  - `formatArticleAge(iso, now)` returns exactly: 30 s → "just now", 59 min → "59m ago", 23 h → "23h ago", 6 d → "6d ago", exactly 7 d → "Sep 12" (fixtures at 12:00 UTC, date formatting with `timeZone: 'UTC'`).
- [X] T025 [P] [US2] frontend-agent: in `frontend/tests/components/FeedArticleCard.test.tsx` add cases for the `variant` prop:
  - every variant's title is an `h3`;
  - `lead` shows the excerpt and uses `loading="eager"` with `fetchpriority="high"`;
  - `tile` shows no excerpt and uses `loading="lazy"`;
  - `row` renders the square thumbnail;
  - every variant has a single `<a target="_blank" rel="noopener noreferrer">` whose accessible name is the title;
  - `<time dateTime>` shows the relative age, carries the full date in `title` (hover), and contains an `sr-only` full date (AT) (FR-011).
- [X] T026 [P] [US2] frontend-agent: in `frontend/tests/components/FeedArticleBoard.test.tsx` replace grid assertions with Portada ones:
  - one lead, 4 secondaries and a `<ul>` Latest list;
  - heading outline (plan.md): an `h2` "Top stories" that is visually hidden but present in the accessibility tree contains the lead and tile `h3`s; a visible `h2` "Latest" is followed by row `h3`s; no `h2` → `h4` skips;
  - placeholder-only articles appear only in Latest;
  - no "Filter by category" group exists;
  - tab order goes lead → tiles → Latest.
- [X] T027 [P] [US2] frontend-agent: in `frontend/tests/integration/dashboardPageFlow.test.tsx` assert:
  - the loading skeleton uses the Portada variants (1 lead, 4 tiles, 6 rows);
  - a visually hidden `h1` "News" is the first heading;
  - with healthy but empty data, "No news right now — check back soon." is shown.
- [X] T028 [US2] qa-agent: in `e2e/tests/dashboard-feed-grid.spec.ts` (after T010) rewrite the layout scenarios. Fixtures come via `page.route` with articles dated relative to `Date.now()` within 7 days.
  - 390×844:
    - the lead headline and ≥ 3 more titles are in the viewport;
    - `document.documentElement.scrollWidth <= innerWidth`;
    - the chip bar's height is one chip row and its own `scrollWidth > clientWidth` with many sources (it scrolls inside itself).
  - 1280×800: the lead is beside a 2×2 tile block with Latest below.
  - `runAxeScan` passes in light and dark.

### Implementation for User Story 2

- [X] T029 [P] [US2] backend-agent: create `backend/src/domain/feeds/selectDashboardArticles.ts` exporting the pure `selectDashboardArticles(articles, now)` per D7. Makes T021 pass.
- [X] T030 [US2] backend-agent: in `backend/src/application/feeds/getFeedsDashboard.ts`:
  - add the optional `now?: () => Date` dependency (default `() => new Date()`) to `createFeedsAggregationUseCase`;
  - replace the `ARTICLES_PER_CATEGORY` cap inside `groupByCategory` with `selectDashboardArticles(allArticles, now())`, wrapped in the existing single-group `categories` shape;
  - remove `ARTICLES_PER_CATEGORY`.
  Depends on T018 (same file) and T023. Makes T022 and T023 pass.
- [X] T031 [US2] frontend-agent: add pure `assignPortadaSlots(articles)` and `formatArticleAge(iso, now)` to `frontend/src/lib/newsLayout.ts`, using the hand-formatted strings from D10 ("just now" / "{m}m ago" / "{h}h ago" / "{d}d ago"; from 7 days `toLocaleDateString('en', { month: 'short', day: 'numeric' })`). Depends on T019. Makes T024 pass.
- [X] T032 [US2] frontend-agent: add `variant: 'lead' | 'tile' | 'row'` to `frontend/src/components/FeedArticleCard.tsx` per the plan.md variant table:
  - all titles `h3` with line clamps; the lead uses `font-display leading-display tracking-display`;
  - excerpt on `lead` only (hidden below `sm`); image loading attributes per variant;
  - remove the category `Badge`;
  - meta line `sourceName · <time dateTime title={fullDate}>{formatArticleAge}<span className="sr-only">, {fullDate}</span></time>`;
  - keep `pressableCard` and `focusRing`.
  Depends on T020. Makes T025 pass.
- [X] T033 [P] [US2] frontend-agent: add a matching `variant` prop to `frontend/src/components/FeedArticleCardSkeleton.tsx` (same boxes as the card variants, using `ui/Skeleton`).
- [X] T034 [US2] frontend-agent: rewrite `frontend/src/components/FeedArticleBoard.tsx` as the Portada:
  - remove `selectedCategory` state and the `FeedCategoryFilterBar` import;
  - flatten `categories`, then `assignPortadaSlots`;
  - a section with a visually hidden `h2` "Top stories" holds the top block: phone lead then a 2×2 grid; `lg` 12 columns with the lead in `col-span-7` and the 2×2 in `col-span-5`;
  - a visible `h2` "Latest" with a `<ul>` of `row` cards, 1 column, 2 from `lg`;
  - the sticky filter bar wrapper stays opaque (`bg-white dark:bg-surface`, as today);
  - no filter-change animation (FR-017).
  Makes T026 pass.
- [X] T035 [P] [US2] frontend-agent: in `frontend/src/components/FeedSourceFilterBar.tsx`, below `sm` render the chips as one row that scrolls horizontally inside itself (`flex-nowrap overflow-x-auto`, chips `shrink-0`); from `sm` keep `flex-wrap` (plan.md, C5). Makes the T028 chip-row assertions pass.
- [X] T036 [US2] frontend-agent: in `frontend/src/pages/DashboardPage.tsx` add a visually hidden `<h1>News</h1>` and a Portada skeleton (1 `lead`, 4 `tile`, 6 `row` skeletons laid out like T034); keep the healthy-empty copy. Makes T027 pass.
- [X] T037 [US2] frontend-agent: delete `frontend/src/components/FeedCategoryFilterBar.tsx` and `frontend/tests/components/FeedCategoryFilterBar.test.tsx` (D11, FR-013).

**Checkpoint**: US1 + US2 = the full redesign for the all-sources view; T028 green.

---

## Phase 5: User Story 3 — Focus on a single source in one tap (Priority: P2)

**Goal**: selecting a source renders the same Portada built from that source's articles only, with no 7-day window; "All" restores the view (clarify Q4, FR-013).

**Independent Test**: select a source → only its articles are shown in the Portada, including ones older than 7 days, with several tiles from the same source; select "All" → the all-sources view returns; the selected chip has `aria-pressed="true"` (quickstart §4).

### Tests for User Story 3 (write first, must fail) ⚠️

Red tests reviewed/approved before Implementation.

- [X] T038 [P] [US3] frontend-agent: in `frontend/tests/components/FeedArticleBoard.test.tsx` add cases with a mocked `useSourceFeed`:
  - selecting a source renders a lead plus up to 4 secondaries all from that source, and the Latest list includes a 10-day-old article;
  - "All sources" restores the all-sources slots;
  - an `unavailable` source feed shows "… is temporarily unavailable right now.";
  - the loading state shows Portada skeletons.
- [X] T039 [P] [US3] backend-agent: in `backend/tests/contract/feeds/feedsSource.contract.test.ts` assert that `GET /api/feeds/sources/:id` returns all articles, newest first and deduplicated, and is not windowed or capped (contracts/feeds-api.md). Use fixture dates relative to `Date.now()`, including one older than 7 days. No backend change is expected: dedupe comes from T018, so this is a regression guard.
- [X] T040 [US3] qa-agent: in `e2e/tests/dashboard-feed-grid.spec.ts` (after T028) cover the source-chip round-trip: stub `**/api/feeds/sources/*`, click the chip, check the Portada comes only from that source and `aria-pressed="true"`, click "All sources", and check the all-sources lead is back.

### Implementation for User Story 3

- [X] T041 [US3] frontend-agent: in `frontend/src/components/FeedArticleBoard.tsx` route the `useSourceFeed` articles through the same `assignPortadaSlots` and layout used for all sources, using Portada skeletons while loading and keeping the existing unavailable message. Depends on T034. Makes T038 and T040 pass.

**Checkpoint**: US3 works on top of US2.

---

## Phase 6: User Story 4 — Know when a source is down without losing the rest (Priority: P3)

**Goal**: an unavailable source is marked on its filter chip with an icon and the text "unavailable"; the chip stays selectable; there is no banner; all sources down → one empty state (clarify Q5, FR-015, US4).

**Independent Test**: with one source `unavailable`, the rest render, its chip reads "… unavailable" and there is no banner; with all sources `unavailable`, one empty-state message is shown (quickstart §4).

### Tests for User Story 4 (write first, must fail) ⚠️

Red tests reviewed/approved before Implementation.

- [X] T042 [P] [US4] frontend-agent: in `frontend/tests/components/FeedSourceFilterBar.test.tsx` add cases:
  - an `unavailable` source renders visible text "unavailable" and an `aria-hidden` SVG;
  - its button's accessible name includes "unavailable";
  - it is still a `<button>` whose click calls `onSelectSource` and toggles `aria-pressed`;
  - `ok` sources show no marker;
  - ordering is still priority first.
- [X] T043 [P] [US4] frontend-agent: in `frontend/tests/integration/dashboardPageFlow.test.tsx` add cases: one source unavailable → no `role="status"` banner text and other articles rendered; every source unavailable → the single "News is temporarily unavailable. Please try again later." message.
- [X] T044 [P] [US4] frontend-agent: remove the `FeedSourceStatusBanner` test case and its import from `frontend/tests/unit/statusMessageEntrance.test.tsx`, keeping the file's other cases.
- [X] T045 [US4] qa-agent: in `e2e/tests/dashboard-feed-grid.spec.ts` (after T040) replace the banner scenario near the `FeedSourceStatusBanner` comment with:
  - the chip text "… unavailable" and no banner;
  - clicking the unavailable chip shows "temporarily unavailable";
  - the all-unavailable stub shows the single empty state;
  - axe still passes.

### Implementation for User Story 4

- [X] T046 [US4] frontend-agent: in `frontend/src/components/FeedSourceFilterBar.tsx` (after T035) render unavailable chips as name + inline 16 px warning SVG (`aria-hidden`) + "unavailable" text, muted (`text-stone-600` / dark `text-stone-400`, ≥ 4.5:1), still a 44 px `<button aria-pressed>` (D12). Makes T042 pass.
- [X] T047 [US4] frontend-agent: in `frontend/src/pages/DashboardPage.tsx` (after T036) remove `FeedSourceStatusBanner`. When every `sourceStatuses[].status === 'unavailable'`, render the single empty state "News is temporarily unavailable. Please try again later." instead of the board. Makes T043 and T045 pass.
- [X] T048 [US4] frontend-agent: delete `frontend/src/components/FeedSourceStatusBanner.tsx` (D12).

**Checkpoint**: all four stories are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T049 [P] qa-agent: grep `backend/src`, `backend/tests`, `frontend/src`, `frontend/tests` and `e2e/tests` for leftovers and remove any stragglers:
  - `FeedCategoryFilterBar`, `FeedSourceStatusBanner`, `ARTICLES_PER_CATEGORY` and `Filter by category` → expect no matches;
  - in `backend/tests/*/feeds` only: `toBeLessThanOrEqual(10)`, `toHaveLength(10)` and fixed `2026-07` fixture dates → expect none.
- [X] T050 [P] qa-agent: accessibility audit per FR-016 on the running app at 320, 390 and 1280 px, in light and dark:
  - keyboard-only pass (tab order: chips → lead → tiles → Latest; visible focus);
  - VoiceOver/NVDA spot-check (heading outline h1 → h2 Top stories → h3, h2 Latest → h3; each title read once; full date available);
  - `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast: more`;
  - no page-level horizontal scroll (the chip row may scroll inside itself).
  Fix findings through frontend-agent.
- [X] T051 qa-agent: run quickstart.md §1–§4 end to end, then run the §2 live coverage script with `REDIS_URL` set, 3 times. Record the measured SC-001 numbers (TOTAL % and per-source) as one dated line appended to `specs/067-rss-view-redesign/research.md` §1.3.
- [X] T052 [P] qa-agent: run `cd backend && npm run lint && npm run build` and `cd frontend && npm run build && npm run lint`; zero errors.

Versioning (D11 / Principle VI): no task. The response shape is unchanged, so this is a MINOR change, and the release tooling (`scripts/release`, spec 037) derives the bump from conventional commits. Commits use `feat(067): …` with no `BREAKING CHANGE` footer.

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (T001) → everything. Phase 2 is empty.
- **US1 (Phase 3)**:
  - T003 follows T002 (same test file); T005 follows T004 (same test file).
  - Implementation: T011 → T012 → T013 (types, then `feedMapper.ts`); T014 → T015 → T016 (port → adapter); T017 in parallel; then T018. T019 → T020 on the frontend.
- **US2 (Phase 4)**:
  - The backend selection tests (T021, T022) can start alongside US1.
  - T023 follows T022 (same contract file) and T006/T007 (same unit/integration files).
  - T030 follows T018 (same file) and T023.
  - Frontend: T031 follows T019; T032 follows T020; T028 follows T010 (same e2e file).
- **US3** needs US2: T041 after T034; T040 after T028.
- **US4** is independent of US2/US3 in behaviour, but shares files with them:
  - T043 after T027;
  - T046 after T035;
  - T047 after T036;
  - T045 after T040.
- **Polish** after all stories.

### Story completion order

US1 → US2 → US3 → US4. US4 may be delivered right after US1 if needed, provided its `FeedSourceFilterBar.tsx`/`DashboardPage.tsx` edits are rebased onto T035/T036.

### Within each story

Tests written and seen red → reviewed/approved → domain → port → adapter → application → frontend lib → components → page. Deletions come last in their story.

---

## Parallel Examples

**US1**: T002, T004, T006, T007, T008 and T009 in parallel, then T003, T005 and T010. Implementation: T011 → T012 → T013 and T014 → T015 → T016 as two chains, with T017 and T019 alongside, then T018 and T020.

**US2**: T021, T022, T024, T025, T026 and T027 in parallel; then T023 and T028. Implementation: T029, T033 and T035 in parallel with T031/T032, then T030, T034 → T036 → T037.

**US3**: T038 and T039 in parallel; then T040 (after T028) and T041 (after T034).

**US4**: T042, T043 and T044 in parallel. Then T046 (after T035), T047 (after T036), T048; T045 after T040.

---

## Implementation Strategy

### MVP first

Ship **US1 alone**: real images and placeholders in the current grid, with its e2e scenario (T010). This is the fix explicitly requested, it has no UI redesign risk, and it is independently measurable (SC-001, SC-002). Validate with quickstart §1–§3 and T010.

### Incremental delivery

1. US1 → images (MVP).
2. US2 → Portada + 7-day selection + category filter removed (the visible redesign).
3. US3 → the single-source Portada (keeps the spec 041 behaviour users rely on).
4. US4 → chip-based availability, banner removed.
5. Polish → leftover grep, a11y audit, quickstart run, SC-001 measured.

### Agent split

- **backend-agent** (20): T002–T007, T011–T018, T021–T023, T029–T030, T039.
- **frontend-agent** (23): T008–T009, T019–T020, T024–T027, T031–T038, T041–T044, T046–T048.
- **qa-agent** (9): T001, T010, T028, T040, T045, T049–T052.

---

## Notes

- No docs-agent task: `docs/` has no end-user page for news today. Add one when a news guide is requested.
- Commit after each green checkpoint. Never skip a red test (Principle I).
