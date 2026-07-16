# Phase 0 Research: Discogs OAuth + Collection Domain Migrated to Hexagonal Architecture

No `NEEDS CLARIFICATION` markers remained in the Technical Context. One design
question was already resolved during `/speckit-clarify` (the `DiscogsConnectionPort`'s
broadened scope) and is recorded in spec.md's Clarifications section, not repeated
here as an open decision — Decision 3 below documents its resulting shape, not the
choice itself. The decisions below resolve everything else spec.md explicitly deferred
to this planning phase.

## Decision 1: The shared resilience modules and `discogsErrors.ts` are not relocated

**Decision**: `discogs/discogsRateLimiter.ts`, `discogs/discogsCircuitBreaker.ts`,
`discogs/discogsRetry.ts`, and `discogs/discogsErrors.ts` stay exactly where they are.
The new `adapters/discogsOauth/discogsCollectionAdapter.ts` imports them from that
unchanged location, same as `collectionClient.ts` does today.

**Rationale**: This is the mirror image of Historia 3's own Decision 1, now from the
other side: Historia 3's research.md already recorded, while migrating the catalog
domain, that these four modules could not move into `adapters/discogsCatalog/` because
`collectionClient.ts` (this domain, not yet migrated at the time) also imports them.
Now that this domain is the one migrating, the same modules stay put for the same
reason in reverse — relocating them into `adapters/discogsOauth/` would force an
import-path change in `adapters/discogsCatalog/discogsCatalogAdapter.ts`, a file
entirely outside this feature's scope. With this migration, every domain that imports
these four modules is now hexagonal-compliant on both ends, so a future dedicated
cleanup (formalizing a permanent shared home, e.g. `adapters/discogsShared/` or
similar) is finally possible without breaking a not-yet-migrated consumer — but that
formalization is not forced by this feature and is left to whichever later work
actually needs it, consistent with how both prior stories treated this same open
question.

**Alternatives considered**: Formalizing a shared home for these four modules as part
of this feature, since it is the second (and last, for these particular modules)
domain to depend on them — rejected as scope creep relative to spec.md's explicit
"Fuera de alcance" framing (this story migrates OAuth + Collection, not a
resilience-module cleanup); Principle III (YAGNI) favors leaving a working, already
Hexagonal-compliant arrangement (four transversal-by-import-count modules living in a
shared `discogs/` folder, imported by two adapters) alone rather than moving them for
the sake of moving them.

## Decision 2: The "already connected" check moves out of the route and into the use cases

**Decision**: `startLink` and `completeLink` (the new
`application/discogsOauth/startLink.ts` / `completeLink.ts` use cases) each begin by
calling `DiscogsConnectionPort.getConnection(uid)` and throwing
`DiscogsOauthFlowError('already_connected', ...)` if a connection already exists.
`adapters/discogsOauth/discogsRoutes.ts`'s `POST /request` and `POST /complete`
handlers no longer perform this check themselves — they call the use case and let the
existing `handleFailure` catch the thrown error, exactly as it already does for the
`expired_request`/`invalid_request` codes.

**Rationale**: Verified by reading `routes/discogsOauth.ts` before deciding: today,
both handlers call `if (await getConnection(uid)) { res.status(409).json(...) }`
*inline*, before calling `startLink`/`completeLink` — this is business orchestration
living in the driving adapter, which spec.md's User Story 3 and Constitution Principle
VIII both explicitly forbid ("routes... MUST NOT contain business orchestration
logic"). `DiscogsOauthFlowError` already has an `already_connected` code (verified in
`discogsOauthService.ts`) that exists for exactly this kind of linking-flow failure but
is currently unused by this particular check — the check was implemented ad hoc in the
route instead of through the domain-error mechanism the rest of the flow already uses.
Moving it into the use cases is not a new mechanism; it is applying the pattern the
rest of this same file already follows (expiration and ownership mismatches already
throw `DiscogsOauthFlowError` from inside `completeLink`) to the one check that,
verified, does not yet follow it. The HTTP response is unchanged: `handleFailure`
already maps `already_connected` to the same 409 status and message the route's inline
check produces today (verified: both use `ALREADY_CONNECTED.message`).

