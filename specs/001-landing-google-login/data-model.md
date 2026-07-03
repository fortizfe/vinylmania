# Data Model: Landing Page & Google Sign-In

## User

Represents a person who has signed in with Google (spec FR-006, Key Entities).
Stored as a Firestore document at `users/{uid}`, where `uid` is the Firebase
Auth user ID (stable per Google account).

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | yes | Firebase Auth UID; also the document ID. Immutable. |
| `displayName` | string | yes | From the Google account at sign-in time. |
| `email` | string | yes | From the Google account. Not used as the document key (uid is), since email can theoretically change. |
| `photoURL` | string | no | Google profile photo URL, if the account has one. |
| `createdAt` | timestamp | yes | Set once, at first sign-in (get-or-create). Never updated. |
| `lastSignInAt` | timestamp | yes | Updated on every successful sign-in verification. |

**Validation rules**:
- `uid`, `displayName`, `email` MUST be present (sourced directly from a
  verified Firebase ID token; absence means the token itself is malformed and
  the request MUST be rejected before a document is written).
- `email` is trusted as-is from the verified Google-issued ID token; no
  separate email-verification step is required for this feature.

**Relationships**: Each `User` is fully independent — no cross-user
references exist in this feature. Future features (personal collections) will
attach child data under this same `uid`, but that is out of scope here (see
spec Assumptions).

**State transitions**: A `User` document has no status/lifecycle field in this
feature — it exists once created and is only ever read or have
`lastSignInAt` refreshed. Account deletion/administration is explicitly out of
scope (spec Assumptions).

## Session (conceptual — not a stored entity)

Represents the period during which a visitor is recognized as authenticated
(spec Key Entities). Deliberately **not** a server-side stored record (see
research.md §6): it is represented entirely by:
- **Client-side**: Firebase Auth's own persisted session (browser
  IndexedDB/localStorage), which is what makes a returning visitor recognized
  automatically (FR-005).
- **Per-request, on the backend**: the Firebase ID token sent as
  `Authorization: Bearer <token>` and verified fresh on each request — there is
  no session table to expire, revoke, or migrate.

Signing out (FR-009) simply clears the client-side Firebase Auth session;
there is no server-side session record to delete.
