# Tasks: Fix CodeQL Code Quality Gate Alerts

**Input**: Design documents from `/specs/056-fix-codeql-quality-alerts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rate-limiter-port.md, contracts/codeql-scan-config.md, quickstart.md

**Tests**: Included — Constitution Principle I (Test-First, NON-NEGOTIABLE) and spec FR-008 both require a red→green test per behavioral fix.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's priorities). The three stories touch fully disjoint files and have no dependencies on each other — all three can be implemented in parallel, in any order, once Setup is done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, or US3 — maps to spec.md's user stories
- File paths are exact and repository-root-relative

---

## Phase 1: Setup

- [X] T001 Capture the current baseline via `gh api repos/:owner/:repo/code-scanning/alerts --paginate -q '.[] | select(.state == "open") | {number, rule: .rule.id, path: .most_recent_instance.location.path}'` and save the output to `/private/tmp/claude-501/-Users-fortizfe-Repositories-vinylmania/*/scratchpad/baseline-alerts.json` (or equivalent scratch location) — this is the 25-alert snapshot every later checkpoint is measured against (spec SC-002).

---

## Phase 2: Foundational

**None.** US1, US2, and US3 touch entirely disjoint files (route/rateLimit files vs. `feedMapper.ts` vs. test-only files) and share no code, so there is no cross-story blocking prerequisite. Proceed directly to the user story phases; they may be done in any order or in parallel.

---

## Phase 3: User Story 1 - Close high-severity authorization alerts without rate limiting (Priority: P1) 🎯 MVP (with US2)

**Goal**: Every one of the 17 flagged route handlers (across 6 files) rejects excess requests with `429` instead of processing them past its tier's threshold, while normal traffic is unaffected.

**Independent Test**: Re-run the CodeQL scan against the 6 affected route files and confirm zero `missing-rate-limiting` findings; hit a strict-tier endpoint (e.g. `GET /api/auth/google/authorize`) more than 20 times in 60s from one IP and observe `429` with `Retry-After` on the 21st request (threshold raised from 10, research.md §2c).

### Tests for User Story 1 ⚠️ Write first, confirm they fail (module doesn't exist yet)

**Test-granularity note**: the 17 CodeQL alert locations map to only 6 integration tests below (one per route *file*/tier-group), not 17 per-handler tests. This satisfies FR-008 because every route within a given file is wired with the exact same one-line middleware addition at the same tier — the wiring is mechanically identical across sibling routes in a file, so one passing test per file is representative proof for all of that file's flagged handlers, not a coverage gap.

**Revision note** (post-implementation, research.md §2b-§2d): T002/T003/T010-T012 below originally targeted a hand-rolled `RateLimiterPort`/`redisRateLimiterAdapter`/`requireRateLimit` — replaced by `express-rate-limit` (constructed locally per route file) once the PR's own gate proved the hand-rolled version invisible to CodeQL. Descriptions updated to match what shipped; checkboxes reflect actual completion.

- [X] T002 [P] [US1] Unit tests for the shared store factory in `backend/tests/unit/rateLimit/rateLimitStore.test.ts` — cover: always returns a `Store` synchronously; counts correctly via the in-memory fallback when `REDIS_URL` is unset; counts correctly via the custom `INCR`/`PEXPIRE` Redis-backed store when `REDIS_URL` is configured; regression guard that `getRedisClient()` is called by neither construction nor `init()`, only by the first `increment()` (research.md §2c bug 2).
- [X] T003 [P] [US1] *(superseded — no separate middleware-factory unit test exists; `express-rate-limit`'s own middleware is exercised end-to-end by T004-T009's integration tests instead, since there is no hand-rolled factory left to unit-test in isolation.)*
- [X] T004 [P] [US1] Integration test for standard-tier wiring on `authRouter` in `backend/tests/integration/users/authRoutesRateLimit.integration.test.ts` — exceed the standard threshold against `/api/auth/me` and assert `429`.
- [X] T005 [P] [US1] Integration test for standard-tier wiring on `libraryRouter` in `backend/tests/integration/library/libraryRoutesRateLimit.integration.test.ts` — exceed the standard threshold against `GET /api/library` and assert `429`.
- [X] T006 [P] [US1] Integration test for strict-tier wiring on `googleAuthRouter` in `backend/tests/integration/googleAuth/googleAuthRoutesRateLimit.integration.test.ts` — exceed the strict threshold against `GET /api/auth/google/authorize` (no `requireAuth` on this route, so this is also the test that a pre-auth endpoint is protected) and assert `429`.
- [X] T007 [P] [US1] Integration test for standard-tier wiring on `feedsRouter` in `backend/tests/integration/feeds/feedsRoutesRateLimit.integration.test.ts` — exceed the standard threshold against `GET /api/feeds/dashboard` and assert `429`.
- [X] T008 [P] [US1] Integration test for mixed-tier wiring on `discogsOauthRouter` in `backend/tests/integration/discogsOauth/discogsRoutesRateLimit.integration.test.ts` — assert strict threshold (20/60s) on `POST /api/discogs/oauth/request` and standard threshold (100/60s) on `GET /api/discogs/oauth/status`.
- [X] T009 [P] [US1] Integration test for standard-tier wiring on `discogsRouter` (catalog) in `backend/tests/integration/discogsCatalog/discogsRoutesRateLimit.integration.test.ts` — exceed the standard threshold against `GET /api/discogs/search` and assert `429`.

