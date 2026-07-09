# Feature Specification: Search Results Organization

**Feature Branch**: `027-search-results-organization`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Para este incremento quiero trabajar en la organización de los resultados de la busqueda. Lo primero que quiero es que el header se quede siempre estático arriba. Si se hace scroll, el header debe mantenerse congelado en la parte superior de la app. Lo segundo que quiero es convertir la paginación actual de los resultados en un scroll infinito. Se obtendrán resultados hasta llenar la vista, en cuanto el usuario haga scroll se iran obteniendo más resultados. Lo tercero que quiero, es que en la medida de lo posible, se ordenen los resultados de la busqueda de manera que se muestren primero los masters. Estos no tendrán en su tarjeta la etiqueta de formato que actualmente si tienen."

## Clarifications

### Session 2026-07-08

- Q: Should master-first ordering be strictly best-effort per-batch, or should the system make additional Discogs API calls to guarantee masters always surface before releases even across batch boundaries? → A: Best-effort, per-batch only: sort masters ahead of releases within each batch as fetched, no extra API calls.
- Q: How many results should each infinite-scroll fetch (initial and subsequent batches) retrieve? → A: Keep current size: 20 results per batch/fetch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Header stays visible while scrolling (Priority: P1)

As a user browsing the app, I want the header to stay fixed at the top of the screen while I scroll through any page, so that navigation and search controls are always within reach without having to scroll back up.

**Why this priority**: The header carries primary navigation and the search entry point. Losing access to it while scrolling long content (like search results) is a persistent friction point on every page, not just search. It is also the simplest of the three changes and has no dependency on the other two, making it the natural first slice.

**Independent Test**: Can be fully tested by opening any page with content taller than the viewport (e.g., search results, a library list), scrolling down, and confirming the header remains visible and functional (its links/search box stay usable) at every scroll position.

**Acceptance Scenarios**:

1. **Given** a page with more content than fits in the viewport, **When** the user scrolls down, **Then** the header remains visible, fixed at the top of the screen, and does not scroll away with the page content.
2. **Given** the header is fixed at the top, **When** the user scrolls back to the top of the page, **Then** the header does not overlap or hide the beginning of the page content.
3. **Given** the header is fixed at the top, **When** the user interacts with header controls (e.g., navigation links, search input) at any scroll position, **Then** those controls respond normally.

---

### User Story 2 - Infinite scroll through search results (Priority: P2)

As a user searching the catalog, I want more results to load automatically as I scroll down, so that I can keep browsing without clicking through numbered pages or "next" buttons.

**Why this priority**: This is the core interaction change requested for the search results experience and delivers the most direct value to how users consume search results, but it builds on having a stable, always-visible page frame (the header from User Story 1) and is independent of the result-ordering change in User Story 3.

**Independent Test**: Can be fully tested by performing a search that returns more results than fit on one screen, scrolling to the bottom of the currently loaded results, and confirming additional results are fetched and appended automatically without any pagination control being clicked.

**Acceptance Scenarios**:

1. **Given** a search that returns more results than fit in the initial view, **When** the results page loads, **Then** enough results are fetched to fill the visible viewport.
2. **Given** the user has scrolled near the bottom of the currently loaded results, **When** more results are available, **Then** the system automatically fetches and appends the next batch without requiring a button click.
3. **Given** a batch of additional results is being fetched, **When** the user is still scrolling, **Then** a loading indicator is shown and duplicate fetch requests are not triggered.
4. **Given** the user has scrolled through all available results for a search, **When** they reach the end, **Then** the system clearly indicates there are no more results to load.
5. **Given** the user changes their search query or applies/changes a filter, **When** the new search executes, **Then** the previously accumulated results are cleared and infinite scroll restarts from the first batch of the new search.
6. **Given** a request for the next batch of results fails, **When** the failure occurs, **Then** the user sees an error indication and can retry loading more results.

---

### User Story 3 - Masters shown first, without a format tag (Priority: P3)

As a user searching the catalog, I want master releases to appear before individual releases in the results, and I want master cards to not show a format tag, so that I can quickly spot the general master entry for a title before drilling into specific pressings.

**Why this priority**: This is a refinement of result presentation that improves scannability but depends on results already being displayed (via infinite scroll) and is independent of exactly how results are fetched in batches — it can be validated on its own by inspecting the order and content of any batch of results.

**Independent Test**: Can be fully tested by performing a search whose results include both master and non-master (release) entries, and confirming master entries appear ahead of release entries within the loaded results, and that master cards do not show a format badge while release cards still do.

**Acceptance Scenarios**:

1. **Given** a search returns both master and release results, **When** the results are displayed, **Then** master results appear before release results within the same loaded batch.
2. **Given** a search returns only release results (no masters), **When** the results are displayed, **Then** results are shown in their existing order, unaffected by this change.
3. **Given** a master result is displayed, **When** its card is rendered, **Then** it does not show a format badge/tag.
4. **Given** a release (non-master) result is displayed, **When** its card is rendered, **Then** it continues to show its format badge/tag as before.

---

### Edge Cases

