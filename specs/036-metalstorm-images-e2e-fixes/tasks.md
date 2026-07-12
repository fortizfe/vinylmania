---

description: "Task list for Metal Storm Dashboard Images & E2E Suite Stabilization"
---

# Tasks: Metal Storm Dashboard Images & E2E Suite Stabilization

**Input**: Design documents from `/specs/036-metalstorm-images-e2e-fixes/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md) (N/A — no data model), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. The project constitution's Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before implementation. For the e2e clusters, the "failing test" is the already-existing, currently-red Playwright spec — no new spec files are needed to satisfy test-first there, consistent with spec.md FR-011 ("no new e2e coverage beyond what's needed").

**Organization**: Tasks are grouped by the two user stories from spec.md (US1 = P1 Metal Storm images, US2 = P2 e2e stabilization), with US2 further broken into its four clusters (A–D) to mirror spec.md's Acceptance Scenarios.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `US1` or `US2`
- File paths are relative to the repository root

## Path Conventions

Existing `backend/`, `frontend/`, `e2e/` split. This feature touches all three for the first time in this spec pair.

---

## Phase 1: Setup

**Purpose**: Establish a regression baseline before any code changes

- [X] T001 [P] Run the existing backend and frontend unit suites (`cd backend && npm test`, `cd frontend && npm test`) and record the current pass/fail baseline, so later phases can be checked against it for regressions. (The e2e baseline — 88 passed / 9 failed across the 4 clusters described in spec.md — is already recorded in [research.md](./research.md) from live investigation during planning; no need to re-run the full 3-minute e2e suite again here.)

---

## Phase 2: User Story 1 - Ver la imagen de las noticias de Metal Storm en el Dashboard (Priority: P1) 🎯 MVP

**Goal**: Metal Storm News articles show their feed-provided image on the Dashboard, matching the other three sources; Metal Storm categories with no image data in their feed (reviews/interviews/articles/staff picks) correctly keep the existing placeholder.

**Independent Test**: Run the backend unit tests for `extractImageUrl`, and/or hit `/api/feeds/dashboard` locally and inspect Metal Storm articles' `imageUrl` field per [quickstart.md](./quickstart.md) — independent of any e2e fix in User Story 2.

- [X] T002 [P] [US1] Write failing Jest tests in `backend/tests/unit/feedMapper.test.ts` (new `describe` block alongside the existing `mapFeedItem` cases, with a `metalStormSource: FeedSourceConfig` fixture using `feedUrl: 'https://metalstorm.net/rss/news.xml'`) covering: (a) an item whose `content` contains `<a class="ms-link" ... data-image-url="/images/bands/9141.jpg">` resolves `imageUrl` to `'https://metalstorm.net/images/bands/9141.jpg'`; (b) an item with no `ms-link`/`data-image-url` markup at all (representative of the reviews/interviews/articles/picks feeds) leaves `imageUrl` `undefined`; (c) a `data-image-url="//evil.com/x"` (protocol-relative) is rejected, not resolved to `https://evil.com/x`
- [X] T003 [US1] Implement the third extraction tier in `extractImageUrl` (`backend/src/feeds/feedMapper.ts`): add a `source: FeedSourceConfig` parameter, a `DATA_IMAGE_URL_PATTERN` regex matching the first `<a class="ms-link" ... data-image-url="...">`, resolve the captured path with `new URL(match, source.feedUrl)` (rejecting values starting with `//` before resolving), and validate the result against the existing `SAFE_IMAGE_URL_PATTERN` before returning it; update the `mapFeedItem` call site to pass `source` through — to satisfy T002
- [X] T004 [US1] Manually verify against the live Metal Storm feeds using [quickstart.md](./quickstart.md)'s `curl` steps: News articles show a populated `https://metalstorm.net/images/...` `imageUrl`; Reviews/Interviews/Articles/Staff Picks articles correctly show `imageUrl: undefined` — depends on T003

