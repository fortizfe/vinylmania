# Port Contract: `AuthVerifierPort` (new)

**Feature**: 050-auth-users-hexagonal-migration | **Layer**: `ports/auth/authVerifierPort.ts`
**Adapter**: `adapters/auth/firebaseAuthVerifierAdapter.ts` (new — relocated + adapted
from `middleware/requireAuth.ts`'s inline `getFirebaseAuth().verifyIdToken()` call)
**Status**: New port, no prior version to preserve compatibility with — this domain
had no port before this migration.

```ts
import type { AuthenticatedUser } from '../../domain/auth/types';

export interface AuthVerifierPort {
  /**
   * Verifies a Firebase ID token and resolves the caller's identity.
   * Rejects on any invalid, expired, or malformed token — this port performs
   * no error translation; `adapters/auth/requireAuth.ts` (the driving
   * adapter) is responsible for turning a rejection into the existing 401
   * response, exactly as `middleware/requireAuth.ts`'s try/catch does today.
   */
  verifyIdToken(idToken: string): Promise<AuthenticatedUser>;
}
```

## Preconditions / Postconditions

- `idToken`: the raw bearer token string (already stripped of the `Bearer ` prefix by
  the caller) — the adapter does not perform any additional parsing beyond what
  `firebase-admin/auth`'s own `verifyIdToken` does today.
- Return value: `AuthenticatedUser` (`uid`, `email` — defaulted to `''` when the
  decoded token has none, matching today's `decoded.email ?? ''` — `name?`,
  `picture?`), built field-by-field from the decoded token, exactly as
  `middleware/requireAuth.ts` builds `req.auth` today.
- Rejection: any verification failure (invalid signature, expired token, malformed
  token) rejects the returned promise with the underlying `firebase-admin` error —
  this port performs no error translation or domain-error wrapping, matching
  `middleware/requireAuth.ts`'s current behavior (its own `catch` block, not this
  port, is what produces the 401 response and its log line).

## Consumers introduced by this feature

- `adapters/auth/requireAuth.ts` — the only consumer. Note this is a **driving
  adapter** (Express middleware), not an application-layer use case; Constitution
  Principle VIII names Express middleware as a driving adapter whose job is
  translating an HTTP request into a port call and the result (or rejection) back
  into an HTTP response or the next middleware step — exactly `requireAuth`'s
  existing role, unchanged by this migration.

## Unaffected by this feature

No other domain calls `AuthVerifierPort` directly — every other domain's routes
continue to depend on the pre-wired `requireAuth` middleware export (now sourced from
`adapters/auth/requireAuth.ts` instead of `middleware/requireAuth.ts`), not on the
port itself.
