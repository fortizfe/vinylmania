# Data Model: Identificar toda petición a Discogs con la cuenta vinculada del usuario

This feature introduces one new type and reuses two existing ones unchanged. No Firestore schema change; no new persisted entity.

## `CatalogCredential` (NEW)

**Location**: `backend/src/domain/discogsCatalog/types.ts`

The identification a single catalog request to Discogs is made with. Discriminated union, closed at two variants per spec FR-001/FR-002/FR-004 (no third state exists).

| Variant | Fields | Meaning |
|---|---|---|
| `{ type: 'vinylmania' }` | none | Request is identified with vinylmania's shared `DISCOGS_TOKEN`. Legitimate only when the requesting user has no active linked Discogs account (spec FR-002/FR-004). |
| `{ type: 'user'; connection: DiscogsConnection }` | `connection: DiscogsConnection` | Request is identified with the user's own linked Discogs OAuth 1.0a account. |

**Validation rules**:
- Never constructed directly by callers — only produced by `resolveCatalogCredential` (see below), so the two variants stay mutually exclusive and exhaustive by construction.
- `DiscogsAuthError` thrown while resolving a `user`-typed request MUST propagate to the caller unchanged; no code path re-resolves it as `{ type: 'vinylmania' }` (spec FR-003/FR-004; enforced structurally, see research.md Decision 5).

**Lifecycle**: Resolved fresh once per incoming vinylmania HTTP request (or once per search request's enrichment fan-out, threaded through rather than re-resolved per Discogs call — see research.md Decision 3). Not persisted, not cached, not passed across requests.

## `DiscogsConnection` (EXISTING — reused unchanged)

**Location**: `backend/src/domain/discogsOauth/types.ts:5-19`

```ts
export interface DiscogsConnection {
  uid: string;
  discogsUsername: string;
  discogsUserId: number;
  accessToken: string;
  accessTokenSecret: string;
  linkedAt: string; // ISO 8601
  initialLibrarySyncAt?: string; // ISO 8601
}
```

No fields added. This feature is a new *consumer* of this existing entity (via the existing `DiscogsConnectionPort.getConnection(uid)`), not a modifier of it. State transitions (linked → revoked, revoked → relinked) are entirely owned by the existing OAuth link flow (features 015/048) and out of scope here.

## Discogs catalog request (conceptual — not a stored entity)

Spec's "Petición de catálogo" Key Entity maps to **an audit log line**, not a database row. Represented by the existing `LogEvent` shape (`backend/src/config/logger.ts`) at the per-Discogs-call log sites identified in research.md Decision 7, extended with one new `meta` field:

| Field | Type | Notes |
|---|---|---|
| `route` | `string` | existing — the Discogs endpoint path called |
| `outcome` | `LogOutcome` | existing — `success` \| `not_found` \| `rate_limited` \| `auth_failed` \| `unavailable` \| ... |
| `uid` | `string?` | existing — the vinylmania user on whose behalf the call was made |
| `meta.credentialType` | `'vinylmania' \| 'user'` | **NEW** — which credential identified this specific Discogs call. Never contains the token/secret value itself (spec FR-005). |

No new entity, no new port, no new adapter method — this is an additive field on an existing structured-logging call, satisfying SC-004 (auditability) without introducing a persisted "audit log" store.

## Relationships

```text
AuthenticatedUser (uid)
   │  resolveCatalogCredential(uid)
   ▼
CatalogCredential ── vinylmania ─────────────────────► DISCOGS_TOKEN (env)
   │
   └── user ──► DiscogsConnection (existing, from discogsConnections/{uid})
                    │
                    ▼
              Discogs catalog request (search / release / master /
              master versions / artist / rating) ──► structured log line
                                                       (meta.credentialType)
```

No relationship changes to existing entities (`Release`, `Artist`, `MasterRelease`, `MasterReleaseVersionsPage`, `CommunityRating`, `CatalogSearchResponse` — all unchanged, per spec FR-007: catalog content itself does not vary by credential).
