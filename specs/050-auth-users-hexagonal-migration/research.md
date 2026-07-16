# Phase 0 Research: Auth/Users Domain Migrated to Hexagonal Architecture

No `NEEDS CLARIFICATION` markers remained in the Technical Context. One scope question
was already resolved during `/speckit-clarify` (whether `routes/auth.ts` is in scope)
and is recorded in spec.md's Clarifications section, not repeated here as an open
decision. The decisions below resolve everything else spec.md explicitly deferred to
this planning phase, plus one factual correction to spec.md discovered while verifying
current behavior against the real code (Decision 5).

## Decision 1: `auth` and `users` are two separate domain folders, not one combined domain

**Decision**: `domain/auth/`, `ports/auth/`, `adapters/auth/` (token verification) and
`domain/users/`, `application/users/`, `ports/users/`, `adapters/users/` (profile
persistence) are separate top-level domain folders, each following Constitution
Principle VIII's one-subfolder-per-business-domain convention independently.

**Rationale**: Verified by `grep`: `middleware/requireAuth.ts` is imported by five
files today — `routes/auth.ts` and the four other already-migrated domains' route
adapters (`adapters/library/libraryRoutes.ts`, `adapters/discogsCatalog/discogsRoutes.ts`,
`adapters/discogsOauth/discogsRoutes.ts`, `adapters/feeds/feedsRoutes.ts`). This is
structurally identical to why `CachePort` lives in its own `ports/cache/`/
`adapters/cache/` rather than inside the library domain that first needed it
(Historia 2's plan) — a dependency consumed across domain boundaries gets its own
domain-scoped pair rather than being nested inside whichever domain happens to also
need it. `services/userService.ts`, by contrast, has exactly one consumer
(`routes/auth.ts`) and no other domain reaches into it — it stays scoped to its own
`users` pairing. The parent HU document's own title for this story — "Dominio
Auth/Users" — names both concerns together because they are delivered in the same
story, not because they are meant to collapse into one folder; Historia 4's
`discogsOauth` combining OAuth-linking and Collection-API access was a genuine single
bounded context (both concerns operate on the same Discogs account credentials, one
never called without the other), which does not hold here — token verification and
profile persistence have no shared data or shared caller-side invariant beyond
`requireAuth`'s output being one input among several to `createOrRefreshSession`.

**Alternatives considered**: A single `domain/users/` folder containing both concerns
(`requireAuth` nested inside it) — rejected; every other domain's routes would then
import a piece of the "users" domain's internals to do their own authentication, which
inverts the actual dependency shape (auth is upstream of every domain, not a detail of
one). Naming the shared folder `session` or `identity` instead of `auth`/`users` —
rejected as unnecessary renaming; `auth` and `users` are the names spec.md and the
parent HU document already use throughout, and matching them avoids a needless
naming migration.

## Decision 2: `UserRepositoryPort` exposes persistence primitives; the create-vs-touch branch moves to the application layer

**Decision**: `ports/users/userRepositoryPort.ts` declares four primitives —
`findByUid(uid)`, `create(profile)`, `touchLastSignIn(uid)`,
`updateThemePreference(uid, themePreference)` — mirroring `LibraryRepositoryPort`'s
granularity (`createEntry`, `getEntry`, ... — one method per persistence operation,
not one method per use case). `application/users/userProfileUseCases.ts` exports one
factory, `createUserProfileUseCases(deps: { userRepository: UserRepositoryPort })`,
returning `{ createOrRefreshSession, getUserProfile, updateThemePreference }`;
`createOrRefreshSession` reproduces today's `getOrCreateUser` branch exactly: call
`findByUid`, and if it returns `null`, call `create`; otherwise call
`touchLastSignIn`.

**Rationale**: Verified by reading `services/userService.ts`: `getOrCreateUser`'s only
real business rule is the existence check and which persistence primitive to call as a
result — the two branches (`set()` vs. `update({ lastSignInAt })`) are otherwise pure
Firestore calls. Keeping that one branch in the application layer (not the port) is
what Principle IV's Dependency Inversion is for — a port should expose infrastructure
capabilities, not encode a business decision about when to use which one. This mirrors
`LibraryRepositoryPort`'s existing split (e.g. `createEntry` vs. `updateEntryInstance`
are separate primitives; the decision of *which one* to call on a successful sync lives
in `application/library/syncLibrary.ts`, not in the Firestore adapter).

