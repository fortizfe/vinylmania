# Tasks: Discogs Communication Resilience (Retry Policy)

**Input**: Design documents from `/specs/029-discogs-retry-resilience/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/discogs-resilience-module.md](./contracts/discogs-resilience-module.md), [contracts/observability-log-fields.md](./contracts/observability-log-fields.md), [quickstart.md](./quickstart.md) (all present)

**Tests**: Included and REQUIRED — constitution Principle I (Test-First, NON-NEGOTIABLE) mandates a failing test before implementation for every behavior change. This feature has no `/frontend` code changes, so the e2e coverage gate does not apply.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities from spec.md). The retry, circuit-breaker, and error-classification mechanism is a single shared modification to `discogsClient.ts`'s HTTP interceptor — it inherently covers every scoped catalog read at once — so almost all new production code lands in the Foundational phase; each user story phase then adds the route-level tests that prove that specific journey (master detail/versions, search, observability) actually benefits, per its acceptance scenarios in spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Maps the task to US1, US2, or US3 (omitted for Setup/Foundational/Polish)
- File paths are exact and relative to the repo root

## Path Conventions

Backend-only feature (per plan.md): `backend/src/`, `backend/tests/`.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching shared Discogs client code. No new dependencies are added (research.md §2) — this feature only extends existing, already-configured modules.

- [ ] T001 Run `npm run lint && npm test` in `backend/` to confirm a green baseline before starting; note the current test count for later comparison

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the retry classifier, circuit breaker, logging extension, and the interceptor changes that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Write failing unit tests for `classifyForRetry()` and `backoffDelayMs()` in `backend/tests/unit/discogsRetry.test.ts` per `contracts/discogs-resilience-module.md`: 429 → `'rate_limited'`, 5xx/network error → `'unavailable'`, 404/401/403/other → `null`; `backoffDelayMs(2)` ≈300ms and `backoffDelayMs(3)` ≈900ms (±20% jitter, asserted as a range); **and** assert `backoffDelayMs(2) + backoffDelayMs(3)` stays under the ~5 second budget in FR-010, so that MUST clause has a direct test rather than relying on the numbers being self-evidently small
- [ ] T003 [P] Write failing unit tests for the circuit breaker state machine in `backend/tests/unit/discogsCircuitBreaker.test.ts` using Jest fake timers per data-model.md "Circuit Breaker State": stays `closed` under 5 strikes in 30s; trips to `open` on the 5th `recordExhaustedFailure()` within the window; `shouldShortCircuit()` is `true` while `open`; transitions to `half-open` only after the 20s cooldown elapses; a `half-open` `recordSuccess()` closes it (strike count resets); a `half-open` `recordExhaustedFailure()` reopens it and restarts the cooldown
- [ ] T004 [P] Extend the `LogOutcome` union in `backend/src/config/logger.ts` with `'circuit_open'` per `contracts/observability-log-fields.md`
- [ ] T005 [P] Write failing contract tests in `backend/tests/contract/discogsClient.contract.test.ts` (extends the existing `searchCatalog`/`getRelease`/`getArtist` describe blocks) covering the interceptor's full retry contract per `contracts/discogs-resilience-module.md`: (a) a request that fails once (429 or 500) then succeeds resolves normally and logs `outcome: 'success'`, `meta.attempts: 2`; (b) a request that fails on all 3 attempts rejects with the existing typed error (`DiscogsRateLimitError`/`DiscogsUnavailableError`) and logs `meta.attempts: 3`; (c) a 404 rejects immediately with `DiscogsNotFoundError` after exactly one `nock` call (no retry); (d) a 401 and a 403 each reject immediately with `DiscogsAuthError` after exactly one `nock` call (no retry) — new coverage, since `discogsClient.ts` does not classify these today; (e) after 5 requests whose retries are fully exhausted, the next request rejects immediately with **zero** outbound `nock` calls and logs `outcome: 'circuit_open'`
- [ ] T006 [P] Write a failing integration test in `backend/tests/integration/discogsRetryResilience.test.ts` asserting `enrichEntry()` (`backend/src/library/libraryEnrichment.ts`) returns `catalogStatus: 'ok'` (not the degraded `'unavailable'` placeholder) when the underlying `getRelease` call it makes fails once (429) and then succeeds — proves FR-009's background library-enrichment scope extension with zero changes to `libraryEnrichment.ts` itself
- [ ] T007 [P] Write a failing integration test in `backend/tests/integration/discogsRetryResilience.test.ts` (extends T006's file) asserting FR-007's single-retry-per-coalesced-group guarantee: two concurrent calls to the same catalog function for the same uncached key (e.g. two simultaneous `getRelease(id)` calls, mirroring the existing single-flight pattern in `backend/tests/unit/cacheAside.test.ts`), whose single underlying HTTP request fails once (429) then succeeds, are served by exactly one retry sequence — assert exactly 2 total `nock` calls are consumed (not 4, i.e. not one retry sequence per caller) and both concurrent callers resolve to the identical successful result
- [ ] T008 [P] Implement `classifyForRetry()`, `backoffDelayMs()`, `MAX_ATTEMPTS`, and `PER_ATTEMPT_TIMEOUT_MS` in `backend/src/discogs/discogsRetry.ts` per `contracts/discogs-resilience-module.md` and research.md §3–4 (makes T002 pass; depends on T002)
- [ ] T009 [P] Implement `shouldShortCircuit()`, `recordExhaustedFailure()`, `recordSuccess()` as a module-level singleton in `backend/src/discogs/discogsCircuitBreaker.ts` per `contracts/discogs-resilience-module.md` and research.md §6 (5 strikes/30s window, 20s cooldown) (makes T003 pass; depends on T003)
- [ ] T010 Modify the response interceptor in `createDiscogsHttpClient()` (`backend/src/discogs/discogsClient.ts`) per `contracts/discogs-resilience-module.md`: check `shouldShortCircuit()` before issuing a request; map `401`/`403` responses to `DiscogsAuthError` (new — mirrors the existing pattern in `backend/src/discogs/collection/collectionClient.ts`); on a retryable failure (`classifyForRetry()` non-null) with attempts remaining, wait `backoffDelayMs()` and re-issue the request instead of rejecting — re-issuing through the same in-flight call so concurrent callers coalesced by `cacheAside.ts`'s single-flight map share the one retry sequence (satisfies FR-007, makes T007 pass); on final resolution call `recordSuccess()`/`recordExhaustedFailure()` and log `meta.attempts` on the existing success/`rate_limited`/`unavailable` log lines, or `outcome: 'circuit_open'` when short-circuited; reduce the per-request `timeout` for `searchCatalog`/`getRelease`/`getMasterRelease`/`getMasterReleaseVersions`/`getArtist` to `PER_ATTEMPT_TIMEOUT_MS` (leaving `getReleaseRating`'s existing 2s timeout untouched) (makes T005, T006, and T007 pass; depends on T004, T005, T006, T007, T008, T009)

**Checkpoint**: Foundation ready — every scoped catalog read (search, release, master, master versions, artist) and the background library-enrichment path now retry transient failures with backoff, respect the circuit breaker, coalesce retries across concurrent callers of the same in-flight request, and log attempt counts. User story implementation can now begin (mostly test coverage proving each journey benefits).

---

## Phase 3: User Story 1 - Browse a master release without hitting a "busy" error (Priority: P1) 🎯 MVP

**Goal**: A collector opening a master release's detail page or browsing its paginated version list no longer sees the "catalog service is busy" error for a transient hiccup — the request recovers automatically.

**Independent Test**: Simulate a transient 429/500 response on the first attempt for `GET /api/discogs/masters/:discogsId` or `GET /api/discogs/masters/:discogsId/versions`, then verify the response still succeeds with the correct data (see `quickstart.md` §2).

### Tests for User Story 1

- [ ] T011 [US1] Add integration tests to `backend/tests/integration/discogsRetryResilience.test.ts` for `GET /api/discogs/masters/:discogsId` and `GET /api/discogs/masters/:discogsId/versions`: (a) a 429 followed by a 200 still returns 200 with the correct body, with the request log showing `meta.attempts: 2`; (b) three consecutive 500s still returns today's unchanged `502 { error: 'catalog_unavailable', ... }` body, with the log showing `meta.attempts: 3`; (c) pre-seeding the cache for a given master ID and then requesting it triggers **zero** `nock` calls at all (retry logic is never invoked on a cache hit, per FR-006); (d) with the circuit breaker already tripped `open` (via 5 prior exhausted failures against different IDs), requesting a master's detail route still returns the same unchanged `502 { error: 'catalog_unavailable', ... }` body as (b) — proving the circuit-open path preserves the existing route-level contract, not just the underlying client function's rejection (depends on T010)

### Implementation for User Story 1

No new production code required — `getMasterRelease` and `getMasterReleaseVersions` already call the shared `getDiscogsHttpClient()`, so the Foundational interceptor change (T010) already covers this journey. T011 exists purely to prove it against the specific routes named in the spec's reported pain point.

**Checkpoint**: User Story 1 is fully functional and independently demoable — master detail and version-list navigation is resilient to transient Discogs hiccups, with no other story's work required.

---

## Phase 4: User Story 2 - Search results stay resilient to the same transient hiccups (Priority: P2)

**Goal**: A collector's search recovers automatically from a transient hiccup, and a search that succeeds on the first attempt sees no added delay.

**Independent Test**: Simulate a transient 429/500 response on the first attempt of `GET /api/discogs/search`, then verify results still load; separately confirm a first-attempt success shows no retry-related delay (see `quickstart.md` §1).

### Tests for User Story 2

- [ ] T012 [US2] Add integration tests to `backend/tests/integration/discogsRetryResilience.test.ts` for `GET /api/discogs/search`: (a) a 429 followed by a 200 still returns 200 with the correct results, logging `meta.attempts: 2`; (b) a search that succeeds on the first `nock` interceptor consumes exactly one outbound call (no retry-related `nock` interceptors are ever registered/consumed), confirming FR-006/SC-003's "no added delay" guarantee; (c) a scope-boundary regression check: a community-rating lookup (`getReleaseRating`) that fails is still just omitted from the result (`communityRating: undefined`) after exactly one `nock` call — never retried — confirming research.md §8's exclusion holds after the interceptor change (depends on T010)

### Implementation for User Story 2

No new production code required — `searchCatalog` already calls the shared `getDiscogsHttpClient()` for the search request itself; `getReleaseRating` is a separate, intentionally-untouched code path (research.md §8). T012 exists purely to prove the search journey benefits and that the rating-enrichment exclusion still holds.

**Checkpoint**: User Stories 1 AND 2 both work independently — the two most-trafficked catalog browsing journeys are resilient to transient hiccups.

---

## Phase 5: User Story 3 - Operators can see whether retries are actually helping (Priority: P3)

**Goal**: Structured logs distinguish a first-try success, a request that recovered after retrying, a request that failed after exhausting all retries, and a circuit-open fast-fail.

**Independent Test**: Trigger a request that fails transiently once and then succeeds, and verify the log line records that a retry occurred before success, distinct from a plain first-try success and from a full-exhaustion failure (see `contracts/observability-log-fields.md`).

### Tests for User Story 3

- [ ] T013 [US3] Add `jest.spyOn(logger, 'info')`/`jest.spyOn(logger, 'warn')` assertions to `backend/tests/contract/discogsClient.contract.test.ts` (extends T005's scenarios) explicitly asserting the four distinguishable cases from `contracts/observability-log-fields.md`: `outcome: 'success'` with `meta.attempts: 1` (plain first-try success) vs. `meta.attempts: 2`/`3` (recovered after retry); `outcome: 'rate_limited'`/`'unavailable'` with `meta.attempts: 3` (exhausted) vs. `meta.attempts: 1` for an immediate 404/401/403 (never entered the retry path); `outcome: 'circuit_open'` with no `attempts` field (depends on T010)

### Implementation for User Story 3

No new production code required — T010 already emits every field asserted here. T013 exists to lock in the exact observability contract as its own explicitly-tested concern, independent of the black-box route behavior US1/US2 already cover.

**Checkpoint**: All three user stories are independently functional. The full feature — automatic retry, circuit breaker, and the observability to verify both — is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all three stories.

- [ ] T014 [P] Add an `Added` entry to `backend/CHANGELOG.md` describing the automatic retry-with-backoff and circuit-breaker behavior for Discogs catalog requests, and bump the `version` field in `backend/package.json` from `0.10.0` to `0.11.0` (MINOR — new capability, no breaking change), per the constitution's changelog gate
- [ ] T015 [P] Add a line to the "Stack" section of `README.md` mentioning the Discogs retry/circuit-breaker resilience layer, linking to `specs/029-discogs-retry-resilience/quickstart.md` (mirrors the existing Discogs client and caching lines)
- [ ] T016 Run `npm run lint && npm test` in `backend/` and confirm all tests pass, including every test added in T002-T013, with no regressions against the T001 baseline
- [ ] T017 Execute the manual scenarios in `quickstart.md` (§2-§6) against a local stub/dev environment where feasible, and record results confirming SC-001 through SC-006 are observably met; note any scenario that could not be exercised in the current environment (e.g. no way to script a live Discogs outage) exactly as feature 011's quickstart validation did for its Redis-outage step

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends only on Foundational — independent of US2/US3
- **User Story 2 (Phase 4)**: Depends only on Foundational — independent of US1/US3
- **User Story 3 (Phase 5)**: Depends only on Foundational — independent of US1/US2 (all three phases add tests against the same already-complete T010; they do not depend on each other)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **User Story 2 (P2)**: Can start after Foundational, in parallel with US1 — no shared production code changes, though both append to `discogsRetryResilience.test.ts` (coordinate to avoid merge conflicts, or run sequentially)
- **User Story 3 (P3)**: Can start after Foundational, in parallel with US1/US2 — appends to `discogsClient.contract.test.ts` instead, so it has no file overlap with US1/US2

### Within Each Phase

- Tests MUST be written and FAIL before their corresponding implementation task (Test-First, NON-NEGOTIABLE per the constitution)
- `discogsRetry.ts` and `discogsCircuitBreaker.ts` (independent pure modules) before the interceptor integration that consumes them
- The shared interceptor change (T010) before any user story's tests can pass
- Story complete (including its tests) before moving to the next priority, if working sequentially

### Parallel Opportunities

- T002, T003, T004, T005, T006, T007 (six distinct test/type files or file sections, all written before any new implementation) can run fully in parallel — note T006 and T007 both extend `discogsRetryResilience.test.ts`, so coordinate ordering if run concurrently
- T008 and T009 (distinct files, each depending only on its own test) can run in parallel with each other once T002/T003 exist
- T010 depends on T004, T005, T006, T007, T008, T009 — it is the single serialization point where Foundational work converges
- Once Foundational (T001-T010) is complete, **User Story 1, 2, and 3 can all be staffed and run in parallel** (different files: `discogsRetryResilience.test.ts` for US1/US2 — coordinate order — and `discogsClient.contract.test.ts` for US3)
- T014 and T015 (Polish) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Tests + trivial groundwork (six independent files/sections, launch together):
Task: "Write failing unit tests for classifyForRetry()/backoffDelayMs() (incl. combined-delay bound) in backend/tests/unit/discogsRetry.test.ts"
Task: "Write failing unit tests for the circuit breaker state machine in backend/tests/unit/discogsCircuitBreaker.test.ts"
Task: "Extend LogOutcome with 'circuit_open' in backend/src/config/logger.ts"
Task: "Write failing contract tests for the interceptor's retry contract in backend/tests/contract/discogsClient.contract.test.ts"
Task: "Write failing integration test for libraryEnrichment's transitive retry coverage in backend/tests/integration/discogsRetryResilience.test.ts"
Task: "Write failing integration test for single-retry-per-coalesced-group (FR-007) in backend/tests/integration/discogsRetryResilience.test.ts"

# Implementation (after each module's own tests exist):
Task: "Implement discogsRetry.ts"
Task: "Implement discogsCircuitBreaker.ts"

# Serialization point (after all of the above):
Task: "Modify discogsClient.ts's interceptor to integrate retry, circuit breaker, 401/403 mapping, and tuned timeouts"
```

