---

description: "Task list for Dashboard RSS Feed Sources Refresh"
---

# Tasks: Dashboard RSS Feed Sources Refresh

**Input**: Design documents from `/specs/041-dashboard-rss-feed-refresh/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The Constitution's Test-First principle is NON-NEGOTIABLE (plan.md Constitution Check, row I). Every task that changes production behavior is preceded by the test task(s) that must be written and observed failing first. Pure fixture/naming cleanup tasks (removing "Metal Storm" wording from test fixtures that don't test Metal-Storm-specific behavior) are not behavior changes and are listed as Implementation tasks instead.

**Organization**: Tasks are grouped by user story (spec.md priorities, all P1) so each story can be implemented, tested, and shipped independently, per the HU's own noted preference for separate commits (Metal Storm removal before new sources).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3, per spec.md's user stories
- File paths are exact and relative to the repository root

## Path Conventions

Existing web application split (plan.md Project Structure): backend changes under `backend/src/feeds/`, `backend/src/routes/`, `backend/tests/`; frontend changes under `frontend/src/{services,queries,components}/`, `frontend/tests/`. No new top-level directory.

---

## Phase 1: Setup

No setup tasks. This feature adds no new dependency, environment variable, or build config — every change lands inside the existing `feeds` module and its consumers.

---

## Phase 2: Foundational (Blocking Prerequisites)

No cross-story blocking infrastructure. Note one real file-level ordering constraint instead of a blocking prerequisite:

- US1 and US2 both edit `backend/src/feeds/feedSources.ts` — US1 (removal) MUST land before US2 (addition) to avoid the two edits conflicting in the same file, matching the HU's own stated preference (remove Metal Storm before adding new sources).
- US3 (the per-source direct-query endpoint) does not require US1 or US2's catalog changes to exist — `getSourceArticles(sourceId)` works against whatever catalog is present — but it is sequenced last here since it is P1 by virtue of being part of the same continuous body of work, not because of a hard dependency.

Proceed directly to Phase 3.

---

## Phase 3: User Story 1 - Retire Metal Storm from the news catalog (Priority: P1) 🎯 MVP

**Goal**: Remove all 5 Metal Storm entries and its dedicated `data-image-url` image-extraction logic, leaving the other 3 existing sources unaffected (FR-001–FR-004).

**Independent Test**: Load the Dashboard after this story alone and confirm no card, filter label, or status banner mentions "Metal Storm", while Metal Injection/MetalSucks/Louder Sound still render normally (quickstart.md §1).

### Tests for User Story 1 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T001 [P] [US1] Replace the "marks every Metal Storm entry as non-priority" test in `backend/tests/unit/feedSources.test.ts` with assertions that `FEED_SOURCES` contains no `id` starting with `metal-storm-` and no entry with `name: 'Metal Storm'` — run, confirm it fails against the current catalog
- [ ] T002 [P] [US1] Replace the "Metal Storm data-image-url extraction (spec 036)" describe block in `backend/tests/unit/feedMapper.test.ts` with a generic test asserting `mapFeedItem` no longer extracts an image from `data-image-url` markup on any source fixture — run, confirm it fails against the current extraction tier

### Implementation for User Story 1

- [ ] T003 [US1] Remove the 5 `metal-storm-*` entries and the file-level historical comment about Metal Storm's Cloudflare-blocked general feed from `backend/src/feeds/feedSources.ts` — depends on T001 failing
- [ ] T004 [US1] Remove `DATA_IMAGE_URL_PATTERN`, its extraction tier in `extractImageUrl()`, and its dedicated comment from `backend/src/feeds/feedMapper.ts` — depends on T002 failing
- [ ] T005 [P] [US1] Delete `backend/tests/integration/feedsDashboardMetalStormCategories.integration.test.ts` (entire file is Metal-Storm-only and now obsolete)
- [ ] T006 [P] [US1] Rename the `mockMetalStormSources` fixture in `backend/tests/contract/feedsDashboard.contract.test.ts` to a neutral multi-category fixture (e.g. `mockMultiCategorySources`, ids like `contract-source-c/d/e/f/g`), preserving the same Reviews/Interviews/Articles/Staff Picks coverage with no "Metal Storm" wording
- [ ] T007 [P] [US1] Rename "Metal Storm" fixture data to a neutral source name in `frontend/tests/components/FeedSourceFilterBar.test.tsx`
- [ ] T008 [P] [US1] Rename "Metal Storm" fixture data to a neutral source name in `frontend/tests/components/FeedArticleCard.test.tsx`
- [ ] T009 [P] [US1] Rename "Metal Storm" fixture data to a neutral source name in the scenarios of `frontend/tests/components/FeedArticleBoard.test.tsx` that are not the source+category combination scenario (that scenario is reworked in T017, User Story 3, since its mechanism changes there)
- [ ] T010 [P] [US1] Rename "Metal Storm" fixture data to a neutral source name in the scenarios of `frontend/tests/integration/dashboardPageFlow.test.tsx` that are not the source+category combination scenario (reworked in T018, User Story 3)

**Checkpoint**: User Story 1 is fully functional and independently testable — run `cd backend && npm test -- feedSources && npm test -- feedMapper && npm test -- feedsDashboard.contract` and `cd frontend && npm test -- FeedSourceFilterBar && npm test -- FeedArticleCard`, then confirm quickstart.md §1 manually.

---

## Phase 4: User Story 2 - Add 6 (5 confirmed) new RSS sources (Priority: P1)

**Goal**: Add Heavy Mag, Metal Underground, Heavy Metal Overload, Femme Metal, and MetalTalk to the catalog as enabled `News` sources; Metal Blade Records is excluded (confirmed unreachable, research.md §1) (FR-005, FR-006, FR-007).

**Independent Test**: Load the Dashboard after this story and confirm articles from each of the 5 new sources appear and are individually selectable via the source filter, with a source outage degrading gracefully (quickstart.md §2).

### Tests for User Story 2 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T011 [US2] Add assertions to `backend/tests/unit/feedSources.test.ts` for the 5 new entries (`id`, `name`, `feedUrl`, `category: 'News'`, `enabled: true`, `priority: false`) and assert no Metal Blade Records entry exists in `FEED_SOURCES` — run, confirm it fails (entries don't exist yet). Builds on T003's already-landed removal in the same file.
- [ ] T012 [P] [US2] New integration test `backend/tests/integration/feedsDashboardExpandedSources.integration.test.ts` importing the real `FEED_SOURCES` catalog (unmocked) and using `nock` to stub the 5 new sources' feed URLs — verify their articles are aggregated into the dashboard response and that one stubbed-down source doesn't break the others (FR-007) — run, confirm it fails (sources don't exist yet)

### Implementation for User Story 2

- [ ] T013 [US2] Add the 5 new entries to `backend/src/feeds/feedSources.ts` (`category: 'News'`, `priority: false`, `enabled: true`), with a short comment noting Metal Blade Records was evaluated and excluded as unreachable (reference research.md §1) — depends on T011 failing, and on T003 (US1) already applied to this file

**Checkpoint**: User Stories 1 AND 2 both work independently — run `cd backend && npm test -- feedSources && npm test -- feedsDashboardExpandedSources`, then confirm quickstart.md §2 manually.

---

## Phase 5: User Story 3 - A source's filter label shows all of its content (Priority: P1)

**Goal**: Clicking a source's filter label queries that source's feed directly (via a new `GET /api/feeds/sources/:sourceId` endpoint reusing the existing per-source cache and 8s timeout) and shows every article it has, instead of only what survived the general view's per-category top-10 cutoff (FR-008–FR-013).

**Independent Test**: Select a source whose articles are known to be absent from the aggregated general view and confirm its real articles render instead of a false empty state; confirm "All sources" restores the original aggregated view with no residual filter (quickstart.md §3).

### Tests for User Story 3 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T014 [P] [US3] New contract test `backend/tests/contract/feedsSource.contract.test.ts` covering `GET /api/feeds/sources/:sourceId` per `contracts/feeds-source.md`: 200 with all articles for a reachable source, 200 with `status: 'unavailable'` + `articles: []` for a failing/timed-out source, 404 `source_not_found` for an unknown/disabled `sourceId` — run, confirm it fails (route doesn't exist)
- [ ] T015 [P] [US3] Add unit tests to `backend/tests/unit/feedAggregator.test.ts` for a new `getSourceArticles(sourceId)` function: returns every article for a known source uncapped (no `ARTICLES_PER_CATEGORY` slice) sorted most-recent-first; returns `null` for an unknown or disabled `sourceId`; returns `{ status: 'unavailable', articles: [] }` when the underlying fetch throws or times out — run, confirm it fails (function doesn't exist)
- [ ] T016 [P] [US3] New integration test `backend/tests/integration/feedsSourceDirect.integration.test.ts`: a source with more articles than fit in its category's general-view top-10 still returns **all** of them via the direct endpoint, distinct from the capped `/api/feeds/dashboard` response for the same source (Acceptance Scenario 1, FR-008); a source whose articles already appear in the general view returns that same article set with no duplicates via the direct endpoint (Acceptance Scenario 2, FR-009); a source that times out returns `status: 'unavailable'`, distinct from a reachable source with zero items (`status: 'ok'`, `articles: []`) (Acceptance Scenario 3, FR-010, edge case) — run, confirm it fails
- [ ] T017 [P] [US3] Rework `frontend/tests/components/FeedArticleBoard.test.tsx`'s source-filter scenarios to mock `useSourceFeed`/`getSourceFeed`: selecting a source not present in the `categories` prop still renders its (mocked) real articles; selecting "All sources" again restores the aggregated view (FR-011); a `status: 'unavailable'` result renders a distinct message from a `status: 'ok'` empty result (FR-010) — run, confirm it fails
- [ ] T018 [US3] Rework the source+category combination scenario in `frontend/tests/integration/dashboardPageFlow.test.tsx` to mock `getSourceFeed` reflecting the new direct-query mechanism, while preserving the existing expectation that combining a source's direct-query result with a non-matching active category filter still yields the empty state (edge case, FR-012) — run, confirm it fails

### Implementation for User Story 3

- [ ] T019 [US3] Add `SourceFeedResponse` type (`sourceId`, `sourceName`, `status: SourceHealth`, `articles: Article[]`, `generatedAt`) to `backend/src/feeds/types.ts` per data-model.md
- [ ] T020 [US3] Add `getSourceArticles(sourceId: string): Promise<SourceFeedResponse | null>` to `backend/src/feeds/feedAggregator.ts`, reusing the existing `fetchSourceArticles()`/`withCache()`/`fetchFeed()` pipeline (same `feeds:${sourceId}` cache key, same 8s timeout, no new constant): look up an enabled source by id (return `null` if missing/disabled), sort its articles most-recent-first with no slice, catch fetch failure as `status: 'unavailable'` — depends on T015 failing, T019
- [ ] T021 [US3] Add `GET /sources/:sourceId` to `backend/src/routes/feeds.ts` (same `requireAuth` + logging pattern as the existing `/dashboard` route): 404 `{ error: 'source_not_found', message }` when `getSourceArticles` returns `null`; 200 with the `SourceFeedResponse` otherwise; 500 `internal_error` on an unexpected exception — depends on T014 failing, T020
- [ ] T022 [P] [US3] Add `SourceFeedResponse` type and `getSourceFeed(sourceId: string): Promise<SourceFeedResponse>` (calling `/api/feeds/sources/${sourceId}` via `authorizedFetch`) to `frontend/src/services/feedsApi.ts`
- [ ] T023 [US3] Add `useSourceFeed(sourceId: string | null)` to `frontend/src/queries/feedsQueries.ts`: `useQuery` keyed `[...feedsKeys.all, 'source', sourceId]`, `enabled: sourceId !== null` — depends on T022
- [ ] T024 [US3] Update `frontend/src/components/FeedArticleBoard.tsx`: when `selectedSource` is set, render `useSourceFeed(selectedSource)`'s articles (still applying the existing client-side `selectedCategory` filter over them, FR-012) instead of filtering the aggregated `categories` prop; when `selectedSource` is `null`, keep today's aggregated-view rendering (FR-011); render a distinct "source unavailable" message when `status === 'unavailable'` vs. the existing "No news right now" message when `status === 'ok'` with zero articles (reusing existing empty-state/skeleton Tailwind patterns, no new custom CSS) — depends on T017, T018, T023

**Checkpoint**: All three user stories are independently functional — run `cd backend && npm test -- feedsSource.contract && npm test -- feedAggregator && npm test -- feedsSourceDirect` and `cd frontend && npm test -- FeedArticleBoard && npm test -- dashboardPageFlow`, then confirm quickstart.md §3 manually.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Run `quickstart.md` end-to-end (all sections) against a local dev environment
- [ ] T026 [P] Optional: if updating the illustrative "Metal Injection, Metal Storm" example in `.specify/memory/constitution.md` (lines ~126, ~165), route it through `/speckit-constitution` (version bump + Sync Impact Report per Governance) rather than a bare text edit — not a functional requirement (spec.md → out of scope note)
- [ ] T027 Run the full suites (`cd backend && npm test`, `cd frontend && npm test`) to confirm no regressions across all three stories

**Known follow-up (not a task here, per plan.md's documented deviation)**: `e2e/tests/dashboard-feed-grid.spec.ts` references Metal Storm and will fail against the new catalog; e2e is out of scope for this feature and needs a separate follow-up fix.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None.
- **Foundational (Phase 2)**: No blocking tasks; only the US1→US2 file-ordering note above applies.
- **User Story 1 (Phase 3)**: No dependency on other stories. Do this first — US2 edits the same catalog file.
- **User Story 2 (Phase 4)**: Depends on User Story 1 having landed in `backend/src/feeds/feedSources.ts` (T003) to avoid conflicting edits; otherwise independent.
- **User Story 3 (Phase 5)**: Independent of US1/US2's catalog contents (works against whatever catalog exists); sequenced last to match spec.md priority order and the single continuous body of work.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests MUST be written and observed failing before their corresponding implementation task.
- Backend types/functions before the route that uses them (US3: T019 → T020 → T021).
- Backend service layer before frontend service/query layer where one calls the other is not applicable here (frontend calls the new endpoint independently) — frontend service (T022) before frontend hook (T023) before frontend component (T024).
- Story complete (checkpoint) before moving to the next priority phase.

### Parallel Opportunities

- T001 and T002 (US1 tests, different files) can run in parallel.
- T005–T010 (US1 cleanup, all different files) can all run in parallel once T003/T004 land.
- T012 (US2 integration test) can be written in parallel with T011, though both must fail before T013.
- T014, T015, T016, T017 (US3 tests, all different files) can run in parallel; T018 touches a file shared with T017's neighboring scenarios so do it right after.
- T022 (frontend service type/function) can be written in parallel with backend US3 tasks (T019–T021) since it doesn't depend on the backend existing to be written, only to be run against.

---

## Parallel Example: User Story 1

```bash
# Launch both failing tests together:
Task: "Replace Metal Storm priority test in backend/tests/unit/feedSources.test.ts"
Task: "Replace Metal Storm data-image-url test block in backend/tests/unit/feedMapper.test.ts"

# Once T003/T004 land, launch all cleanup tasks together:
Task: "Delete backend/tests/integration/feedsDashboardMetalStormCategories.integration.test.ts"
Task: "Rename mockMetalStormSources fixture in backend/tests/contract/feedsDashboard.contract.test.ts"
Task: "Rename Metal Storm fixture in frontend/tests/components/FeedSourceFilterBar.test.tsx"
Task: "Rename Metal Storm fixture in frontend/tests/components/FeedArticleCard.test.tsx"
Task: "Rename Metal Storm fixture in frontend/tests/components/FeedArticleBoard.test.tsx"
Task: "Rename Metal Storm fixture in frontend/tests/integration/dashboardPageFlow.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (none needed)
2. Complete Phase 2: Foundational (none needed)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md §1 — Dashboard has zero Metal Storm mentions, other sources unaffected
5. Deploy/demo if ready

### Incremental Delivery

1. User Story 1 → validate → deploy/demo (retires Metal Storm cleanly)
2. User Story 2 → validate → deploy/demo (5 new sources live)
3. User Story 3 → validate → deploy/demo (source filter finally trustworthy)
4. Each story adds value without breaking the previous one

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
