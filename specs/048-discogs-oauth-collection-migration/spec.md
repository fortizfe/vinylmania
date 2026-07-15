# Feature Specification: Discogs OAuth + Collection Domain Migrated to Hexagonal Architecture

**Feature Branch**: `048-discogs-oauth-collection-migration`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Historia 4 de @.hu/backend-hexagonal-architecture-refactor.md — Como desarrollador del backend, quiero que el flujo de vinculación OAuth (`discogs/oauth/*`, `routes/discogsOauth.ts`) y el cliente de la Collection API autenticada (`discogs/collection/collectionClient.ts`) dejen de depender directamente de `firebase-admin` y `axios`, para que la lógica de negocio del linking (validar token pendiente, expiración, ya conectado) sea testeable sin Firestore real."

## Clarifications

### Session 2026-07-15

- Q: `startLink`/`completeLink` today call Discogs's OAuth handshake endpoints
  (request-token, access-token exchange, identity lookup) via a raw `axios`-based
  client, separate from both Firestore persistence and the 7 Collection API
  operations already scoped to their own port. Which port should own this handshake?
  → A: Fold it into the connection port — broaden it from "persistence" to a general
  Discogs connection port covering both Firestore state and the handshake network
  calls.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Linking-flow rules isolated behind a single Discogs connection port (Priority: P1)

As a backend developer, I want the Discogs account-linking rules (starting a link
request — including the OAuth request-token handshake call, completing it with a
pending-token/expiration/ownership check and the access-token exchange and identity
lookup, reading connection status, disconnecting, marking the first library sync as
done) to depend on a single Discogs connection port instead of calling Firestore and
the OAuth handshake's HTTP client directly, so that linking-flow logic — including its
time-based expiration rule — can be tested without a real Firestore instance, without
a real network call, and without waiting on real wall-clock time.

**Why this priority**: The linking flow is the most business-rule-dense part of this
domain (pending-token existence, ownership, and a 15-minute expiration window are all
real product rules, not raw data access) and is the piece two other already-migrated
domains provisionally depend on (see Edge Cases) — it should be the first target so
those provisional dependents have a real port to consolidate onto.

**Independent Test**: Can be fully tested by running `startLink`/`completeLink`/
`getConnection`/`getStatus`/`disconnect`/`markInitialLibrarySync` against a fake
Discogs connection port and an injectable clock, and confirming pending-token lookup,
ownership mismatch, expiration, and the handshake calls are each exercised without a
real Firestore instance, a real network call, or a real 15-minute wait.

**Acceptance Scenarios**:

1. **Given** a user with no pending link attempt and no existing connection, **When**
   they start a link, **Then** a pending request is created and an authorize URL is
   returned, with both the request-token handshake call and the pending-request write
   going through the Discogs connection port only.
2. **Given** a pending link attempt that has passed its expiration window, **When** the
   user attempts to complete it, **Then** the attempt is rejected as expired and the
   pending record is removed, with the expiration check evaluated against an
   injectable clock rather than the wall clock directly.
3. **Given** a pending link attempt that belongs to a different user, **When** the
   current user attempts to complete it, **Then** it is rejected without deleting the
   record (so its rightful owner can still complete it).
4. **Given** a user who already has a connection, **When** they attempt to start or
   complete another link, **Then** the attempt is rejected as already connected.
5. **Given** a valid, unexpired pending link attempt owned by the requesting user,
   **When** they complete it, **Then** the access-token exchange and identity lookup
   both go through the Discogs connection port only, and the resulting connection is
   written through that same port.
6. **Given** the Discogs connection port swapped for a test double, **When** the
   existing linking-flow test suite runs, **Then** all tests pass with unchanged
   assertions and without any real Firestore dependency or real network call.

---

### User Story 2 - Authenticated Collection API access isolated behind a collection port (Priority: P1)

As a backend developer, I want every authenticated Discogs Collection API call (field
map, listing/reading instances, adding/removing a release, rating, editing a
notes-field value) to go through a collection access port instead of calling the
OAuth-signed HTTP client directly, reusing the resilience modules already shared with
the catalog domain, so that collection-access logic is testable without a real network
call and so the two already-migrated domains that provisionally depend on this one
(see Edge Cases) can consolidate onto its real port instead of the raw client.

**Why this priority**: Two already-migrated domains (library, and this domain's own
linking flow for cache invalidation) currently reach past a provisional port straight
into this domain's raw client — closing that gap is high-value and, together with User
Story 1, the two together retire every remaining direct Firestore/HTTP dependency in
this domain.

**Independent Test**: Can be fully tested by stubbing the outbound OAuth-signed HTTP
calls (`nock`) that the collection port's own adapter depends on — rather than a real
Discogs API call — and confirming field-map, instance-listing, add/remove, rating, and
field-edit operations behave correctly, with the existing collection contract test
suite passing unchanged.

**Acceptance Scenarios**:

1. **Given** a request to read or mutate a user's Discogs collection (field map,
   instance listing for a release or for all folders, add, delete, rating, field
   value), **When** the operation runs, **Then** it is served through the collection
   access port only — no file implementing collection business rules calls the
   OAuth-signed HTTP client directly.
