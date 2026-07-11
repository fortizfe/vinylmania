# Feature Specification: RSS Dashboard Redesign — Responsive Layouts & New Sources

**Feature Branch**: `033-rss-dashboard-redesign`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Quiero mejorar el diseño y la usabilidad del dashboard de noticias RSS. Mantén el estilo de tarjeta actual (imagen + texto: título, extracto, fuente, categoría, fecha) pero rediseña el layout general porque la usabilidad actual es mala: en desktop se desaprovecha el espacio (los carruseles horizontales por categoría ocultan la mayoría del contenido y obligan a hacer clic en flechas para ver más), en móvil la experiencia de scroll horizontal en pantallas pequeñas es incómoda y con poco espacio para tocar, la densidad/orden general dificulta escanear rápido qué es reciente o relevante, y no hay forma de filtrar por fuente ni de navegar fácilmente entre fuentes/categorías (solo existe hoy un filtro de categoría). Investiga y diseña dos layouts diferenciados, uno por tipo de dispositivo: Desktop/navegador con grid/cuadrícula responsive de varias columnas y barra de filtros (categoría + fuente) sticky; Móvil con lista de una sola columna, tarjetas compactas, sin scroll horizontal, y controles de filtro con buen tamaño de toque. Añade dos nuevas fuentes RSS: MetalSucks (https://feeds.feedburner.com/Metalsucks) y Louder Sound (https://www.loudersound.com/feeds.xml). Las 3 fuentes más importantes son Metal Injection (ya existente) y estas dos nuevas, con el mismo peso visual entre sí y respecto al resto, diferenciándose solo por una etiqueta/badge de fuente. El usuario debe poder filtrar por cualquier fuente disponible."

## Clarifications

### Session 2026-07-11

- Q: There's a contradiction between User Story 4's Independent Test ("selecting one or more sources") and the Assumptions section ("single active source, plus an 'all sources' option"). Which is correct? → A: Single-select — the source filter follows the same single-active-selection pattern as the existing category filter (plus an "all sources" option).
- Q: On very wide (ultra-wide) desktop monitors, what should the maximum column count be for the desktop grid? → A: 5 columns max — cards grow slightly wider beyond that rather than adding more columns.
- Q: FR-006 requires mobile filter controls to use "comfortable" touch target sizes but gives no concrete number. What minimum touch target size should filter controls meet? → A: 44x44 CSS px (WCAG 2.5.5 / Apple HIG minimum).
- Q: The Source entity's priority-source flag says it "governs default emphasis, if any," which conflicts with FR-010's equal-prominence requirement. What should this flag actually do? → A: Default filter order only — priority sources (Metal Injection, MetalSucks, Louder Sound) are listed first within the source filter's option list; no effect on card size, article ordering, or prominence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan many articles at a glance on desktop without extra clicks (Priority: P1)

A collector opens the Dashboard on a laptop or desktop monitor and wants to see a wide, information-dense overview of recent articles immediately — without the current experience of most content being hidden behind horizontal carousels that require clicking arrows to reveal.

**Why this priority**: This is the central complaint driving the redesign: the current carousel-per-category layout wastes the available horizontal space and hides the majority of content behind interaction. Replacing it is the highest-value, most foundational change — every other improvement in this spec builds on top of the new desktop layout.

**Independent Test**: Can be fully tested by opening the Dashboard on a desktop-width browser window and confirming that a large number of articles across categories/sources are visible arranged in a multi-column grid immediately on load, with no arrow-click interaction required to reveal additional articles that are already loaded, and that the article card still shows the same information as today (image or placeholder, title, excerpt, source, category, date).

**Acceptance Scenarios**:

1. **Given** the user opens the Dashboard on a desktop-width browser window, **When** the page finishes loading, **Then** loaded articles are arranged in a responsive multi-column grid that uses the available horizontal space, rather than single-row horizontal carousels.
2. **Given** the user is viewing the desktop grid, **When** they scroll down the page, **Then** the category and source filter controls remain visible (sticky) so they can refine what they're viewing without scrolling back to the top.
3. **Given** the browser window is resized to a wider or narrower desktop width, **When** the layout reflows, **Then** the number of grid columns adjusts to keep articles readable and comfortably sized, without ever requiring horizontal scrolling of the page itself.
4. **Given** an article card is displayed in the grid, **When** the user views it, **Then** it shows the same information and visual style as today (image or placeholder, title, excerpt, source, category, publish date), and selecting it opens the original article on the source's site in a new tab.

---

### User Story 2 - Comfortably browse the news feed on a mobile device (Priority: P2)

A collector checks the Dashboard from their phone during a short break and wants a layout that's easy to scroll through with one thumb, with no sideways scrolling or fiddly small tap targets — just a clear, scannable vertical list of recent news.

**Why this priority**: Mobile usability was flagged as one of the worst parts of the current experience (horizontal-scroll carousels are awkward to use on a touchscreen and give little room per card). This delivers a dedicated, independently valuable improvement for the mobile audience, decoupled from the desktop grid work in User Story 1.

**Independent Test**: Can be fully tested by opening the Dashboard on a mobile-width viewport and confirming articles are arranged in a single vertical column with compact cards, that no horizontal scrolling is required or possible on the page or within a category, and that filter controls are reachable and large enough to tap comfortably.

**Acceptance Scenarios**:

1. **Given** the user opens the Dashboard on a mobile-width viewport, **When** the page finishes loading, **Then** articles are displayed in a single-column vertical list optimized for scrolling, with no horizontal carousel or side-scrolling row of cards.
2. **Given** the user is scrolling the mobile article list, **When** they view a card, **Then** it uses a more compact presentation (e.g., a smaller or side-positioned image) than the desktop card so more articles are visible per scroll, while still showing title, excerpt, source, category, and date.
3. **Given** the user wants to apply a category or source filter on mobile, **When** they interact with the filter controls, **Then** each control is large enough to tap accurately (comfortable touch target size) without accidentally triggering a neighboring control.
4. **Given** the user is viewing the Dashboard on a mobile device, **When** they scroll through the page at any point, **Then** the page never scrolls horizontally.

---

### User Story 3 - Discover news from MetalSucks and Louder Sound alongside Metal Injection (Priority: P3)

A collector who already relies on the Dashboard for Metal Injection news wants MetalSucks and Louder Sound content included too, appearing with the same visual prominence as any other source, so the Dashboard becomes a more complete, balanced view of the genre's news rather than favoring one outlet.

**Why this priority**: This expands the breadth of content on top of the redesigned layouts from User Stories 1 and 2. It is valuable on its own (more relevant content) but depends on having a layout that can scale to more articles without becoming worse to use — hence it follows the layout work in priority.

**Independent Test**: Can be fully tested by loading the Dashboard (desktop or mobile) and confirming that articles from MetalSucks and Louder Sound appear alongside existing sources, each card visually identical in size/prominence to any other article card and distinguished only by a source label/badge, and that Metal Injection, MetalSucks, and Louder Sound all read with equal visual weight relative to one another.

**Acceptance Scenarios**:

1. **Given** the Dashboard has loaded, **When** the user scans the articles, **Then** they can find recent articles sourced from MetalSucks and from Louder Sound in addition to existing sources.
2. **Given** an article card belongs to Metal Injection, MetalSucks, or Louder Sound, **When** the user compares it to a card from any other source, **Then** the card size and layout are identical — the only difference is the source label/badge shown on the card.
3. **Given** MetalSucks or Louder Sound temporarily fails to load, **When** the Dashboard renders, **Then** the rest of the Dashboard (other sources and categories) still displays normally, consistent with existing source-failure handling.
4. **Given** MetalSucks or Louder Sound returns malformed or unparseable items, **When** the Dashboard renders, **Then** the unparseable items (or that source) are skipped and valid content from the rest of the Dashboard is still shown.

---

### User Story 4 - Filter the Dashboard by news source (Priority: P4)

A collector who only cares about specific outlets (for example, just Metal Injection and Louder Sound) wants to filter the Dashboard down to those sources, in addition to the existing category filter, so they don't have to scan past articles from sources they're not interested in right now.

**Why this priority**: This is an added navigation capability on top of the redesigned, source-expanded Dashboard. It meaningfully improves usability but is the smallest, most self-contained piece — the Dashboard is already usable without it once User Stories 1-3 are in place.

**Independent Test**: Can be fully tested by opening the Dashboard, selecting a single source from a source filter control, and confirming only articles from that source are shown, that the selection can be combined with the existing category filter, and that clearing the filter restores the full article set.

**Acceptance Scenarios**:

1. **Given** the user is viewing the Dashboard, **When** they open the source filter, **Then** every currently available source — including Metal Injection, MetalSucks, and Louder Sound — is listed as a selectable option.
2. **Given** the user selects a specific source in the filter, **When** the article list updates, **Then** only articles from that source are shown, on both the desktop grid and the mobile list.
3. **Given** the user has both a category and a source filter applied, **When** the article list updates, **Then** only articles matching both the selected category and the selected source are shown.
4. **Given** the user has an active source filter, **When** they reset or clear it, **Then** the Dashboard returns to showing articles from all sources.
5. **Given** a source filter selection results in no matching articles, **When** the user views the Dashboard, **Then** a clear empty-state message is shown instead of a blank area.

---

### Edge Cases

- What happens on a very wide (ultra-wide monitor) desktop viewport? The grid MUST cap at a maximum of 5 columns; beyond that, cards grow slightly wider rather than adding further columns, so cards remain a comfortable, readable size rather than stretching indefinitely.
- What happens on a very narrow mobile viewport (e.g., 320px width)? The single-column list and filter controls MUST remain fully usable with no horizontal page scroll and no clipped controls.
- What happens when MetalSucks or Louder Sound has zero available items? Consistent with existing behavior, that source contributes no cards but does not block or empty the rest of the Dashboard.
- What happens when a user resizes the browser window across the desktop/mobile breakpoint? The layout MUST switch between the grid and single-column presentations without losing the current filter selections or scroll context becoming disorienting.
- What happens when the user combines a category and a source filter that yields very few results? The layout MUST still render cleanly (no broken partial grid row) and show an empty state if there are zero results.
- What happens when a user navigates the filter controls via keyboard or assistive technology? Category and source filters MUST be reachable and operable without requiring pointer/touch input, consistent with existing accessibility handling.
- What happens with an article that has an unusually long title or excerpt on the compact mobile card? Text MUST be truncated consistently (as today) rather than breaking the card layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Dashboard MUST present articles in a responsive multi-column grid layout when viewed on a desktop-width browser, replacing the current per-category horizontal carousel presentation.
- **FR-002**: The desktop grid MUST make a substantially larger number of already-loaded articles visible without requiring the user to click through arrows or hidden carousel pages.
- **FR-003**: The desktop layout MUST keep the category and source filter controls visible/reachable while the user scrolls through the article grid.
- **FR-004**: The Dashboard MUST present articles in a single-column, vertically scrollable list when viewed on a mobile-width viewport, with no horizontal scrolling of articles.
- **FR-005**: The mobile article card MUST use a more compact presentation than the desktop card (e.g., smaller or repositioned image) while still displaying title, excerpt, source, category, and publish date.
- **FR-006**: Filter controls on mobile MUST use a minimum touch target size of 44x44 CSS pixels (WCAG 2.5.5 / Apple HIG baseline) to be comfortable to tap accurately.
- **FR-007**: Both layouts MUST preserve the existing article card content and behavior: image (or placeholder when unavailable), title, excerpt, source, category, publish date, and opening the original article in a new tab when selected.
- **FR-008**: The system MUST add MetalSucks (feed: `https://feeds.feedburner.com/Metalsucks`) as a new enabled Dashboard source.
- **FR-009**: The system MUST add Louder Sound (feed: `https://www.loudersound.com/feeds.xml`) as a new enabled Dashboard source.
- **FR-010**: Articles from Metal Injection, MetalSucks, and Louder Sound MUST be rendered with the same card size and prominence as articles from any other source; sources MUST be distinguishable only via a visible source label/badge on the card.
- **FR-011**: If MetalSucks or Louder Sound is temporarily unreachable or returns malformed items, the Dashboard MUST continue showing the remaining available sources and categories, consistent with existing per-source failure isolation.
- **FR-012**: Users MUST be able to filter the displayed articles by source, with every currently available source (including MetalSucks and Louder Sound) offered as a selectable option; Metal Injection, MetalSucks, and Louder Sound MUST be listed first (in that order) within the source filter's option list, ahead of other sources.
- **FR-013**: The source filter MUST be combinable with the existing category filter so that both selections narrow the displayed articles together.
- **FR-014**: Users MUST be able to clear an active source filter to return to viewing articles from all sources.
- **FR-015**: When a filter combination (category and/or source) produces zero matching articles, the Dashboard MUST show a clear empty-state message rather than an empty or broken layout.
- **FR-016**: Articles within a given filtered view MUST be ordered by recency (most recent first) to support quick scanning of what's new.
- **FR-017**: Filter controls (category and source) MUST remain operable via keyboard/assistive technology on both layouts, consistent with existing accessibility handling.

### Key Entities

- **Article**: A single news item shown on the Dashboard — attributes include title, excerpt, image (optional), source, category, publish date, and a link to the original article.
- **Source**: A news outlet whose RSS feed is aggregated into the Dashboard (e.g., Metal Injection, MetalSucks, Louder Sound, and existing sources). Each source has a name/label used for the on-card badge and as a selectable option in the source filter, and a priority-source flag identifying Metal Injection, MetalSucks, and Louder Sound as the three most important sources; this flag determines their display order (listed first) within the source filter's option list only and has no effect on card size, article ordering, or prominence, consistent with FR-010.
- **Category**: A content grouping (e.g., News) that articles belong to, used for the existing category filter.
- **Filter Selection**: The user's currently active category and/or source choice(s), which together determine which articles are displayed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a typical desktop-width browser window, users see at least 9 articles fully visible without any scrolling or clicking on first load of the Dashboard.
- **SC-002**: On mobile viewports, the Dashboard page never requires horizontal scrolling, at widths down to 320px.
- **SC-003**: Users can narrow the Dashboard to a single chosen source in one interaction (e.g., one tap/click on that source in the filter), on both desktop and mobile.
- **SC-004**: Articles from all three priority sources (Metal Injection, MetalSucks, Louder Sound) are discoverable on the Dashboard within the same initial view/scroll depth as articles from any other source — no source requires extra navigation to reach.
- **SC-005**: 100% of currently available sources, including MetalSucks and Louder Sound, appear as selectable options in the source filter.
- **SC-006**: When one source's feed is unavailable, the rest of the Dashboard's content (other sources/categories) remains fully viewable, with zero unrelated content lost.
- **SC-007**: Users can identify which source an article came from by glancing at its card, without needing to open the article, on both desktop and mobile layouts.

## Assumptions

- MetalSucks and Louder Sound articles are categorized using the existing category taxonomy (e.g., "News"), following the same category-mapping approach already used for existing sources; no new categories are introduced by this feature.
- The category filter continues to behave as it does today (single active category, plus an "all" option); the new source filter follows the same interaction pattern (single active source, plus an "all sources" option) unless combined with the category filter as described in FR-013.
- The desktop/mobile layout switch is based on viewport width using the application's existing responsive breakpoints, with no new device-detection mechanism required.
- No deduplication is required if the same story is independently published by multiple sources; each source's item is treated as a distinct article.
- Existing feed refresh/caching cadence and per-source timeout behavior apply to the two new sources; this feature does not change how often feeds are refreshed.
- Users of the Dashboard are already authenticated, consistent with the existing Dashboard access model; this feature does not change authentication or authorization.
