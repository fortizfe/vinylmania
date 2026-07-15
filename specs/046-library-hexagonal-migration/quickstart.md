# Quickstart: Validating the Library Hexagonal Migration

Prerequisites: `backend/` dependencies installed (`npm install` in `backend/`), Firebase CLI
available locally (already a dev dependency, used by the existing `npm test` script), no `.env`
changes needed — this migration doesn't touch configuration or environment variables.

## 1. Static check: no forbidden direct infrastructure imports in the library domain

```bash
cd backend
grep -rnE "from '(firebase-admin|axios|ioredis)'" \
  src/domain/library src/application/library src/ports/library
```

**Expected outcome**: no matches. `src/adapters/library/*` is allowed to import
`config/firebase-admin.ts` (which itself imports `firebase-admin`) and the not-yet-migrated
`discogs/collection/collectionClient.ts` / `discogs/oauth/discogsOauthService.ts` / `cache/redisClient.ts` —
none of those adapter-layer imports are a violation (see `plan.md`'s Constitution Check).

## 2. Relocated test suite passes unchanged

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/library"
```

**Expected outcome**: every test currently under `tests/unit/libraryService.test.ts`,
`tests/unit/librarySyncService.test.ts`, `tests/unit/libraryEnrichment.test.ts`,
`tests/contract/library.contract.test.ts`, `tests/integration/library.integration.test.ts`, and
`tests/integration/librarySync.integration.test.ts` still exists (at its new path under
`tests/{unit,integration,contract}/library/`) and passes, with the same assertions as before this
migration (`spec.md` FR-004). The unit tests for `application/library/syncLibrary.ts` no longer use
`jest.mock('<module path>')` — they construct fake `LibraryRepositoryPort` /
`DiscogsCollectionPort` / `DiscogsConnectionPort` / `CachePort` implementations in-memory and pass
them into the use case's factory function directly (research.md Decision 5).

This command runs a subset via the existing `firebase emulators:exec` wrapper already configured in
`backend/package.json`'s `test` script — no new tooling required. (Do not block on the *full*
backend suite here; scoping to `tests/**/library` keeps this quickstart fast. Run the full
`npm test` separately before considering the feature done.)

## 3. Full test suite still green (no regression outside `library/`)

```bash
cd backend
npm test
```

**Expected outcome**: all ~43 existing backend test files pass, including every domain this feature
does not touch (`discogs/*`, `feeds/*`, `auth`) — confirming the migration didn't ripple beyond
`library/` and `routes/library.ts` (`spec.md` SC-001, "no cross-domain blast radius").

## 4. End-to-end HTTP behavior is unchanged

```bash
cd backend
npm run dev
```

Then, with a valid Firebase ID token and a linked Discogs test account (existing local dev setup,
unchanged by this feature):

```bash
# List (triggers a sync)
curl -s -H "Authorization: Bearer $ID_TOKEN" http://localhost:3000/api/library | jq .

# Create
curl -s -X POST -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" \
  -d '{"discogsReleaseId": 130076}' http://localhost:3000/api/library | jq .
```

**Expected outcome**: identical request/response shapes, status codes, and error payloads to
`specs/016-library-discogs-sync/contracts/library-sync-api.md` (unchanged by this feature — see
`spec.md` FR-008). In particular:

- An unlinked account still gets `409 discogs_not_linked`.
- A Discogs rate-limit still surfaces as `429 discogs_rate_limited` (via the same
  `respondCollectionError` pattern, now living in `adapters/library/libraryRoutes.ts`).
- `legacyCondition`/`legacyNotes` still never appear in any response body.

## 5. Route handler bodies are HTTP-translation-only (manual review checkpoint)

Open `src/adapters/library/libraryRoutes.ts` and confirm each handler is limited to: parsing/validating
the request (Zod schemas, query params), a single call into an `application/library/*` use case, and
mapping the result (or a caught domain error) to an HTTP response — no inline business orchestration
(`spec.md` User Story 3, FR-003).
