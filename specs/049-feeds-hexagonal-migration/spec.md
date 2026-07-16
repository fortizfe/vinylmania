# Feature Specification: Feeds/RSS Domain Migrated to Hexagonal Architecture

**Feature Branch**: `backend-hexagonal-architecture-refactor`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Historia 5 de @.hu/backend-hexagonal-architecture-refactor.md — Como desarrollador del backend, quiero que `feeds/feedAggregator.ts` y `routes/feeds.ts` dejen de depender directamente de `feeds/feedClient.ts` (que usa `axios` y `rss-parser` directamente) y de la caché concreta, para aislar la lógica de agregación (agrupar por categoría, degradar por fuente fallida) de la obtención real de cada feed."

## Clarifications

### Session 2026-07-16

- Q: `feedMapper.ts`'s `mapFeedItem` currently takes `Parser.Item` — a named type
  imported from the `rss-parser` package — as input, and `feedClient.fetchFeed`
  returns `Parser.Output<...>`, the same package's type. Should the mapping logic
  stay coupled to `rss-parser`'s own types, move into the adapter layer entirely, or
  be decoupled via a domain-owned intermediate type? → C: Introduce a domain-owned
  "raw feed item" type; the feed source port's adapter converts each `Parser.Item`/
  `Parser.Output` into it at the boundary; `mapFeedItem` stays domain-level and pure,
  consuming the domain type instead of `rss-parser`'s type — mirroring the catalog
  domain's precedent (`discogsMapper.ts` operates on `unknown`/Zod-validated data,
  never a named `axios` type).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dashboard aggregation rules isolated behind a feed source port (Priority: P1)

As a backend developer, I want the RSS dashboard aggregation rules (fetching every
enabled source, grouping surviving articles by category, capping articles per
category, degrading individually per failed source, building the single-source
response) to depend on a feed source port and the shared caching contract instead of
calling the raw HTTP/RSS-parsing client and the concrete cache implementation
directly, so that aggregation and degradation logic is testable without a real network
call and without a real cache.

**Why this priority**: This is the only domain-relevant business logic in this
feature — grouping by category and degrading per failed source are the rules that
must survive the migration unchanged; everything else (the raw fetch, the HTTP
routes) exists to serve this logic.

**Independent Test**: Can be fully tested by running `getDashboard`/`getSourceArticles`
against a fake feed source port and a fake cache, and confirming category grouping,
the per-category article cap, and per-source degradation (one source failing does not
affect the others) each behave correctly without a real network call or a real cache
instance.

**Acceptance Scenarios**:

1. **Given** several enabled feed sources with articles across categories, **When**
   the dashboard is requested, **Then** articles are grouped by category, each
   category is capped at its existing article limit, and the aggregation logic never
   calls the feed source port's adapter or the cache adapter directly — only their
   ports.
2. **Given** one enabled source's fetch fails while the others succeed, **When** the
   dashboard is requested, **Then** the failing source is reported as unavailable, the
   successful sources' articles still appear in the response, and no error propagates
   to the caller.
3. **Given** a single source requested directly by id, **When** it fails, **Then** the
   response reports that source as unavailable with an empty article list rather than
   raising an error; **When** the id does not match an enabled source, **Then** the
   caller receives a not-found signal.
4. **Given** the feed source port and the shared cache port both swapped for test
   doubles, **When** the existing feed-aggregation test suite runs, **Then** all tests
   pass with unchanged assertions and without any real network dependency or real
   cache instance.

---

### User Story 2 - Raw feed retrieval isolated behind an adapter (Priority: P1)

As a backend developer, I want the raw per-source feed retrieval (HTTP fetch plus
RSS/Atom parsing, bounded by a per-source timeout) to be implemented as a single
adapter behind a feed source port, so that swapping or stubbing feed retrieval never
requires touching aggregation logic.

**Why this priority**: The aggregation logic (User Story 1) cannot be migrated to
depend on a port until that port and its adapter exist — this is the direct
prerequisite, but it carries no business rules of its own, which is why it ranks
alongside rather than above Story 1.

**Independent Test**: Can be fully tested by stubbing the outbound HTTP call the
adapter depends on and confirming it parses RSS/Atom items correctly and enforces its
per-source timeout, with the existing feed-client test suite passing against the
relocated adapter — with its assertions unchanged except for the one return-shape
update FR-012's port-return-type change requires (asserting against the returned array
directly instead of the parsing library's `{ items: [...] }` wrapper).

**Acceptance Scenarios**:

