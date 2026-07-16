# Quickstart: Frontend habla solo con el backend propio

**Feature**: 051-frontend-backend-only-network | **Date**: 2026-07-16

Validation scenarios proving User Story 1 (constitution principle) and User
Story 2 (login redesign) both work end-to-end. See `contracts/google-login-api.md`
for request/response shapes and `data-model.md` for the `Session`/
`PendingGoogleLogin` documents referenced below.

## Prerequisites

- Backend `.env` (or e2e `webServer` env, see `e2e/playwright.config.ts`)
  configured with: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_CALLBACK_URL` (`{FRONTEND_URL}/login/callback`),
  `GOOGLE_OAUTH_BASE_URL`, `GOOGLE_TOKEN_BASE_URL`, `GOOGLE_USERINFO_BASE_URL`
  (all overridable for the e2e stub, mirroring the existing `DISCOGS_*` env
  vars).
- Firebase emulators running (`firestore` required; `auth` required only
  for the subset of tests exercising Firebase Admin's `getUserByEmail`/
  `createUser`, per `research.md` R5).
- A new `e2e/helpers/googleOauthStub.ts` running locally (mirrors
  `discogsOauthStub.ts`), started by `e2e/playwright.config.ts`'s
  `webServer` list.

## Scenario 1 — Constitution principle is ratified (User Story 1)

```bash
grep -n "^### IX\." .specify/memory/constitution.md
grep -n "^\*\*Version\*\*" .specify/memory/constitution.md
```

**Expected**: a new Principle IX exists with MUST/MUST NOT language covering
frontend-initiated JS requests, the full-page-OAuth-redirect carve-out, and
the static-resource carve-out; the version line reads `2.6.0`.

## Scenario 2 — Successful login, no direct Firebase/Google request from the browser

```bash
cd e2e && npx playwright test login.spec.ts
```

Drive manually for a sanity check:
1. Open the frontend, click "Sign in with Google" — the browser should
   **navigate** to `{BACKEND_URL}/api/auth/google/authorize` (check the
   Network tab: a top-level document request, not an XHR/fetch), which
   `302`s to the Google stub's authorize page.
2. Approve on the stub page — it redirects to
   `{FRONTEND_URL}/login/callback?code=...&state=...`.
3. The callback page `POST`s to `/api/auth/google/complete` and then
   navigates to `/app`, now showing the signed-in user.

**Expected**: at no point does the Network tab show a request to
`accounts.google.com`, `googleapis.com`, or any `firebaseapp.com`/
`identitytoolkit.googleapis.com` host initiated by frontend JavaScript —
only the one full-page navigation in step 1, and ordinary `fetch` calls to
the backend's own origin.

## Scenario 3 — Denial / cancellation

Deny on the stub's authorize page instead of approving.

**Expected**: browser lands back on `/login/callback?error=access_denied&state=...`,
the page shows the "denied/cancelled" outcome without ever calling
`/api/auth/google/complete`, and the user remains signed out.

## Scenario 4 — Silent renewal during active use

```bash
cd e2e && npx playwright test session-renewal.spec.ts
```

Sign in, then keep making authenticated requests (e.g. navigate between
`/app` and `/app/library`) spaced further apart than the sliding window's
throttling interval but well inside `expiresAt`.

**Expected**: no visible interruption, no redirect to `/login/callback`, no
error banner — each request's success silently extends the `Session`
document's `expiresAt` (verify directly against the Firestore emulator if
needed: `sessions/{sessionId}.expiresAt` moves forward across requests).

## Scenario 5 — Real expiration

Manually expire a `Session` document in the Firestore emulator (set
`expiresAt` to the past) or wait past the sliding window with no requests,
then trigger any authenticated call.

**Expected**: `401 { "error": "unauthorized", ... }`, `apiClient.ts` detects
it, `AuthContext` clears `user` and the stored `sessionToken`, and the UI
returns to the signed-out landing state — no crash, no infinite retry loop.

## Scenario 6 — Logout only revokes the current device

1. Sign in twice (two `Session` documents, same `uid`) — e.g. two
   `page.context()`s in a Playwright test, or two browsers manually.
2. Log out from one.

**Expected**: the logged-out device's next authenticated request gets
`401`; the other device's session keeps working unaffected (`DELETE
/api/auth/session` only removed one `sessions/{sessionId}` document).

## Scenario 7 — Rollout: rejected legacy Firebase ID token

Manually send a request with `Authorization: Bearer <a real, previously
valid Firebase ID token>` (e.g. mint one via
`backend/tests/helpers/authEmulator.ts`'s retained `getTestIdToken`, kept
for exactly this kind of check per `research.md` R5) against the deployed
(post-migration) backend.

**Expected**: `401 { "error": "unauthorized", "message": "Sign-in required
or session expired." }` — the same response as any other expired session,
no dual-verification code path, no special-cased error.

## Scenario 8 — Frontend no longer depends on `firebase`

```bash
grep -rn "from 'firebase" frontend/src && echo "FAIL: firebase import found" || echo "OK: no firebase imports"
grep -n '"firebase"' frontend/package.json && echo "FAIL: dependency still listed" || echo "OK: dependency removed"
```

**Expected**: both checks print `OK`.
