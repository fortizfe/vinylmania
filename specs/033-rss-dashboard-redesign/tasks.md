---

description: "Task list for RSS Dashboard Redesign — Responsive Layouts & New Sources"

---

# Tasks: RSS Dashboard Redesign — Responsive Layouts & New Sources

**Input**: Design documents from `/specs/033-rss-dashboard-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/feeds-dashboard-delta.md](./contracts/feeds-dashboard-delta.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — this project's constitution (Principle I, Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change; plan.md's Constitution Check reaffirms this for this feature.

**Organization**: Tasks are grouped by user story (P1/P2/P3/P4 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are exact and relative to the repository root

## Path Conventions

Web app split (existing repo structure): `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: N/A for this feature — no new dependencies, packages, or scaffolding are introduced. The two new feed URLs (MetalSucks, Louder Sound) were already verified live during planning (`research.md` §6: both return `200 OK` with valid, parseable RSS 2.0 XML, no Cloudflare/access block) — no further setup action is needed before implementation begins.

**Checkpoint**: Proceed directly to Phase 3 (no Setup tasks).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — the `feeds/` package, the `/api/feeds/dashboard` route, the cache-aside fetch pipeline, and the `Feed*` component family all already exist (features 024/025). Every change below is additive within already-scaffolded files, so no shared blocking infrastructure is required before user story work can begin.

**Checkpoint**: Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Scan many articles at a glance on desktop without extra clicks (Priority: P1) 🎯 MVP

**Goal**: Replace the per-category horizontal-carousel presentation with one responsive CSS grid that shows a large number of already-loaded articles across all categories/sources at once, with a sticky filter bar, on desktop-width viewports.

**Independent Test**: Open the Dashboard on a desktop-width browser window and confirm a large number of articles across categories/sources are visible in a multi-column grid immediately on load, with no arrow-click interaction required, each card unchanged in content (image/placeholder, title, excerpt, source, category, date).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T001 [P] [US1] New component test in `frontend/tests/components/FeedArticleBoard.test.tsx`: given a `DashboardResponse`-shaped mock with articles spread across multiple categories/sources, asserts the component flattens all categories into one list, sorts it by `publishedAt` descending (newest first) regardless of category, renders it inside a grid container whose class list includes `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` and no wider step, and shows the existing-style empty-state message when the (category-filtered) result is empty (spec FR-001, FR-002, FR-016; research.md §1-3)
- [X] T002 [P] [US1] Extend `frontend/tests/integration/dashboardPageFlow.test.tsx`: replace the old carousel/category-section assertions with grid assertions — loading a mocked multi-category response renders every article together (not grouped into separate labeled carousel sections), each card still shows image/placeholder, title, excerpt, source badge, category badge, publish date, and opens its link in a new tab; also asserts the page container carries the widened `max-w-7xl` class (spec FR-001, FR-002, FR-007)

### Implementation for User Story 1

