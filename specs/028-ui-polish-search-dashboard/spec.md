# Feature Specification: UI Polish – Search Results & Dashboard Cards

**Feature Branch**: `028-ui-polish-search-dashboard`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "para este incremento quiero trabajar en pulir un poco algunos aspectos de la app. 1. Quiero que la busqueda de discos pase de 20 elementos a 40 para que el scroll infinito se sienta más fluido. 2. Quiero que las tarjetas de resultados de búsqueda tengan el mismo tamaño. Ahora mismo los master son más qpeueños que los releases. 3. Quiero que el efecto carátulas apiladas resalte un poco más. Actualmentte no se distingue a golpe de vista y puede ser confuso. 4. En la vista de dashboard, quiero que todas las tarjetas de los rss tengan el mismo tamaño. Actualmente las que tienen menos texto son más pequeñas."

## Clarifications

### Session 2026-07-09

- Q: Should "same size" for search result cards mean a single fixed height applied uniformly across the entire results grid, or just equal height within each row? → A: Fixed uniform height applied to all cards across the entire results grid (every card, every row, same height)
- Q: How should the extra vertical space on master cards (which omit the format badge and action buttons) be filled to reach the fixed card height? → A: Add a static "Multiple editions" label/badge (no live release count, no extra API calls) rather than empty padding or a live count
- Q: How many lines should RSS article card titles and excerpts be clamped to for consistent height? → A: Title clamped to 2 lines, excerpt clamped to 2 lines

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smoother infinite scroll in search results (Priority: P1)

A user searching for vinyl records scrolls through results. Today each batch loaded is 20 items, which the user experiences as a series of small, choppy jumps. Loading larger batches (40 items) makes the scrolling experience feel smoother and reduces the number of loading pauses.

**Why this priority**: Directly requested as the top item and affects every search interaction; it's a small, low-risk, high-frequency improvement.

**Independent Test**: Perform a catalog search, scroll to the bottom of the first batch of results, and verify that 40 results are shown before the next batch is fetched (instead of 20), with subsequent batches also loading 40 at a time.

**Acceptance Scenarios**:

1. **Given** a user performs a search that returns more than 20 results, **When** the results page loads initially, **Then** up to 40 results are displayed in the first batch.
2. **Given** a user has scrolled to the end of the currently loaded results and more results are available, **When** the next batch is fetched via infinite scroll, **Then** up to 40 additional results are appended.
3. **Given** a search that returns fewer than 40 total results, **When** the results load, **Then** all available results are shown without errors or empty placeholder slots.

---

### User Story 2 - Consistent search result card sizing (Priority: P1)

A user browsing search results sees a grid mixing "master" (grouped) release cards and individual "release" cards. Master cards currently render shorter than release cards because they omit certain content rows (e.g., format badge, action buttons), which makes the grid look uneven and unpolished.

**Why this priority**: Visual inconsistency is present on every search results page and affects the app's perceived quality; it's a foundational layout fix that also supports Story 3 (the stacked-covers effect lives on the same card).

**Independent Test**: Run a search that returns a mix of master and release results, and verify all cards in the grid share the same height and visual weight regardless of result type or content length.

**Acceptance Scenarios**:

1. **Given** a search results grid containing both master and release cards, **When** the grid is rendered, **Then** every card across the entire grid — not just within the same row — shares the same fixed height.
2. **Given** a master card that omits a format badge and action buttons compared to a release card, **When** it is displayed, **Then** a static "Multiple editions" label fills the resulting space, so its overall footprint (height) matches the fixed height used for release cards without leaving broken or awkward empty space.
3. **Given** the results grid is viewed at different breakpoints (mobile, tablet, desktop), **When** cards reflow into different column counts, **Then** all cards continue to render at the same fixed height at each breakpoint (the fixed height value may differ between breakpoints, but is constant for all cards within a given breakpoint).

---

### User Story 3 - More noticeable stacked-covers effect for grouped releases (Priority: P2)

A user scanning search results should be able to tell at a glance which cards represent a "master" (a group of multiple releases) versus a single release, via a stacked-covers visual cue. Today the effect is too subtle to notice without close inspection, which can confuse users about why some records behave differently when clicked (e.g., leading to a grouped detail view).

**Why this priority**: Improves clarity and reduces user confusion, but is a refinement of an existing feature rather than new functionality, and depends on the sizing consistency from Story 2 to look correct.

**Independent Test**: View a search results page containing master results and confirm that the stacked-covers effect is clearly perceivable at a normal glance (not requiring close inspection), distinguishing master cards from single-release cards.

**Acceptance Scenarios**:

1. **Given** a master (grouped) result card, **When** it is rendered in the search results grid, **Then** the stacked-covers effect (offset background layers behind the cover) is visually distinct enough to be noticed without zooming in or inspecting closely.
2. **Given** a single-release result card, **When** it is rendered, **Then** it does NOT show the stacked-covers effect, preserving the visual distinction between grouped and single results.
3. **Given** the enhanced stacked-covers effect, **When** viewed alongside the equal-height card layout from Story 2, **Then** the effect remains fully visible and is not clipped or hidden by the card boundary.

---

### User Story 4 - Consistent RSS card sizing on the dashboard (Priority: P3)

A user viewing the dashboard's RSS feed carousels sees article cards of varying heights, where cards with shorter titles or excerpts appear noticeably smaller than cards with longer text. This makes the carousel rows look uneven.

**Why this priority**: Improves visual polish on a secondary (dashboard) surface; lower traffic than the search results page, so ranked after search-related fixes.

**Independent Test**: View a dashboard feed carousel containing articles with varying title/excerpt lengths and verify all cards render at the same height within a row.

**Acceptance Scenarios**:

