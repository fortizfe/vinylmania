---

description: "Task list for Dashboard Feed Carousels & Metal Storm Categories"

---

# Tasks: Dashboard Feed Carousels & Metal Storm Categories

**Input**: Design documents from `/specs/025-dashboard-feed-carousel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/feeds-dashboard-delta.md](./contracts/feeds-dashboard-delta.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — this project's constitution (Principle I, Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change; plan.md's Constitution Check reaffirms this for this feature.

**Organization**: Tasks are grouped by user story (P1/P2/P3 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Web app split (existing repo structure): `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: Confirm the concrete assumption research.md §4 flags before wiring the new feed sources — no feature code yet.

- [X] T001 Verify each of the 5 new Metal Storm feed URLs (`https://metalstorm.net/rss/{news,reviews,interviews,articles,picks}.xml`) returns a parseable RSS feed (not a Cloudflare challenge) from the dev/deploy environment (e.g. `curl -I`/`curl` each URL); record the result inline as a comment next to the corresponding entry when T012 adds it, and note any blocked URL in `specs/025-dashboard-feed-carousel/research.md` §4

**Checkpoint**: Reachability of all 5 new sources is known before their config entries are written.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — unlike feature 024 (which had to stand up the whole `feeds/` package, types, and route from scratch), all shared infrastructure (types, the `/api/feeds/dashboard` route, `feedAggregator`'s fetch/merge/cache pipeline, the `Feed*` component family) already exists. Each user story below only touches its own pre-existing, independently-scaffolded files, so there are no additional blocking prerequisites beyond Phase 1.

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Browse a category's articles through a horizontal carousel (Priority: P1) 🎯 MVP

**Goal**: Every category on the Dashboard (starting with the existing Metal Injection-fed "News" category, with no dependency on new sources) renders its articles as a horizontally-scrollable carousel of up to 10 items, newest first, with arrow controls that disable/hide at each end, using the same `FeedArticleCard` appearance as today.

**Independent Test**: Load the Dashboard, pick any category with more than a handful of articles, and confirm the articles appear in a single horizontal row with working, keyboard-operable previous/next arrows that reveal up to 10 most-recent articles and correctly disable/hide at the start and end.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T002 [P] [US1] Extend `backend/tests/unit/feedAggregator.test.ts`: given more than 10 articles in a single category, asserts the response caps that category to exactly the 10 most recent, sorted by `publishedAt` descending (newest first) — replacing/updating any existing 5-item-cap assertions (spec FR-006)
- [X] T003 [P] [US1] New component test in `frontend/tests/components/FeedCarousel.test.tsx`: given a list of articles, renders them in a single horizontal row in the given order; the "previous" control is disabled/hidden when scrolled to the start; clicking "next" scrolls toward later items in the list and becomes disabled/hidden once the end is reached; both controls are real `<button>` elements reachable and operable via keyboard (Tab + Enter/Space) (spec FR-007, FR-009, User Story 1 AC1-3)
- [X] T004 [P] [US1] Extend `frontend/tests/integration/dashboardPageFlow.test.tsx`: update the mocked `DashboardResponse` fixture so at least one category has more than 5 articles, and assert the page renders that category's articles inside a horizontally-scrollable carousel (not the old fixed grid) with visible arrow controls, while each article card still shows the same fields (image/placeholder, title, source, category badge, date, excerpt) and opens its link in a new tab (spec FR-005, FR-008, User Story 1 AC4-5)

### Implementation for User Story 1

- [X] T005 [US1] In `backend/src/feeds/feedAggregator.ts`, change `ARTICLES_PER_CATEGORY` from `5` to `10` (research.md §3; depends on T002 failing first)
- [X] T006 [US1] Create `frontend/src/components/FeedCarousel.tsx`: a horizontally-scrolling flex container (`overflow-x-auto`, `scroll-smooth`) that wraps its `FeedArticleCard` children unchanged, plus local `ChevronLeftIcon`/`ChevronRightIcon` inline-SVG components (mirroring `frontend/src/components/ui/BackLink.tsx`'s pattern) and two `<button>` controls with `aria-label`s ("Previous articles"/"Next articles") that call `scrollBy` on a container ref; disable/hide each button based on the container's `scrollLeft`/`scrollWidth`/`clientWidth`, recomputed on `scroll`/`resize` (research.md §1-2; depends on T003)
- [X] T007 [US1] Update `frontend/src/components/FeedCategorySection.tsx` to render its `articles` inside the new `<FeedCarousel>` instead of the fixed CSS grid, passing the article list through unchanged (depends on T004, T006)

**Checkpoint**: User Story 1 is fully functional and independently testable — the existing "News" category (Metal Injection alone) already exercises the 10-item cap and carousel behavior without needing the new Metal Storm sources.

---

## Phase 4: User Story 2 - Discover more Metal Storm content categories (Priority: P2)

**Goal**: Five new categories (News, Reviews, Interviews, Articles, Staff Picks) sourced from Metal Storm's dedicated feeds appear on the Dashboard, with same-labeled categories (e.g. "News") merging across sources rather than duplicating sections.

**Independent Test**: Load the Dashboard and confirm categories for Metal Storm News, Reviews, Interviews, Articles, and Staff Picks are present, each populated via the carousel from User Story 1; confirm "News" combines Metal Injection's and Metal Storm's articles into one carousel capped at 10 total, not 10 each.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Extend `backend/tests/unit/feedAggregator.test.ts`: given articles from two different `FeedSource`s that share the same `category` label (e.g. one fixture labeled `metal-injection`/"News" and another labeled `metal-storm-news`/"News"), asserts they are merged into a single "News" category entry capped at 10 combined articles, not 10 per source (spec FR-004, SC-005)
- [X] T009 [P] [US2] Extend backend integration coverage (new file `backend/tests/integration/feedsDashboardMetalStormCategories.integration.test.ts`, mirroring this project's per-file-fixture convention rather than widening the shared 2-source fixture in `feedsDashboard.integration.test.ts`): `nock`-mock all 5 new Metal Storm feed URLs (News, Reviews, Interviews, Articles, Staff Picks) as healthy alongside an existing "News" source; assert the response includes "Reviews", "Interviews", "Articles", and "Staff Picks" categories, that "News" combines both News-labeled sources non-duplicated, and that one Metal Storm source failing still yields the other categories plus an `'unavailable'` `sourceStatuses` entry for just that source (spec FR-010)
- [X] T010 [P] [US2] Extend `backend/tests/contract/feedsDashboard.contract.test.ts`: asserts `sourceStatuses` includes entries for all 5 new source ids (`metal-storm-news`, `metal-storm-reviews`, `metal-storm-interviews`, `metal-storm-articles`, `metal-storm-picks`) when enabled
- [X] T011 [US2] Extend `frontend/tests/integration/dashboardPageFlow.test.tsx` (after T004's changes): given a mocked response containing "Reviews", "Interviews", "Articles", and "Staff Picks" categories, asserts each renders its own labeled carousel section (spec User Story 2 AC1)

### Implementation for User Story 2

- [X] T012 [US2] In `backend/src/feeds/feedSources.ts`, remove the disabled `metal-storm` entry (pointed at the Cloudflare-blocked listing page) and add 5 new entries per research.md §4's table (`metal-storm-news` → category `"News"`, `metal-storm-reviews` → `"Reviews"`, `metal-storm-interviews` → `"Interviews"`, `metal-storm-articles` → `"Articles"`, `metal-storm-picks` → `"Staff Picks"`), setting each `enabled` flag per T001's reachability check (depends on T001, T008)

**Checkpoint**: User Stories 1 and 2 both work independently — carousel UI plus 5 additional Metal Storm categories, correctly merging into existing same-named categories.

---

## Phase 5: User Story 3 - See a cleaner Dashboard without a redundant page title (Priority: P3)

**Goal**: The Dashboard no longer shows a "Dashboard" page heading.

**Independent Test**: Load the Dashboard and confirm no "Dashboard" heading is rendered, while the source-status notice and category content still render normally.

### Tests for User Story 3 ⚠️

- [X] T013 [US3] Extend `frontend/tests/integration/dashboardPageFlow.test.tsx` (after T004/T011's changes): asserts no heading/element with the text "Dashboard" is rendered on the page (spec FR-001, User Story 3 AC1)

### Implementation for User Story 3

- [X] T014 [US3] Remove the `<h1>Dashboard</h1>` element from `frontend/src/pages/DashboardPage.tsx` (depends on T007, T013)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] Add a new-version entry to `backend/CHANGELOG.md` (Metal Storm sources added, per-category cap raised to 10) and to `frontend/CHANGELOG.md` (horizontal carousel replacing the per-category grid, "Dashboard" title removed); bump the `version` field in `backend/package.json` and `frontend/package.json` to the next MINOR version for each, per Principle VI and the Development Workflow gates
- [X] T016 [P] Run the full `quickstart.md` validation pass (manual walkthrough + automated checks) and record any deviations. Automated checks (steps 1-5's assertions) were exercised via the backend/frontend test suites above rather than a live manual browser session in this sandboxed environment; e2e (step 6, closest to a full manual walkthrough) hit the pre-existing `signInAsFakeGoogleUser` environment limitation noted under T017.
- [X] T017 Add `e2e/tests/dashboard-feed-carousel.spec.ts` (Playwright): Dashboard loads without a "Dashboard" heading, the five new Metal Storm categories are present, and a category's carousel arrows navigate and correctly disable/hide at the ends (research.md §5 — closes feature 024's pre-existing e2e coverage gap for the Dashboard flow; depends on T012, T014). Written following this suite's `page.route` API-mocking convention (mirrors `caching-navigation.spec.ts`); execution in this sandboxed session could not be verified end-to-end because the shared `signInAsFakeGoogleUser` fake-Google-popup step times out identically for a pre-existing, unrelated spec (`header-responsive-nav.spec.ts`) in this environment — a pre-existing environment limitation, not a regression from this feature. Should be re-run in CI/a properly configured dev environment before merge.
- [X] T018 Run backend and frontend full test suites (`npm test` in each) and lint (`npm run lint` in each) to confirm everything is green before merge. Frontend: 301/301 tests pass, lint clean (pre-existing warnings only, in files untouched by this feature). Backend: all feeds-related suites pass (22/22 across feedAggregator/feedSources/contract/integration); lint clean. 4 pre-existing, unrelated Discogs contract-test suites (`discogsClient`, `discogsRelease`, `discogsSearch`, `libraryEnrichment`) fail identically on the unmodified `main`-equivalent baseline (verified via `git stash`) — not caused by this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — no additional blocking prerequisites for this feature
- **User Story 1 (Phase 3)**: Depends on Setup only; does not require User Story 2's new sources to be testable
- **User Story 2 (Phase 4)**: Depends on Setup (T001) and, for a clean incremental diff, on User Story 1's carousel already existing to display its new categories (not a hard technical requirement — the backend config change in T012 is independent of the frontend carousel — but sequencing avoids rework)
- **User Story 3 (Phase 5)**: Touches the same `DashboardPage.tsx`/`dashboardPageFlow.test.tsx` files already modified by US1/US2, so is sequenced after them to avoid merge churn, not because of a functional dependency
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation begins (Principle I)
- Backend config/constant changes → frontend component → frontend page wiring

### Parallel Opportunities

- T002 (backend), T003 (new frontend component test), and T004 (frontend integration test) touch three different files and can run in parallel
- T008, T009, T010 (US2 backend tests) touch three different files and can run in parallel
- T015 and T016 (Polish) are independent and can run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first, all in parallel (different files):
Task: "Extend backend/tests/unit/feedAggregator.test.ts for the 10-item cap"
Task: "New component test in frontend/tests/components/FeedCarousel.test.tsx"
Task: "Extend frontend/tests/integration/dashboardPageFlow.test.tsx for carousel rendering"

# Then implementation, backend and frontend on separate tracks:
Task: "Bump ARTICLES_PER_CATEGORY in backend/src/feeds/feedAggregator.ts"
Task: "Implement frontend/src/components/FeedCarousel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Run quickstart.md's carousel-navigation checks against the existing "News" category
4. Deploy/demo the horizontal carousel — this alone is a usable improvement over the fixed grid, with no new feed sources yet

### Incremental Delivery

1. Setup → foundation ready (no separate foundational phase needed)
2. User Story 1 → validate independently → deploy/demo (carousel UI, MVP)
3. User Story 2 → validate independently → deploy/demo (5 new Metal Storm categories)
4. User Story 3 → validate independently → deploy/demo (title removed)

---

## Notes

- No Firestore schema or migration work — all data remains ephemeral (Redis cache-aside), unchanged from feature 024
- T001's reachability check determines each new Metal Storm source's `enabled` flag in T012; if any URL is unexpectedly blocked, it ships `enabled: false` with a `feed_unavailable` status, consistent with existing graceful-degradation behavior (spec FR-010) — this must not block the other four sources or User Story 1
- Avoid: rendering any feed-provided HTML directly (carried over from 024's research.md §2) — `FeedArticleCard` is reused unchanged, so this is already satisfied by construction
- Avoid: introducing a carousel or icon library — the native-scroll + local-SVG approach (research.md §1-2) is a hard requirement of this plan, not just a suggestion
