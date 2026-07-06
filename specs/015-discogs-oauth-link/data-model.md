# Data Model: Link Vinylmania Account with Discogs (OAuth)

**Feature**: 015-discogs-oauth-link | **Date**: 2026-07-06

Storage: Firestore via Firebase Admin SDK (backend-only access). Both collections are new; no existing document shapes change (backward compatible, MINOR per Principle VI).

## Entity: DiscogsConnection

Firestore document: `discogsConnections/{uid}` — the document ID **is** the Vinylmania user's Firebase uid, which structurally enforces "at most one connection per user" (FR-008).

| Field | Type | Required | Description / Validation |
|---|---|---|---|
| `uid` | string | yes | Owning Vinylmania user (mirrors doc ID; must match `req.auth.uid` on every access) |
| `discogsUsername` | string | yes | Username returned by `GET /oauth/identity` at link time; shown in the profile card |
| `discogsUserId` | number | yes | Numeric Discogs user id from the identity response; stable key for future data integrations (FR-013) |
| `accessToken` | string | yes | User's OAuth access token. **Server-side only — never included in any API response DTO** (FR-010) |
| `accessTokenSecret` | string | yes | User's OAuth access token secret. Same handling as `accessToken` |
| `linkedAt` | Timestamp | yes | Server timestamp set at creation; surfaced as ISO string in status DTO |

**Lifecycle**: created atomically on successful completion of the OAuth exchange + identity verification; immutable while it exists (no partial updates); deleted wholesale on disconnect (FR-005). Re-creation requires a fresh full flow (FR-008: linking is rejected while this document exists).

**Relationships**: 1:0..1 with `users/{uid}` (same uid). Deliberately a separate top-level collection so no existing user-document serialization path can leak token fields (research.md R3). No global uniqueness on `discogsUserId`/`discogsUsername` — multiple Vinylmania users may link the same Discogs account (spec clarification, Session 2026-07-06).

## Entity: PendingOAuthRequest

Firestore document: `discogsOAuthRequests/{oauthToken}` — the document ID is the request token returned by Discogs, which is what Discogs echoes back to the callback, giving O(1) lookup.

| Field | Type | Required | Description / Validation |
|---|---|---|---|
| `uid` | string | yes | User who initiated the flow; completion MUST be requested by the same authenticated uid or it is rejected (FR-007) |
| `requestTokenSecret` | string | yes | Secret paired with the request token; needed to sign the access-token exchange. Server-side only |
| `createdAt` | Timestamp | yes | Server timestamp at creation |
| `expiresAt` | Timestamp | yes | `createdAt + 15 minutes` (Discogs' verifier validity window) |

**Lifecycle / state transitions**:

```
(none) --start link--> PENDING --complete (valid, same uid, not expired)--> consumed (doc deleted, DiscogsConnection created)
                        PENDING --complete after expiresAt--> rejected `expired_request` (doc deleted)
                        PENDING --complete by different uid--> rejected `invalid_request` (doc retained; original owner may still finish)
                        PENDING --user denies / abandons--> doc simply expires (no callback completion ever arrives)
```

No state field is stored — state is derived from existence + `expiresAt` + requesting uid. A user starting a second flow while a PENDING doc exists is allowed only if they have no active connection (FR-008 checks `discogsConnections/{uid}`, not pending docs); the newest completion wins and earlier pending docs expire harmlessly, which also resolves the two-tabs edge case with at most one resulting connection.

## DTO: ConnectionStatus (API response shape — the ONLY shape the browser ever sees)

| Field | Type | Present when | Notes |
|---|---|---|---|
| `connected` | boolean | always | Derived from existence of `discogsConnections/{uid}` — read from Firestore only, never from Discogs (spec clarification) |
| `discogsUsername` | string | `connected === true` | |
| `linkedAt` | string (ISO 8601) | `connected === true` | |

Token fields are structurally absent from this DTO; contract tests assert the exact key set (FR-010, SC-005).
