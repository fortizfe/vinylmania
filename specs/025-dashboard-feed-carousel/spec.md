# Feature Specification: Dashboard Feed Carousels & Metal Storm Categories

**Feature Branch**: `025-dashboard-feed-carousel`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Quiero hacer más cambios sobre la vista de dashboard. Lo primero que quiero es quitar el título \"Dashboard\" que tiene ahora. No es necesario. Tambien quiero añadir los siguientes feeds: News https://metalstorm.net/rss/news.xml, Reviews https://metalstorm.net/rss/reviews.xml, Interviews https://metalstorm.net/rss/interviews.xml, Articles https://metalstorm.net/rss/articles.xml, Staff picks https://metalstorm.net/rss/picks.xml. Quiero añadir un componente que muestre los últimos 10 feeds de un rss. Quiero que el componente muestre cada feed con la misma apariencia que lo hace ahora. Pero que crezca en horizontal como los componentes que muestran las tarjetas en horizontal con unas flechas para indicar que se puede mover de un lado a otro. Cada feed rss será una categorías que se muestre como se menciona anteriormente."

## Clarifications

### Session 2026-07-08

- Q: Which end of a category's carousel is shown first, and what do the arrows move toward? → A: Most recent article shown first (leftmost); "next" reveals progressively older articles; "previous" is disabled/hidden at the start since nothing is newer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse a category's articles through a horizontal carousel (Priority: P1)

A collector viewing the Dashboard wants to see more than a handful of recent articles per category without the page turning into a long, ever-growing vertical list. They want to move left and right through a category's most recent articles using clear on-screen arrows, while each article still looks exactly like it does today (image or placeholder, title, source, category, date, excerpt).

**Why this priority**: This is the central interaction change requested for this increment. It replaces the current small, fixed vertical grid per category with a browsable horizontal carousel, and it is the mechanism every category (existing and newly added) will use going forward — nothing else in this spec is useful without it.

**Independent Test**: Can be fully tested by opening the Dashboard, picking any category with more than a few articles, and confirming the articles are arranged in a single horizontal row with visible previous/next arrows that reveal additional articles (up to the 10 most recent) as the user clicks through, while each article card's appearance (image/placeholder, title, source, category, date, excerpt) matches the current design.

**Acceptance Scenarios**:

1. **Given** a category has more articles than fit on screen at once, **When** the user views that category, **Then** the articles are displayed in a single horizontal row, most recent article first (leftmost), with left/right arrow controls that scroll toward progressively older articles.
2. **Given** the user is viewing the start of a category's carousel (the most recent article), **When** they look at the "previous" control, **Then** it is disabled or hidden since there is nothing newer to show.
3. **Given** the user is viewing the end of a category's carousel (having reached its oldest available article, up to the 10th), **When** they look at the "next" control, **Then** it is disabled or hidden since there is no older content left.
4. **Given** a category has 10 or fewer available articles, **When** the user views it, **Then** all available articles are shown in the carousel without empty placeholder slots, and navigation arrows reflect that there is nothing more to scroll to in the direction(s) with no additional content.
5. **Given** an article is displayed inside a carousel, **When** the user views it, **Then** it shows the same information and visual style (image/placeholder, title, source, category, publish date, excerpt) as articles do today, and selecting it still opens the original article on the source's site in a new tab.

---

### User Story 2 - Discover more Metal Storm content categories (Priority: P2)

A collector who already uses the Dashboard for heavy metal news wants to also see Metal Storm's reviews, interviews, articles, and staff-picked content, not just news, so the Dashboard becomes a more complete one-stop view of what's happening in the genre.

**Why this priority**: This expands the breadth of content available on top of the browsing mechanism from User Story 1. It adds clear incremental value (five additional content categories) but depends on the carousel already existing to comfortably display up to 10 items per category.

