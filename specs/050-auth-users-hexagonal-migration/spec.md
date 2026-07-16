# Feature Specification: Auth/Users Domain Migrated to Hexagonal Architecture, Shared CachePort Consolidated

**Feature Branch**: `backend-hexagonal-architecture-refactor`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Historia 6 de @.hu/backend-hexagonal-architecture-refactor.md — Como desarrollador del backend, quiero que `services/userService.ts` y `middleware/requireAuth.ts` dejen de depender directamente de `firebase-admin`, y que el `CachePort` (usado ya por las Historias 2, 3, 4 y 5) quede consolidado en una única definición compartida en vez de redefinido por cada dominio."

## Clarifications

### Session 2026-07-16

- Q: `routes/auth.ts` today calls `getOrCreateUser`, `getUser`, and
  `updateThemePreference` directly from `services/userService.ts` — the same
  "route calls service function directly" pattern every prior domain's routes
  were required to stop doing. The parent HU document's Historia 6 section
  names only `services/userService.ts` and `middleware/requireAuth.ts` in its
  acceptance criteria, never `routes/auth.ts`. Should `routes/auth.ts` be
  migrated to delegate to application-level use cases as part of this story,
  or left calling `userService` functions directly? → A: In scope —
  `routes/auth.ts` MUST be migrated to delegate to application-level use
  cases built on the user repository port, matching the precedent already
  established by every prior domain's routes (library, discogs catalog,
  discogs OAuth/collection, feeds).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User profile persistence isolated behind a repository port (Priority: P1)

As a backend developer, I want the user profile logic (`getOrCreateUser` and the
theme-preference update it exposes) to depend on a user repository port instead of
calling Firestore directly, so that user-profile business rules are testable without
a real Firestore instance.

**Why this priority**: This is the only real business logic left uncovered by prior
stories that still imports `firebase-admin` directly outside the adapter layer —
migrating it is what actually closes the dependency-rule gap for this domain, and it
carries no dependency on Stories 2, 3, or 4.

**Independent Test**: Can be fully tested by running `getOrCreateUser` (and the
theme-preference update) against a fake user repository port and confirming the
create-vs-update branching and returned profile shape behave identically, without a
real Firestore instance.

**Acceptance Scenarios**:

1. **Given** a `uid` with no existing profile document, **When** `getOrCreateUser` is
   called, **Then** it creates the profile through the user repository port and returns
   it, without calling `firebase-admin` directly.
2. **Given** a `uid` with an existing profile document, **When** `getOrCreateUser` is
   called again, **Then** it updates only `lastSignInAt` through the same port and
   returns the profile unchanged otherwise — identity fields (`displayName`, `email`,
   `photoURL`) and any stored `themePreference` are left exactly as they were, matching
   today's behavior.
3. **Given** the existing user-service test suite, **When** it runs against a fake user
   repository port instead of a real Firestore instance, **Then** every existing
   assertion passes unchanged.

---

### User Story 2 - Request authentication isolated behind a token-verification port (Priority: P1)

As a backend developer, I want the `requireAuth` Express middleware to depend on an
auth-verification port instead of calling the Firebase Admin SDK directly, so that the
authentication contract (`req.auth` shape, 401 on failure) is testable without a real
Firebase project.

**Why this priority**: `requireAuth` is the one remaining place in the whole backend
where a driving adapter (Express middleware) reaches into an infrastructure SDK without
passing through any port — closing it removes the last such gap named in the
constitution's migration scope, independent of Story 1's persistence concern.

**Independent Test**: Can be fully tested by running `requireAuth` against a fake
auth-verification port that resolves or rejects token verification, and confirming the
missing-header case, the successful-verification case (`req.auth` populated, `next()`
called), and the failed-verification case (401 response, matching error body) all
behave exactly as today, without a real Firebase project.

**Acceptance Scenarios**:

1. **Given** a request with no `Authorization` header or a non-Bearer header, **When**
   `requireAuth` runs, **Then** it responds 401 with today's unauthorized body, without
   calling the auth-verification port.
