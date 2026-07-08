# Tasks: Master Release Grouping & Detail Pages

**Input**: Design documents from `/specs/026-master-release-detail/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/discogs-catalog-api.md](./contracts/discogs-catalog-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included and REQUIRED — constitution Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every behavior change; constitution Development Workflow additionally mandates Playwright e2e coverage for any `/frontend`-touching PR.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities from spec.md) so each story is independently implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Maps the task to US1, US2, or US3
- File paths are exact and relative to the repo root

## Path Conventions

Web app layout (per plan.md): `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `e2e/tests/`.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching shared catalog code. No new dependencies, config, or scaffolding are needed — this feature only extends existing, already-configured modules (constitution Principle III: no speculative setup).

- [X] T001 Run `npm run lint && npm test` in `backend/` and `npm run lint && npm test` in `frontend/` to confirm both packages are green before starting; note the baseline test count for later comparison.

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by all user stories.

None required. Auth (`requireAuth`), caching (`withCache`), and logging (`logger`) infrastructure already exist and are reused as-is by every new endpoint; no shared model, middleware, or config change is needed before user story work can start (constitution Principle III). Proceed directly to Phase 3.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - See grouped results for similar releases (Priority: P1) 🎯 MVP

**Goal**: Search results show releases that belong to the same master release as a single, visually distinct (stacked-covers) grouped card, while standalone releases render unchanged. No navigation behavior changes yet — that's US2/US3.

**Independent Test**: Search for an artist/album known to have multiple pressings; verify the grid shows one stacked-covers card for that work (with rating/year/format populated per research Decisions 2–3) alongside unchanged standalone cards for releases with no siblings.

### Tests for User Story 1 ⚠️ write first, confirm they fail before implementing

- [X] T002 [P] [US1] Extend `backend/tests/unit/discogsMapper.test.ts`: `mapSearchResult` accepts a raw hit with `type: "master"`, maps it to `resultType: 'master'` without the release-only artist/title splitting, and passes through `year`/`format` (or omits them when absent from the raw hit).
- [X] T003 [P] [US1] Extend `backend/tests/contract/discogsSearch.contract.test.ts`: `GET /api/discogs/search` no longer forces the Discogs `type=release` query param, its response includes `master`-type results, and `artist`/`label` hits are still excluded.
- [X] T004 [P] [US1] Extend `backend/tests/contract/discogsClient.contract.test.ts`: `enrichWithRating` for a `resultType: 'master'` item resolves the master's `main_release` id and attaches that release's community rating; on lookup failure/timeout it omits `communityRating` without rejecting the overall search (mirrors existing release-enrichment failure test).
- [X] T005 [P] [US1] Extend `frontend/tests/unit/SearchResultCard.test.tsx`: a `resultType: 'master'` result renders the stacked-covers visual and no "Add" button; a `resultType: 'release'` result renders exactly as today.
- [X] T006 [P] [US1] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: given a mocked search response mixing `master` and `release` hits, the results grid renders both card variants correctly.

### Implementation for User Story 1

- [X] T007 [US1] In `backend/src/discogs/discogsMapper.ts`, extend the raw search-result Zod schema's `type` enum to include `'master'` and update `mapSearchResult` to map it (no artist/title splitting, straight passthrough of `year`/`format`/thumbnail per research Decision 2). *(depends on T002)*
- [X] T008 [US1] In `backend/src/discogs/types.ts`, add `'master'` to `CatalogSearchResult['resultType']`. *(depends on T007)*
- [X] T009 [US1] In `backend/src/discogs/discogsClient.ts`, update `searchCatalog` to stop forcing a single `type=release`/`type=artist` value — request `release,master` (or unrestricted) from Discogs and filter the raw response to `release`/`master` hits only (research Decision 1). *(depends on T008; makes T003 pass)*
- [X] T010 [US1] In `backend/src/discogs/discogsClient.ts`, extend `enrichWithRating` to handle `resultType === 'master'`: add a small, self-contained cached lookup of `GET /masters/{id}` (key `discogs:master:{id}`, 6h TTL) to read `main_release`, then reuse the existing `getReleaseRating` under the current 2s timeout / omit-on-failure behavior. Keep this lookup minimal and self-contained (US3 will later generalize it into the full `getMasterRelease`, per T031) so US1 does not depend on US3. *(depends on T009; makes T004 pass)*
- [X] T011 [US1] In `backend/src/routes/discogs.ts`, update the `/search` route's result-count logging to account for the new `master` hits alongside `release` hits.
- [X] T012 [P] [US1] In `frontend/src/services/discogsApi.ts`, add `'master'` to `CatalogSearchResult['resultType']`. *(depends on T008)*
- [X] T013 [US1] In `frontend/src/components/SearchResultCard.tsx`, add the stacked-covers visual (two offset "shadow" cover layers behind the primary image, research Decision 8) when `resultType === 'master'`, and suppress the "Add" action for master results (spec Assumptions). *(depends on T012; makes T005 pass)*
- [X] T014 [US1] Review `frontend/src/pages/SearchResultsPage.tsx` for any logic that assumes `resultType === 'release'` only, and confirm mixed grouped/standalone results render correctly end to end. *(depends on T013; makes T006 pass)*

