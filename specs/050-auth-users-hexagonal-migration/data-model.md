# Phase 1 Data Model: Auth/Users Domain Migrated to Hexagonal Architecture

This migration does not add, remove, or change the shape of any existing entity — it
relocates existing types unchanged, moves one type (`AuthenticatedUser`) from an
ambient declaration file into the domain layer (research.md Decision 4), and
introduces two new ports plus one new application-layer use-case factory.

## Domain Entities (relocated unchanged)

| Entity | Source file → destination | Key fields | Notes |
|---|---|---|---|
| `ThemePreference` | `services/userService.ts` → `domain/users/types.ts` | `'light' \| 'dark'` | Unchanged |
| `UserProfile` | `services/userService.ts` → `domain/users/types.ts` | `uid`, `displayName`, `email`, `photoURL?`, `createdAt`, `lastSignInAt`, `themePreference?` | Persisted shape and HTTP response shape are the same object today — unchanged by this migration (out of scope, unlike the library domain's `legacyCondition`/`legacyNotes` split in Historia 2) |
| `VerifiedIdentity` | `services/userService.ts` → `domain/users/types.ts` | `uid`, `email`, `displayName`, `photoURL?` | Built by `adapters/users/authRoutes.ts` from `req.auth` (an `AuthenticatedUser`), passed into `createOrRefreshSession` |

## Domain Entities (moved from an ambient declaration file)

| Entity | Source file → destination | Key fields | Notes |
|---|---|---|---|
| `AuthenticatedUser` | `types/express.d.ts` → `domain/auth/types.ts` | `uid`, `email`, `name?`, `picture?` | `AuthVerifierPort.verifyIdToken`'s return type; also what `requireAuth` assigns to `req.auth`. `types/express.d.ts` keeps only the ambient `Express.Request.auth?` augmentation, importing this type (research.md Decision 4) |

## Port Contracts (new)

| Port | Application-layer consumers | Adapter (this feature) | Wraps |
|---|---|---|---|
| `AuthVerifierPort` | `adapters/auth/requireAuth.ts` (a driving adapter, not application-layer — see below) | `adapters/auth/firebaseAuthVerifierAdapter.ts` | `firebase-admin/auth` (direct) |
| `UserRepositoryPort` | `createOrRefreshSession`, `getUserProfile`, `updateThemePreference` (all in `application/users/userProfileUseCases.ts`) | `adapters/users/firestoreUserRepository.ts` | `firebase-admin/firestore` (direct) |
| `CachePort` (reused, unchanged interface — implementation relocated by this feature) | Not consumed by this domain's own business logic | `adapters/cache/cacheAdapter.ts` (unchanged file, updated imports) | `adapters/cache/redisClient.ts`, `adapters/cache/cacheAside.ts` (both relocated here by this feature, research.md Decision 6) |

`AuthVerifierPort`'s consumer is `requireAuth` itself, a driving adapter (Express
middleware), not an application-layer use case — Constitution Principle VIII
explicitly names Express middleware as a driving adapter whose job is translating an
HTTP request into a port call, which is exactly `requireAuth`'s existing role.

## `AuthVerifierPort` method inventory

| Method | Backs (today's function) | Infra |
|---|---|---|
| `verifyIdToken(idToken): Promise<AuthenticatedUser>` | `getFirebaseAuth().verifyIdToken(token)` inline in `middleware/requireAuth.ts` | `firebase-admin/auth`; rejects on any invalid/expired/malformed token — `requireAuth` translates a rejection into the existing 401 response, unchanged |

Full preconditions/postconditions in `contracts/auth-verifier-port.md`.

## `UserRepositoryPort` method inventory

| Method | Backs (today's function) | Infra |
|---|---|---|
| `findByUid(uid): Promise<UserProfile \| null>` | The `docRef.get()` + existence check shared by `getOrCreateUser` and `getUser` in `services/userService.ts` | `firebase-admin/firestore`, `users/{uid}` document read |
| `create(profile): Promise<UserProfile>` | The `!snapshot.exists` branch of `getOrCreateUser` (`docRef.set(...)` with `createdAt`/`lastSignInAt` both set to `FieldValue.serverTimestamp()`) | `firebase-admin/firestore`, `users/{uid}` document write |
| `touchLastSignIn(uid): Promise<UserProfile>` | The `snapshot.exists` branch of `getOrCreateUser` (`docRef.update({ lastSignInAt: now })` only — research.md Decision 5) | `firebase-admin/firestore`, `users/{uid}` document update |
| `updateThemePreference(uid, themePreference): Promise<UserProfile>` | `updateThemePreference` in `services/userService.ts` (`docRef.update({ themePreference })`) | `firebase-admin/firestore`, `users/{uid}` document update |

Full preconditions/postconditions in `contracts/user-repository-port.md`.

## Application Use Cases (new, spec.md User Story 1)

`application/users/userProfileUseCases.ts` — one factory,
`createUserProfileUseCases(deps: { userRepository: UserRepositoryPort })`, returning:

1. **`createOrRefreshSession(identity: VerifiedIdentity): Promise<UserProfile>`**: calls
   `findByUid(identity.uid)`; if `null`, calls `create({ uid, displayName, email,
   photoURL })`; otherwise calls `touchLastSignIn(identity.uid)` — reproduces
   `getOrCreateUser`'s exact branch (research.md Decision 2, Decision 5).
2. **`getUserProfile(uid: string): Promise<UserProfile | null>`**: calls
   `findByUid(uid)` directly — reproduces `getUser` unchanged.
3. **`updateThemePreference(uid: string, themePreference: ThemePreference): Promise<UserProfile>`**:
   calls the port method of the same name directly — reproduces
   `updateThemePreference` unchanged.

## Driving Adapters (relocated, spec.md User Stories 2-3)

| Adapter | Was | Depends on | Preserves |
|---|---|---|---|
| `adapters/auth/requireAuth.ts` | `middleware/requireAuth.ts` | `AuthVerifierPort` (via `createRequireAuth(deps)`, pre-wired singleton export) | Missing-header 401, malformed-token 401, valid-token `req.auth` assignment + `next()`, exact log lines |
| `adapters/users/authRoutes.ts` | `routes/auth.ts` | `application/users/userProfileUseCases.ts` (via the three returned functions) + `adapters/auth/requireAuth.ts` (same import every other domain's routes already use) | `POST /session` (200/500), `GET /me` (200/401/500), `PATCH /preferences` (200/400/401/500), same Zod validation, same log lines |

## Edge Case: cross-domain consumers of this domain's relocated files

Unlike the feeds domain (no cross-domain consumers), this migration has two:
`requireAuth` is imported by four other already-migrated domains' route adapters
(library, discogs catalog, discogs OAuth, feeds — each gets a one-line import-path
fix, not a behavior change), and `cache/cacheAside.ts`/`cache/redisClient.ts` are
imported directly (bypassing `CachePort`) by eight test files across the feeds,
library, and discogs-catalog domains for test setup/cleanup (each gets a one-line
import-path fix — full list in plan.md's Technical Context).