**Alternatives considered**: A single `upsert(identity)` port method that internally
decides create-vs-update — rejected; this would push a business decision (the
create-vs-touch branch, and specifically that a repeat sign-in must *not* touch
identity fields — see Decision 5) into the adapter layer, which Principle VIII
reserves for infrastructure translation only, and would make that branch untestable
without a real or fake Firestore call.

## Decision 3: `createOrRefreshSession`, `getUserProfile`, and `updateThemePreference` stay combined in one application-layer factory

**Decision**: All three functions live in one file,
`application/users/userProfileUseCases.ts`, behind one factory,
`createUserProfileUseCases`, rather than three separate files each with their own
`createXUseCase` factory.

**Rationale**: This departs from Historia 4's one-factory-per-file precedent
(`createStartLinkUseCase`, `createCompleteLinkUseCase`, ... — four independent files)
but matches the feeds migration's Decision 2 reasoning exactly: verified here that
none of the three functions carries independent business logic beyond a single
`UserRepositoryPort` call (`getUserProfile`/`updateThemePreference` are direct
pass-throughs; `createOrRefreshSession`'s one branch is covered by Decision 2).
Splitting three one-line pass-through functions into three files each importing the
same single port would add files without adding independent testability — the reverse
of what Historia 4's real split (four use cases with no shared logic and genuinely
different failure modes) was solving for. Principle III's "simplest design that
satisfies the current, stated requirement" applies directly.

**Alternatives considered**: Matching Historia 4's one-file-per-use-case precedent
regardless — rejected for the same reason the feeds migration rejected it: precedent
guides consistency, but is not itself a rule requiring a split when the functions
share their only dependency and none has independent branching logic.

## Decision 4: `AuthenticatedUser` moves from `types/express.d.ts` into `domain/auth/types.ts`

**Decision**: `domain/auth/types.ts` becomes the canonical home for the
`AuthenticatedUser` interface (`uid`, `email`, `name?`, `picture?`) — the exact shape
`AuthVerifierPort.verifyIdToken` resolves to, and what `req.auth` holds after
`requireAuth` runs. `types/express.d.ts` keeps only the ambient
`declare global { namespace Express { interface Request { auth?: AuthenticatedUser } } }`
augmentation, importing the type from `../domain/auth/types` instead of declaring it
inline.

**Rationale**: Verified by `grep`: no file imports `AuthenticatedUser` by name today
(every consumer relies on the global `Request.auth` merge, not a named import), so
this move is a pure relocation with zero call-site changes beyond the one file that
declares it. `AuthenticatedUser` is exactly the port's own return type — Principle
VIII's domain layer is where a port's input/output shapes belong (mirroring
`RawFeedItem` living in `domain/feeds/types.ts` as `FeedSourcePort`'s return type,
feeds migration Decision 1) — while the ambient Express augmentation itself has no
infrastructure dependency of its own and stays a thin global declaration, the same
treatment Historia 1 gave transversal, dependency-free files.

**Alternatives considered**: Leaving `AuthenticatedUser` declared inline in
`types/express.d.ts` — rejected; the type is a domain-owned contract (what a
successful verification resolves to), not an Express-specific detail, and Historia 1's
transversal-module carve-out is for modules with *no* infrastructure dependency and no
business shape to own, which does not describe this interface.

## Decision 5: Spec correction — a repeat sign-in updates only `lastSignInAt`, never identity fields

**Decision**: `createOrRefreshSession`'s `touchLastSignIn` branch updates only
`lastSignInAt`. `displayName`, `email`, `photoURL`, and any stored `themePreference`
are left untouched on a repeat sign-in, exactly as `services/userService.ts` behaves
today.

**Rationale**: Verified by reading `services/userService.ts`'s `getOrCreateUser`: the
`else` branch (`snapshot.exists === true`) calls only
`docRef.update({ lastSignInAt: now })` — it does not read or write `displayName`,
`email`, or `photoURL` from the incoming `identity` argument at all. spec.md's User
Story 1, Acceptance Scenario 2 originally said a repeat sign-in "updates `lastSignInAt`
(and any changed identity fields)," which overstated actual behavior — this planning
phase corrected that scenario's wording (now: "updates only `lastSignInAt` ... identity
fields ... are left exactly as they were") before designing the port and use case
against it, since spec.md's own FR-006/FR-009 and Assumptions already require this
migration to be purely structural with zero behavior change — a plan built against the
overstated wording would have introduced an actual behavior change (writing identity
fields on every sign-in) that nothing in this story's scope calls for.