**Alternatives considered**: Leaving the check in the route and having it call a
dedicated `isConnected` port method — rejected; this still leaves an `if`/business
decision in the driving adapter, which is the exact shape Principle VIII forbids,
whereas throwing from inside the use case and letting the adapter's job stay
"translate the caught error" requires no behavioral special-casing in the adapter at
all. Duplicating the check in both use cases via a shared private helper within
`application/discogsOauth/` — accepted implicitly as part of this decision (the two use
cases share this one check), not a separate alternative.

## Decision 3: `DiscogsConnectionPort`'s final shape — one port, both Firestore state and the handshake

**Decision**: Per the Clarifications session, `DiscogsConnectionPort` exposes both the
Firestore-backed persistence methods and the three raw HTTP handshake steps, all
implemented by one `adapters/discogsOauth/discogsConnectionAdapter.ts`:

- `createPendingRequest(uid)` → performs the request-token HTTP call *and* the
  Firestore write, returning `{ authorizeUrl }` (mirrors today's `startLink` doing both
  in sequence); reads `DISCOGS_OAUTH_CALLBACK_URL` from `process.env` internally,
  adapter-owned configuration rather than a caller-supplied argument, mirroring
  `getCredentials()`'s existing handling of the consumer key/secret
- `getPendingRequest(oauthToken)` / `deletePendingRequest(oauthToken)` → pending-request
  Firestore reads/deletes only (the ownership/expiration *decision* stays in
  `completeLink`, per Decision 3's own "one port, one adapter, business rules stay in
  application" split below)
- `exchangeAccessToken(oauthToken, requestTokenSecret, verifier)` /
  `fetchIdentity(accessToken, accessTokenSecret)` → the two remaining HTTP handshake
  steps, kept separate from `getConnection`/`saveConnection` since `completeLink` needs
  to inspect the identity result before deciding what to persist; a Discogs 4xx on
  `exchangeAccessToken` makes the adapter throw `DiscogsOauthFlowError('expired_request',
  ...)` directly (never a raw `axios`-derived error), so `completeLink` never needs to
  import `axios` to classify it (Constitution Principle VIII)
- `getConnection(uid)` / `saveConnection(uid, connection)` / `deleteConnection(uid)` /
  `markInitialLibrarySync(uid)` → Firestore reads/writes, unchanged in shape from the
  library domain's existing provisional port for the two that already existed there

**Rationale**: A "port" in this codebase's own established convention (verified
against `DiscogsCatalogPort` and `CachePort`) is drawn at the boundary of *one external
system this domain depends on*, not at the boundary of one specific SDK — `CachePort`
itself already spans two unmoved implementation files (`redisClient.ts` for `has`/`set`,
`cacheAside.ts` for `withCache`) behind one interface. This domain depends on exactly
one external system for its connection concern (Discogs' OAuth endpoints plus this
backend's own Firestore record of the result), so one port matches that precedent.
Splitting `getPendingRequest`/`deletePendingRequest` from the ownership/expiration
check (rather than exposing a single `completeHandshake`-style port method that does
everything) keeps the actual product rules — "is this pending request expired,"
"does it belong to this user" — in the application layer where they are testable
against a fake port and an injectable clock, per spec.md's own Independent Test for
User Story 1; a coarser port method would push those checks into the adapter, where
they could only be tested against a real (or emulated) Firestore.

**Alternatives considered**: The three options weighed during `/speckit-clarify`
(dedicated third port; folded into the connection port; folded into the collection
port) are recorded in spec.md's Clarifications section — the connection-port option
was selected there. Within that chosen shape, a coarser single `completeLink(oauthToken,
verifier, uid)` port method that does the lookup, ownership check, expiration check,
handshake, and persistence all in one adapter call was also considered and rejected:
it would move the expiration/ownership business rules into the adapter, directly
contradicting spec.md FR-002's explicit "MUST be testable without a real Firestore
instance" requirement for exactly those two rules.

## Decision 4: `oauthHttpClient.ts` and `oauthSignature.ts` relocate into the adapter layer, not domain

**Decision**: `discogs/oauth/oauthHttpClient.ts` moves to
`adapters/discogsOauth/oauthHttpClient.ts` unchanged. `discogs/oauth/oauthSignature.ts`
moves to `adapters/discogsOauth/oauthSignature.ts` unchanged, despite importing nothing
beyond Node's built-in `node:crypto` — it has no infrastructure-SDK dependency of its
own.

**Rationale**: `oauthSignature.ts`'s zero-infra-import status is the same situation
Historia 3's Decision 4 already resolved for `discogsMapper.ts` (also infra-free, also
moved into the adapter folder, not domain): both are tightly coupled to one external
protocol's exact shape (there, Discogs' raw JSON response shape; here, OAuth 1.0a's
exact header-parameter format and the Discogs-specific choice of the PLAINTEXT
signature method) and are consumed only by the adapter(s) that speak that protocol —
moving either into `domain/discogsOauth/` would misrepresent a protocol-translation
detail as a business rule. `oauthSignature.ts` is additionally consumed by *two*
adapters in this domain (`discogsConnectionAdapter.ts` for the handshake headers,
`discogsCollectionAdapter.ts` for `buildProtectedResourceHeader` on every collection
call, verified in `collectionClient.ts`'s current imports) — placing it in
`adapters/discogsOauth/` (sibling to both, not nested under either) keeps it a shared
adapter-layer utility without picking one of its two consumers to own it.

**Alternatives considered**: Leaving `oauthSignature.ts` in `domain/discogsOauth/`
since it has no infrastructure import and Constitution Principle VIII's transversal
carve-out technically permits consuming infra-free modules "from any layer" —
rejected; the carve-out is about *permission* to consume a module from any layer
without a port, not a mandate to classify every infra-free module as domain code. Its
actual content (building an `OAuth ...` HTTP `Authorization` header string) is an
adapter-layer protocol concern by what it does, not by what it imports.

## Decision 5: `conditionGrading.ts` relocates into the domain layer, not the adapter layer

**Decision**: `discogs/collection/conditionGrading.ts` moves to
`domain/discogsOauth/conditionGrading.ts` unchanged.

**Rationale**: Unlike `oauthSignature.ts` (Decision 4), this file's content is a
genuine business rule, not a protocol-translation detail: `mapLegacyCondition` decides
how Vinylmania's own pre-feature-016 free-text condition values map onto Discogs'
grading vocabulary, and `MEDIA_CONDITIONS`/`SLEEVE_CONDITIONS`/`isMediaCondition`/
`isSleeveCondition` define that vocabulary itself. Verified by checking every current
consumer: `application/library/syncLibrary.ts` (a business-logic file, already
migrated in Historia 2) calls `mapLegacyCondition` as part of its legacy-migration
rule, and `adapters/library/libraryRoutes.ts` uses the two constant arrays for request
validation. An application-layer file consuming it is the deciding signal — domain code
may be consumed from application code freely, but nothing in `application/` may import
from another domain's adapter layer, so this file cannot live in
`adapters/discogsOauth/` without breaking `syncLibrary.ts`'s own layering.

**Alternatives considered**: Leaving it in `discogs/collection/` as a transversal,
infra-free module per Constitution Principle VIII's carve-out (same reasoning
`oauthSignature.ts` was rejected for, in reverse) — rejected for consistency: this
migration's whole point is that every file with no remaining infra-coupled sibling gets
a real home in the four-layer convention rather than staying in the legacy `discogs/`
folder indefinitely; `conditionGrading.ts` has no infra-coupled sibling forcing it to
stay (unlike the resilience modules in Decision 1, which stay only because
relocating them would break an already-migrated domain).

