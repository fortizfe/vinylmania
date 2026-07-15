# Phase 0 Research: Library Domain Migrated to Hexagonal Architecture

No `NEEDS CLARIFICATION` markers remained in the Technical Context — this feature operates inside
an already-ratified architectural convention (Constitution Principle VIII, from the parent user
story's Historia 1) and an already-verified current codebase (see `.hu/backend-hexagonal-architecture-refactor.md`).
The decisions below resolve the *design* choices Historia 1 explicitly deferred to this planning
phase, not open unknowns about the stack.

## Decision 1: Where domain errors and the filter predicate move

**Decision**: `DiscogsNotLinkedError` and `FieldNotEditableError` move out of
`librarySyncService.ts` into `domain/library/libraryErrors.ts`. `matchesLibraryFilters` (plus its
private `FILTER_FIELDS` constant) moves out of `libraryService.ts` into `domain/library/libraryFilters.ts`.

**Rationale**: Both are pure, infrastructure-free business rules — exactly what Principle VIII
defines as Domain. Keeping the already-conformant error-hierarchy pattern (`DiscogsError` and
siblings, cited by Principle VIII's own Rationale) meant relocating, not redesigning, these two
error classes: same fields, same `code`/`message`, same throw sites conceptually (now inside
`application/library/*` instead of the old `library/*` files).

**Alternatives considered**: Leaving errors defined inline in whichever application file throws
them first — rejected because both errors are caught by the driving adapter (`libraryRoutes.ts`)
for HTTP mapping, and by more than one application use case (`FieldNotEditableError` is thrown by
both `updateLibraryEntry` and `syncLibrary`'s legacy-field migration path), so a shared domain
location avoids either a circular import or duplicated class definitions.

## Decision 2: LibraryEntry/EntryDiscogsData/LibraryFilters stay a single unified shape

**Decision**: `domain/library/types.ts` is a verbatim relocation of `library/types.ts` — no split
into a separate "domain entity" vs. "HTTP DTO" pair. The existing exclusion of
`legacyCondition`/`legacyNotes` at the HTTP boundary (`serializeEntry()` in the driving adapter)
is preserved exactly as today.

**Rationale**: Confirmed as the reasonable default in `spec.md`'s Assumptions. Splitting the type
would touch every function signature in the domain for a purely representational change with zero
required behavior difference — Principle III (YAGNI/KISS) rules it out absent a concrete need. The
existing field-level exclusion at serialization time already achieves the practical goal (secrets/
legacy fields never leave the backend) without a second type hierarchy.

**Alternatives considered**: A `LibraryEntryDTO` stripped of legacy fields, constructed once at the
adapter boundary — rejected for this feature; revisit only if a future story needs the domain type
and the HTTP response shape to diverge for a reason beyond field exclusion.

## Decision 3: `DiscogsCollectionPort` and `DiscogsConnectionPort` live under `ports/library/`, not a shared/anticipatory folder, and wrap the *existing, unmoved* Discogs modules

**Decision**: Both ports are defined under `ports/library/` (this feature's own domain folder), and
their adapters (`adapters/library/discogsCollectionAdapter.ts`,
`adapters/library/discogsConnectionAdapter.ts`) are thin delegators to the untouched
`discogs/collection/collectionClient.ts` and `discogs/oauth/discogsOauthService.ts` — those two
files are not relocated, rewritten, or touched beyond being imported from a new call site.

**Rationale**: The parent user story is explicit that Historia 2 (this feature) "puede definir una
versión provisional que Historia 4 consolide" for exactly these two ports — Historia 4 owns
`discogs/oauth/*` and `discogs/collection/collectionClient.ts`'s real migration into `domain/`,
`application/`, and `adapters/` folders of their own. Guessing at Historia 4's eventual folder
names now (e.g. a speculative `ports/discogsCollection/`) would be designing another story's
output ahead of that story's own planning phase. Scoping the provisional ports to `ports/library/`
keeps this feature's blast radius to the `library/` domain only, satisfying the parent user story's
requirement that each domain "puede migrarse y desplegarse de forma independiente."

**Alternatives considered**: Pre-creating `ports/discogsCollection/` and `ports/discogsConnection/`
folders now to save Historia 4 a move — rejected; Historia 4's own planning phase is better placed
to decide whether the OAuth flow and the Collection API client should even share one port folder or
two, a question this feature has no need to answer.

## Decision 4: `CachePort` is library-scoped, models the raw get/set-with-TTL the sync marker
actually uses (not the `withCache` fetcher pattern), and wraps `cache/redisClient.ts` in place

**Decision**: `librarySyncService.ts`'s existing `isMarkerFresh`/`setMarker` call
`getRedisClient()` directly (`client.get(key)` / `client.set(key, value, 'EX', ttl)`) — they do not
use `cache/cacheAside.ts`'s `withCache`/`invalidateCache` fetcher-wrapping helper at all; nothing
else under `library/*` touches the cache layer. So `ports/library/cachePort.ts` models exactly that
narrower shape (`has(key)` / `set(key, value, ttlSeconds)`, both documented as never-rejecting),
and `adapters/library/cacheAdapter.ts` implements it by calling `cache/redisClient.ts`'s
`getRedisClient()` directly, preserving the exact same try/catch fail-soft behavior. Neither
`cache/redisClient.ts` nor `cache/cacheAside.ts` are relocated or modified.

**Rationale**: Principle III (YAGNI) — defining `CachePort` as the fuller `withCache<T>(key, ttl,
fetcher)` generic would model a capability the library domain doesn't currently use (that pattern
lives inside `collectionClient.ts`'s `getFieldMap`, a file this feature doesn't touch — Decision 3).
`cache/redisClient.ts` is also imported directly today by `discogsClient.ts`, `collectionClient.ts`,
`feedAggregator.ts`, and `cache/cacheAside.ts` itself — relocating it would force an import-path
change in files outside this feature's domain boundary, violating the parent user story's
cross-domain-independence requirement. Historia 6 (parent user story) already anticipates a
per-domain `CachePort` as the expected intermediate state before its final consolidation.

**Alternatives considered**: Modeling `CachePort` after `cacheAside.ts`'s `withCache` for
forward-compatibility with Historia 6's later consolidation — rejected: Historia 6 already owns
reconciling whatever shape each domain's `CachePort` ends up as; matching today's actual call sites
exactly is more honest than guessing at a shape this feature has no caller for. Relocating
`cache/redisClient.ts`/`cache/cacheAside.ts` into `adapters/cache/` now — rejected as out of this
feature's domain boundary for the same reason as above.

## Decision 5: Dependency injection is manual constructor-function factories, no framework

**Decision**: Each `application/library/*` use case is exported as a factory function taking only
the ports it needs (e.g. `createSyncLibraryUseCase(deps: { repository, discogsCollection,
discogsConnection, cache })`), instantiated once in `adapters/library/libraryRoutes.ts` with the
concrete adapters and closed over by the route handlers.

**Rationale**: Principle III (Simplicity, YAGNI & KISS) — the project has no existing DI container,
and introducing one for a single domain would be exactly the kind of premature abstraction the
constitution rules out. A factory function is enough to satisfy Dependency Inversion (Principle IV)
and, as a direct side effect, resolves the test-mock path-fragility edge case flagged in `spec.md`:
`application/library/*` unit tests construct in-memory fake ports and pass them straight to the
factory, with zero `jest.mock('<module path>', ...)` calls — the exact `jest.mock()` calls the
existing `tests/unit/librarySyncService.test.ts` uses today for `collectionClient`,
`discogsOauthService`, `libraryService`, and `redisClient` disappear entirely rather than needing
their paths updated.

**Alternatives considered**: A class-based service with constructor injection — functionally
equivalent for this codebase's style (existing `library/*` and `discogs/*` modules are all plain
exported functions, never classes); factories keep the migrated code idiomatically consistent with
everything around it.

## Decision 6: Test reorganization mirrors domain, not domain+layer

**Decision**: Tests move to `backend/tests/{unit,integration,contract}/library/`, keeping the
existing unit/integration/contract split as the top-level grouping. Only `unit/` gets a further
`domain/` vs. `application/` split, because this feature is what makes those two layers
independently unit-testable for the first time; `integration/` and `contract/` tests exercise the
whole wired-up stack (real Firebase emulator) and don't benefit from a matching subdivision.

**Rationale**: Principle III again — a fourth grouping dimension (test-type × layer × domain) adds
directory depth without adding traceability the domain-only grouping doesn't already provide, since
each domain currently has at most one or two files per layer. The parent user story's own framing
("se reorganizan junto con el código... por capas") is satisfied by tests living alongside the
layer their subject file now belongs to; it does not require mirroring all four layers under every
test-type folder.

**Alternatives considered**: `tests/unit/domain/library/`, `tests/unit/application/library/`
(layer-first, domain-second) — rejected only for ordering; the chosen `tests/unit/library/domain/`,
`tests/unit/library/application/` groups everything about one domain together, which is more useful
when a domain (not a layer) is what a future story's "Prueba independiente" section will name.

## Decision 7: `conditionGrading.ts` is not moved by this feature

**Decision**: `discogs/collection/conditionGrading.ts` (and its existing test,
`tests/unit/conditionGrading.test.ts`) stays exactly where it is. `application/library/syncLibrary.ts`
and `adapters/library/libraryRoutes.ts` import `mapLegacyCondition`/`MEDIA_CONDITIONS`/`SLEEVE_CONDITIONS`
from its current path, cross-domain, same as today.

**Rationale**: The parent user story's own scope line for this feature is `library/*` and
`routes/library.ts` — `conditionGrading.ts` lives under `discogs/collection/`, outside that glob,
and its explicit "Prueba independiente" test list for this feature does not name
`conditionGrading.test.ts`. It has no infrastructure dependency, so Principle VIII's transversal-module
carve-out already lets it be consumed from any layer without becoming a port or moving — exactly the
carve-out Historia 1 wrote for cases like this one. It becomes Historia 3 or Historia 4's call
whether it relocates once `discogs/collection/` itself is migrated.

**Alternatives considered**: Moving it into `domain/library/` now since library is its only
consumer today — rejected: `collectionClient.ts` (Historia 4's file, not this feature's) also
references Discogs' grading vocabulary conceptually, and moving it preemptively risks Historia 4
having to move it back or import cross-domain from `domain/library/`, which would be a stranger
dependency direction than leaving it where it is now.
