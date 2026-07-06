# Tasks: Link Vinylmania Account with Discogs (OAuth)

**Input**: Design documents from `/specs/015-discogs-oauth-link/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/discogs-oauth-api.md, quickstart.md

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Every test task MUST be written and observed failing before its corresponding implementation task begins.

**Organization**: Tasks are grouped by user story. US2 and US3 build on the flow US1 creates (a connection must exist to disconnect; failures happen inside the link flow), but each phase ends in an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 = link account, US2 = status & unlink, US3 = graceful failure handling

## Path Conventions

Web app per plan.md: `backend/src/`, `backend/tests/`, `frontend/src/`, `e2e/`.

---

## Phase 1: Setup

**Purpose**: Environment configuration for the Discogs OAuth integration. No new npm dependencies are required (research.md R1).

- [X] T001 Add `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, `DISCOGS_OAUTH_CALLBACK_URL=http://localhost:5173/app/profile/discogs/callback` to `backend/.env` (real key/secret values supplied by the project owner — never committed; `backend/.env` is already gitignored, verify it stays so), and document the three variables plus the optional `DISCOGS_OAUTH_BASE_URL` / `DISCOGS_AUTHORIZE_BASE_URL` test overrides in `backend/README.md` if that file exists (create a short "Environment" note if not)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: OAuth 1.0a building blocks and e2e stub infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Define OAuth module types in `backend/src/discogs/oauth/types.ts`: `DiscogsConnection`, `PendingOAuthRequest`, `ConnectionStatus` DTO exactly per data-model.md (token fields present on the entities, structurally absent from `ConnectionStatus`)
- [X] T003 [P] Write failing unit tests for the PLAINTEXT header builder in `backend/tests/unit/discogsOauthSignature.test.ts`: request-token variant (includes `oauth_callback`, signature `"<consumer_secret>&"`), access-token variant (includes `oauth_token` + `oauth_verifier`, signature `"<consumer_secret>&<request_token_secret>"`), identity variant (signature `"<consumer_secret>&<access_token_secret>"`), unique nonce per call, current timestamp
- [X] T004 Implement `backend/src/discogs/oauth/oauthSignature.ts` to make T003 pass (pure header-string builder, crypto-random nonce, no I/O)
- [X] T005 Implement `backend/src/discogs/oauth/oauthHttpClient.ts`: dedicated axios instance reading `DISCOGS_OAUTH_BASE_URL` (default `https://api.discogs.com`), `User-Agent` from `DISCOGS_USER_AGENT` per existing convention, `application/x-www-form-urlencoded` request/response handling (parse token responses with `URLSearchParams`), no caching, and error mapping to the existing `DiscogsRateLimitError` / `DiscogsUnavailableError` classes from `backend/src/discogs/discogsErrors.ts` (429 → rate limit, other 4xx passthrough for flow-specific handling, 5xx/network → unavailable)
- [X] T006 [P] Create the Discogs OAuth stub in `e2e/helpers/discogsOauthStub.ts`: plain Node `http` server exposing `GET /oauth/request_token` (urlencoded `oauth_token`, `oauth_token_secret`, `oauth_callback_confirmed=true`), `GET /oauth/authorize` (HTML page with "Authorize" and "Deny" buttons that redirect to the captured callback URL with `oauth_verifier=...` or `denied=...`), `POST /oauth/access_token` (urlencoded access token/secret), `GET /oauth/identity` (JSON `{ id, username }` fixed fixture), per contracts/discogs-oauth-api.md "External calls" table
- [X] T007 Wire the stub into `e2e/playwright.config.ts`: add the stub to the `webServer` list (fixed port, health-checkable route) and extend the backend server env with `DISCOGS_OAUTH_BASE_URL`/`DISCOGS_AUTHORIZE_BASE_URL` pointing at the stub, fake `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`, and `DISCOGS_OAUTH_CALLBACK_URL=http://localhost:5173/app/profile/discogs/callback`

**Checkpoint**: Signature builder unit-tested green; stub runs locally — user story implementation can begin.

---

## Phase 3: User Story 1 - Link my Discogs account from my profile (Priority: P1) 🎯 MVP

**Goal**: A signed-in user starts in the profile's "not connected" card, authorizes Vinylmania on Discogs, returns, and sees the connected card with their Discogs username; the link persists across sessions and only attaches to the initiating user.

**Independent Test**: quickstart.md §3 scenario 1 — sign in, link via the stub's Authorize button, land back on the profile showing the stub username, reload and confirm persistence.

### Tests for User Story 1 (write first, observe failing) ⚠️

