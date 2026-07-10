---

description: "Task list for feature implementation"
---

# Tasks: UI Polish – Search Results & Dashboard Cards

**Input**: Design documents from `/specs/028-ui-polish-search-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED, not optional — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every change in this repo.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task description

## Path Conventions

Existing web app split, per plan.md: this feature is frontend-only —
`frontend/src/`, `frontend/tests/`, `e2e/tests/`. No `backend/` files are touched.

---

## Phase 1: Setup

**Purpose**: Confirm the codebase still matches the assumptions research.md/plan.md were built on before changing it.

- [X] T001 Re-read `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/components/SearchResultCard.tsx`, `frontend/src/components/SearchResultCardSkeleton.tsx`, `frontend/src/components/FeedArticleCard.tsx`, `frontend/src/components/FeedArticleCardSkeleton.tsx`, `frontend/src/components/FeedCarousel.tsx`, and `frontend/src/components/ui/Card.tsx` to confirm the current line numbers/structure still match what research.md and plan.md describe (no drift since planning); note any discrepancy before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No foundational tasks are required for this feature: all four changes are
presentation-only edits to existing components, with no new abstractions,
shared utilities, or data changes. US1 (`SearchResultsPage.tsx`) and US4
(`FeedArticleCard.tsx`/`FeedArticleCardSkeleton.tsx`) touch files disjoint
from everything else and can proceed immediately after Phase 1. US2 and US3
both touch `SearchResultCard.tsx`, so US3 is sequenced after US2 completes
(see Dependencies below) rather than being fully parallel with it.

**Checkpoint**: Proceed straight to user story phases.

---

## Phase 3: User Story 1 - Smoother infinite scroll in search results (Priority: P1) 🎯 MVP

**Goal**: Search results load in batches of 40 instead of 20, both on initial load and on each subsequent infinite-scroll fetch.

**Independent Test**: Perform a catalog search, scroll to the bottom of the first batch, and confirm 40 results are shown before the next batch is fetched, with subsequent batches also loading 40 at a time.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] [US1] In `frontend/tests/integration/searchResultsFlow.test.tsx`, update every hardcoded page-size expectation from `20` to `40`: the `perPage: 20` fields inside mocked `pagination` objects (e.g. lines ~96, 144, 196, 233, 281, 289, 307, 328, 342, 366, 379, 404, 416, 435, 450, 460, 478, 486, 515, 523) and every `expect(mockSearch).toHaveBeenCalledWith(/toHaveBeenLastCalledWith(...)` assertion that currently asserts the perPage argument is `20` (e.g. lines ~109, 265, 300, 372, 470, 537). Also update any test that relies on `pages`/`items` math tied to a 20-per-page assumption (e.g. the "47 items across 3 pages of 20" scenario around lines 328-450) to use 40-per-page math consistent with the new batch size, preserving the same test intent (e.g. multi-page infinite-scroll fetching still exercised with a total that spans more than one 40-item page).

### Implementation for User Story 1

- [X] T003 [US1] In `frontend/src/pages/SearchResultsPage.tsx:19`, change `const PAGE_SIZE = 20;` to `const PAGE_SIZE = 40;`. Depends on T002 failing first.

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — search results now load 40 at a time.

---

## Phase 4: User Story 2 - Consistent search result card sizing (Priority: P1)

**Goal**: Master and release result cards render at the same fixed height across the entire results grid, with master cards showing a static "Multiple editions" label in place of the format badge/action buttons they omit.

**Independent Test**: Run a search that returns a mix of master and release results, and verify all cards in the grid — across every row — share the same height.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T004 [P] [US2] In `frontend/tests/unit/SearchResultCard.test.tsx`, add tests asserting: (a) the rendered `Card` root carries a specific fixed-height Tailwind class (e.g. a `h-*` token) when rendered with a release result; (b) the same fixed-height class is present when rendered with a master result (`resultType: 'master'`) — i.e. the height-affecting class does not depend on `isGrouped`; (c) a master result renders a "Multiple editions" text/label; (d) a release result does NOT render the "Multiple editions" label.

### Implementation for User Story 2

- [X] T005 [US2] In `frontend/src/components/SearchResultCard.tsx`: add a fixed-height utility class (e.g. `h-96`, consistent at every breakpoint per research.md Decision 2 — adjust the exact value during visual QA/quickstart if content clips) to the `Card` element (line 79), applied unconditionally (same class for both `isGrouped` and non-grouped cards). Do NOT add `overflow-hidden` to the `Card` root — the stacked-covers ghost layers (enhanced in T008) are positioned `absolute inset-0` with a translate offset and must be allowed to render past the image container's edge into the card's padding area; clipping them would violate FR-006. If any content besides the stacked-covers effect risks overflowing the fixed height, prefer `overflow-hidden` scoped to just that inner element instead of the `Card` root. Replace the currently-omitted format `Badge`/`ResultCardActions` for master cards (lines 69, 83) with a static "Multiple editions" `Badge` rendered only when `isGrouped` is true, positioned in the same row/slot the format badge and actions occupy for release cards, so the two variants consume equivalent vertical space without depending on any new data field. Depends on T004 failing first.
- [X] T006 [US2] In `frontend/src/components/SearchResultCardSkeleton.tsx`, apply the same fixed-height class chosen in T005 to the skeleton's `Card` wrapper, so the loading state matches the populated state's height (constitution "No layout shift" rule). Depends on T005.

**Checkpoint**: User Stories 1 AND 2 both work independently — batches of 40 load, and every search result card (master or release) renders at the same height.

---

## Phase 5: User Story 3 - More noticeable stacked-covers effect for grouped releases (Priority: P2)

**Goal**: The stacked-covers effect on master (grouped) cards is visually enhanced so it's clearly distinguishable at a glance, without being clipped by the fixed-height card boundary from User Story 2.

**Independent Test**: View a search results page containing master results and confirm the stacked-covers effect is clearly perceivable at a normal glance, distinguishing master cards from single-release cards.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T007 [P] [US3] In `frontend/tests/unit/SearchResultCard.test.tsx`, update the existing "renders the stacked-covers visual for a master result" test (or add a new one) to assert the two ghost layers (`data-testid="search-result-stacked-covers"` children) carry the enhanced offset/shadow classes — e.g. the outer layer has `translate-x-3 translate-y-3 rotate-6 shadow-md` and the inner layer has `translate-x-1.5 translate-y-1.5 -rotate-3 shadow-sm` (up from the current `translate-x-2 translate-y-2 rotate-3` / `translate-x-1 translate-y-1 -rotate-2` with no shadow) — so the test fails against today's smaller offsets.

### Implementation for User Story 3

- [X] T008 [US3] In `frontend/src/components/SearchResultCard.tsx:39-40`, increase the stacked-covers ghost-layer offsets and add shadow depth: change the outer layer's `translate-x-2 translate-y-2 rotate-3` to `translate-x-3 translate-y-3 rotate-6 shadow-md`, and the inner layer's `translate-x-1 translate-y-1 -rotate-2` to `translate-x-1.5 translate-y-1.5 -rotate-3 shadow-sm`, keeping the existing border/background-color classes for contrast. Verify visually (or via the T007 test) that the enhanced offsets stay within the fixed-height `Card` boundary from T005 (FR-006) and remain exclusive to `isGrouped` cards. After implementing, explicitly verify (via the T007 test's rendered DOM or a manual check) that no ancestor between the ghost layers and the card boundary has `overflow-hidden` applied, so the enlarged offsets are never clipped. Depends on T007 failing first and on T005 (fixed-height card) being in place.

**Checkpoint**: All three of User Stories 1-3 are independently functional and combine correctly — 40-item batches, equal-height cards, and a clearly visible stacked-covers effect that isn't clipped.

---

## Phase 6: User Story 4 - Consistent RSS card sizing on the dashboard (Priority: P3)

**Goal**: Dashboard RSS feed article cards render at a uniform height regardless of title/excerpt length, truncating overflow text to 2 lines each.

**Independent Test**: View a dashboard feed carousel containing articles with varying title/excerpt lengths and verify all cards render at the same height within a row.

### Tests for User Story 4 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T009 [P] [US4] In `frontend/tests/components/FeedArticleCard.test.tsx`, add tests asserting: (a) the rendered `Card` root carries a fixed-height Tailwind class regardless of article content length (render with both a short-title/no-excerpt article and a long-title/long-excerpt article, assert the same height class on both); (b) the title `h3` carries a `line-clamp-2` class; (c) the excerpt `p` carries a `line-clamp-2` class.

### Implementation for User Story 4

- [X] T010 [US4] In `frontend/src/components/FeedArticleCard.tsx`: add a fixed-height utility class (e.g. `h-96 overflow-hidden`, per research.md Decision 4 — adjust the exact value during visual QA/quickstart if content clips) to the `Card` element (line 19), add `line-clamp-2` to the title `h3` (line 44-46), and add `line-clamp-2` to the excerpt `p` (line 47). Depends on T009 failing first.
- [X] T011 [US4] In `frontend/src/components/FeedArticleCardSkeleton.tsx`, apply the same fixed-height class chosen in T010 to the skeleton's `Card` wrapper, so the loading state matches the populated state's height. Depends on T010.

**Checkpoint**: All four user stories are independently functional and can be combined — 40-item search batches, equal-height search cards with a visible stacked-covers effect, and equal-height RSS dashboard cards.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide quality gates that span all four stories.

- [X] T012 [P] Extend `e2e/tests/search-result-filters.spec.ts` (or add a sibling spec, e.g. `e2e/tests/search-results-card-polish.spec.ts`) with Playwright coverage for: a search that loads more than 20 results confirms a batch of 40 loaded before the next fetch; a mixed-results search asserting every card's `getBoundingClientRect().height` is equal across the whole grid (not just within a row) — repeated at mobile, tablet, and desktop viewport sizes (via `page.setViewportSize`, matching the Tailwind `sm`/`lg`/`xl` breakpoints) per SC-002's explicit "verified across mobile, tablet, and desktop layouts" requirement; and the stacked-covers effect being visually present (e.g. asserting the ghost-layer elements' bounding boxes extend beyond the thumbnail's bounds) on master cards only — satisfying the constitution's mandatory e2e gate for `/frontend` PRs.
- [X] T013 [P] Extend `e2e/tests/dashboard-feed-carousel.spec.ts` with Playwright coverage asserting every RSS article card's `getBoundingClientRect().height` is equal within a carousel, regardless of title/excerpt length, and that a long title/excerpt is visibly truncated (not overflowing the card).
- [X] T014 [P] Add a dated entry to `frontend/CHANGELOG.md` describing all four changes (search batch size 20→40, equal-height search result cards with a "Multiple editions" label, enhanced stacked-covers effect, equal-height RSS dashboard cards) and bump the `version` field in `frontend/package.json` from `0.17.0` to `0.17.1` per Principle VI (PATCH — backward-compatible visual refinement, no breaking contract change).
- [X] T015 [P] Run `npm run lint` and `npm run format` in `frontend/` on all changed files.
- [X] T016 Walk through every scenario in `quickstart.md` against the running app to confirm all four user stories work together end-to-end, including verifying no regressions to existing search ordering (masters-first), infinite scroll, or add-to-library interactions (SC-005).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: No tasks; nothing blocks the user stories beyond Phase 1.
- **User Stories (Phase 3, 4, 6)**: US1 and US4 can start right after Phase 1 and are fully independent of every other story (disjoint files). US2 can also start right after Phase 1.
- **User Story 3 (Phase 5)**: Depends on US2 (Phase 4) completing first — both touch `SearchResultCard.tsx`, and US3's enhanced effect must be verified against US2's fixed-height card boundary (FR-006).
- **Polish (Phase 7)**: Depends on whichever user stories are completed (T012 needs US1+US2+US3 behavior to exercise meaningfully; T013 needs US4; T014-T016 should run last).

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3/US4.
- **User Story 2 (P1)**: No dependency on US1/US3/US4.
- **User Story 3 (P2)**: Depends on User Story 2 (shared file, sequential per FR-006).
- **User Story 4 (P3)**: No dependency on US1/US2/US3.

### Within Each User Story

- Failing tests (T002, T004, T007, T009) MUST exist and fail before their corresponding implementation task.
- Card component changes (T005, T010) before their matching skeleton updates (T006, T011).

### Parallel Opportunities

- T002 (US1 test) can run alongside T004 (US2 test) and T009 (US4 test) — all different files.
- T012, T013, T014, T015 in Polish can run in parallel (different files/scopes).
- US1, US2, and US4 phases can be worked on by different people in parallel once Phase 1 is done; US3 must wait for US2.

---

## Parallel Example: Kicking off the independent stories' tests together

```bash
Task: "Update perPage 20→40 expectations in frontend/tests/integration/searchResultsFlow.test.tsx"
Task: "Add fixed-height + Multiple editions label tests in frontend/tests/unit/SearchResultCard.test.tsx"
Task: "Add fixed-height + line-clamp tests in frontend/tests/components/FeedArticleCard.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (batch size 40).
3. **STOP and VALIDATE**: confirm search results load 40 at a time via infinite scroll.
4. Deploy/demo if ready — this alone already smooths every search interaction.

### Incremental Delivery

1. Setup → Phase 3 (US1, batch size) → validate → deploy.
2. Phase 4 (US2, equal-height cards + label) → validate → deploy.
3. Phase 5 (US3, enhanced stacked-covers) → validate → deploy.
4. Phase 6 (US4, equal-height RSS cards) → validate → deploy.
5. Phase 7 (Polish: e2e, changelog/version, lint, quickstart pass) → final validation → deploy.

### Parallel Team Strategy

With multiple developers, after Phase 1:

- Developer A: User Story 1 (`SearchResultsPage.tsx`)
- Developer B: User Story 2 then User Story 3 (`SearchResultCard.tsx`, sequentially)
- Developer C: User Story 4 (`FeedArticleCard.tsx`, `FeedArticleCardSkeleton.tsx`)

All integrate independently without touching each other's files, except US2→US3 which share one file by design.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Tests are mandatory here (Principle I, NON-NEGOTIABLE) — verify each listed test fails before writing the corresponding implementation.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before moving on.
