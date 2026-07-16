---

description: "Task list template for feature implementation"
---

# Tasks: Auth/Users Domain Migrated to Hexagonal Architecture, Shared CachePort Consolidated

**Input**: Design documents from `/specs/050-auth-users-hexagonal-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED — Constitution Principle I (Test-First, NON-NEGOTIABLE) applies to
this project. See "Migration Strategy" below for how Test-First applies to this mostly-structural
refactor, which also introduces two brand-new fake-port unit tests this domain could not write
before (spec.md User Stories 1-2).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story. All paths are relative to the repository root; `backend/` is implied for
every `src/`/`tests/` path below unless already prefixed with it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every description

## Migration Strategy (read before starting)

This feature relocates already-tested, already-live production code, following the same
copy-then-cutover pattern the library (046), catalog (047), OAuth+Collection (048), and feeds (049)
migrations validated. Unlike feeds (one domain, no cross-domain consumers), this feature touches
**two** domain pairings (`auth`, `users`) plus a cross-cutting cache relocation, so it has more
cutover points than any prior historia:

1. **User Story 1** (`userService.ts` → `UserRepositoryPort`) is purely additive — `services/userService.ts`
   and `routes/auth.ts` keep serving all traffic, completely unmodified, until Phase 5's cutover.
2. **User Story 2** (`requireAuth` → `AuthVerifierPort`) is additive for its own new files, but its
   phase *does* perform one real cutover: per research.md Decision 7, `middleware/requireAuth.ts`
   cannot be deleted until every one of its five current importers stops pointing at it — four
   already-migrated domains' routes, plus `routes/auth.ts` itself (a one-line bridge fix, not a
   rewrite — `routes/auth.ts`'s Firestore/`userService` calls stay untouched until Phase 5).
3. **User Story 3** (`routes/auth.ts` → `adapters/users/authRoutes.ts`) is the domain's own real
   cutover: it deletes `services/userService.ts`, `routes/auth.ts`, and their original tests.
4. **User Story 4** (cache consolidation) is independent of the folder-naming decisions above but
   depends on Stories 1 and 2 having already removed every direct `firebase-admin` import from this
   domain — its own cutover relocates `cache/cacheAside.ts`/`cache/redisClient.ts` and fixes eight
   ripple-affected test files in already-migrated domains (research.md Decision 6).

Two genuine behavior corrections are scoped into this migration, both already resolved before
implementation starts: (a) research.md Decision 5 — a repeat sign-in updates only `lastSignInAt`,
never identity fields, corrected in spec.md from an overstated original wording; (b) none of this
domain's five existing test files use a path-sensitive `jest.mock()` (they all exercise the real
Auth/Firestore emulators via `tests/helpers/authEmulator.ts`, a plain `fetch`-based client) — the
only path-sensitive test code in scope is the two cache unit tests' dynamic `import()` calls and the
eight ripple-affected files' static imports, both handled explicitly below.

## Phase 1: Setup

**Purpose**: Establish a pre-migration baseline to measure "no regression" against.

- [X] T001 Run
  `cd backend && npx firebase emulators:exec --only auth,firestore "cross-env NODE_ENV=test jest --testPathPattern='tests/(unit|integration|contract)/(userService|requireAuth|auth\.integration|auth\.contract|authPreferencesRoute)\.test\.ts$|tests/unit/cache/(cacheAside|redisClient)\.test\.ts$' --detectOpenHandles --forceExit"`
  and confirm the pre-migration baseline: 7 test suites / 32 tests passing (verified during
  planning). This is the baseline spec.md FR-006/SC-001 must not regress.
- [X] T002 Run `grep -n "jest.mock(" backend/tests/unit/userService.test.ts backend/tests/unit/requireAuth.test.ts backend/tests/contract/auth.contract.test.ts backend/tests/contract/authPreferencesRoute.test.ts backend/tests/integration/auth.integration.test.ts` and confirm zero matches — none of this domain's five auth/user test files use a path-sensitive `jest.mock()` (they exercise the real Auth/Firestore emulators via `tests/helpers/authEmulator.ts`, not the `firebase-admin` SDK directly). Separately run `grep -n "jest.mock(\|await import(" backend/tests/unit/cache/cacheAside.test.ts backend/tests/unit/cache/redisClient.test.ts` and confirm both files' `jest.mock('ioredis', ...)` calls target the npm package (unaffected by this migration's relocation) while their dynamic `import()` calls hard-code today's `../../../src/cache/...` path (these two *are* path-sensitive and are fixed explicitly in Phase 6, T025/T026) — spec.md FR-007's check, made explicit and re-runnable here.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the domain types and port interfaces both User Story 1 and User Story 2 build
on. Neither type file nor port is shared *across* the two stories — they are grouped here rather
than duplicated inside each story's own phase because both are pure, dependency-free interface files
with no logic, per research.md Decisions 1-4.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/src/domain/auth/types.ts` — `AuthenticatedUser { uid: string; email: string; name?: string; picture?: string }`, moved out of `backend/src/types/express.d.ts` unchanged (research.md Decision 4).
- [X] T004 [P] Create `backend/src/domain/users/types.ts` — copy `ThemePreference`, `UserProfile`, `VerifiedIdentity` unchanged from `backend/src/services/userService.ts`. Leave the original file in place (still imported by `routes/auth.ts`) until Phase 5 deletes it.
- [X] T005 Update `backend/src/types/express.d.ts`: remove the inline `AuthenticatedUser` interface and instead `import type { AuthenticatedUser } from '../domain/auth/types';`, keeping the `declare global { namespace Express { interface Request { auth?: AuthenticatedUser } } }` augmentation unchanged (depends on T003).
- [X] T006 [P] Define `backend/src/ports/auth/authVerifierPort.ts` per `contracts/auth-verifier-port.md`: `AuthVerifierPort { verifyIdToken(idToken: string): Promise<AuthenticatedUser> }`, importing `AuthenticatedUser` from `../../domain/auth/types`.
- [X] T007 [P] Define `backend/src/ports/users/userRepositoryPort.ts` per `contracts/user-repository-port.md`: `UserRepositoryPort { findByUid, create, touchLastSignIn, updateThemePreference }` (data-model.md method inventory), importing `ThemePreference`/`UserProfile` from `../../domain/users/types`.