- [X] T003 [US1] Create `frontend/src/components/FeedArticleBoard.tsx`: flattens `categories[].articles` from the `DashboardResponse`, sorts the flattened list by `publishedAt` descending, renders a `sticky top-0 z-10` filter container wrapping the existing `FeedCategoryFilterBar`, and renders the (category-)filtered articles as `FeedArticleCard`s inside `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6`, showing the existing "No news right now" message when the filtered result is empty (research.md §1-3; depends on T001 failing first)
- [X] T004 [US1] Update `frontend/src/pages/DashboardPage.tsx`: render `<FeedArticleBoard>` (passing `categories` from `useDashboardFeeds()`) instead of the `FeedCategoryFilterBar` + `FeedCategorySection` loop; widen the page container from `max-w-6xl` to `max-w-7xl`. Also widened the loading-state skeleton to use the same responsive grid classes as the populated grid (avoids a flex→grid layout shift on data arrival, per the constitution's "No layout shift" rule — a necessary detail not spelled out in the original task description) (research.md §3; depends on T002 failing first, T003)
- [X] T005 [US1] Remove now-unreferenced `frontend/src/components/FeedCarousel.tsx`, `frontend/src/components/FeedCategorySection.tsx`, and `frontend/tests/components/FeedCarousel.test.tsx` (research.md §7; depends on T004)

**Checkpoint**: User Story 1 is fully functional and independently testable — the desktop grid renders all currently-fetched articles at once, sticky-filterable by category, with no carousel/arrow interaction.

---

## Phase 4: User Story 2 - Comfortably browse the news feed on a mobile device (Priority: P2)

**Goal**: On mobile-width viewports, the same grid collapses to a single column with a more compact card layout and comfortably-sized (44×44px) filter touch targets, with no horizontal scrolling anywhere on the page.

**Independent Test**: Open the Dashboard on a mobile-width viewport and confirm articles are in a single vertical column with compact cards, no horizontal scrolling is possible on the page or within a card row, and filter controls are large enough to tap accurately.

### Tests for User Story 2 ⚠️

- [X] T006 [P] [US2] Extend `frontend/tests/components/FeedArticleCard.test.tsx`: asserts the card applies a compact row layout (smaller/side-positioned image) at the base breakpoint and the existing full-width-image column layout at `sm:`+, while still rendering title, excerpt, source, category badge, and date unchanged (spec FR-005, FR-007; research.md §2)
- [X] T007 [P] [US2] Extend `frontend/tests/components/FeedCategoryFilterBar.test.tsx`: asserts every filter button (including "All") carries `min-h-11 min-w-11` touch-target sizing classes (spec FR-006; research.md §4)

### Implementation for User Story 2

- [X] T008 [US2] Update `frontend/src/components/FeedArticleCard.tsx`: make the card's internal layout responsive — `flex-row` with a smaller fixed-size image at the base breakpoint, `sm:flex-col` with the existing full-width `aspect-video` image at `sm:`+, adjusting truncation as needed for the narrower row layout while preserving all existing fields and the new-tab link behavior. Also updated `FeedArticleCardSkeleton.tsx` to mirror the same responsive height/layout classes (necessary for the constitution's "No layout shift" rule between loading and populated states — not spelled out in the original task description) (research.md §2, spec FR-005, FR-007; depends on T006)
- [X] T009 [US2] Update `frontend/src/components/FeedCategoryFilterBar.tsx`: add `min-h-11 min-w-11 flex items-center justify-center` to the base and per-category button classes (research.md §4, spec FR-006; depends on T007)

**Checkpoint**: User Stories 1 and 2 both work independently — the grid is desktop-dense and mobile-compact, with no horizontal scroll and accurately tappable filters.

---

## Phase 5: User Story 3 - Discover news from MetalSucks and Louder Sound alongside Metal Injection (Priority: P3)

**Goal**: MetalSucks and Louder Sound are aggregated as new, fully-integrated sources — same card size/prominence as any other source, distinguished only by badge, degrading gracefully per existing failure-isolation behavior.

**Independent Test**: Load the Dashboard (desktop or mobile) and confirm MetalSucks and Louder Sound articles appear alongside existing sources, each card visually identical in size/prominence, and that a failure in either source doesn't affect the rest of the Dashboard.

### Tests for User Story 3 ⚠️

