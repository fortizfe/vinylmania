# Phase 0 Research: RSS Dashboard Redesign — Responsive Layouts & New Sources

## 1. Flattening the category-grouped response into one filterable, sortable article list

**Decision**: Do all flattening, recency-sorting, and category/source filtering on the frontend, over the existing `DashboardResponse` shape (`categories: CategoryGroup[]`, `sourceStatuses`, `generatedAt`). `FeedArticleBoard` computes `categories.flatMap(g => g.articles)`, sorts by `publishedAt` descending, then applies the active category and/or source selection (AND logic) before rendering.

**Rationale**: The backend already fetches, merges, and caps every category's articles server-side (`groupByCategory`, capped at 10 per category post-merge); flattening that already-complete payload client-side needs no new backend endpoint, no response-shape change, and no additional network round-trip. This keeps the change additive per Principle VI (no existing field removed or restructured) and avoids the API-versioning overhead a backend contract change would otherwise require, for a payload that has exactly one consumer (this app's own frontend, updated in the same PR).

**Alternatives considered**: Restructuring the backend response into a flat `articles: Article[]` + `sources: SourceSummary[]` shape — rejected: it would be a breaking change to `categories`'s existing shape for zero external-consumer benefit, and the existing shape already contains everything the frontend needs to derive a flat, sortable, filterable list.

## 2. One responsive grid instead of separate desktop-grid/mobile-list components

**Decision**: Build a single `FeedArticleBoard` grid using Tailwind CSS Grid breakpoint utilities: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6`. Mobile's "single-column vertical list" (User Story 2) is simply this grid's 1-column state at the base breakpoint — there is no separate list component.

**Rationale**: The spec's two "layouts" differ only in column count and card density, not in filtering/sorting/data logic. A single grid driven by Tailwind's existing default breakpoint scale (already used for card grids elsewhere, e.g. `SearchResultsPage.tsx`) satisfies both User Story 1 (desktop grid) and User Story 2 (mobile single column) without duplicating the flatten/sort/filter/empty-state logic across two components (Principle III, IV). No new device-detection mechanism is introduced, consistent with the spec's Assumptions.

**Alternatives considered**: Two separate components (`FeedArticleGrid` for desktop, `FeedArticleList` for mobile) toggled via a viewport check — rejected: doubles the surface area for a change that is purely a CSS breakpoint difference, and risks the two views drifting out of sync (e.g. one gets the empty-state fix, the other doesn't).

## 3. Desktop grid column cap (clarified: 5 columns) and container width

**Decision**: Stop the breakpoint stack at `xl:grid-cols-5` — no `2xl:grid-cols-6` step is added, so any viewport at or beyond the `xl` breakpoint renders exactly 5 columns and cards simply grow wider on ultra-wide monitors. Widen the Dashboard's page container from `max-w-6xl` to `max-w-7xl` (both stock Tailwind scale values) so 5 columns have comfortable per-card width instead of feeling cramped at the previous, narrower single-column-oriented container width.

**Rationale**: Matches the clarification session's answer directly. Both `max-w-6xl` and `max-w-7xl` are default Tailwind v4 scale values, so no `@theme` customization is needed (constitution's "no custom CSS without justification" rule).

**Alternatives considered**: A `minmax()`-based `grid-template-columns: repeat(auto-fill, minmax(...))` (as used by `LibraryListPage.tsx`) — rejected: auto-fill's column count is a function of available width and card min-width, which doesn't map cleanly onto "cap at exactly 5 columns" as a first-class, testable constraint; the explicit breakpoint stack makes the 5-column cap directly readable in the class list and directly testable (e.g., via computed style or class assertions) rather than derived.

## 4. Mobile filter touch target size (clarified: 44×44 CSS px)

**Decision**: Apply `min-h-11 min-w-11` (Tailwind's stock `11` spacing step = `2.75rem` = 44px) plus `flex items-center justify-center` to every button in both `FeedCategoryFilterBar` and the new `FeedSourceFilterBar`, uniformly across all breakpoints (not just mobile).

**Rationale**: `h-11`/`min-h-11` already exists on Tailwind v4's default spacing scale, so this requires no `@theme` addition. Applying it uniformly (rather than only below a breakpoint) avoids conditional sizing logic for a rule that doesn't hurt desktop usability either, keeping the two filter bars' styling simple and consistent (Principle III).

**Alternatives considered**: An arbitrary-value utility like `min-h-[44px]` — rejected in favor of the equivalent stock `min-h-11`, since the constitution requires arbitrary values outside the default scale to be justified/added to `@theme`, and 44px already exists on-scale.

## 5. Priority-source flag: data model and propagation

**Decision**: Add `priority: boolean` to `FeedSourceConfig` (backend `types.ts`) and to `SourceStatus`/the frontend's mirrored `SourceStatus` type, populated by `feedAggregator.getDashboard()` from each source's static config alongside the existing `sourceId`/`sourceName`/`status` fields. `feedSources.ts` sets `priority: true` on `metal-injection` and the 2 new entries (`metalsucks`, `louder-sound`); every existing Metal Storm entry sets `priority: false`. The frontend's `FeedSourceFilterBar` sorts its option list priority-first (in config-declaration order), then the remaining sources.

**Rationale**: Resolves the clarified contradiction directly: the flag exists solely to drive filter-list ordering, never card size/prominence (FR-010 is enforced entirely inside `FeedArticleCard`, which has no knowledge of `priority`). Keeping the flag on the existing `FeedSourceConfig`/`SourceStatus` types (rather than a separate hardcoded priority-source-ids array in the frontend) keeps one source of truth for "what is a priority source," avoiding drift between backend config and frontend display order (Principle IV).

**Alternatives considered**: A frontend-only hardcoded array of priority source names/ids — rejected: duplicates knowledge already expressed in `feedSources.ts` and would silently go stale if a source were ever renamed or re-IDed.

## 6. MetalSucks and Louder Sound feed verification

**Decision**: Add both as new, `enabled: true` entries in `feedSources.ts`, both mapped to the `"News"` category (per spec Assumptions — no new category is introduced):

| id | name | feedUrl | category | priority |
|---|---|---|---|---|
| `metalsucks` | MetalSucks | `https://feeds.feedburner.com/Metalsucks` | News | true |
| `louder-sound` | Louder Sound | `https://www.loudersound.com/feeds.xml` | News | true |

