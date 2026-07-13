# Data Model: Dashboard RSS Feed Sources Refresh

No persistent storage changes. This feature only changes the static feed
source catalog and the shape of one new read-only aggregation response;
nothing here is stored in Firebase or any database.

## Feed Source (`FeedSourceConfig`, `backend/src/feeds/types.ts`)

Existing shape, unchanged:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable identifier, e.g. `heavy-mag`. Unique across the catalog. |
| `name` | `string` | Display name shown in the source filter and article attribution. |
| `feedUrl` | `string` | RSS/Atom feed URL fetched by `fetchFeed`. |
| `category` | `string` | Drives category grouping in the general dashboard view. |
| `enabled` | `boolean` | Only `enabled: true` sources are aggregated or directly queryable. |
| `priority` | `boolean` | Controls source-filter label ordering only (priority first). |

**Catalog changes for this feature**:
- Remove: `metal-storm-news`, `metal-storm-reviews`, `metal-storm-interviews`,
  `metal-storm-articles`, `metal-storm-picks`.
- Add (all `category: 'News'`, `priority: false`, `enabled: true`):
  - `heavy-mag` → `https://heavymag.com.au/feed/`
  - `metal-underground` → `https://feeds.feedburner.com/metalunderground`
  - `heavy-metal-overload` → `https://heavymetaloverload.com/feed/`
  - `femme-metal` → `https://femmetal.rocks/feed/`
  - `metaltalk` → `https://www.metaltalk.net/feed`
- Not added: Metal Blade Records (confirmed unreachable — see
  `research.md` §1). No catalog entry is created for it.
- Unchanged: `metal-injection`, `metalsucks`, `louder-sound`.

Net result: 8 sources total (3 existing + 5 new), all `category: 'News'`
except none — every remaining/added source shares `News`, so the Dashboard
has a single populated category until a future feature adds a differently
categorized source (documented as an accepted tradeoff in `spec.md` →
Assumptions).

## Article (`Article`, `backend/src/feeds/types.ts`)

Unchanged shape (`id`, `title`, `excerpt`, `imageUrl?`, `publishedAt`,
`link`, `sourceId`, `sourceName`, `category`). No new fields. The new
per-source endpoint reuses this same type — it returns a flat, uncapped
`Article[]`, not a new shape.

**Removed logic**: `feedMapper.ts`'s `DATA_IMAGE_URL_PATTERN` /
`data-image-url` extraction tier, which existed solely for Metal Storm's
non-standard image markup. No other current or new source relies on it —
the 5 new sources are standard WordPress/FeedBurner feeds using
`<enclosure>`/`<img>` markup already handled by the existing tiers.

## Source Feed Response (new, per-source query — User Story 3)

New response shape returned by `GET /api/feeds/sources/:sourceId`
(see `contracts/feeds-source.md`):

| Field | Type | Notes |
|---|---|---|
| `sourceId` | `string` | Echoes the requested source's `id`. |
| `sourceName` | `string` | The source's display name. |
| `status` | `'ok' \| 'unavailable'` | Reuses the existing `SourceHealth` type — `'unavailable'` means the direct feed query failed or timed out; `'ok'` covers both "has articles" and "feed responded with zero articles." |
| `articles` | `Article[]` | **All** articles the source's feed currently has, most recent first — no `ARTICLES_PER_CATEGORY`-style cap. Empty when `status: 'ok'` and the feed has no items, or always empty when `status: 'unavailable'`. |
| `generatedAt` | `string` (ISO 8601) | Timestamp of this response, matching the existing `DashboardResponse.generatedAt` convention. |

No new entity is persisted — this is a derived, cached (via the existing
`withCache` per-source key) read model over the same `Article` data the
general dashboard already produces.

## Source Availability Status (`SourceStatus`, existing type — reused)

No shape change. The existing `SourceStatus` (`sourceId`, `sourceName`,
`status: SourceHealth`, `priority`) continues to describe each source's
health as surfaced in the general dashboard load (`FeedSourceStatusBanner`,
`FeedSourceFilterBar`). The new per-source endpoint's `status` field reuses
the same `SourceHealth` union (`'ok' | 'unavailable'`) for consistency, but
is a separate, independently-fetched value scoped to the direct query, not
a mutation of the dashboard's cached `sourceStatuses`.