- [X] T010 [P] [US3] Extend `backend/tests/unit/feedAggregator.test.ts`: asserts `priority` from each `FeedSourceConfig` is propagated onto its corresponding `sourceStatuses[]` entry for both the `'ok'` and `'unavailable'` outcome branches (data-model.md; spec FR-010 supporting)
- [X] T011 [P] [US3] Extend `backend/tests/contract/feedsDashboard.contract.test.ts`: asserts `sourceStatuses` includes `metalsucks` and `louder-sound` entries with `priority: true`, that `metal-injection` also carries `priority: true`, and that every `metal-storm-*` entry carries `priority: false` (contracts/feeds-dashboard-delta.md)
- [X] T012 [P] [US3] New `backend/tests/integration/feedsDashboardNewSources.integration.test.ts`: `nock`-mocks the MetalSucks and Louder Sound feed URLs as healthy alongside the existing sources, asserts their articles merge into the existing `"News"` category (capped at 10 combined, unchanged cap), and that one of the two new sources failing still yields the rest of the dashboard plus an `'unavailable'` `sourceStatuses` entry for just that source (spec FR-011, SC-006, edge case: zero available items)
- [X] T013 [P] [US3] Extend `frontend/tests/components/FeedArticleCard.test.tsx`: given articles from `metalsucks`/`louder-sound`/`metal-injection` vs. a non-priority source, asserts the rendered card markup (size, structure) is identical across all of them, differing only in the displayed source name/badge text (spec FR-010, SC-004, SC-007)

### Implementation for User Story 3

- [X] T014 [US3] In `backend/src/feeds/types.ts`: add `priority: boolean` to `FeedSourceConfig` and to `SourceStatus` (data-model.md; depends on T010, T011, T012 failing first)
- [X] T015 [US3] In `backend/src/feeds/feedSources.ts`: add `metalsucks` (`https://feeds.feedburner.com/Metalsucks`, category `"News"`, `enabled: true`, `priority: true`) and `louder-sound` (`https://www.loudersound.com/feeds.xml`, category `"News"`, `enabled: true`, `priority: true`); set `priority: true` on the existing `metal-injection` entry; set `priority: false` on all 5 existing `metal-storm-*` entries (research.md §5-6; depends on T014)
- [X] T016 [US3] In `backend/src/feeds/feedAggregator.ts`: propagate `source.priority` into each pushed `sourceStatuses` entry, in both the fulfilled and rejected branches of `getDashboard()` (data-model.md; depends on T014)
- [X] T017 [US3] In `frontend/src/services/feedsApi.ts`: add `priority: boolean` to the `SourceStatus` type to mirror the backend addition (depends on T016; unblocks Phase 6/US4's consumption of `priority` — note: `Article` itself never carries a `priority` field, so T013's card-equality test does not depend on this task)

**Checkpoint**: User Stories 1-3 all work independently — the grid now surfaces MetalSucks and Louder Sound with equal visual weight, each degrading gracefully on its own.

---

## Phase 6: User Story 4 - Filter the Dashboard by news source (Priority: P4)

**Goal**: Add a single-select source filter, combinable (AND) with the existing category filter, listing every configured source with priority sources (Metal Injection, MetalSucks, Louder Sound) first.

**Independent Test**: Open the Dashboard, select a single source from the source filter, confirm only that source's articles show, combine it with a category filter, confirm both narrow together, and confirm clearing the source filter restores the full set.

### Tests for User Story 4 ⚠️

- [X] T018 [P] [US4] New `frontend/tests/components/FeedSourceFilterBar.test.tsx`: given a `sourceStatuses`-shaped list, asserts it renders "All sources" plus one button per source, with `priority: true` entries appearing before `priority: false` entries (each group preserving array order) — including an explicit assertion that the three priority sources render in the exact order Metal Injection → MetalSucks → Louder Sound, not merely grouped ahead of the rest — that selecting a source button calls the provided callback with that source's `sourceId`, that every button carries `min-h-11 min-w-11` touch-target sizing, and that every button is a native `<button>` reachable via Tab and activatable with Enter/Space (contracts/feeds-dashboard-delta.md's client-side contract; spec FR-012, FR-006, FR-017)
- [X] T019 [P] [US4] Extend `frontend/tests/components/FeedArticleBoard.test.tsx`: asserts an active category and an active source combine with AND semantics over the flattened article list, that clearing either filter leaves the other's effect intact, and that a combination yielding zero results shows the empty-state message instead of a blank/broken grid (data-model.md's `FilterSelection`; spec FR-013, FR-014, FR-015)
- [X] T020 [US4] Extend `frontend/tests/integration/dashboardPageFlow.test.tsx`: selecting a source in the rendered page narrows visible cards accordingly, combining it with a category selection narrows further, and clearing the source selection restores the category-only view (spec User Story 4 AC1-4)

