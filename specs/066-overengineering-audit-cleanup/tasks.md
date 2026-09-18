# Tasks: Over-engineering Audit Cleanup

**Input**: Design documents from `/specs/066-overengineering-audit-cleanup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Constitution I (Test-First) applies. Existing green tests pin current behavior for every change. The one new module (R5) gets its own unit test, written first.

**Rule for every task**: No user-visible behavior change (FR-008). Don't edit an existing test to make a change pass (FR-007).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Record a green baseline on branch `066-overengineering-audit-cleanup` before any change: run `npm test` in `backend/`, `npm test` and `npm run lint` in `frontend/`, and `npx playwright test library-filters.spec.ts search-result-filters.spec.ts record-detail-responsive.spec.ts release-detail-responsive.spec.ts` in `e2e/`. Note any test that already fails, so it isn't later blamed on this feature. Per the backend-test memory, start long backend/e2e runs in the background rather than blocking on them.

## Phase 2: Foundational

None. The three stories share no prerequisite.

---

## Phase 3: User Story 1 - Drop dependencies the platform already provides (Priority: P1) 🎯 MVP

**Goal**: Remove `dotenv` (backend, e2e) and `cross-env` (backend) while keeping env loading and `NODE_ENV=test` exactly as today (research R1, R4).

**Independent Test**: quickstart.md § US1. The packages are gone from the manifests; dev/start load `.env` with shell precedence; start works with no `.env`; the backend and e2e suites pass.

- [X] T002 [US1] Create the side-effect module `backend/src/loadEnv.ts`, containing only `import { existsSync } from 'node:fs';` and `if (existsSync('.env')) process.loadEnvFile();` (research R1: same cwd-relative `.env`, shell vars still win, no ENOENT crash when absent). In `backend/src/server.ts`, replace line 1 `import 'dotenv/config';` with `import './loadEnv';`. It must stay the first import so env is loaded before `./app` and its config modules evaluate, exactly as `dotenv/config` did.
- [X] T003 [US1] In `backend/api/index.ts` (the Vercel entrypoint), replace line 1 `import 'dotenv/config';` with `import '../src/loadEnv';`, kept as the first import. Depends on T002.
- [X] T004 [US1] In `backend/package.json`, change the `test` script's inner command from `\"cross-env NODE_ENV=test jest --detectOpenHandles --forceExit\"` to `\"jest --detectOpenHandles --forceExit\"` (Jest sets `NODE_ENV=test` when it's unset; research R4). Then run `npm uninstall dotenv cross-env` in `backend/` so `package-lock.json` is updated. Depends on T002 and T003. *(Done: `backend/tests/helpers/setupEnv.ts`, the Jest setup file, also imported `dotenv`; its `dotenv.config()` became the same guarded inline `process.loadEnvFile()`, kept inline so it still runs last, after the test defaults.)*
- [X] T005 [P] [US1] In `e2e/playwright.config.ts`, remove `import dotenv from 'dotenv';` and replace `dotenv.config({ path: path.resolve(__dirname, '../frontend/.env.test') });` with `const envFile = path.resolve(__dirname, '../frontend/.env.test'); if (existsSync(envFile)) process.loadEnvFile(envFile);`, adding `import { existsSync } from 'node:fs';`. Then run `npm uninstall dotenv` in `e2e/`.
- [X] T006 [US1] Validate against quickstart.md § US1, steps 1–5: grep for leftovers, the `.env` and shell-precedence check, starting with no `.env`, `npm test` in `backend/`, and `npm test` in `e2e/`.

**Checkpoint**: US1 is shippable on its own (−3 dependency declarations).

---

## Phase 4: User Story 2 - One source of truth for URL-reflected filters (Priority: P2)

**Goal**: One copy of the genre/style/format parse and build logic, shared by the library and search pages. The public hook/`build*Path` APIs don't change (research R5, data-model.md).

**Independent Test**: quickstart.md § US2. The existing hook unit tests and the filter e2e specs pass with no test file changed.

- [X] T007 [US2] Write `frontend/tests/unit/hooks/catalogFilterParams.test.ts` first; it must fail because the module doesn't exist yet. Cover:
  - `readCatalogFilters(new URLSearchParams('genre=Rock,Bogus&style=Punk'))` returns `{ genre: ['Rock'], style: ['Punk'] }`, so unknown values are dropped.
  - Values are re-ordered to catalog order, and whitespace and empty entries are ignored.
  - An empty or absent param yields no key.
  - `writeCatalogFilters(params, { genre: [], format: ['Vinyl'] })` sets only `format=Vinyl`, and multiple values are comma-joined in catalog order.
  Use real values from `frontend/src/constants/genreOptions.ts`, `styleOptions.ts` and `formatOptions.ts`.