**Checkpoint**: `domain/auth/types.ts`, `domain/users/types.ts`, `ports/auth/authVerifierPort.ts`, and
`ports/users/userRepositoryPort.ts` exist. `middleware/requireAuth.ts`, `services/userService.ts`,
and `routes/auth.ts` still exist, unmodified, still serving production traffic.

---

## Phase 3: User Story 1 - User profile persistence isolated behind a repository port (Priority: P1)

**Goal**: `getOrCreateUser`'s create-vs-touch branch and `getUser`/`updateThemePreference` depend only
on `UserRepositoryPort`, preserving every existing rule exactly — including that a repeat sign-in
updates *only* `lastSignInAt`, never `displayName`/`email`/`photoURL`/`themePreference` (research.md
Decision 5).

**Independent Test**: Run `createOrRefreshSession`/`getUserProfile`/`updateThemePreference` against a
fake `UserRepositoryPort`, confirming the create-vs-touch branch and the identity-fields-untouched
behavior are each exercised without a real Firestore instance (spec.md US1). Depends on Phase 2 only.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T008 [P] [US1] Write `backend/tests/unit/users/application/userProfileUseCases.test.ts` — new test file, exercising `createUserProfileUseCases` against a hand-built fake `UserRepositoryPort` (`findByUid`/`create`/`touchLastSignIn`/`updateThemePreference` as `jest.fn()`s, mirroring `searchCatalogWithRatings.test.ts`'s fake-port pattern). Cover: `createOrRefreshSession` calls `create` when `findByUid` resolves `null`; calls `touchLastSignIn` (never `create`) when `findByUid` resolves an existing profile — and that no other field is written on that branch; `getUserProfile` calls `findByUid` directly and returns its result (including `null`); `updateThemePreference` calls the port method of the same name directly. Run it and confirm it fails (module not found).

### Implementation for User Story 1

- [X] T009 [US1] Create `backend/src/adapters/users/firestoreUserRepository.ts` — implements `UserRepositoryPort`. Relocate the `toUserProfile` mapper and Firestore calls from `backend/src/services/userService.ts` unchanged, split into `findByUid` (the existing `docRef.get()` + `!snapshot.exists` check), `create` (the existing `!snapshot.exists` branch's `docRef.set(...)` with `createdAt`/`lastSignInAt` both set to `FieldValue.serverTimestamp()`), `touchLastSignIn` (the existing `snapshot.exists` branch's `docRef.update({ lastSignInAt: now })` — updates only that one field, research.md Decision 5), and `updateThemePreference` (unchanged `docRef.update({ themePreference })`). Export `export const firestoreUserRepository: UserRepositoryPort = { findByUid, create, touchLastSignIn, updateThemePreference }`. Leave `services/userService.ts` in place (still serving production) until Phase 5 deletes it.
- [X] T010 [US1] Create `backend/src/application/users/userProfileUseCases.ts` — factory `createUserProfileUseCases(deps: { userRepository: UserRepositoryPort })` returning `{ createOrRefreshSession, getUserProfile, updateThemePreference }` (research.md Decisions 2-3): `createOrRefreshSession(identity: VerifiedIdentity)` calls `findByUid(identity.uid)`, and if `null` calls `create({ uid, displayName, email, photoURL })`, otherwise calls `touchLastSignIn(identity.uid)`; `getUserProfile(uid)` calls `findByUid(uid)` directly; `updateThemePreference(uid, themePreference)` calls the port method directly. Run T008 and confirm it now passes.
- [X] T011 [P] [US1] Copy `backend/tests/integration/auth.integration.test.ts` to `backend/tests/integration/users/application/createOrRefreshSession.integration.test.ts`, updating its import of `getOrCreateUser` to instead call `createUserProfileUseCases({ userRepository: firestoreUserRepository }).createOrRefreshSession` (importing both from their new locations) — the direct `getFirestoreDb().collection('users').doc(uid).get()` snapshot checks stay unchanged. Run the new copy and confirm it passes against the real Firestore emulator. Leave the original file in place until Phase 5 deletes it.
- [X] T012 [P] [US1] Copy `backend/tests/unit/userService.test.ts` to `backend/tests/integration/users/application/userProfileUseCases.integration.test.ts` (reclassified unit→integration — it exercises the real Firestore emulator, matching `firestoreLibraryRepository.integration.test.ts`'s existing precedent for a real-emulator adapter/application test), updating its imports of `getOrCreateUser`/`getUser`/`updateThemePreference` to the corresponding `createUserProfileUseCases({ userRepository: firestoreUserRepository })` functions. Run the new copy and confirm it passes, including the resign-in-preserves-`themePreference` case (its own comment references "FR-012" from an earlier feature — unrelated to this one — but the behavior it asserts is exactly research.md Decision 5's identity-fields-untouched rule). Leave the original file in place until Phase 5 deletes it.

**Checkpoint**: User profile persistence is proven both against a fake port (T008) and the real
Firestore emulator (T011, T012). `services/userService.ts` and `routes/auth.ts` are unaffected —
still serving production traffic through their old import paths.

---

## Phase 4: User Story 2 - Request authentication isolated behind a token-verification port (Priority: P1)

**Goal**: `requireAuth` depends on `AuthVerifierPort` instead of calling `firebase-admin`'s Auth SDK
directly, preserving its exact contract (`req.auth` shape, 401 on failure). This phase also performs
the one real cutover User Story 2 requires: retiring `middleware/requireAuth.ts` once every consumer
has switched (research.md Decision 7).

**Independent Test**: Run `requireAuth` against a fake `AuthVerifierPort` that resolves or rejects
token verification, confirming the missing-header, successful-verification, and
failed-verification cases each behave exactly as today (spec.md US2). Depends on Phase 2 only.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [X] T013 [P] [US2] Write `backend/tests/unit/auth/adapters/requireAuth.test.ts` — new test file, exercising `createRequireAuth` against a hand-built fake `AuthVerifierPort` (`verifyIdToken: jest.fn()`). Cover: no `Authorization` header or a non-Bearer header → 401 with today's unauthorized body, `verifyIdToken` never called; a resolved `verifyIdToken` → `req.auth` set to the resolved `AuthenticatedUser` exactly, `next()` called, no response written; a rejected `verifyIdToken` → 401 with today's unauthorized body and log line, `next()` never called. Run it and confirm it fails (module not found).

### Implementation for User Story 2

- [X] T014 [US2] Create `backend/src/adapters/auth/firebaseAuthVerifierAdapter.ts` — implements `AuthVerifierPort`. `verifyIdToken(idToken)` calls `getFirebaseAuth().verifyIdToken(idToken)` (relocated unchanged from `middleware/requireAuth.ts`'s inline call) and maps the decoded token to `{ uid: decoded.uid, email: decoded.email ?? '', name: decoded.name, picture: decoded.picture }`. Export `export const firebaseAuthVerifierAdapter: AuthVerifierPort = { verifyIdToken }`.
- [X] T015 [US2] Create `backend/src/adapters/auth/requireAuth.ts` — `createRequireAuth(deps: { authVerifier: AuthVerifierPort })` factory returning the Express middleware function, preserving `middleware/requireAuth.ts`'s exact logic (missing/non-Bearer header → 401, `logger.warn({ route: req.path, outcome: 'unauthorized', message: 'missing bearer token' })`; on success, `req.auth = await deps.authVerifier.verifyIdToken(token)`, `logger.info({ route: req.path, outcome: 'verified', uid: req.auth.uid })`, `next()`; on rejection, `logger.warn({ route: req.path, outcome: 'unauthorized', message: ... })` and the same 401 body) verbatim, plus a pre-wired singleton export: `export const requireAuth = createRequireAuth({ authVerifier: firebaseAuthVerifierAdapter })`. Run T013 and confirm it now passes.
- [X] T016 [P] [US2] Copy `backend/tests/unit/requireAuth.test.ts` to `backend/tests/integration/auth/adapters/requireAuth.integration.test.ts` (reclassified unit→integration — real Auth emulator, matching `firestoreLibraryRepository.integration.test.ts`'s precedent), updating its import of `requireAuth` to `../../../../src/adapters/auth/requireAuth` and its `authEmulator` helper import to the correspondingly deeper relative path. Run the new copy and confirm it passes against the new singleton and the real Auth emulator. Leave the original file in place until this phase's cleanup task (T018) deletes it.

### Cutover for User Story 2 (research.md Decision 7)

- [X] T017 [US2] Update the `requireAuth` import path in all five current consumers: `backend/src/adapters/library/libraryRoutes.ts`, `backend/src/adapters/discogsCatalog/discogsRoutes.ts`, `backend/src/adapters/discogsOauth/discogsRoutes.ts`, and `backend/src/adapters/feeds/feedsRoutes.ts` (each: `../../middleware/requireAuth` → `../auth/requireAuth`), plus `backend/src/routes/auth.ts` (`../middleware/requireAuth` → `../adapters/auth/requireAuth` — a one-line bridge fix only; every other line of this file, including its `services/userService` calls, stays untouched until Phase 5). Run each affected domain's existing test suite (`library`, `discogsCatalog`, `discogsOauth`, `feeds`, and this domain's own contract/integration tests) and confirm no regression.
- [X] T018 [US2] Delete `backend/src/middleware/requireAuth.ts` and the now-empty `backend/src/middleware/` directory (now that T017 has moved every consumer off it); delete `backend/tests/unit/requireAuth.test.ts` (superseded by T013's new unit test and T016's relocated integration test).

**Checkpoint**: `backend/src/middleware/` no longer exists. Every consumer — the four other domains'
routes and `routes/auth.ts` — depends on `adapters/auth/requireAuth.ts`. spec.md FR-002/SC-002 are
fully satisfied for this file.

---

## Phase 5: User Story 3 - Auth/session HTTP routes depend on application-level use cases, not the service module directly (Priority: P2)

**Goal**: `routes/auth.ts` becomes `adapters/users/authRoutes.ts`, a thin driving adapter (request
parsing/validation → one use-case call → existing response mapping); this is the cutover that
retires every remaining pre-migration file in the `users` side of this domain.

**Independent Test**: Every route handler body is limited to invoking one of
`createUserProfileUseCases`'s three functions and mapping the result/errors to the existing response
shapes; the existing auth contract and integration test suites pass unchanged against the migrated
code (spec.md US3). Depends on Phase 3 (User Story 1) — needs a real port and use cases to call. Its
`requireAuth` import was already fixed by Phase 4's T017, so this phase touches no other line related
to authentication.

### Tests for User Story 3 ⚠️ (relocate first; they must keep passing throughout this phase)

- [X] T019 [P] [US3] Copy `backend/tests/contract/auth.contract.test.ts` to `backend/tests/contract/users/session.contract.test.ts`, updating its imports (`createApp` from `../../../src/app`, `authEmulator` helpers from `../../helpers/authEmulator`). Run the new copy and confirm it still passes (routes aren't migrated yet — this only proves the relocation is correct). Leave the original file in place until this phase's cleanup task (T023) deletes it.
- [X] T020 [P] [US3] Copy `backend/tests/contract/authPreferencesRoute.test.ts` to `backend/tests/contract/users/preferences.contract.test.ts`, same import-path fixes as T019. Run the new copy and confirm it still passes. Leave the original file in place until T023 deletes it.

### Implementation for User Story 3

- [X] T021 [US3] Create `backend/src/adapters/users/authRoutes.ts` — the driving adapter, relocated from `backend/src/routes/auth.ts`: instantiate `createUserProfileUseCases({ userRepository: firestoreUserRepository })` once at module load (importing `createUserProfileUseCases` from `../../application/users/userProfileUseCases` and `firestoreUserRepository` from `./firestoreUserRepository`), keep `requireAuth` imported from `../auth/requireAuth` (unchanged since T017). `POST /session` → build the `VerifiedIdentity` from `req.auth` exactly as today (`displayName: auth.name ?? auth.email`) and call `createOrRefreshSession`, same 200/500 mapping and log lines. `GET /me` → call `getUserProfile(auth.uid)`, 401 with today's body when `null`, otherwise 200 (unchanged), same 500 mapping. `PATCH /preferences` → same Zod `preferencesBodySchema`/400 body, then call `updateThemePreference(auth.uid, parsed.data.themePreference)`, same 200/500 mapping. Preserve every existing `logger.info`/`logger.error` field verbatim.
- [X] T022 [US3] Update `backend/src/app.ts`: change `import { authRouter } from './routes/auth'` to `import { authRouter } from './adapters/users/authRoutes'` (export name `authRouter` unchanged). Run T019, T020, T011, and T012; confirm all four now pass against the new routes.
- [X] T023 [US3] Delete the now-superseded old files: `backend/src/services/userService.ts` (and the now-empty `services/` directory), `backend/src/routes/auth.ts` (and the now-empty `routes/` directory), and the old test files: `backend/tests/unit/userService.test.ts`, `backend/tests/integration/auth.integration.test.ts`, `backend/tests/contract/auth.contract.test.ts`, `backend/tests/contract/authPreferencesRoute.test.ts`.
- [X] T024 [US3] Run `cd backend && npm test -- --testPathPattern="tests/(unit|integration|contract)/(auth|users)"` and confirm every relocated/new test (T008, T011, T012, T013, T016, T019, T020) passes against the now fully-wired new code.

**Checkpoint**: `routes/auth.ts` and `services/userService.ts` no longer exist.
`adapters/users/authRoutes.ts` serves `/api/auth` unchanged.

---

## Phase 6: User Story 4 - Shared CachePort and Firebase Admin initializer fully consolidated (Priority: P2)

**Goal**: `cache/cacheAside.ts` and `cache/redisClient.ts` relocate into `adapters/cache/` alongside
the `CachePort` adapter that already wraps them, ending the deferral from Historias 3-4-5
(research.md Decision 6); `config/firebase-admin.ts` becomes consumed exclusively by adapters,
backend-wide, once Phases 3-5 have removed this domain's own direct imports.

**Independent Test**: Confirm a single `CachePort` type-checks against every existing consumer with
zero duplicate definitions, and that a repository-wide search for `firebase-admin` imports outside
the adapters layer returns zero matches (spec.md US4). Depends on Phases 3 AND 4 (User Stories 1 and
2 must have already removed this domain's own direct `firebase-admin` imports first).

### Tests for User Story 4 ⚠️ (update first, confirm they fail)

- [X] T025 [P] [US4] Update `backend/tests/unit/cache/cacheAside.test.ts`'s five dynamic `import()` calls from `'../../../src/cache/cacheAside'`/`'../../../src/cache/redisClient'` to `'../../../src/adapters/cache/cacheAside'`/`'../../../src/adapters/cache/redisClient'`. Run it and confirm it now fails (module not found — the source files haven't moved yet).
- [X] T026 [P] [US4] Same dynamic `import()` path update in `backend/tests/unit/cache/redisClient.test.ts`. Run it and confirm it now fails.

### Implementation for User Story 4

- [X] T027 [US4] Move `backend/src/cache/cacheAside.ts` to `backend/src/adapters/cache/cacheAside.ts`, updating its `logger` import from `'../config/logger'` to `'../../config/logger'` (one more directory level) — `withCache`/`invalidateCache`'s fail-soft/coalescing logic is otherwise byte-for-byte unchanged. Move `backend/src/cache/redisClient.ts` to `backend/src/adapters/cache/redisClient.ts`, same `logger` import fix — `getRedisClient`'s logic is otherwise unchanged. Update `backend/src/adapters/cache/cacheAdapter.ts`'s two imports from `'../../cache/cacheAside'`/`'../../cache/redisClient'` to `'./cacheAside'`/`'./redisClient'` (same directory now). Run T025 and T026, confirm both now pass. Remove the now-empty `backend/src/cache/` directory.
- [X] T028 [US4] Update the import path in the eight ripple-affected test files (research.md Decision 6): `backend/tests/contract/feeds/feedsDashboard.contract.test.ts`, `backend/tests/contract/feeds/feedsSource.contract.test.ts`, `backend/tests/integration/feeds/feedsDashboard.integration.test.ts`, `backend/tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts`, `backend/tests/integration/feeds/feedsDashboardNewSources.integration.test.ts`, `backend/tests/integration/feeds/feedsSourceDirect.integration.test.ts`, `backend/tests/integration/library/librarySync.integration.test.ts`, `backend/tests/integration/discogsCatalog/discogsCacheOutage.test.ts` — each changes its one `'.../src/cache/cacheAside'` or `'.../src/cache/redisClient'` import to the corresponding `'.../src/adapters/cache/cacheAside'`/`'.../src/adapters/cache/redisClient'` path, zero assertion changes. Run each affected domain's test suite (`feeds`, `library`, `discogsCatalog`) and confirm no regression.
- [X] T029 [P] [US4] Run `grep -rln "interface CachePort" backend/src` and confirm exactly one match, `backend/src/ports/cache/cachePort.ts` (spec.md FR-003/SC-003).
- [X] T030 [P] [US4] Run `grep -rln "config/firebase-admin" backend/src | grep -v '^backend/src/adapters/'` and confirm zero matches — every remaining consumer of `getFirebaseAuth`/`getFirestoreDb` is under `backend/src/adapters/` (spec.md FR-005/SC-004).

**Checkpoint**: `backend/src/cache/` no longer exists. `CachePort` has exactly one definition and its
implementation lives entirely inside `adapters/cache/`. `config/firebase-admin.ts` is consumed only
by adapters, across the whole backend.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T031 Run `cd backend && npm test` (full suite, no path filter) once and confirm every backend test file passes, including the four domains this feature touched only incidentally (`library`, `discogsCatalog`, `discogsOauth`, `feeds`) — proving no cross-domain regression beyond the deliberate one-line import fixes (spec.md SC-001; quickstart.md step 5).
- [X] T032 [P] Run quickstart.md steps 1-4: `grep -rnE "from '(firebase-admin|ioredis)(/|')" backend/src/domain/auth backend/src/domain/users backend/src/application/users backend/src/ports/auth backend/src/ports/users` (zero matches); `ls backend/src/middleware backend/src/services backend/src/cache backend/src/routes` (all four report "No such file or directory") plus the corresponding `grep` for old import paths (zero matches); the T030 firebase-admin check; the T029 single-`CachePort` check. Confirm all pass (spec.md SC-002/SC-004/SC-006).
- [X] T033 [P] Manually review `backend/src/adapters/users/authRoutes.ts`: confirm each handler body is limited to request parsing/validation, one use-case call, and the existing response mapping — no Firestore call or create-vs-touch branching logic inline in the route (spec.md US3/FR-011; quickstart.md step 8).
- [X] T034 [P] Manually review `backend/src/adapters/library/libraryRoutes.ts`, `backend/src/adapters/discogsCatalog/discogsRoutes.ts`, `backend/src/adapters/discogsOauth/discogsRoutes.ts`, `backend/src/adapters/feeds/feedsRoutes.ts`: confirm each still imports `requireAuth` as a single ready-to-use middleware function, now from `../auth/requireAuth`, with no other change to how it's used (spec.md US2 Acceptance Scenario 4; quickstart.md step 9).
- [X] T035 Manually verify quickstart.md step 7: the app boots cleanly with the new `adapters/users/authRoutes.ts`/`adapters/auth/requireAuth.ts` wiring, and `POST /api/auth/session`, `GET /api/auth/me`, `PATCH /api/auth/preferences` (plus the 401/400 failure cases) return identical shapes/status codes to before this migration — confirmed either via a live `curl` walkthrough (if a valid Firebase ID token is available) or via the already-green `session.contract.test.ts`/`preferences.contract.test.ts` suites, which exercise the identical `createApp()`/route code path against a real Firebase Auth/Firestore emulator (spec.md SC-005).
- [X] T036 [P] Run `git diff --name-only <base-commit-before-this-feature> -- backend/src/config/logger.ts` (or equivalent — confirm no diff exists for this file across the whole feature) and confirm zero changes; separately run `grep -n "from '\(firebase-admin\|axios\|ioredis\|rss-parser\)'" backend/src/config/logger.ts` and confirm zero matches, confirming `config/logger.ts` remains an untouched transversal exception throughout this migration (spec.md FR-010).
- [X] T037 [P] Run `find backend/src/domain/auth backend/src/domain/users backend/src/application/users backend/src/ports/auth backend/src/ports/users backend/src/adapters/auth backend/src/adapters/users -type f` and confirm every file introduced or relocated by this feature lives under one of `domain/`, `application/`, `ports/`, or `adapters/` with the expected `auth`/`users` subfolder — no stray file left outside the layer/folder convention (spec.md FR-008).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. Independent of US2 — its test uses a fake
  `UserRepositoryPort`, so it never needs Phase 4's `AuthVerifierPort` work.
- **User Story 2 (Phase 4)**: Depends on Phase 2 only. Independent of US1 in its own new-file work,
  but its cutover task (T017) touches `routes/auth.ts`'s import line — a one-line bridge fix, not a
  dependency on US1's own port/use-case work.
- **User Story 3 (Phase 5)**: Depends on Phase 3 (User Story 1) for its port/use-cases, and on
  Phase 4's T017 having already fixed `routes/auth.ts`'s `requireAuth` import — matches spec.md's
  explicit statement that US3 depends on US1 (research.md Decision 7 covers the US2 ordering detail).
- **User Story 4 (Phase 6)**: Depends on Phases 3 AND 4 (both must have already removed this domain's
  own direct `firebase-admin` imports) — matches spec.md's explicit statement that US4 depends on
  US1 and US2.
- **Polish (Phase 7)**: Depends on Phase 6.

### Parallel Opportunities

- T003, T004, T006, T007 (Phase 2) — different files (T005 depends on T003).
- T008 (Phase 3) and T013 (Phase 4) — different files, both only need Phase 2; **Phase 3 and Phase 4
  as a whole** can run in parallel (different engineers/sessions) once Phase 2 is complete, except
  that Phase 4's T017 (the `routes/auth.ts` bridge fix) and Phase 3's own work both eventually touch
  files in the `users` domain area — coordinate T017 with whoever owns Phase 3 if run concurrently.
- T011, T012 (Phase 3) — different files, both only need T009/T010 to exist.
- T016 (Phase 4) — independent of T017/T018, can run alongside them.
- T019, T020 (Phase 5) — different files.
- T025, T026 (Phase 6) — different files.
- T029, T030 (Phase 6) — independent checks.
- T032, T033, T034, T036, T037 (Phase 7) — independent checks.

---

## Parallel Example: Phase 2 foundational files

```bash
Task: "Create domain/auth/types.ts"
Task: "Create domain/users/types.ts"
Task: "Define ports/auth/authVerifierPort.ts"
Task: "Define ports/users/userRepositoryPort.ts"
```

## Parallel Example: User Story 1 and User Story 2 as whole phases

```bash
Task: "Complete Phase 3 (User Story 1 — user profile persistence against a fake UserRepositoryPort)"
Task: "Complete Phase 4 (User Story 2 — requireAuth against a fake AuthVerifierPort, plus its consumer cutover)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: T008 (fake port), T011, T012 (real Firestore emulator) all pass; production
   traffic is still served by the untouched `services/userService.ts` and `routes/auth.ts`, so this
   is safe to pause on or merge as an incremental, behavior-invisible step.

### Incremental Delivery

1. Setup + Foundational → domain types and both ports ready.
2. User Story 1 → user-profile persistence proven, zero production risk (additive only).
3. User Story 2 → `requireAuth` proven against a fake port, **plus** its real cutover: every consumer
   (including a bridge fix in the still-unmigrated `routes/auth.ts`) switches to the new file, and
   `middleware/requireAuth.ts` is retired. This is the only phase before Phase 5 that changes what
   currently serves production traffic (the *implementation* of `requireAuth`, not its callers' code).
4. User Story 3 → the `users`-domain cutover: `routes/auth.ts` and `services/userService.ts` rewritten
   and deleted; `app.ts` repointed.
5. User Story 4 → the cache relocation: independent of the domain-folder decisions above, but gated
   on Phases 3-4 having already closed this domain's own `firebase-admin` imports.
6. Polish → static-import checks, full-suite regression run, manual route-handler review, manual HTTP
   smoke test.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every implementation task in Phases 3-4-6 has a preceding test task that fails until it lands
  (Constitution Principle I).
- Commit after each checkpoint (end of Phase 2, 3, 4, 5, 6, 7) rather than after every single task.
- Do not delete `backend/src/middleware/requireAuth.ts` before T017 has updated all five of its
  consumers (T018) — deleting it earlier would break `routes/auth.ts`, which isn't rewritten until
  Phase 5.
- Do not delete `backend/src/services/userService.ts`, `backend/src/routes/auth.ts`, or their four
  original test files before T022 has cut `app.ts` over to the new routes (T023) — every earlier
  phase depends on the old code and its original tests continuing to serve/cover production traffic
  unmodified.
- Do not move `backend/src/cache/cacheAside.ts`/`redisClient.ts` before Phases 3 and 4 have completed
  — User Story 4 is explicitly gated on both having already removed this domain's own direct
  `firebase-admin` imports (spec.md's stated priority ordering for US4).
- The two behavior-adjacent items in this migration are both **corrections to overstated pre-existing
  test comments, not new behavior**: research.md Decision 5 (a repeat sign-in updates only
  `lastSignInAt`) and the reclassification of four real-emulator tests from `unit/` to `integration/`
  (T011, T012, T016) — the latter changes no assertion, only the folder tier, to match
  `firestoreLibraryRepository.integration.test.ts`'s existing precedent for a real-emulator
  adapter/application test.
