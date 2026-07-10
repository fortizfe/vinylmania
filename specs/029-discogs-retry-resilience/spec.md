# Feature Specification: Discogs Communication Resilience (Retry Policy)

**Feature Branch**: `029-discogs-retry-resilience`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Para el siguiente incremento quiero trabajar en mejorar la estabilidad de la comunicación con discogs. Actualmente, después de buscar y navegar al detalle de una master se obtiene muy a menudo el siguiente mensaje en el backend: {\"timestamp\":\"2026-07-10T14:18:33.687Z\",\"level\":\"warn\",\"route\":\"/api/discogs/masters/:discogsId/versions\",\"outcome\":\"unavailable\",\"uid\":\"QKvZuCkfoyMXYZ1S67H5aNULSbT2\",\"message\":\"The catalog service is busy right now — please try again shortly.\"}. Quiero investigar como reducir estas rozaduras para suavizar la navegación. Ya que tenemos cache implementada quizás una politica de reintentos en estas ocasiones podría ser una buena estrategia. Investiga y diseña como mejorar este aspecto de comunicación."

## Clarifications

### Session 2026-07-10

- Q: Should the retry policy also cover the background library-sync/enrichment path that reuses the same shared Discogs read functions, or stay scoped to the interactive browsing endpoints? → A: Extend it to the background library-sync/enrichment path too, since it reuses the exact same underlying calls.
- Q: Should the backoff schedule differentiate between a rate-limit (429) response and a generic unreachable/5xx failure, or apply one fixed schedule to both? → A: One fixed increasing-backoff schedule applies the same way regardless of which transient failure occurred.
- Q: Should this increment add app-wide protection (e.g. a circuit breaker) against retries amplifying load during a genuine, sustained outage, or is per-request bounded retry sufficient? → A: In scope — add a simple circuit breaker that pauses retries app-wide when recent failures spike.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse a master release without hitting a "busy" error (Priority: P1)

A collector searches the catalog, clicks a result, and opens a master release's detail page (including its list of versions). Today, this journey frequently fails with a "the catalog service is busy right now" message, forcing the collector to retry the click manually. With this feature, the same transient hiccup is absorbed automatically: the collector reaches the master detail page and its versions without seeing an error, because the system quietly retries the request behind the scenes before giving up.

**Why this priority**: This is the exact journey and error reported as the current pain point (search → master detail → versions), and it is the most frequently exercised catalog-browsing path in the app.

**Independent Test**: Simulate the catalog service returning a transient "busy"/rate-limited response on the first attempt for a master detail or versions request, then verify the user still sees the correct data load successfully, with no visible error, once the underlying transient condition clears within the retry window.

**Acceptance Scenarios**:

1. **Given** a collector opens a master release's detail page, **When** the first attempt to fetch data from the catalog service fails with a transient/busy response, **Then** the system retries automatically and the collector sees the master detail page load normally, with no error shown.
2. **Given** a collector is viewing a master release's paginated version list, **When** a transient/busy response occurs while fetching a page of versions, **Then** the system retries automatically and the version list loads normally.
3. **Given** the catalog service keeps failing with transient/busy responses beyond the system's retry allowance, **When** all retries are exhausted, **Then** the collector sees the existing friendly "temporarily unavailable, please try again" message (unchanged from today), not a raw error or a silent hang.
4. **Given** a request is already served from cache, **When** the collector opens the page, **Then** no retry behavior is triggered at all, since no live catalog call is made.

---

### User Story 2 - Search results stay resilient to the same transient hiccups (Priority: P2)

A collector runs a search and the results (including grouped master results and any community rating badges) load reliably even when the catalog service is momentarily overloaded, without the search itself taking noticeably longer on the common (successful first attempt) case.

**Why this priority**: Search is the entry point to browsing and is affected by the same underlying transient-failure pattern as master detail; extending the same resilience here compounds the benefit of User Story 1, but the reported pain point is specifically the detail/versions navigation, so this ranks below it.

**Independent Test**: Simulate a transient/busy response on the first attempt of a search request and verify results still load successfully without a visible error, while a search that succeeds on the first attempt shows no added delay.

**Acceptance Scenarios**:

1. **Given** a collector submits a search, **When** the first attempt to reach the catalog service fails with a transient/busy response, **Then** the system retries automatically and the collector sees search results load normally.
2. **Given** a collector submits a search that succeeds on the first attempt, **When** results are returned, **Then** the response is not delayed by any retry-related waiting.

---

### User Story 3 - Operators can see whether retries are actually helping (Priority: P3)

Someone monitoring the system's health can distinguish, from existing operational logs, between a catalog request that succeeded immediately, one that succeeded only after retrying, and one that ultimately failed after exhausting all retries — so the effectiveness of this change can be verified after release rather than inferred indirectly.

**Why this priority**: This is an observability nicety that supports validating and tuning the feature after launch; it delivers no direct end-user value on its own and depends on the retry behavior in User Story 1 already existing.

**Independent Test**: Trigger a request that fails transiently once and then succeeds, and verify the operational logs record that a retry occurred and that it ultimately succeeded, distinct from a plain first-try success and from a full exhaustion failure.

**Acceptance Scenarios**:

1. **Given** a catalog request succeeds only after one or more automatic retries, **When** the operation completes, **Then** the log entry for that request indicates a retry occurred before success.
2. **Given** a catalog request exhausts all automatic retries without succeeding, **When** the failure is surfaced to the user, **Then** the log entry indicates retries were attempted and exhausted, distinguishable from a request that failed on the very first attempt with a non-transient error (e.g. "not found").

---

### Edge Cases

- What happens when the catalog service is genuinely down for an extended period (not just momentarily busy)? The retry allowance still runs out and the collector sees today's "temporarily unavailable" message — this feature reduces how often that message appears, it does not guarantee it never appears.
- What happens when the failure is not transient (e.g. the requested master/release truly does not exist, a 404)? The system must not retry in this case — retrying a non-existent-resource error wastes time and delays the "not found" message the collector should see immediately.
- What happens when the failure is caused by invalid/expired credentials to the catalog service (an auth-type failure) rather than the service being busy? The system must not retry, since repeating the same request with the same bad credentials cannot succeed.
- What happens if the collector navigates away or cancels (e.g. clicks back) while a retry is still in progress? The in-flight retry sequence should not block or delay the new navigation; any eventual result is discarded.
- What happens when many collectors trigger the same catalog request at once during an outage (e.g. a popular master release)? The existing shared in-flight request handling (single-flight) already coalesces concurrent identical requests into one; retries must ride along the same shared attempt rather than each concurrent caller retrying independently and multiplying load on the catalog service.
- What happens on a cache hit? No retry logic is invoked at all — retries only ever apply to a live catalog call made on a cache miss.
- What happens when transient failures spike across many different catalog requests within a short window (a genuine outage, not an isolated blip)? The system stops issuing further retries app-wide until the catalog service shows signs of recovery, so retry attempts do not pile on top of an already-struggling service; affected requests fail fast to the existing "temporarily unavailable" message during that window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a live catalog request fails for a transient reason (the service reports it is busy/rate-limited, or is momentarily unreachable/erroring), the system MUST automatically retry that request a bounded number of times before treating it as a failure.
- **FR-002**: The system MUST NOT retry a catalog request when the failure is not transient — specifically: the requested item does not exist, the request was invalid, or the catalog service rejected the linked credentials. These MUST surface to the user immediately, exactly as they do today.
- **FR-003**: Each retry attempt MUST wait longer than the previous one (increasing backoff), using the same backoff schedule regardless of which transient condition triggered it (rate-limited/busy vs. unreachable/erroring), so that repeated automatic retries do not add further load to an already-busy catalog service.
- **FR-004**: The total time spent retrying a single request MUST be bounded, so a collector is never left waiting indefinitely for a page to load because of retries.
- **FR-005**: If every retry attempt for a request fails, the system MUST fall back to today's existing behavior: a friendly "temporarily unavailable, please try again" message, with no change to how that failure is currently presented.
- **FR-006**: Retrying MUST only occur for live catalog calls (cache misses); a response already served from cache MUST NOT trigger any retry logic.
- **FR-007**: When multiple concurrent requests for the same catalog data are already being coalesced into a single in-flight call, retries for that call MUST happen once for the whole shared group, not once per waiting caller.
- **FR-008**: The system MUST record, in its existing operational logs, whether a given catalog request succeeded on the first attempt, succeeded after one or more retries, or failed after exhausting all retries — so the effect of this change is observable after release.
- **FR-009**: Automatic retries MUST apply to every user-facing, blocking catalog read (search, individual release detail, master release detail, master release version list, artist detail) AND to the background library-sync/enrichment operation that keeps a collector's synced library up to date, since that operation relies on the same underlying catalog reads. Applying one consistent policy across both the interactive and background paths avoids inconsistent behavior for the same underlying calls and keeps the policy simple to reason about and monitor. (Best-effort community-rating enrichment within search results remains explicitly excluded — see Assumptions.)
- **FR-010**: The system MUST give up on a request after at most 3 attempts total (the original attempt plus up to 2 retries), with each retry waiting longer than the last (increasing backoff), and the combined added waiting time across all retries MUST NOT exceed roughly 5 seconds. This keeps the collector-perceived delay in "recovers automatically" cases close to imperceptible while still giving a transient hiccup a real chance to clear before falling back to the "temporarily unavailable" message.
- **FR-011**: When transient failures spike broadly across many different catalog requests within a short recent window (indicating a genuine, sustained outage rather than an isolated blip), the system MUST temporarily stop issuing further retries app-wide — failing fast to the existing "temporarily unavailable" outcome — until the catalog service shows signs of recovery, rather than letting every affected request independently retry and further amplify load on an already-struggling service.

### Key Entities

*(Not applicable — this feature changes request-handling behavior only; no new or modified data entities are introduced.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The proportion of master release detail/version-list page views that show a "catalog service busy/unavailable" error to the collector drops by at least 90% compared to the current rate.
- **SC-002**: When a transient hiccup occurs and is resolved by a retry, the collector experiences the page loading successfully within a bounded, still-reasonable wait — no perceptible "hang" — rather than seeing an error.
- **SC-003**: Search and catalog detail pages that succeed on the very first attempt show no added waiting time; only requests that actually hit a transient failure incur retry-related delay.
- **SC-004**: When the catalog service is unavailable for a genuinely extended period, collectors still receive a clear, friendly, actionable message rather than a broken page or indefinite wait.
- **SC-005**: After release, the rate of "recovered after retry" versus "failed after retries" can be read directly from operational logs, without additional investigation.
- **SC-006**: During a genuine, sustained catalog outage, the volume of retry attempts made against the catalog service stays bounded and tapers off quickly (rather than continuing to multiply every affected request's load), so the outage is not made worse by this feature's own retry behavior.

## Assumptions

- The existing cache-aside layer (Redis, with fail-soft behavior and single-flight request coalescing) remains unchanged; this feature only adds retry behavior around the live catalog call a cache miss triggers, not a redesign of caching itself.
- "Transient" failures are those signaled today as the service being busy/rate-limited (HTTP 429) or momentarily unreachable/erroring (network errors, 5xx-class responses) — as already distinguished from "not found" (404) and "credentials rejected" (auth) failures in the current error handling.
- The existing best-effort community-rating enrichment used within search results — which already tolerates its own failures by silently omitting the rating rather than failing the whole search, and is bound by a short lookup timeout so it never delays search results — is explicitly out of scope for this retry policy; its current fail-soft/timeout behavior is preserved as-is.
- The user-facing error message and status shown once retries are exhausted remain exactly what they are today; this feature changes how often that message is reached, not its content or presentation.
- No new user-facing controls (e.g. a manual "retry" button or a visible "retrying…" indicator) are required; retry behavior is expected to be transparent to the collector.
- Retry budget (FR-010) is set to a reasonable default rather than left open: capped at 3 attempts / ~5 seconds added wait per request (long enough to ride out a brief rate-limit/busy blip, short enough that a genuinely down service still fails fast). This can be revisited during planning if real-world data suggests different values. Retry scope (FR-009) and backoff-schedule uniformity across failure types (FR-003) were confirmed via clarification rather than assumed.
- The circuit breaker's (FR-011) exact spike-detection threshold and recovery signal — e.g. how many recent failures within what window trips it, and what indicates the catalog service has recovered enough to resume retries — are implementation-level tuning decisions to be made during planning; this spec only establishes that the protection must exist.
