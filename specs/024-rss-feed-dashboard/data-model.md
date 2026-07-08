# Phase 1 Data Model: Music News Dashboard (RSS Feed Hub MVP)

No persistent storage is introduced — every entity below is a runtime/cache-layer shape, not a Firestore collection. Values live only in Redis (cache-aside, ~20 min TTL) and in the aggregate API response; nothing is written to a database.

## FeedSource (static configuration)

Represents one external RSS/Atom feed the backend is configured to poll. Defined in code (`backend/src/feeds/feedSources.ts`), not user-editable in this MVP.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `metal-injection`, `metal-storm-reviews`. Used as part of the Redis cache key. |
| `name` | string | Display name of the originating publication, e.g. "Metal Injection", "Metal Storm". |
| `feedUrl` | string (URL) | The RSS/Atom endpoint to fetch. |
| `category` | string | One of the Category labels (§ below). One-to-one: each `FeedSource` has exactly one category (see research.md §5). |
| `enabled` | boolean | Allows shipping a source config with fetching disabled (e.g. Metal Storm sub-feeds not yet confirmed reachable) without deleting its definition. |

## Article (derived, ephemeral)

One parsed feed item, shaped by `feedMapper.ts` from a raw RSS/Atom item. Never persisted; lives only inside a cached `DashboardResponse`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | The feed item's `guid` (or `link` if no guid), used for stable React list keys. Not required to be globally unique across sources. |
| `title` | string | Plain text (HTML entities decoded, no markup). |
| `excerpt` | string | Plain-text summary, tags stripped, truncated to a fixed length (e.g. 200 chars) — never raw feed HTML (research.md §2). |
| `imageUrl` | string (URL) \| undefined | Extracted from `enclosure`, `media:content`, or the first `<img src>` in the description; `undefined` when none found — frontend renders a placeholder in that case (spec FR-003). |
| `publishedAt` | string (ISO 8601) | Parsed from the feed's `pubDate`/`updated`. |
| `link` | string (URL) | Original article URL on the source's site; opened in a new tab on click (FR-005). |
| `sourceId` | string | FK-like reference to `FeedSource.id`. |
| `sourceName` | string | Denormalized copy of `FeedSource.name`, so the frontend never needs a join. |
| `category` | string | Denormalized copy of `FeedSource.category`. |

**Validation rules**: An item missing `title` or `link` is dropped during mapping (unusable as a displayable, clickable card) rather than rendered with blank fields — covers the "malformed item" edge case (spec Edge Cases).

## Category (grouping, derived)

Not a stored entity — a grouping key computed when assembling the response: `DashboardResponse.categories` groups all currently-available Articles by their `category` field, each capped to the top 3-5 most recent (spec FR-012). A category with zero articles across all sources is omitted from the response entirely (spec Edge Cases / User Story 2 Acceptance Scenario 4).

## DashboardResponse (API shape, not persisted)

The full payload returned by `GET /api/feeds/dashboard` (see `contracts/feeds-dashboard.md`).

| Field | Type | Notes |
|---|---|---|
| `categories` | `{ category: string; articles: Article[] }[]` | Ordered list of non-empty categories, each with its capped article list. |
| `sourceStatuses` | `{ sourceId: string; sourceName: string; status: 'ok' \| 'unavailable' }[]` | One entry per configured, enabled `FeedSource`; `'unavailable'` drives the frontend's non-blocking notice (FR-007). |
| `generatedAt` | string (ISO 8601) | When this response was assembled (cache-fill time), useful for the frontend to reason about freshness if ever needed; not currently required to be displayed. |

## State / lifecycle

No state transitions — every entity here is re-derived fresh on each cache-aside fetcher invocation (every ~20 minutes per source) and discarded/replaced wholesale; there is no update-in-place or partial-merge logic.
