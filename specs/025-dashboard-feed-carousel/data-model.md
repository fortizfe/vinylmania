# Phase 1 Data Model: Dashboard Feed Carousels & Metal Storm Categories

No persistent storage is introduced or changed. This feature only adjusts values within the runtime/cache-layer shapes already defined in feature 024's [data-model.md](../024-rss-feed-dashboard/data-model.md); everything below is a delta over that document, not a replacement.

## FeedSource (static configuration) — delta

Same shape as 024 (`id`, `name`, `feedUrl`, `category`, `enabled`), no field changes. The configured entries in `backend/src/feeds/feedSources.ts` change:

- **Removed**: the single `metal-storm` entry (`enabled: false`, pointed at the Cloudflare-protected listing page).
- **Added** (all `enabled: true`): `metal-storm-news`, `metal-storm-reviews`, `metal-storm-interviews`, `metal-storm-articles`, `metal-storm-picks` — see research.md §4 for the exact `feedUrl`/`category` values.

**Note on the one-to-one FeedSource → Category rule**: 024's data-model states each `FeedSource` has exactly one `category`. That still holds per-source; the *many-to-one* direction (`metal-injection` and `metal-storm-news` both mapping to the `News` category) was already anticipated by 024's Category description ("A Category can contain Articles from more than one Feed Source") and requires no schema change — `groupByCategory` merges on the `category` string regardless of how many sources share it.

## Article (derived, ephemeral) — unchanged

No field changes. Same shape, same validation rule (an item missing `title` or `link` is dropped during mapping).

## Category (grouping, derived) — delta

Same derivation mechanism as 024 (a grouping key computed from all currently-available Articles' `category` field), with one constant changed: each category is now capped to the **top 10** most recent articles (was top 3-5), sorted by `publishedAt` descending — i.e. newest first, matching this feature's clarified carousel ordering (see spec Clarifications). The cap applies *after* merging all contributing sources for that category label, so a category fed by two sources (e.g. `News` from both `metal-injection` and `metal-storm-news`) still yields at most 10 combined articles, not 10 per source.

A category with zero articles across all its contributing sources is still omitted entirely from the response (unchanged from 024).

## DashboardResponse (API shape, not persisted) — unchanged shape, wider data

Same fields as 024 (`categories`, `sourceStatuses`, `generatedAt`). No field additions or removals:

- `categories[].articles` may now contain up to 10 entries instead of up to 5.
- `sourceStatuses` gains up to 5 additional entries (one per newly enabled Metal Storm source), each `'ok'` or `'unavailable'` exactly like every existing entry.

See [contracts/feeds-dashboard-delta.md](./contracts/feeds-dashboard-delta.md) for an updated example payload.

## State / lifecycle — unchanged

No state transitions. Every entity is re-derived fresh on each cache-aside fetch (same ~20 minute TTL per source) and discarded/replaced wholesale, exactly as in 024.
