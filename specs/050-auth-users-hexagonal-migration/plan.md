# Implementation Plan: Auth/Users Domain Migrated to Hexagonal Architecture, Shared CachePort Consolidated

**Branch**: `backend-hexagonal-architecture-refactor` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-auth-users-hexagonal-migration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the last two backend files that import `firebase-admin` outside the adapter
layer — `services/userService.ts` (user-profile persistence) and
`middleware/requireAuth.ts` (bearer-token verification) — onto the Hexagonal
convention already demonstrated by the library, catalog, OAuth+Collection, and feeds
migrations. Two new ports emerge: a **`UserRepositoryPort`** (persistence primitives
— `findByUid`, `create`, `touchLastSignIn`, `updateThemePreference`) and an
**`AuthVerifierPort`** (`verifyIdToken`). Per this spec's clarification session,
`routes/auth.ts` is also migrated — it calls `userService` functions directly today,
the exact pattern every prior domain's routes were required to stop doing — becoming
a driving adapter that delegates to one application-layer use-case factory,
`createUserProfileUseCases`, which reproduces the exact create-vs-touch branching
`getOrCreateUser` has today (verified: a repeat sign-in updates only `lastSignInAt`,
never the identity fields) using the new port instead of Firestore directly. Because
`requireAuth` is consumed by every other already-migrated domain's routes (library,
discogs catalog, discogs OAuth, feeds — all four import it today), it gets its own
domain pairing, `auth`, separate from `users` — mirroring how `CachePort` is a
cross-cutting dependency other domains consume, not folded into any one of them. This
story also finishes the `CachePort` consolidation prior stories deferred: the
underlying `cache/cacheAside.ts` and `cache/redisClient.ts` (still outside the
adapters layer, wrapped from a distance by `adapters/cache/cacheAdapter.ts`) relocate
into `adapters/cache/` alongside the adapter that implements the port over them,
preserving their fail-soft contract byte-for-byte — and `config/firebase-admin.ts`
becomes consumed exclusively by adapters across the whole backend, closing the last
two straggler imports this migration's five historias set out to remove.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js (CommonJS), Express 4.19 backend
(`backend/package.json`)