**Rationale**: Both URLs were verified live during this research phase (`curl` with a browser-like `User-Agent`, matching `feedClient.ts`'s existing request pattern): `https://feeds.feedburner.com/Metalsucks` returns `200 OK`, `content-type: text/xml`, valid RSS 2.0 XML with `<channel><title>MetalSucks</title>...`; `https://www.loudersound.com/feeds.xml` returns `200 OK`, `content-type: application/xml`, valid RSS 2.0 XML. Neither is behind a Cloudflare challenge (the failure mode that blocked Metal Storm's listing-page URL in feature 024). Both feeds use standard `<item>` elements with `title`/`link`/`pubDate`/content fields that `feedMapper.ts`'s existing generic mapping (title, link, excerpt from `contentSnippet`/`content`/`summary`, image from `enclosure` or inline `<img>`, `isoDate`/`pubDate` fallback) already handles without modification — no source-specific parsing logic is needed.

**Alternatives considered**: None — both URLs were explicitly specified in the feature input; the only open question (reachability/format) is resolved above.

## 7. Retiring the carousel and per-category-section components

**Decision**: Delete `FeedCarousel.tsx`, `FeedCategorySection.tsx`, and `FeedCarousel.test.tsx` outright. Replace `e2e/tests/dashboard-feed-carousel.spec.ts` with `e2e/tests/dashboard-feed-grid.spec.ts`.

**Rationale**: Once `FeedArticleBoard` renders a flat, filtered grid directly, nothing calls `FeedCarousel` or `FeedCategorySection` — leaving them in the tree as dead code would violate Principle III ("no half-finished implementations," "don't design for hypothetical future needs"). The old e2e spec asserts carousel-arrow behavior that no longer exists in the UI, so it must be replaced rather than left failing or skipped.

**Alternatives considered**: Keeping `FeedCarousel` unused "in case carousels come back" — rejected per YAGNI; it can be restored from git history if ever needed again.
