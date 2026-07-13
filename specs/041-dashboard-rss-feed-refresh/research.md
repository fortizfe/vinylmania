# Research: Dashboard RSS Feed Sources Refresh

## 1. Metal Blade Records feed reachability (live confirmation)

**Decision**: Do not add Metal Blade Records to `FEED_SOURCES` in this
feature. Document it as a confirmed-unreachable candidate source instead of
shipping a permanently-disabled catalog entry.

**Rationale**: Re-verified live on 2026-07-13 (planning time, as FR-006
requires) against all three URL variants the HU already tried:

| URL variant | Result |
|---|---|
| `https://www.metalblade.com/us/feed/` | Timed out (15s), no response |
| `https://www.metalblade.com/us/?feed=rss2` | Timed out (15s), no response |
| `https://www.metalblade.com/us/category/news/feed/` | Timed out (15s), no response |

All three attempts failed to return any HTTP response (curl exit 28,
operation timed out) — consistent with the HU's own finding and with the
precedent already documented in `feedSources.ts` for Metal Storm's original
general feed (Cloudflare-challenge-blocked, feature 024). Adding a
`FeedSourceConfig` entry with `enabled: false` for a source that has no
known working endpoint would be a dead, untestable piece of configuration —
against Constitution Principle III (Simplicity, YAGNI & KISS). The existing
precedent for a genuinely blocked source (Metal Storm) was to look for a
working alternate endpoint, not to ship a disabled placeholder.

**Alternatives considered**:
- Add the entry with `enabled: false` — rejected: dead code/config with no
  verifiable behavior to test, and no existing precedent for it in this
  catalog.
- Retry with a browser-like `Accept`/`Referer` header set or a longer
  timeout — out of scope for this feature; if Metal Blade Records is wanted
  later, that investigation belongs to a follow-up feature the same way
  Metal Storm's per-category endpoints were discovered in feature 025.

**Outcome**: User Story 2 ships 5 of the 6 candidate sources (Heavy Mag,
Metal Underground, Heavy Metal Overload, Femme Metal, MetalTalk). This
satisfies FR-006 ("if persistently unreachable, documented rather than
silently assumed to work") without violating simplicity constraints. The
spec's own AC4 already anticipated this exact outcome as acceptable.

## 2. Reachability re-confirmation of the other 5 new sources

**Decision**: All 5 remaining candidate sources are added with
`enabled: true`.

**Rationale**: Re-verified live on 2026-07-13, immediately before
implementation planning:

| Source | HTTP | Content-Type |
|---|---|---|
| Heavy Mag | 200 | `application/rss+xml; charset=UTF-8` |
| Metal Underground | 200 | `text/xml; charset=utf-8` |
| Heavy Metal Overload | 200 | `application/rss+xml; charset=UTF-8` |
| Femme Metal | 200 | `application/rss+xml; charset=UTF-8` |
| MetalTalk | 200 | `application/rss+xml; charset=UTF-8` |

All respond well within the existing 8s per-source fetch timeout
(`DEFAULT_TIMEOUT_MS` in `feedClient.ts`), so no client/timeout changes are
needed to support them.

**Alternatives considered**: None — straightforward reachability check.

## 3. Mechanism for "query a source's feed directly" (User Story 3)

**Decision**: Add a new backend endpoint, `GET /api/feeds/sources/:sourceId`,
that reuses the existing per-source fetch/cache/timeout pipeline
(`fetchSourceArticles` in `feedAggregator.ts` → `fetchFeed` in
`feedClient.ts`, already keyed per source as `feeds:${source.id}` in
`withCache`) but returns **all** mapped articles for that one source
(no `ARTICLES_PER_CATEGORY` slice), plus an explicit availability status.
The frontend calls this endpoint (via a new TanStack Query hook) only when
a source filter label is selected, instead of filtering client-side over
the already-capped aggregated `categories` data.

**Rationale**:
- `fetchSourceArticles` already exists per-source, is already cached
  (20-minute TTL, same `feeds:${source.id}` cache key the general dashboard
  load already populates/reads — clicking a source that already loaded
  during the general view will typically hit cache, not issue a fresh
  network fetch, so there is no double request budget cost), and already
  enforces the same 8-second timeout used everywhere else — directly
  satisfying the clarification to reuse the existing timeout threshold for
  "does not respond" (FR-010), with no new timeout constant needed.
- Returning every article the feed provides (not slicing to 10) directly
  satisfies the clarification that the filtered view shows everything the
  feed has, with no additional application-side cap (FR-008).
- A dedicated per-source endpoint is simpler than overloading
  `GET /api/feeds/dashboard` with a filter query parameter: the dashboard
  endpoint's contract (aggregate everything, category-grouped) stays
  unchanged, and the new endpoint has a narrow, single-purpose contract
  (Constitution Principle III/IV — single responsibility, no modification
  of a stable, tested endpoint).
- Because the response is a flat article list attributed to one source
  (not grouped by category), an unknown/never-enabled `sourceId` is a
  distinct condition from "no articles" or "unavailable" and is handled as
  `404 Not Found` — protecting against a stale client-side sourceId (e.g. a
  removed source) being queried directly.

**Alternatives considered**:
- Add a `?source=<id>` query parameter to the existing
  `GET /api/feeds/dashboard` endpoint — rejected: would force the dashboard
  endpoint to special-case "ungrouped, uncapped, single-source" responses
  alongside its existing "grouped, capped, all-sources" contract, mixing
  two different response shapes behind one endpoint.
- Filter further on the client using data already fetched — rejected: this
  is exactly the current broken behavior (Historia 3's problem statement);
  it cannot show articles the general view's top-10 cutoff excluded.

## 4. Response shape for source unavailability vs. empty state

**Decision**: The new endpoint always returns `200 OK` with a `status` field
(`'ok'` or `'unavailable'`), never a `5xx` for a downstream feed failure.
`status: 'unavailable'` + `articles: []` means the direct query failed or
timed out. `status: 'ok'` + `articles: []` means the feed responded but
has no articles. This mirrors the existing `SourceStatus.status` shape
already used by the general dashboard response, so the frontend can reuse
the same `SourceHealth` type and the same visual language as the existing
`FeedSourceStatusBanner` unavailable-source pattern (Constitution Principle
VII: per-source graceful degradation).

**Alternatives considered**: Returning an HTTP error code (e.g. 502) for a
downstream feed failure — rejected: the rest of the existing feed system
(`getDashboard`) already treats a per-source failure as a normal, expected
outcome represented in the response body (`SourceStatus.status`), not as an
HTTP-level error; keeping the same convention avoids a special case in the
frontend's HTTP client error handling.

## 5. Frontend data-fetching integration

**Decision**: Add `useSourceFeed(sourceId: string | null)` in
`feedsQueries.ts`, a `useQuery` keyed as
`[...feedsKeys.all, 'source', sourceId]` with `enabled: sourceId !== null`.
`FeedArticleBoard` switches its rendered article list to this query's
result when `selectedSource` is set (still applying the existing
`selectedCategory` client-side filter over that source's own articles, per
FR-012), and falls back to today's aggregated-`categories` rendering when
`selectedSource` is `null` (`"All sources"`), satisfying FR-011 with no
extra reset logic beyond switching the data source back.

**Rationale**: Matches the existing `useDashboardFeeds` pattern already in
the codebase (same file, same library, same client wrapper
`authorizedFetch`), so no new data-fetching pattern is introduced.

**Alternatives considered**: Keeping a single query and merging results
client-side — rejected: adds complexity for no benefit, since the two
queries (aggregate dashboard vs. single-source) already have cleanly
separable lifecycles and caches under TanStack Query.
