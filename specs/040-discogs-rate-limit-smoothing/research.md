# Phase 0 Research: Discogs Rate Limit Smoothing & Call Reduction

All items below were resolved from the existing codebase (`backend/src/discogs/discogsClient.ts`,
`discogsRetry.ts`, `discogsCircuitBreaker.ts`, `discogsErrors.ts`,
`backend/src/discogs/collection/collectionClient.ts`, `backend/src/discogs/oauth/oauthHttpClient.ts`,
`backend/src/library/concurrency.ts`, `backend/src/library/libraryEnrichment.ts`) plus the spec's
Clarifications session (2026-07-13) and feature 029's precedent (retry/circuit-breaker on the
catalog client). No unresolved `NEEDS CLARIFICATION` markers remain in the Technical Context.

## 1. Local throttle mechanism: a new hand-rolled `discogsRateLimiter.ts` singleton

- **Decision**: Add `backend/src/discogs/discogsRateLimiter.ts`, a module-level singleton (same
  reuse pattern as `discogsCircuitBreaker.ts` and `sharedClient` in `discogsClient.ts`) that models
  a hybrid local-count + header-corrected budget:
  - State: `limit` (last known per-minute cap, default `60`), `remaining` (last known/estimated
    requests left in the current window, default `= limit`), `windowResetAt` (an approximate
    60-second horizon, re-anchored every time a real header is observed).
  - `acquireSlot(): Promise<void>` — called once per outgoing HTTP attempt (original or retried).
    Synchronously computes a delay from the current state, decrements `remaining` by 1
    immediately (before any `await`, so concurrent calls in the same event-loop tick each see a
    distinct, correctly-decremented count — no lock needed, Node is single-threaded), then
    `await`s that delay (or returns immediately if the delay is 0).
  - `recordRateLimitHeaders(headers): void` — called on every response (success or error) that
    carries `x-discogs-ratelimit`/`x-discogs-ratelimit-remaining`, correcting `remaining`/`limit`
    to Discogs' authoritative count and re-anchoring `windowResetAt = now + 60_000`.
- **Rationale**: FR-001 requires tracking the header-reported budget; FR-006 requires a
  conservative default *before* any header has been observed, "rather than sending requests
  unthrottled" — a purely header-driven design would send every request unthrottled until the
  first response arrives. Decrementing a locally-assumed budget (seeded at the documented
  authenticated limit) from the very first request satisfies FR-006, while the header correction
  keeps the count in sync with Discogs' authoritative view (which may differ if e.g. other traffic
  shares the IP) — directly satisfying FR-001/FR-015. This mirrors the project's established
  pattern (`cacheAside.ts`, `discogsCircuitBreaker.ts`) of a small, fully-owned, in-memory,
  per-process module over a library.
- **Alternatives considered**: A pure token-bucket that ignores Discogs' reported `remaining`
  entirely and self-paces at a fixed `limit/60` rate (rejected — would drift from reality whenever
  something other than this process's own requests consumes the same per-IP budget, e.g. another
  instance or a manual API call, which is exactly the scenario FR-001/edge cases ask the throttle
  to react to); waiting for Discogs to report an explicit reset timestamp (rejected — Discogs does
  not document one; the 60-second re-anchored horizon is the standard approximation for a
  per-minute limit and is precise enough for spacing purposes, not for exact accounting).

## 2. Delay formula and constants

- **Decision**:
  ```
  SAFETY_THRESHOLD_RATIO = 0.15   // start spacing once remaining ≤ 15% of the known limit
  MAX_WAIT_MS = 1_500             // short cap (FR-003a)
  WINDOW_MS = 60_000              // approximate per-minute horizon (§1)
  DEFAULT_LIMIT = 60              // documented authenticated limit (FR-006)

  threshold = ceil(limit * SAFETY_THRESHOLD_RATIO)
  if remaining > threshold:  delay = 0
  else:                      delay = min(MAX_WAIT_MS, windowRemainingMs / max(remaining, 1))
  ```
- **Rationale**: FR-003 requires the *minimum* delay needed to stay within budget, not a fixed
  wait — spreading the remaining window time evenly across the remaining request count achieves
  that, and shrinks toward `MAX_WAIT_MS` as `remaining` approaches zero. Expressing the threshold
  as a ratio of the *currently known* limit (not a hardcoded absolute number) keeps the safety
  margin proportionate if Discogs' documented limit ever changes (FR-015), rather than a threshold
  tuned only for 60/min. `1_500`ms keeps a throttled live request's added latency well inside the
  existing `PER_ATTEMPT_TIMEOUT_MS` (4000ms) and `RATING_LOOKUP_TIMEOUT_MS` (2000ms) budgets, so a
  throttled request still has headroom to complete before its own request-level timeout fires.