**Alternatives considered**: Implementing the parenthetical literally (updating
changed identity fields on every sign-in) — rejected; this would be a real behavior
change smuggled into a story whose entire premise (spec.md Assumptions) is "no
business rule ... changes as a result of it," and no acceptance criterion or edge case
in the parent HU document asks for it.

## Decision 6: `cache/cacheAside.ts` and `cache/redisClient.ts` relocate into `adapters/cache/`, ending the deferral from Historias 3-4-5

**Decision**: Both files move verbatim (same functions, same fail-soft/coalescing
logic) into `adapters/cache/`, alongside the `cacheAdapter.ts` that already wraps them.
`cacheAdapter.ts`'s two imports change from `../../cache/cacheAside`/
`../../cache/redisClient` to `./cacheAside`/`./redisClient` (same directory). Every
other file that imports either module directly — verified by `grep`: eight test files
across the feeds, library, and discogs-catalog domains (listed in plan.md's Technical
Context) — gets a one-line import-path update, zero assertion changes.

**Rationale**: The feeds migration's plan.md explicitly recorded why it did *not* do
this: "relocating those two files is still not triggered by any single domain needing
it exclusively, same reasoning Historias 3 and 4 applied." This story is the one
spec.md (User Story 4, FR-004) and the parent HU document (Historia 6's stated
purpose) name as the point where that deferral ends — `CachePort` already has exactly
one definition and one adapter (verified: `ports/cache/cachePort.ts`,
`adapters/cache/cacheAdapter.ts`, no duplicates), so the only remaining
inconsistency is that its own implementation still lives partly outside the adapters
layer it's supposed to be confined to.

**Alternatives considered**: Leaving `cache/cacheAside.ts`/`cache/redisClient.ts` in
place indefinitely, treating "the port has one definition" as sufficient
consolidation — rejected; spec.md's User Story 4 Acceptance Scenario 2 and FR-004
explicitly require the underlying implementation to relocate, not just the interface,
and Constitution Principle VIII's four-layer folder convention applies to every file
with an infrastructure dependency, not only to a domain's own port/adapter pair.

## Decision 7: User Story 2's phase performs the full `requireAuth` consumer cutover, including a bridge fix for `routes/auth.ts` before User Story 3 rewrites it

**Decision**: Once `adapters/auth/requireAuth.ts` exists and is proven (User Story 2),
the same phase updates **all five** current consumers' import path in one step: the
four already-migrated domains' route files (`library`, `discogsCatalog`,
`discogsOauth`, `feeds`) and `routes/auth.ts` itself — even though `routes/auth.ts`'s
own rewrite into `adapters/users/authRoutes.ts` doesn't happen until User Story 3.
Only after all five imports move does `middleware/requireAuth.ts` get deleted, within
User Story 2's own phase.

**Rationale**: `middleware/requireAuth.ts` cannot be deleted while any file still
imports it, and `routes/auth.ts` is one of its five current importers — verified by
`grep`, same as the four other domains. Deferring `routes/auth.ts`'s one-line import
fix to User Story 3 (its own cutover phase) would leave `middleware/requireAuth.ts`
undeletable at the end of User Story 2, breaking the copy-then-cutover discipline the
feeds and prior migrations established (each phase's checkpoint leaves the codebase in
a fully working state, old file already retired once nothing points at it). Fixing
`routes/auth.ts`'s single import line early costs nothing — the rest of that file
(the Firestore/`userService` calls) stays completely untouched until User Story 3's
own rewrite.

**Alternatives considered**: Waiting until User Story 3 to update all five consumers
at once — rejected; this would leave `middleware/requireAuth.ts` in place, still
importable, throughout User Story 2's phase, meaning User Story 2's own "Independent
Test" (spec.md: `requireAuth` proven against a fake port) would be true in isolation
but the domain's stated Success Criteria (SC-002: zero files import `firebase-admin`
directly outside the port) would not yet hold at that phase's checkpoint — an
inconsistent intermediate state this migration's established discipline avoids.