- [X] T008 [P] [US1] Write failing contract tests in `backend/tests/contract/discogsOauthRoutes.test.ts` (supertest + nock + Firestore emulator) for `POST /api/discogs/oauth/request` (200 `{authorizeUrl}` containing the request token; 401 without bearer; 409 `already_connected` when a connection doc exists), `POST /api/discogs/oauth/complete` (200 ConnectionStatus on happy path; 400 `validation_error` on malformed body; 401 without bearer; 409 `already_connected`), and `GET /api/discogs/oauth/status` (200 `{connected:false}`; 200 connected shape; response keys EXACTLY the ConnectionStatus DTO — assert `accessToken`/`accessTokenSecret` absent), per contracts/discogs-oauth-api.md
- [X] T009 [P] [US1] Write failing service tests in `backend/tests/unit/discogsOauthService.test.ts` (nock + Firestore emulator): `startLink` stores `discogsOAuthRequests/{oauthToken}` with uid + secret + `expiresAt` = now+15min and returns the authorize URL; `completeLink` verifies pending doc uid matches caller, exchanges token, calls `/oauth/identity`, writes `discogsConnections/{uid}` with username/userId/tokens/linkedAt, deletes the pending doc; `completeLink` for an unknown token throws `invalid_request` and writes nothing (no-partial-state invariant); `getConnection` returns null / the stored connection

### Implementation for User Story 1

- [X] T010 [US1] Implement `backend/src/discogs/oauth/discogsOauthService.ts` (`startLink`, `completeLink`, `getConnection`) using T004/T005 building blocks and the two Firestore collections per data-model.md, with structured logs `link_started` / `link_completed` / `link_failed` following the existing `{ route, outcome, uid, message }` logger shape — make T009 pass
- [X] T011 [US1] Implement `backend/src/routes/discogsOauth.ts` with `requireAuth` on all routes: `POST /request` (409 guard via `getConnection`), `POST /complete` (zod body `{oauthToken, oauthVerifier}`, error-code → HTTP mapping per contract), `GET /status` (Firestore-only read) — make T008 pass
- [X] T012 [US1] Mount the router in `backend/src/app.ts` as `app.use('/api/discogs/oauth', discogsOauthRouter)` placed BEFORE the existing `app.use('/api/discogs', discogsRouter)` line
- [X] T013 [P] [US1] Write failing component tests in `frontend/src/components/DiscogsConnectionCard.test.tsx`: skeleton renders while status loading (same sizing classes as final card), "not connected" state shows a link action that triggers the request mutation, "connected" state shows Discogs username + linked date and NO link action
- [X] T014 [P] [US1] Write failing component tests in `frontend/src/pages/DiscogsCallbackPage.test.tsx`: with `oauth_token`+`oauth_verifier` query params it calls the complete mutation and navigates to `/app/profile` with `linked` outcome state
- [X] T015 [P] [US1] Implement `frontend/src/services/discogsOauthApi.ts` with `authorizedFetch` wrappers: `getDiscogsStatus()`, `requestDiscogsLink()` (returns `{authorizeUrl}`), `completeDiscogsLink(oauthToken, oauthVerifier)`
- [X] T016 [US1] Implement `frontend/src/queries/discogsOauthQueries.ts`: `useDiscogsStatus` query (key `['discogs-oauth','status']`), `useRequestDiscogsLink` mutation (on success → `window.location.assign(authorizeUrl)`), `useCompleteDiscogsLink` mutation (on settled → invalidate status query), following the existing patterns in `frontend/src/queries/`
- [X] T017 [US1] Implement `frontend/src/components/DiscogsConnectionCardSkeleton.tsx` and `frontend/src/components/DiscogsConnectionCard.tsx` using the shared `Card`/`Button` atoms from `frontend/src/components/ui/`, Tailwind v4 utilities, dark-mode variants, and identical sizing across skeleton/empty/connected states — make T013 pass
- [X] T018 [US1] Implement `frontend/src/pages/DiscogsCallbackPage.tsx`: parse query params, run complete mutation with skeleton while in flight, then `navigate('/app/profile', { state: { discogsOutcome: 'linked' } })` (failure outcomes completed in US3) — make T014 pass
- [X] T019 [US1] Register the callback route `/app/profile/discogs/callback` in `frontend/src/App.tsx` (same auth guard as other `/app` routes) and rebuild `frontend/src/pages/ProfilePage.tsx`: replace `UnderConstruction` with the profile layout hosting `DiscogsConnectionCard` and a dismissible success message read from router state
- [X] T020 [US1] Write the e2e happy-path spec in `e2e/tests/discogs-account-link.spec.ts` using `signInAsFakeGoogleUser` + the stub: profile shows "not connected" → link → stub authorize page → Authorize → back on profile with success message + connected card showing the stub username → reload keeps connected state; run it green