2. **Given** a request with a valid Bearer token, **When** `requireAuth` runs, **Then**
   it calls the auth-verification port (not `firebase-admin` directly), sets
   `req.auth = { uid, email, name, picture }` exactly as today, and calls `next()`.
3. **Given** a request with an invalid or expired Bearer token, **When** `requireAuth`
   runs, **Then** the auth-verification port's rejection is translated into the same
   401 response and log line as today.
4. **Given** the existing `requireAuth`, auth contract, and auth integration test
   suites, **When** they run against the migrated middleware, **Then** every
   request/response pair and log assertion remains identical to today's behavior.

---

### User Story 3 - Auth/session HTTP routes depend on application-level use cases, not the service module directly (Priority: P2)

As a backend developer, I want `routes/auth.ts` (session creation, profile lookup,
theme-preference update) to delegate all orchestration to application-level use cases
built on the user repository port, instead of calling `userService` functions
directly, so the routes contain no lingering direct dependency on this domain's
pre-migration internals — matching how every prior domain's routes (library, discogs
catalog, discogs OAuth/collection, feeds) were migrated.

**Why this priority**: This depends on Story 1 existing first (there must be a real
port and use cases to call), and closing this gap is what makes the domain's
migration actually complete rather than leaving the routes calling the old service
module directly, consistent with the precedent set in every prior story. It also
requires `routes/auth.ts`'s single `requireAuth` import to already point at Story 2's
new location before this story rewrites the rest of the file — a one-line sequencing
detail, not a testability dependency: this story's own Independent Test does not
require Story 2 to be functionally complete, only that import already repointed.

**Independent Test**: Can be fully tested by confirming `routes/auth.ts`'s handler
bodies contain only request parsing/validation, a call into the corresponding
application use case, and response/error mapping, with the existing auth contract and
integration test suites passing unchanged.

**Acceptance Scenarios**:

1. **Given** a session-creation, profile-lookup, or preference-update request,
   **When** the route handles it, **Then** invoking the corresponding application use
   case (built on the user repository port) is its only business-relevant
   responsibility, and the existing success/error response shapes (200 payloads, 400
   for invalid preference values, 401 for missing/expired auth or an unknown profile,
   500 for unexpected errors) remain unchanged.
2. **Given** the existing auth contract and integration test suites, **When** they run
   against the migrated routes, **Then** every request/response pair and every
   assertion remains identical to today's behavior.

---

### User Story 4 - Shared CachePort and Firebase Admin initializer fully consolidated (Priority: P2)

As a backend developer, I want the `CachePort` already introduced by prior domain
migrations to be the single, non-duplicated definition every migrated domain shares,
and `config/firebase-admin.ts` to be the only file in the backend that initializes the
Firebase Admin SDK — consumed exclusively by adapters, never by domain or application
code directly — so the migration's cross-cutting pieces end in the state the
constitution requires, not merely each domain's own local view of them.

**Why this priority**: This depends on Stories 1 and 2 landing first — until
`requireAuth` and `userService` stop importing `firebase-admin` directly, this domain's
own adapters are the last direct consumers left to close, and a moved-but-still-loose
`cache/cacheAside.ts`/`cache/redisClient.ts` pair would leave the consolidation
incomplete even after every domain-facing port looks finished.

**Independent Test**: Can be fully tested by confirming a single `CachePort`
type-checks against every existing consumer (library, discogs catalog, discogs
OAuth/collection, feeds) with zero duplicate definitions anywhere in the codebase, and
that a repository-wide search for `firebase-admin` imports outside the adapter layer
returns zero matches.

**Acceptance Scenarios**:

1. **Given** the `CachePort` contract already defined and consumed by the library,
   discogs catalog, discogs OAuth/collection, and feeds domains, **When** this story
   completes, **Then** exactly one definition of `CachePort` exists in the codebase,
   with no domain-local redefinition or duplicate contract.
