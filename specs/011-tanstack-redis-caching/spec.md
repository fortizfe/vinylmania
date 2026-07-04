# Feature Specification: Application Caching (Frontend State & Backend Responses)

**Feature Branch**: `[011-tanstack-redis-caching]`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "quiero implementar sistemas de cache tanto de estado en frontend como de respuestas en backend. Me gustaría reducir los tiempos de respuesta y el consumo de datos innecesario de la aplicación en general. 1. Para frontend me gustaría implementar el sistema de cache de estado de react usando la librería TanStack Query. Intenta mantener todo lo más estandarizado posible. 2. Para backend me gustaría implementar el sistema de cache de respuestas usando Redis + ioredis. También intenta mantenerlo todo lo más estandarizado posible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant reloads of already-seen data (Priority: P1)

As a collector browsing my vinyl library, when I navigate back to a screen I already visited in this session (my library list, a record's detail page, a search I already ran), I want the data to appear immediately instead of showing a loading state again, while the app quietly checks in the background whether anything changed.

**Why this priority**: This is the core, user-visible payoff of the whole effort — perceived speed. Without it, the feature delivers no value even if backend infrastructure is in place.

**Independent Test**: Open the library list, navigate to a record detail page, go back to the library list. The library list must render instantly from previously-fetched data with no visible loading skeleton, while the app may silently refresh it in the background.

**Acceptance Scenarios**:

1. **Given** a user has already loaded their vinyl library list once in the current session, **When** they navigate away and back to the library list, **Then** the previously-fetched data is displayed immediately without a loading skeleton.
2. **Given** a user has already opened a specific record's detail page in the current session, **When** they navigate away and return to that same record, **Then** the record's details render immediately from cached data.
3. **Given** cached data is older than its freshness window, **When** the user revisits the screen, **Then** the app shows the last-known data immediately and updates it in place if a background refresh returns different data.

---

### User Story 2 - Fewer repeated calls to slow external catalog lookups (Priority: P2)

As a collector searching for records or viewing catalog details sourced from Discogs, I want the application to avoid re-fetching identical catalog information it already retrieved recently (for me or for other users), so that searches and lookups feel fast and the app doesn't hit external rate limits unnecessarily.

**Why this priority**: This addresses server-side response time and the app's exposure to slow/rate-limited external dependencies (per the project's reliance on the Discogs API), which is the second half of the stated goal (reduce response times, reduce unnecessary data consumption).

**Independent Test**: Perform the same catalog search or open the same release twice within the cache's freshness window (from the same or a different user session). The second request must complete noticeably faster and must not re-issue an identical outbound call to the external catalog source.

**Acceptance Scenarios**:

1. **Given** a catalog search has already been performed recently, **When** the same search is repeated (by the same or another user) within the cache's freshness window, **Then** the response is served without re-querying the external catalog source and completes noticeably faster.
2. **Given** a specific release's details have already been fetched recently, **When** any user requests that same release again within the freshness window, **Then** the cached response is returned instead of issuing a new external lookup.
3. **Given** the external catalog source is slow or temporarily rate-limiting requests, **When** the requested data is already cached, **Then** the user is unaffected and receives the cached response normally.

---

### User Story 3 - Never see stale data after making a change (Priority: P3)

As a collector who edits a record's details or updates my library, I want to see my own change reflected immediately everywhere it appears in the app, so that caching for speed never makes the app feel wrong or untrustworthy.

**Why this priority**: Caching only delivers net value if it doesn't undermine data correctness. This is lower priority than P1/P2 only because it is a safeguard on top of the caching behavior those stories introduce, not a standalone capability.

**Independent Test**: Edit a field on a record's detail page, then navigate to any other screen that displays that same field (e.g., the library list) and confirm the updated value is shown, not a stale cached one.

**Acceptance Scenarios**:

1. **Given** a user edits a record's information, **When** the edit is saved successfully, **Then** every screen in the app that subsequently displays that record shows the updated value, not a previously cached one.
2. **Given** a user adds or removes a record from their library, **When** they view their library list afterward, **Then** the list reflects the change without requiring a manual page refresh.

### Edge Cases

