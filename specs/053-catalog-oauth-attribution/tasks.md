# Tasks: Identificar toda petición a Discogs con la cuenta vinculada del usuario

**Input**: Design documents from `/specs/053-catalog-oauth-attribution/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — the project constitution's Principle I (Test-First, NON-NEGOTIABLE) requires a failing test before implementation for every change; task order within each story follows Red-Green.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1/US2/US3 = P1, US4 = P2). All file paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4, mapping to spec.md's four user stories

---

## Phase 1: Setup

**Purpose**: Confirm the environment this feature depends on is actually wired before any code changes.

- [ ] T001 Verify `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`/`DISCOGS_TOKEN` are present in `backend/.env` (or the emulator test env) and reachable from `backend/src/adapters/discogsCatalog/`, matching how `backend/src/adapters/discogsOauth/discogsCollectionAdapter.ts`'s `getCredentials()` already reads them — no code change, just confirms the catalog adapter will have what it needs before Phase 2 depends on it.

**Checkpoint**: No missing configuration; proceed to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared credential-resolution contract every user story's tests and implementation depend on. **No user story task can start until this phase is complete** — all four stories exercise the same `CatalogCredential`/`DiscogsCatalogPort` surface.

**⚠️ CRITICAL**: This phase changes a shared interface (`DiscogsCatalogPort`) that existing code already implements and calls — T005 and T006 must land together (interface + adapter) to keep the build compiling.

- [ ] T002 [P] Add `CatalogCredential` discriminated union type to `backend/src/domain/discogsCatalog/types.ts`, per `contracts/discogs-catalog-port.md` and `data-model.md` (`{ type: 'vinylmania' } | { type: 'user'; connection: DiscogsConnection }`, importing `DiscogsConnection` from `backend/src/domain/discogsOauth/types.ts`).
- [ ] T003 [P] Write failing unit test `backend/tests/unit/discogsCatalog/application/resolveCatalogCredential.test.ts` covering: (a) `getConnection` returns `null` → resolves `{ type: 'vinylmania' }`; (b) `getConnection` returns a `DiscogsConnection` → resolves `{ type: 'user', connection }`; (c) never throws for case (a), per `contracts/catalog-credential-resolution.md`. Reuse the `DiscogsConnectionPort` test-double pattern from `backend/tests/unit/library/application/syncLibrary.test.ts`.
- [ ] T004 Implement `resolveCatalogCredential(discogsConnection: DiscogsConnectionPort, uid: string): Promise<CatalogCredential>` in `backend/src/application/discogsCatalog/resolveCatalogCredential.ts` to make T003 pass, per `contracts/catalog-credential-resolution.md`.
- [ ] T005 Update `DiscogsCatalogPort` in `backend/src/ports/discogsCatalog/discogsCatalogPort.ts`: add a leading `credential: CatalogCredential` parameter to all six methods (`getRelease`, `getArtist`, `getMasterRelease`, `getMasterReleaseVersions`, `getReleaseRating`, `searchCatalog`), per `contracts/discogs-catalog-port.md`.
- [ ] T006 Update `backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts`'s six exported functions and the `discogsCatalogAdapter` port object (line ~403) to accept the new leading `credential` parameter and compile against T005 — at this point still routing every call through the existing `getDiscogsHttpClient()` singleton regardless of `credential` (behavior change lands in US1); this task only restores a green build.
- [ ] T007 Update every existing direct caller of the six adapter functions to pass `{ type: 'vinylmania' }` as the new first argument, restoring a green build: `backend/src/adapters/discogsCatalog/discogsRoutes.ts`, `backend/src/application/discogsCatalog/searchCatalogWithRatings.ts`, `backend/tests/unit/discogsCatalog/application/searchCatalogWithRatings.test.ts`, `backend/tests/contract/discogsCatalog/discogsClient.contract.test.ts`, `backend/tests/integration/discogsCatalog/discogsClient.live.test.ts`, `backend/tests/integration/discogsCatalog/discogsCaching.test.ts`, `backend/tests/integration/discogsCatalog/discogsRetryResilience.test.ts`, `backend/tests/integration/discogsCatalog/discogsRateLimitSmoothing.test.ts`.
- [ ] T008 Run `cd backend && npm run build && npm test -- discogsCatalog` to confirm the interface change compiles and all pre-existing catalog tests still pass unmodified in behavior (only call-site signatures changed) before starting US1.

**Checkpoint**: `DiscogsCatalogPort`/`CatalogCredential` exist and compile end-to-end; every call site passes `{ type: 'vinylmania' }` today (no behavior change yet). User story implementation can now begin.

---

## Phase 3: User Story 1 - Usuario con cuenta vinculada consulta catálogo con su propia identidad (Priority: P1) 🎯 MVP

**Goal**: A linked user's catalog requests (search, release, master, master versions, artist, rating) are actually signed with their own Discogs OAuth credentials instead of `DISCOGS_TOKEN`.

**Independent Test**: Seed a `DiscogsConnection` for a test user, stub Discogs via `nock` to assert the incoming `Authorization` header carries that connection's `oauth_token`, call each of the four catalog routes as that user, and confirm the stub matched (i.e. the request was actually signed with the user's credentials) — per `quickstart.md` Scenario 1.

### Tests for User Story 1 ⚠️

- [ ] T009 [P] [US1] Write failing contract test `backend/tests/contract/discogsCatalog/discogsCatalogCredential.contract.test.ts`: for a linked test user (fixture `DiscogsConnection`, same shape as `backend/tests/contract/discogsOauth/collectionClient.contract.test.ts:30-37`), assert `discogsCatalogAdapter.getRelease({ type: 'user', connection }, id)` sends `Authorization: OAuth ...oauth_token="access-token"...` (reuse the `OAUTH_TOKEN_HEADER` regex pattern from that same file) — not `Discogs token=<DISCOGS_TOKEN>`. Repeat the same assertion shape for `getMasterRelease`, `getMasterReleaseVersions`, `getReleaseRating`, `getArtist`, `searchCatalog`. **Additionally assert the resolved response body is identical (deep-equal) to the same call made with `{ type: 'vinylmania' }` against the same stubbed Discogs payload** — locks in spec FR-007 (content parity across credential types), not just the header difference.
- [ ] T010 [P] [US1] Write failing route-level test in `backend/tests/contract/discogsCatalog/discogsRelease.contract.test.ts` (and the equivalent `discogsMaster.contract.test.ts`/`discogsSearch.contract.test.ts`): as an authenticated user with a seeded `discogsConnections/{uid}` Firestore doc (via `createTestSession` + emulator, mirroring `backend/tests/contract/library/library.contract.test.ts`'s setup), `GET /api/discogs/releases/:id` / `/masters/:id` / `/search` returns `200` and the `nock` interceptor confirms the OAuth-signed request path was hit.
- [ ] T011 [P] [US1] Write failing integration test (extend `discogsRelease.contract.test.ts`) covering the spec's "mid-session linking" edge case: as an authenticated user, call `GET /api/discogs/releases/:id` with no `discogsConnections/{uid}` doc (assert `Discogs token=...` was used), then seed the doc mid-test, call the same route again, and assert the *second* call used the linked user's `oauth_token` — with no re-login/re-session step in between.
- [ ] T012 [P] [US1] Write failing integration test `backend/tests/integration/discogsCatalog/discogsCatalogCredentialCaching.test.ts` covering the spec's cache edge case: prime the cache for a given release ID via a `{ type: 'vinylmania' }` call, then request the same ID via `{ type: 'user', connection }` and assert (a) the response is served from cache (no second `nock` interceptor consumed) and (b) the body is unchanged; repeat with priming/reading order reversed (`user` primes, `vinylmania` reads).

### Implementation for User Story 1

- [ ] T013 [US1] In `backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts`, refactor `createDiscogsHttpClient()` to accept an optional `getAuthorization: () => string | undefined` parameter (default = existing `buildAuthorizationHeader`), and move the `Authorization` header assignment from the static `axios.create({ headers })` call into the existing request interceptor (recomputed per request), per `research.md` Decision 4. Existing behavior for the no-argument call (used by `getDiscogsHttpClient()`) must be unchanged.
- [ ] T014 [US1] In the same file, add `getCatalogOauthCredentials(): ConsumerCredentials` (reads `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`, mirroring `discogsCollectionAdapter.ts:43-49`'s `getCredentials()`) and `buildUserAuthorizationHeader(connection: DiscogsConnection): string` (calls `buildProtectedResourceHeader` from `backend/src/adapters/discogsOauth/oauthSignature.ts`, imported — not reimplemented).
- [ ] T015 [US1] Add `getClientForCredential(credential: CatalogCredential): AxiosInstance` in the same file: returns the existing `getDiscogsHttpClient()` singleton for `{ type: 'vinylmania' }`; builds a fresh `createDiscogsHttpClient(() => buildUserAuthorizationHeader(credential.connection))` per call for `{ type: 'user' }` (no caching across users, mirroring `discogsCollectionAdapter.ts`'s per-call `createClient`).
- [ ] T016 [US1] Update the six exported functions in `discogsCatalogAdapter.ts` (`getRelease`, `getArtist`, `getMasterRelease`, `getMasterReleaseVersions`, `getReleaseRating`, `searchCatalog`) to call `getClientForCredential(credential)` instead of unconditionally `getDiscogsHttpClient()`, making T009 pass.
- [ ] T017 [US1] Update `backend/src/adapters/discogsCatalog/discogsRoutes.ts`: in the `/releases/:discogsId`, `/masters/:discogsId`, and `/masters/:discogsId/versions` handlers, call `resolveCatalogCredential(discogsConnectionAdapter, req.auth?.uid)` (inject the existing `DiscogsConnectionPort` implementation, mirroring how `libraryRoutes.ts` already wires `discogsConnection`) and pass the result as the new leading argument to `getRelease`/`getMasterRelease`/`getMasterReleaseVersions`, making T010 and T011 pass.
- [ ] T018 [US1] Update `backend/src/application/discogsCatalog/searchCatalogWithRatings.ts`: add `discogsConnection: DiscogsConnectionPort` to `createSearchCatalogWithRatingsUseCase`'s deps, resolve the credential once per `searchCatalogWithRatings(query, options)` call, and thread the *same* resolved `CatalogCredential` into its own `discogsCatalog.searchCatalog(...)` call and every internal `getMasterRelease`/`getReleaseRating` enrichment call (no per-item re-resolution, per `research.md` Decision 3).
- [ ] T019 [US1] Update `discogsRoutes.ts`'s `/search` handler to pass `req.auth?.uid` into `searchCatalogWithRatings`'s new signature (wire the `discogsConnectionAdapter` dependency into the `createSearchCatalogWithRatingsUseCase({...})` call at the top of the file).
- [ ] T020 [US1] Run `cd backend && npm test -- discogsCatalog` — T009, T010, T011, and T012 now pass; confirm no other catalog test regressed.

**Checkpoint**: A linked user's catalog requests are genuinely signed with their own account. Independently demoable/testable now.

---

## Phase 4: User Story 2 - Usuario sin cuenta vinculada sigue usando la app con normalidad (Priority: P1)

**Goal**: Prove the unlinked-user path is byte-for-byte unchanged by the US1 refactor — this story is primarily a non-regression guarantee, since `getClientForCredential`'s `vinylmania` branch already reuses the pre-existing singleton untouched.

**Independent Test**: As an authenticated user with no `discogsConnections/{uid}` doc, call all four catalog routes; responses and `nock`-observed `Authorization` header (`Discogs token=<DISCOGS_TOKEN>`) are identical to pre-053 behavior — per `quickstart.md` Scenario 2.

### Tests for User Story 2 ⚠️

- [ ] T021 [P] [US2] Write failing test in `backend/tests/contract/discogsCatalog/discogsCatalogCredential.contract.test.ts` (extends T009's file): `discogsCatalogAdapter.getRelease({ type: 'vinylmania' }, id)` (and the other five methods) sends `Authorization: Discogs token=<DISCOGS_TOKEN>` — never an `OAuth ...` header.
- [ ] T022 [P] [US2] Write failing route-level test (extends T010's files, `discogsRelease.contract.test.ts`/`discogsMaster.contract.test.ts`/`discogsSearch.contract.test.ts`): an authenticated user with **no** `discogsConnections/{uid}` doc still receives `200` from `/releases/:id`, `/masters/:id`, `/search`, and the `nock` interceptor confirms the `DISCOGS_TOKEN`-authenticated stub (not an OAuth one) was hit.

### Implementation for User Story 2

- [ ] T023 [US2] No production code change expected — `getClientForCredential`'s `vinylmania` branch (T015) already returns the untouched `getDiscogsHttpClient()` singleton. If T021/T022 fail, the bug is in T013–T016 (the `vinylmania` default path was accidentally altered); fix there, not by adding new code for this story.
- [ ] T024 [US2] Run the **full** pre-existing catalog contract/integration suite (`backend/tests/contract/discogsCatalog/*`, `backend/tests/integration/discogsCatalog/*`) unmodified and confirm 100% pass — these tests exercised only the unlinked/`vinylmania` path before this feature existed, so they double as this story's regression gate.

**Checkpoint**: Unlinked users are provably unaffected. US1 + US2 both independently verified.

---

## Phase 5: User Story 3 - Credenciales vinculadas revocadas no se sustituyen en silencio (Priority: P1)

**Goal**: A revoked linked account never falls back to `DISCOGS_TOKEN`; the user gets the same `discogs_link_invalid` "relink required" outcome collection already has — surfaced both by the API and by every catalog surface the user is actually looking at, including the master-versions table.

**Independent Test**: Seed a `DiscogsConnection`, stub Discogs to return `401` for that connection's OAuth-signed request only, call each catalog route as that user, and confirm: (a) `401 discogs_link_invalid` is returned, (b) the `DISCOGS_TOKEN`-authenticated stub was never hit, (c) an unlinked user hitting a stubbed `401` from `DISCOGS_TOKEN` itself still gets the pre-053 `500 internal_error` (not `discogs_link_invalid`) — per `quickstart.md` Scenario 3.

### Tests for User Story 3 ⚠️

- [ ] T025 [P] [US3] Write failing test (extends `discogsCatalogCredential.contract.test.ts`): a `user`-credentialed call to any of the six adapter methods, stubbed to `401`/`403`, rejects with `DiscogsAuthError` (already true today for any credential — this test documents/locks the existing behavior as a precondition for T027).
- [ ] T026 [P] [US3] Write failing route-level tests in `discogsRelease.contract.test.ts`/`discogsMaster.contract.test.ts`/`discogsSearch.contract.test.ts`:
  1. Linked user, Discogs stub returns `401` for the OAuth-signed request → route returns `401 { error: 'discogs_link_invalid', message: "Your Discogs link is no longer valid. Please re-link your account from your profile." }`; assert (via `nock`'s pending-interceptors check) that no `Discogs token=...`-authenticated request was ever made.
  2. Unlinked user, Discogs stub returns `401` for the `DISCOGS_TOKEN`-authenticated request → route returns the pre-053 `500 internal_error` (mis-attribution guard, per `contracts/discogs-catalog-api.md`/`research.md` Decision 6) — **not** `discogs_link_invalid`.
- [ ] T027 [P] [US3] Write failing unit test `backend/tests/unit/discogsCatalog/adapters/respondDiscogsAuthError.test.ts`: the shared helper (T029) returns the `401 discogs_link_invalid` body only when given `credential.type === 'user'` and a `DiscogsAuthError`; returns `undefined`/`false` (caller falls through) otherwise.

### Implementation for User Story 3

- [ ] T028 [US3] Extract the `DiscogsAuthError → 401 discogs_link_invalid` mapping (status + body, byte-identical to `backend/src/adapters/library/libraryRoutes.ts:99-107`) into a new shared helper `backend/src/adapters/discogs/respondDiscogsAuthError.ts`, gated on `credential.type === 'user'` per `research.md` Decision 6, making T027 pass.
- [ ] T029 [US3] Update `backend/src/adapters/library/libraryRoutes.ts`'s `respondCollectionError` to call the new shared helper for its `DiscogsAuthError` branch instead of inlining the status/body literal (collection always uses `{ type: 'user', connection }`, so behavior is unchanged — confirm existing library tests still pass).
- [ ] T030 [US3] Update each `catch` block in `backend/src/adapters/discogsCatalog/discogsRoutes.ts` (`/search`, `/releases/:discogsId`, `/masters/:discogsId`, `/masters/:discogsId/versions`) to call the shared helper (passing the `credential` resolved earlier in that handler) before falling through to the existing `DiscogsNotFoundError`/`DiscogsRateLimitError`/`DiscogsUnavailableError`/generic-500 branches, making T026 pass.
- [ ] T031 [P] [US3] Add `frontend/src/components/DiscogsRelinkNotice.tsx`, extracting the relink-prompt markup currently duplicated in `frontend/src/pages/ReleaseDetailPage.tsx:94-96` and `frontend/src/pages/SearchResultsPage.tsx:144-152` (text + "Go to your profile" link), per the Constitution's "extract once repeated" UI rule and `research.md` Decision 9.
- [ ] T032 [US3] Update `frontend/src/pages/SearchResultsPage.tsx`, `frontend/src/pages/ReleaseDetailPage.tsx`, and `frontend/src/pages/MasterReleaseDetailPage.tsx` to detect `err instanceof ApiError && err.code === 'discogs_link_invalid'` on the page's underlying catalog **query** error (`useCatalogSearchInfinite`/`useCatalogRelease`/`useCatalogMaster` from `frontend/src/queries/discogsQueries.ts`), not only on the existing "add to library" mutation's error, and render `<DiscogsRelinkNotice />` (T031) for that case.
- [ ] T033 [US3] Update `frontend/src/components/MasterVersionsTable.tsx` to destructure `error`/`isError` from its `useCatalogMasterVersions(discogsId, page)` call (today it destructures only `{ data, isLoading }`, per plan review finding G1) and render `<DiscogsRelinkNotice />` (T031) when `err instanceof ApiError && err.code === 'discogs_link_invalid'`, matching T032's handling on the surrounding page — this component queries independently of `MasterReleaseDetailPage`'s own `useCatalogMaster`, so it was otherwise the one catalog surface with no error handling at all.
- [ ] T034 [P] [US3] Add/update Vitest unit tests for the three pages and `MasterVersionsTable.tsx` (existing test files, e.g. `SearchResultsPage.test.tsx`/`ReleaseDetailPage.test.tsx` if present, else create alongside; new `MasterVersionsTable.test.tsx` for the component) asserting the relink notice renders when the catalog query itself — including `useCatalogMasterVersions` — errors with `discogs_link_invalid`.
- [ ] T035 [US3] Add Playwright e2e spec `e2e/discogs-catalog-relink.spec.ts`: a test user with a linked-but-stubbed-revoked Discogs account browses search results and a release page and sees the reconnect prompt (per Constitution's mandatory e2e gate for `/frontend` PRs, and `quickstart.md`'s frontend manual check).
- [ ] T036 [US3] Run `cd backend && npm test -- discogsCatalog library` and `cd frontend && npm test -- SearchResultsPage ReleaseDetailPage MasterReleaseDetailPage MasterVersionsTable` — T025–T027 and T034 now pass.

**Checkpoint**: Revoked credentials never silently fall back, at both the API and UI layers — including master-versions browsing. US1, US2, US3 all independently verified.

---

## Phase 6: User Story 4 - Trazabilidad de qué credencial identificó cada petición (Priority: P2)

**Goal**: Every actual Discogs HTTP call's structured log line records which credential type identified it, without ever logging a token/secret value.

**Independent Test**: Trigger one request of each outcome (linked success, unlinked success, revoked-link failure) with log capture enabled; assert `meta.credentialType` is `'user'`/`'vinylmania'`/`'user'` respectively, and no log line anywhere contains the literal `accessToken`/`accessTokenSecret`/`DISCOGS_TOKEN` value — per `quickstart.md` Scenario 4.

### Tests for User Story 4 ⚠️

- [ ] T037 [P] [US4] Write failing test in `backend/tests/unit/discogsCatalog/adapters/discogsCatalogAdapter.logging.test.ts` (new file, spying on `backend/src/config/logger.ts`'s exported logger): a successful `user`-credentialed call logs `meta.credentialType: 'user'`; a successful `vinylmania`-credentialed call logs `meta.credentialType: 'vinylmania'`; an `auth_failed` (401/403) call logs `meta.credentialType` matching the credential that failed; no captured log call's serialized output contains the fixture's `accessToken`/`accessTokenSecret`/`DISCOGS_TOKEN` string values.

### Implementation for User Story 4

- [ ] T038 [US4] In `backend/src/adapters/discogsCatalog/discogsCatalogAdapter.ts`, thread `credential` into `logRateLimit(endpoint, outcome, response, attempts)` (add a `credentialType` argument) and into the response interceptor's `auth_failed`/`unavailable` `logger.warn`/`logger.error` calls, adding `credentialType: credential.type` inside each call's existing `meta` object, per `data-model.md` and `research.md` Decision 7. `credential` must already be in scope at each interceptor call site by threading it through `createDiscogsHttpClient`'s closure (from T013–T015), not by widening `LogEvent`'s typed fields.
- [ ] T039 [US4] Run `cd backend && npm test -- discogsCatalog` — T037 passes; confirm no log call anywhere in the diff passes a raw token/secret value (manual review, since this is a security-relevant invariant no single test can fully guarantee).

**Checkpoint**: All four user stories independently functional and testable. Full feature complete per spec.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all four stories together.

- [ ] T040 Run the full `quickstart.md` validation suite end-to-end (all four scenarios + the frontend manual check + the non-regression companion in Scenario 3) against a local emulator run.
- [ ] T041 [P] Run `cd backend && npm test` (full suite) and `cd frontend && npm test` (full suite) to confirm zero regressions outside the catalog/library/frontend files touched by this feature.
- [ ] T042 [P] Run `cd e2e && npx playwright test discogs-catalog-relink.spec.ts` to confirm the new e2e spec passes against a running dev stack.
- [ ] T043 Re-read `specs/053-catalog-oauth-attribution/spec.md`'s acceptance scenarios (all 4 user stories) against the implemented behavior and confirm each `Given/When/Then` holds.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** — `CatalogCredential`/`DiscogsCatalogPort`/`resolveCatalogCredential` are shared by every story.
- **User Story 1 (Phase 3)**: Depends on Foundational only. Delivers the core credential-threading machinery every later story builds on.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1's `getClientForCredential`/`getDiscogsHttpClient` existing (it verifies US1's `vinylmania` branch, not a from-scratch feature) — sequenced after US1 for that reason, though its *tests* could technically be written in parallel with US1's implementation.
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 (needs `resolveCatalogCredential` wired into routes to know `credential.type` in the `catch` block).
- **User Story 4 (Phase 6)**: Depends on Foundational + US1 (needs `credential` in scope at the log call sites T038 modifies).
- **Polish (Phase 7)**: Depends on all four stories being complete.

### Parallel Opportunities

- T002 and T003 (Phase 2) can run in parallel — different files, no dependency between them.
- Within US1: T009, T010, T011, and T012 (tests) can be written in parallel; T013→T014→T015→T016 are sequential (each builds on the prior in the same file), but T017/T018/T019 (different route/use-case files) can proceed in parallel once T016 lands.
- Within US3: T025, T026, T027 (tests, different files) can run in parallel; T031 (new frontend component) can start in parallel with T028 (backend helper) since they're unrelated files — T032 depends on both T030 (backend contract live) and T031. T033 (`MasterVersionsTable` implementation) can proceed in parallel with T031/T032 since it's a separate file; its folded-in test coverage (T034) depends on both landing first.
- T041 and T042 (Phase 7) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1) — linked users are now correctly attributed.
3. **STOP and VALIDATE**: run `quickstart.md` Scenario 1 manually.
4. US2/US3/US4 are all still required before this feature is spec-complete (US2/US3 are P1, not optional) — but US1 alone is independently demoable as "linked users get correct attribution," which is the spec's stated core objective.

### Incremental Delivery

1. Setup + Foundational → shared contract exists, nothing behaves differently yet.
2. US1 → linked users correctly attributed (deploy/demo-able).
3. US2 → unlinked users provably unaffected (regression gate — deploy alongside US1 in practice, since both are P1 and share the same PR realistically).
4. US3 → revoked links never silently fall back, at API and UI (deploy/demo-able; closes the compliance gap the spec exists to fix).
5. US4 → audit logging (deploy/demo-able; enables ongoing compliance verification).