## Decision 6: `CachePort` gains `invalidate(key)`; not duplicated, not left as a direct import

**Decision**: `ports/cache/cachePort.ts` gains one new method:
`invalidate(key: string): Promise<void>`, matching `cache/cacheAside.ts`'s existing
`invalidateCache` signature and fail-soft behavior (a Redis outage or absent client is
silently swallowed) verbatim. `adapters/cache/cacheAdapter.ts` gains the matching
implementation, delegating to the still-unmoved `invalidateCache`. The new
`application/discogsOauth/disconnectConnection.ts` use case calls
`cache.invalidate(fieldsCacheKey(uid))` instead of importing `invalidateCache` from
`cache/cacheAside.ts` directly.

**Rationale**: Historia 3's own research.md, while extending `CachePort` with
`withCache`, explicitly scoped `invalidate` out and named the reason: "no consumer in
either the library or catalog domain needs it yet... it stays a direct
`cache/cacheAside.ts` import for `discogsOauthService.ts` until Historia 4." This is
that exact, already-anticipated trigger arriving on schedule. `fieldsCacheKey` itself
(the cache-key-building function, currently exported from `collectionClient.ts`) moves
to `domain/discogsOauth/collectionTypes.ts` as a pure function, **not** into
`adapters/discogsOauth/discogsCollectionAdapter.ts` — placing it in the domain layer
(rather than either adapter) is what lets `disconnectConnection.ts` (User Story 1)
invalidate the field-map cache key without depending on User Story 2's collection
adapter existing first, keeping the two stories independently buildable/testable per
spec.md's own framing of each as a standalone slice. `discogsCollectionAdapter.ts`'s
own `getFieldMap` imports it from the same shared location.