**Checkpoint**: US1 complete and independently verifiable — grouped vs. standalone cards render correctly in the search grid.

---

## Phase 4: User Story 2 - Open a release's detail page (Priority: P1)

**Goal**: Clicking a standalone release result navigates to a dedicated `/app/releases/:discogsId` page showing full catalog detail, an "Add to library" action, and a back link — replacing the old quick-look preview modal.

**Independent Test**: Click a standalone result card in search results; verify navigation to the release detail page with full info, working Add (with gating), and a back action that restores the prior search state; verify a direct/bookmarked load and a not-found id both behave correctly.

### Tests for User Story 2 ⚠️ write first, confirm they fail before implementing

- [X] T015 [P] [US2] New `frontend/tests/unit/ReleaseDetailPage.test.tsx`: renders a skeleton loading state matching the page's final shape while `useCatalogRelease` is pending; renders all release sections (images, artist/label credits, formats, genres/styles, tracklist, identifiers, community stats, notes) from `useCatalogRelease`; renders "Add to library" with success/added and not-linked/relink error states; renders a not-found message when the release lookup fails.
- [X] T016 [P] [US2] Extend `frontend/tests/unit/SearchResultCard.test.tsx`: clicking a standalone card's image/title area is a `Link` to `/app/releases/:discogsId` carrying `state={{ from: <current search path> }}`.
- [X] T017 [P] [US2] Extend `frontend/tests/integration/searchResultsFlow.test.tsx`: full click-through from search results to the release detail page and back via `BackLink`, asserting the prior query/filters/page are preserved, and asserting `ReleasePreviewModal` is no longer rendered anywhere on the page (FR-013).
- [X] T018 [US2] New `e2e/tests/release-detail.spec.ts` covering quickstart.md Scenario 2: standalone card click → detail page → Add to library → back to search (state preserved) → direct URL reload → not-found id.

### Implementation for User Story 2

- [X] T019 [P] [US2] Create `frontend/src/pages/ReleaseDetailPage.tsx`: reads `:discogsId` via `useCatalogRelease`, renders `ReleaseImageGallery` / `ReleaseDetailsSection` / `ReleaseTracklistSection` / `ReleaseAdditionalInfoSection` (reused as-is), an "Add to library" action reusing the existing `useCreateLibraryEntry` + gate-error handling from `SearchResultsPage`, a `BackLink` reading `location.state?.from` (fallback `/app/search`), a skeleton loading state (reusing the existing `Skeleton` primitive, mirroring the layout `ReleasePreviewModal` used while loading) shown while `useCatalogRelease` is pending, and a not-found state on load error. *(makes T015 pass)*
- [X] T020 [US2] Register `/app/releases/:discogsId` under `AuthenticatedLayout` in `frontend/src/App.tsx`. *(depends on T019)*
- [X] T021 [US2] In `frontend/src/components/SearchResultCard.tsx`, make a standalone card's image/title area a `Link` to `/app/releases/:discogsId` with `state={{ from }}` (the current search path, passed down as a prop), replacing the `onPreview` prop. *(depends on T020; makes T016 pass)*
- [X] T022 [US2] In `frontend/src/pages/SearchResultsPage.tsx`, remove the `previewDiscogsId` state and `<ReleasePreviewModal>` usage, pass `buildSearchPath(query, page, filters)` down to `SearchResultCard` as the link `state.from`, and keep the "Add" quick-action only for `resultType: 'release'` cards. *(depends on T021; makes T017 pass)*
- [X] T023 [US2] Delete `frontend/src/components/ReleasePreviewModal.tsx` (and its test file, if any) now that the release detail page fully replaces it (FR-013). *(depends on T022)*

**Checkpoint**: US1 + US2 complete — standalone release cards fully navigate to a working detail page; preview modal is gone.

---

## Phase 5: User Story 3 - Open a master release's detail page and browse its versions (Priority: P2)

**Goal**: Clicking a grouped (master) result navigates to `/app/masters/:discogsId`, showing master-level info plus a 10-per-page version table; clicking a version row opens that release's detail page (US2), with the back-chain returning to the correct prior page at each step.

