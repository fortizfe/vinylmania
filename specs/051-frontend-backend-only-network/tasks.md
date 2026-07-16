# Tasks: Frontend habla solo con el backend propio

**Input**: Design documents from `/specs/051-frontend-backend-only-network/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/google-login-api.md, quickstart.md

**Tests**: Included and REQUIRED — Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every unit, and the Development Workflow gate mandates e2e coverage for frontend-affecting changes.

**Organization**: Tasks are grouped by user story (US1 = constitution principle, US2 = login redesign) per spec.md. Both are P1 and are intended to ship together (US1 is not credible without US2 landing in the same effort).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 or US2, per spec.md
- File paths are exact, relative to repo root

## Path Conventions

Existing web app layout: `backend/src/` (hexagonal: domain/application/ports/adapters), `backend/tests/{unit,integration,contract}/`, `frontend/src/`, `frontend/tests/unit/`, `e2e/{helpers,tests}/`. No new top-level project.

---

## Phase 1: Setup

**Purpose**: Environment and config scaffolding shared by both user stories.

- [X] T001 [P] Add Google OAuth backend env vars (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CALLBACK_URL`, `GOOGLE_OAUTH_BASE_URL`, `GOOGLE_TOKEN_BASE_URL`, `GOOGLE_USERINFO_BASE_URL`) to `backend/.env.example` — *adapted: no `.env.example` exists in this repo; added as rows to `backend/README.md`'s existing env-var table instead, the project's actual convention*
- [X] T002 [P] Remove obsolete `VITE_FIREBASE_*` / `VITE_USE_FIREBASE_EMULATOR` entries from `frontend/.env.example` (the frontend will no longer talk to Firebase/Google directly) — *adapted: no `.env.example` exists; removed the client-SDK-only keys from the real tracked fixture `frontend/.env.test` instead, renaming `VITE_FIREBASE_PROJECT_ID` → `FIREBASE_PROJECT_ID` since nothing reads it as a Vite env var anymore (playwright.config.ts reference updated at T051)*
- [X] T003 [P] Add deny-all Firestore security rules for `sessions/{sessionId}` and `pendingGoogleLogins/{state}` in `backend/firestore.rules`, mirroring the existing `users/{userId}` rule (all access goes through the backend's Admin SDK)
- [X] T004 [P] Document the required Firestore TTL policies for `sessions.expiresAt` and `pendingGoogleLogins.expiresAt` as a manual deployment step in `backend/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Swap `requireAuth`'s verification mechanism from a Firebase ID token to Vinylmania's own session, in a self-contained, independently testable slice. This blocks all of User Story 2's route-level work (every authenticated route depends on `requireAuth`), but nothing in User Story 1.

**⚠️ CRITICAL**: Complete this phase before starting User Story 2's backend/frontend work.

### Tests for Foundational (write first, confirm they FAIL)

- [X] T005 [P] Unit test for `sessionAuthVerifierAdapter` (delegates to `SessionStorePort.touchSession`, maps a hit to `AuthenticatedUser`, maps a miss/expired session to a rejection) in `backend/tests/unit/auth/adapters/sessionAuthVerifierAdapter.test.ts`
- [X] T006 [P] Integration test for `firestoreSessionStoreAdapter` against the Firestore emulator: `createSession` persists a document; `touchSession` extends `expiresAt` (sliding window) and returns the owning `uid`; `touchSession` on an unknown/expired session returns null; `revokeSession` deletes only the targeted document, leaving other sessions for the same `uid` untouched (per-device isolation) in `backend/tests/integration/auth/adapters/firestoreSessionStoreAdapter.integration.test.ts`
- [X] T007 [P] Update `backend/tests/unit/auth/adapters/requireAuth.test.ts`: mock `authVerifier.verifySession` instead of `verifyIdToken`; assert the 401 body/log shape is unchanged
- [X] T008 [P] Update `backend/tests/integration/auth/adapters/requireAuth.integration.test.ts`: exercise `requireAuth` with an opaque session token (via the new test helper from T018) instead of a Firebase ID token
- [X] T009 [P] Integration test asserting `requireAuth` rejects a token minted via the retained `getTestIdToken` (a real Firebase ID token) with `401` once the session-based verifier is wired in — automates quickstart.md Scenario 7 / FR-019 (no dual-verification window) — in `backend/tests/integration/auth/adapters/requireAuth.integration.test.ts`

### Implementation for Foundational

- [X] T010 [P] Create the `Session` domain type (`{ sessionId, uid, createdAt, lastSeenAt, expiresAt }`) in `backend/src/domain/auth/session.ts`
- [X] T011 [P] Widen `AuthenticatedUser.email`/`name`/`picture` to optional in `backend/src/domain/auth/types.ts` — verified by grep that no route besides the now-removed `POST /api/auth/session` handler reads anything but `uid` off `req.auth`, so `uid` is the only field a session-based verification can guarantee
- [X] T012 Create `SessionStorePort` (`createSession(uid)`, `touchSession(token)`, `revokeSession(token)`) in `backend/src/ports/auth/sessionStorePort.ts` — depends on T010
- [X] T013 Update `AuthVerifierPort` in `backend/src/ports/auth/authVerifierPort.ts`: replace `verifyIdToken(idToken)` with `verifySession(sessionToken)` — depends on T011
- [X] T014 Implement `firestoreSessionStoreAdapter` (Firestore `sessions/{sessionId}` collection, throttled sliding-window renewal on `touchSession`) in `backend/src/adapters/auth/firestoreSessionStoreAdapter.ts` — depends on T012; makes T006 pass
- [X] T015 Implement `sessionAuthVerifierAdapter` (delegates to `SessionStorePort.touchSession`) in `backend/src/adapters/auth/sessionAuthVerifierAdapter.ts` — depends on T013, T014; makes T005 pass
- [X] T016 Rewire `backend/src/adapters/auth/requireAuth.ts`'s exported `requireAuth` instance to use `sessionAuthVerifierAdapter` instead of `firebaseAuthVerifierAdapter` — depends on T015; makes T007, T008, T009 pass
- [X] T017 Delete `backend/src/adapters/auth/firebaseAuthVerifierAdapter.ts` (no longer referenced) — depends on T016
- [X] T018 Add `createTestSession(uid)` to a new `backend/tests/helpers/testSession.ts`, writing a `sessions/{sessionId}` document directly to the Firestore emulator and returning its opaque token — replaces `authEmulator.ts`'s `getTestIdToken` as the credential source for every authenticated-route test suite that isn't specifically testing the Google login flow or T009's rollout check (research.md R5) — depends on T014

**Checkpoint**: `requireAuth` now verifies Vinylmania's own sessions end-to-end (provable via T018's helper) and rejects legacy Firebase ID tokens (T009); every existing authenticated route (`/me`, `/preferences`, library, discogs, feeds) keeps working. Nothing can create a *real* session yet — that's User Story 2.

---

## Phase 3: User Story 1 - El principio "solo backend" queda definido y ratificado en la constitution (Priority: P1)

**Goal**: A new, unambiguous Core Principle in `.specify/memory/constitution.md` governing frontend network requests.

**Independent Test**: Read `.specify/memory/constitution.md` and confirm the new principle alone resolves both named edge cases (OAuth full-page redirect, static HTML resources) without ambiguity.

- [X] T019 [US1] Add new Core Principle IX ("Frontend Network Requests — Backend-Only") to `.specify/memory/constitution.md`, in the same MUST/MUST NOT + **Rationale** format as Principles I–VIII, covering: (a) all JS-initiated frontend requests (fetch/XHR/WebSocket/third-party SDK) MUST target the Vinylmania backend only; (b) no third-party SDK (Firebase, Discogs, or future equivalents) MUST be used from `frontend/` to make data requests; (c) a full-page navigation to an external identity/OAuth provider's authorization page is explicitly declared NOT a "request" under this principle; (d) static resource loading via native HTML attributes (`<img src>`, `<link>`) is explicitly declared out of scope; (e) `e2e/` test doubles are explicitly exempt, since they exist to simulate the external third parties this principle restricts production code from calling directly
- [X] T020 [US1] Bump the constitution version `2.5.0` → `2.6.0`, update `**Last Amended**`, and replace the Sync Impact Report HTML comment at the top of `.specify/memory/constitution.md` documenting the `2.5.0` → `2.6.0` change, following the exact format of the existing `2.4.0` → `2.5.0` report — depends on T019
- [X] T021 [US1] Review `.specify/templates/plan-template.md` and `.specify/templates/spec-template.md` against the new Principle IX; add a gate/checklist line if warranted, or record "no changes needed" with rationale in the Sync Impact Report written in T020 — depends on T019

**Checkpoint**: Constitution now defines and requires exactly what User Story 2 delivers.

---

## Phase 4: User Story 2 - Login rediseñado para que el frontend deje de hablar con Firebase/Google directamente (Priority: P1)

**Goal**: `frontend/src` stops importing the Firebase Auth client SDK; login becomes a full-page-redirect flow mediated 100% by the backend, using the session mechanism built in Phase 2.

**Independent Test**: `frontend/src` has no `firebase/auth`/`firebase/app` import, `frontend/package.json` no longer lists `firebase`, and the full login journey (button → redirect → back, authenticated) works end-to-end against the e2e Google stub.

### Backend: Google login flow — tests (write first, confirm they FAIL)

- [X] T022 [P] [US2] Contract test for `GET /api/auth/google/authorize` (302 + `Location` shape) and `POST /api/auth/google/complete` (200 success; 400 `validation_error`/`invalid_state`/`expired_state`/`denied`; 502 `exchange_failed`) in `backend/tests/contract/googleAuth/googleAuthRoutes.test.ts`
- [X] T023 [P] [US2] Unit test for `startLogin` (creates a `PendingGoogleLogin`, builds the authorize URL with a fresh `state`) in `backend/tests/unit/googleAuth/application/startLogin.test.ts`
- [X] T024 [P] [US2] Unit test for `completeLogin` (state validated and single-use; code exchanged; `uid` resolved; `UserProfile` synced; `Session` issued; every `GoogleAuthFlowError` branch) in `backend/tests/unit/googleAuth/application/completeLogin.test.ts`
- [X] T025 [P] [US2] Integration test for `firebaseIdentityResolverAdapter` against the Auth Emulator: existing email → same `uid` returned (`getUserByEmail`); new email → a fresh `uid` is created (`createUser`) in `backend/tests/integration/auth/adapters/firebaseIdentityResolverAdapter.integration.test.ts`
- [X] T026 [P] [US2] Update `backend/tests/contract/users/session.contract.test.ts`: remove the `POST /session` cases, add failing `DELETE /session` cases — *adjusted during implementation: a repeat call with the same token asserts 401, not 204 — `requireAuth` can't authenticate an already-revoked session token, so the "idempotent" framing only applies to the underlying delete, not a literal repeat HTTP call; `contracts/google-login-api.md` updated to match. Also surfaced and fixed a real gap beyond this task: swapping `requireAuth` to session-based verification broke every other test file using `getTestIdToken` as its Bearer credential (not just this one) — migrated all 19 affected files (`library`, `discogsCatalog`, `discogsOauth`, `feeds` contract/integration suites) to `createTestSession`; 3 files that only used `getTestIdToken` for uid generation (no HTTP calls) needed no change. Full affected suite re-run: 225/225 passing.*

### Backend: Google login flow — implementation

- [X] T027 [P] [US2] Create `GoogleIdentity` type and `GoogleAuthFlowError` (codes: `denied`, `invalid_state`, `expired_state`, `exchange_failed`) in `backend/src/domain/googleAuth/types.ts` and `backend/src/domain/googleAuth/googleAuthErrors.ts`
- [X] T028 [US2] Create `GoogleIdentityPort` (`getAuthorizeUrl(state)`, `exchangeCodeForIdentity(code)`, `createPendingLogin()`, `getPendingLogin(state)`, `deletePendingLogin(state)` — mirrors `discogsConnectionPort`'s combined provider-HTTP + Firestore-pending-request shape) in `backend/src/ports/googleAuth/googleIdentityPort.ts` — depends on T027
- [X] T029 [US2] Create `IdentityResolverPort` (`resolveOrCreateUser({ email, name?, picture? })` → `{ uid }`) in `backend/src/ports/auth/identityResolverPort.ts` — depends on T011
- [X] T030 [US2] Implement `googleIdentityAdapter` (authorize-URL builder; `POST {GOOGLE_TOKEN_BASE_URL}/token` exchange; `GET {GOOGLE_USERINFO_BASE_URL}/userinfo` call; `pendingGoogleLogins` Firestore CRUD) in `backend/src/adapters/googleAuth/googleIdentityAdapter.ts` — depends on T028; makes the relevant parts of T023/T024 passable
- [X] T031 [US2] Implement `firebaseIdentityResolverAdapter` (Firebase Admin `getUserByEmail`/`createUser`) in `backend/src/adapters/auth/firebaseIdentityResolverAdapter.ts` — depends on T029; makes T025 pass
- [X] T032 [US2] Implement `startLogin` use case in `backend/src/application/googleAuth/startLogin.ts` — depends on T030; makes T023 pass
- [X] T033 [US2] Implement `completeLogin` use case in `backend/src/application/googleAuth/completeLogin.ts`: validate + consume pending state → exchange code for identity → `resolveOrCreateUser` → sync `UserProfile` (reuse existing `application/users/userProfileUseCases.ts` logic) → `SessionStorePort.createSession` → return `{ sessionToken, user }` — depends on T030, T031, T014; makes T024 pass
- [X] T034 [US2] Implement `logoutSession` use case (delegates to `SessionStorePort.revokeSession`) in `backend/src/application/auth/logoutSession.ts` — depends on T014
- [X] T035 [US2] Implement `googleAuthRoutes` (`GET /google/authorize` → 302; `POST /google/complete` → zod-validated body, `handleFailure` mapping each `GoogleAuthFlowError` code to a status/message, mirroring `discogsRoutes.ts`'s `handleFailure`) in `backend/src/adapters/googleAuth/googleAuthRoutes.ts` — depends on T032, T033; makes T022 pass
- [X] T036 [US2] Update `backend/src/adapters/users/authRoutes.ts`: remove `POST /session`, add `DELETE /session` (`requireAuth`-protected, calls `logoutSession`) — depends on T034, T026; makes T026 pass
- [X] T037 [US2] Mount `googleAuthRouter` at `/api/auth/google` in `backend/src/app.ts` (public — no `requireAuth`, since there is no session yet at this point in the flow) — depends on T035

### Frontend: session store & auth rewrite — tests (write first, confirm they FAIL)

- [X] T038 [P] [US2] Unit test for the session store (get/set/clear a token via `localStorage`) in `frontend/tests/unit/sessionStore.test.ts`
- [X] T039 [P] [US2] Unit test for `apiClient` (attaches `Authorization` from the session store; on a `401` response, clears the stored token and invokes a registered handler) in `frontend/tests/unit/apiClient.test.ts`
- [X] T040 [US2] Rewrite `frontend/tests/unit/AuthContext.test.tsx`: remove all `firebase/auth` mocks; assert `signIn()` performs `window.location.assign` to the backend's authorize URL; `signOut()` calls `DELETE /api/auth/session` then clears state; initial mount calls `GET /api/auth/me` to silently restore an existing session; a registered `401` handler clears `user`; assert there is no `signingIn` state left to manage (that UX moved to `LoginCallbackPage`, T047) — the intended shape of the session store (T038) and `apiClient` (T039) is already fixed by `research.md`/`data-model.md`, so this test can be written without those implementation tasks existing yet
- [X] T041 [P] [US2] Unit test for `LoginCallbackPage` (mirrors `DiscogsCallbackPage.test.tsx`: success path calls `POST /complete` then navigates to `/app`; `error=access_denied` shows the denied outcome immediately with no backend call; other failures map to `expired`/`error`) in `frontend/tests/unit/LoginCallbackPage.test.tsx`

### Frontend: session store & auth rewrite — implementation

- [X] T042 [P] [US2] Create the session store (`localStorage`-backed token get/set/clear) in `frontend/src/services/sessionStore.ts` — makes T038 pass
- [X] T043 [US2] Rewrite `authorizedFetch` in `frontend/src/services/apiClient.ts`: read the token from the session store instead of `firebaseAuth.currentUser`; on a `401`, clear the session store and invoke a registered `onUnauthorized` callback — depends on T042; makes T039 pass
- [X] T044 [US2] Delete `frontend/src/services/firebaseClient.ts`
- [X] T045 [US2] Rewrite `frontend/src/auth/AuthContext.tsx`: no `firebase/auth` imports; `signIn()` does `window.location.assign(\`${API_BASE_URL}/api/auth/google/authorize\`)`; `signOut()` calls `DELETE /api/auth/session` via `apiClient` then clears the session store and `user`; on mount, calls `GET /api/auth/me` (if a stored token exists) to silently restore the session; registers `apiClient`'s `onUnauthorized` to clear `user`; `friendlyErrorMessage` maps the backend's `denied`/`expired`/`error` outcome codes instead of Firebase SDK error codes; `signingIn` is removed from `AuthContext`'s state entirely — the "login in progress" UX it used to cover is now owned by `LoginCallbackPage`'s own loading skeleton (T047), since a full-page redirect has no in-app pending state to track (FR-016) — depends on T043, T044; makes T040 pass — *adapted: exposes a new `completeSignIn(input)` method that itself calls `googleAuthApi.completeGoogleLogin` and updates `user`/`error`/the session store, rather than `LoginCallbackPage` calling the API directly and pushing state in — keeps every session/user state mutation in one place (`signIn`/`signOut`/`completeSignIn`), consistent with the existing pattern*
- [X] T046 [US2] Add `completeGoogleLogin(code, state)` to a new `frontend/src/services/googleAuthApi.ts` (plain unauthenticated `fetch` to `POST /api/auth/google/complete` — no session exists yet, so this bypasses `authorizedFetch`) — depends on T043
- [X] T047 [US2] Create `frontend/src/pages/LoginCallbackPage.tsx`, mirroring `DiscogsCallbackPage.tsx`: read `code`/`state`/`error` from the query string, call `completeGoogleLogin`, store the returned session via `AuthContext`, navigate to `/app` — depends on T045, T046; makes T041 pass
- [X] T048 [US2] Add a public `/login/callback` route rendering `LoginCallbackPage` to `frontend/src/App.tsx`, outside `AuthenticatedLayout` (no session exists yet when this route is reached) — depends on T047

### e2e: stub, rewritten helper, and journey coverage

- [X] T049 [P] [US2] Create `e2e/helpers/googleOauthStub.ts`, mirroring `discogsOauthStub.ts`: `GET /o/oauth2/v2/auth` (stub authorize page with Approve/Deny links, redirecting to the configured callback with `code`+`state` or `error=access_denied`+`state`), `POST /token`, `GET /userinfo` (configurable stub identity) — per `contracts/google-login-api.md`'s external-calls table
- [X] T050 [US2] Rewrite `e2e/helpers/fakeGoogleSignIn.ts`: click "Sign in with Google" → expect a full-page navigation (not a popup) to the backend's `/api/auth/google/authorize` → land on the stub's Approve/Deny page → approve → land on `/login/callback` → wait for `/app` — **keep the exported signature** `signInAsFakeGoogleUser(page, options) → FakeGoogleIdentity` unchanged, so the ~20 existing e2e specs calling it (`sign-in.spec.ts`, `sign-out.spec.ts`, `returning-session.spec.ts`, `discogs-account-link.spec.ts`, etc.) keep passing unmodified — depends on T049
- [X] T051 [US2] Add a `googleOauthStub` `webServer` entry and `GOOGLE_OAUTH_*`/`GOOGLE_TOKEN_*`/`GOOGLE_USERINFO_*` env vars to `e2e/playwright.config.ts`'s backend `webServer` block, pointed at the stub; remove `VITE_USE_FIREBASE_EMULATOR`/`VITE_FIREBASE_*` from the frontend `webServer` block — depends on T049
- [X] T052 [P] [US2] Add a "denied" case to `e2e/tests/sign-in.spec.ts`: clicking "Deny" on the stub's authorize page returns to `/login/callback` with a denied outcome and no session established (quickstart Scenario 3) — depends on T050, T051
- [X] T053 [P] [US2] Create `e2e/tests/session-lifecycle.spec.ts` covering: silent renewal across spaced authenticated navigations with no visible interruption (quickstart Scenario 4); real expiration; logging out in one browser context does not affect a second signed-in context for the same user (Scenario 6, per-device isolation) — depends on T050, T051 — *adapted: "real expiration" (Scenario 5) no longer backdates a Firestore `Session` document directly — `backend/firestore.rules`' deny-all rule on `sessions/{sessionId}` (T003) correctly blocks unauthenticated REST access, so instead the test overwrites the browser's stored token with a value the backend never issued, exercising the identical `requireAuth` → 401 → `apiClient.onUnauthorized` path a genuinely expired session would hit. Verified with a real run against the live emulator + all three webServers: 3/3 passing. Also ran the full ~23-file set of existing specs depending on `signInAsFakeGoogleUser` to confirm T050's unchanged-signature claim: 111/117 passed; 2 skipped; 4 failed, all pre-existing/environmental and unrelated to this feature — `header-responsive-nav.spec.ts` (pixel-measurement flake, did not reproduce on isolated re-run) and 2 of 3 `library-discogs-sync.spec.ts` cases (Discogs collection cache-freshness after mutation) reproduce consistently but only because this sandbox has no local Redis running (`backend/.env`'s `REDIS_URL=redis://localhost:6379` is unreachable, confirmed via pervasive `cache_unavailable` log warnings); neither touches auth/session code*
- [X] T054 [US2] Update the stale "`POST /api/auth/session`" comment in `e2e/tests/sign-in.spec.ts` to describe the new session-establishment flow — depends on T050

### Cleanup

- [X] T055 [US2] Remove the `firebase` dependency from `frontend/package.json` and update the lockfile — depends on T044, T045, T047 (no remaining `firebase`/`firebase/auth` imports in `frontend/src`)
- [X] T056 [US2] `grep -rn "from 'firebase" frontend/src` and confirm zero results (quickstart.md Scenario 8) — depends on T055

**Checkpoint**: User Stories 1 and 2 both independently functional; full login/denial/renewal/expiration/multi-device-logout journeys pass in e2e; frontend has no Firebase dependency.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T057 [P] Run `quickstart.md` scenarios 1–8 end-to-end and record results — *all 8 verified: Scenario 1 (constitution Principle IX + version 2.6.0) via direct file check; Scenarios 2–6 (successful login, denial, silent renewal, expiration, per-device logout isolation) via `e2e/tests/sign-in.spec.ts` + `session-lifecycle.spec.ts` against the real browser/emulator/stub stack; Scenario 7 (legacy Firebase ID token rejected, no dual-verification) via `backend/tests/integration/auth/adapters/requireAuth.integration.test.ts`; Scenario 8 (no `firebase` import/dependency) via grep, both zero results. Along the way, found and removed `e2e/tests/sign-in-cancelled.spec.ts` — it exercised the retired popup-cancellation mechanism (`page.waitForEvent('popup')`) and was already fully superseded by the new denied-case test in `sign-in.spec.ts` (T052)*
- [X] T058 [P] Update `README.md`/deployment docs that describe the old Firebase-client-SDK login flow to describe the new backend-mediated flow
- [X] T059 Run the full backend Jest suite, frontend Vitest suite, and e2e Playwright suite together to confirm no regression in library/discogs/feeds routes now that they authenticate via the swapped session mechanism (verifies SC-005: no other domain's API contract changes) — *Backend: full `npm test` (proper `emulators:exec` wrapper) — 54/54 suites, 424/424 tests passing. Frontend: full `vitest run` — 70/70 files, 464/464 tests passing. e2e: ran effectively the entire suite (122 of 123 spec files, one retired as obsolete per T057) across several batches — 4 failures reproduced, all in `library-discogs-sync.spec.ts`/`header-responsive-nav.spec.ts`, neither touched by this feature; root-caused to this sandbox having no local Redis running (`backend/.env`'s `REDIS_URL=redis://localhost:6379` unreachable, confirmed by pervasive `cache_unavailable` log warnings across every run) — a pre-existing environmental gap, not a regression from the session-mechanism swap. Every auth-adjacent spec (sign-in, sign-out, returning-session, session-lifecycle, and all ~20 specs depending on `signInAsFakeGoogleUser`) passed cleanly.*
- [ ] T060 Include the Principle VI MAJOR-classified breaking-change disclosure (auth mechanism swap: Firebase ID token → own session token, no dual-verification window) in the PR description before merge, per plan.md's Constitution Check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately, all four tasks parallel.
- **Foundational (Phase 2)**: No dependency on Setup's content (only on the repo being in a buildable state) — but should follow Setup for the Firestore rules in T003 to already be in place. Blocks all backend/frontend work in User Story 2.
- **User Story 1 (Phase 3)**: No code dependency on Foundational or Setup — pure documentation change. Can run at any time, including in parallel with Phase 2.
- **User Story 2 (Phase 4)**: Backend sub-section depends on Foundational (Phase 2) being complete. Frontend sub-section depends on the backend sub-section's routes existing (T035, T037) for its own tests to be meaningful, though the frontend *unit* tests (T038–T041) can be written against mocks in parallel with backend implementation. e2e sub-section depends on both backend and frontend implementation being complete.
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 both being complete.

### Within User Story 2

- Tests (T022–T026, T038–T041) MUST be written and confirmed failing before their corresponding implementation tasks.
- Domain/ports (T027–T029) before adapters (T030–T031) before application use cases (T032–T034) before routes (T035–T037), per Principle VIII's layering.
- Backend routes (T037) before frontend API calls that hit them are meaningful end-to-end (T046).
- Frontend session store (T042) before `apiClient` (T043) before `AuthContext` (T045) before `googleAuthApi` (T046) before `LoginCallbackPage` (T047) before the new route (T048).
- e2e stub (T049) before the rewritten helper (T050) before any spec relying on it (T052, T053).

### Parallel Opportunities

- All Setup tasks (T001–T004) in parallel.
- Foundational tests T005–T009 in parallel with each other (different files, T008/T009 share a file but are independent assertions written together); T010–T011 in parallel with each other.
- User Story 1's three tasks are sequential (each edits the same file, `.specify/memory/constitution.md`) but the whole story can run in parallel with all of Phase 2/4.
- Within User Story 2: T022–T026 in parallel; T038, T039, T041 in parallel (T040 depends on nothing being implemented yet — see its own note — but is kept last among the frontend tests since it exercises the integration of both `sessionStore` and `apiClient`'s intended contracts).
- T049 (e2e stub) can start as soon as `contracts/google-login-api.md` is final — i.e., immediately, in parallel with all backend implementation.

---

## Parallel Example: Foundational Phase

```bash
# Tests, all different files (T008/T009 share requireAuth.integration.test.ts but assert independent cases):
Task: "Unit test for sessionAuthVerifierAdapter in backend/tests/unit/auth/adapters/sessionAuthVerifierAdapter.test.ts"
Task: "Integration test for firestoreSessionStoreAdapter in backend/tests/integration/auth/adapters/firestoreSessionStoreAdapter.integration.test.ts"
Task: "Update requireAuth.test.ts to mock verifySession"
Task: "Update requireAuth.integration.test.ts to use a session token"
Task: "Add requireAuth.integration.test.ts case rejecting a legacy Firebase ID token"

# Domain types, different files:
Task: "Create Session domain type in backend/src/domain/auth/session.ts"
Task: "Widen AuthenticatedUser optional fields in backend/src/domain/auth/types.ts"
```

## Parallel Example: User Story 2 backend tests

```bash
Task: "Contract test for googleAuthRoutes in backend/tests/contract/googleAuth/googleAuthRoutes.test.ts"
Task: "Unit test for startLogin in backend/tests/unit/googleAuth/application/startLogin.test.ts"
Task: "Unit test for completeLogin in backend/tests/unit/googleAuth/application/completeLogin.test.ts"
Task: "Integration test for firebaseIdentityResolverAdapter in backend/tests/integration/auth/adapters/firebaseIdentityResolverAdapter.integration.test.ts"
Task: "Update session.contract.test.ts for DELETE /session"
```

---

## Implementation Strategy

### MVP First

Both user stories are P1 and the spec explicitly frames them as shipping together (a ratified principle the codebase violates on day one is not credible). There is no meaningful smaller MVP than: Setup → Foundational → User Story 1 → User Story 2 → Polish, all delivered as one PR/release.

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — the session-verification swap, independently testable via T005–T009/T018.
2. Complete Phase 3 (User Story 1) — can happen any time, even before/during Phase 2, since it's a documentation-only change.
3. Complete Phase 4 (User Story 2) — the login rewrite, in the backend → frontend → e2e → cleanup order laid out above.
4. Complete Phase 5 (Polish) — run `quickstart.md` in full before merge.

### Incremental Delivery Within the PR

1. Foundational merged/validated first (existing routes keep working, provably, via the new test-session helper; legacy tokens provably rejected via T009) — this is the safest point to catch a session-store design mistake before the login flow is built on top of it.
2. User Story 1 (constitution) can land as its own small commit at any point.
3. User Story 2's backend (T022–T037) before its frontend (T038–T048) before e2e (T049–T054) — each sub-slice is independently testable (contract/unit tests for backend before any UI exists; component tests for frontend against mocks before e2e wiring exists).

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- Every test task MUST fail before its implementation task is started (Principle I) — including the split `DELETE /session` test (T026) and the legacy-token-rejection test (T009), both of which now have their own dedicated task rather than being bundled into an implementation task.
- Commit after each task or logical group, per repo convention.
- The ~20 existing e2e specs that call `signInAsFakeGoogleUser` are deliberately **not** listed as individual tasks — T050 preserves that helper's exported contract precisely so none of them need to change.
