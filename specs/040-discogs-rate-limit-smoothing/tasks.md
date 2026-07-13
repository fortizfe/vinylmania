---

description: "Task list for Discogs Rate Limit Smoothing & Call Reduction"
---

# Tasks: Discogs Rate Limit Smoothing & Call Reduction

**Input**: Design documents from `/specs/040-discogs-rate-limit-smoothing/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The Constitution's Test-First principle is marked NON-NEGOTIABLE for this feature (plan.md Constitution Check, row I), and research.md §9 / quickstart.md §1 both specify the exact suites to add. Every implementation task below is preceded by the test task(s) that must be written and observed failing first.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) so each story can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3, per spec.md's user stories
- File paths are exact and relative to the repository root

## Path Conventions

Backend-only change, no new top-level project (plan.md Project Structure): all paths are under `backend/src/` and `backend/tests/`.

---

## Phase 1: Setup

No setup tasks. This feature adds no new production dependency (plan.md Primary Dependencies — `axios` only, already installed) and needs no new environment variables, build config, or scaffolding beyond the files created within the user-story phases below.

---

## Phase 2: Foundational (Blocking Prerequisites)

No cross-story blocking prerequisites. Each story's core module is self-contained:

- US1 introduces `discogsRateLimiter.ts` and consumes it from both HTTP clients.
- US2 relocates/uses `mapWithConcurrency` independently of the throttle.
- US3 reuses feature 029's existing, unmodified `discogsRetry.ts`/`discogsCircuitBreaker.ts`.

No story requires another story's implementation to exist first (research.md §1, §4, §6) — proceed directly to Phase 3. Stories are ordered P1 → P2 → P3 below to match spec.md's priority, not because of a hard dependency.

---

## Phase 3: User Story 1 - The collector never notices the app throttling itself against Discogs (Priority: P1) 🎯 MVP

**Goal**: Add a preventive, header-driven local throttle shared by the catalog and OAuth collection clients, so outgoing Discogs requests space themselves out before Discogs ever returns a 429 (FR-001–FR-006, FR-008, FR-015).

**Independent Test**: Drive a burst of catalog requests (e.g. a page of search results or a full library sync) against a fresh process and observe outgoing Discogs requests get spaced out as the known remaining budget shrinks, with no request dropped or failing because of the throttle itself (quickstart.md §2).

### Tests for User Story 1 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T001 [P] [US1] Unit tests for the delay formula and header correction in `backend/tests/unit/discogsRateLimiter.test.ts` (NEW) — threshold-crossing (`remaining` vs `ceil(limit * SAFETY_THRESHOLD_RATIO)`), `MAX_WAIT_MS` cap, `recordRateLimitHeaders()` correcting `limit`/`remaining`/`windowResetAt`, and the fail-soft fallback on an internal error — using Jest fake timers to control `Date.now()`/`setTimeout` (research.md §9; contracts/discogs-rate-limiter-module.md)
- [ ] T002 [US1] Contract test extension in `backend/tests/contract/discogsClient.contract.test.ts` — a burst of requests against a `nock` stub reporting a shrinking `x-discogs-ratelimit-remaining` observably slows down (via fake timers) once under the safety threshold, and never blocks past `MAX_WAIT_MS` (quickstart.md §1; contracts/discogs-rate-limiter-module.md)
- [ ] T003 [US1] Contract test extension in `backend/tests/contract/collectionClient.contract.test.ts` — the catalog and collection clients observably share one throttle budget (draining `remaining` via one client delays the other's next request; `recordRateLimitHeaders()` from either client's response corrects the shared state) — spec Acceptance Scenario 4/FR-004
- [ ] T004 [P] [US1] Integration test `backend/tests/integration/discogsRateLimitSmoothing.test.ts` (NEW) — end-to-end coverage of US1's Acceptance Scenarios 1–6: spacing under budget pressure, minimum-necessary delay when budget is ample (zero delay), `MAX_WAIT_MS` cap, shared budget across both clients, and the existing retry/circuit-breaker still applying unchanged when a 429 slips through (research.md §9)

### Implementation for User Story 1

- [ ] T005 [US1] Create `backend/src/discogs/discogsRateLimiter.ts` (NEW) implementing `acquireSlot(): Promise<void>`, `recordRateLimitHeaders(headers): void`, the `DEFAULT_LIMIT`/`SAFETY_THRESHOLD_RATIO`/`MAX_WAIT_MS`/`WINDOW_MS` constants, the delay formula (`threshold = ceil(limit * SAFETY_THRESHOLD_RATIO)`; `delay = 0` above threshold else `min(MAX_WAIT_MS, windowRemainingMs / max(remaining, 1))`), cold-start defaults (`limit = remaining = DEFAULT_LIMIT`, `windowResetAt = now + WINDOW_MS`), a `try/catch` fail-soft fallback to zero delay, and test-only `__resetRateLimiterForTests()` (research.md §1/§2/§7; contracts/discogs-rate-limiter-module.md) — depends on T001 existing and failing
- [ ] T006 [US1] Add `'throttled'` and `'throttle_unavailable'` to `LogOutcome` in `backend/src/config/logger.ts` (contracts/observability-log-fields.md)
- [ ] T007 [P] [US1] Wire `acquireSlot()`/`recordRateLimitHeaders()` into `backend/src/discogs/discogsClient.ts`'s request/response interceptors: `await acquireSlot()` unconditionally whenever the request isn't rejected by the existing `shouldShortCircuit()` check (including `__skipResilience: true` requests — that flag continues to mean "skip retry + circuit breaker" only); `recordRateLimitHeaders(response.headers)` on success and `recordRateLimitHeaders(error.response.headers)` on error, before existing error mapping runs; log `'throttled'`/`'throttle_unavailable'` from `acquireSlot()` itself (research.md §3; contracts/discogs-rate-limiter-module.md) — depends on T005, T006
- [ ] T008 [P] [US1] Wire `acquireSlot()`/`recordRateLimitHeaders()` into `backend/src/discogs/collection/collectionClient.ts`'s `createClient()` request/response interceptors — same throttle contract as T007 (`await acquireSlot()` before the request is sent; `recordRateLimitHeaders()` on every response) — throttle only, no retry/circuit-breaker changes here (those belong to US3/T016) (contracts/discogs-rate-limiter-module.md "Non-goals") — depends on T005, T006

**Checkpoint**: User Story 1 is fully functional and independently testable (quickstart.md §1–§2) — run `cd backend && npm test -- discogsRateLimiter && npm test -- discogsClient.contract && npm test -- collectionClient.contract && npm test -- discogsRateLimitSmoothing`.

---

## Phase 4: User Story 2 - A single search never fires an uncontrolled burst of rating calls (Priority: P2)

**Goal**: Bound search-result rating-enrichment concurrency to 5 in-flight Discogs calls per search, matching the existing library-enrichment concurrency (FR-009–FR-011).

**Independent Test**: Run a cold-cache search and observe the number of Discogs calls in flight at the same time for that search stays bounded to 5, while the search still completes in a time that feels fast (quickstart.md §3).

### Tests for User Story 2 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T009 [US2] Contract test extension in `backend/tests/contract/discogsClient.contract.test.ts` — a cold-cache search whose page has more than 5 release/master-eligible results never has more than `SEARCH_RATING_CONCURRENCY` (5) `/releases/:id/rating`/`/masters/:id` requests in flight at once (assert via `nock` request-in-flight tracking with delayed responses); a page with ≤5 eligible results is unaffected (identical to today); a cache-hit result triggers no new Discogs call (FR-009/FR-010; contracts/search-rating-concurrency.md)
- [ ] T010 [P] [US2] Integration test extension in `backend/tests/integration/discogsRateLimitSmoothing.test.ts` — US2 end-to-end coverage: bounded concurrency on a cold-cache search, existing fail-soft rating-omission behavior preserved exactly when a lookup fails/times out under the new concurrency limit (FR-011), warm-cache search unaffected (FR-010)

### Implementation for User Story 2

- [ ] T011 [US2] Relocate `mapWithConcurrency` from `backend/src/library/concurrency.ts` to new `backend/src/shared/concurrency.ts` — implementation and signature byte-for-byte unchanged; remove the old `backend/src/library/concurrency.ts` file (research.md §6; contracts/search-rating-concurrency.md) — depends on T009 existing and failing
- [ ] T012 [P] [US2] Update `backend/src/library/libraryEnrichment.ts`'s import of `mapWithConcurrency` to `../shared/concurrency` (import path only, no behavior change) — depends on T011
- [ ] T013 [P] [US2] In `backend/src/discogs/discogsClient.ts`'s `searchCatalog()`, add `const SEARCH_RATING_CONCURRENCY = 5` and replace `await Promise.all(mappedResults.map(enrichWithRating))` with `await mapWithConcurrency(mappedResults, SEARCH_RATING_CONCURRENCY, enrichWithRating)`, importing `mapWithConcurrency` from `../shared/concurrency` (contracts/search-rating-concurrency.md) — depends on T011

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md §3) — run `cd backend && npm test -- discogsClient.contract && npm test -- libraryEnrichment && npm test -- discogsRateLimitSmoothing`.

---

## Phase 5: User Story 3 - The collection client gets the same resilience as the catalog client (Priority: P3)

**Goal**: Extend feature 029's existing retry-with-backoff and circuit-breaker policy to the collection client's safely-idempotent calls, sharing breaker state with the catalog client, while explicitly excluding the non-idempotent `addReleaseToCollection` from automatic retry (FR-012–FR-014, FR-016).

**Independent Test**: Simulate a transient 429/5xx on a collection call (e.g. a page of a library sync, or a rating mutation) and observe it retries with backoff instead of failing on the first attempt; confirm `addReleaseToCollection` still fails immediately with no retry (quickstart.md §4).

### Tests for User Story 3 ⚠️

> Write these first; confirm they fail before starting implementation.

- [ ] T014 [P] [US3] Contract test extension in `backend/tests/contract/collectionClient.contract.test.ts` — retry-then-succeed and exhaustion (same growing-backoff schedule/`MAX_ATTEMPTS` as the catalog client) for `listAllInstances`, `getFieldMap`, `setRating`, `setFieldValue`, `deleteInstance` on a 429/transient 5xx; a non-transient failure (401/403, 404) still fails immediately with no retry, same error type as today (FR-012/FR-013); `addReleaseToCollection` does NOT retry on a 429/5xx (single attempt, immediate failure, FR-016); catalog and collection client requests observably contribute to and are blocked by the same circuit-breaker state (FR-014) (contracts/collection-client-resilience.md)
- [ ] T015 [P] [US3] Integration test extension in `backend/tests/integration/discogsRateLimitSmoothing.test.ts` — US3 end-to-end coverage: a library-sync page retrying transparently past one transient failure, and `addReleaseToCollection` surfacing a 429 immediately with no retry attempt logged

### Implementation for User Story 3

- [ ] T016 [US3] Extend `backend/src/discogs/collection/collectionClient.ts`'s `createClient()` interceptors to reuse feature 029's existing pure functions/singleton unmodified: reject immediately via `shouldShortCircuit()` (before `acquireSlot()`, so a breaker-rejected request never pays a throttle delay) in the request interceptor; in the response interceptor, on a failure classify with `classifyForRetry`, and when non-null and `!config.__skipRetry` and `attempt < MAX_ATTEMPTS`, wait `backoffDelayMs(attempt + 1)` and re-issue via `instance.request(config)` with `__attempt` incremented; on exhaustion or `__skipRetry`, call `recordExhaustedFailure()` and reject with the existing typed error; on success call `recordSuccess()`; add the `__skipRetry?: boolean` field to this file's request-config type (research.md §4/§5; contracts/collection-client-resilience.md) — depends on T014 existing and failing
- [ ] T017 [US3] Pass `{ __skipRetry: true }` on `addReleaseToCollection`'s `POST` request config in `backend/src/discogs/collection/collectionClient.ts` (FR-016; contracts/collection-client-resilience.md) — depends on T016

**Checkpoint**: All three user stories are independently functional (quickstart.md §4) — run `cd backend && npm test -- collectionClient.contract && npm test -- discogsRateLimitSmoothing`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Run the full backend suite (`cd backend && npm test`) and confirm every new/modified suite passes together, with no regression in the existing feature 029 suites (`discogsRetry.test.ts`, `discogsCircuitBreaker.test.ts`, `discogsRetryResilience.test.ts`) — quickstart.md §1
- [ ] T019 [P] Manual validation per quickstart.md §2–§4 against a local Discogs stub: confirm `'throttled'` log lines with `meta.delayMs ≤ 1500` under budget pressure (§2), bounded rating-enrichment concurrency on a cold-cache search (§3), and collection retry parity plus the `addReleaseToCollection` retry exclusion (§4) — do **not** run the Playwright e2e suite (`/e2e`) per spec Assumptions (a pre-existing, separately-tracked bug blocks it)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — no tasks.
- **Foundational (Phase 2)**: None — no tasks; proceed directly to Phase 3.
- **User Story 1 (Phase 3)**: No dependency on other stories. Blocking prerequisite for nothing else, but T007/T008 depend on T005/T006 within this phase.
- **User Story 2 (Phase 4)**: No dependency on US1's or US3's implementation (research.md §6). Independently implementable in parallel with US1/US3 if staffed, though listed second per spec priority.
- **User Story 3 (Phase 5)**: No dependency on US1's or US2's implementation — reuses feature 029's already-existing `discogsRetry.ts`/`discogsCircuitBreaker.ts` unmodified. T016 and T017 both touch `collectionClient.ts`'s interceptors already touched by T008 (US1) — if working sequentially by priority (recommended), no conflict; if parallelizing across stories, coordinate edits to this one file between US1 and US3.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests (T001–T004, T009–T010, T014–T015) MUST be written and observed failing before their corresponding implementation tasks (Constitution Principle I, NON-NEGOTIABLE for this feature per plan.md Constitution Check).
- `discogsRateLimiter.ts` (T005) before either client is wired to it (T007, T008).
- `mapWithConcurrency`'s relocation (T011) before its two new import sites (T012, T013).
- `collectionClient.ts`'s retry/breaker interceptor (T016) before the `__skipRetry` flag is set on `addReleaseToCollection` (T017).

### Parallel Opportunities

- T001 and T004 (different files: unit test vs. new integration test file) can run in parallel; T002 and T003 each extend a distinct existing contract-test file so can also run in parallel with T001/T004, but not with each other's same-file neighbors from a later phase.
- T007 and T008 (US1 implementation: `discogsClient.ts` vs. `collectionClient.ts`) are independent files — parallelizable once T005/T006 are done.
- T010 can run in parallel with T009 (different files).
- T012 and T013 (US2 implementation: `libraryEnrichment.ts` vs. `discogsClient.ts`) are independent files — parallelizable once T011 is done.
- T014 and T015 (US3 tests: different files) can run in parallel.
- T018 and T019 (Polish) are independent activities — parallelizable.
- Once Phase 3 is done, Phase 4 and Phase 5 could in principle proceed in parallel by different developers (research.md §1/§4/§6 confirm no code dependency between them), though sequential P1→P2→P3 delivery is recommended for a single implementer.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallelizable — different files):
Task: "Unit tests for discogsRateLimiter.ts delay formula/header correction in backend/tests/unit/discogsRateLimiter.test.ts"
Task: "Integration test discogsRateLimitSmoothing.test.ts covering US1 Acceptance Scenarios 1-6"

# After discogsRateLimiter.ts (T005) and the logger change (T006) land:
Task: "Wire acquireSlot()/recordRateLimitHeaders() into discogsClient.ts's interceptors"
Task: "Wire acquireSlot()/recordRateLimitHeaders() into collectionClient.ts's interceptors"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3 (User Story 1) — the preventive throttle shared by both Discogs HTTP clients.
2. **STOP and VALIDATE**: run `npm test -- discogsRateLimiter && npm test -- discogsClient.contract && npm test -- collectionClient.contract && npm test -- discogsRateLimitSmoothing`, then quickstart.md §2's manual check.
3. This alone delivers SC-001/SC-003 — collectors already stop seeing self-inflicted "service busy" messages before Story 2 or 3 land.

### Incremental Delivery

1. User Story 1 → validate independently → this is the MVP (structural fix, spec's "Why this priority").
2. Add User Story 2 → validate independently (quickstart.md §3) → removes the single largest known burst source (SC-002).
3. Add User Story 3 → validate independently (quickstart.md §4) → closes the collection-client resilience gap (SC-004).
4. Each story adds value without breaking the previous ones — no story depends on another's implementation.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- [Story] label maps every user-story-phase task to spec.md's US1/US2/US3 for traceability.
- Constitution Principle I is NON-NEGOTIABLE for this feature (plan.md Constitution Check row I) — do not skip the "write failing test first" step for any implementation task above.
- `backend/src/discogs/oauth/oauthHttpClient.ts` is explicitly out of scope (contracts/discogs-rate-limiter-module.md "Non-goals") — no task touches it.
- Do not hand-edit `backend/CHANGELOG.md` or `backend/package.json`'s version — both are derived automatically from Conventional Commit messages in CI (plan.md Constitution Check, "Changelog / version-bump gate").
- Do not run the Playwright e2e suite (`/e2e`) during this feature's implementation loop (spec Assumptions) — T019's manual validation is scoped to backend routes/logs only.
