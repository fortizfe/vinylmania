# Feature Specification: Master Release Grouping & Detail Pages

**Feature Branch**: `026-master-release-detail`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Para este incremento quiero seguir afinando la página de búsqueda y lo relacionado con la misma. 1) Empezar a trabajar en el concepto de master release: agrupar en una misma ficha todas las releases similares (p.ej. distintos formatos de una misma release) bajo una master release, usando el efecto visual de carátulas apiladas para diferenciarla de una release individual en los resultados de búsqueda. 2) Desarrollar fichas de detalle de release y de master release; al hacer click sobre un resultado se navega a una u otra vista según corresponda. 3) La ficha de detalle de una release muestra toda la información del endpoint de detalle de dicha release, de forma compacta. 4) La ficha de detalle de una master release muestra lo mismo más una tabla paginada (10 en 10) con las releases que pertenecen a esa master; al hacer click en una fila se navega a la ficha de detalle de esa release. Todas las nuevas vistas deben permitir volver atrás de forma consistente con el resto de la app."

## Clarifications

### Session 2026-07-08

- Q: Does a master-release grouped card show a community rating badge, and if so, sourced from what? → A: Show the rating of the master's main/key release (Discogs' designated representative release for that master).
- Q: When a release or master detail page is opened directly (bookmark, shared link, browser refresh) with no prior in-app search context, where should its back action go? → A: Back navigates to the main search results page (empty/default state).
- Q: A master release group can span multiple release years and formats (e.g. original 1991 vinyl vs. 2015 CD reissue) — which values should the grouped card's year and format show? → A: The master's own representative values as provided by the catalog (the master's release year and its main release's format).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See grouped results for similar releases (Priority: P1)

A collector searches the catalog (e.g. "Linkin Park") and sees, among the results, single entries that represent a group of similar releases (the different pressings/formats/editions of the same work) instead of many near-duplicate cards cluttering the grid. These grouped entries are visually distinguishable from individual release results by a stacked-covers effect, while otherwise showing the same information as any other result card (title, artist, rating, year, format badge).

**Why this priority**: This is the foundation of the whole increment — without grouping, there is nothing to route to a "master release" detail view, and search results stay cluttered with near-duplicate entries, which is the core problem this feature addresses.

**Independent Test**: Search for an artist/album known to have multiple pressings (e.g. a popular album with several vinyl/CD editions). Verify the results grid shows a single grouped card with the stacked-covers visual for that album, and that its title/artist/rating/year/format render the same way a normal result card would.

**Acceptance Scenarios**:

1. **Given** a search whose results include releases that belong to the same master release group, **When** the results are rendered, **Then** those releases are shown as a single grouped result card instead of one card per release.
2. **Given** a grouped result card is shown, **When** compared to a standalone (non-grouped) release card, **Then** the grouped card displays a stacked-covers visual effect while showing the same title, artist, rating, year, and format elements as a standalone card.
3. **Given** a search whose results include a release that has no other similar editions, **When** the results are rendered, **Then** that release is shown as a standalone card with no stacked-covers effect.
4. **Given** the results grid is loading, **When** skeleton placeholders are shown, **Then** they do not need to distinguish grouped vs. standalone results (skeletons remain uniform, as today).

---

### User Story 2 - Open a release's detail page (Priority: P1)