2. **Given** the existing resilience behavior shared with the catalog domain
   (rate-limit smoothing, circuit breaker, retry-with-backoff) and this client's own
   OAuth 1.0a request signing, **When** the collection client is migrated, **Then**
   both are preserved exactly, reusing the existing shared resilience modules and
   signing logic relocated as-is rather than redesigned.
3. **Given** the collection access port swapped for a test double, **When** the
   existing collection-client contract test suite runs, **Then** all tests pass with
   unchanged assertions and without any real network dependency.

---

### User Story 3 - HTTP layer and cross-domain consumers depend on the new ports, not the old modules (Priority: P2)

As a backend developer, I want the Discogs OAuth HTTP routes to keep translating
linking-flow errors to HTTP responses while delegating all orchestration to
application-level use cases built on the two new ports, and I want the
already-migrated library domain's provisional adapters to consume the real ports
directly instead of reaching into this domain's raw modules, so that this migration
leaves no lingering direct dependency on this domain's pre-migration internals
anywhere in the backend.

**Why this priority**: This depends on User Stories 1 and 2 existing first (there must
be real ports to consolidate onto), and closing the cross-domain gap is what makes
this domain's migration actually complete rather than leaving a provisional stand-in
in place indefinitely.

**Independent Test**: Can be fully tested by confirming the OAuth route handlers'
bodies contain only request parsing/validation, calls into application-level use
cases, and the existing error-to-HTTP-status mapping — with the existing OAuth
contract test suite passing unchanged — and by confirming the library domain's two
provisional adapters (and any other remaining call site) import only this domain's new
ports, never `discogs/oauth/discogsOauthService` or
`discogs/collection/collectionClient` directly.

**Acceptance Scenarios**:

1. **Given** a link request, completion, status check, or disconnect request, **When**
   the route handles it, **Then** parsing/validating the request and invoking the
   corresponding application use case are the route's only responsibilities, and the
   existing error-to-HTTP mapping pattern (already established, generalized by prior
   stories) still produces the same status codes and error payloads as before the
   migration.
2. **Given** the library domain's two provisional adapters that today import this
   domain's raw modules directly, **When** this migration completes, **Then** both are
   repointed to this domain's new ports, without changing their own business logic.
3. **Given** the existing OAuth and collection contract/unit test suites, **When** they
   run against the migrated code, **Then** every request/response pair and every
   assertion remains identical to today's behavior.

---

### Edge Cases

- What happens to the two provisional ports the library domain already defined ahead
  of this migration (`DiscogsConnectionPort` wrapping `getConnection`/
  `markInitialLibrarySync`, and `DiscogsCollectionPort` wrapping the seven collection
  operations) — each currently implemented by an adapter that still imports this
  domain's raw modules directly? This migration MUST consolidate those two provisional
  ports into this domain's real Discogs connection port and collection access port
  (extending or replacing the provisional shape as needed), not leave a second,
  parallel definition in place.
- What happens to the pending-token TTL (15 minutes, the Discogs verifier's validity
  window)? Whether it is modeled as part of the Discogs connection port's contract or
  as an application-layer rule evaluated against an injectable clock is decided during
  planning; either way, expiration MUST remain testable without a real 15-minute wait.
- What happens to `oauthSignature.ts`/`oauthHttpClient.ts` (OAuth 1.0a header
  construction and the axios client factory backing the handshake calls, no
  infrastructure dependency beyond building strings and instantiating that client)?
  Both are consumed by the Discogs connection port's adapter for the handshake, and
  `oauthSignature.ts` remains additionally consumed by the collection access port's
  adapter for request signing (it has no port of its own) — whether the two files stay
  where they are or move under one of the two adapters is decided during planning;
  either way, their own logic MUST NOT change.
- What happens to `disconnect`'s cache invalidation of the user's cached collection
  field map (today calling `invalidateCache` from the old cache module directly)? It
  MUST be repointed to the shared caching contract already established for the
  library and catalog domains, not left on the old module or given a second,
  parallel one.
- How does this migration confirm no existing test relies on a `jest.mock()` call
  keyed to a module's current file path? Every relocated file's tests MUST be checked
  for path-sensitive mocks before the move is considered complete, so a pure
  relocation cannot silently break a passing test.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All Discogs account-linking operations (start link — including the OAuth
  request-token handshake call, complete link — including the access-token exchange
  and identity lookup, read connection, read status, disconnect, mark initial library
  sync done) MUST go through a single Discogs connection port; no file implementing
  linking-flow business rules may import `firebase-admin` or `axios` directly.
- **FR-002**: The pending-link ownership and expiration rules (unknown/consumed token,
  ownership mismatch without deletion, expiration with deletion) MUST be preserved
  exactly and MUST be testable without a real Firestore instance and without a real
  15-minute wait.
- **FR-003**: All authenticated Discogs Collection API operations (field map, list all
  instances, list instances for a release, add release, delete instance, set rating,
  set field value) MUST go through a single collection access port; no file
  implementing collection business rules may import the OAuth-signed HTTP client
  directly.