**Alternatives considered**: Adding `invalidate` as a new, domain-scoped
`ports/discogsOauth/`-local cache method instead of extending the shared `CachePort` —
rejected outright; this is precisely the "second, parallel one" spec.md FR-006
forbids, and the shared port already exists specifically to prevent this. Leaving
`disconnect`'s cache invalidation on the direct `cache/cacheAside.ts` import a while
longer (deferring to Historia 6, which explicitly targets final `CachePort`
consolidation) — rejected: Historia 6's own scope (per the parent HU document) is
about consolidating `CachePort`'s *definition* once every domain needing it has a
working consumer, not about tolerating a fourth domain skipping the port entirely; this
feature is one of the domains Historia 6 is waiting on.

## Decision 7: The library domain's two provisional ports and adapters are retired, not deprecated in place

**Decision**: `ports/library/discogsCollectionPort.ts`,
`ports/library/discogsConnectionPort.ts`, `adapters/library/discogsCollectionAdapter.ts`,
and `adapters/library/discogsConnectionAdapter.ts` are deleted. Every one of their
current consumers is repointed to the new `ports/discogsOauth/discogsCollectionPort.ts`
/ `discogsConnectionPort.ts` and the new
`adapters/discogsOauth/discogsCollectionAdapter.ts` /
`discogsConnectionAdapter.ts` (verified exhaustively, by import, not by folder
scanning): `application/library/createLibraryEntry.ts`,
`application/library/deleteLibraryEntry.ts`, `application/library/getLibraryEntry.ts`,
`application/library/updateLibraryEntry.ts`, `application/library/syncLibrary.ts`, and
`application/library/discogsCopyData.ts` each import the `DiscogsCollectionPort`
and/or `DiscogsConnectionPort` **types** from the old `ports/library/` location; the
composition root `adapters/library/libraryRoutes.ts` imports and wires both concrete
**adapter objects**.

**Rationale**: Spec.md FR-005 and SC-004 both explicitly require zero remaining
call sites depending on this domain's pre-migration internals — a deprecated-in-place
shim (old files re-exporting the new ones) would technically satisfy "no file imports
`firebase-admin`/`axios` directly anymore" but would leave a permanent, pointless
indirection layer that Principle III (YAGNI) gives no justification for keeping once
every consumer has been identified and is being fixed in this same feature anyway. The
two provisional ports' method shapes are already identical to what this feature
delivers (verified: `ports/library/discogsCollectionPort.ts`'s 7 methods and
`ports/library/discogsConnectionPort.ts`'s 2 methods match `DiscogsCollectionPort`/
`DiscogsConnectionPort`'s corresponding methods exactly) — every fix is a pure
import-path change, not a call-site rewrite, exactly like Historia 3's
`createLibraryEntry.ts`/`enrichLibraryEntry.ts` fix for the catalog port.

**Alternatives considered**: Keeping the old `ports/library/*` files as type
re-exports (`export type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort'`)
during a transition window — rejected; there is no future consumer this transition
window would serve (this feature fixes every existing one in the same change), so it
would only be speculative flexibility for a migration that has no next step depending
on it, which is exactly what Principle III's "no configuration options... for
hypothetical future needs" rules out.
