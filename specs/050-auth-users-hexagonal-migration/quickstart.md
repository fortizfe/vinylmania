# Quickstart: Validating the Auth/Users Hexagonal Migration

Prerequisites: `backend/` dependencies installed (`npm install` in `backend/`), no
`.env` changes needed — this migration doesn't touch configuration.

## 1. Static check: no forbidden direct infrastructure imports in domain/application/ports

```bash
cd backend
grep -rnE "from '(firebase-admin|ioredis)(/|')" \
  src/domain/auth src/domain/users src/application/users src/ports/auth src/ports/users
```

**Expected outcome**: no matches. `src/adapters/auth/firebaseAuthVerifierAdapter.ts`,
`src/adapters/users/firestoreUserRepository.ts`, and `src/adapters/cache/redisClient.ts`
are allowed to import them — that is the adapter-layer implementation (see `plan.md`'s
Constitution Check).

## 2. Static check: the old `middleware/`, `services/`, `cache/`, and `routes/` folders are gone

```bash
cd backend
ls src/middleware src/services src/cache src/routes 2>&1 | grep "No such file"
grep -rn "from '.*middleware/requireAuth'\|from '.*services/userService'\|from '.*routes/auth'\|from '.*cache/cacheAside'\|from '.*cache/redisClient'" src tests
```

**Expected outcome**: all four `ls` targets report "No such file or directory"; the
`grep` returns no matches anywhere in `src/` or `tests/` (spec.md SC-002, SC-004,
SC-006).

## 3. Static check: `config/firebase-admin.ts` is consumed only by adapters, backend-wide

```bash
cd backend
grep -rln "config/firebase-admin" src | grep -v '^src/adapters/'
```

**Expected outcome**: no matches — every remaining consumer of
`getFirebaseAuth`/`getFirestoreDb` is under `src/adapters/` (spec.md FR-005, SC-004).

## 4. Static check: exactly one `CachePort` definition, no domain-local duplicates

```bash
cd backend
grep -rln "interface CachePort" src
```

**Expected outcome**: exactly one match, `src/ports/cache/cachePort.ts` (spec.md
FR-003, SC-003).

## 5. Relocated test suite passes unchanged

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/(auth|users|cache)"
```

**Expected outcome**: every test currently under `userService.test.ts`,
`requireAuth.test.ts`, `auth.contract.test.ts`, `authPreferencesRoute.test.ts`,
`auth.integration.test.ts`, `cacheAside.test.ts`, and `redisClient.test.ts` still
passes from its new location, with the same assertions as before this migration
(spec.md FR-006) — plus two brand-new unit test files
(`requireAuth.test.ts` under `tests/unit/auth/adapters/`,
`userProfileUseCases.test.ts` under `tests/unit/users/application/`) exercising the
new ports against fake test doubles, something this domain could not do before this
migration (spec.md User Stories 1-2).

## 6. Full test suite still green (no regression outside this domain)

```bash
cd backend
npm test
```

**Expected outcome**: all existing backend test files pass, including the eight
already-migrated-domain test files that received a one-line import-path fix for the
relocated cache modules (`feeds/feedsDashboard.contract.test.ts`,
`feeds/feedsSource.contract.test.ts`, four feeds integration tests,
`library/librarySync.integration.test.ts`,
`discogsCatalog/discogsCacheOutage.test.ts` — full list in plan.md's Technical
Context) and the four other domains' route files that received a one-line
`requireAuth` import-path fix (`library`, `discogsCatalog`, `discogsOauth`, `feeds`).

## 7. End-to-end HTTP behavior is unchanged

```bash
cd backend
npm run dev
```

Then, with a valid Firebase ID token (`$ID_TOKEN`):

```bash
# Session creation — 200 with the user profile
curl -s -H "Authorization: Bearer $ID_TOKEN" -X POST \
  http://localhost:3000/api/auth/session | jq .

# Profile lookup — 200 once a session exists
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/auth/me | jq .

# Theme preference update — 200, only themePreference changes
curl -s -H "Authorization: Bearer $ID_TOKEN" -X PATCH \
  -H "Content-Type: application/json" -d '{"themePreference":"dark"}' \
  http://localhost:3000/api/auth/preferences | jq .

# No Authorization header — still 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:3000/api/auth/session

# Invalid preference value — still 400
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $ID_TOKEN" \
  -X PATCH -H "Content-Type: application/json" -d '{"themePreference":"blue"}' \
  http://localhost:3000/api/auth/preferences
```

**Expected outcome**: identical request/response shapes and status codes to today
(spec.md FR-009/SC-005). In particular:

- A second `POST /api/auth/session` call for the same token updates only
  `lastSignInAt` — `displayName`/`email`/`photoURL`/`themePreference` from the first
  call are unchanged in the response (spec.md User Story 1, Acceptance Scenario 2;
  research.md Decision 5).
- `GET /api/auth/me` before any session exists for a token still returns 401, not a
  404 or an empty body.

## 8. Route handler bodies are HTTP-translation-only (manual review checkpoint)

Open `src/adapters/users/authRoutes.ts` and confirm each handler is limited to:
request parsing/validation (the existing Zod schema for `PATCH /preferences`), a
single call into one of `createUserProfileUseCases`'s three returned functions, and
mapping the result (200 payload, 400 for invalid preference input, 401 for a missing
profile on `/me`, 500 for a caught unexpected error) to an HTTP response — no
Firestore call, no create-vs-touch branching logic inline in the route (spec.md User
Story 3, FR-011).

## 9. `requireAuth`'s contract is unchanged for every other domain's routes (manual review checkpoint)

Open `src/adapters/library/libraryRoutes.ts`, `src/adapters/discogsCatalog/discogsRoutes.ts`,
`src/adapters/discogsOauth/discogsRoutes.ts`, and `src/adapters/feeds/feedsRoutes.ts`
and confirm each still imports `requireAuth` as a single ready-to-use middleware
function (now from `../auth/requireAuth` instead of `../../middleware/requireAuth`),
with no other change to how it's used (spec.md User Story 2, Acceptance Scenario 4).