- **Alternatives considered**: A fixed per-request delay once under threshold (e.g. always wait
  500ms) — rejected, directly contradicts FR-003's "minimum necessary" requirement (Clarifications,
  same reasoning feature 029 already rejected a Retry-After-based fixed wait for). An absolute
  (non-ratio) threshold — rejected in favor of the ratio for FR-015's adaptiveness, at negligible
  extra complexity (one multiplication).

## 3. Where the throttle is invoked: the request interceptor of both clients, unconditionally

- **Decision**: `acquireSlot()` is awaited in the request interceptor of `getDiscogsHttpClient()`
  (`discogsClient.ts`) and of `createClient()` (`collectionClient.ts`), for **every** request —
  including the rating lookup (`__skipResilience: true`) and retried attempts (which re-enter the
  request interceptor when the response interceptor calls `instance.request(config)` again). The
  existing `__skipResilience` flag is *not* extended to skip the throttle; it continues to mean
  "skip retry + circuit breaker" only. In `discogsClient.ts`, the circuit-breaker short-circuit
  check and the throttle become two independent gates:
  ```ts
  instance.interceptors.request.use(async (config: ResilienceConfig) => {
    if (!config.__skipResilience && shouldShortCircuit()) {
      return Promise.reject(new CircuitOpenError(config.url ?? 'unknown'));
    }
    await acquireSlot();
    return config;
  });
  ```
- **Rationale**: FR-002/FR-004 describe a single shared budget for "outgoing Discogs requests"
  without carving out an exception for the rating lookup, and Story 2's own concurrency fix already
  bounds how many rating calls run at once — the two mechanisms are complementary, not redundant
  (concurrency bounds *parallelism*, the throttle bounds *rate against the reported budget*).
  Placing the check in the circuit-breaker's existing short-circuit branch keeps a
  breaker-rejected request from also paying a throttle delay it will never benefit from (fail
  fast, don't wait first). Retried attempts re-entering the request interceptor is exactly how
  feature 029's `instance.request(config)` re-issue already works, so retries are throttled the
  same as first attempts with zero extra plumbing.
- **Alternatives considered**: Gating the throttle behind `__skipResilience` too (rejected — would
  leave the rating lookup, the single largest source of request volume per search per Story 2's
  own "Why this priority", outside the one cross-cutting preventive mechanism Story 1 exists to
  add); throttling only the response interceptor's retry path, not first attempts (rejected —
  contradicts FR-002, which applies before the budget is exhausted, not only during recovery).

## 4. Extending retry + circuit breaker to the collection client: reuse, don't re-abstract

- **Decision**: `collectionClient.ts`'s `createClient()` gains its own request/response
  interceptor logic that directly imports and reuses the existing pure functions from
  `discogsRetry.ts` (`classifyForRetry`, `backoffDelayMs`, `MAX_ATTEMPTS`,
  `PER_ATTEMPT_TIMEOUT_MS`) and the existing singleton functions from `discogsCircuitBreaker.ts`
  (`shouldShortCircuit`, `recordSuccess`, `recordExhaustedFailure`) — unmodified. No shared
  interceptor factory is extracted between `discogsClient.ts` and `collectionClient.ts`; the retry
  loop shape (`config.__attempt = attempt + 1; await delay(...); return instance.request(config);`)
  is duplicated in `collectionClient.ts`, matching that file's own `instance` closure.