- [X] T008 [US2] Create `frontend/src/hooks/catalogFilterParams.ts` by moving, unchanged, `MULTI_VALUE_FILTERS`, `parseMultiValueParam` and `buildMultiValueParam` from `frontend/src/hooks/useLibraryQueryParams.ts`, plus its doc comments. Export:
  - `CatalogFilters` (`{ genre?: string[]; style?: string[]; format?: string[] }`)
  - `readCatalogFilters(params: URLSearchParams): CatalogFilters`, the loop body currently inside `useLibraryQueryParams`'s `useMemo`
  - `writeCatalogFilters(params: URLSearchParams, filters?: CatalogFilters): void`, the loop currently inside `buildLibraryPath`
  T007 must now pass.
- [X] T009 [P] [US2] Slim down `frontend/src/hooks/useLibraryQueryParams.ts`:
  - Delete the moved helpers and constant.
  - Declare `export type LibraryFilters = CatalogFilters;`.
  - The hook body keeps the page parsing and returns `{ page, ...readCatalogFilters(params) }`.
  - `buildLibraryPath` keeps the `page > 1` logic, calls `writeCatalogFilters(params, filters)`, and keeps the `'/app/library'` no-trailing-`?` behavior.
  - Drop `export` from `LibraryQueryParams` (only used in this file; research R8).
- [X] T010 [P] [US2] Slim down `frontend/src/hooks/useSearchQueryParams.ts` the same way:
  - `export type SearchFilters = CatalogFilters;`
  - The hook keeps the `q` and page parsing and spreads `readCatalogFilters(params)`.
  - `buildSearchPath` keeps `params.set('q', query.trim())` and the page logic, then calls `writeCatalogFilters`.
  - Drop `export` from `SearchQueryParams`.
- [X] T011 [US2] Validate against quickstart.md § US2. Run `npx vitest run tests/unit/hooks/useLibraryQueryParams.test.tsx tests/unit/useSearchQueryParams.test.tsx tests/unit/hooks/catalogFilterParams.test.ts` in `frontend/`, then `npx tsc -b --noEmit` and `npm run lint`, then the two filter e2e specs in `e2e/`. No existing test file may be modified.

**Checkpoint**: US2 is shippable on its own.

---

## Phase 5: User Story 3 - Code hygiene (Priority: P3)

**Goal**: Remove the delegate-only cache wrappers, the unused `ready` value and the file-local exports (research R6–R8).

**Independent Test**: quickstart.md § US3. Type-check, lint and all suites stay green.

- [X] T012 [P] [US3] In `backend/src/adapters/cache/cacheAdapter.ts`, delete the `withCache` and `invalidate` wrapper functions. Change the last line to `export const cacheAdapter: CachePort = { has, set, withCache: withCacheAside, invalidate: invalidateCache };`, keeping the existing `import { invalidateCache, withCache as withCacheAside } from './cacheAside';`. Then run `npx jest tests/unit/cache` in `backend/`; the single-flight and fail-soft tests must pass unchanged.
- [X] T013 [P] [US3] In `frontend/src/hooks/useIndependentColumnLayout.ts`, remove the `ready` field and its doc comment from `UseIndependentColumnLayoutResult` (line 54 area), the `useState(false)` at line 81, the `setReady(false)` / `setReady(true)` calls at lines 113 and 128, and `ready` from the return at line 195. Drop `useState` from the React import if it's now unused. Then run `npx vitest run tests/unit/hooks/useIndependentColumnLayout.test.tsx` in `frontend/`.
- [X] T014 [P] [US3] Remove the `export` keyword only (keep the declarations) from these backend symbols, which are referenced in no other file under `backend/src`, `backend/tests` or `backend/api`:
  - `respondStatsError` (`backend/src/adapters/collectionStats/collectionStatsRoutes.ts`)
  - `DiscogsAuthErrorResponse` (`backend/src/adapters/discogs/respondDiscogsAuthError.ts`)
  - `createDiscogsHttpClient` (`backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts`)
  - `SearchCatalogWithRatingsUseCase` (`backend/src/application/discogsCatalog/searchCatalogWithRatings.ts`)
  - `FeedsAggregationUseCase` (`backend/src/application/feeds/getFeedsDashboard.ts`)
  - `CompleteLoginInput`, `CompleteLoginResult` (`backend/src/application/googleAuth/completeLogin.ts`)
  - `CreateLibraryEntryResult` (`backend/src/application/library/createLibraryEntry.ts`)
  - `CopyDataPatch` (`backend/src/application/library/updateLibraryEntry.ts`)
  - `ResolveStreamingLinksContext`, `ResolveStreamingLinksUseCase` (`backend/src/application/streaming/resolveStreamingLinks.ts`)
  - `LogOutcome` (`backend/src/config/logger.ts`)
  - `WINDOW_MS` (`backend/src/discogs/discogsRateLimiter.ts`)
  - `RetryableFailureReason` (`backend/src/discogs/discogsRetry.ts`)
  - `GrowthSeries`, `PerDiscValueReason` (`backend/src/domain/collectionStats/types.ts`)
  - `ArtistAliasRef`, `CatalogImage`, `LabelCredit`, `ReleaseArtistCredit`, `Track` (`backend/src/domain/discogsCatalog/types.ts`)
  - `SleeveCondition` (`backend/src/domain/discogsOauth/conditionGrading.ts`)
  - `SourceHealth` (`backend/src/domain/feeds/types.ts`)
  - `CatalogStatus` (`backend/src/domain/library/types.ts`)
  - `ConditionPrice` (`backend/src/ports/discogsOauth/discogsMarketplacePort.ts`)

  Then run `npx tsc --noEmit -p tsconfig.json` and `npm run lint` in `backend/`. If one fails, restore that symbol's `export` and move on.
