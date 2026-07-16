# Port Contract: `UserRepositoryPort` (new)

**Feature**: 050-auth-users-hexagonal-migration | **Layer**: `ports/users/userRepositoryPort.ts`
**Adapter**: `adapters/users/firestoreUserRepository.ts` (new — relocated + adapted
from `services/userService.ts`)
**Status**: New port, no prior version to preserve compatibility with — this domain
had no port before this migration.

```ts
import type { ThemePreference, UserProfile } from '../../domain/users/types';

export interface UserRepositoryPort {
  /** Returns null when no `users/{uid}` document exists yet. */
  findByUid(uid: string): Promise<UserProfile | null>;

  /**
   * Creates a new `users/{uid}` document. `createdAt` and `lastSignInAt` are
   * both set by the adapter at write time (server timestamp) — callers do
   * not supply them, matching `services/userService.ts`'s current
   * `getOrCreateUser` behavior on first sign-in.
   */
  create(profile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
  }): Promise<UserProfile>;

  /**
   * Updates only `lastSignInAt` on an existing `users/{uid}` document.
   * MUST NOT write `displayName`, `email`, `photoURL`, or `themePreference`
   * — a repeat sign-in leaves every other field exactly as it was
   * (research.md Decision 5, corrected from spec.md's original wording).
   */
  touchLastSignIn(uid: string): Promise<UserProfile>;

  /** Updates only `themePreference` on an existing `users/{uid}` document. */
  updateThemePreference(uid: string, themePreference: ThemePreference): Promise<UserProfile>;
}
```

## Preconditions / Postconditions

- `uid`: assumed to be a valid, already-verified Firebase uid (the caller is always
  either `createOrRefreshSession`, acting on a freshly-verified `VerifiedIdentity`, or
  a route handler acting on `req.auth.uid` after `requireAuth` has already run) — the
  port itself performs no additional validation, matching today's code.
- `findByUid`: returns `null` (not a rejection) when the document does not exist,
  exactly as `getUser`'s existing `!snapshot.exists` check does today.
- `create`: rejects if called for a `uid` that already has a document — not a
  guarded precondition in the port itself (the application layer's
  `createOrRefreshSession` is what checks `findByUid` first, exactly mirroring
  `getOrCreateUser`'s existing `if (!snapshot.exists)` guard).
- `touchLastSignIn`/`updateThemePreference`: both assume the document already exists
  (an `update()` call, not `set()`), matching today's code — no explicit
  not-found handling, since every caller path already went through
  `createOrRefreshSession` (which creates the document) before either can be called
  for a given `uid` in normal operation.
- Return value shape for all four methods: `UserProfile`
  (`uid`, `displayName`, `email`, `photoURL?`, `createdAt`, `lastSignInAt`,
  `themePreference?`), built from the Firestore document exactly as
  `services/userService.ts`'s existing `toUserProfile` mapper does today (including
  its `themePreference` field being omitted entirely, not set to `undefined`, when
  never written — spec.md's existing test coverage already asserts this).

## Consumers introduced by this feature

- `application/users/userProfileUseCases.ts`'s `createOrRefreshSession`,
  `getUserProfile`, and `updateThemePreference` — the only consumers (data-model.md).

## Unaffected by this feature

No other domain calls `UserRepositoryPort` — it is new and scoped entirely to the
`users` domain pairing (data-model.md's cross-domain-consumer edge case covers only
`AuthVerifierPort`'s sibling `requireAuth` middleware and the relocated cache modules,
not this port).