- **Rationale**: `discogsCircuitBreaker.ts`'s functions are already framework-agnostic singletons
  with no axios-specific coupling — sharing *state* (FR-014) requires nothing more than both files
  importing the same module, which module-level singletons in Node already guarantee (one loaded
  instance per process). Extracting a shared interceptor *factory* to avoid ~40 lines of duplicated
  wiring would touch `discogsClient.ts`'s already-tested interceptor beyond what this feature
  needs (Principle IV: extend via composition, don't modify stable code more than required) and
  would go against this codebase's own established precedent — `discogsClient.ts`,
  `collectionClient.ts`, and `oauthHttpClient.ts` already each implement their own independent
  status-code-to-error interceptor rather than sharing one, because their error-mapping details
  differ (e.g. `oauthHttpClient.ts` never checks 401/403, `collectionClient.ts` already had its own
  429 mapping before this feature). Following that precedent is simpler than introducing a new
  shared abstraction for two call sites (Principle III: YAGNI).
- **Alternatives considered**: A shared `createResilientInterceptor(instance, errorMapper)` factory
  used by both clients (rejected per above — real but modest duplication is cheaper here than a
  new cross-cutting abstraction, consistent with this codebase's existing choice to duplicate
  interceptor wiring three times already); giving `collectionClient.ts` its own independent
  circuit breaker (rejected — directly violates FR-014, which requires one shared breaker since
  both clients consume the same per-IP limit).

## 5. Excluding `addReleaseToCollection` from retry without excluding it from the breaker

- **Decision**: Add a second, narrower opt-out flag alongside the existing `__skipResilience`
  pattern: `__skipRetry?: boolean`, checked only in the retry-eligibility branch (not in the
  circuit-breaker check). `addReleaseToCollection`'s POST call passes `{ __skipRetry: true }`.
  Every other collection call (`listAllInstances`, `getInstancesForRelease`, `getFieldMap`,
  `deleteInstance`, `setRating`, `setFieldValue`) passes no flag and is fully retry+breaker-eligible.
- **Rationale**: FR-016 forbids automatic retry of `addReleaseToCollection` specifically (a
  non-idempotent write — retrying after an ambiguous failure risks a duplicate collection entry),
  but nothing in the spec exempts it from *contributing to* or *being blocked by* the shared
  circuit breaker (FR-014 says both clients "contribute to the same exhausted-failure counter"
  without carving out an exception for this one call) — if the breaker is already open, failing
  `addReleaseToCollection` fast (no network call) is strictly better than letting it hit a Discogs
  outage it can't recover from anyway. A single attempt that fails still counts as one
  "exhausted" strike (there was only ever going to be one attempt), so `recordExhaustedFailure()`
  still fires normally for it. Reusing the existing `__skipResilience`-style boolean-flag pattern
  (rather than inventing a new mechanism) keeps this consistent with feature 029's own precedent
  for the rating lookup.
- **Alternatives considered**: Reusing `__skipResilience` as-is for `addReleaseToCollection`
  (rejected — that flag also skips the circuit-breaker check, which would let
  `addReleaseToCollection` bypass an open breaker and keep hitting a known-failing Discogs during
  an outage, contradicting FR-014's shared-state intent); a request-count-based idempotency key
  instead of excluding retry (rejected — Discogs' collection-add endpoint documents no idempotency
  key support; out of scope per spec's Out of Scope list, which explicitly keeps collection
  mutations synchronous with no new retry controls).

## 6. Search rating-enrichment concurrency: reuse `mapWithConcurrency`, relocated to a shared home

- **Decision**: Bound `searchCatalog`'s rating-enrichment fan-out
  (`backend/src/discogs/discogsClient.ts`) with the same `mapWithConcurrency` helper
  `libraryEnrichment.ts` already uses, at a concurrency of `5` (`SEARCH_RATING_CONCURRENCY`),
  matching `libraryEnrichment.ts`'s `ENRICHMENT_CONCURRENCY`. Because `discogs/` is the
  lower-level module (`library/libraryEnrichment.ts` already depends on `discogs/discogsClient.ts`,
  not the reverse), `mapWithConcurrency` moves from `backend/src/library/concurrency.ts` to a new
  `backend/src/shared/concurrency.ts`; `libraryEnrichment.ts`'s import path is updated, its
  behavior is unchanged.
- **Rationale**: Directly implements FR-009, using the exact reference concurrency value the spec
  names ("consistent with the concurrency limit already used for library enrichment"). Moving the
  now-two-domain utility to a neutral `shared/` module avoids `discogs/` (a lower-level integration
  layer per Constitution Principle II) importing from `library/` (a higher-level domain module) —
  a one-file relocation, not a rewrite; `mapWithConcurrency`'s implementation and signature are
  unchanged.
- **Alternatives considered**: Importing `mapWithConcurrency` directly from
  `library/concurrency.ts` into `discogsClient.ts` without moving it (rejected — works today with
  no cycle, since `library/concurrency.ts` has zero imports, but inverts the codebase's established
  dependency direction between the two domains for no real savings over a one-file move); a
  different concurrency value tuned specifically for search (rejected — the spec explicitly
  anchors this to the library-enrichment reference value, and introducing a second tuned constant
  with no distinguishing rationale would be unjustified complexity per Principle III).

## 7. Cold start and fail-soft behavior of the limiter

- **Decision**: `discogsRateLimiter.ts` initializes `remaining = limit = DEFAULT_LIMIT (60)` and
  `windowResetAt = now + WINDOW_MS` at module load (process cold start) — i.e. requests are spaced
  as if a fresh, full authenticated window just started, exactly matching FR-006. `acquireSlot()`
  and `recordRateLimitHeaders()` each wrap their state-mutating logic in a `try/catch`; on any
  unexpected error, they log a `warn` (`outcome: 'throttle_unavailable'`, reusing the existing
  structured-logger contract) and fall back to zero delay — never blocking or dropping the
  request — satisfying FR-005.
- **Rationale**: FR-006's "conservative" default means *don't assume unlimited headroom before
  Discogs has said otherwise*, which a locally-decremented budget seeded at the documented limit
  achieves without needing any real response first. Because this feature's local-throttle state is
  explicitly in-memory only (Assumptions: distributed coordination is out of scope), genuine
  "unavailability" of the tracking mechanism is a very unlikely runtime scenario (no external
  store to fail) — the `try/catch` is a cheap, direct implementation of FR-005's requirement
  regardless, consistent with `cacheAside.ts`'s same defensive pattern around its (real, external)
  Redis dependency.
- **Alternatives considered**: Seeding `remaining = 0` at cold start (rejected — "conservative"
  does not mean "block everything until the first response"; FR-006 explicitly says "rather than
  sending requests unthrottled," not "rather than sending requests at all," and Story 1's
  Acceptance Scenario 3 requires the delay to stay minimal when budget is ample, which a
  zero-remaining seed would violate for the very first requests of a cold process).

## 8. Observability

- **Decision**: Extend `LogOutcome` in `backend/src/config/logger.ts` with two new values:
  `'throttled'` (info level, logged by `acquireSlot()` whenever it computes a non-zero delay,
  with `meta: { delayMs, remaining, limit }`) and `'throttle_unavailable'` (warn level, §7's
  fail-soft path). No change to existing outcomes/fields from feature 029
  (`circuit_open`, `meta.attempts`, etc.) — this feature's logging is additive.
- **Rationale**: SC-003 requires the outgoing request rate to be verifiable "through existing
  operational logs" — a dedicated `'throttled'` outcome line, greppable exactly like every other
  outcome in this project (Principle V), is the direct, minimal way to make Story 1's spacing
  behavior observable without new metrics infrastructure, mirroring feature 029's `circuit_open`
  precedent exactly.
- **Alternatives considered**: Logging every single `acquireSlot()` call including zero-delay ones
  (rejected — would flood the log with a line per Discogs request for no diagnostic gain; only the
  cases where throttling actually did something are worth a dedicated outcome).

## 9. Testing strategy

- **Decision**: Unit tests for `discogsRateLimiter.ts` (delay-formula math and header-parsing/
  correction as pure-ish state transitions, using Jest fake timers to control `Date.now()`/
  `setTimeout` deterministically — the same technique feature 029 introduced for
  `discogsCircuitBreaker.test.ts`). Contract tests extend
  `backend/tests/contract/discogsClient.contract.test.ts` (throttle delay observed via `nock`
  header stubbing) and add a new `backend/tests/contract/collectionClient.contract.test.ts`
  (retry-then-succeed, exhaustion, no-retry-on-`addReleaseToCollection`, shared breaker state with
  the catalog client). A new integration test
  (`backend/tests/integration/discogsRateLimitSmoothing.test.ts`) covers all three user stories
  end-to-end. Per the spec's Assumptions, the Playwright e2e suite (`/e2e`) is **not** run as part
  of this feature's local implementation loop (a pre-existing, separately-tracked e2e bug must be
  fixed first) — this is a backend-only feature, so no new e2e coverage is owed here regardless
  (Constitution's e2e gate only applies to PRs that change `/frontend`).
- **Rationale**: Matches Principle I (Test-First) and directly continues feature 029's own testing
  precedent for this exact area of the codebase.
- **Alternatives considered**: Real `setTimeout` delays in tests (rejected — same reasoning as
  feature 029: slow and flaky versus deterministic fake timers).