### Implementation for User Story 4

- [X] T021 [US4] Create `frontend/src/components/FeedSourceFilterBar.tsx`: single-select button group mirroring `FeedCategoryFilterBar`'s structure/props shape, built from `sourceStatuses` (label `sourceName`, value `sourceId`), sorted priority-first, with an "All sources" option and `min-h-11 min-w-11` touch targets (research.md §5; spec FR-012, FR-006; depends on T018 failing first)
- [X] T022 [US4] Update `frontend/src/components/FeedArticleBoard.tsx`: add `selectedSource` state alongside the existing `selectedCategory`, render `FeedSourceFilterBar` inside the sticky filter container next to `FeedCategoryFilterBar`, and filter the flattened+sorted article list by both selections (AND) before rendering the grid, showing the empty-state message when the combined result is empty (data-model.md's `FilterSelection`; spec FR-013, FR-014, FR-015; depends on T019, T020 failing first, T021, T017)

**Checkpoint**: All four user stories are independently functional — grid density, mobile compactness, the two new sources, and the combinable source filter.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T023 [P] Add a new-version entry to `backend/CHANGELOG.md` (MetalSucks/Louder Sound sources added, `priority` field added to `sourceStatuses`) and to `frontend/CHANGELOG.md` (responsive grid/list Dashboard redesign replacing carousels, source filter added, mobile touch-target sizing); bump the `version` field in `backend/package.json` and `frontend/package.json` to the next MINOR version for each, per Principle VI and the Development Workflow gates
- [X] T024 [P] Remove `e2e/tests/dashboard-feed-carousel.spec.ts` and add `e2e/tests/dashboard-feed-grid.spec.ts` (Playwright): covers desktop grid density (≥9 articles visible with no scroll/click), the 5-column cap at ultra-wide widths, mobile single-column layout with no horizontal page scroll down to 320px, category+source filter combination and its empty state, MetalSucks/Louder Sound presence with equal card prominence, per-source failure resilience, that filter selections survive a resize across the desktop/mobile breakpoint (spec edge case), and that the category/source filter buttons are operable via keyboard alone (Tab + Enter/Space, spec FR-017) (research.md §7; spec SC-001 through SC-007; depends on T005, T009, T015, T022)
- [X] T025 Ran the full `quickstart.md` validation pass. In this sandboxed environment, the automated checks were exercised as real Playwright browser tests (`e2e/tests/dashboard-feed-grid.spec.ts`, 8/8 passing against the actual running app — Vite dev server + Express backend + Firebase emulators) rather than an interactive manual walkthrough: desktop grid density (≥9 articles, no scroll/click), the 5-column cap at 2200px, mobile 320px single-column with no horizontal scroll and 44px touch targets, combined category+source filtering with its empty state, filter persistence across a breakpoint resize, keyboard-only filter operation, fixed card height/truncation consistency across sources, and per-source failure resilience were all verified end-to-end
- [X] T026 Ran backend and frontend full test suites and lint. Backend: 36/36 suites, 296/296 tests pass (`npm test`), lint clean, `npm run build` clean. Frontend: 59/59 files, 364/364 tests pass (`npm test`), lint clean (only pre-existing, unrelated warnings), `tsc -b` clean. Full e2e suite (69 tests) run: the new `dashboard-feed-grid.spec.ts` (8/8) and all previously-passing specs remain green; 9 pre-existing failures in unrelated specs (`caching-navigation`, `record-detail-inline-edit`, `returning-session`, `sign-in`) were verified via `git stash` to fail identically on the unmodified baseline — a pre-existing environment limitation (sign-in-flow flakiness under sustained sequential load), not a regression from this feature. Note: this sandbox has no Redis server running, which combined with a stale `REDIS_URL` in `backend/.env` caused backend Jest to hang after test completion (ioredis's infinite reconnect loop, graceful degradation working as designed but noisy); re-running with `REDIS_URL=` overridden avoided it — no source change was needed or made

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — no Setup tasks
- **Foundational (Phase 2)**: N/A — no additional blocking prerequisites for this feature
- **User Story 1 (Phase 3)**: No dependencies on other stories — can start immediately
- **User Story 2 (Phase 4)**: Touches `FeedArticleCard.tsx`/`FeedCategoryFilterBar.tsx`, which US1 renders inside `FeedArticleBoard` — sequenced after US1 to avoid rework, not because of a hard technical requirement (US2's card/filter-bar changes are self-contained edits)
- **User Story 3 (Phase 5)**: Backend-only until T017, so not technically blocked by US1/US2's frontend layout work. Sequenced after US1/US2 for two reasons: spec.md's own priority rationale for User Story 3 states it "depends on having a layout that can scale to more articles without becoming worse to use," and sequencing this way also lets the new sources be visually verified inside the finished grid/card layout
- **User Story 4 (Phase 6)**: Depends on US3's `priority` field existing on `SourceStatus` (T017) and on US1's `FeedArticleBoard`/sticky filter container existing (T003) — a genuine technical dependency, unlike US2/US3's sequencing
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation begins (Principle I)
- Type/config changes → propagation/service logic → component implementation → page wiring

### Parallel Opportunities

- T001 and T002 (US1 tests, different files) can run in parallel
- T006 and T007 (US2 tests, different files) can run in parallel
- T010, T011, T012, T013 (US3 tests, four different files) can all run in parallel
- T018 and T019 (US4 tests, different files) can run in parallel
- T023 and T024 (Polish) are independent and can run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first, both in parallel (different files):
Task: "New component test in frontend/tests/components/FeedArticleBoard.test.tsx"
Task: "Extend frontend/tests/integration/dashboardPageFlow.test.tsx for grid rendering"

# Then implementation, in dependency order:
Task: "Implement frontend/src/components/FeedArticleBoard.tsx"
Task: "Wire FeedArticleBoard into frontend/src/pages/DashboardPage.tsx"
Task: "Remove FeedCarousel.tsx / FeedCategorySection.tsx and their test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1
2. **STOP and VALIDATE**: Confirm the desktop grid shows ≥9 articles with no scroll/click, sticky filter bar works, no carousel remains
3. Deploy/demo the grid — already a usable improvement over the carousel layout, with no new sources or source filter yet

### Incremental Delivery

1. User Story 1 → validate independently → deploy/demo (desktop grid, MVP)
2. User Story 2 → validate independently → deploy/demo (mobile compact list, touch targets)
3. User Story 3 → validate independently → deploy/demo (MetalSucks + Louder Sound sources)
4. User Story 4 → validate independently → deploy/demo (source filter, combinable with category)

---

## Notes

- No Firestore schema or migration work — all data remains ephemeral (Redis cache-aside), unchanged from features 024/025
- The `priority` field (US3) drives only source-filter *ordering* (US4) — never card size/prominence, which stays governed entirely by `FeedArticleCard` having no knowledge of `priority` (resolves the Clarifications session's contradiction)
- Avoid: rendering any feed-provided HTML directly (carried over from 024's research.md §2) — `FeedArticleCard`'s existing sanitized-text handling is preserved unchanged by US2's layout changes
- Avoid: reintroducing a carousel, icon library, or grid library — the single responsive-grid approach (research.md §2) and stock Tailwind utilities (research.md §3-4) are hard requirements of this plan, not just suggestions
- Avoid: multi-select on either filter — both category and source filters are single-select plus an "all" option (spec Clarifications)
