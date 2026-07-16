# Data Model: Frontend habla solo con el backend propio

**Feature**: 051-frontend-backend-only-network | **Date**: 2026-07-16

This feature adds one new Firestore collection (`sessions`) and one
short-lived pending-request collection (`pendingGoogleLogins`), and changes
what identifies a caller on every existing authenticated request. It does
not change any existing catalog, library, or rating data shape (SC-005).

## Session

Represents one authenticated device/browser (Clarification: a user MAY have
several independent, concurrent `Session`s — one per device — and revoking
or expiring one MUST NOT affect the others).

**Firestore path**: `sessions/{sessionId}`

| Field | Type | Notes |
|---|---|---|
| `sessionId` | string (doc id) | Opaque, cryptographically random (this *is* the bearer token value — no separate secret/id split, since revocation just deletes the doc). |
| `uid` | string | Firebase-managed user id (R3b) this session belongs to. |
| `createdAt` | ISO 8601 string | Set once, never updated. |
| `lastSeenAt` | ISO 8601 string | Updated by the sliding-window renewal (R7), throttled. |
| `expiresAt` | ISO 8601 string | Sliding window; extended on renewal. Firestore TTL policy on this field handles eventual cleanup of abandoned sessions. |

**Lifecycle**:
- Created by `completeGoogleLogin` (one per successful login).
- Read + `lastSeenAt`/`expiresAt` extended by every authenticated request
  (`sessionAuthVerifierAdapter` → `touchSession`) — this *is* silent renewal
  (research.md R7); there is no separate "refresh" state.
- Deleted by `logoutSession` (current device only) or by Firestore TTL once
  `expiresAt` lapses with no further activity (real expiration).

**Validation / invariants**:
- A request presenting a `sessionId` with no matching document, or a
  document whose `expiresAt` has passed, MUST be treated identically to a
  missing credential (401 `unauthorized`) — no distinct "expired" vs.
  "invalid" response, matching `requireAuth`'s existing behavior today.
- Deleting one `Session` document MUST NOT touch any other document in this
  collection, even for the same `uid` (per-device isolation, Clarification).

## PendingGoogleLogin

An anti-forgery `state` record for one in-flight login attempt (the login
equivalent of the existing `discogsConnections` pending-request pattern —
but *not* owned by a `uid`, since the whole point of login is that no `uid`
is known yet).

**Firestore path**: `pendingGoogleLogins/{state}`

| Field | Type | Notes |
|---|---|---|
| `state` | string (doc id) | Opaque, cryptographically random anti-forgery token, echoed back by Google. |
| `createdAt` | ISO 8601 string | |
| `expiresAt` | ISO 8601 string | Short TTL (minutes), mirroring `discogsConnections`' pending-request expiry handling. |

**Lifecycle**: created by `startLogin`, consumed (read + deleted,
single-use) by `completeLogin`. An unknown, already-consumed, or expired
`state` MUST raise `GoogleAuthFlowError('invalid_state' | 'expired_state')`
— see `domain/googleAuth/googleAuthErrors.ts` in research.md R8.

## GoogleIdentity (transient, not persisted)

The result of `GoogleIdentityPort.exchangeCodeForIdentity` (research.md R3).
Never written to Firestore as its own document — it exists only to resolve
a `uid` (R3b) and populate/refresh the existing `UserProfile`
(`domain/users/types.ts`, unchanged by this feature).

| Field | Type | Notes |
|---|---|---|
| `sub` | string | Google's stable account id. Not used as the Vinylmania `uid` (R3b uses the Firebase-managed `uid` instead, for continuity with existing data). |
| `email` | string | Used to resolve/create the Firebase user via `getUserByEmail`/`createUser`. |
| `name` | string | Maps to `UserProfile.displayName`. |
| `picture` | string? | Maps to `UserProfile.photoURL`. |

## AuthenticatedUser (existing type, unchanged shape)

`domain/auth/types.ts`'s `AuthenticatedUser { uid, email, name?, picture? }`
is unchanged — `req.auth` downstream of `requireAuth` still has this exact
shape regardless of whether it was resolved from a Firebase ID token
(today) or a `Session` lookup (after this feature), per research.md R4.

## Removed / retired

- No Firestore collection is removed. `users/{uid}` and
  `discogsConnections/{uid}` are untouched by this feature (SC-005).
- `backend/tests/helpers/authEmulator.ts`'s `getTestIdToken` is retired for
  general-purpose authenticated-route testing in favor of a direct
  `sessions/{sessionId}` write (research.md R5); it MAY remain for the
  narrower set of tests that specifically exercise `completeGoogleLogin`'s
  Firebase Admin user-resolution step.
