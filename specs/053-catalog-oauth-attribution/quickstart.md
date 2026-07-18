# Quickstart: Validating Catalog OAuth Attribution

Prerequisites: backend running locally against the Firebase emulator (existing `npm run dev`/emulator setup used by the collection domain's own tests), `DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET`/`DISCOGS_TOKEN` set in the backend env, and a way to stub Discogs responses (`nock`, matching `backend/tests/helpers/nock.ts`'s existing conventions — reuse it rather than hitting real Discogs).

These scenarios mirror the spec's four user stories 1:1. Each is expressed as an automated test (contract/route-level, using the existing `supertest` + `createApp()` + `createTestSession` + Firestore-emulator pattern from `backend/tests/contract/library/library.contract.test.ts`) plus the manual equivalent for a quick local sanity check.

## Scenario 1 — Linked user's catalog requests are signed with their own account (US1)

**Setup**: Seed `discogsConnections/{uid}` in the emulator with a fixture `DiscogsConnection` (same shape as `collectionClient.contract.test.ts`'s `access-token`/`access-secret` fixture). Stub Discogs (`nock`) to assert the incoming `Authorization` header matches `oauth_token="access-token"` (the linked user's), not `Discogs token=<DISCOGS_TOKEN>`.

**Run**: `GET /api/discogs/search?q=...`, `GET /api/discogs/releases/:id`, `GET /api/discogs/masters/:id`, `GET /api/discogs/masters/:id/versions` as that authenticated user.

**Expected**: `200` on every call; `nock` assertion confirms the OAuth-signed header was used, never `Discogs token=...`. Log output (stdout, structured JSON) shows `meta.credentialType: "user"` on each corresponding Discogs-call log line.

## Scenario 2 — Unlinked user's catalog requests keep working exactly as today (US2)

**Setup**: No `discogsConnections/{uid}` doc for this user. Stub Discogs to assert `Authorization: Discogs token=<DISCOGS_TOKEN>`.

**Run**: Same four endpoints as Scenario 1, as an authenticated user with no link.

**Expected**: `200` on every call, identical response shape to pre-053 behavior (regression check — diff against the existing contract tests for these routes, which must keep passing unmodified). `meta.credentialType: "vinylmania"` in logs.

## Scenario 3 — Revoked link never falls back silently (US3)

**Setup**: Seed a `discogsConnections/{uid}` doc as in Scenario 1. Stub Discogs to respond `401` to a request bearing that connection's `oauth_token`, and separately stub (or assert never called) a `Discogs token=<DISCOGS_TOKEN>`-authenticated request to the same endpoint.

**Run**: Each of the four endpoints as that user.

**Expected**: `401 { "error": "discogs_link_invalid", "message": "Your Discogs link is no longer valid. Please re-link your account from your profile." }`. Assert the `DISCOGS_TOKEN`-stubbed interceptor was **never** hit (proves no silent fallback — this is the load-bearing assertion for FR-004, not just the response body). Log line shows `outcome: 'auth_failed'`, `meta.credentialType: "user"`.

**Non-regression companion**: with no linked account and a stubbed `401` from `DISCOGS_TOKEN` itself, assert the response is the pre-053 `500 internal_error` (not `discogs_link_invalid`) — covers research.md Decision 6's mis-attribution guard.

## Scenario 4 — Audit log distinguishes credential type without leaking secrets (US4)

**Run**: Any of the above three scenarios with log capture enabled (existing structured-logger test pattern, e.g. spying on `console.log`/the logger's output stream).

**Expected**: Every Discogs-call log line includes `meta.credentialType` (`"user"` or `"vinylmania"`); no log line anywhere contains the literal value of `accessToken`, `accessTokenSecret`, or `DISCOGS_TOKEN`. A simple grep-style assertion (`expect(logLine).not.toMatch(connection.accessToken)`) is sufficient.

## Frontend sanity check (manual)

1. Link a Discogs account from `/app/profile`, then revoke it from Discogs's own "Applications" settings page (or, for local testing, delete the emulator's `discogsConnections/{uid}` fixture and instead have the nock stub return 401 for that connection).
2. Visit the search page and run a search, then open a release detail page.
3. **Expected**: instead of a generic error, the page shows the same "Your Discogs link is no longer valid. Please re-link your account..." prompt (with a link to `/app/profile`) already used today when clicking "Add to library" on a revoked link — now also triggered by simply browsing, per contracts and research.md Decision 9.

## Full validation

Run the feature's new and modified test files (see `plan.md`'s Project Structure) plus the existing full catalog/collection suites to confirm no regression:

```bash
cd backend && npm test -- discogsCatalog discogsOauth library
cd frontend && npm test -- SearchResultsPage ReleaseDetailPage MasterReleaseDetailPage
```
