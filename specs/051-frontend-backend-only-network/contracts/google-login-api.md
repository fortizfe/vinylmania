# API Contract: Google Login & Own-Backend Session

**Feature**: 051-frontend-backend-only-network | **Base path**: `/api/auth`

Replaces the Firebase-ID-token-based auth used today. All error bodies keep
the project-wide `{ "error": <code>, "message": <user-safe text> }` shape;
internal details go to structured logs only.

---

## GET /api/auth/google/authorize

**Public** (no `Authorization` header — there is no session yet). Creates a
`PendingGoogleLogin` (anti-forgery `state`), then responds with an HTTP
`302` redirect straight to Google's authorization endpoint. The frontend's
"Sign in with Google" control is a plain full-page navigation to this URL
(`<a href>` / `window.location.assign`), never a `fetch` — this is the one
request per this feature's Core Principle that the browser makes to a
non-Vinylmania-backend URL, and it is a page navigation, not a JS-initiated
request (FR-003).

**Query params**: none required. An optional `redirectTo` MAY be accepted
and echoed back (encoded into `state`) to support returning the user to the
page they were on — not required for MVP; default post-login destination is
`/app`.

**Response**: `302` with `Location:
{GOOGLE_OAUTH_BASE_URL}/o/oauth2/v2/auth?client_id=...&redirect_uri={GOOGLE_OAUTH_CALLBACK_URL}&response_type=code&scope=openid%20email%20profile&state=<opaque>`.

**Log events**: `outcome: "login_started"` (info).

---

## POST /api/auth/google/complete

**Public**. Called by the frontend's `/login/callback` page (never by
Google directly — Google redirects the *browser*, which lands on the
frontend page first; see `research.md` R6) with the `code`/`state`/`error`
read from that page's query string.

**Request body** (zod-validated):

```json
{ "code": "<string, non-empty>", "state": "<string, non-empty>" }
```

or, when Google signaled a denial:

```json
{ "error": "access_denied", "state": "<string, non-empty>" }
```

**Responses**:

| Status | Body | When |
|---|---|---|
| 200 | `{ "sessionToken": "<opaque>", "user": <UserProfile> }` | Login completed: code exchanged, identity resolved to a `uid` (creating one if new), `Session` created, `UserProfile` created/refreshed in Firestore (same shape today's `POST /api/auth/session` returned). |
| 400 | `{ "error": "validation_error", "message": "The sign-in request is malformed." }` | Body fails zod validation |
| 400 | `{ "error": "invalid_state", "message": "This sign-in attempt is not valid. Please try signing in again." }` | Unknown or already-consumed `state` |
| 400 | `{ "error": "expired_state", "message": "This sign-in attempt expired. Please try signing in again." }` | `PendingGoogleLogin.expiresAt` passed |
| 400 | `{ "error": "denied", "message": "Sign-in was cancelled." }` | `error=access_denied` in the request body |
| 502 | `{ "error": "exchange_failed", "message": "We could not reach the sign-in service. Please try again." }` | The code↔token or token↔identity exchange with Google failed |

**Log events**: `outcome: "login_completed"` (info, uid) / `outcome:
"login_failed"` (warn/error, cause code, no uid if resolution never
happened).

---

## DELETE /api/auth/session

**Authenticated** (current session's `Authorization: Bearer <sessionToken>`
required). Revokes **only** the calling device's `Session` document — other
active sessions for the same `uid`, on other devices, are untouched
(Clarification, Session 2026-07-16). The underlying delete is idempotent
(revoking an already-gone session document does not error), but because the
session token being revoked is also the credential authenticating the
request, a *repeat* call with the same token after the first successful
revocation gets `401` from `requireAuth` before it ever reaches this
handler — there is no session left to prove ownership of, so this is
correct, not a bug.

**Responses**:

| Status | Body | When |
|---|---|---|
| 204 | (empty) | Session deleted, or already gone (idempotent) |

**Log events**: `outcome: "logged_out"` (info, uid).

---

## GET /api/auth/me — unchanged response shape, changed auth mechanism

Still returns the caller's `UserProfile`, still `401` when unauthenticated.
The only change is *what* `Authorization: Bearer <token>` now means: a
`Session` lookup (this feature) instead of a Firebase ID-token verification.
Every successful call to this — or any other authenticated — endpoint
silently extends the session's sliding-window expiry (research.md R7); there
is no separate refresh call for the frontend to make.

## PATCH /api/auth/preferences — unchanged

No change beyond the auth mechanism above.

## Removed: POST /api/auth/session

Today's session-establishment endpoint (took a Firebase ID token, returned
the `UserProfile`) is removed. Its Firestore-profile-sync logic is reused
*inside* `completeGoogleLogin` (`POST /api/auth/google/complete` above), not
exposed as its own endpoint — there is no longer a standalone Firebase ID
token for a client to present to it.

---

## External calls made by the backend (for the e2e stub's fidelity)

| Call | Details | Success response |
|---|---|---|
| `GET {GOOGLE_OAUTH_BASE_URL}/o/oauth2/v2/auth` | Browser navigation (not made by the backend itself — the backend issues the `302`) | Stub renders an "Approve" / "Deny" page, like `discogsOauthStub.ts`'s `authorizePageHtml` |
| `POST {GOOGLE_TOKEN_BASE_URL}/token` | `client_id`, `client_secret`, `code`, `redirect_uri`, `grant_type=authorization_code` | `{ "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }` |
| `GET {GOOGLE_USERINFO_BASE_URL}/userinfo` | `Authorization: Bearer <access_token>` | `{ "sub": "...", "email": "...", "name": "...", "picture": "..." }` |

Browser-facing redirect target: Google returns the browser to
`GOOGLE_OAUTH_CALLBACK_URL` (the **frontend**'s `/login/callback`, see
`research.md` R6) with `?code=...&state=...` (approved) or
`?error=access_denied&state=...` (denied).

## Frontend route contract

| Route | Behavior |
|---|---|
| `/` (`LandingPage`) | "Sign in with Google" is a plain navigation (`<a href>`/`window.location.assign`) to `{API_BASE_URL}/api/auth/google/authorize` — never a `fetch`. |
| `/login/callback` (new `LoginCallbackPage`, public — not wrapped in `AuthenticatedLayout`) | Reads `code`/`state`/`error` from the query string. With `error=access_denied`: shows the denied outcome immediately, no backend call (mirrors `DiscogsCallbackPage`'s no-verifier case). Otherwise `POST`s `{ code, state }` to `/api/auth/google/complete`; on success stores `sessionToken` + `user` and navigates to `/app`; on failure maps the error code to the same `denied \| expired \| error` outcome vocabulary already used by `DiscogsOutcome`, surfaced via the existing `error` slot in `AuthContext`. |