**Independent Test**: Can be fully tested by loading the Dashboard and confirming that News, Reviews, Interviews, Articles, and Staff Picks categories sourced from Metal Storm's dedicated feeds are present (in addition to any pre-existing categories), each showing its own recent articles via the carousel from User Story 1.

**Acceptance Scenarios**:

1. **Given** the Dashboard has loaded, **When** the user scans the page, **Then** they can find categories for Metal Storm News, Reviews, Interviews, Articles, and Staff Picks, each populated with that feed's recent articles.
2. **Given** one of these five new feeds temporarily fails to load, **When** the Dashboard renders, **Then** the remaining categories (including the other four new ones and any pre-existing categories) still display normally, consistent with existing source-failure handling.
3. **Given** an existing category already shares a name with one of the newly connected feeds (for example, "News"), **When** both sources have recent content, **Then** the user sees a single "News" category whose carousel combines the most recent articles from both sources, rather than two separately labeled "News" sections.
4. **Given** one of the five new feeds currently has no items, **When** the user views the Dashboard, **Then** that category is hidden rather than shown as an empty section, consistent with existing empty-category handling.

---

### User Story 3 - See a cleaner Dashboard without a redundant page title (Priority: P3)

A collector opening the Dashboard wants to get straight to the content — the page's own top navigation already tells them where they are, so a large "Dashboard" heading at the top of the page is unnecessary and just takes up space.

**Why this priority**: This is a small, purely cosmetic cleanup independent of the other two stories. It has no functional dependencies and delivers a (minor) standalone improvement on its own.

**Independent Test**: Can be fully tested by opening the Dashboard and confirming that no "Dashboard" heading/title text is shown at the top of the page, while the source-status notice and feed content still render normally starting closer to the top of the page.

**Acceptance Scenarios**:

1. **Given** the user opens the Dashboard, **When** the page finishes loading, **Then** no "Dashboard" heading is displayed, and the category filter/content begins where the heading used to be.

---

### Edge Cases

- What happens when a category's underlying feed(s) currently have fewer than 10 published articles? The carousel MUST show only the available articles (no empty/placeholder slots), and the "next" arrow MUST reflect that there is nothing further to scroll to.
- What happens when a category combines articles from more than one feed source (e.g., an existing category and a newly added Metal Storm feed sharing the same category name)? The combined list MUST still be capped at the 10 most recent articles overall, sorted by recency, not 10 per contributing source.
- What happens when one of the five newly added Metal Storm feeds is temporarily unreachable? The Dashboard MUST continue showing the other available categories plus the existing non-blocking "source unavailable" notice, consistent with current source-failure handling; it MUST NOT block the rest of the page.
- What happens when a user navigates the carousel using a keyboard or assistive technology instead of a mouse/touch? The previous/next controls MUST be reachable and operable without requiring pointer input.
- What happens on a narrow (mobile-width) screen? The carousel MUST remain usable via the arrow controls and MUST NOT cause the overall page to scroll horizontally — only the carousel row itself scrolls.
- What happens if a newly added Metal Storm feed returns malformed or unparseable items? Consistent with existing behavior, the Dashboard MUST skip the unparseable items (or that source) and keep showing valid content from the rest of that category/other categories.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the standalone "Dashboard" page heading; the page MUST NOT display a generic page title above its content.
- **FR-002**: System MUST connect to and retrieve articles from five additional Metal Storm feeds: News, Reviews, Interviews, Articles, and Staff Picks.
- **FR-003**: System MUST group the articles retrieved from each of these five feeds into a category labeled to match that feed (News, Reviews, Interviews, Articles, Staff Picks respectively), consistent with how categories are derived from feeds today.
- **FR-004**: When a category label from a newly added feed matches the label of an already-existing category (e.g., "News"), the system MUST combine articles from both contributing sources into that single category rather than displaying duplicate, separately labeled sections.
- **FR-005**: System MUST display every category's articles (both pre-existing categories and the five newly added ones) as a horizontally scrollable row ("carousel") rather than the previous fixed vertical/grid layout.
- **FR-006**: Each category's carousel MUST show up to the 10 most recently published articles for that category, sorted by recency, superseding the prior smaller per-category display limit.
- **FR-007**: Each carousel MUST open with its most recent article shown first (leftmost); the "next" control MUST move toward progressively older articles, the "previous" control MUST move back toward more recent ones, and either control MUST be disabled or hidden when there is no further content in that direction (nothing newer than the first article, nothing older than the last).
- **FR-008**: Each article shown within a carousel MUST retain the same information and visual presentation (image or placeholder, title, source, category, publish date, excerpt, and link to the original article) as the current per-article display.
- **FR-009**: Carousel previous/next controls MUST be operable via keyboard/assistive technology, not solely via pointer or touch input.
- **FR-010**: System MUST continue to hide any category (existing or newly added) that currently has zero available articles, and MUST continue to display remaining categories plus a non-blocking notice when a configured feed source fails to load, consistent with existing dashboard resilience behavior.
- **FR-011**: System MUST sanitize all article content retrieved from the five newly added Metal Storm feeds before rendering, consistent with existing content-safety handling for other sources.

