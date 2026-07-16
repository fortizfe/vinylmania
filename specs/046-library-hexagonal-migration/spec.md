# Feature Specification: Library Domain Migrated to Hexagonal Architecture

**Feature Branch**: `046-library-hexagonal-migration`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Implementa la historia 2 de @.hu/backend-hexagonal-architecture-refactor.md — Como desarrollador del backend, quiero que toda la lógica de negocio de la librería del usuario (`library/*`, `routes/library.ts`) deje de depender directamente de `firebase-admin`, de `discogs/collection/collectionClient` y de la caché, y pase a depender solo de puertos, para poder testear esa lógica sin infraestructura real y para que sea el primer dominio que demuestra en código real la convención fijada en la Historia 1 (Principle VIII de la constitution, ya ratificado)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Library persistence isolated behind a port (Priority: P1)

As a backend developer, I want every read/write of a user's library entries to go
through a persistence port instead of calling the Firestore SDK directly, so that I
can write and run unit tests for library CRUD rules without a real Firestore
connection.

**Why this priority**: This is the most coupled and highest-traffic piece of the
library domain today — library entry CRUD is on the critical path for every
collector interaction with their collection, and it is currently the most direct,
unmediated dependency on infrastructure in this domain.

**Independent Test**: Can be fully tested by writing a unit test for library CRUD
logic that supplies a fake/in-memory implementation of the persistence port instead
of a real Firestore client, and confirming the business rules (create, read, update,
delete, list/filter) behave correctly with no network or database dependency.

**Acceptance Scenarios**:

1. **Given** a request to create a library entry, **When** the create operation
   runs, **Then** it persists the entry through the persistence port only — no file
   implementing library business rules calls the Firestore SDK directly.
2. **Given** a request to list or filter library entries, **When** the query runs,
   **Then** the filtering/listing rules execute against data returned by the
   persistence port, independent of which storage technology backs it.
3. **Given** the persistence port is swapped for a test double, **When** the
   existing library CRUD test suite runs, **Then** all tests pass with unchanged
   assertions and without any real database connection.

---

### User Story 2 - Library sync/reconciliation logic isolated from external SDKs (Priority: P1)

As a backend developer, I want the library synchronization logic (union-merge on
first sync, mirror mode afterward) to depend only on ports for reading the user's
Discogs collection, resolving their Discogs connection, and caching sync state — not
on the concrete Discogs Collection client, the Discogs OAuth service, or the Redis
client — so that reconciliation rules can be verified in tests without any real
external service.

**Why this priority**: `librarySyncService` is the largest and most-coupled file in
the domain today, combining three different infrastructure dependencies with the
core reconciliation business rules in the same module. Isolating it delivers the
biggest testability and maintainability gain in this migration.

**Independent Test**: Can be fully tested by running the reconciliation logic
(`syncLibrary` and its supporting rules) against fake implementations of the
collection-access port, the connection port, and the cache port, and confirming the
union-merge and mirror-mode behaviors produce identical results to today's suite —
with no real Discogs API call and no real Redis instance involved.

**Acceptance Scenarios**:

1. **Given** a user's first sync, **When** reconciliation runs, **Then** it merges
   the remote collection with any existing local entries using the current
   union-merge rule, sourcing collection data exclusively through a port.
2. **Given** a user's subsequent sync, **When** reconciliation runs, **Then** it
   mirrors the remote collection using the current mirror-mode rule, again sourcing
   collection data and connection state exclusively through ports.
3. **Given** the cache backing the sync marker is unavailable, **When** a sync is
   requested, **Then** the operation still completes (fail-soft), matching today's
   behavior exactly, with the degraded-cache case exercised through a test double of
   the cache port.
4. **Given** the reorganized sync test suite, **When** it runs from its new
   location, **Then** every existing assertion continues to pass unchanged.

---

### User Story 3 - HTTP layer delegates orchestration to application logic (Priority: P2)

As a backend developer, I want the library HTTP routes to be limited to parsing and
validating requests, invoking application-level use cases, and translating domain
errors into HTTP responses — with no business orchestration inlined in the route
handlers — so the route layer stays a thin, consistent translation boundary as
already required for every backend domain.

**Why this priority**: This depends on User Stories 1 and 2 existing first (there
must be use cases to delegate to), and it is lower risk than the persistence/sync
work since it changes control flow, not data access.

**Independent Test**: Can be fully tested by confirming each library route handler's
body contains only request parsing/validation, a single call into an application use
case, and error-to-HTTP-status mapping — with the existing contract test suite for
the library HTTP endpoints passing unchanged, proving observable behavior is
identical from the caller's perspective.

**Acceptance Scenarios**:

1. **Given** a request to create a library entry (lookup release → create entry →
   read field map → build response), **When** the route handles it, **Then** that
   entire sequence is delegated to a single application use case invocation, not
   orchestrated inline in the route.
2. **Given** a domain error is thrown by a use case (e.g. entry not found, field not
   editable), **When** the route catches it, **Then** the existing error-to-HTTP
   mapping pattern (as used today) still produces the same status codes and error
   payloads as before the migration.
