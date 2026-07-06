# Quickstart: Validating the Discogs Account Link

**Feature**: 015-discogs-oauth-link

How to prove the feature works end-to-end. Contracts: [contracts/discogs-oauth-api.md](./contracts/discogs-oauth-api.md) · Data model: [data-model.md](./data-model.md).

## Prerequisites

- Node.js + repo dependencies installed (`npm install` in `backend/`, `frontend/`, `e2e/`).
- `backend/.env` contains the real `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, and `DISCOGS_OAUTH_CALLBACK_URL=http://localhost:5173/app/profile/discogs/callback` (values supplied by the project owner; never committed).
- A Discogs account for manual verification (only needed for the real-Discogs smoke test).

## 1. Automated backend tests (unit + contract)

```bash
cd backend && npm test
```

Runs Jest inside `firebase emulators:exec` (Auth + Firestore) with Discogs HTTP mocked by nock. Expected: all suites green, including new ones —

- `tests/unit/discogsOauthSignature.test.ts` — PLAINTEXT header formatting per step (callback / token+verifier / identity variants).
- `tests/unit/discogsOauthService.test.ts` — start/complete/disconnect lifecycle, expiry rejection, uid-mismatch rejection, no-partial-state invariant.
- `tests/contract/discogsOauthRoutes.test.ts` — the four endpoints against [the contract](./contracts/discogs-oauth-api.md): status codes, exact DTO key sets (no token fields ever serialized), 409 when already connected, idempotent 204 on disconnect, 401 without bearer token.

## 2. Automated frontend tests

```bash
cd frontend && npm test
```

Expected green: connection card renders skeleton → not-connected → connected states without layout shift classes changing; disconnect requires confirm; callback page maps `denied`/missing-verifier to the denied outcome without calling the API.

## 3. End-to-end (Playwright + Discogs stub)

```bash
cd e2e && npm test
```

Uses the Firebase emulators plus the local Discogs OAuth stub (`helpers/discogsOauthStub.ts`); the backend dev server is pointed at the stub via `DISCOGS_OAUTH_BASE_URL` / `DISCOGS_AUTHORIZE_BASE_URL` with fake consumer credentials (see [research.md R6](./research.md)). Expected passing scenarios in `tests/discogs-account-link.spec.ts`:

1. **Link happy path**: sign in (fake Google) → Profile → "not connected" card → link → stub authorize page → approve → land back on Profile with success message and connected card showing the stub username; reload keeps the connected state (persistence).
2. **Denial**: start link → deny on stub page → back on Profile with "not completed" message, card still "not connected", link can be retried.
3. **Disconnect**: from linked state → Disconnect → confirm → card returns to "not connected"; reload confirms persistence.
4. **Re-link blocked**: with an active connection, the card offers no Link action, and a direct `POST /api/discogs/oauth/request` returns `409 already_connected`.

## 4. Manual smoke test against real Discogs (pre-merge, once)

1. Start the app locally: `cd backend && npm run dev` and `cd frontend && npm run dev` (real `.env` values, real Firebase project).
2. Sign in with Google → open **Profile**.
3. Click the link action → you are on `discogs.com`'s consent page → authorize.
4. Back on the profile: card shows your real Discogs username and link date. Verify in Firestore console that `discogsConnections/{uid}` exists and `users/{uid}` is unchanged.
5. In the browser dev tools (Network tab), confirm no response contains `accessToken`/`accessTokenSecret` and no request from the browser carries the consumer key/secret (SC-005).
6. Disconnect → card returns to "not connected"; the Firestore document is gone.
7. Optional: re-link, then revoke access from Discogs' own settings, and confirm the app still shows connected (stored state, per clarification) until a future authenticated operation fails.

## 5. Success criteria spot-checks

| Criterion | How to verify here |
|---|---|
| SC-001 (< 2 min link) | Manual smoke test step 2–4 wall clock |
| SC-002 (no partial state on failure) | Backend service tests + e2e denial scenario |
| SC-003 (status always correct) | E2E scenarios 1–3 (including reloads) |
| SC-004 (disconnect ≤ 2 interactions) | E2E scenario 3 (action + confirm) |
| SC-005 (no secrets in repo/browser) | `git grep` for key material returns nothing; manual smoke step 5; contract tests on DTO keys |
| SC-006 (actionable failure logs) | Backend test assertions on logger output for `link_failed` events |