**Checkpoint**: Full link flow works end-to-end against the stub; MVP deliverable.

---

## Phase 4: User Story 2 - See my connection status and unlink (Priority: P2)

**Goal**: A linked user sees the active connection at a glance and can disconnect (≤2 interactions), returning the card to "not connected" durably; re-linking is blocked until disconnect (FR-008).

**Independent Test**: quickstart.md §3 scenarios 3–4 — from a linked state, disconnect with confirm, verify "not connected" persists across reload; verify no Link action exists while connected and direct `POST /request` returns 409.

### Tests for User Story 2 (write first, observe failing) ⚠️

- [X] T021 [P] [US2] Extend `backend/tests/contract/discogsOauthRoutes.test.ts` with failing tests for `DELETE /api/discogs/oauth/connection`: 204 with connection deleted from Firestore, 204 again when nothing exists (idempotent), 401 without bearer
- [X] T022 [P] [US2] Extend `frontend/src/components/DiscogsConnectionCard.test.tsx` with failing tests: connected state exposes a Disconnect action, first click reveals an inline confirm step (no browser `confirm()`), confirming fires the disconnect mutation, canceling restores the card, total ≤2 interactions to complete (SC-004)

### Implementation for User Story 2

- [X] T023 [US2] Add `disconnect(uid)` to `backend/src/discogs/oauth/discogsOauthService.ts` (delete `discogsConnections/{uid}`, idempotent, structured log `disconnected`) and the `DELETE /connection` handler to `backend/src/routes/discogsOauth.ts` — make T021 pass
- [X] T024 [US2] Add `disconnectDiscogs()` to `frontend/src/services/discogsOauthApi.ts` and `useDisconnectDiscogs` mutation (invalidates the status query on settled) to `frontend/src/queries/discogsOauthQueries.ts`
- [X] T025 [US2] Add the Disconnect action with inline confirm to `frontend/src/components/DiscogsConnectionCard.tsx`, keeping all states on the same sizing classes (no layout shift) — make T022 pass
- [X] T026 [US2] Extend `e2e/tests/discogs-account-link.spec.ts` with: disconnect scenario (link → disconnect → confirm → "not connected" persists after reload → can re-link) and re-link-blocked scenario (while connected the card offers no Link action and `POST /api/discogs/oauth/request` with the session's bearer token returns 409 `already_connected`); run green

**Checkpoint**: Connection lifecycle (link → status → unlink → re-link) fully working.

---

## Phase 5: User Story 3 - Graceful handling when authorization fails or is abandoned (Priority: P3)

**Goal**: Denial, expiry, tampering, and Discogs outages/rate limits all resolve to a clean "not connected" (or unchanged) state with clear, non-technical messages and actionable structured logs; no partial state ever persists.

**Independent Test**: quickstart.md §3 scenario 2 — start link, press Deny on the stub, land on the profile with a "not completed" message, card still "not connected", retry works. Backend failure branches verified by the test suite.

### Tests for User Story 3 (write first, observe failing) ⚠️

- [X] T027 [P] [US3] Extend `backend/tests/unit/discogsOauthService.test.ts` and `backend/tests/contract/discogsOauthRoutes.test.ts` with failing tests: complete with `expiresAt` in the past → `expired_request` (400) AND pending doc deleted; complete with a pending doc owned by another uid → `invalid_request` (400) and the pending doc retained; nock-simulated Discogs 429 on request/exchange/identity → 429 `discogs_rate_limited`; nock-simulated 500/network error → 503 `discogs_unavailable`; every failure branch emits a `link_failed` log with a cause and writes no `discogsConnections` doc (SC-002, SC-006)
- [X] T028 [P] [US3] Extend `frontend/src/pages/DiscogsCallbackPage.test.tsx` and ProfilePage tests with failing cases: callback URL with `denied` param (or missing `oauth_verifier`) navigates to the profile with `denied` outcome WITHOUT calling the API; complete mutation rejecting with `expired_request` → `expired` outcome; other API errors → `error` outcome; ProfilePage renders a distinct dismissible message per outcome (`denied`, `expired`, `error`) alongside a still-functional "not connected" card

### Implementation for User Story 3

- [X] T029 [US3] Complete the failure branches in `backend/src/discogs/oauth/discogsOauthService.ts` and `backend/src/routes/discogsOauth.ts`: expiry check + lazy pending-doc deletion, uid-mismatch rejection, Discogs error passthrough mapping (429/503) with contract-specified codes and user-safe messages — make T027 pass
- [X] T030 [US3] Complete `frontend/src/pages/DiscogsCallbackPage.tsx` denial/failure handling and `frontend/src/pages/ProfilePage.tsx` outcome messages (denied / expired / error variants, dismissible, retriable card untouched) — make T028 pass
- [X] T031 [US3] Extend `e2e/tests/discogs-account-link.spec.ts` with the denial scenario: start link → Deny on the stub authorize page → profile shows the "not completed" message, card remains "not connected", starting the flow again works; run green

**Checkpoint**: All spec edge cases covered by automated tests; Story 3 acceptance scenarios pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution workflow gates and final validation.

- [X] T032 [P] Add the dated `0.3.0` `Added` entry to `backend/CHANGELOG.md` and bump `version` to `0.3.0` in `backend/package.json` (MINOR: new endpoints + collections, per plan.md)
- [X] T033 [P] Add the dated `0.6.0` `Added` entry to `frontend/CHANGELOG.md` and bump `version` to `0.6.0` in `frontend/package.json` (MINOR: new profile capability + route)
- [X] T034 Run the full automated validation from quickstart.md §1–3 (`cd backend && npm test`, `cd frontend && npm test`, `cd e2e && npm test`) and fix anything red
- [ ] T035 Perform the manual smoke test against real Discogs per quickstart.md §4 and the SC-005 secret-exposure checks (§5): `git grep` for key material, dev-tools network inspection confirming no token/consumer-secret ever reaches the browser

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup; T004 requires T003 failing first; T005 after T004; T007 after T006. **Blocks all user stories**
- **US1 (Phase 3)**: after Phase 2. Within: T008/T009 (failing tests) before T010–T012; T013/T014 before T017/T018; T015 → T016 → T017/T018 → T019 → T020
- **US2 (Phase 4)**: after US1 (disconnect needs an existing connection flow). Within: T021/T022 before T023–T025; T026 last
- **US3 (Phase 5)**: after US1 (failure branches live inside the link flow); independent of US2. Within: T027/T028 before T029/T030; T031 last
- **Polish (Phase 6)**: after all desired stories; T032/T033 parallel; T034 → T035

### User Story Dependencies

- **US1 (P1)**: only Foundational — the MVP
- **US2 (P2)**: builds on US1's service/routes/card, still independently testable (its own quickstart scenarios)
- **US3 (P3)**: builds on US1's flow; does not touch US2 files' disconnect logic — US2 and US3 can proceed in parallel after US1

### Parallel Opportunities

- Phase 2: T002, T003, T006 in parallel
- US1: T008 ∥ T009 (different test files); T013 ∥ T014 ∥ T015 (different frontend files); backend chain (T010–T012) ∥ frontend chain (T015–T018) once tests exist
- US2 ∥ US3 after US1 completes (disjoint failure-handling vs disconnect surfaces; both extend the e2e spec — coordinate or serialize T026/T031)
- Polish: T032 ∥ T033

## Parallel Example: User Story 1

```bash
# After Phase 2, launch US1's failing tests together:
Task: "T008 contract tests in backend/tests/contract/discogsOauthRoutes.test.ts"
Task: "T009 service tests in backend/tests/unit/discogsOauthService.test.ts"

# Then implement backend and frontend chains in parallel:
Task: "T010–T012 backend service + routes + mount"
Task: "T013–T018 frontend tests, api, queries, card, callback page"
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → Phase 3 (US1)
2. **STOP and VALIDATE**: e2e happy path green (T020), quickstart §3 scenario 1
3. Deployable increment: users can link and see the linked state (disconnect ships next)

### Incremental Delivery

1. Setup + Foundational → building blocks proven by unit tests + running stub
2. US1 → MVP: link + status + persistence
3. US2 → complete lifecycle: disconnect + re-link guard surfaced in UI
4. US3 → hardened failure paths (denial/expiry/outage messaging)
5. Polish → changelogs, version bumps, full validation, real-Discogs smoke test

## Notes

- Verify each test task FAILS before starting its paired implementation task (constitution Principle I)
- Commit after each task or logical group using Conventional Commits (`feat(discogs-oauth): ...`, `test(discogs-oauth): ...`)
- T026 and T031 both edit `e2e/tests/discogs-account-link.spec.ts` — do not run them concurrently
- The real consumer key/secret never appear in code, tests, fixtures, or logs; tests and e2e use fake credentials