3. **Given** the existing library contract and integration test suites, **When**
   they run against the migrated routes, **Then** every request/response pair
   remains identical to today's behavior.

---

### Edge Cases

- What happens to the condition-grading constants and legacy-condition mapping
  (media/sleeve condition values, legacy-condition normalization), which have no
  infrastructure dependency today? They MUST continue to be reachable from the
  domain layer without modification to their behavior.
- What happens to the sync marker's fail-soft degradation (sync proceeds even when
  the cache client is unavailable)? The caching port MUST preserve this exact
  degradation behavior, not just relocate the existing calls.
- What happens when library entry data is read from storage but the same shape is
  also used to build the HTTP response (some fields are excluded before responding)?
  The migration MUST NOT change which fields end up in the HTTP response, regardless
  of how the internal/response shapes are organized.
- How does the migration confirm no existing test relies on a `jest.mock()` call
  keyed to a module's current file path? Every relocated file's tests MUST be
  checked for path-sensitive mocks before the move is considered complete, so a pure
  relocation cannot silently break a passing test.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All access to Firestore for library entries MUST go through a single
  persistence port; no file implementing library business rules may import the
  Firestore SDK directly.
- **FR-002**: The library reconciliation/sync logic (union-merge on first sync,
  mirror mode afterward, and its supporting rules) MUST depend only on ports for
  reading the remote collection, resolving the user's Discogs connection, and
  caching — never on the concrete Discogs Collection client, Discogs OAuth service,
  or Redis client.
- **FR-003**: The library HTTP routes MUST remain the only place that translates
  library domain errors into HTTP status codes and payloads, generalizing the
  existing domain-error pattern already used elsewhere in the backend, while
  delegating all business orchestration to application-level use cases.
- **FR-004**: Every existing library-domain test (unit, integration, and contract)
  MUST continue to pass with unchanged assertions after being relocated alongside
  the migrated code — this migration MUST NOT change observable behavior.
- **FR-005**: The migrated library code MUST follow the layer and folder convention
  already fixed for the backend (Domain, Application, Ports, Adapters, one subfolder
  per business domain) rather than introducing a domain-specific variant.
- **FR-006**: The cache-backed sync marker MUST preserve its current fail-soft
  behavior (a sync still completes when the cache is unavailable) exactly, as
  exercised through the new caching port rather than reimplemented.
- **FR-007**: The reconciliation business rules themselves (union-merge on first
  sync, mirror mode afterward) MUST NOT change as part of this migration — this is a
  structural refactor, not a behavior change.
- **FR-008**: No public API contract for the library or library-sync endpoints MUST
  change as a result of this migration.

### Key Entities *(include if feature involves data)*

- **Library Entry**: A user's record of an owned release (Discogs-sourced metadata
  plus collector-specific state such as condition and notes). Its persisted shape
  and its HTTP-facing shape MUST continue to produce identical externally observable
  data after migration.
- **Sync Marker**: Tracks freshness of a user's last library synchronization,
  degrading gracefully when its backing cache is unavailable.
- **Library Persistence Port**: The contract through which library business logic
  reads and writes library entries, independent of the concrete storage technology.
- **Discogs Collection Access Port**: The contract through which sync/reconciliation
  logic reads a user's remote Discogs collection, independent of the concrete HTTP
  client and authentication mechanism.
- **Discogs Connection Port**: The contract through which sync/reconciliation logic
  resolves a user's linked Discogs account and records first-sync completion,
  independent of the concrete persistence mechanism.
- **Caching Port**: The shared, fail-soft contract through which any library logic
  reads/writes cached state, independent of the concrete cache backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing library-domain test files (unit, integration, and
  contract) pass from their reorganized location with zero changes to their
  assertions.
- **SC-002**: Zero files implementing library business rules import the Firestore
  SDK, the Discogs Collection HTTP client, or the Redis client directly — all such
  access is verifiably routed through a port.
- **SC-003**: Library CRUD rules and sync/reconciliation rules can each be exercised
  in a test with no real database connection, no real external API call, and no real
  cache instance.
- **SC-004**: The externally observable behavior of every library HTTP endpoint
  (request/response pairs, status codes, error payloads) is unchanged, and no
  published API contract for the library domain changes.

## Assumptions

- This story cannot start before the layer/folder convention and dependency rule
  from the prior story (Hexagonal Architecture ratified as a Core Principle) is
  merged — that convention is treated as a given input here, not redefined.
- The internal library-entry shape and the HTTP-facing response shape are assumed to
  remain a single, unified representation for this migration (with fields excluded
  before responding, as today) rather than being split into two separate
  representations; a future story may revisit this if needed.
- This migration is purely structural: no business rule, API contract, or
  user-observable behavior changes as a result of it — only the location of code and
  the way it depends on infrastructure.
- This story is scoped to the library domain only (`library/*`, `routes/library.ts`
  and their tests); the Discogs catalog, Discogs OAuth/Collection client internals,
  feeds, and auth/users domains are migrated in separate, later stories and are out
  of scope here.
