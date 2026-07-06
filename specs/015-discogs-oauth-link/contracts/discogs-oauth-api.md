# API Contract: Discogs OAuth Account Linking

**Feature**: 015-discogs-oauth-link | **Base path**: `/api/discogs/oauth` (mounted before `/api/discogs` in `app.ts`)

All endpoints require `Authorization: Bearer <Firebase ID token>` (existing `requireAuth` middleware). Unauthenticated requests receive the standard `401 { "error": "unauthorized", "message": "Sign-in required or session expired." }`. All error bodies follow the project-wide `{ "error": <code>, "message": <user-safe text> }` shape; internal details go to structured logs only (FR-012).

---

## POST /api/discogs/oauth/request

Starts the linking flow: obtains a Discogs request token (with `oauth_callback` = `DISCOGS_OAUTH_CALLBACK_URL`), persists a `PendingOAuthRequest`, returns the authorize URL for the browser to visit.

**Request body**: none.

**Responses**:

| Status | Body | When |
|---|---|---|
| 200 | `{ "authorizeUrl": "https://www.discogs.com/oauth/authorize?oauth_token=..." }` | Request token obtained and pending attempt stored |
| 409 | `{ "error": "already_connected", "message": "Your Discogs account is already linked. Disconnect it first to link again." }` | `discogsConnections/{uid}` exists (FR-008) |
| 429 | `{ "error": "discogs_rate_limited", "message": "Discogs is receiving too many requests right now. Please try again in a moment." }` | Discogs returned 429 |
| 503 | `{ "error": "discogs_unavailable", "message": "Discogs is temporarily unavailable. Please try again later." }` | Discogs 5xx / network error / timeout |

**Log events**: `outcome: "link_started"` (info, with uid) / `outcome: "link_start_failed"` (error, with cause).

---

## POST /api/discogs/oauth/complete

Completes the flow after the user returns from Discogs. Validates the pending attempt, exchanges request token + verifier for the access token/secret, verifies identity via `GET /oauth/identity`, persists the `DiscogsConnection`, deletes the pending attempt.

**Request body** (zod-validated):

```json
{ "oauthToken": "<string, non-empty>", "oauthVerifier": "<string, non-empty>" }
```

**Responses**:

| Status | Body | When |
|---|---|---|
| 200 | `{ "connected": true, "discogsUsername": "...", "linkedAt": "<ISO 8601>" }` | Link established and verified |
| 400 | `{ "error": "validation_error", "message": "The link request is malformed." }` | Body fails zod validation |
| 400 | `{ "error": "invalid_request", "message": "This link attempt is not valid. Please start again from your profile." }` | Unknown `oauthToken`, or pending attempt belongs to a different uid, or tampered params (edge case: never persists partial state) |
| 400 | `{ "error": "expired_request", "message": "This link attempt expired. Please start again from your profile." }` | `expiresAt` passed, or Discogs rejects the exchange as expired (pending doc deleted) |
| 409 | `{ "error": "already_connected", "message": "Your Discogs account is already linked. Disconnect it first to link again." }` | Connection already exists for this uid (FR-008; stale-tab edge case) |
| 429 / 503 | as in `/request` | Discogs rate limit / unavailability during exchange or identity check |

**Invariant**: on any non-200 outcome, no `DiscogsConnection` document exists that did not exist before the call (SC-002).

**Log events**: `outcome: "link_completed"` (info, uid + discogsUsername) / `outcome: "link_failed"` (warn/error, uid + cause code).

---

## GET /api/discogs/oauth/status

Returns the connection state for the signed-in user, **read from Firestore only — no Discogs call** (spec clarification, Session 2026-07-06).

**Responses**:

| Status | Body | When |
|---|---|---|
| 200 | `{ "connected": false }` | No connection stored |
| 200 | `{ "connected": true, "discogsUsername": "...", "linkedAt": "<ISO 8601>" }` | Connection stored |

**Contract test MUST assert**: response keys are exactly the ConnectionStatus DTO set; `accessToken`/`accessTokenSecret` never appear (FR-010, SC-005).

---

## DELETE /api/discogs/oauth/connection

Disconnects: deletes `discogsConnections/{uid}` (removing stored credentials, FR-005). Idempotent.

**Responses**:

| Status | Body | When |
|---|---|---|
| 204 | (empty) | Connection deleted, or none existed (idempotent) |

**Log events**: `outcome: "disconnected"` (info, uid).

---

## External calls made by the backend (for nock/stub fidelity)

| Call | Headers | Success response |
|---|---|---|
| `GET {DISCOGS_OAUTH_BASE_URL}/oauth/request_token` | `Authorization: OAuth oauth_consumer_key, oauth_nonce, oauth_signature="<consumer_secret>&", oauth_signature_method="PLAINTEXT", oauth_timestamp, oauth_callback`; `Content-Type: application/x-www-form-urlencoded`; `User-Agent` | urlencoded body: `oauth_token=...&oauth_token_secret=...&oauth_callback_confirmed=true` |
| `POST {DISCOGS_OAUTH_BASE_URL}/oauth/access_token` | as above plus `oauth_token`, `oauth_verifier`; signature `"<consumer_secret>&<request_token_secret>"` | urlencoded body: `oauth_token=...&oauth_token_secret=...` |
| `GET {DISCOGS_OAUTH_BASE_URL}/oauth/identity` | OAuth header with access token; signature `"<consumer_secret>&<access_token_secret>"` | JSON: `{ "id": <number>, "username": "<string>", ... }` |

Browser-facing redirect: `{DISCOGS_AUTHORIZE_BASE_URL}?oauth_token=<request_token>`; Discogs returns the browser to `DISCOGS_OAUTH_CALLBACK_URL` with `oauth_token` + `oauth_verifier` (approved) or `denied=<token>` (refused).

## Frontend route contract

| Route | Behavior |
|---|---|
| `/app/profile` | Hosts the Discogs connection card: skeleton while status query is in flight → not-connected (Link action) or connected (username, linked date, Disconnect action with inline confirm). Displays one-shot outcome messages (`linked` / `denied` / `expired` / `error`) passed via router state from the callback route. |
| `/app/profile/discogs/callback` | Reads query params. With `oauth_token` + `oauth_verifier`: calls `POST /complete`, then navigates to `/app/profile` with outcome state. With `denied` or missing verifier: navigates immediately with `denied` outcome (no backend call). Requires an authenticated session (same guard as other `/app` routes). |