2. **Given** the underlying cache-aside logic and Redis client currently live outside
   the adapters layer as standalone modules wrapped by the cache adapter, **When** this
   story completes, **Then** that implementation is relocated to live inside the
   adapters layer alongside the port it implements, preserving its exact fail-soft
   behavior (`client === null` never fails a caller, concurrent calls for the same key
   are coalesced).
3. **Given** `config/firebase-admin.ts` exports `getFirebaseAuth()` and
   `getFirestoreDb()`, **When** this story completes, **Then** every remaining
   consumer of either function is an adapter (Firestore repository or Auth-verification
   adapter), and no domain or application file imports `config/firebase-admin`
   directly.
4. **Given** the existing cache unit test suite (`cacheAside.test.ts`,
   `redisClient.test.ts`), **When** it is reorganized alongside the relocated
   implementation, **Then** it continues to pass with unchanged assertions.

---

### Edge Cases

- What happens to `config/logger.ts`, used by domain, application, and adapter code
  alike, with no external SDK dependency of its own? It MUST remain a transversal
  exception outside the layered dependency rule, as already anticipated by Historia 1 —
  this story does not relocate or wrap it.
- What happens to any test that mocks `firebase-admin` (or `ioredis`) with a
  `jest.mock()` call keyed to a specific module path? Every such mock MUST be checked
  against the new file locations before the migration is considered complete — a pure
  relocation MUST NOT silently break a test that was passing before it.
- What happens to the union-style `AuthenticatedUser`/`req.auth` type declaration
  consumed by every protected route today? It MUST keep exactly the same shape
  (`uid`, `email`, `name`, `picture`) so no downstream route or test needs to change
  beyond its import path.
- What happens if another file outside this domain (e.g. a leftover reference in
  `discogs/` or `library/`) still imports `config/firebase-admin` directly once
  Stories 1 and 2 land? It MUST be identified and migrated to go through the
  appropriate adapter as part of completing this story, since Historia 6 is the last
  point at which any such straggler can be closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All Firestore access for user-profile creation, lookup, and update MUST
  be exposed through a single user repository port; no file implementing user-profile
  business logic may import `firebase-admin` directly.
- **FR-002**: `requireAuth` MUST depend on an auth-verification port (`verifyIdToken`)
  rather than calling `firebase-admin`'s Auth SDK directly, while preserving its exact
  current contract: `req.auth = { uid, email, name, picture }` on success, a 401
  response with today's error body on any failure (missing header, invalid token,
  expired token).
- **FR-003**: The `CachePort` contract MUST have exactly one definition in the
  codebase, consumed without duplication by every domain already migrated (library,
  discogs catalog, discogs OAuth/collection, feeds) and by this domain if it needs
  caching.
- **FR-004**: The cache-aside logic and Redis client implementing `CachePort` MUST be
  relocated into the adapters layer, preserving their existing fail-soft contract
  exactly (`client === null` never fails a caller; concurrent calls for the same key
  are coalesced into one in-flight fetch), rather than remaining as standalone modules
  outside the layered convention.
- **FR-005**: `config/firebase-admin.ts` MUST remain the sole point in the backend that
  initializes the Firebase Admin SDK; once this story completes, its exported
  functions (`getFirebaseAuth`, `getFirestoreDb`) MUST be consumed exclusively by
  adapters (Firestore repositories, the auth-verification adapter), never directly by
  domain or application code, across the entire backend.
- **FR-006**: Every existing auth/users-domain and cache test (unit, integration, and
  contract) MUST continue to pass after being relocated alongside the migrated code,
  with unchanged assertions — this migration MUST NOT change observable behavior,
  only the location of code and the way it depends on infrastructure.
- **FR-007**: Any `jest.mock()` call keyed to a pre-migration module path for
  `firebase-admin` or `ioredis` MUST be identified and updated to the new path as part
  of this story, so a pure relocation cannot silently break a previously passing test.