### Implementation for User Story 1

- [X] T010 [US1] Create shared, non-middleware rate-limit values (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_THRESHOLDS`, `RATE_LIMIT_MESSAGE`, `rateLimitHandler`) in `backend/src/adapters/rateLimit/rateLimitOptions.ts`, per `contracts/rate-limiter-port.md`.
- [X] T011 [US1] Implement the custom `INCR`/`PEXPIRE`-based `Store` and the Redis-vs-in-memory lazy resolver in `backend/src/adapters/rateLimit/rateLimitStore.ts` (`createRateLimitStore()`) — no Lua scripting, resolution deferred to first `increment()`/`init()` call (research.md §2c); makes T002 pass.
- [X] T012 [US1] *(superseded — no separate middleware factory; each route file below calls `rateLimit(...)` from `express-rate-limit` directly, per research.md §2b's cross-file false-negative finding.)*
- [X] T013 [P] [US1] Construct a local `standardRateLimit = rateLimit(...)` and apply it before `requireAuth` on all 3 routes in `backend/src/adapters/users/authRoutes.ts` (depends on T010-T011; makes T004 pass).
- [X] T014 [P] [US1] Construct a local `standardRateLimit` and apply it before `requireAuth` on all 5 routes in `backend/src/adapters/library/libraryRoutes.ts` (depends on T010-T011; makes T005 pass).
- [X] T015 [P] [US1] Construct a local `strictRateLimit` and apply it as the first middleware on `/authorize` and `/complete` in `backend/src/adapters/googleAuth/googleAuthRoutes.ts` (depends on T010-T011; makes T006 pass).
- [X] T016 [P] [US1] Construct a local `standardRateLimit` and apply it before `requireAuth` on both flagged routes in `backend/src/adapters/feeds/feedsRoutes.ts` (depends on T010-T011; makes T007 pass).
- [X] T017 [P] [US1] Construct local `strictRateLimit`/`standardRateLimit` instances in `backend/src/adapters/discogsOauth/discogsRoutes.ts` and apply per-route (strict on `/request`+`/complete`, standard on `/connection`+`/status`) before `requireAuth` on each — the former router-level `.use(requireAuth)` was replaced with per-route `requireAuth` to allow the tier split (depends on T010-T011; makes T008 pass).
- [X] T018 [P] [US1] Construct a local `standardRateLimit` and apply it before `requireAuth` on all 4 flagged routes in `backend/src/adapters/discogsCatalog/discogsRoutes.ts` (depends on T010-T011; makes T009 pass).
- [X] T018b [US1] *(added post-implementation)* Make the strict/standard thresholds overridable via `RATE_LIMIT_MAX_OVERRIDE`; set it in `e2e/playwright.config.ts`'s backend `webServer` env so the e2e suite's one long-lived backend process (139+ real sign-ins across the full run) isn't throttled by CI test volume — the `rateLimit(...)` call stays present unconditionally in source, so CodeQL recognition is unaffected (research.md §2d).

**Checkpoint**: `npx jest tests/unit/rateLimit tests/integration/users/authRoutesRateLimit tests/integration/library/libraryRoutesRateLimit tests/integration/googleAuth tests/integration/feeds/feedsRoutesRateLimit tests/integration/discogsOauth/discogsRoutesRateLimit tests/integration/discogsCatalog/discogsRoutesRateLimit` all pass. User Story 1 is independently complete and demoable.

---

## Phase 4: User Story 2 - Fix feed content sanitization defects (Priority: P1) 🎯 MVP (with US1)

**Goal**: `feedMapper.ts`'s entity decoding is single-pass and tag-stripping runs after decoding, so no script-like fragment or double-unescaped entity can survive `cleanText`.

**Independent Test**: Feed `decodeEntities`/`cleanText` a string containing a double-encoded script fragment (e.g. `&#38;lt;script&#38;gt;`) and a doubly-escaped entity, in isolation, and confirm neither survives.

### Tests for User Story 2 ⚠️ Write first, confirm they fail against current code

- [X] T019 [P] [US2] Unit tests in `backend/tests/unit/feeds/domain/feedMapper.test.ts` covering: (a) a double-encoded script-like fragment does not survive `cleanText`/`mapFeedItem`; (b) a doubly-escaped `&` entity renders exactly once, correctly; (c) existing normal-text titles/excerpts are unaffected (regression case using a plain, already-passing example from current behavior).

### Implementation for User Story 2

- [X] T020 [US2] Rewrite `decodeEntities` in `backend/src/domain/feeds/feedMapper.ts` to decode all entity forms (numeric refs + named entities) in a single pass (one regex alternation resolved through one callback) instead of sequential `.replace()` calls, so no pass can act on a prior pass's output (depends on T019 existing and failing; makes the double-escaping case in T019 pass).
- [X] T021 [US2] Reorder `cleanText` in `backend/src/domain/feeds/feedMapper.ts` to call `stripHtml` after `decodeEntities` (decode-then-strip instead of strip-then-decode), so a decoded tag is still subject to stripping (same file, after T020; makes the script-fragment case in T019 pass).

**Checkpoint**: `npx jest tests/unit/feeds/domain/feedMapper.test.ts` passes; `npx jest tests/unit/feeds tests/integration/feeds` (full feeds suite) shows no regression. User Story 2 is independently complete and demoable.

---

## Phase 5: User Story 3 - Clean up remaining code-quality findings (Priority: P2)

**Goal**: Zero remaining open alerts for `js/unused-local-variable`, `js/useless-assignment-to-local`, and `js/incomplete-url-substring-sanitization`.

**Independent Test**: Re-run the gate against the 5 affected files and confirm none of the three rule IDs above appear; run each affected test file and confirm it still passes.

### Implementation for User Story 3

(No new "test-first" tasks beyond what's below — per spec FR-008, only *behavioral* fixes need a dedicated red→green test; the useless-assignment removal has no observable behavior to test, and the two host-anchoring fixes' test case additions ARE both the fix and its own verification, per spec User Story 3's acceptance scenario 3.)

- [X] T022 [P] [US3] Remove the unused `spawn` import/variable in `scripts/__tests__/run-with-timeout.test.js`; run the file to confirm it still passes.
- [X] T023 [P] [US3] Remove the unused `vi` import in `frontend/tests/unit/filters/CollapsibleFilterPanel.test.tsx`; run the file to confirm it still passes.
- [X] T024 [P] [US3] Change `let pages = 1;` to `let pages: number;` in `listAllInstances` in `backend/src/adapters/discogsOauth/discogsCollectionAdapter.ts` (the initializer is always overwritten in the `do...while` body before first read); run `backend/tests/contract/discogsOauth/collectionClient.contract.test.ts` (the existing `listAllInstances` pagination coverage — no file named after the adapter itself exists) to confirm no behavior change.
- [X] T025 [P] [US3] In `backend/tests/unit/feeds/domain/feedSources.test.ts`, replace the `feedUrl.includes('metalblade.com')` check with `new URL(feedUrl).hostname === 'metalblade.com'` and add a case asserting a lookalike host (e.g. `https://not-metalblade.com.attacker.test/feed`) is correctly distinguished from the real host.
- [X] T026 [P] [US3] Apply the same anchored-hostname fix and lookalike-domain case to `backend/tests/integration/feeds/feedsDashboardExpandedSources.integration.test.ts`.

**Checkpoint**: `node scripts/__tests__/run-with-timeout.test.js`-equivalent Jest run, the frontend `CollapsibleFilterPanel` test, and the backend `discogsCollectionAdapter`/`feedSources`/`feedsDashboardExpandedSources` suites are all green. User Story 3 is independently complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Add `paths-ignore: [docs/**]` to the `code-quality` job's `github/codeql-action/init@v4` step in `.github/workflows/ci.yml`, per `contracts/codeql-scan-config.md` (FR-006; resolves the `js/missing-origin-check` alert by scope exclusion, no code change).
- [X] T028 Run the full backend suite (`cd backend && npm test`) and confirm it is green with no regression (spec SC-004).
- [X] T029 Push the branch, open the PR, wait for the `code-quality` gate to re-run, and confirm via `gh api repos/:owner/:repo/code-scanning/alerts --paginate -q '.[] | select(.state == "open")'` scoped to the PR ref that zero open alerts remain (quickstart.md §5; spec SC-001, SC-002, SC-003).
- [X] T030 Re-check the alert list from T029 specifically for any new alert introduced by the new `backend/src/adapters/rateLimit/` code itself, confirming the fix didn't trade old alerts for new ones. Done — 0 open alerts on the PR ref after two follow-up fixes (research.md §2c, §2d) beyond the initial `express-rate-limit` pivot.
- [ ] T031 After the PR merges to `main`, re-run `gh api repos/:owner/:repo/code-scanning/alerts --paginate -q '.[] | select(.state == "open")'` (no `ref` filter, i.e. against `main`'s own scan) and confirm zero open alerts — T029 only verifies the PR ref pre-merge; this closes SC-001's explicit "on the `main` branch" requirement, which nothing else in this task list checks post-merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 can run immediately.
- **Foundational (Phase 2)**: Empty — no phase to wait on.
- **User Stories (Phase 3, 4, 5)**: Each depends only on Setup (T001) being done; the three stories are mutually independent (disjoint files) and may run in parallel or in any order.
- **Polish (Phase 6)**: T027 has no dependency on Phases 3–5 (different file). T028–T030 depend on all of Phases 3–5 being complete (they validate the combined result). T031 additionally depends on the PR from T029 actually being merged to `main`.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 or US3.
- **User Story 2 (P1)**: No dependency on US1 or US3.
- **User Story 3 (P2)**: No dependency on US1 or US2.

### Within Each User Story

- US1: T002–T009 (tests) before T010–T018 (implementation); T010 → T011 → T012 is a strict chain (port → adapter → middleware); T013–T018 (the 6 wiring tasks) all depend on T012 but not on each other — fully parallel.
- US2: T019 (test) before T020 (single-pass decode) before T021 (reorder) — same file, must be sequential.
- US3: T022–T026 have no dependencies on each other or on US1/US2 — fully parallel.

### Parallel Opportunities

- All of T002–T009 (US1 tests) in parallel.
- T013–T018 (US1 route-wiring, 6 different files) in parallel, once T012 lands.
- All of T022–T026 (US3, 5 different files) in parallel.
- US1, US2, and US3 as whole phases can be worked in parallel by different people/agents.
- T027 (docs/ exclusion) in parallel with everything in Phases 3–5.

---

## Parallel Example: User Story 1

```bash
# After T010-T011 land, launch all 6 wiring tasks together (different files):
Task: "Construct and apply a local standardRateLimit in backend/src/adapters/users/authRoutes.ts"
Task: "Construct and apply a local standardRateLimit in backend/src/adapters/library/libraryRoutes.ts"
Task: "Construct and apply a local strictRateLimit in backend/src/adapters/googleAuth/googleAuthRoutes.ts"
Task: "Construct and apply a local standardRateLimit in backend/src/adapters/feeds/feedsRoutes.ts"
Task: "Construct local strictRateLimit/standardRateLimit (mixed tiers) in backend/src/adapters/discogsOauth/discogsRoutes.ts"
Task: "Construct and apply a local standardRateLimit in backend/src/adapters/discogsCatalog/discogsRoutes.ts"
```

---

## Implementation Strategy

### MVP First (both P1 stories)

Per research.md §1, the gate's `code-quality` step only fails the build on `security_severity_level: critical|high` alerts — US1 (17 alerts) and US2 (2 alerts) are the 19 of 25 open alerts that are `high`, plus the 2 `high` test-anchoring alerts live in US3. Practically:

1. Complete Phase 1: Setup (T001).
2. Complete Phase 3 (US1) and Phase 4 (US2) — in parallel if staffed, since they touch disjoint files. This alone resolves 19 of the 21 gate-blocking alerts.
3. **STOP and VALIDATE**: run each story's checkpoint independently.
4. Complete Phase 5 (US3) — resolves the remaining 2 gate-blocking alerts (the test-anchoring ones) plus the 4 non-blocking cleanup alerts, reaching the user's "all 25" ask.
5. Complete Phase 6 (T027 docs/ exclusion + T028–T030 pre-merge verification + T031 post-merge `main` confirmation) to reach zero open alerts and close out spec SC-001–SC-005.

### Incremental Delivery

1. Setup → US1 → validate independently → (gate still has US2/US3/docs alerts open, but 17 fewer).
2. Add US2 → validate independently → all `high`-severity alerts now resolved except the 2 test-anchoring ones.
3. Add US3 → validate independently → gate's `security_severity_level` check now passes.
4. Add Phase 6 → zero open alerts, full spec closure.

### Parallel Team Strategy

With 3 developers/agents: one takes US1 (T002–T018), one takes US2 (T019–T021), one takes US3 (T022–T026) — all start immediately after T001, no coordination needed until Phase 6's combined verification (T028–T030), with T031 as a final post-merge confirmation once the PR lands.

---

## Notes

- [P] tasks touch different files and have no unmet dependency at the time they're started.
- Tests are written first within US1 and US2 per Constitution Principle I; US3's two host-anchoring tasks fold the "test" and "fix" into one task since the test file IS the artifact being fixed.
- Commit after each task or logical group, following this repo's Conventional Commits requirement.
- Stop at any Phase 3/4/5 checkpoint to validate that story independently before continuing.