### Key Entities

- **Feed Source**: Extends the existing set of connected RSS feeds with five new entries — Metal Storm News, Metal Storm Reviews, Metal Storm Interviews, Metal Storm Articles, and Metal Storm Staff Picks — each with a name, source URL, and associated category.
- **Category**: A logical grouping label used to organize Articles for display (e.g., News, Reviews, Interviews, Articles, Staff Picks). A Category can contain Articles from more than one Feed Source (e.g., "News" may combine articles from more than one connected publication) and is now presented as a horizontally navigable carousel of its most recent Articles (up to 10) instead of a fixed grid.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view up to 10 recent articles per category and reach any of them using only the carousel's visible arrow controls, without scrolling past unrelated categories to do so.
- **SC-002**: The Dashboard displays feed content (status notice, category filters, and categories) with no generic page title consuming space at the top of the page.
- **SC-003**: Users can discover content from at least 5 additional Metal Storm categories (News, Reviews, Interviews, Articles, Staff Picks) that were not available before this increment.
- **SC-004**: From the most recent article (first/leftmost) in a category's carousel, a user can reach its oldest available article (up to the 10th) in no more than 9 "next" interactions.
- **SC-005**: When a category combines articles from multiple feed sources, users still see a single, non-duplicated set of at most 10 articles for that category, sorted by recency.

## Assumptions

- The horizontal carousel presentation and the 10-article cap apply to every category on the Dashboard — both the categories already shipped in the RSS Feed Dashboard MVP and the five newly added Metal Storm categories — for visual and interaction consistency across the page. This supersedes the MVP's prior 3-5 item "curated highlight" limit for per-category display.
- Combining same-labeled categories across multiple feed sources (e.g., an existing "News" category plus the newly added Metal Storm "News" feed) is consistent with the Category data model already established in the RSS Feed Dashboard MVP, which allows a Category to include Articles from more than one Feed Source; same-named categories are therefore merged rather than shown as separate, duplicate sections.
- The five Metal Storm feed URLs provided are direct RSS/XML endpoints, distinct from the general Metal Storm listing page previously noted as protected by anti-bot measures; whether they are reachable without that same restriction is a technical/planning concern to confirm during implementation, not a product-scope blocker for this spec.
- The relative order in which categories/carousels appear on the page is not specified by the user and is left to reasonable design judgment; no specific ordering is mandated by this spec.
- No swipe/touch-gesture requirement is mandated beyond the visible arrow controls; touch/swipe support may be added as a natural enhancement but is not a required acceptance criterion here.
- Removing the page title affects only the visible on-page heading; it does not change the browser tab/document title.
- All other existing Dashboard behaviors (authentication requirement, content sanitization, graceful degradation on source failure, opening articles on the source's site, periodic refresh) remain unchanged and continue to apply as defined in the RSS Feed Dashboard MVP.
