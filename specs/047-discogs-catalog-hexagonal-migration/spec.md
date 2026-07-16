# Feature Specification: Discogs Catalog Domain Migrated to Hexagonal Architecture

**Feature Branch**: `047-discogs-catalog-hexagonal-migration`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Empieza con la historia 3 de @.hu/backend-hexagonal-architecture-refactor.md — Como desarrollador del backend, quiero que `discogs/discogsClient.ts` y `routes/discogs.ts` (búsqueda, release, artista, master, versiones de master) dejen de depender directamente de `axios` y de la caché concreta, pasando a depender de un `DiscogsCatalogPort`, reutilizando el `CachePort` ya definido en la Historia 2 en vez de crear uno nuevo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Catalog access isolated behind a port, reusing the shared caching contract (Priority: P1)

As a backend developer, I want every Discogs catalog lookup (release, artist, master,
master versions, search, and per-release community rating) to go through a catalog
access port instead of calling the HTTP client and the cache directly, and I want that
port's caching to reuse the caching contract already established for the library
domain rather than a second, parallel one, so that catalog-access rules can be tested
without a real network call and without duplicating what caching already means in
this backend.

**Why this priority**: The catalog client is the second-highest-traffic piece of the
backend (after library) and is currently the most direct, unmediated dependency on
both `axios` and the concrete cache implementation in this domain — every other
catalog capability (search, routes, cross-domain release lookups) sits on top of it.

**Independent Test**: Can be fully tested by stubbing the outbound HTTP calls (`nock`) and
the cache backend (`ioredis-mock`) that the catalog access port's own adapter depends on —
rather than a real Discogs API call and a real Redis instance — and confirming
release/artist/master/master-versions/rating lookups behave correctly. (These five lookups
have no separate application-layer rule of their own to isolate with an in-memory port
double; that isolation applies to the rating-enrichment rule instead — see User Story 2.)

**Acceptance Scenarios**:

1. **Given** a request for a release, artist, master, or master-versions page, **When**
   the lookup runs, **Then** it is served through the catalog access port only — no
   file implementing catalog business rules calls the HTTP client directly.
2. **Given** the existing resilience behavior (rate-limit smoothing, circuit breaker,
   retry-with-backoff, and the release-rating lookup's own fail-soft/short-timeout
   exception to that resilience policy), **When** the catalog client is migrated,
   **Then** that behavior is preserved exactly, reusing the existing resilience
   modules relocated as-is rather than redesigned.
3. **Given** the caching contract already established for another backend domain,
   **When** the catalog access port needs to cache a lookup, **Then** it depends on
   that same contract (extended if its current shape doesn't yet cover a read-through
   cache lookup, not duplicated with a second, parallel one).
4. **Given** the catalog access port swapped for a test double, **When** the existing
   catalog-client test suite runs, **Then** all tests pass with unchanged assertions
   and without any real network or cache dependency.

---

### User Story 2 - Search result rating enrichment isolated as an application-level rule (Priority: P1)

As a backend developer, I want the rule that enriches each catalog search result with
its community rating (looking up a master's main release when needed, degrading a
given result to "no rating" on any failure without failing the whole search) to live
as an explicit application-level rule depending on the catalog access port, instead of
being embedded inside the same function that performs the raw catalog search call, so
that this enrichment/degradation policy can be tested and reasoned about on its own.

**Why this priority**: This rule is a genuine business/product policy (every catalog
result should degrade gracefully to "no rating" rather than fail the search), not a
raw data-access concern — keeping it entangled with the HTTP call makes it impossible
to verify the degradation policy without also exercising the network layer.

**Independent Test**: Can be fully tested by running the search-with-rating-enrichment
rule against a fake catalog access port that returns raw search results and either
succeeds or fails a per-result rating lookup on demand, and confirming enrichment,
per-result degradation, and the concurrency bound on rating lookups all behave as
today — with no real Discogs API call involved.

**Acceptance Scenarios**:

1. **Given** a search whose results include releases and masters, **When** enrichment
   runs, **Then** each eligible result's community rating is looked up (a master's
   rating being that of its main release) through the catalog access port only.
2. **Given** a single result's rating lookup fails or exceeds its lookup budget,
   **When** enrichment runs, **Then** that one result is returned without a rating and
   every other result in the same search is unaffected — the search as a whole never
   fails because of a rating lookup.
3. **Given** the existing bound on how many rating lookups may run concurrently for one
   search, **When** enrichment is migrated, **Then** that same bound is preserved
   exactly.

---

### User Story 3 - HTTP layer delegates orchestration to application logic (Priority: P2)

As a backend developer, I want the Discogs catalog HTTP routes to be limited to
parsing and validating requests, invoking application-level use cases, and
translating domain errors into HTTP responses — with no direct calls to the HTTP
client or the resilience modules, and no business rule inlined in the route handlers
— so the route layer stays a thin, consistent translation boundary as already
required for every backend domain.

**Why this priority**: This depends on User Stories 1 and 2 existing first (there
must be use cases to delegate to), and it is lower risk than the access/enrichment
work since it changes control flow, not data access.

**Independent Test**: Can be fully tested by confirming each catalog route handler's
body contains only request parsing/validation, a single call into an application use
case, and error-to-HTTP-status mapping — with the existing contract test suites for
the catalog HTTP endpoints (search, release, master, master versions) passing
unchanged, proving observable behavior is identical from the caller's perspective.

**Acceptance Scenarios**:

1. **Given** a search request, **When** the route handles it, **Then** parsing the
   query/filter parameters and invoking the search-with-enrichment use case are the
   route's only responsibilities — no direct call to the catalog access port or the
   HTTP client.
2. **Given** a domain error is thrown by a use case (not found, rate-limited,
   unavailable), **When** the route catches it, **Then** the existing error-to-HTTP
   mapping pattern (as used today, generalizing Historia 1's already-established
   pattern) still produces the same status codes and error payloads as before the
   migration.
3. **Given** the existing catalog contract and integration test suites, **When** they
   run against the migrated routes, **Then** every request/response pair remains
   identical to today's behavior, including the search response's existing
   "masters surface first" ordering.

---

### Edge Cases

- What happens to the release-rating lookup's explicit opt-out of the shared
  resilience policy (its own fail-soft behavior and short lookup budget, so a slow or
  failing rating never delays or fails a search)? That distinct behavior MUST be
  preserved exactly, without leaking the specific mechanism used to achieve it (an
  HTTP-client-specific implementation detail) outside the adapter that implements the
  catalog access port.
- What happens to the "masters surface first" ordering applied to search results
  after they come back from the catalog access port? Whether that ordering is
  presentation (stays in the HTTP adapter) or a business rule (moves to the
  application layer) is decided during planning; either way, the resulting response
  order MUST NOT change.
- How does this migration confirm no existing test relies on a `jest.mock()` call
  keyed to a module's current file path? Every relocated file's tests MUST be checked
  for path-sensitive mocks before the move is considered complete, so a pure
  relocation cannot silently break a passing test.
- What happens to the two application-level files in the library domain (already
  migrated in a prior story) that call this domain's release lookup directly, and to
  the one other domain's test file that does the same, ahead of that domain's own
  migration? Each of those existing call sites MUST be repointed to the release
  lookup's new location so nothing outside this domain silently breaks; their own
  business logic MUST NOT change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All Discogs catalog lookups (release, artist, master, master-version
  listing, and per-release community rating) MUST go through a single catalog access
  port; no file implementing catalog business rules may import the HTTP client
  directly.
- **FR-002**: The catalog access port's caching MUST depend on the same caching
  contract already established for the library domain — extended if needed to cover
  a read-through cache lookup, never duplicated as a second, independently-defined
  contract.
- **FR-003**: The existing resilience behavior (rate-limit smoothing, circuit
  breaker, retry-with-backoff, and the release-rating lookup's distinct fail-soft/
  short-timeout exception to that policy) MUST be preserved exactly, with its
  supporting modules relocated as-is rather than redesigned.