1. **Given** a feed URL and an optional per-source timeout, **When** the port's fetch
   operation is invoked, **Then** it returns the parsed feed items exactly as today,
   with the same default and per-source timeout behavior.
2. **Given** the adapter is the only file in this domain that imports the HTTP/RSS
   parsing libraries directly, **When** the migration completes, **Then** no other
   file implementing aggregation or routing logic imports them.
3. **Given** a raw parsed feed from the underlying RSS/Atom parsing library, **When**
   the adapter returns it through the port, **Then** it is translated into a
   domain-owned raw feed item shape at the adapter boundary, so no file outside the
   adapter references the parsing library's own types.

---

### User Story 3 - HTTP layer depends on application-level use cases, not the old module (Priority: P2)

As a backend developer, I want the feeds HTTP routes to keep translating aggregation
outcomes into responses while delegating all orchestration to application-level use
cases built on the new ports, so that the routes contain no business logic of their
own and the migration leaves no lingering direct dependency on this domain's
pre-migration internals.

**Why this priority**: This depends on Stories 1 and 2 existing first (there must be
real ports and use cases to call), and closing this gap is what makes the domain's
migration actually complete rather than leaving the routes calling the old module
directly.

**Independent Test**: Can be fully tested by confirming the feeds route handlers'
bodies contain only request parsing, a call into the corresponding application use
case, and response/error mapping, with the existing feeds contract and integration
test suites passing unchanged.

**Acceptance Scenarios**:

1. **Given** a dashboard request or a single-source request, **When** the route
   handles it, **Then** invoking the corresponding application use case is its only
   business-relevant responsibility, and the existing success/error response shapes
   (200 payloads, 404 for an unknown source, 500 for an unexpected error) remain
   unchanged.
2. **Given** the existing feeds unit, contract, and integration test suites, **When**
   they run against the migrated code, **Then** every request/response pair and every
   assertion remains identical to today's behavior.

---

### Edge Cases

- What happens to each source's independent fetch timeout (`DEFAULT_TIMEOUT_MS`
  today — a single shared default, not a per-source configurable value)? The feed
  source port MUST preserve each call's timeout enforcement as independent and
  isolated per source — centralizing it in a way that couples one source's timeout to
  another's would break the per-source isolation the constitution's Observability
  principle already requires for this feature area.
- What happens to the static feed source catalog (`feedSources.ts`, no infrastructure
  dependency)? It MUST remain as domain-level configuration, relocated as-is under
  the new layer convention, without needing a port or adapter of its own.
- What happens to the article-mapping/sanitization logic (`feedMapper.ts`)? Its
  business rules (excerpt length, image extraction, text sanitization) MUST remain
  domain-level and pure, but its input type MUST be decoupled from the RSS/Atom
  parsing library — the feed source port's adapter MUST translate each raw parsed
  item into a domain-owned raw feed item shape before the mapper ever sees it
  (resolved: see Clarifications).
- What happens to the per-source cache keys currently built inline in the aggregation
  logic? They MUST continue to route through the shared caching contract already
  established for the library and catalog domains, not a new, independently-defined
  cache dependency.
- How does this migration confirm no existing test relies on a `jest.mock()` call
  keyed to a module's current file path? Every relocated file's tests MUST be checked
  for path-sensitive mocks before the move is considered complete, so a pure
  relocation cannot silently break a passing test.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All per-source feed retrieval (HTTP fetch plus RSS/Atom parsing) MUST be
  exposed through a single feed source port; no file implementing aggregation or
  routing logic may import the HTTP client or RSS-parsing library directly.
- **FR-002**: The dashboard aggregation rules (fetch every enabled source, group
  surviving articles by category, cap articles per category, mark each source's
  status, build the generated-at response) MUST depend only on the feed source port
  and the shared caching contract, never on their concrete implementations.
- **FR-003**: Per-source failure isolation MUST be preserved exactly: one source
  failing MUST NOT prevent other sources' articles from appearing in the dashboard
  response, and MUST be reported as an individual per-source status rather than a
  request-level error.
- **FR-004**: The single-source lookup (`getSourceArticles`) MUST preserve its
  existing behavior: an unknown or disabled source id yields a not-found signal to the
  caller, and a failing known source yields an unavailable status with an empty
  article list rather than an error.
- **FR-005**: Each source's fetch/timeout enforcement MUST stay independent and
  isolated per call, preserved exactly as it is today — no source's timeout MUST be
  centralized, shared, or allowed to block another source's own fetch. (No source
  carries a distinct timeout *value* today, nor is one introduced by this migration —
  every source shares the same default duration; what MUST be preserved is that each
  call's timeout is enforced and can fail independently of every other call.)
