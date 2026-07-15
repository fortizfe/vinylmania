# Quickstart: Validating the Discogs Catalog Hexagonal Migration

Prerequisites: `backend/` dependencies installed (`npm install` in `backend/`), no
`.env` changes needed — this migration doesn't touch configuration.

## 1. Static check: no forbidden direct infrastructure imports in the catalog domain

```bash
cd backend
grep -rnE "from '(axios|ioredis|firebase-admin)'" \
  src/domain/discogsCatalog src/application/discogsCatalog src/ports/discogsCatalog src/ports/cache
```

**Expected outcome**: no matches. `src/adapters/discogsCatalog/*` and
`src/adapters/cache/*` are allowed to import `axios`/`ioredis` — those are the
adapter-layer implementations (see `plan.md`'s Constitution Check).

## 2. Relocated test suite passes unchanged

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/discogsCatalog"
```

**Expected outcome**: every test currently under the 13 files named in the parent
user story's "Prueba independiente" (relocated to
`tests/{unit,integration,contract}/discogsCatalog/`, except the three resilience-
module unit tests which don't move — research.md Decision 1) still passes, with the
same assertions as before this migration (spec.md FR-006).

## 3. Library domain's suite still passes (proves the `CachePort` relocation didn't regress it)

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/library"
```

**Expected outcome**: every library-domain test (from the prior migration) still
passes — `application/library/syncLibrary.ts`'s `has`/`set` usage of the now-shared
`CachePort` is unchanged, and `createLibraryEntry`/`enrichLibraryEntry`'s import of the
catalog's release lookup resolves to its new location without a behavior change.

## 4. Full test suite still green (no regression outside this domain)

```bash
cd backend
npm test
```

**Expected outcome**: all existing backend test files pass, including every domain
this feature does not touch (`feeds/*`, `discogs/collection/*`, `discogs/oauth/*`,
`auth`) — confirming the migration didn't ripple beyond the catalog domain and its
two documented library-domain touch points.

## 5. End-to-end HTTP behavior is unchanged

```bash
cd backend
npm run dev
```

Then, with a valid Firebase ID token:

```bash
# Search — confirm masters still surface first, and rating enrichment still applies
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  "http://localhost:3000/api/discogs/search?q=Nevermind&type=release" | jq .

# Release detail
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/discogs/releases/249504 | jq .

# Master + master versions
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/discogs/masters/13540 | jq .
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/discogs/masters/13540/versions | jq .
```

**Expected outcome**: identical request/response shapes, status codes, and error
payloads to today (spec.md FR-008/SC-004). In particular:

- Master-type results still surface ahead of every other result on the search
  response.
- A search response served from cache (repeat the same query within its TTL) still
  costs one Redis read with community ratings already attached — not a fresh round of
  per-result rating lookups (research.md Decision 2; observable via response latency
  or by temporarily instrumenting logs for `cache_hit`/`cache_miss` on the search key).
- A not-found release/master/artist still returns the same 404 body; a rate-limited or
  unavailable Discogs response still returns the same 502 `catalog_unavailable` body.

## 6. Route handler bodies are HTTP-translation-only (manual review checkpoint)

Open `src/adapters/discogsCatalog/discogsRoutes.ts` and confirm each handler is
limited to: parsing query/path parameters, a single call into an
`application/discogsCatalog/*` use case (or the port directly for the three simple
lookups that have no application-layer rule of their own — release, master, master
versions), the existing "masters first" response reordering, and mapping the result
(or a caught domain error) to an HTTP response — no inline business orchestration
(spec.md User Story 3).
