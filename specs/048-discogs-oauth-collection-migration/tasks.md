---

description: "Task list template for feature implementation"
---

# Tasks: Discogs OAuth + Collection Domain Migrated to Hexagonal Architecture

**Input**: Design documents from `/specs/048-discogs-oauth-collection-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE) applies to
this project. See "Migration Strategy" below for how Test-First applies to a pure structural
refactor of already-covered production code, split by a genuine business-rule extraction (not just
a file move) this time.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story. All paths are relative to the repository root; `backend/` is implied for
every `src/`/`tests/` path below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Migration Strategy (read before starting)

This feature relocates already-tested, already-live production code, following the copy-then-cutover
pattern the library (046) and catalog (047) migrations validated — with one addition: unlike those
two, this feature genuinely **splits** business logic (pending-token ownership/expiration, the
already-connected check) out of `discogsOauthService.ts`'s flat functions into application-layer use
cases depending on a port, rather than a pure relocation. `backend/src/discogs/oauth/*`,
`backend/src/discogs/collection/*`, and `backend/src/routes/discogsOauth.ts` keep serving all traffic,
completely unmodified, until Phase 5's cutover. Phases 3 and 4 build the new
`ports/discogsOauth/`, `adapters/discogsOauth/`, `application/discogsOauth/` files **additively**,
alongside the untouched originals.

Per research.md Decision 2, the "already connected" check (`if (await getConnection(uid)) { 409 }`)
lives **only** in `routes/discogsOauth.ts` today — `discogsOauthService.ts`'s own
`startLink`/`completeLink` have no such check and `tests/unit/discogsOauthService.test.ts` never
exercises it (verified: its `startLink`/`completeLink` describe blocks contain no already-connected
case). This means the already-connected behavior for the two new use cases is **new test coverage**
(T013/T014 below), not a relocation of an existing assertion — `tests/contract/discogsOauthRoutes.test.ts`
already covers it at the HTTP level (`'returns 409 already_connected when a connection exists'`,
both `/request` and `/complete`) and needs zero changes, since `handleFailure`'s mapping is unchanged.

Per research.md Decision 6, `fieldsCacheKey(uid)` moves out of `collectionClient.ts` into
`domain/discogsOauth/collectionTypes.ts` as a pure function (not into the collection adapter) —
this is what lets `disconnectConnection` (US1) depend on it without waiting on the collection
adapter (US2) to exist first, keeping the two stories genuinely independent per spec.md.

## Phase 1: Setup

**Purpose**: Establish a pre-migration baseline to measure "no regression" against.

- [X] T001 Run `cd backend && npm test -- --testPathPattern="tests/(unit|contract)/(discogsOauthService|discogsOauthSignature|discogsOauthRoutes|collectionClient.contract|conditionGrading)"`
  and confirm all 5 files named in the parent user story's "Prueba independiente" pass today. This is
  the baseline spec.md FR-008/SC-001 must not regress.
- [X] T002 Run
  `grep -rn "jest.mock(" backend/tests/unit/discogsOauthService.test.ts backend/tests/unit/discogsOauthSignature.test.ts backend/tests/contract/discogsOauthRoutes.test.ts backend/tests/contract/collectionClient.contract.test.ts backend/tests/unit/conditionGrading.test.ts`
  and confirm zero matches (all four test the real Firestore emulator/`nock` stack, no module-path
  mocking) — spec.md's Edge Case "How does this migration confirm no existing test relies on a
  `jest.mock()` call keyed to a module's current file path?". Already verified true as of this
  migration's design; this task makes that check explicit and re-runnable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared `CachePort` (research.md Decision 6) and relocate the pure
domain/adapter-utility files both User Story 1 and User Story 2 depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Update `backend/src/ports/cache/cachePort.ts` per `contracts/cache-port.md`: add
  `invalidate(key: string): Promise<void>` to the existing `CachePort` interface (fail-soft, MUST NOT
  reject), alongside the unchanged `has`/`set`/`withCache`.
- [X] T004 [P] Update `backend/src/adapters/cache/cacheAdapter.ts` per `contracts/cache-port.md`: add
  an `invalidate` implementation that delegates to `invalidateCache` exported from
  `../../cache/cacheAside` (unmoved). Export it as part of `cacheAdapter: CachePort` alongside the
  unchanged `has`/`set`/`withCache`.
- [X] T005 [P] Create `backend/src/domain/discogsOauth/types.ts` — copy `DiscogsConnection`,
  `PendingOAuthRequest`, `ConnectionStatus` unchanged from `backend/src/discogs/oauth/types.ts`. Leave
  the original file in place (still imported by `discogsOauthService.ts`, `collectionClient.ts`,
  `routes/discogsOauth.ts`, the library domain's provisional ports) until Phase 5 deletes it.
- [X] T006 [P] Create `backend/src/domain/discogsOauth/collectionTypes.ts` — copy `CollectionInstance`,
  `InstanceRef`, `CollectionFieldMap` unchanged from `backend/src/discogs/collection/collectionTypes.ts`,
  **plus** relocate `fieldsCacheKey(uid: string): string` here as a new pure export (moved from
  `backend/src/discogs/collection/collectionClient.ts`, unchanged body — `` `discogs:fields:${uid}` ``)
  so it has no dependency on either adapter this feature builds (research.md Decision 6). Leave both
  original files' exports in place until Phase 5 deletes them.
- [X] T007 [P] Create `backend/src/adapters/discogsOauth/oauthHttpClient.ts` — relocate
  `backend/src/discogs/oauth/oauthHttpClient.ts` unchanged (`getOauthApiBaseUrl`,
  `getAuthorizeBaseUrl`, `createOauthHttpClient`, `parseTokenResponse`), updating only its
  `discogsErrors` import path to `../../discogs/discogsErrors` (unmoved). Leave the original file in
  place until Phase 5 deletes it.
- [X] T008 [P] Create `backend/src/adapters/discogsOauth/oauthSignature.ts` — relocate
  `backend/src/discogs/oauth/oauthSignature.ts` unchanged (no import changes needed — it has no
  internal dependencies beyond `node:crypto`). Leave the original file in place until Phase 5 deletes
  it.
- [X] T009 Copy `backend/tests/unit/discogsOauthSignature.test.ts` to
  `backend/tests/unit/discogsOauth/adapters/discogsOauthSignature.test.ts`, updating its import from
  `../../src/discogs/oauth/oauthSignature` to `../../../../src/adapters/discogsOauth/oauthSignature`. Run
  the new copy and confirm it passes (T008 already landed). Leave the original file in place until
  Phase 5 deletes it.
- [X] T010 Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/library"`
  and confirm every library-domain test still passes — the regression gate proving the `CachePort`
  extension (T003/T004) didn't disturb the already-migrated library domain (spec.md SC-004 baseline;
  quickstart.md step 4, run early). Required fixing two pre-existing `fakeCache(): jest.Mocked<CachePort>`
  test helpers (`tests/unit/library/application/syncLibrary.test.ts` and
  `tests/unit/discogsCatalog/application/searchCatalogWithRatings.test.ts`) that were missing the new
  `invalidate` mock, causing a TS2322 compile error — not a design gap, just two call sites the
  interface extension's own test-fixture impact wasn't previously enumerated for.

**Checkpoint**: The shared `CachePort` has `invalidate`; `domain/discogsOauth/types.ts`,
`collectionTypes.ts` (with `fieldsCacheKey`), and the two relocated adapter-utility files
(`oauthHttpClient.ts`, `oauthSignature.ts`) exist and are proven. `discogs/oauth/*`,
`discogs/collection/*`, and `routes/discogsOauth.ts` still exist, unmodified, still serving
production traffic.

---

## Phase 3: User Story 1 - Linking-flow rules isolated behind a single Discogs connection port (Priority: P1)

**Goal**: `startLink`, `completeLink`, `getConnectionStatus`, `disconnectConnection` — each a new
application-layer use case — depend only on `DiscogsConnectionPort` and (for disconnect) `CachePort`,
preserving every existing rule (pending-token ownership/expiration, the OAuth handshake, cache
invalidation on disconnect) exactly, plus the new already-connected check research.md Decision 2
moves out of the route.

**Independent Test**: Run the four use cases against a fake `DiscogsConnectionPort`, confirming
pending-token lookup, ownership mismatch, expiration, and the already-connected check are each
exercised without a real Firestore instance or real network call (spec.md US1). Depends on Phase 2
only — does not need Phase 4's collection port to exist (research.md Decision 6's `fieldsCacheKey`
relocation removes that dependency).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T011 [US1] Define `backend/src/ports/discogsOauth/discogsConnectionPort.ts` per
  `contracts/discogs-connection-port.md` (interface only — `createPendingRequest`,
  `getPendingRequest`, `deletePendingRequest`, `exchangeAccessToken`, `fetchIdentity`,
  `saveConnection`, `getConnection`, `deleteConnection`, `markInitialLibrarySync`).
- [X] T012 [US1] Create `backend/src/domain/discogsOauth/discogsOauthErrors.ts` — extract
  `DiscogsOauthFlowError` (codes `invalid_request`/`expired_request`/`already_connected`) unchanged
  from its current inline definition in `backend/src/discogs/oauth/discogsOauthService.ts`.
- [X] T013 [P] [US1] Write `backend/tests/unit/discogsOauth/application/startLink.test.ts` — new
  test, against a hand-built fake `DiscogsConnectionPort`. Cover: no existing connection → calls
  `createPendingRequest(uid)` and returns its `authorizeUrl`; an existing connection →
  rejects with `DiscogsOauthFlowError` code `already_connected` **without** calling
  `createPendingRequest`. Run it and confirm it fails (module not found).
- [X] T014 [P] [US1] Write `backend/tests/unit/discogsOauth/application/completeLink.test.ts` — new
  test, against a hand-built fake `DiscogsConnectionPort`. Cover: an existing connection → rejects
  `already_connected` without touching the pending request; unknown/absent pending request → rejects
  `invalid_request`; `pending.uid !== uid` → rejects `invalid_request` **without** calling
  `deletePendingRequest`; `pending.expiresAt` in the past (relative to real wall-clock time, no clock
  injection needed — fabricate an already-past timestamp in the fake, matching
  `application/library/syncLibrary.ts`'s existing precedent of calling `Date`/`Date.now()` directly
  in application code) → calls `deletePendingRequest` then rejects `expired_request`; the happy path →
  calls `exchangeAccessToken`, then `fetchIdentity`, then `saveConnection`, then
  `deletePendingRequest`, in that order, returning the resulting `ConnectionStatus`. Run it and
  confirm it fails (module not found).
- [X] T015 [US1] Copy `backend/tests/unit/discogsOauthService.test.ts` to
  `backend/tests/integration/discogsOauth/discogsOauthService.test.ts`, updating its imports: replace
  `import { completeLink, DiscogsOauthFlowError, disconnect, getConnection, startLink } from
  '../../src/discogs/oauth/discogsOauthService'` with `startLink`/`completeLink` from
  `../../../src/application/discogsOauth/startLink` / `completeLink`, `disconnect` →
  `disconnectConnection` from `../../../src/application/discogsOauth/disconnectConnection`,
  `getConnection` from `../../../src/adapters/discogsOauth/discogsConnectionAdapter` (a direct
  port-method call — no application-layer wrapper exists for this pass-through, per
  `contracts/discogs-connection-port.md`), and `DiscogsOauthFlowError` from
  `../../../src/domain/discogsOauth/discogsOauthErrors`. Every `describe`/`it` body and assertion is
  otherwise **unchanged** — this file never tested the already-connected check (that's new coverage
  in T013/T014). Run the new copy and confirm it fails (module not found). Leave the original file in
  place until Phase 5 deletes it.

### Implementation for User Story 1

- [X] T016 [US1] Implement `backend/src/adapters/discogsOauth/discogsConnectionAdapter.ts` —
  implements `DiscogsConnectionPort`. Relocate from `discogs/oauth/discogsOauthService.ts` unchanged:
  the Firestore `pendingDoc`/`connectionDoc` helpers, `getCredentials`, and the raw Firestore
  read/write/delete bodies of `getPendingRequest`/`deletePendingRequest`/`saveConnection`/
  `getConnection`/`deleteConnection`/`markInitialLibrarySync`; the raw OAuth handshake HTTP calls
  (`createPendingRequest` = today's request-token call + `pendingDoc(...).set(...)` +
  `authorizeUrl` construction via `getAuthorizeBaseUrl()`, reading
  `DISCOGS_OAUTH_CALLBACK_URL` from `process.env` internally rather than taking it as a
  parameter — adapter-owned configuration, mirroring `getCredentials()`'s existing
  handling of the consumer key/secret; `exchangeAccessToken` = today's
  `/oauth/access_token` call — on a Discogs 4xx (verified today via
  `isAxiosError(err) && err.response.status >= 400 && err.response.status < 500`), throw
  `DiscogsOauthFlowError('expired_request', ...)` **directly from this method** — never
  a raw `axios`-derived error — so `completeLink` (application layer) never needs to
  import `axios` to classify the failure (Constitution Principle VIII); `fetchIdentity`
  = today's `/oauth/identity` call), importing `createOauthHttpClient`/
  `getAuthorizeBaseUrl`/`parseTokenResponse` from the relocated `./oauthHttpClient`,
  signing headers via the relocated `./oauthSignature`, and types from
  `../../domain/discogsOauth/types`. Every existing `logger.info/warn` call in these bodies is
  preserved verbatim. Export each method as a named function plus
  `export const discogsConnectionAdapter: DiscogsConnectionPort = { ... }`.
- [X] T017 [US1] Implement `backend/src/application/discogsOauth/startLink.ts` — factory
  `createStartLinkUseCase(deps: { discogsConnection: DiscogsConnectionPort })` returning
  `startLink(uid)`: call `discogsConnection.getConnection(uid)`; if present, throw
  `DiscogsOauthFlowError('already_connected', ...)` (research.md Decision 2); otherwise call
  `discogsConnection.createPendingRequest(uid)` and return `{ authorizeUrl }`, logging
  `link_started` exactly as `discogsOauthService.ts` does today. Run T013 and confirm it now passes.
- [X] T018 [US1] Implement `backend/src/application/discogsOauth/completeLink.ts` — factory
  `createCompleteLinkUseCase(deps: { discogsConnection: DiscogsConnectionPort })` returning
  `completeLink(uid, oauthToken, oauthVerifier)`: relocate the exact ownership/expiration/exchange
  orchestration from today's `completeLink` (already-connected check first, per research.md Decision
  2; then `getPendingRequest`; unknown → `invalid_request`; `pending.uid !== uid` →
  `invalid_request` without deleting; expired → delete then `expired_request`; otherwise call
  `exchangeAccessToken` then `fetchIdentity` then `saveConnection` then `deletePendingRequest`,
  returning the `ConnectionStatus`) — wrap the `exchangeAccessToken`/`fetchIdentity` calls in a
  try/catch that, on a caught `DiscogsOauthFlowError`, calls `deletePendingRequest(oauthToken)`
  before re-throwing (T016's adapter throws this directly on a Discogs 4xx; this use case never
  inspects the raw error itself), preserving every `logger.info`/`logFailure` call verbatim. Run
  T014 and confirm it now passes; then run T015 and confirm every describe block except
  `disconnect (US2)`/`getConnection` now passes (those need T020).
- [X] T019 [US1] Implement `backend/src/application/discogsOauth/getConnectionStatus.ts` — factory
  `createGetConnectionStatusUseCase(deps: { discogsConnection: DiscogsConnectionPort })` returning
  `getConnectionStatus(uid)`: call `getConnection(uid)`; return `{ connected: false }` if absent,
  else `{ connected: true, discogsUsername, linkedAt }` — relocated unchanged from today's
  `getStatus`.
- [X] T020 [US1] Implement `backend/src/application/discogsOauth/disconnectConnection.ts` — factory
  `createDisconnectConnectionUseCase(deps: { discogsConnection: DiscogsConnectionPort; cache:
  CachePort })` returning `disconnectConnection(uid)`: call `deleteConnection(uid)`, then
  `cache.invalidate(fieldsCacheKey(uid))` (importing `fieldsCacheKey` from
  `../../domain/discogsOauth/collectionTypes`, per research.md Decision 6 — replacing today's direct
  `invalidateCache` import from `cache/cacheAside`), then log `disconnected` exactly as today. Run
  T015 in full and confirm every describe block now passes.

**Checkpoint**: `DiscogsConnectionPort` and its adapter exist and are proven against a fake port
(T013/T014) and against the real Firestore emulator/`nock` stack (T015), for every linking-flow rule
including the already-connected check. Nothing is wired into production routes yet —
`discogs/oauth/discogsOauthService.ts` and `routes/discogsOauth.ts` are unaffected.

---

## Phase 4: User Story 2 - Authenticated Collection API access isolated behind a collection port (Priority: P1)

**Goal**: Every authenticated Discogs Collection API call goes through `DiscogsCollectionPort`,
implemented by `discogsCollectionAdapter.ts`, preserving the shared resilience (rate-limit smoothing,
circuit breaker, retry) and OAuth 1.0a per-request signing exactly, with the field-map lookup now
cached via the shared `CachePort` instead of a direct `cache/cacheAside.ts` import.

**Independent Test**: Stub the outbound OAuth-signed HTTP calls (`nock`) that the adapter depends on
— rather than a real Discogs API call — and confirm field-map, instance-listing, add/remove, rating,
and field-edit operations behave correctly (spec.md US2). Depends on Phase 2 only (`fieldsCacheKey`
already lives in `domain/discogsOauth/collectionTypes.ts`, T006) — independent of Phase 3.

### Tests for User Story 2 ⚠️ (write first, confirm it fails)

- [X] T021 [US2] Define `backend/src/ports/discogsOauth/discogsCollectionPort.ts` per
  `contracts/discogs-collection-port.md` (interface only — `getFieldMap`, `listAllInstances`,
  `getInstancesForRelease`, `addReleaseToCollection`, `deleteInstance`, `setRating`, `setFieldValue`
  — the same 7-method shape the library domain's provisional port already defines).
- [X] T022 [US2] Copy `backend/tests/contract/collectionClient.contract.test.ts` to
  `backend/tests/contract/discogsOauth/collectionClient.contract.test.ts`, updating its imports:
  `addReleaseToCollection`/`deleteInstance`/`getFieldMap`/`getInstancesForRelease`/
  `listAllInstances`/`setFieldValue`/`setRating` from `../../src/discogs/collection/collectionClient`
  → `../../../src/adapters/discogsOauth/discogsCollectionAdapter`; `CollectionFieldMap` type from
  `../../src/discogs/collection/collectionTypes` → `../../../src/domain/discogsOauth/collectionTypes`;
  `DiscogsConnection` type from `../../src/discogs/oauth/types` →
  `../../../src/domain/discogsOauth/types`. Its `getRelease` import from
  `../../src/adapters/discogsCatalog/discogsCatalogAdapter` (already-migrated catalog domain, used
  only for seeding test data) is unchanged. Run the new copy and confirm it fails (module not found).
  Leave the original file in place until Phase 5 deletes it.

### Implementation for User Story 2

- [X] T023 [US2] Implement `backend/src/adapters/discogsOauth/discogsCollectionAdapter.ts` —
  implements `DiscogsCollectionPort`. Relocate from `discogs/collection/collectionClient.ts`
  unchanged: `createClient` (the per-call axios instance with its request/response interceptor pair,
  `CircuitOpenError`, `ResilienceRequestState`/`ResilienceConfig`, `delay`), importing
  `discogsRateLimiter.ts`/`discogsCircuitBreaker.ts`/`discogsRetry.ts`/`discogsErrors.ts` from their
  unmoved `../../discogs/*` location, `getOauthApiBaseUrl` from the relocated `./oauthHttpClient`,
  `buildProtectedResourceHeader` from the relocated `./oauthSignature`, and types from
  `../../domain/discogsOauth/types` / `../../domain/discogsOauth/collectionTypes`. Implement
  `getFieldMap` wrapped in `cacheAdapter.withCache(fieldsCacheKey(connection.uid), 24 * 60 * 60,
  fetcher)` (importing `cacheAdapter` from `../cache/cacheAdapter` and `fieldsCacheKey` from
  `../../domain/discogsOauth/collectionTypes` — replacing today's direct `cache/cacheAside.ts`
  `withCache` import). Implement `listAllInstances`, `getInstancesForRelease`,
  `addReleaseToCollection` (keeping its `__skipRetry` opt-out, uncached), `deleteInstance`,
  `setRating`, `setFieldValue` exactly as today, uncached. Export every method as a named function
  plus `export const discogsCollectionAdapter: DiscogsCollectionPort = { getFieldMap,
  listAllInstances, getInstancesForRelease, addReleaseToCollection, deleteInstance, setRating,
  setFieldValue }`. Run T022 and confirm it now passes.

**Checkpoint**: `DiscogsCollectionPort` and its adapter exist and are proven against `nock`, with
resilience, signing, and field-map caching identical to today. `discogs/collection/collectionClient.ts`
is unaffected — still serving the library domain's production traffic through its old import path.

---

## Phase 5: User Story 3 - HTTP layer and cross-domain consumers depend on the new ports, not the old modules (Priority: P2)

**Goal**: `routes/discogsOauth.ts` becomes a thin driving adapter (parse/validate → one use-case call
→ `handleFailure`, no inline already-connected check); this is the cutover that retires every
pre-migration file in this domain and repoints the library domain's two provisional ports/adapters at
the real ones.

**Independent Test**: Every route handler body is limited to parsing/validation, one call into an
`application/discogsOauth/*` use case, and the existing `handleFailure` error mapping; the existing
OAuth and collection contract/unit suites pass unchanged against the migrated code, and the library
domain's six application files plus its composition root import only this domain's new ports/adapters
(spec.md US3). Depends on Phase 3 AND Phase 4 — matches spec.md's explicit statement that US3 depends
on US1 and US2.

### Tests for User Story 3 ⚠️ (relocate first; they must keep passing throughout this phase)

- [X] T024 [P] [US3] Relocate `backend/tests/contract/discogsOauthRoutes.test.ts` →
  `backend/tests/contract/discogsOauth/discogsOauthRoutes.test.ts` (no source-import changes needed —
  it only calls `createApp()`). Run it and confirm it still passes (routes aren't migrated yet — this
  only proves the relocation is correct).
- [X] T025 [P] [US3] Copy `backend/tests/unit/conditionGrading.test.ts` to
  `backend/tests/unit/discogsOauth/domain/conditionGrading.test.ts`, updating its import from
  `../../src/discogs/collection/conditionGrading` to
  `../../../src/domain/discogsOauth/conditionGrading`. Run the new copy and confirm it fails (module
  not found). Leave the original file in place until this phase's cleanup task deletes it.

### Implementation for User Story 3

- [X] T026 [US3] Implement `backend/src/domain/discogsOauth/conditionGrading.ts` — relocate
  `discogs/collection/conditionGrading.ts` unchanged (research.md Decision 5). Run T025 and confirm
  it now passes.
- [X] T027 [US3] Implement `backend/src/adapters/discogsOauth/discogsRoutes.ts` — the driving
  adapter, relocated from `backend/src/routes/discogsOauth.ts`: instantiate the four use cases
  (`createStartLinkUseCase`, `createCompleteLinkUseCase`, `createGetConnectionStatusUseCase`,
  `createDisconnectConnectionUseCase`) once at module load, wired against
  `discogsConnectionAdapter`/`cacheAdapter` (imported from their new adapter locations). Keep the
  `completeBodySchema` Zod schema, the `ALREADY_CONNECTED` message constant, and `handleFailure`
  (unchanged — it already maps `already_connected`/`expired_request`/`invalid_request`/
  `rate_limited`/generic `DiscogsError`/unknown-error to the same status codes and bodies as today)
  verbatim. Each handler: `POST /request` → parse nothing beyond `req.auth.uid`, call `startLink`,
  respond `{ authorizeUrl }`; `POST /complete` → parse+validate the body, call `completeLink`, respond
  with the `ConnectionStatus`; `DELETE /connection` → call `disconnectConnection`, respond 204;
  `GET /status` → call `getConnectionStatus`, respond with its result. **No handler performs its own
  `getConnection` already-connected check** — that moved into `startLink`/`completeLink` (research.md
  Decision 2) — every handler's only job is parse/validate, one use-case call, and
  `catch (err) { handleFailure(res, route, uid, err) }`.
- [X] T028 [US3] Update `backend/src/app.ts`: change
  `import { discogsOauthRouter } from './routes/discogsOauth'` to
  `import { discogsOauthRouter } from './adapters/discogsOauth/discogsRoutes'` (export name
  `discogsOauthRouter` unchanged).
- [X] T029 [US3] Fix the cross-domain call sites per spec.md FR-011 (data-model.md's Edge Case,
  research.md Decision 7): update the `DiscogsCollectionPort`/`DiscogsConnectionPort` **type**
  imports (both types) in `backend/src/application/library/createLibraryEntry.ts`,
  `backend/src/application/library/deleteLibraryEntry.ts`,
  `backend/src/application/library/getLibraryEntry.ts`, and
  `backend/src/application/library/updateLibraryEntry.ts` from
  `../../ports/library/discogsCollectionPort`/`discogsConnectionPort` to
  `../../ports/discogsOauth/discogsCollectionPort`/`discogsConnectionPort`. Do the same for
  `backend/src/application/library/syncLibrary.ts` (also imports both types), additionally updating
  its `mapLegacyCondition` import from `../../discogs/collection/conditionGrading` to
  `../../domain/discogsOauth/conditionGrading`. `backend/src/application/library/discogsCopyData.ts`
  imports only `DiscogsCollectionPort` (not `DiscogsConnectionPort`) — update that one type import
  the same way. Update
  `backend/src/adapters/library/libraryRoutes.ts`: replace its `discogsCollectionAdapter`/
  `discogsConnectionAdapter` imports (currently `./discogsCollectionAdapter` /
  `./discogsConnectionAdapter`) with imports from
  `../discogsOauth/discogsCollectionAdapter` / `../discogsOauth/discogsConnectionAdapter`, and its
  `MEDIA_CONDITIONS`/`SLEEVE_CONDITIONS` import from `../../discogs/collection/conditionGrading` to
  `../../domain/discogsOauth/conditionGrading`. No business logic changes in any of these seven files.
  Also required fixing `backend/tests/unit/library/application/syncLibrary.test.ts`, which imports
  `DiscogsCollectionPort`/`DiscogsConnectionPort` directly for its own fakes (not caught by data-model.md's
  file enumeration, which covered only `src/`, not `tests/`) — same import-path fix, plus filling in the
  6 new `DiscogsConnectionPort` methods its `fakeDiscogsConnection()` fake didn't previously need. Also
  required the same import-path fix in
  `backend/tests/integration/discogsCatalog/discogsRateLimitSmoothing.test.ts` (catalog domain's own
  test, verified — it directly imports `addReleaseToCollection`/`listAllInstances` from
  `collectionClient.ts` and `DiscogsConnection` from `discogs/oauth/types` to test the shared
  preventive-throttle scenario across both clients; not enumerated in data-model.md/research.md).
- [X] T030 [US3] Delete the now-superseded old source files:
  `backend/src/discogs/oauth/discogsOauthService.ts`, `backend/src/discogs/oauth/oauthHttpClient.ts`,
  `backend/src/discogs/oauth/oauthSignature.ts`, `backend/src/discogs/oauth/types.ts`,
  `backend/src/routes/discogsOauth.ts`, `backend/src/discogs/collection/collectionClient.ts`,
  `backend/src/discogs/collection/collectionTypes.ts`, `backend/src/discogs/collection/conditionGrading.ts`,
  `backend/src/ports/library/discogsCollectionPort.ts`, `backend/src/ports/library/discogsConnectionPort.ts`,
  `backend/src/adapters/library/discogsCollectionAdapter.ts`,
  `backend/src/adapters/library/discogsConnectionAdapter.ts`. Also remove the now-empty
  `backend/src/discogs/oauth/` and `backend/src/discogs/collection/` directories.
- [X] T031 [US3] Delete the now-superseded old test files:
  `backend/tests/unit/discogsOauthService.test.ts`, `backend/tests/unit/discogsOauthSignature.test.ts`,
  `backend/tests/contract/discogsOauthRoutes.test.ts`,
  `backend/tests/contract/collectionClient.contract.test.ts`, `backend/tests/unit/conditionGrading.test.ts`
  — each one's coverage now lives at its Phase 2/3/4/5-relocated path.
- [X] T032 [US3] Run
  `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/discogsOauth"` and
  confirm every relocated/new test (T009, T013, T014, T015, T022, T024, T025) passes against the now
  fully-wired new code — the FR-008/SC-001 regression gate for this domain.
- [X] T033 [US3] Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/library"`
  again and confirm the FR-011 import-path fixes (T029) didn't regress the library domain (mirrors
  quickstart.md step 4, run a second time post-cutover).

**Checkpoint**: All three user stories functional; every pre-migration file in this domain and both
of the library domain's provisional ports/adapters no longer exist;
`adapters/discogsOauth/discogsRoutes.ts` serves `/api/discogs/oauth` unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] Run
  `grep -rnE "from '(axios|firebase-admin)'" backend/src/domain/discogsOauth backend/src/application/discogsOauth backend/src/ports/discogsOauth`
  and confirm zero matches (spec.md SC-002; quickstart.md step 1).
- [X] T035 [P] Run
  `ls backend/src/ports/library/discogsCollectionPort.ts backend/src/ports/library/discogsConnectionPort.ts backend/src/adapters/library/discogsCollectionAdapter.ts backend/src/adapters/library/discogsConnectionAdapter.ts 2>&1`
  and confirm all four report "No such file or directory"; run
  `grep -rn "ports/library/discogsCollectionPort\|ports/library/discogsConnectionPort" backend/src backend/tests`
  and confirm zero matches; additionally run
  `grep -rn "discogs/oauth/discogsOauthService\|discogs/collection/collectionClient" backend/src backend/tests`
  and confirm zero matches (spec.md FR-005/SC-004 — SC-004 names these two pre-migration module paths
  explicitly; quickstart.md step 2).
- [X] T036 Run `cd backend && npm test` (full suite, no path filter) once and confirm every backend
  test file passes, including every domain this feature didn't touch (`feeds/*`, `auth`, the
  already-migrated `library`/`discogsCatalog` domains) — proving no cross-domain blast radius
  (spec.md SC-001; quickstart.md step 5).
- [X] T037 [P] Manually review `backend/src/adapters/discogsOauth/discogsRoutes.ts`: confirm every
  handler body is limited to parsing/validation, one use-case call, and `handleFailure` error mapping,
  with no inline `getConnection`/already-connected check or other business orchestration (spec.md US3
  acceptance scenario 1; quickstart.md step 7).
- [X] T038 Manually verify quickstart.md step 6: confirmed the app boots cleanly with the new
  `adapters/discogsOauth/discogsRoutes.ts` wiring (`TS_NODE_TRANSPILE_ONLY=true node -e "...
  createApp().listen(0)..."`, matching how `npm run dev` transpiles). No real Discogs
  credentials/live Firebase ID token were available in this environment for the literal curl
  walkthrough, so the specific response-shape assertions (409 `already_connected`, 400
  `expired_request`/`invalid_request`, `GET /status`'s exact DTO, disconnect's cache invalidation)
  are verified instead via the already-green `discogsOauthRoutes.test.ts` contract suite (17/17),
  which exercises the identical `createApp()`/route code path against a real Firebase Auth emulator
  and `nock`-stubbed Discogs (spec.md SC-005).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. Independent of US2/US3 (research.md Decision 6
  removed the `fieldsCacheKey` cross-story dependency `disconnectConnection` would otherwise have had
  on Phase 4).
- **User Story 2 (Phase 4)**: Depends on Phase 2 only. Independent of US1/US3.
- **User Story 3 (Phase 5)**: Depends on Phase 3 AND Phase 4 (needs the real
  `discogsConnectionAdapter`/`discogsCollectionAdapter` and all four use cases to wire into routes,
  and both ports to exist for the cross-domain import fixes) — matches spec.md's explicit statement
  that US3 depends on US1 and US2.
- **Polish (Phase 6)**: Depends on Phase 5.

### Parallel Opportunities

- T003, T004, T005, T006, T007, T008 (Phase 2) — different files.
- T013, T014 (Phase 3 new unit tests) — different files, both only need T011/T012.
- T024, T025 (Phase 5 test relocations) — different files.
- T034, T035, T037 (Phase 6) — independent checks.
- **Phase 3 and Phase 4 as a whole** can run in parallel (different engineers/sessions) once Phase 2
  is complete — neither reads or writes the other's files.

---

## Parallel Example: Phase 2 foundational relocations

```bash
Task: "Update ports/cache/cachePort.ts with invalidate"
Task: "Update adapters/cache/cacheAdapter.ts with invalidate"
Task: "Create domain/discogsOauth/types.ts"
Task: "Create domain/discogsOauth/collectionTypes.ts (with fieldsCacheKey)"
Task: "Create adapters/discogsOauth/oauthHttpClient.ts"
Task: "Create adapters/discogsOauth/oauthSignature.ts"
```

## Parallel Example: User Story 1 and User Story 2 as whole phases

```bash
Task: "Complete Phase 3 (User Story 1 — DiscogsConnectionPort)"
Task: "Complete Phase 4 (User Story 2 — DiscogsCollectionPort)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: T013/T014/T015 pass; `discogsConnectionAdapter` and the four linking-flow
   use cases are proven for every rule including the new already-connected check; production traffic
   is still served by the untouched old code, so this is safe to pause on or merge as an incremental,
   behavior-invisible step.

### Incremental Delivery

1. Setup + Foundational → extended `CachePort` and shared domain/adapter-utility files ready.
2. User Story 1 → connection port proven, zero production risk (additive only).
3. User Story 2 → collection port proven, zero production risk (additive only) — independent of US1,
   can be built in parallel.
4. User Story 3 → the cutover: routes rewritten, `app.ts` repointed, the library domain's two
   provisional ports/adapters retired and every consumer repointed, old files deleted. This is the
   only phase that changes what actually serves `/api/discogs/oauth` traffic.
5. Polish → static-import checks, full-suite regression run, manual route-handler review, manual HTTP
   smoke test.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every implementation task in Phases 3-4 has a preceding test task that fails until it lands
  (Constitution Principle I).
- Commit after each checkpoint (end of Phase 2, 3, 4, 5, 6) rather than after every single task.
- Do not delete anything under `backend/src/discogs/oauth/`, `backend/src/discogs/collection/`,
  `backend/src/routes/discogsOauth.ts`, `backend/src/ports/library/discogsCollectionPort.ts`,
  `backend/src/ports/library/discogsConnectionPort.ts`,
  `backend/src/adapters/library/discogsCollectionAdapter.ts`,
  `backend/src/adapters/library/discogsConnectionAdapter.ts`, or the five Phase 1 original test files
  before T030/T031 — every earlier phase depends on the old code and its original tests continuing to
  serve/cover production traffic unmodified.
- `discogsRateLimiter.ts`, `discogsCircuitBreaker.ts`, `discogsRetry.ts`, `discogsErrors.ts`, and
  their dedicated unit tests are **never** touched or relocated by this feature (research.md Decision
  1) — they stay shared infrastructure, now consumed by both the catalog domain (already migrated)
  and this domain.
- The already-connected check's relocation from the route into `startLink`/`completeLink`
  (research.md Decision 2) is a genuine, deliberate behavior-preserving refactor, not a pure move —
  its new test coverage lives in T013/T014, not in a relocated assertion.
