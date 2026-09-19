# Data Model: 067 RSS News View Redesign

No Firestore changes. Everything lives in code config, in-memory, or in the
existing Redis cache via `CachePort`.

## Feed Source (`FeedSourceConfig`, `backend/src/domain/feeds/types.ts`) — unchanged

| Field | Type | Rule |
|---|---|---|
| `id` | string | Unique, kebab-case; used as cache key and route param |
| `name` | string | Display name; also source of the placeholder monogram |
| `feedUrl` | string | Absolute http(s) RSS 2.0 or Atom URL |
| `category` | string | Kept for contract stability; always `News` today (research D11) |
| `enabled` | boolean | Disabled sources are never fetched |
| `priority` | boolean | Filter ordering only |

Identity: `id`. Adding a source = one entry with these fields; no image rules (FR-001).

## Raw Feed Item (`RawFeedItem`) — extended (domain-owned, produced by the adapter)

| Field | Type | Status |
|---|---|---|
| `title`, `link`, `guid`, `isoDate`, `pubDate`, `content`, `contentSnippet`, `summary` | string? | existing |
| `enclosureUrl` | string? | existing |
| `enclosureType` | string? | NEW — MIME type of the enclosure |
| `contentEncoded` | string? | NEW — `content:encoded` HTML |
| `mediaContent` | `{ url: string; medium?: string; type?: string; width?: number }[]` | NEW — `media:content`, including those nested in `media:group` |
| `mediaThumbnails` | `string[]` | NEW — `media:thumbnail@url` |
| `itunesImage` | string? | NEW — `itunes:image@href` |

## News Item (`Article`) — shape unchanged

| Field | Type | Rule |
|---|---|---|
| `id` | string | `guid` ?? `link` |
| `title` | string | Plain text (sanitised as today); item dropped if empty |
| `excerpt` | string | Plain text, ≤ 200 chars |
| `imageUrl` | string? | Absolute http(s) only. From the feed ladder (D2) or the page lookup (D3). Page-lookup results pass through `dropSharedPreviewImages(Map<link, url \| null>)` before being merged, which nulls any URL shared by ≥ 2 links (D6). Absent → placeholder |
| `publishedAt` | ISO string | `isoDate` → parsed `pubDate` → fetch time |
| `link` | string | Required; item dropped if empty |
| `sourceId`, `sourceName`, `category` | string | From the source |

**Uniqueness**: deduplicate by `link`, then by `id`; the first (newest) one wins. Applies per source and across the dashboard (FR-014).

**Dashboard selection** (`selectDashboardArticles`, D7): `publishedAt ≥ now − 7 days`; each available source contributes its 3 newest in-window articles (all of them if it has fewer); the rest is filled by recency up to 60 in total; the result is sorted newest first. Sources with nothing in the window are absent from this view (still in `sourceStatuses` and reachable via the source endpoint).

## Image Lookup Result — NEW (Redis via `CachePort.withCache`)

| Aspect | Value |
|---|---|
| Key | `feeds:img:<article link>` |
| Value | JSON: image URL string, or `null` (= "no image found") |
| TTL | 604 800 s (7 days) |
| Written when | Page lookup completed definitively: image found, no preview meta, blocked address, non-HTML, 4xx, too many redirects |
| Not written when | Transient failure: timeout (including slow DNS), network error, 5xx; or the per-refresh budget of 8 lookups is already used (all retried on the next source refresh) |
| Lifecycle | Read on every source refresh for image-less articles; expires unused once the article leaves the feed |
| Validation | Stored URL is absolute http(s) (checked before caching) |

## Source Status (`SourceStatus`) — shape unchanged

| Field | Type | Rule |
|---|---|---|
| `sourceId`, `sourceName` | string | From the source |
| `status` | `'ok' \| 'unavailable'` | `unavailable` when the feed fetch rejected (timeout, non-2xx, parse error) |
| `priority` | boolean | Filter ordering |

Presentation: `unavailable` → filter chip shows icon + "unavailable"; the chip stays selectable. There is no banner (FR-015).

## Frontend presentation model (not persisted; `frontend/src/lib/newsLayout.ts`)

`PortadaSlots = { lead?: Article; secondary: Article[] /* ≤ 4 */; latest: Article[] }`. Built from newest-first articles as follows (FR-009):
- `lead` is the newest article with an `imageUrl`.
- `secondary` holds the next newest articles with an `imageUrl`, at most one per source while other sources still have candidates.
- `latest` holds everything else, newest first.