- **FR-006**: Per-source caching MUST depend on the shared caching contract already
  established for the library and catalog domains, not on the old cache module or a
  new, independently-defined one.
- **FR-007**: The feeds HTTP routes MUST remain the only place that maps aggregation
  outcomes to HTTP responses (200 payloads, 404 for an unknown source, 500 for an
  unexpected error), while delegating all orchestration to application-level use
  cases.
- **FR-008**: Every existing feeds-domain test (unit, integration, and contract) MUST
  continue to pass after being relocated alongside the migrated code, with unchanged
  assertions — except the one return-shape assertion update FR-012's port-return-type
  change requires in the relocated feed-client test — since this migration MUST NOT
  change observable behavior beyond that single, explicitly scoped-in internal
  contract change.
- **FR-009**: The migrated code MUST follow the layer and folder convention already
  fixed for the backend (Domain, Application, Ports, Adapters, one subfolder per
  business domain) rather than introducing a domain-specific variant.
- **FR-010**: No public API contract for the feeds endpoints MUST change as a result
  of this migration.
- **FR-011**: The static feed source catalog MUST be relocated without behavioral
  changes and without requiring a port or adapter, since it depends on no
  infrastructure.
- **FR-012**: The feed source port MUST return a domain-owned raw feed item shape,
  not a type belonging to the RSS/Atom parsing library; the adapter MUST perform this
  translation at the boundary, so the article-mapping/sanitization logic (and any
  other domain-level file) never references the parsing library's own types.

### Key Entities *(include if feature involves data)*

- **Feed Source Port**: The contract through which aggregation logic retrieves a
  single source's parsed articles, independent of the concrete HTTP client and
  RSS/Atom parsing library used to fetch and parse it; it returns domain-owned raw
  feed items (see below), never a type belonging to the parsing library.
- **Raw Feed Item**: A domain-owned shape (title, link, publication date, content/
  summary, optional enclosure/image reference) produced by the feed source port's
  adapter from the parsing library's own output, so the domain-level mapping logic
  never depends on that library's types.
- **Feed Source Configuration**: The static, per-source catalog entry (id, name, feed
  URL, category, enabled flag, priority) that drives which sources are aggregated and
  how they are displayed — domain-level data with no infrastructure dependency.
- **Article**: A single mapped, sanitized feed item (title, excerpt, image, published
  date, link, source, category) produced from a raw parsed feed item by the
  domain-level mapping logic.
- **Dashboard Response**: The aggregation logic's output — articles grouped by
  category (capped per category) plus one status entry per enabled source, built
  through the feed source port and the shared caching contract only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing feeds-domain test files (unit, integration, and
  contract) pass from their reorganized location, with zero changes to their
  assertions except the one return-shape update FR-012 requires in the relocated
  feed-client test.
- **SC-002**: Zero files implementing aggregation or routing logic import the HTTP
  client or RSS-parsing library directly — all per-source retrieval is verifiably
  routed through the feed source port.
- **SC-003**: Dashboard aggregation logic (category grouping, per-category cap,
  per-source degradation) can be exercised in a test with no real network call and no
  real cache instance.
- **SC-004**: Zero remaining call sites in the backend depend on this domain's
  pre-migration raw module (`feeds/feedClient`) directly.
- **SC-005**: The externally observable behavior of every feeds HTTP endpoint
  (request/response pairs, status codes, error payloads, per-source timeout
  isolation) is unchanged, and no published API contract for this domain changes.

## Assumptions

- This story cannot start before the layer/folder convention (Historia 1) and the
  shared caching contract (Historia 2) are merged — both are treated as given inputs
  here, not redefined.
- This migration is purely structural: no business rule, API contract, or
  user-observable behavior changes as a result of it — only the location of code and
  the way it depends on infrastructure.
- This story is scoped to `feeds/feedClient.ts`, `feeds/feedAggregator.ts`,
  `feeds/feedMapper.ts`, `feeds/feedSources.ts`, `feeds/types.ts`, and
  `routes/feeds.ts`; the auth/users domain and the final `CachePort` consolidation
  are migrated in a separate, later story (Historia 6) and are out of scope here.
- This domain has no Firestore dependency (verified: no file under `feeds/` imports
  `firebase-admin`), so this story introduces no persistence port — only the feed
  source port and the already-established caching contract.
