# Quickstart: Validating Discogs Rate Limit Smoothing & Call Reduction

Backend-only feature. No frontend changes, no new REST endpoints — validation happens through the
existing `/api/discogs/*` and collection routes, plus the structured logs described in
`contracts/observability-log-fields.md`.

## Prerequisites

- `backend/.env` configured with `DISCOGS_TOKEN` (catalog client) and, for collection-client
  scenarios, a linked Discogs OAuth connection (`DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`
  or the existing test stub setup already used by `discogsOauthRoutes.test.ts`).
- Redis optional — `withCache` degrades to direct calls without it (unrelated to this feature,
  existing behavior).
- Per the spec's Assumptions, do **not** run the Playwright e2e suite (`/e2e`) as part of this
  feature's local validation loop — a pre-existing, separately-tracked bug blocks it. Everything
  below is unit/contract/integration-test and manual-log-inspection based.

## 1. Automated tests (primary validation)

```bash
cd backend
npm test -- discogsRateLimiter
npm test -- collectionClient
npm test -- discogsClient.contract
npm test -- discogsRateLimitSmoothing
```

Expected: all new/modified suites pass, covering:

- `discogsRateLimiter.test.ts` — delay formula (threshold crossing, `MAX_WAIT_MS` cap, header
  correction, fail-soft fallback) using Jest fake timers.
- `collectionClient.contract.test.ts` — retry-then-succeed and exhaustion for
  `listAllInstances`/`setRating`/`setFieldValue`/`deleteInstance`; **no** retry for
  `addReleaseToCollection` on a 429/5xx; shared circuit-breaker state observable across both
  clients in the same test.
- `discogsClient.contract.test.ts` (extended) — a burst of requests against a `nock` stub that
  reports a shrinking `x-discogs-ratelimit-remaining` observably slows down (via fake timers) once
  under the safety threshold, and never blocks past `MAX_WAIT_MS`.
- `discogsRateLimitSmoothing.test.ts` (integration) — end-to-end coverage of US1 (spacing under
  budget pressure), US2 (bounded rating-enrichment concurrency on a cold-cache search), US3
  (collection retry parity, `addReleaseToCollection` exclusion).

## 2. Manual validation — User Story 1 (preventive throttle)

1. Start the backend against a stub/mock Discogs host that returns a low
   `X-Discogs-Ratelimit-Remaining` (e.g. `5`) on every response (reuse the existing e2e Discogs
   stub server referenced by `DISCOGS_BASE_URL`/`DISCOGS_OAUTH_BASE_URL` env overrides, pointed at
   a local stub instead of the real API — do not point this at the live Discogs API for repeated
   burst testing).
2. Fire several `/api/discogs/search?q=...` requests back-to-back.
3. Tail backend logs and confirm `outcome: "throttled"` lines appear once `remaining` crosses the
   safety threshold, each with `meta.delayMs ≤ 1500`.
4. Confirm no request fails or hangs beyond `MAX_WAIT_MS` — every throttled request still
   completes.

## 3. Manual validation — User Story 2 (search burst concurrency)

1. Point the search at a query known to return a full page of `release`/`master` results with a
   cold cache (clear/skip Redis, or use fresh discogsIds).
2. Observe (via the stub's own request log, or backend logs' `route` field for
   `/releases/:id/rating`) that no more than 5 rating lookups are ever outstanding at once for
   that single search.
3. Confirm the search response still returns in a time that feels fast (a few hundred ms to low
   seconds depending on the stub's simulated latency) — not materially slower than before for a
   page of ~10–20 results.
4. Re-run the same query with a warm cache; confirm response time and log lines show no new
   Discogs calls (cache hits bypass enrichment entirely).

## 4. Manual validation — User Story 3 (collection retry parity)

1. Using the stub, configure one collection endpoint (e.g.
   `/users/:username/collection/folders/0/releases`) to fail once with a `429` then succeed.
2. Trigger a library sync (or call the corresponding backend route) and confirm it succeeds
   without the collector seeing an error — check logs for an `outcome: "success"` line with
   `meta.attempts: 2`.
3. Configure `POST /users/:username/collection/folders/:id/releases/:releaseId` (add-to-collection)
   to fail with a `429`; confirm the failure surfaces immediately to the caller with **no** retry
   attempt logged (a single `outcome: "rate_limited"` line, no `'throttled'`-then-retry sequence
   for that call).
4. Confirm a non-transient failure (e.g. stub returns `401`) on any collection call still fails
   immediately with `DiscogsAuthError`, unchanged from today.

## Success criteria mapping

| Spec SC | How this quickstart validates it |
|---|---|
| SC-001 / SC-003 | §2 — `'throttled'` log lines show spacing kicking in before Discogs ever returns a 429. |
| SC-002 | §3 — rating-enrichment concurrency never exceeds 5 in flight for one search. |
| SC-004 | §4 — collection reads/idempotent mutations tolerate a transient 429; `addReleaseToCollection` still fails immediately. |