A collector clicks a standalone release result (or a specific release reached from within a master release's version table) and lands on a dedicated detail page for that release, showing all the catalog information available for it, laid out compactly. From there they can add the record to their library, and they can navigate back to where they came from.

**Why this priority**: This is the primary destination the whole feature exists to deliver — a real, linkable "ficha" for a release, replacing the current quick-look modal, and it is a precondition for User Story 3 (master detail links into it).

**Independent Test**: Click a standalone result card in search results. Verify navigation lands on a release detail page showing full catalog information, an "Add to library" action, and a working back action that returns to the prior search results (query, filters, and page preserved).

**Acceptance Scenarios**:

1. **Given** a standalone release result card in the search results grid, **When** the user clicks it, **Then** the app navigates to that release's detail page.
2. **Given** a release detail page has loaded, **When** the user views it, **Then** all information returned by the release's catalog detail (images, artists, labels, formats, genres/styles, tracklist, identifiers, community stats, notes) is present on the page, organized so no single section forces excessive scrolling before the rest of the page is reachable.
3. **Given** a release detail page, **When** the user triggers "Add to library", **Then** the same outcomes as today's search-results Add action apply: success adds the record and reflects an "added" state, and failure due to no Discogs link or an invalid link surfaces the same guidance (link/relink) shown today on the search results page.
4. **Given** a release detail page, **When** the user triggers the back action, **Then** the app returns to the previous view (search results, or a master release detail page, depending on entry point) preserving its prior state.
5. **Given** a release detail page is requested for a release id that the catalog no longer has data for, **When** the page loads, **Then** the user sees a not-found message instead of a broken/empty layout.

---

### User Story 3 - Open a master release's detail page and browse its versions (Priority: P2)

A collector clicks a grouped (master release) result and lands on a dedicated detail page showing the master release's information plus a paginated list of every release version that belongs to it. Clicking a version in that list opens that specific release's own detail page.

**Why this priority**: Depends on User Story 1 (grouping must exist to reach this view) and User Story 2 (each row in the version table opens a release detail page); it completes the "browse editions of a work" journey but is not required for a release detail page to be independently useful.

**Independent Test**: Click a grouped result card in search results. Verify navigation lands on a master release detail page showing the master's own information plus a paginated table (10 rows per page) of its releases; verify clicking a row navigates to that release's own detail page.

**Acceptance Scenarios**:

1. **Given** a grouped (master release) result card in the search results grid, **When** the user clicks it, **Then** the app navigates to that master release's detail page (not a release detail page).
2. **Given** a master release detail page has loaded, **When** the user views it, **Then** it shows the master-level information (e.g. title, artists, genres/styles, images, year) using the same compact layout approach as a release detail page.
3. **Given** a master release detail page, **When** the user scrolls to the end of the page, **Then** a paginated table of the releases belonging to that master is shown, listing 10 releases per page.
4. **Given** the version table has more than 10 releases, **When** the user changes page, **Then** the next/previous 10 releases are shown without leaving the master detail page.
5. **Given** the version table, **When** the user clicks a row, **Then** the app navigates to that specific release's detail page, and using its back action returns to this master release detail page (not to the original search results).
6. **Given** a master release detail page, **When** the user triggers the back action, **Then** the app returns to the previous search results view, preserving its prior state.

---

### Edge Cases

- A grouped result whose underlying releases number exactly 2 still qualifies as "grouped" and shows the stacked-covers effect (no minimum threshold above 2).
- A master release with only one known release version (e.g. sparse catalog data) still shows its version table with that single row rather than hiding the table.
- The catalog's community rating for a grouped (master) result reflects the community rating of the master's main/key release; if that release has no votable rating, the rating badge is simply omitted, same as today.
- Navigating directly to a release or master detail page URL (e.g. via bookmark or shared link, or browser refresh) loads the page correctly without requiring the user to have come from search results first; its back action falls back to the main search results page in its default (empty) state, since there is no prior in-app search context.
- If a release detail page is opened for a release reached from within a master's version table, and the user then uses "Add to library" and later hits back, they return to the master's version table at the same page they left it on.
- If the catalog detail lookup for a release or master fails (not found, catalog service unavailable), the detail page shows an error/not-found message rather than a blank or partially-broken layout.
- A release detail page for a release that does not belong to any master release omits any "part of a master release" affordance rather than showing a broken/empty link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search results grid MUST present releases that belong to the same master release group as a single grouped result card rather than one card per individual release.
- **FR-002**: A grouped result card MUST be visually distinguishable from a standalone release result card via a stacked-covers effect, while otherwise presenting the same elements as a standalone card: cover art, title, artist, rating badge, year, and format. The rating badge on a grouped card MUST reflect the community rating of the master's main/key release (Discogs' designated representative release for that master), following the same "omit if unavailable" behavior used for standalone release ratings. The year and format shown on a grouped card MUST be the master's own representative values as provided by the catalog (the master's release year and its main release's format), even when individual releases within the group span different years or formats.
- **FR-003**: Standalone releases (not part of any master group, or the sole known release of their master) MUST continue to render as they do today, without the stacked-covers effect.
- **FR-004**: Clicking a standalone release result card MUST navigate the user to a dedicated release detail page for that release.
- **FR-005**: Clicking a grouped (master release) result card MUST navigate the user to a dedicated master release detail page for that group, not to a release detail page.
- **FR-006**: The release detail page MUST display all catalog information available for that release (images, artist credits, label credits, formats, genres, styles, tracklist, identifiers, community stats, notes) in a layout designed to avoid requiring excessive scrolling to reach any single section.
- **FR-007**: The release detail page MUST provide an "Add to library" action with the same success/error behavior (including the not-linked and invalid-link guidance) as the existing search-results Add action.
- **FR-008**: The master release detail page MUST display the master-level catalog information using the same compact-layout approach as the release detail page.
- **FR-009**: The master release detail page MUST display a paginated table of the releases that belong to that master release, showing 10 releases per page, positioned after the master's own information.
- **FR-010**: Each row in the master release's version table MUST identify the release version clearly enough to distinguish it from siblings (at minimum: format and year; label and country when available).
- **FR-011**: Clicking a row in the master release's version table MUST navigate the user to that specific release's detail page.
- **FR-012**: The release detail page, the master release detail page, and each page of the master's version table MUST each provide a back action consistent with the back-navigation pattern already used elsewhere in the app, returning the user to the view and state they came from (search results with its prior query/filters/page, or a master release detail page). When a detail page is opened without an in-app search context to return to (e.g. direct URL, bookmark, or page refresh), its back action MUST navigate to the main search results page in its default (empty) state.
- **FR-013**: The existing quick-look preview modal on the search results page MUST be removed; the detail pages replace it as the only way to see full release information from a search result.
- **FR-014**: Loading a release or master release detail page directly (not only via in-app navigation) MUST render the correct content for that release/master id.
- **FR-015**: If a release or master release id cannot be resolved (not found, or the catalog lookup fails), the corresponding detail page MUST show a clear not-found/error state instead of a broken or empty layout.

