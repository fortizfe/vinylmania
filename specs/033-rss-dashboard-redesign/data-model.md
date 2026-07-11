# Phase 1 Data Model: RSS Dashboard Redesign — Responsive Layouts & New Sources

No persistent storage is introduced or changed. This feature only adds one field to two existing runtime/cache-layer shapes already defined in feature 024's data-model and extended by 025; everything below is a delta over those documents, not a replacement.

## FeedSource (static configuration) — delta

Adds one field to the existing shape (`id`, `name`, `feedUrl`, `category`, `enabled`):

- **Added field**: `priority: boolean` — `true` for exactly the three sources the spec identifies as most important (`metal-injection`, `metalsucks`, `louder-sound`); `false` for every other configured source (the 5 Metal Storm entries). Governs only the display order of the source filter's option list (priority sources listed first, in config-declaration order); has no effect on card size, article ordering within a filtered view, or any other rendering (resolves the Clarifications session's contradiction).

The configured entries in `backend/src/feeds/feedSources.ts` change:

- **Added** (both `enabled: true`, `category: 'News'`, `priority: true`): `metalsucks` (`https://feeds.feedburner.com/Metalsucks`), `louder-sound` (`https://www.loudersound.com/feeds.xml`) — see research.md §6 for verification details.
- **Modified**: `metal-injection` gains `priority: true`; the 5 existing `metal-storm-*` entries each gain `priority: false`.

## Article (derived, ephemeral) — unchanged

No field changes. Same shape (`id`, `title`, `excerpt`, `imageUrl?`, `publishedAt`, `link`, `sourceId`, `sourceName`, `category`), same validation rule (an item missing `title` or `link` is dropped during mapping — this now also governs MetalSucks/Louder Sound items identically to every other source).

## Category (grouping, derived) — unchanged

Same derivation and 10-article-per-category cap as feature 025. MetalSucks and Louder Sound both contribute into the existing `"News"` category label alongside `metal-injection`, merging exactly as `metal-storm-news` already does (024/025's existing many-sources-to-one-category merge path, unmodified).

## SourceStatus (API shape, not persisted) — delta

Adds one field to the existing shape (`sourceId`, `sourceName`, `status`):

- **Added field**: `priority: boolean` — copied straight from the corresponding `FeedSourceConfig.priority` by `feedAggregator.getDashboard()`, present for every entry (both `'ok'` and `'unavailable'` statuses) exactly like the existing fields.

`sourceStatuses` continues to include one entry per every **enabled** configured source regardless of fetch outcome — this is what lets the frontend build a complete source-filter option list (FR-012) even for a source that is currently `'unavailable'` or (per the zero-items edge case) returned no articles.

## DashboardResponse (API shape, not persisted) — unchanged field set, delta on `sourceStatuses` entries

Same top-level fields as 024/025 (`categories`, `sourceStatuses`, `generatedAt`). No field additions or removals at this level:

- `sourceStatuses[]` entries each gain the new `priority` field described above.
- `categories[].articles` may now include items from `metalsucks`/`louder-sound` merged into the existing `"News"` category, subject to the unchanged 10-per-category cap.

See [contracts/feeds-dashboard-delta.md](./contracts/feeds-dashboard-delta.md) for an updated example payload.

## FilterSelection (frontend-only, derived, not part of the API) — new

Introduced entirely in the frontend (`FeedArticleBoard`'s local state), not persisted and not sent to the backend:

- `selectedCategory: string | null` — `null` means "all categories" (unchanged behavior/name from the existing `DashboardPage` state).
- `selectedSource: string | null` (a `sourceId`) — `null` means "all sources." Single-select, per the Clarifications session's resolution of the source-filter contradiction.

A displayed article must match **both** the active category (if any) and the active source (if any) — i.e., AND combination (FR-013). Clearing either filter (`null`) drops that constraint while leaving the other filter's selection untouched (FR-014).

## State / lifecycle — unchanged

No state transitions. Every `Article`/`SourceStatus` is re-derived fresh on each cache-aside fetch (same ~20 minute TTL per source) and discarded/replaced wholesale. `FilterSelection` is transient UI state, reset on page reload (no persistence requirement was introduced by this feature — see spec Assumptions, which defer to the category filter's existing, non-persisted behavior).