- **FR-004**: The existing resilience behavior shared with the catalog domain
  (rate-limit smoothing, circuit breaker, retry-with-backoff) and this client's OAuth
  1.0a request signing MUST be preserved exactly, with their supporting modules
  relocated as-is rather than redesigned.
- **FR-005**: The two provisional ports the library domain already defined ahead of
  this migration MUST be consolidated onto this domain's real ports — no second,
  parallel port definition may remain for the same capability.
- **FR-006**: The cache invalidation performed on disconnect MUST depend on the shared
  caching contract already established for the library and catalog domains, not on
  the old cache module or a new, independently-defined one.
- **FR-007**: The OAuth HTTP routes MUST remain the only place that translates
  linking-flow domain errors into HTTP status codes and payloads, generalizing the
  existing domain-error pattern already used elsewhere in the backend, while
  delegating all business orchestration to application-level use cases.
- **FR-008**: Every existing OAuth- and collection-domain test (unit, integration, and
  contract) MUST continue to pass with unchanged assertions after being relocated
  alongside the migrated code — this migration MUST NOT change observable behavior.
- **FR-009**: The migrated code MUST follow the layer and folder convention already
  fixed for the backend (Domain, Application, Ports, Adapters, one subfolder per
  business domain) rather than introducing a domain-specific variant.
- **FR-010**: No public API contract for the OAuth endpoints MUST change as a result of
  this migration.
- **FR-011**: Every call site outside this domain that today depends on this domain's
  raw modules (the library domain's two provisional adapters, and any other remaining
  direct import) MUST be repointed to this domain's new ports as part of this
  migration, without changing that call site's own business logic.

### Key Entities *(include if feature involves data)*

- **Pending Link Request**: A short-lived record (15-minute validity window) created
  when a user starts linking their Discogs account, holding the request-token secret
  needed to complete the OAuth 1.0a handshake. Deleted on successful completion, on
  expiration, or left untouched on an ownership mismatch.
- **Discogs Connection**: A user's linked Discogs account — username, user ID, access
  token/secret, link timestamp, and optionally the timestamp of their first completed
  library sync. Read and written only through the Discogs connection port.
- **Collection Instance**: A single copy of a release in a user's Discogs collection
  (folder, condition fields, rating), read and mutated only through the collection
  access port.
- **Discogs Connection Port**: The contract through which linking-flow business logic
  reads and writes pending link requests and connections, and performs the OAuth
  handshake (request-token, access-token exchange, identity lookup) with Discogs —
  independent of the concrete Firestore implementation and the concrete HTTP client
  used for the handshake.
- **Collection Access Port**: The contract through which collection business logic
  reads and mutates a user's Discogs collection, independent of the concrete
  OAuth-signed HTTP client and resilience mechanism.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing OAuth- and collection-domain test files (unit,
  integration, and contract) pass from their reorganized location with zero changes to
  their assertions.
- **SC-002**: Zero files implementing linking-flow or collection business rules import
  `firebase-admin` or the OAuth-signed HTTP client directly — all such access is
  verifiably routed through the two new ports.
- **SC-003**: Linking-flow rules (including expiration) and collection-access rules can
  each be exercised in a test with no real Firestore instance, no real network call,
  and no real wall-clock wait.
- **SC-004**: Zero remaining call sites in the backend depend on this domain's
  pre-migration raw modules (`discogs/oauth/discogsOauthService`,
  `discogs/collection/collectionClient`) — every dependent, including the library
  domain's two provisional adapters, consumes this domain's real ports.
- **SC-005**: The externally observable behavior of every OAuth HTTP endpoint
  (request/response pairs, status codes, error payloads) is unchanged, and no
  published API contract for this domain changes.

## Assumptions

- This story cannot start before the layer/folder convention (Historia 1) and the
  shared caching contract (Historia 2) are merged — both are treated as given inputs
  here, not redefined. It also assumes Historia 2's two provisional ports
  (`DiscogsConnectionPort`, `DiscogsCollectionPort`) and their adapters, already
  present in the library domain today, as the starting shape to consolidate — not a
  clean slate.
- The pending-link TTL and expiration check are treated as an existing business rule
  to preserve exactly, not to redesign; only its testability (via an injectable clock)
  is expected to change.
- This migration is purely structural: no business rule, API contract, or
  user-observable behavior changes as a result of it — only the location of code, the
  way it depends on infrastructure, and how already-migrated domains reach it.
- This story is scoped to the Discogs OAuth linking flow
  (`discogs/oauth/discogsOauthService.ts`, `oauthHttpClient.ts`, `oauthSignature.ts`,
  `types.ts`, `routes/discogsOauth.ts`) and the authenticated Collection API client
  (`discogs/collection/collectionClient.ts`, `collectionTypes.ts`,
  `conditionGrading.ts`), plus the minimal import-path fixes needed in the library
  domain's two provisional adapters and their tests; the feeds and auth/users domains
  are migrated in separate, later stories and are out of scope here.