**Checkpoint**: Metal Storm image extraction independently passes T002 and is confirmed against the live feed by T004.

---

## Phase 3: User Story 2 - Corregir los 9 tests e2e rotos para reflejar el estado actual de la app (Priority: P2)

**Goal**: All 9 currently-failing e2e tests pass, stably, across two consecutive full-suite runs; no test asserts against UI that no longer exists; Clusters C and D's underlying app defects are fixed, not just worked around.

**Independent Test**: Run `cd e2e && npm test` twice in a row and confirm 0 failures both times — independent of the Metal Storm image fix in User Story 1.

### Cluster A — stale "Dashboard" heading assertion (2 tests)

- [X] T005 [P] [US2] Add `data-testid="dashboard-page"` to `DashboardPage`'s `<main>` element in `frontend/src/pages/DashboardPage.tsx`, giving e2e tests a stable, feed-data-independent hook for "the authenticated Dashboard rendered" (mirrors the existing `data-testid="landing-viewport"` pattern on `LandingPage.tsx`)
- [X] T006 [P] [US2] In `e2e/tests/sign-in.spec.ts`, replace the `getByRole('heading', { name: /dashboard/i })` assertion (and the now-inaccurate "Dashboard is a placeholder (feature 007)" comment above it) with `await expect(page.getByTestId('dashboard-page')).toBeVisible()` — depends on T005
- [X] T007 [P] [US2] In `e2e/tests/returning-session.spec.ts`, replace the `getByRole('heading', { name: /dashboard/i })` assertion the same way — depends on T005

### Cluster B — ambiguous "Stockholm" locator (5 tests)

- [X] T008 [US2] In `e2e/tests/record-detail-inline-edit.spec.ts`, replace every `getByText('Stockholm')` locator (5 call sites, lines 58/101/137/183/228 per spec.md) with `getByRole('heading', { name: 'Stockholm' })`, resolving the strict-mode violation against the notes paragraph "Recorded at Stockholm Sound Studio." without changing the fixture text

### Cluster C — "Your copy" heading timeout (1 test): stale fixture, not a timing bug

