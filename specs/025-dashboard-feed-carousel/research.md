# Phase 0 Research: Dashboard Feed Carousels & Metal Storm Categories

## 1. Horizontal carousel implementation approach

**Decision**: Build the carousel with a native horizontally-scrolling flex container (`overflow-x-auto`, `scroll-smooth`, optionally `snap-x`/`snap-mandatory` on the row and `snap-start` on each card) plus two plain `<button>` elements that call `scrollBy({ left: ±delta, behavior: 'smooth' })` on the container ref. Arrow disabled/hidden state is derived from the container's `scrollLeft`, `scrollWidth`, and `clientWidth` (previous disabled when `scrollLeft <= 0`; next disabled when `scrollLeft + clientWidth >= scrollWidth - 1`), recomputed on the container's `scroll` and `resize` events.

**Rationale**: No carousel component exists anywhere in the codebase today (confirmed by repo search — `ReleaseImageGallery.tsx` is a vertical thumbnail strip, not a horizontal arrowed row) and no carousel library is a current dependency. A native-scroll implementation needs zero new dependencies, matches Principle III (Simplicity/YAGNI), and reuses ordinary DOM APIs already available in every supported browser. `<button>` elements are natively keyboard-focusable and Enter/Space-activatable, satisfying spec FR-009 without extra ARIA plumbing beyond an `aria-label` for the icon-only buttons.

**Alternatives considered**: A carousel library (`embla-carousel-react`, `keen-slider`, `swiper`) — rejected as an unjustified new dependency for a single, simple horizontal-scroll-with-arrows use case; native scroll covers every acceptance scenario in the spec (bounded ends, keyboard operability, no page-level horizontal scroll) without it.

## 2. Arrow icons

**Decision**: Add two small local inline-SVG components (`ChevronLeftIcon`, `ChevronRightIcon`) directly inside the new `FeedCarousel.tsx`, mirroring the existing pattern in `frontend/src/components/ui/BackLink.tsx` (a private `ChevronLeftIcon` function component defined next to its one usage).

**Rationale**: The codebase has no icon library dependency (`lucide-react`, `heroicons`, etc. are not installed) and already solves this exact need (a chevron) with a hand-written inline SVG scoped to the component that needs it. Repeating that convention keeps this change consistent with the rest of the app and avoids introducing a new dependency for two glyphs (Principle III).

**Alternatives considered**: A new icon package — rejected, unjustified for two icons; a shared `icons/` module — rejected for now since only one component needs chevrons today (no duplication yet to justify extraction, per Principle III's "don't build for hypothetical future needs").

## 3. Raising the per-category cap and merging same-labeled categories

**Decision**: Change only the `ARTICLES_PER_CATEGORY` constant in `backend/src/feeds/feedAggregator.ts` from `5` to `10`. No other change to `groupByCategory` is needed.

**Rationale**: `groupByCategory` already (a) groups all fetched articles by their `category` string regardless of which `FeedSource` produced them, (b) sorts each group by `publishedAt` descending (newest first), and (c) slices to the cap constant. This already implements both the newest-first carousel ordering clarified for this feature and the "merge same-labeled categories across sources, capped once" requirement (spec FR-004, FR-006, SC-005) — it was written generically in 024 and needs no logic change, only the cap value.

**Alternatives considered**: Capping per-source before merging (e.g., 10 from Metal Injection + 10 from Metal Storm News, then merge) — rejected: this would violate spec FR-004/SC-005's requirement that the *combined* category is capped at 10 overall, not 10 per contributing source, and is exactly the bug the existing slice-after-merge order avoids.

## 4. Metal Storm feed source configuration

**Decision**: Replace the single, permanently-disabled `metal-storm` entry in `backend/src/feeds/feedSources.ts` (which pointed at the Cloudflare-protected `metalstorm.net/home/rss.php` listing page) with five new, enabled entries pointing directly at the concrete feed URLs supplied for this feature:

| id | name | feedUrl | category |
|---|---|---|---|
| `metal-storm-news` | Metal Storm | `https://metalstorm.net/rss/news.xml` | News |
| `metal-storm-reviews` | Metal Storm | `https://metalstorm.net/rss/reviews.xml` | Reviews |
| `metal-storm-interviews` | Metal Storm | `https://metalstorm.net/rss/interviews.xml` | Interviews |
| `metal-storm-articles` | Metal Storm | `https://metalstorm.net/rss/articles.xml` | Articles |
| `metal-storm-picks` | Metal Storm | `https://metalstorm.net/rss/picks.xml` | Staff Picks |

The `metal-storm-news` entry intentionally shares the `News` category label with the existing `metal-injection` entry, exercising the merge path from Decision 3.

**Rationale**: These are direct per-category RSS/XML endpoints, distinct from the general HTML listing page that 024's research (024/research.md §3) found blocked by a Cloudflare managed challenge; they are expected to be reachable by a plain server-side HTTP client the same way `metal-injection`'s feed already is. Removing the old disabled entry (rather than leaving it stubbed alongside the new ones) avoids a dead, permanently-`enabled: false` config entry now that concrete replacements exist (Principle III).

**Follow-up for implementation**: The first implementation task touching `feedSources.ts` should confirm each of the five URLs returns a parseable feed (not a Cloudflare challenge) from the deploy environment; if any one of them is unexpectedly blocked, it ships with `enabled: false` and a `feed_unavailable` status, consistent with the existing per-source graceful-degradation behavior (spec FR-010) — this does not block the other four.

**Verified (2026-07-08, T001)**: All 5 URLs return `200 OK` with `content-type: application/rss+xml` and valid RSS 2.0 XML (confirmed via `curl` with the same `User-Agent` `feedClient.ts` sends) — no Cloudflare challenge encountered. All 5 ship `enabled: true`.

## 5. E2E coverage gap

**Decision**: Add `e2e/tests/dashboard-feed-carousel.spec.ts`, covering: the Dashboard page loads without a "Dashboard" heading, categories for the five new Metal Storm feeds are present, and a category's carousel arrows navigate and disable at the ends.

**Rationale**: The constitution's Development Workflow gate mandates e2e coverage for any PR touching `/frontend`, but feature 024 shipped its entire Dashboard page and components without one. Since this feature also touches `/frontend` (`DashboardPage.tsx`, `FeedCategorySection.tsx`, new `FeedCarousel.tsx`), it must satisfy that gate itself; closing the pre-existing gap here (rather than deferring further) keeps this PR compliant without introducing new scope beyond what the constitution already requires for any frontend change.

**Alternatives considered**: Skipping e2e coverage on the basis that 024 already skipped it — rejected: the constitution gate applies per-PR, not retroactively, and this PR is a `/frontend`-touching PR like any other.