1. **Given** a feed carousel with articles of differing title and excerpt lengths, **When** the carousel is rendered, **Then** all article cards share the same height.
2. **Given** an article with a very short title and no excerpt, **When** its card is rendered next to an article with a long title and excerpt, **Then** both cards have equal height, with the shorter content's card using consistent internal spacing rather than shrinking to fit its content.
3. **Given** an article with a title or excerpt long enough to otherwise overflow the card, **When** it is rendered, **Then** the title is truncated to 2 lines and the excerpt to 2 lines (each with an ellipsis) rather than growing the card beyond the shared height.

---

### Edge Cases

- What happens when a search results page (or a specific batch) contains zero master results? The equal-height and stacked-covers changes must not visually affect release-only grids.
- What happens when a results grid has only one item in the final row? The single card should not stretch to an unnatural height beyond its row's natural sizing.
- What happens on very narrow (mobile) viewports where cards stack into a single column? The fixed card height for that breakpoint still applies to every card, even though only one card appears per visual row.
- What happens when an RSS feed article has no excerpt at all, or a title long enough to normally wrap to 3+ lines? The card should truncate content consistently rather than displaying variable amounts of text.
- What happens when the increased batch size (40) is requested for a query with very few total results (e.g., 5)? The system must return exactly what's available without errors or duplicate/empty entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search results page MUST request and display 40 items per batch (initial load and each subsequent infinite-scroll load), replacing the current batch size of 20.
- **FR-002**: Search result cards MUST render at a single fixed height applied uniformly across the entire results grid — not just within a row — regardless of whether the card represents a "master" (grouped) or a "release" result, and regardless of differences in the content each type displays (e.g., presence/absence of a format badge or action buttons).
- **FR-002a**: Master (grouped) result cards MUST display a static "Multiple editions" label/badge in place of the format badge and action buttons that release cards show, so the fixed card height (FR-002) is reached with meaningful content rather than empty padding. This label MUST NOT depend on a live release/version count (no additional data fetch is required).
- **FR-003**: The fixed card height MUST hold across all supported responsive breakpoints (mobile, tablet, desktop) where the results grid changes column count; the specific height value MAY differ between breakpoints but MUST be constant for all cards within a given breakpoint.
- **FR-004**: The stacked-covers visual effect on master (grouped) result cards MUST be visually enhanced so that it is clearly distinguishable from a single-release card at a normal glance, without requiring the user to zoom in or inspect closely.
- **FR-005**: The stacked-covers effect MUST remain exclusive to master (grouped) result cards; single-release cards MUST NOT display the effect.
- **FR-006**: The enhanced stacked-covers effect MUST NOT be clipped, cut off, or obscured by the card's boundary or by the equal-height adjustments from FR-002.
- **FR-007**: RSS feed article cards on the dashboard MUST render at a uniform height within each feed carousel/row, regardless of the length of the article's title or excerpt.
- **FR-008**: RSS feed article cards MUST truncate title text to a maximum of 2 lines and excerpt text to a maximum of 2 lines (each with an ellipsis when truncated), rather than growing the card, when content would otherwise exceed the space available within the uniform card height.
- **FR-009**: The batch-size increase (FR-001) MUST NOT change the ordering behavior already established for search results (masters-first ordering), and MUST correctly handle result sets smaller than 40 without errors or invalid empty entries.

### Key Entities

- **Search Result Card**: A visual representation of either a "master" (grouped) or "release" (single) catalog entry in the search results grid; carries a cover image, title/artist text, and — for releases — a format badge and action controls, or — for masters — the stacked-covers visual treatment and a static "Multiple editions" label in place of the badge/actions.
- **RSS Article Card**: A visual representation of a single syndicated feed article on the dashboard; carries a title, optional excerpt, and is displayed within a horizontally scrolling carousel grouped by feed category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users scrolling through search results encounter loading pauses roughly half as often as before, since each loaded batch contains 40 results instead of 20.
- **SC-002**: Across the entire search results grid, 100% of cards (master and release alike) render at the same fixed height, verified across mobile, tablet, and desktop layouts.
- **SC-003**: In an informal glance test (viewing a results page for at most 2 seconds), users can correctly identify which cards represent grouped/master results based on the stacked-covers effect alone, without prior explanation.
- **SC-004**: In any dashboard RSS feed carousel, 100% of article cards render at the same height regardless of their title/excerpt length.
- **SC-005**: No regressions are introduced to existing search result ordering (masters-first) or to the ability to open/interact with either card type.

## Assumptions

- The existing masters-first ordering logic and infinite-scroll mechanism (from prior features) remain unchanged in behavior other than the batch size.
- "Uniform height" for search result cards means a single fixed height applied to every card across the whole results grid (confirmed via clarification), not merely matched within individual rows. The fixed value may differ between mobile/tablet/desktop breakpoints as long as it's constant for all cards within a given breakpoint. For RSS carousel cards, "uniform height" means consistent height within each carousel/row.
- Increasing batch size from 20 to 40 does not require backend/API contract changes beyond passing a different page-size parameter, since the underlying search API already supports variable page sizes.
- "Resaltar" (highlight/enhance) the stacked-covers effect (FR-004) means increasing its visual contrast (e.g., offset, shadow, or layering) rather than replacing it with a fundamentally different visual pattern (e.g., a badge or counter). This is separate from the "Multiple editions" label (FR-002a), which is added alongside — not instead of — the stacked-covers effect, purely to fill the height gap left by the missing format badge/action buttons.
- Truncating RSS card text (title/excerpt) with an ellipsis when content overflows is an acceptable trade-off for achieving consistent card height, since full article text remains available after clicking through to the source.
- No changes are required to the underlying data fetched (search results or RSS feed items) — this feature is purely about presentation/layout and batch size, not data content.