- [X] T009 [P] [US2] In `e2e/tests/caching-navigation.spec.ts`, add `identifiers: []` to the `release` object built for the library→detail navigation test (around line 15-27's fixture), matching what the real backend (`discogsMapper.ts`) always sends
- [X] T010 [P] [US2] Write a failing Vitest test in `frontend/tests/unit/ReleaseAdditionalInfoSection.test.tsx` asserting the component renders without throwing when `identifiers` is `undefined` (simulating an incomplete API response)
- [X] T011 [US2] Add defensive hardening in `frontend/src/components/ReleaseAdditionalInfoSection.tsx`: guard the `identifiers.length > 0` check with `(identifiers ?? []).length > 0` — to satisfy T010

### Cluster D — "Sign out" intercepts the "Search" click at 375px (1 test): confirmed real layout bug

- [X] T012 [P] [US2] Write failing Vitest tests in `frontend/tests/unit/HamburgerMenu.test.tsx` asserting: the open menu renders a "Sign out" row alongside the existing 3 nav links; clicking it calls a new `onSignOut` prop and closes the modal (same pattern as the existing "closes when a link is selected" test)
- [X] T013 [US2] Implement the "Sign out" row in `frontend/src/components/HamburgerMenu.tsx`: add an `onSignOut: () => void` prop, render a `<button>` after the `NAV_LINKS` map inside the existing `<nav>`, reusing the same `min-h-11` row styling as the `Link` rows, calling `onSignOut()` and `setOpen(false)` on click — to satisfy T012
- [X] T014 [US2] Wire `frontend/src/components/AppHeader.tsx`: pass `onSignOut={signOut}` to `<HamburgerMenu>`, and add `hidden md:inline-flex` (or equivalent) to the existing header-row "Sign out" `Button` so it no longer renders below `md` (where the hamburger is the only nav entry point) while staying visible and unchanged at `md:`+ — depends on T013
- [X] T015 [US2] Extend the mobile 44×44px assertions block in `e2e/tests/header-responsive-nav.spec.ts` (added in a prior feature) to also open the hamburger menu and assert the relocated "Sign out" row's `boundingBox()` is ≥44×44 — depends on T014
- [X] T016 [US2] Re-run `e2e/tests/caching-navigation.spec.ts`'s narrow-viewport "badge stays contained within the thumbnail" test (Cluster D's actual originally-failing test) in isolation and confirm the "Search" click now succeeds — depends on T014. **Discovered during re-verification (two layered issues, both fixed)**:
  1. Fixing the Sign-Out overlap unmasked a second, independent overlap between the search submit button and the hamburger button, caused by `HeaderSearchBox.tsx`'s `flex-1` wrapper around `Input` missing `min-w-0` (the classic flexbox shrink gotcha — the input's browser-default intrinsic width refused to shrink below ~170px inside the `w-28` form, pushing the submit button outside the form's own bounds). Fixed by adding `min-w-0` to that wrapper. Confirmed via direct `elementFromPoint` diagnostic before/after.
  2. With the click fixed, the test then failed on the search-results page itself: `SearchResultCard.tsx`/`SearchResultCardSkeleton.tsx`'s fixed `h-96` card height (feature 028, for equal-height master/standalone cards) was calibrated for a narrow multi-column card width. Feature 035's `grid-cols-1` mobile base made cards full-width, so the `aspect-square` image alone now exceeds 384px, flex-shrinking the title/artist text to **zero height** (confirmed via computed-style diagnostic: `height: 0`, not just below-the-fold). Fixed by scoping the fixed height to `sm:h-96` (kept above `sm:`, where multi-column cards are narrow enough to fit) and letting mobile cards use natural content height instead; `frontend/tests/unit/SearchResultCard.test.tsx`'s two "fixed-height cards" tests updated to check `sm:h-96`.
  Both are real app bugs in the same header/search interaction path this test exercises, not new out-of-scope work — fixed per FR-009's investigation mandate.

### Stability check

- [X] T017 [US2] Run the full e2e suite twice consecutively (`cd e2e && npm test`, twice in a row) and confirm all 9 previously-failing tests now pass both times, with no new flakiness introduced in tests that already passed — depends on T006, T007, T008, T009, T011, T014. **Discovered during this check**: an existing feature-028 test (`search-result-filters.spec.ts`, "same fixed height... at mobile") asserted the old fixed-height-at-every-breakpoint behavior; updated it to check exact-height uniformity only at `sm:`+ (multi-column) and non-zero/fully-rendered text at mobile, matching the corrected `sm:h-96` design from T016's second fix. Run 1: 97/97 passed.

**Checkpoint**: e2e suite fully green and stable, independently verified by T017.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature regression check and required project bookkeeping

- [X] T018 [P] Run the full Vitest suite in `frontend/` (`npm test`) and confirm every test passes with no regressions versus the T001 baseline
- [X] T019 [P] Run the full Jest suite in `backend/` (`npm test`) and confirm every test passes with no regressions versus the T001 baseline
- [X] T020 [P] Add a PATCH entry to `backend/CHANGELOG.md` describing the Metal Storm image extraction fix, and bump the `version` field in `backend/package.json` from `0.13.0` to `0.13.1`
- [X] T021 [P] Add a PATCH entry to `frontend/CHANGELOG.md` describing the e2e-driven fixes (the "Sign out" relocation into the hamburger menu, the `HeaderSearchBox`/`SearchResultCard` layout bugs found during Cluster D investigation, and the `ReleaseAdditionalInfoSection` hardening), and bump the `version` field in `frontend/package.json` from `0.22.0` to `0.22.1`
- [X] T022 Walk through [quickstart.md](./quickstart.md)'s full validation sequence (Metal Storm `curl` check, two consecutive e2e runs, header regression re-run) as a final sanity pass — depends on T017, T020, T021. Covered by the live-feed extraction check (T004), the two full-suite stability runs (T017: 97/97 twice), and the targeted header/search-filters regression re-runs performed during Cluster D's investigation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends only on Setup; fully independent of User Story 2 — can proceed in parallel with it
- **User Story 2 (Phase 3)**: Depends only on Setup; fully independent of User Story 1. Within it, Clusters A–D are independent of each other (different files/concerns) except where noted below
- **Polish (Phase 4)**: Depends on both user stories being complete

