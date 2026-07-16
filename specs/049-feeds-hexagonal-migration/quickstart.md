# Quickstart: Validating the Feeds/RSS Hexagonal Migration

Prerequisites: `backend/` dependencies installed (`npm install` in `backend/`), no
`.env` changes needed — this migration doesn't touch configuration or add any new feed
source.

## 1. Static check: no forbidden direct infrastructure imports in this domain

```bash
cd backend
grep -rnE "from '(axios|rss-parser)'" \
  src/domain/feeds src/application/feeds src/ports/feeds
```

**Expected outcome**: no matches. `src/adapters/feeds/feedSourceAdapter.ts` is allowed
to import `axios`/`rss-parser` — that is the adapter-layer implementation (see
`plan.md`'s Constitution Check).

## 2. Static check: the old `feeds/` module and `routes/feeds.ts` are gone

```bash
cd backend
ls src/feeds src/routes/feeds.ts 2>&1 | grep "No such file"
grep -rn "from '.*feeds/feedClient'\|from '.*feeds/feedAggregator'\|from '.*routes/feeds'" src tests
```

**Expected outcome**: both `ls` targets report "No such file or directory"; the `grep`
returns no matches anywhere in `src/` or `tests/` (spec.md SC-004).

## 3. Static check: no domain-level file imports `rss-parser`'s own types

```bash
cd backend
grep -rn "rss-parser" src/domain/feeds
```

**Expected outcome**: no matches — `domain/feeds/feedMapper.ts` consumes the
domain-owned `RawFeedItem` type, never `rss-parser`'s `Parser.Item`/`Parser.Output`
(spec.md FR-012, research.md Decision 1).

## 4. Relocated test suite passes unchanged

```bash
cd backend
npm test -- --testPathPattern="tests/(unit|integration|contract)/feeds"
```

**Expected outcome**: every test currently under `feedAggregator.test.ts`,
`feedClient.test.ts`, `feedMapper.test.ts`, `feedSources.test.ts`,
`feedsDashboard.contract.test.ts`, `feedsSource.contract.test.ts`,
`feedsDashboard.integration.test.ts`,
`feedsDashboardExpandedSources.integration.test.ts`,
`feedsDashboardNewSources.integration.test.ts`, and
`feedsSourceDirect.integration.test.ts` still passes from its new location, with the
same assertions as before this migration (spec.md FR-008) — `getFeedsDashboard.test.ts`
(relocated from `feedAggregator.test.ts`) and `feedSourceAdapter.test.ts` (relocated
from `feedClient.test.ts`) use a different test-double mechanism (fake port/cache
instead of `jest.mock()`, updated return-shape assertions) but assert the same
behavior.

## 5. Full test suite still green (no regression outside this domain)

```bash
cd backend
npm test
```

**Expected outcome**: all existing backend test files pass, including every domain
this feature does not touch (`auth`/`users`, and the already-migrated `library`/
`discogsCatalog`/`discogsOauth` domains) — confirming the migration didn't ripple
beyond this domain.

## 6. End-to-end HTTP behavior is unchanged

```bash
cd backend
npm run dev
```

Then, with a valid Firebase ID token (`$ID_TOKEN`):

```bash
# Dashboard — every enabled source's articles, grouped by category
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/feeds/dashboard | jq '.sourceStatuses'

# Single source — uncapped article list
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/feeds/sources/metal-injection | jq '.status'

# Unknown source id — still 404
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $ID_TOKEN" \
  http://localhost:3000/api/feeds/sources/not-a-real-source
```

**Expected outcome**: identical request/response shapes, status codes, and error
payloads to today (spec.md FR-010/SC-005). In particular:

- A dashboard request with one source unreachable still returns 200 with the other
  sources' articles intact and that one source marked `"status": "unavailable"` in
  `sourceStatuses` — never a failed request.
- An unknown or disabled source id on `GET /sources/:sourceId` still returns 404 with
  the same `source_not_found` body.

## 7. Route handler bodies are HTTP-translation-only (manual review checkpoint)

Open `src/adapters/feeds/feedsRoutes.ts` and confirm each handler is limited to: a
single call into the `application/feeds/getFeedsDashboard.ts` use case, and mapping the
result (200 payload, 404 for a `null` single-source lookup, 500 for a caught
unexpected error) to an HTTP response — no per-source retry, grouping, or status logic
inline in the route (spec.md User Story 3).
