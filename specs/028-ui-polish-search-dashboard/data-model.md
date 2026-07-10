# Phase 1 Data Model: UI Polish – Search Results & Dashboard Cards

This feature is presentation-only: no new data is fetched, stored, or shaped
differently by the backend. The "entities" below are the existing frontend
view-model shapes each card renders from — documented for reference, not as a
list of changes to make.

## Search Result Card (view model)

Source type: `CatalogSearchResult` (`frontend/src/services/discogsApi.ts:10-20`,
mirrored in `backend/src/discogs/types.ts:6`) — **unchanged by this feature**.

| Field | Type | Used for |
|---|---|---|
| `discogsId` | `number` | Link target, React key |
| `resultType` | `'master' \| 'release'` | Drives `isGrouped` — determines stacked-covers effect (FR-004/FR-005) and "Multiple editions" label (FR-002a) vs. format badge/actions |
| `title` | `string` | Card title (truncated, unchanged) |
| `artist?` | `string` | Card subtitle (truncated, unchanged) |
| `thumbnailUrl?` | `string` | Cover image / placeholder |
| `year?` | `string` | Meta row |
| `formats?` | `string[]` | `formats[0]` shown as a `Badge` — release cards only |
| `communityRating?` | number-like | `ReleaseRatingBadge` overlay, unchanged |

**Presentational-only additions** (no new fields on the type):
- Fixed card height is a CSS property of the rendered `Card`, not new data (FR-002, FR-003).
- The "Multiple editions" label (FR-002a) is a static string derived purely
  from the existing `resultType === 'master'` check — it does not require or
  read any new field (e.g., no release/version count).

## RSS Article Card (view model)

Source type: `Article` (`frontend/src/services/feedsApi.ts`) — **unchanged by
this feature**.

| Field | Type | Used for |
|---|---|---|
| `title` | `string` | Now clamped to 2 lines (FR-008) — previously unclamped |
| `excerpt` | `string` | Now clamped to 2 lines (FR-008) — previously unclamped |
| `imageUrl?` | `string` | Thumbnail / placeholder, unchanged |
| `category` | `string` | `Badge`, unchanged |
| `sourceName`, `publishedAt` | `string` | Meta line, unchanged |
| `link` | `string` | Outbound anchor href, unchanged |

**Presentational-only addition**: fixed card height (FR-007), independent of
`title`/`excerpt` length.

## State transitions

None — both card types are stateless renderers of already-fetched data. No
new loading/error/empty states are introduced (existing
`SearchResultCardSkeleton` / `FeedArticleCardSkeleton` are updated to match
the new fixed heights, per the constitution's "No layout shift" rule, but
their state machine is unchanged).
