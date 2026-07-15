# Quickstart: Validating the Discogs OAuth + Collection Hexagonal Migration

Prerequisites: `backend/` dependencies installed (`npm install` in `backend/`), no
`.env` changes needed — this migration doesn't touch configuration. Requires
`DISCOGS_CONSUMER_KEY`/`DISCOGS_CONSUMER_SECRET` set for step 5 (already required by
today's OAuth flow).

## 1. Static check: no forbidden direct infrastructure imports in this domain

```bash
cd backend
grep -rnE "from '(axios|firebase-admin)'" \
  src/domain/discogsOauth src/application/discogsOauth src/ports/discogsOauth
```

**Expected outcome**: no matches. `src/adapters/discogsOauth/*` is allowed to import
`axios`/`firebase-admin` — that is the adapter-layer implementation (see `plan.md`'s
Constitution Check).

## 2. Static check: the library domain's two provisional ports are gone

```bash
cd backend
ls src/ports/library/discogsCollectionPort.ts src/ports/library/discogsConnectionPort.ts \
   src/adapters/library/discogsCollectionAdapter.ts src/adapters/library/discogsConnectionAdapter.ts \
   2>&1 | grep "No such file"
grep -rn "ports/library/discogsCollectionPort\|ports/library/discogsConnectionPort" src tests
```

**Expected outcome**: the four `ls` targets all report "No such file or directory";
the `grep` returns no matches anywhere in `src/` or `tests/` (spec.md FR-005, SC-004).

## 3. Relocated test suite passes unchanged

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/discogsOauth"
```

**Expected outcome**: every test currently under `discogsOauthService.test.ts`,
`discogsOauthSignature.test.ts`, `discogsOauthRoutes.test.ts`,
`collectionClient.contract.test.ts`, and `conditionGrading.test.ts` still passes from
its new location, with the same assertions as before this migration (spec.md FR-008),
plus the two new unit tests for `startLink`/`completeLink` against a fake
`DiscogsConnectionPort`.

## 4. Library domain's suite still passes (proves the port consolidation didn't regress it)

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/library"
```

**Expected outcome**: every library-domain test still passes —
`createLibraryEntry`/`deleteLibraryEntry`/`getLibraryEntry`/`updateLibraryEntry`/
`syncLibrary`/`discogsCopyData`'s use of `DiscogsCollectionPort`/`DiscogsConnectionPort`
is unchanged in shape, only resolved from the new location (spec.md FR-011).

## 5. Full test suite still green (no regression outside this domain)

```bash
cd backend
npm test
```

**Expected outcome**: all existing backend test files pass, including every domain
this feature does not touch (`feeds/*`, `auth`, and the already-migrated `library`/
`discogsCatalog` domains) — confirming the migration didn't ripple beyond this domain
and its documented library-domain touch points.

## 6. End-to-end HTTP behavior is unchanged

```bash
cd backend
npm run dev
```

Then, with a valid Firebase ID token (`$ID_TOKEN`):

```bash
# Start a link — confirm an authorizeUrl comes back, or 409 if already connected
curl -s -X POST -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/discogs/oauth/request | jq .

# Status
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/discogs/oauth/status | jq .

# Disconnect
curl -s -X DELETE -H "Authorization: Bearer $ID_TOKEN" \
  -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/discogs/oauth/connection
```

**Expected outcome**: identical request/response shapes, status codes, and error
payloads to today (spec.md FR-010/SC-005). In particular:

- A second `POST /request` (or `/complete`) while already connected still returns the
  same 409 `already_connected` body — now thrown from inside the use case instead of
  checked inline in the route (research.md Decision 2), but observably identical.
- An expired or already-consumed link attempt on `POST /complete` still returns the
  same 400 body with the same `expired_request`/`invalid_request` codes.
- `GET /status` and `DELETE /connection` are unaffected by this feature's scope beyond
  the import-path change; `DELETE /connection` still invalidates the user's cached
  collection field map (now via `CachePort.invalidate`, not a direct import).

## 7. Route handler bodies are HTTP-translation-only (manual review checkpoint)

Open `src/adapters/discogsOauth/discogsRoutes.ts` and confirm each handler is limited
to: parsing/validating the request body, a single call into an
`application/discogsOauth/*` use case, and mapping the result (or a caught
`DiscogsOauthFlowError`/`DiscogsError`) to an HTTP response via the existing
`handleFailure` — no inline `already-connected` check or other business orchestration
(spec.md User Story 3, research.md Decision 2).