- [X] T015 [P] [US3] Remove the `export` keyword only from these frontend symbols, which are referenced in no other file under `frontend/src` or `frontend/tests` (`LibraryQueryParams` and `SearchQueryParams` are handled in T009 and T010):
  - `LoginOutcome` (`frontend/src/auth/AuthContext.tsx`)
  - `FilterValues` (`frontend/src/components/FiltersControl.tsx`)
  - `MEDIA_CONDITIONS`, `SLEEVE_CONDITIONS` (`frontend/src/components/MyCopySection.tsx`)
  - `RecordDetailTestId` (`frontend/src/components/recordDetail/testIds.ts`)
  - `RatingSource` (`frontend/src/lib/releaseRating.ts`)
  - `OverlayScrimMaterial` (`frontend/src/motion/Overlay.tsx`)
  - `collectionStatsKeys`, `ProgressiveValuation`, `ValuationNotice` (`frontend/src/queries/collectionStatsQueries.ts`)
  - `CompleteDiscogsLinkArgs`, `discogsOauthKeys` (`frontend/src/queries/discogsOauthQueries.ts`)
  - `feedsKeys` (`frontend/src/queries/feedsQueries.ts`)
  - `CreateLibraryEntryArgs` (`frontend/src/queries/libraryQueries.ts`)
  - `AddToWantlistArgs` (`frontend/src/queries/wantlistQueries.ts`)
  - `GrowthPoint`, `StatBucket` (`frontend/src/services/collectionStatsApi.ts`)
  - `CommunityRating`, `MasterReleaseVersion` (`frontend/src/services/discogsApi.ts`)
  - `SourceHealth` (`frontend/src/services/feedsApi.ts`)
  - `CompleteGoogleLoginResult`, `GoogleAuthApiError` (`frontend/src/services/googleAuthApi.ts`)
  - `CommunityStats`, `FormatDescriptor`, `LabelCredit` (`frontend/src/services/libraryApi.ts`)
  - `StreamingLink`, `StreamingLinksInput` (`frontend/src/services/streamingApi.ts`)
  - `THEME_STORAGE_KEY` (`frontend/src/theme/ThemeContext.tsx`)

  Then run `npx tsc -b --noEmit`, `npm run lint` and `npm test` in `frontend/`. If one fails, restore that symbol's `export` and move on.
- [X] T016 [US3] Validate against quickstart.md § US3: type-check and lint for both packages, `npx jest tests/unit/cache` in `backend/`, the frontend suite, and `npx playwright test record-detail-responsive.spec.ts release-detail-responsive.spec.ts` in `e2e/` (column layout unchanged on chromium and webkit).

**Checkpoint**: US3 is shippable on its own.

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 Run the full suites once more (`npm test` in `backend/`, `frontend/` and `e2e/`) and compare against the T001 baseline; any new failure blocks completion (SC-003). Check SC-001 (−3 dependency declarations) and SC-002 (net ≤ −50 lines) with `git diff --stat main -- backend/src backend/api frontend/src e2e/playwright.config.ts backend/package.json e2e/package.json`, and record the numbers in the PR description.

---

## Dependencies & Execution Order

- **T001** comes before everything else.
- **US1, US2 and US3** are independent of each other and can run in any order or in parallel. Two cross-links:
  - T009 and T010 (US2) own the `LibraryQueryParams` / `SearchQueryParams` export removals, so T015 doesn't touch those files.
  - T004 comes after T002 and T003, because uninstalling `dotenv` breaks any import left behind.
- **Within US2**: T007 → T008 → (T009 ∥ T010) → T011.
- **T017** comes after all story phases.

## Parallel Examples

- **US1**: T002 → T003 → T004, with T005 in parallel to all of them; then T006.
- **US2**: after T008, T009 and T010 can run together.
- **US3**: T012, T013, T014 and T015 touch disjoint files and can all run together; then T016.

## Implementation Strategy

1. **MVP**: Phase 1 + US1 (T001–T006). This is the lowest-risk, highest-lasting-value cut, and the only one that removes dependencies.
2. Add US2 (the largest line saving and removes drift risk), then US3 (pure hygiene).
3. Finish with T017. All stories go on this one branch and one PR (PATCH release).