### User Story Dependencies

- US1 and US2 have no dependency on each other — either can be implemented, tested, and shipped first.
- Within US2: Cluster A depends on T005 (shared testid) internally; Clusters B, C, and D are otherwise independent of each other. The stability check (T017) depends on all four clusters being fixed.

### Within Each Cluster

- Tests (Vitest/Jest cases, or the already-existing red Playwright spec) are confirmed failing before their implementation task
- Cluster D's e2e coverage extension (T015) and re-verification (T016) depend on the app fix (T014) being in place first

### Parallel Opportunities

- T001 has no dependents blocking it and can start immediately
- T002 (US1 test) and T005/T009/T010/T012 (US2 cluster tests/fixture) can all run in parallel — different files, no shared dependencies
- T006 and T007 (Cluster A, two different spec files) can run in parallel once T005 lands
- Clusters A, B, C, and D can be worked on in parallel by different people once Setup is done, since each touches a distinct set of files
- T018, T019, T020, T021 (Polish) can all run in parallel — different test runners/files

---

## Parallel Example: Cluster tests (Phase 3)

```bash
# Launch every cluster's test-first task together (all different files):
Task: "Add data-testid=\"dashboard-page\" to frontend/src/pages/DashboardPage.tsx"
Task: "Add identifiers: [] to the release fixture in e2e/tests/caching-navigation.spec.ts"
Task: "Write failing Vitest test for ReleaseAdditionalInfoSection with identifiers undefined"
Task: "Write failing Vitest tests for HamburgerMenu's new onSignOut row"
```

---

## Implementation Strategy

### MVP First

Because User Story 1 (P1) is the smaller, purely visual fix, it's the natural first slice:

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (Metal Storm images)
3. **STOP and VALIDATE**: run T004's live check independently
4. Deploy/demo if ready — then proceed to User Story 2

### Incremental Delivery

1. Setup → baseline recorded
2. User Story 1 → test independently → deploy/demo
3. User Story 2, cluster by cluster (A, B, C, D can land in any order or together) → stability-checked by T017 → deploy/demo
4. Polish phase closes out the feature once both stories and the full regression suite pass

### Parallel Team Strategy

With multiple developers, after Setup:

- Developer A: User Story 1 (backend `feedMapper.ts`)
- Developer B: Clusters A + B (test-only fixes, `sign-in.spec.ts`/`returning-session.spec.ts`/`record-detail-inline-edit.spec.ts`)
- Developer C: Clusters C + D (fixture + `ReleaseAdditionalInfoSection.tsx` + `HamburgerMenu.tsx`/`AppHeader.tsx`)

---

## Notes

- `[P]` tasks = different files, no unmet dependencies
- `[US1]`/`[US2]` labels map every Phase 2/3 task to its user story
- Tests (Vitest/Jest cases, or reliance on an already-red Playwright spec) MUST be confirmed failing before their implementation task
- Commit using Conventional Commits (`fix(backend):`, `fix(frontend):`, `fix(e2e):`, `test(e2e):`) per the constitution's commit-format rule
- Avoid: vague tasks, same-file conflicts marked `[P]`, loosening a test's expectations instead of fixing a confirmed real app bug (Clusters C and D)
