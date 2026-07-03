# Contract: Auth API (backend)

Base path: `/api/auth`

All endpoints require the Firebase ID token obtained by the frontend after
`signInWithPopup(GoogleAuthProvider)`, sent as:

```
Authorization: Bearer <firebase-id-token>
```

There is no unauthenticated endpoint in this feature — sign-in itself happens
entirely client-side against Firebase Auth; the backend's job is limited to
verifying the resulting identity and managing the `User` profile.

## POST /api/auth/session

Verifies the caller's ID token, creates the `User` profile on first sign-in
(get-or-create, research.md §7), refreshes `lastSignInAt`, and returns the
profile. The frontend calls this once right after a successful
`signInWithPopup`, and it is also safe to call again later (e.g. on app
reload) — it is idempotent aside from refreshing `lastSignInAt`.

**Request**: no body required (identity comes from the `Authorization`
header).

**Response 200**:
```json
{
  "uid": "abc123",
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "photoURL": "https://lh3.googleusercontent.com/...",
  "createdAt": "2026-07-03T10:00:00.000Z",
  "lastSignInAt": "2026-07-03T10:00:00.000Z"
}
```

**Response 401** (missing/invalid/expired token):
```json
{ "error": "unauthorized", "message": "Sign-in required or session expired." }
```
Internal cause (expired vs malformed vs missing) is logged server-side with
detail (Principle V); the client-facing message stays generic per the
constitution's user-facing vs internal error separation.

**Response 500** (unexpected failure, e.g. Firestore unavailable):
```json
{ "error": "internal_error", "message": "Something went wrong. Please try again." }
```

## GET /api/auth/me

Returns the caller's existing `User` profile without touching
`lastSignInAt`. Used by the authenticated placeholder screen to render the
signed-in user's name/photo (FR-010) on a page refresh, without re-registering
a sign-in event.

**Response 200**: same shape as `POST /api/auth/session`.

**Response 401**: same shape as above (also covers the case where no
`users/{uid}` document exists yet — the client should call
`POST /api/auth/session` first).

**Response 500**: same shape as above.

## Not part of this contract: sign-out

Sign-out (FR-009/User Story 3) is a client-only action (Firebase Auth
`signOut()`) — it clears the browser-persisted session directly with Firebase
and requires no backend endpoint (see data-model.md, Session).

## Observability requirements (Principle V)

The backend MUST log, for every call to either endpoint, at minimum:
`timestamp`, `route`, `outcome` (`verified` / `unauthorized` / `error`), and
the `uid` when available — sufficient to answer "who signed in, when, and did
verification succeed" without a debugger attached.