- What happens when the backend caching layer is temporarily unreachable or fails? The application MUST continue to serve requests by fetching data directly, without surfacing an error to the user.
- What happens when a user is offline or has an unstable connection? Previously cached data already loaded in the current session MUST remain viewable.
- What happens when two browser tabs for the same user are open and one changes data? The tab where the change did not occur MAY continue showing older data until its own next background refresh or manual reload — it is not required to update live via a push mechanism.
- What happens when cached data (frontend or backend) is never revisited? It MUST eventually expire/be evicted rather than being retained indefinitely.
- What happens when a request contains user-specific or write-scoped data (e.g., personal library contents, notes)? This data MUST NOT be served from a cache shared across different users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST retain previously-fetched read data in a client-side cache for the duration of the user's session so that revisiting a screen does not require re-fetching data that is still fresh.
- **FR-002**: The frontend MUST display previously cached data immediately upon revisiting a screen, and MAY silently refresh it in the background rather than blocking the view with a loading state.
- **FR-003**: The frontend MUST show a loading state only when no cached data exists yet for the requested screen (first-ever load, or after cache eviction).
- **FR-004**: The frontend MUST invalidate or refresh its cached copy of any data the user just modified (created, edited, or deleted) so the change is reflected immediately across all screens that display it.
- **FR-005**: The backend MUST cache responses for externally-sourced, slow-changing catalog data (Discogs lookups and searches) so that identical requests made within the cache's freshness window are served without repeating the external call.
- **FR-006**: The backend MUST NOT cache user-specific or write-scoped data (e.g., a user's personal library entries, notes, ownership state) in a cache shared across users.
- **FR-007**: All cached entries (frontend and backend) MUST have a maximum age after which they are treated as stale and eligible for a background refresh or eviction.
- **FR-008**: The backend MUST continue to serve requests by fetching data directly from its original source if the caching layer is unavailable, without returning an error to the caller solely because the cache is down.
- **FR-009**: The system MUST expose enough operational visibility (e.g., logged cache hit/miss events) to verify that caching is reducing redundant external calls, consistent with the project's existing observability practices.
- **FR-010**: Caching behavior introduced by this feature MUST NOT change the correctness of any existing user-facing data — cached responses MUST be identical in shape and content to their non-cached equivalents.

### Key Entities

- **Client Query Cache Entry**: A unit of frontend-cached read data tied to a specific request (e.g., "this user's library", "this record's details"), holding the last-known data, when it was fetched, and whether it is still considered fresh.
- **Cached Catalog Response**: A unit of backend-cached data representing a previously-fetched external catalog lookup or search result, holding the response payload and an expiration point after which it must be re-fetched from the source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of revisits to a screen already loaded earlier in the same session render with no visible loading state.
- **SC-002**: The number of duplicate outbound calls to the external catalog source for identical, repeated lookups is reduced by at least 60% compared to current behavior.
- **SC-003**: Average time-to-display for data that was already fetched recently (by the same or another user) is reduced by at least 50% compared to an uncached request.
- **SC-004**: 100% of user-initiated edits are reflected correctly on the next view of the affected data, with no observed stale-data regressions.
- **SC-005**: If the caching layer becomes unavailable, the application continues to serve all read requests successfully (falling back to direct fetches), with 0% of requests failing solely due to the cache being down.

## Assumptions

- Per explicit stakeholder direction, the frontend state/query caching layer will be built on **TanStack Query**, and the backend response-caching layer will be built on **Redis** (accessed via **ioredis**), each configured following that library's standard, widely-used conventions rather than a custom-built alternative.
- Backend response caching applies to externally-sourced, largely read-only catalog data (Discogs releases, searches, artist/label lookups) since this is the data explicitly identified as slow/rate-limited and safe to share across users. User-owned data stored in the app's own database (library entries, ownership, notes) is excluded from shared backend caching per FR-006, though it may still benefit from frontend-side caching per FR-001–FR-004.
- "Freshness window" (cache TTL) values are an implementation decision to be made during planning, using standard defaults for each layer (e.g., minutes-to-hours for frontend query staleness, hours for backend catalog caching) rather than a business-specified number, since no specific duration was requested and none is critical to correctness given the invalidation-on-write behavior in FR-004.
- Real-time cross-tab or cross-device live updates (e.g., via websockets/push) are out of scope; "no stale data after an edit" (User Story 3) is guaranteed only for the session/tab that performed the edit and for subsequent fresh loads elsewhere.
- This feature covers the caching infrastructure and its application to existing read flows (library listing, record details, catalog search/lookups); it does not introduce new user-facing features or change any existing data or UI beyond loading-state behavior.
