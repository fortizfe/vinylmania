# API Contract: `GET /api/discogs/suggest` (069)

New route in the existing `backend/src/adapters/discogsCatalog/discogsRoutes.ts` (research [D1](../research.md)). `GET /api/discogs/search` and the three other routes in that file are **unchanged**.

Principle VI: a new endpoint plus an additive `resultType` option on an internal port → **MINOR**. No stored data changes, so no migration.

## 1. Request

```http
GET /api/discogs/suggest?q=iron%20mai
Authorization: Bearer <vinylmania session token>
```

| Part | Value |
|---|---|
| Middleware order | `suggestRateLimit` → `requireAuth` (same order as the other routes in the file) |
| `q` | The raw text from the field. Trimmed, internal whitespace collapsed, lower-cased server-side before it becomes the cache key. |
| Other params | None. No `page`, no `perPage`, no filters, no `type` — all are ignored if sent. |
| Credential | `resolveCatalogCredential(discogsConnectionAdapter, req.auth.uid)` — the existing resolver; an unlinked collector gets the `vinylmania` credential and suggestions work (spec Assumptions). |

## 2. Success — `200`

```json
{
  "suggestions": [
    { "discogsId": 251595, "resultType": "artist", "title": "Iron Maiden",
      "thumbnailUrl": "https://i.discogs.com/…" },
    { "discogsId": 1198042, "resultType": "master", "title": "The Number Of The Beast",
      "artist": "Iron Maiden", "year": 1982, "format": "Vinyl",
      "thumbnailUrl": "https://i.discogs.com/…" }
  ]
}
```

- `suggestions`: **0 to 5** items, allocated and ordered by [data-model.md §3](../data-model.md) — artists first, then albums, each in Discogs' own order.
- Item shape: [data-model.md §2](../data-model.md). Optional fields are **omitted**, never `null`.
- **No pagination object, no `communityRating`, no echo of `q`** (the cache entry is shared across query spellings — research D5).
- `q` with fewer than 2 non-whitespace characters → `200 { "suggestions": [] }` with **no upstream request** (defensive; the client already gates on 2, FR-010).

## 3. Errors

| Status | Body | When |
|---|---|---|
| `429` | `{ "error": "rate_limited", "message": "Too many requests. Please try again shortly." }` | The route's own bucket (research D6) |
| `401` | existing `requireAuth` body | No / invalid session token |
| `401` | `{ "error": "discogs_link_invalid", … }` | A linked Discogs account was rejected — produced by the existing `respondDiscogsAuthError(credential.type, err)`, byte-identical to `/api/discogs/search` |
| `502` | `{ "error": "catalog_unavailable", "message": "The catalog service is temporarily unavailable. Please try again." }` | `DiscogsRateLimitError` or `DiscogsUnavailableError` |
| `500` | `{ "error": "internal_error", "message": "Something went wrong. Please try again." }` | Anything else |

Every failure is a failure **of the panel only**: the client keeps the typed text and submitting it still reaches `/app/search` (FR-020, SC-009).

## 4. Upstream cost, cache and rate limit

| Property | Value |
|---|---|
| Upstream requests per **cache miss** | Exactly **1** — `discogsCatalog.searchCatalog(credential, q, { resultType: 'any', page: 1, perPage: 20 })` (SC-011) |
| Upstream requests per **cache hit** | **0** (FR-017) |
| Rating enrichment | **None.** `searchCatalogWithRatings` is not on this path |
| Cache key | `discogs:suggest:{normalizedQuery}` — no credential, no page, no filters (research D5) |
| Cache TTL | `300` s |
| Cached value | The **shaped** `CatalogSuggestion[]` (≤ 5 items), not the raw hits |
| Coalescing | Provided by the existing `cacheAdapter.withCache` — concurrent identical keys share one upstream call |
| Cache outage | Fail-soft by `CachePort`'s contract: straight to the fetcher, request still succeeds |
| Rate limit | Its own `rateLimit(...)` instance, `RATE_LIMIT_WINDOW_MS` (60 s) / `RATE_LIMIT_THRESHOLDS.standard` (100), `createRateLimitStore()`, `rateLimitHandler` — **not** shared with `standardRateLimit` |

## 5. Port change (`backend/src/ports/discogsCatalog/discogsCatalogPort.ts`)

```text
SearchCatalogOptions.resultType?: 'release' | 'artist' | 'any'      // 'any' is new
```

`'any'` means: send **no** `type` param upstream, and keep the raw hit types `release | master | artist`, dropping any other type (e.g. `label`) rather than letting it reach `mapSearchResult`, whose zod enum would throw. `'release'` and `'artist'` behave exactly as today, so `/api/discogs/search` is byte-for-byte unchanged. No new port method and no new adapter file.

## 6. Observability (Principle V)

| Outcome | Line |
|---|---|
| success | `logger.info({ route: '/api/discogs/suggest', outcome: 'success', uid, meta: { queryLength, artists, albums, returned } })` |
| auth failed | `logger.warn({ route: '/api/discogs/suggest', outcome: 'auth_failed', uid })` |
| unavailable | `logger.warn({ route: '/api/discogs/suggest', outcome: 'unavailable', uid, message })` |
| error | `logger.error({ route: '/api/discogs/suggest', outcome: 'error', uid, message })` |

`q` is **never** logged, matching `/api/discogs/search` (research D7).

## 7. Contract test cases (`backend/tests/contract/discogsCatalog/suggest.contract.test.ts`)

Written and seen failing before the route exists (Principle I).

1. `q=iron mai` with a stubbed upstream → `200`, ≤ 5 items, each matching §2's shape, `communityRating` absent on every item, no `pagination` key, no `q` key.
2. **One upstream call**: the stub records exactly 1 `/database/search` request, with no `type` param and `per_page=20`.
3. **No rating calls**: the stub records 0 requests to `/releases/*/rating` and 0 to `/masters/*`.
4. `q=i` and `q=%20%20` → `200 { "suggestions": [] }`, **0** upstream requests.
5. Quota: an upstream fixture with 4 artists and 9 albums → 2 artists then 3 albums; one with 0 artists and 9 albums → 5 albums; one with 6 artists and 1 album → 4 artists then 1 album (data-model §3).
6. A `label`-typed raw hit in the fixture is dropped, not mapped, and does not fail the response.
7. Second identical request inside the TTL → `200` with the same body and **0** further upstream requests.
8. Upstream `DiscogsRateLimitError` / `DiscogsUnavailableError` → `502 catalog_unavailable`; an unexpected throw → `500 internal_error`.
9. A rejected linked-account credential → `401 discogs_link_invalid`, identical in shape to `/api/discogs/search`'s.
10. No `Authorization` header → `401`; over-limit → `429 rate_limited`, and a burst on `/suggest` does **not** consume `/api/discogs/search`'s budget.