**Independent Test**: Click a grouped result card; verify the master detail page renders info + paginated version table; paginate; click a row and verify navigation to the release detail page; verify back returns to the same version-table page, and back from the master page returns to search results.

### Tests for User Story 3 ⚠️ write first, confirm they fail before implementing

- [X] T024 [P] [US3] Extend `backend/tests/unit/discogsMapper.test.ts`: `mapMasterRelease` and `mapMasterReleaseVersion` map raw Discogs master/versions payloads to the `MasterRelease`/`MasterReleaseVersion` shapes in data-model.md, including graceful omission of absent optional fields.
- [X] T025 [P] [US3] New `backend/tests/contract/discogsMaster.contract.test.ts`: `GET /api/discogs/masters/:discogsId` and `GET /api/discogs/masters/:discogsId/versions` (default `perPage=10`) return the shapes documented in `contracts/discogs-catalog-api.md`, including `404 master_not_found` and `502 catalog_unavailable` handling.
- [X] T026 [P] [US3] New `frontend/tests/unit/MasterReleaseDetailPage.test.tsx`: renders a skeleton loading state while `useCatalogMaster` is pending; renders master info (images, artists, genres/styles, tracklist) via `useCatalogMaster`, shows a not-found state on error, and never renders an "Add to library" action.
- [X] T027 [P] [US3] New `frontend/tests/unit/MasterVersionsTable.test.tsx`: renders up to 10 rows (format/year/label/country) via `useCatalogMasterVersions`, paginates, and each row is a `Link` to `/app/releases/:discogsId` with `state.from` pointing at the current master page (including its version-table page number).
- [X] T028 [US3] New `e2e/tests/master-release-detail.spec.ts` covering quickstart.md Scenario 3: grouped card click → master detail page → version table pagination → row click → release detail page → back (same version-table page) → back (search results, state preserved); plus a direct URL load of `/app/masters/:discogsId` (bookmark/refresh case) rendering correctly with its back action falling back to `/app/search` (FR-014).

### Implementation for User Story 3

- [X] T029 [P] [US3] Add `MasterRelease`, `MasterReleaseVersion`, `MasterReleaseVersionsPage` types to `backend/src/discogs/types.ts` per data-model.md.
- [X] T030 [US3] Add `mapMasterRelease` and `mapMasterReleaseVersion` (with their raw Zod schemas) to `backend/src/discogs/discogsMapper.ts`. *(depends on T029; makes T024 pass)*
- [X] T031 [US3] Add `getMasterRelease(masterId)` and `getMasterReleaseVersions(masterId, page, perPage = 10)` to `backend/src/discogs/discogsClient.ts`, wrapping `GET /masters/{id}` and `GET /masters/{id}/versions`, cached via `withCache` at the 6h TTLs from research Decision 6. Consolidate this with the minimal lookup added in T010 so there is one cached `discogs:master:{id}` code path, not two. *(depends on T030)*
- [X] T032 [US3] Add `GET /masters/:discogsId` and `GET /masters/:discogsId/versions` routes to `backend/src/routes/discogs.ts`, following the existing `/releases/:discogsId` auth/error/logging conventions (`404 master_not_found`, `502 catalog_unavailable`, `500 internal_error`). *(depends on T031; makes T025 pass)*
- [X] T033 [P] [US3] Add `MasterRelease`/`MasterReleaseVersionsPage` types and `getMasterRelease`/`getMasterReleaseVersions` client functions to `frontend/src/services/discogsApi.ts`. *(depends on T032)*
- [X] T034 [US3] Add `useCatalogMaster(discogsId)` and `useCatalogMasterVersions(discogsId, page)` hooks to `frontend/src/queries/discogsQueries.ts`, following the existing `useCatalogRelease` pattern. *(depends on T033)*
- [X] T035 [US3] Create `frontend/src/components/MasterReleaseDetailsSection.tsx`: renders the master-only fields (title, artists, genres/styles, year) in the same compact layout style as `ReleaseDetailsSection`. *(depends on T034)*
- [X] T036 [P] [US3] Create `frontend/src/components/MasterVersionsTable.tsx` and `frontend/src/components/MasterVersionsTableSkeleton.tsx`: paginated (10/page) table backed by `useCatalogMasterVersions`, each row a `Link` to `/app/releases/:discogsId` carrying `state.from` for the current master page. *(depends on T034; makes T027 pass)*
- [X] T037 [US3] Create `frontend/src/pages/MasterReleaseDetailPage.tsx`: reads `:discogsId`, composes `ReleaseImageGallery` + `ReleaseTracklistSection` (reused as-is) + `MasterReleaseDetailsSection` + `MasterVersionsTable`, a `BackLink` reading `location.state?.from` (fallback `/app/search`), a skeleton loading state (reusing the existing `Skeleton` primitive) shown while `useCatalogMaster`/`useCatalogMasterVersions` are pending, and a not-found state. *(depends on T035, T036; makes T026 pass)*
- [X] T038 [US3] Register `/app/masters/:discogsId` under `AuthenticatedLayout` in `frontend/src/App.tsx`. *(depends on T037)*
- [X] T039 [US3] In `frontend/src/components/SearchResultCard.tsx` / `SearchResultsPage.tsx`, make a grouped card's image/title area a `Link` to `/app/masters/:discogsId` with `state={{ from }}` set to the current search path (mirrors T021 for standalone cards). *(depends on T038)*

