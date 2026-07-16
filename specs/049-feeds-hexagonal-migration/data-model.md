# Phase 1 Data Model: Feeds/RSS Domain Migrated to Hexagonal Architecture

This migration does not add, remove, or change the shape of any existing entity — it
relocates existing types unchanged and introduces one new domain type (`RawFeedItem`,
research.md Decision 1) plus one new port (`FeedSourcePort`).

## Domain Entities (relocated unchanged)

| Entity | Source file → destination | Key fields | Notes |
|---|---|---|---|
| `FeedSourceConfig` | `feeds/types.ts` → `domain/feeds/types.ts` | `id`, `name`, `feedUrl`, `category`, `enabled`, `priority` | Static per-source catalog entry; drives which sources are aggregated and display order |
| `Article` | `feeds/types.ts` → `domain/feeds/types.ts` | `id`, `title`, `excerpt`, `imageUrl?`, `publishedAt`, `link`, `sourceId`, `sourceName`, `category` | Produced from a `RawFeedItem` by `feedMapper.mapFeedItem` |
| `SourceStatus` | `feeds/types.ts` → `domain/feeds/types.ts` | `sourceId`, `sourceName`, `status` (`'ok' \| 'unavailable'`), `priority` | One per enabled source, in every `DashboardResponse` |
| `CategoryGroup` | `feeds/types.ts` → `domain/feeds/types.ts` | `category`, `articles` (capped at `ARTICLES_PER_CATEGORY`) | Output of `groupByCategory` |
| `DashboardResponse` | `feeds/types.ts` → `domain/feeds/types.ts` | `categories`, `sourceStatuses`, `generatedAt` | `getDashboard`'s return shape |
| `SourceFeedResponse` | `feeds/types.ts` → `domain/feeds/types.ts` | `sourceId`, `sourceName`, `status`, `articles` (uncapped), `generatedAt` | `getSourceArticles`'s return shape; `null` when the id doesn't match an enabled source |

## Domain Entities (new)

| Entity | Location | Key fields | Notes |
|---|---|---|---|
| `RawFeedItem` | `domain/feeds/types.ts` | `title?`, `link?`, `guid?`, `isoDate?`, `pubDate?`, `content?`, `contentSnippet?`, `summary?`, `enclosureUrl?` | Built by `adapters/feeds/feedSourceAdapter.ts` from `rss-parser`'s `Parser.Item`, at the port boundary (research.md Decision 1). `feedMapper.mapFeedItem` consumes this instead of `Parser.Item` directly |

## Port Contract (new)

| Port | Application-layer consumers | Adapter (this feature) | Wraps |
|---|---|---|---|
| `FeedSourcePort` | `getDashboard`, `getSourceArticles` (both in `application/feeds/getFeedsDashboard.ts`) | `adapters/feeds/feedSourceAdapter.ts` | `axios` (HTTP fetch, direct), `rss-parser` (RSS/Atom parsing, direct) |
| `CachePort` (reused, unchanged) | `getDashboard`, `getSourceArticles` (new `withCache` consumers, replacing a direct `cache/cacheAside.ts` import) | `adapters/cache/cacheAdapter.ts` (unchanged — already shared since Historia 3) | `cache/redisClient.ts`, `cache/cacheAside.ts` (both unmoved) |

## `FeedSourcePort` method inventory

| Method | Backs (today's function) | Infra |
|---|---|---|
| `fetchFeed(feedUrl, timeoutMs?): Promise<RawFeedItem[]>` | `fetchFeed` in `feeds/feedClient.ts` (default timeout `8_000` ms, same as today) | `axios` (HTTP GET) + `rss-parser` (XML parsing); the adapter maps `Parser.Output.items` to `RawFeedItem[]` internally — no caller ever sees the intermediate `Parser.Output` shape |

Full preconditions/postconditions (timeout behavior, error propagation on a non-2xx
response or network failure) are in `contracts/feed-source-port.md`.

## Aggregation Rules (relocated unchanged, spec.md User Story 1)

Not new rules — recorded here to make explicit that each is preserved exactly across
the migration, now living in `application/feeds/getFeedsDashboard.ts` instead of
`feeds/feedAggregator.ts`:

1. **`fetchSourceArticles(source)`** (private helper, shared by both functions below):
   `cache.withCache(\`feeds:${source.id}\`, 20 * 60, () => feedSource.fetchFeed(source.feedUrl).then(items => items.map(item => feedMapper.mapFeedItem(item, source)).filter(Boolean)))`.
2. **`getDashboard()`**: filters `FEED_SOURCES` to `enabled` sources, calls
   `Promise.allSettled` over `fetchSourceArticles` for each; a fulfilled result
   contributes its articles and an `'ok'` `SourceStatus`, a rejected one contributes no
   articles and an `'unavailable'` `SourceStatus` (logged via `logger.warn`, preserved
   verbatim); `groupByCategory` sorts each category's articles by `publishedAt`
   descending and caps at `ARTICLES_PER_CATEGORY` (10); returns
   `{ categories, sourceStatuses, generatedAt: new Date().toISOString() }`.
3. **`getSourceArticles(sourceId)`**: looks up `sourceId` in `FEED_SOURCES` filtered to
   `enabled`; returns `null` if no match (route maps this to 404). Otherwise calls
   `fetchSourceArticles` for that one source; on success returns
   `{ sourceId, sourceName, status: 'ok', articles: <sorted, uncapped>, generatedAt }`;
   on failure (caught, not propagated) returns
   `{ sourceId, sourceName, status: 'unavailable', articles: [], generatedAt }`, logging
   via `logger.warn` exactly as `getDashboard`'s per-source failure does.

## Edge Case: no cross-domain consumers of this domain's internals

Unlike Historia 4 (which retired the library domain's two provisional ports), no other
already-migrated domain imports anything from `feeds/*` or `routes/feeds.ts` today
(verified: `grep` for `feeds/` outside the `feeds/`/`routes/` folders themselves finds
only `app.ts`'s router mount). This migration's only cross-file edit outside
`domain/feeds/`, `application/feeds/`, `ports/feeds/`, and `adapters/feeds/` is
`app.ts`'s one-line import-path update for the relocated router.