### Key Entities

- **Master Release**: Represents a work that has multiple similar releases (e.g. different pressings, formats, or regional editions of the same album). Holds master-level descriptive information (title, artists, genres/styles, images, year) and is the grouping key for its member releases. Designates one member release as its "main/key release," whose community rating and format are used to represent the whole group on grouped search result cards.
- **Release (existing entity, extended usage)**: An individual physical/digital edition. Already used for the library and preview modal; this feature adds a dedicated, linkable detail page for it and, where applicable, its association to a parent Master Release.
- **Grouped Search Result**: A search result item representing a Master Release group rather than a single Release, carrying the same display attributes as a standalone result (title, artist, rating, year, format) plus the visual grouping marker.
- **Master Release Version List**: The paginated collection of Release entries that belong to a given Master Release, as browsed from the master's detail page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When searching for an artist/album with multiple known pressings, users see one grouped result per work instead of one card per individual pressing, reducing the number of result cards shown for that work to a single entry.
- **SC-002**: Users can distinguish a grouped result from a standalone result at a glance, without needing to open it, in a usability check (stacked-covers effect recognized as "multiple editions" by test users).
- **SC-003**: From any search result card, a user reaches the correct detail page (release or master release, matching the card type) in a single click.
- **SC-004**: Users can view every piece of catalog information available for a release without navigating away from its detail page.
- **SC-005**: From a master release detail page, users can locate and open any of its release versions in two actions or fewer (paginate if needed, then click the row).
- **SC-006**: Users can always return to their prior view (search results or master detail page) from any of the new detail pages using a single back action, with their prior search query, filters, and page preserved.

## Assumptions

- "Similar releases that group under a master release" follows the Discogs catalog's own master/release relationship (a release either belongs to a master release group with siblings, or it does not); this feature surfaces that existing catalog relationship rather than inventing new grouping logic.
- A master release result card has no direct "Add to library" action, since a master release is not itself a purchasable/ownable item — users add a specific release version, reached via the master's detail page and version table (or via a standalone release card).
- The existing quick-look preview modal is fully replaced by the new detail pages for the purposes of viewing a search result's information; no functionality from the modal needs to be preserved outside the new detail pages.
- "Add to library" on the release detail page reuses the same gating rules already in place on the search results page (requires a linked Discogs account; surfaces link/relink guidance on failure) rather than introducing new rules.
- The master release version table's default ordering follows the catalog's own default ordering for a master's versions (no custom sort/filter controls are required for this increment).
- Community rating display on a grouped (master) result card uses the community rating of the master's main/key release (Discogs does not expose a separate master-level rating; ratings only exist per release), following the same "omit badge if unavailable" behavior already used for standalone release ratings.
- Detail pages are reachable only from within the authenticated app shell (same access boundary as the existing search results page), consistent with how the rest of the catalog browsing experience is gated today.