## Parallel Example: User Stories 1, 2, 3 together

```bash
# Different developers, all depend only on the completed Foundational phase:
Developer A: T011   # US1 — master detail/versions route tests
Developer B: T012   # US2 — search route tests + rating-enrichment scope regression
Developer C: T013   # US3 — logger-spy observability assertions
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — this is where nearly all the real implementation happens)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `quickstart.md` §2 manually; confirm master detail/version-list navigation recovers from a simulated transient failure
5. Deploy/demo if ready — this alone resolves the reported pain point (`/api/discogs/masters/:discogsId/versions` "catalog service is busy" errors)

### Incremental Delivery

1. Complete Setup + Foundational → the retry/circuit-breaker mechanism is fully built and unit/contract-tested
2. Add User Story 1 → validate independently (`quickstart.md` §2-3) → deploy/demo (MVP!)
3. Add User Story 2 → validate independently (`quickstart.md` §1) → deploy/demo
4. Add User Story 3 → validate independently (log inspection) → deploy/demo
5. Polish: changelog + version bump, README, full quickstart + test-suite pass

### Parallel Team Strategy

With multiple developers:

1. All complete Setup + Foundational together (T002-T010 have real internal parallelism, see above)
2. Once Foundational is done, three developers can each take one user story phase (T011/T012/T013) fully in parallel, since none of the three depend on each other
3. Reconvene for Polish (T014-T017)

---

## Notes

- [P] tasks = different files, no unmet dependencies
- [Story] label maps task to specific user story for traceability
- Tests MUST fail before their corresponding implementation task starts (Test-First, NON-NEGOTIABLE per the constitution)
- Commit after each task or logical group, following Conventional Commits (constitution's Development Workflow gate)
- Stop at any checkpoint to validate a story independently before continuing
- T006 and T007 both extend `backend/tests/integration/discogsRetryResilience.test.ts`; T011 and T012 also extend it — check for merge conflicts if working in parallel