- **FR-008**: The migrated code MUST follow the layer and folder convention already
  fixed for the backend (Domain, Application, Ports, Adapters, one subfolder per
  business domain), matching the convention used by the library, discogs catalog,
  discogs OAuth/collection, and feeds migrations.
- **FR-009**: No public API contract for the auth or user-preferences endpoints MUST
  change as a result of this migration, and the session/authentication contract
  (`req.auth`, 401 status codes) MUST remain byte-for-byte identical.
- **FR-010**: `config/logger.ts` MUST remain outside the layered dependency rule as a
  transversal exception, consumed as-is by domain, application, and adapter code alike,
  since it has no infrastructure SDK dependency of its own.
- **FR-011**: `routes/auth.ts` MUST delegate all orchestration (session creation,
  profile lookup, theme-preference update) to application-level use cases built on the
  user repository port; it MUST NOT call `userService` functions directly, matching
  the migration pattern already established by every prior domain's routes.

### Key Entities *(include if feature involves data)*

- **User Repository Port**: The contract through which user-profile business logic
  creates, reads, and updates a user's profile document, independent of the concrete
  Firestore SDK used to persist it.
- **Auth Verifier Port**: The contract through which `requireAuth` verifies a bearer
  token and resolves the caller's identity, independent of the concrete Firebase Admin
  Auth SDK used to perform that verification.
- **User Profile**: The existing persisted shape (`uid`, `displayName`, `email`,
  `photoURL`, `createdAt`, `lastSignInAt`, `themePreference`) produced and updated by
  the user repository port — unchanged by this migration.
- **Verified Identity**: The existing shape (`uid`, `email`, `displayName`,
  `photoURL`) passed into user-profile creation/update after token verification —
  unchanged by this migration.
- **Cache Port**: The already-established shared contract (`has`, `set`, `withCache`,
  `invalidate`) this story finishes consolidating into a single definition with its
  implementation fully relocated into the adapters layer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing auth/users-domain and cache test files (unit,
  integration, and contract) pass from their reorganized location, with zero changes
  to their assertions.
- **SC-002**: Zero files implementing user-profile or request-authentication logic
  import `firebase-admin` directly — all such access is verifiably routed through a
  port.
- **SC-003**: Exactly one `CachePort` definition exists in the codebase, and a
  repository-wide search confirms zero domain-local duplicates.
- **SC-004**: A repository-wide search for `firebase-admin` imports outside the
  adapters layer returns zero matches, across every domain migrated in this story and
  the four prior ones.
- **SC-005**: The externally observable behavior of every auth and user-preferences
  HTTP endpoint (request/response pairs, status codes, `req.auth` shape, 401 error
  body) is unchanged, and no published API contract for this domain changes.
- **SC-006**: Zero remaining call sites in `routes/auth.ts` depend on
  `services/userService` functions directly — all orchestration flows through
  application-level use cases built on the user repository port.

## Assumptions

- This story cannot start before the layer/folder convention (Historia 1) and the
  domains that already consume the `CachePort` (Historias 2-5, verified merged) exist
  — both are treated as given inputs here, not redefined. The `CachePort` interface
  itself and its adapter already exist in the codebase (`ports/cache/cachePort.ts`,
  `adapters/cache/cacheAdapter.ts`); this story's consolidation work is confirming
  there is no duplicate definition and finishing the relocation of the underlying
  cache-aside/Redis-client implementation into the adapters layer, not introducing the
  port from scratch.
- This migration is purely structural: no business rule, API contract, or
  user-observable behavior changes as a result of it — only the location of code and
  the way it depends on infrastructure.
- This story is scoped to `services/userService.ts`, `middleware/requireAuth.ts`,
  `routes/auth.ts`, `cache/cacheAside.ts`, `cache/redisClient.ts`, and
  `config/firebase-admin.ts`'s consumers; it does not change
  `config/firebase-admin.ts`'s own two exported functions beyond confirming their only
  remaining callers are adapters.
- No branch is created for this story: it lands on the same shared
  `backend-hexagonal-architecture-refactor` branch already used by Historias 2-5.