- **FR-004**: The rule that enriches search results with community ratings
  (per-result lookup, graceful per-result degradation on failure, a bounded number of
  concurrent lookups per search) MUST depend only on the catalog access port, never
  directly on the HTTP client, and MUST live outside the raw search lookup itself.
- **FR-005**: The catalog HTTP routes MUST remain the only place that translates
  catalog domain errors into HTTP status codes and payloads, generalizing the
  existing domain-error pattern already used elsewhere in the backend, while
  delegating all business orchestration to application-level use cases.
- **FR-006**: Every existing catalog-domain test (unit, integration, and contract)
  MUST continue to pass with unchanged assertions after being relocated alongside the
  migrated code — this migration MUST NOT change observable behavior.
- **FR-007**: The migrated catalog code MUST follow the layer and folder convention
  already fixed for the backend (Domain, Application, Ports, Adapters, one subfolder
  per business domain) rather than introducing a domain-specific variant.
- **FR-008**: No public API contract for the catalog endpoints MUST change as a
  result of this migration.
- **FR-009**: Any existing call site outside this domain that depends on the
  catalog's release lookup MUST be repointed to its new location as part of this
  migration, without changing that call site's own business logic.

### Key Entities *(include if feature involves data)*

- **Catalog Release / Artist / Master / Master Version**: Discogs-sourced catalog
  metadata, read-only from this backend's perspective. Shape and content are
  unchanged by this migration.
- **Community Rating**: A per-release aggregate rating sourced from Discogs, attached
  to eligible search results as an enrichment step rather than always fetched inline
  with the base catalog data.
- **Catalog Access Port**: The contract through which catalog business logic reads
  releases, artists, masters, master versions, and per-release ratings, independent
  of the concrete HTTP client and resilience mechanism.
- **Caching Contract**: The shared, already-established contract through which any
  backend domain's business logic reads/writes cached state, independent of the
  concrete cache backend — reused here, not redefined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing catalog-domain test files (unit, integration, and
  contract) pass from their reorganized location with zero changes to their
  assertions.
- **SC-002**: Zero files implementing catalog business rules import the HTTP client
  directly — all such access is verifiably routed through the catalog access port.
- **SC-003**: Catalog access rules and the rating-enrichment rule can each be
  exercised in a test with no real network call and no real cache instance.
- **SC-004**: The externally observable behavior of every catalog HTTP endpoint
  (request/response pairs, status codes, error payloads, including the existing
  search result ordering) is unchanged, and no published API contract for the catalog
  domain changes.
- **SC-005**: Exactly one caching contract exists across the two domains migrated so
  far (library and catalog) — no second, parallel definition is introduced.

## Assumptions

- This story cannot start before the layer/folder convention (prior story) and the
  library domain's caching contract (prior story) are merged — both are treated as
  given inputs here, not redefined.
- The caching contract established for the library domain today only covers a
  simple "check freshness / set with expiry" shape, not a read-through
  "fetch-and-cache" shape — this migration is expected to extend that contract with
  the missing capability rather than leave the catalog domain without one; the exact
  shape of that extension is a planning-phase decision.
- Splitting the search-rating-enrichment rule out of the raw catalog search lookup
  (User Story 2) is treated as a structural improvement consistent with generalizing
  the pattern already used for a similar case in the library domain, not a behavior
  change — the enrichment outcome for any given search is unchanged.
- This migration is purely structural: no business rule, API contract, or
  user-observable behavior changes as a result of it — only the location of code and
  the way it depends on infrastructure.
- This story is scoped to the Discogs catalog domain only (`discogs/discogsClient.ts`,
  its resilience/mapper/error modules, `routes/discogs.ts`, and their tests), plus the
  minimal import-path fixes needed in the library domain and its tests where they
  already depend on this domain's release lookup; the Discogs OAuth/Collection client,
  feeds, and auth/users domains are migrated in separate, later stories and are out of
  scope here.