**Checkpoint**: US1 + US2 + US3 complete — full grouped-card → master detail → version table → release detail → back-chain works end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution-mandated wrap-up that spans all three stories.

- [X] T040 [P] Add an `Added`/`Changed` entry to `backend/CHANGELOG.md` for the master detail/versions endpoints and the search behavior change, and bump `backend/package.json`'s version (MINOR — constitution Principle VI).
- [X] T041 [P] Add `Added`/`Changed`/`Removed` entries to `frontend/CHANGELOG.md` (grouped results, two new detail pages, preview modal removal) and bump `frontend/package.json`'s version (MINOR — constitution Principle VI).
- [X] T042 [P] Run full `npm run lint` + `npm test` in both `backend/` and `frontend/`, fixing any regressions surfaced by the removed `ReleasePreviewModal` or the changed `SearchResultCard` props/tests.
- [X] T043 Manually run quickstart.md Scenario 4 (confirm no "Preview" control remains anywhere in the search UI).
- [X] T044 Manually run quickstart.md's optional caching-validation steps (Redis cache-hit check for `GET /api/discogs/masters/:id`) to confirm research Decision 6 in a running environment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Empty — no gate before user stories.
- **User Story 1 (Phase 3)**: Depends only on Setup. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends only on Setup. No dependency on US1 (a standalone release card and its detail page work whether or not grouping is live) — genuinely parallelizable with US1.
- **User Story 3 (Phase 5)**: Depends on **US1** (grouped/master search results must exist to have something to click) and on **US2's `ReleaseDetailPage`** (T019/T020 — a version-table row navigates there). Cannot start meaningfully until both are done.
- **Polish (Phase 6)**: Depends on all three stories being complete.

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task (constitution Principle I).
- Backend type → mapper → client → route, in that order, before frontend service → query hook → component → page → route registration.

### Parallel Opportunities

- T002–T006 (all US1 tests) in parallel.
- T012 can run alongside T009/T010/T011 once T008 lands (different files: frontend vs. backend).
- US1 (Phase 3) and US2 (Phase 4) can be built in parallel by two developers — they touch different backend logic (search vs. release route, already existing) and don't share frontend files until T021/T022 (US2) vs. T013/T014 (US1) — coordinate `SearchResultCard.tsx` edits if run concurrently.
- T024–T028 (all US3 tests) in parallel once US1 + US2 are done.
- T029, T033 in parallel with their sibling-phase counterparts once their dependencies land.
- T040, T041, T042 in Polish in parallel (different files).

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Extend backend/tests/unit/discogsMapper.test.ts for master hit mapping"
Task: "Extend backend/tests/contract/discogsSearch.contract.test.ts for master hits in /search"
Task: "Extend backend/tests/contract/discogsClient.contract.test.ts for master rating enrichment"
Task: "Extend frontend/tests/unit/SearchResultCard.test.tsx for stacked-covers variant"
Task: "Extend frontend/tests/integration/searchResultsFlow.test.tsx for mixed grouped/standalone results"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: search results visually distinguish grouped vs. standalone results (SC-001, SC-002) — demoable even before any detail page exists.

### Incremental Delivery

1. Setup → US1 → validate/demo (grouping visible in search).
2. Add US2 → validate/demo (standalone release detail page + Add + back; preview modal gone).
3. Add US3 → validate/demo (master detail page + version table + full back-chain) — this is the full feature.
4. Polish → changelog/version bump, full regression pass.

### Parallel Team Strategy

- Developer A: US1 (search/mapper/card grouping).
- Developer B: US2 (release detail page) — independent of A, though both touch `SearchResultCard.tsx`; coordinate on that file or sequence B after A's T013/T014 land.
- Once both land, Developer A or B (or a third dev) picks up US3, which depends on both.

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels trace every task back to its spec.md user story.
- Verify each test fails before writing the implementation that makes it pass (Principle I, NON-NEGOTIABLE).
- Commit after each task or logical group, per repo convention (Conventional Commits).
- Stop at any checkpoint to validate a story independently before continuing.