- What happens when the user scrolls quickly through several screens' worth of content before a prior batch of results has finished loading? The system must not trigger overlapping/duplicate fetches or lose track of scroll position.
- How does the system handle reaching the true end of all available results for a search (no more masters or releases left to fetch)?
- How does the system behave if fetching the next batch of results fails (e.g., network error) — can the user retry without losing already-loaded results?
- What happens when the user changes the search query or filters while a batch is still loading?
- Does the fixed header overlap with other floating UI (e.g., dropdowns, modals, toasts), and if so, does it stay visually above or below them appropriately?
- On small viewports, does a fixed header consume a disproportionate share of visible screen space, and does the app still function usably?
- Master-first ordering is guaranteed only within each newly loaded batch (confirmed best-effort, per-batch scope — see Clarifications); it is not re-applied retroactively across the entire accumulated list as more batches load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application header MUST remain fixed at the top of the viewport at all scroll positions, on every page where it is displayed.
- **FR-002**: Page content MUST NOT be obscured or hidden behind the fixed header; content MUST remain fully visible and reachable by scrolling.
- **FR-003**: All header controls (navigation, search entry point, etc.) MUST remain fully interactive regardless of scroll position.
- **FR-004**: The search results page MUST fetch and display an initial batch of 20 results (fetching more than one batch upfront if needed to fill the visible viewport) when the page first loads.
- **FR-005**: The search results page MUST automatically fetch and append the next batch of 20 results when the user scrolls near the bottom of the currently loaded results, without requiring the user to click a pagination control.
- **FR-006**: The system MUST prevent duplicate or overlapping fetch requests for the next batch while a fetch is already in progress.
- **FR-007**: The system MUST show a loading indicator while a new batch of results is being fetched.
- **FR-008**: The system MUST clearly indicate to the user when there are no more results left to load for the current search.
- **FR-009**: The system MUST clear previously accumulated search results and restart the infinite-scroll sequence from the first batch whenever the search query or any active filter changes.
- **FR-010**: If fetching the next batch of results fails, the system MUST inform the user and allow them to retry without discarding results already loaded.
- **FR-011**: Numbered/previous-next pagination controls on the search results page MUST be removed and replaced entirely by the automatic scroll-triggered loading described above.
- **FR-012**: Within each batch of fetched search results, master results MUST be ordered ahead of non-master (release) results.
- **FR-013**: When a batch of search results contains no master results, the existing result order MUST be preserved unchanged.
- **FR-014**: Master release result cards MUST NOT display a format badge/tag.
- **FR-015**: Non-master (release) result cards MUST continue to display their format badge/tag as they do today.

### Key Entities

- **Search Result**: An individual entry returned by a catalog search, already distinguished as either a "master" (a general release grouping) or a "release" (a specific pressing), and carrying attributes such as title, artist, year, format, and cover art. This feature changes how results of this kind are ordered and paginated, and adjusts which attributes (format) are shown on master entries — it does not introduce a new entity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The header remains visible at the top of the screen at 100% of scroll positions, on every page, with zero instances of it scrolling out of view.
- **SC-002**: Users can browse through more than 100 search results in a single continuous scroll session without clicking any pagination control.
- **SC-003**: At least 95% of the time, a new batch of results finishes appearing within 2 seconds of the user reaching the bottom of the currently loaded results, under normal network conditions.
- **SC-004**: For 100% of searches that return at least one master result, every master result in a given loaded batch appears ahead of every non-master result in that same batch.
- **SC-005**: 100% of master result cards omit the format badge/tag, while release result cards continue to display it in 100% of cases.
- **SC-006**: Users complete a "browse many results for a title" task without any reported confusion about missing pagination controls, as measured by a reduction of pagination-related support/feedback mentions to zero after release.

## Assumptions

- The header referenced by the user ("la parte superior de la app") is the single shared application header rendered across all authenticated pages, not a header specific only to the search results page; making it fixed applies app-wide.
- "Masters first" ordering is applied within each batch of results as it is fetched (client-side or server-side), rather than by re-sorting the entire accumulated result list every time a new batch arrives — this avoids reordering/jumping content the user has already scrolled past (confirmed via Clarifications: best-effort, per-batch scope, no extra Discogs API calls to force a stricter global guarantee).
- Existing relative ordering/relevance from the underlying catalog search is preserved within the masters group and within the release group; only the grouping (masters ahead of releases) changes.
- No virtualization/windowing of already-rendered result cards is required for this increment; accumulated results are expected to remain kept in the page (consistent with keeping the solution simple per project conventions), and very large browsing sessions are an acceptable, uncommon edge case.
- "Near the bottom" of the loaded results (the trigger point for fetching the next batch) is a reasonable prefetch margin before the user reaches the literal last pixel of content, so that new results are available by the time the user finishes scrolling to the current end.
- The format badge/tag continues to be shown on all non-master (release) result cards exactly as it is today; only master cards are affected.
- This feature governs the search results screen and the app-wide header only; other list/detail pages that may already or separately use pagination are out of scope unless they share the same header component.