**Primary Dependencies**: `firebase-admin` 12.3 (`firebase-admin/auth` for token
verification, `firebase-admin/firestore` for user-profile persistence — both confined
to the new `adapters/auth/` and `adapters/users/` after migration), `ioredis` 5.11
(confined to `adapters/cache/` after this migration's relocation), `express` (routing)

**Storage**: Firestore, `users/{uid}` documents — same collection and document shape
as today (`uid`, `displayName`, `email`, `photoURL`, `createdAt`, `lastSignInAt`,
`themePreference`), accessed only through the new `UserRepositoryPort`. Redis
(optional, fail-soft, already behind the shared `CachePort`/`cacheAdapter` since
Historia 2) — this domain does not consume caching itself; this story only relocates
the Redis client and cache-aside strategy modules the `CachePort` adapter already
wraps, adding no new cache behavior

**Testing**: Jest 29 + ts-jest, `firebase emulators:exec --only auth,firestore`
(`backend/package.json` `test` script). Unlike the feeds migration, none of this
domain's five existing test files use `jest.mock()` against an internal module path —
`userService.test.ts`, `requireAuth.test.ts`, `auth.contract.test.ts`,
`authPreferencesRoute.test.ts`, and `auth.integration.test.ts` all exercise the real
Auth/Firestore emulators via `tests/helpers/authEmulator.ts` (a plain `fetch`-based
REST client, not the `firebase-admin` SDK) — so FR-007's "check for path-sensitive
`jest.mock()`" concern resolves to "none exist in this domain," and all five relocate
with import-path-only fixes. The two cache unit tests
(`tests/unit/cache/cacheAside.test.ts`, `tests/unit/cache/redisClient.test.ts`) do
`jest.mock('ioredis', ...)` — that targets the npm package, unaffected by relocation —
and dynamically `import()` the module under test by relative path, which needs a
path update when it moves into `adapters/cache/`. Relocating `cache/cacheAside.ts`
and `cache/redisClient.ts` also ripples into **eight test files in already-migrated
domains** that import `invalidateCache`/`getRedisClient` directly from the old path
for test setup/cleanup rather than through `CachePort` — verified by grep:
`tests/contract/feeds/feedsDashboard.contract.test.ts`,
`tests/contract/feeds/feedsSource.contract.test.ts`,
`tests/integration/feeds/feedsDashboard.integration.test.ts`,
`tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts`,
`tests/integration/feeds/feedsDashboardNewSources.integration.test.ts`,
`tests/integration/feeds/feedsSourceDirect.integration.test.ts`,
`tests/integration/library/librarySync.integration.test.ts`, and
`tests/integration/discogsCatalog/discogsCacheOutage.test.ts` — each needs only its
one import statement's path updated, no assertion changes

**Target Platform**: Node.js server, deployed as a long-lived warm process (unaffected
by this migration)

**Project Type**: Web application backend (Express REST API); this feature touches
`backend/` only, per Constitution Principle VIII's explicit backend-only scope

**Performance Goals**: No new targets — SC-005 requires byte-for-byte identical HTTP
behavior for the auth/session/preferences endpoints. Token verification and
user-profile reads/writes remain exactly one Firestore/Firebase Auth SDK call each,
now routed through a port instead of called inline

**Constraints**: Zero HTTP contract changes for `POST /api/auth/session`,
`GET /api/auth/me`, and `PATCH /api/auth/preferences`; the `req.auth` shape
(`uid`, `email`, `name?`, `picture?`) and every status code (200, 400 validation,
401 unauthorized, 500 internal) MUST remain byte-for-byte identical; a repeat
sign-in MUST continue to update only `lastSignInAt`, never `displayName`/`email`/
`photoURL`/`themePreference` (verified against today's code, corrected in spec.md
during planning — see research.md Decision 5); the cache relocation MUST preserve
`withCache`'s exact fail-soft/coalescing behavior and `invalidateCache`'s exact
fail-soft behavior

**Scale/Scope**: 3 source files migrated (`services/userService.ts` 75 lines,
`middleware/requireAuth.ts` 51 lines, `routes/auth.ts` 100 lines) plus 2 relocated
infrastructure modules (`cache/cacheAside.ts` 82 lines, `cache/redisClient.ts` 27
lines) plus a 1-line type move out of `types/express.d.ts`, split/relocated into ~10
new files across `domain/auth/`, `domain/users/`, `application/users/`,
`ports/auth/`, `ports/users/`, `adapters/auth/`, `adapters/users/`, and
`adapters/cache/`; 7 existing test files for this domain relocated (import-path-only
fixes, zero assertion changes: `userService.test.ts`, `requireAuth.test.ts`,
`auth.contract.test.ts`, `authPreferencesRoute.test.ts`, `auth.integration.test.ts`,
`cacheAside.test.ts`, `redisClient.test.ts`) plus 8 already-migrated-domain test
files receiving a one-line import-path fix each (8 for the cache relocation, listed
above, none of which are this domain's own files) plus `app.ts` and the four other
domains' route files (`libraryRoutes.ts`, `discogsRoutes.ts` ×2,
`feedsRoutes.ts`) each receiving a one-line `requireAuth` import-path update; two new
unit-test files added for the new ports' unit-testability
(`firebaseAuthVerifierAdapter`/`requireAuth` against a fake `AuthVerifierPort`,
`userProfileUseCases` against a fake `UserRepositoryPort`) — this domain had none of
these before, since `userService`/`requireAuth` could only be tested against the real
emulator until now, which is this story's whole point (spec.md User Stories 1-2)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Each relocated/new file's test is adjusted (and run red against the new module boundary) before the corresponding file is written, following the same copy-then-cutover strategy validated in the library, catalog, OAuth+Collection, and feeds migrations | PASS (enforced by task ordering, see `tasks.md` once generated) |
| II. Discogs Integration-First & Modularity | Not applicable — this domain has no Discogs API dependency | PASS (N/A, no violation) |
| III. Simplicity, YAGNI & KISS | One `AuthVerifierPort` (one method) and one `UserRepositoryPort` (four primitives) for this domain's two external-system boundaries; `createOrRefreshSession`/`getUserProfile`/`updateThemePreference` stay combined in one application-layer factory (`createUserProfileUseCases`) rather than three separate files, because none carries independent business logic beyond a single port call — splitting them would add three files with no corresponding gain in independent testability, mirroring the feeds migration's Decision 2 reasoning; manual factory-function DI, no framework | PASS |
| IV. SOLID Design | Application code depends on `ports/users/userRepositoryPort.ts` and `ports/auth/authVerifierPort.ts`, never on concrete `firebase-admin` modules; `requireAuth` depends on `AuthVerifierPort` via constructor injection (`createRequireAuth(deps)`), with a pre-wired singleton export preserving every other domain's existing import shape | PASS |
| V. Observability | Every existing `logger.info`/`logger.warn`/`logger.error` call in `requireAuth.ts` and `routes/auth.ts` is preserved verbatim in its new location, same fields (`route`, `outcome`, `uid`, `message`) | PASS (verified per-file during relocation) |
| VI. Versioning & Breaking Changes | Purely structural for the public HTTP contract; no schema, endpoint, or status-code change | PASS |
| VII. Curated Ratings & Music News | Not applicable — this domain is unrelated to ratings/news | PASS (N/A) |
| VIII. Hexagonal Architecture (Ports & Adapters) — Backend | This feature's entire purpose, and the final domain closing Historia 1's migration scope. `config/firebase-admin.ts` becomes consumed exclusively by adapters across the whole backend once this story lands (spec.md FR-005); `config/logger.ts` remains the confirmed transversal exception (spec.md FR-010, Historia 1 edge case) | PASS |

**No deferred items remain after this story** — Historias 2-5 each deferred exactly
this domain's two files (and the `CachePort` consolidation) as "not yet triggered by
any single domain needing it exclusively." This is the domain that triggers it.

## Project Structure

### Documentation (this feature)

```text
specs/050-auth-users-hexagonal-migration/
├── plan.md                       # This file (/speckit-plan command output)
├── research.md                   # Phase 0 output (/speckit-plan command)
├── data-model.md                 # Phase 1 output (/speckit-plan command)
├── quickstart.md                 # Phase 1 output (/speckit-plan command)
├── contracts/                    # Phase 1 output (/speckit-plan command)
│   ├── auth-verifier-port.md
│   └── user-repository-port.md
└── tasks.md                      # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── auth/
│   │   │   └── types.ts                       # NEW — AuthenticatedUser, moved out of types/express.d.ts (research.md Decision 4)
│   │   └── users/
│   │       └── types.ts                       # moved from services/userService.ts — ThemePreference, UserProfile, VerifiedIdentity, unchanged
│   ├── application/
│   │   └── users/
│   │       └── userProfileUseCases.ts          # NEW — createUserProfileUseCases: createOrRefreshSession (US1), getUserProfile, updateThemePreference; depends on UserRepositoryPort only
│   ├── ports/
│   │   ├── auth/
│   │   │   └── authVerifierPort.ts             # NEW — AuthVerifierPort.verifyIdToken (US2)
│   │   └── users/
│   │       └── userRepositoryPort.ts           # NEW — UserRepositoryPort: findByUid, create, touchLastSignIn, updateThemePreference (US1)
│   ├── adapters/
│   │   ├── auth/
│   │   │   ├── firebaseAuthVerifierAdapter.ts  # NEW — implements AuthVerifierPort via firebase-admin/auth, relocated logic from middleware/requireAuth.ts's getFirebaseAuth().verifyIdToken() call
│   │   │   └── requireAuth.ts                  # NEW — driving adapter (was middleware/requireAuth.ts); createRequireAuth(deps) factory + pre-wired `requireAuth` singleton export consumed by every other domain's routes
│   │   ├── users/
│   │   │   ├── firestoreUserRepository.ts      # NEW — implements UserRepositoryPort, relocated Firestore calls from services/userService.ts
│   │   │   └── authRoutes.ts                   # NEW — driving adapter (was routes/auth.ts); parsing/validation + one use-case call each + existing 200/400/401/500 response mapping (US3)
│   │   └── cache/
│   │       ├── cacheAdapter.ts                 # UNCHANGED file, updated imports only (./cacheAside, ./redisClient — same directory now)
│   │       ├── cacheAside.ts                    # RELOCATED from cache/cacheAside.ts — same withCache/invalidateCache logic, fail-soft contract preserved byte-for-byte
│   │       └── redisClient.ts                   # RELOCATED from cache/redisClient.ts — same getRedisClient logic
│   ├── types/
│   │   └── express.d.ts                         # UPDATED — imports AuthenticatedUser from ../domain/auth/types instead of declaring it inline
│   ├── middleware/                              # DELETED (requireAuth.ts was its only file)
│   ├── services/                                # DELETED (userService.ts was its only file)
│   ├── cache/                                   # DELETED (cacheAside.ts + redisClient.ts were its only files)
│   ├── routes/                                  # DELETED (auth.ts was its only remaining file)
│   ├── adapters/library/libraryRoutes.ts         # one-line import path update: middleware/requireAuth → ../auth/requireAuth
│   ├── adapters/discogsCatalog/discogsRoutes.ts  # one-line import path update: middleware/requireAuth → ../auth/requireAuth
│   ├── adapters/discogsOauth/discogsRoutes.ts    # one-line import path update: middleware/requireAuth → ../auth/requireAuth
│   ├── adapters/feeds/feedsRoutes.ts             # one-line import path update: middleware/requireAuth → ../auth/requireAuth
│   └── app.ts                                    # import path update: routes/auth → adapters/users/authRoutes
└── tests/
    ├── unit/
    │   ├── auth/
    │   │   └── adapters/
    │   │       └── requireAuth.test.ts                    # NEW — createRequireAuth exercised against a fake AuthVerifierPort (missing header, valid token, rejected token), mirrors searchCatalogWithRatings.test.ts's fake-port pattern
    │   ├── users/
    │   │   └── application/
    │   │       └── userProfileUseCases.test.ts            # NEW — createOrRefreshSession/getUserProfile/updateThemePreference exercised against a fake UserRepositoryPort
    │   └── cache/
    │       ├── cacheAside.test.ts                          # relocated from unit/cache/cacheAside.test.ts, import path updated, unchanged assertions
    │       └── redisClient.test.ts                         # relocated from unit/cache/redisClient.test.ts, import path updated, unchanged assertions
    ├── integration/
    │   ├── auth/
    │   │   └── adapters/
    │   │       └── requireAuth.integration.test.ts        # relocated from unit/requireAuth.test.ts (real Auth emulator, unchanged assertions) — reclassified unit→integration to match firestoreLibraryRepository.integration.test.ts's precedent for a real-emulator adapter test; import path updated
    │   ├── users/
    │   │   └── application/
    │   │       ├── createOrRefreshSession.integration.test.ts   # relocated from integration/auth.integration.test.ts (real Firestore emulator, unchanged assertions) — renamed to match the migrated function it exercises
    │   │       └── userProfileUseCases.integration.test.ts      # relocated from unit/userService.test.ts (real Firestore emulator, unchanged assertions) — reclassified unit→integration for the same reason as requireAuth's above; covers theme-preference persistence + the identity-fields-untouched-on-resign-in edge case (research.md Decision 5)
    │   ├── library/librarySync.integration.test.ts              # one-line import path update: src/cache/redisClient → src/adapters/cache/redisClient
    │   ├── discogsCatalog/discogsCacheOutage.test.ts            # one-line import path update: src/cache/redisClient → src/adapters/cache/redisClient
    │   └── feeds/                                               # one-line import path update each: src/cache/cacheAside → src/adapters/cache/cacheAside
    │       ├── feedsDashboard.integration.test.ts
    │       ├── feedsDashboardExpandedSources.integration.test.ts
    │       ├── feedsDashboardNewSources.integration.test.ts
    │       └── feedsSourceDirect.integration.test.ts
    └── contract/
        ├── users/
        │   ├── session.contract.test.ts          # relocated from contract/auth.contract.test.ts (real Auth/Firestore emulator, unchanged assertions) — grouped under users/ to match adapters/users/authRoutes.ts, the file it exercises
        │   └── preferences.contract.test.ts       # relocated from contract/authPreferencesRoute.test.ts (real Auth/Firestore emulator, unchanged assertions)
        └── feeds/                                 # one-line import path update each: src/cache/cacheAside → src/adapters/cache/cacheAside
            ├── feedsDashboard.contract.test.ts
            └── feedsSource.contract.test.ts
```

**Structure Decision**: Web application backend, Hexagonal layers as global top-level
folders under `backend/src/` per Constitution Principle VIII, mirroring the library,
catalog, OAuth+Collection, and feeds domains' precedent exactly. Unlike those four
domains, this story introduces **two** domain-scoped port/adapter pairs rather than
one — `auth` and `users` — because `requireAuth` is a cross-cutting driving adapter
consumed by every other already-migrated domain's routes today (verified: `library`,
`discogsCatalog`, `discogsOauth`, and `feeds` route files all import it), the same
reason `CachePort` lives in its own `ports/cache/`/`adapters/cache/` rather than
inside any one consuming domain — `auth` is not folded into `users` for the identical
reason. `routes/auth.ts` (HTTP surface for session/profile/preferences) relocates to
`adapters/users/authRoutes.ts`, since its business concern is user-profile
orchestration, not token verification itself — it imports `requireAuth` from the
sibling `adapters/auth/` package exactly as every other domain's routes already do.
Tests mirror the same domain grouping under
`backend/tests/{unit,integration,contract}/{auth,users}/`, split by layer inside
`tests/unit/` (`domain/`, `adapters/`, `application/`) — the same
`unit/<domain>/<layer>/` nesting Historia 3 introduced and Historias 4-5 continued.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*No violations requiring justification — introducing two domain folders (`auth` and
`users`) instead of one is documented above as a deliberate structural decision driven
by `requireAuth`'s existing cross-domain consumption, not a Principle III/IV violation
this feature introduces or must defend.*
