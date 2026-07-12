# Feature Specification: Shared Collapsible Filters with Selectable Lists

**Feature Branch**: `038-shared-selectable-filters`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Quiero reconstruir el componente de filtros de la app para que sea un único componente reutilizable, usado tanto en Resultados de búsqueda (SearchResultsPage) como en Mi biblioteca (LibraryListPage), con dos mejoras principales sobre el comportamiento actual: 1. Colapsable/expandible: el componente arranca siempre contraído y el usuario lo expande manualmente para tocar filtros, quedando expandido hasta que el usuario lo contraiga explícitamente; cuando está contraído y hay filtros activos, debe mostrar un feedback visual claro de que hay filtros aplicados. 2. Listas seleccionables en vez de texto libre: Genre, Style y Format pasan a ser listas de valores predefinidos que el usuario selecciona (checkboxes, selección múltiple), usando catálogos curados (15 valores de Genre, 757 de Style, 51 de Format). El mismo componente se usa también en Mi biblioteca para filtrar de verdad la propia colección, lo que requiere persistir genre/style/format en cada entrada de biblioteca al sincronizar."

## Clarifications

### Session 2026-07-12

- Q: When persisting genre/style/format on a library entry at sync/refresh time, if the Discogs enrichment lookup fails (timeout/outage) for that entry's release, what should happen to its stored genre/style/format? → A: Keep the entry's previously stored genre/style/format unchanged; only overwrite on a successful lookup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collapsible filter component with selectable lists, in Search (Priority: P1)

A user searching the catalog wants the filter panel to start collapsed, be able to expand it to choose Genre/Style/Format from predefined lists (instead of typing free text), and see at a glance whether any filters are active even while the panel is collapsed — so they can filter with more precision without the panel taking up space when they're not using it.

**Why this priority**: This is the foundational rebuild of the filter component itself (collapse behavior + selectable catalogs) inside the screen where filtering already exists today. It is independently valuable and deployable without touching the Library screen or any backend persistence.

**Independent Test**: Load the search results screen, confirm the filter panel renders collapsed by default, expand it, select values from the Genre, Style, and Format lists, apply them, and confirm the search results and URL reflect the selection while the panel stays expanded. Collapse it manually and confirm an active-filters indicator appears.

**Acceptance Scenarios**:

1. **Given** the search results screen, **When** it loads (with or without an active search), **Then** the filter component appears collapsed by default, occupying the minimum vertical space possible (a compact trigger, not the full form).
2. **Given** the collapsed component with no active filters, **When** the user looks at it, **Then** it shows no active-filters indicator (neutral state).
3. **Given** the collapsed component, **When** the user taps/clicks to expand it, **Then** it expands to show the three filters (Genre, Style, Format) as selectable lists, plus the existing Apply and Clear actions.
4. **Given** the expanded panel, **When** the user opens the Genre list, **Then** they see the 15 predefined genre values as selectable options and can select multiple at once.
5. **Given** the expanded panel, **When** the user opens the Style list (757 values), **Then** they can locate a specific value without having to scroll through hundreds of unrelated options — the list offers a way to search/filter within itself.
6. **Given** the expanded panel, **When** the user opens the Format list, **Then** they see the 51 distinct predefined format values as selectable options and can select multiple at once (replacing the current 33-value curated list).
7. **Given** one or more selections made in any of the three filters, **When** the user presses Apply, **Then** the search re-executes with those values (same mechanics as today: resets to page 1, state reflected in the URL so reload/share reproduces the same result), and the panel remains expanded (it does not collapse on its own).
8. **Given** active filters, **When** the user manually collapses the panel, **Then** the collapsed trigger shows a clear visual indicator that filters are active (e.g., a counter/badge), with no need to expand it to know.
9. **Given** active filters and a collapsed panel, **When** the user wants to know which are active, **Then** a visible summary is shown (at least how many and/or which filters have a selection), consistent with the active-filters summary that already exists today under the Format trigger.
10. **Given** the user presses Clear, **When** it executes, **Then** all selected values across the three filters are deselected, the URL returns to the no-filters state, and the "active filters" indicator disappears from the collapsed state.
11. **Given** a mobile viewport, **When** the user opens the selectable list of any of the three filters, **Then** the interaction is optimized for a small touch screen (e.g., full-screen panel), reusing the existing `Modal` pattern already used today by Format.
12. **Given** a desktop viewport, **When** the user opens the selectable list, **Then** the interaction makes use of the available space rather than behaving the same as on mobile.

---

### User Story 2 - The same component actually filters My Library (Priority: P2)

A user with a synced library wants to use the same filter component on the My Library screen to narrow it down by Genre/Style/Format, so they can find records in their own collection without having to scroll through all of it.

**Why this priority**: This delivers the full cross-screen value of the shared component, but it depends on User Story 1's component already existing and additionally requires new backend persistence work (genre/style/format saved per library entry), making it a larger, dependent increment appropriately sequenced after P1.

**Independent Test**: With the filter component from User Story 1 already available, load the My Library screen, select Genre/Style/Format values, apply them, and confirm only matching library entries are shown with pagination reflecting the filtered subset — including entries synced before this feature existed.

**Acceptance Scenarios**:

1. **Given** the My Library screen, **When** it loads, **Then** the same filter component from User Story 1 appears (collapsed by default) above the records grid.
2. **Given** the user selects values in Genre/Style/Format and applies them, **When** the filter executes, **Then** only library entries whose release matches the selected criteria are shown, and pagination (current page, total, whether there is a next page) reflects the filtered subset, not the full library.
3. **Given** multiple values selected within the same filter (e.g., two genres), **When** applied, **Then** entries matching **any** of those values are included (OR within a filter); across different filters (genre, style, format), only entries matching **all** active filters are included (AND across filters) — computed in application code against each entry's own persisted data (see FR-015; this differs from Search, where the equivalent combination is delegated to Discogs' own search API and behaves as an AND-like narrowing instead).
4. **Given** filters are cleared, **When** cleared, **Then** the library returns to its unfiltered paginated view, as it does today.
5. **Given** the filters match no entries, **When** this occurs, **Then** a "no results for the active filters" message is shown (analogous to the one that already exists in Search Results), instead of today's empty-library message.
6. **Given** a library entry synced **before** this feature existed, **When** filters are applied, **Then** that entry is correctly included or excluded according to its real genre/style/format — i.e., pre-existing entries become filterable (with data populated on their next sync/refresh), not permanently excluded.
7. **Given** the user presses the existing "Refresh" button, **When** the library resyncs with the Discogs catalog, **Then** each entry's saved genre/style/format is also updated, so it stays correct if it changes on discogs.com.
8. **Given** active filters in the library, **When** the user changes page, **Then** the filters remain active across pages (same pattern already used in Search).

---

### Edge Cases

- If a release's genre/style/format value on Discogs changes after having been cached/saved, the new value is only reflected after the next sync/refresh — existing app behavior (caching), no new real-time invalidation logic is introduced.
- If the number of selected values in the collapsed state is high (e.g., 15 styles selected), the indicator must show a compact form (a counter or "+N"), not list them all, consistent with the "+N" pattern Format already uses today.
- Genre/Style/Format catalogs (options lists) are treated as static reference data; the feature does not need to handle catalog entries being added, removed, or reordered at runtime.
- If a sync/refresh cannot retrieve a library entry's release data from the catalog source (e.g., a transient outage), that entry's previously stored genre/style/format is retained as-is and it keeps matching filters based on that last-known data; a brand-new entry that has never had a successful lookup has no stored values yet and so does not match any Genre/Style/Format selection until its first successful sync.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single, shared filter component used by both the Search Results screen and the My Library screen (not two separate implementations).
- **FR-002**: The filter component MUST render in a collapsed state by default on every load, showing a compact trigger rather than the full filter form.
- **FR-003**: The filter component MUST stay expanded once the user expands it, until the user explicitly collapses it again — applying filters MUST NOT auto-collapse it.
- **FR-004**: When collapsed and at least one filter is active, the component MUST display a visible indicator (e.g., badge/counter) that filters are applied, without requiring expansion.
- **FR-005**: When collapsed and no filters are active, the component MUST show a neutral state with no active-filters indicator.
- **FR-006**: The expanded component MUST present Genre, Style, and Format as multi-select lists of predefined values (checkboxes or equivalent), replacing free-text entry for Genre and Style and the current fixed 33-value list for Format.
- **FR-007**: The Genre list MUST offer the 15 predefined genre values as selectable options.
- **FR-008**: The Style list MUST offer the 757 predefined style values as selectable options, with an in-list search/filter mechanism so a user can locate a specific value without scrolling through the full list.
- **FR-009**: The Format list MUST offer the 51 distinct predefined format values as selectable options, replacing the current curated 33-value list.
- **FR-010**: Applying the filters MUST re-run the current screen's listing (search or library) using the selected values, reset pagination to the first page, and reflect the selection in the URL so that reloading or sharing the URL reproduces the same filtered result.
- **FR-011**: Clearing the filters MUST deselect all values across the three filters, return the URL to its unfiltered state, and remove the active-filters indicator from the collapsed state.
- **FR-012**: On mobile viewports, opening a selectable list MUST use a touch-optimized, full-screen interaction pattern (reusing the existing modal pattern used by Format today).
- **FR-013**: On desktop viewports, opening a selectable list MUST use a layout that makes use of available screen space rather than mirroring the mobile full-screen pattern.
- **FR-014**: Neither the desktop nor the mobile presentation of any selectable list MUST introduce horizontal scrolling on the screens where the component is used.
- **FR-015**: On My Library, where matching runs in application code against each entry's persisted values, multiple selected values within a single filter (Genre, Style, or Format) MUST be combined with OR semantics, and active filters across different fields MUST be combined with AND semantics. On Search, the combination behavior across multiple values within one filter is whatever Discogs' own catalog search API applies when given a comma-joined value for that field — verified live (Decision 1 in research.md) to be an AND-like narrowing (matching releases that satisfy all listed values for that field simultaneously), consistent with Format's existing pre-038 behavior; this is a known, accepted platform-level constraint, not something the UI or backend recombines client-side.
- **FR-016**: The My Library screen MUST use the same shared filter component (collapsed by default) positioned above the records grid.
- **FR-017**: Applying Genre/Style/Format filters on My Library MUST return only the library entries whose associated release matches the selected criteria, with pagination metadata (current page, total, next-page availability) computed over the filtered subset.
- **FR-018**: The system MUST persist each library entry's genre, style, and format at sync time, so that filtering does not depend solely on live, on-demand enrichment from the catalog source.
- **FR-019**: Library entries synced before this feature existed MUST become filterable once their genre/style/format data is populated by a subsequent sync/refresh, rather than being permanently excluded from filtered results.
- **FR-020**: Triggering the existing library "Refresh" action MUST update each entry's saved genre/style/format alongside its other refreshed data.
- **FR-021**: When active library filters match no entries, the system MUST show a "no results for the active filters" message distinct from the existing empty-library message.
- **FR-022**: Active library filters MUST persist across page navigation within the same filtered view, consistent with existing Search pagination behavior.
- **FR-023**: The filter component and its selectable lists MUST be built from the existing shared UI atoms (e.g., checkbox, modal, button, card patterns) rather than introducing new one-off styling.
- **FR-024**: If the catalog enrichment lookup for a library entry's release fails during a sync/refresh (timeout, outage, or any other lookup failure), that entry's previously persisted genre/style/format MUST remain unchanged (not cleared) for that sync attempt; the stored values MUST only be overwritten when a lookup succeeds.

### Key Entities

- **Filter Selection State**: The set of currently selected Genre, Style, and Format values for a given screen (Search or Library), plus whether the panel is expanded or collapsed; reflected in the URL for Search and Library listing requests.
- **Genre/Style/Format Catalogs**: Static, predefined reference lists of selectable values (15 genres, 757 styles, 51 formats) used to populate the three selectable lists, replacing free-text input and the prior fixed format list.
- **Library Entry**: A user's saved record in their synced library; extended to additionally store its release's genre, style, and format values at sync/refresh time so it can be matched against active library filters without a live per-request lookup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The filter component starts collapsed 100% of the time, on both the Search and Library screens.
- **SC-002**: 100% of the time at least one filter is active and the panel is collapsed, users can tell filters are active without expanding the panel.
- **SC-003**: Genre, Style, and Format are always presented as selectable lists (never free text) on both screens.
- **SC-004**: Filtering by Genre/Style/Format in My Library produces correct results for both newly synced entries and entries synced before this feature existed.
- **SC-005**: No screen hosting the component produces horizontal scrolling on desktop or mobile when opening any of the three selectable lists.
- **SC-006**: Users can locate and select a specific value in the 757-value Style list without scrolling through the entire list, as measured by the availability and effectiveness of the in-list search.

## Assumptions

- The three value catalogs (Genre, Style, and the 51 distinct Format values) are used as-is, preserving the alphabetical order already present in their source data.
- On My Library, combination semantics are true OR within a single filter and AND across different filters, computed in application code. On Search, this is delegated to Discogs' catalog search API and verified (research.md Decision 1) to behave as an AND-like narrowing across multiple values within one filter — a known, accepted platform constraint already present for Format before this feature, not a regression introduced by it.
- The concrete mechanism for persisting genre/style/format on library entries (new stored field, and when it gets backfilled for pre-existing entries — on the next automatic sync, on the next manual Refresh, or via a one-time migration) is a planning-phase decision; this specification only requires the outcome (entries become filterable), not the mechanism.
- Genre/Style/Format values returned by the catalog source for a given release are assumed to match the curated catalogs textually; reconciling source values that fall outside these catalogs is out of scope.
- This feature does not touch the free-text search box (title/artist) in Search Results — it only converts Genre, Style, and Format into selectable lists.
- The component reuses existing UI atoms (checkbox, modal, button, card) rather than introducing new standalone styles, per the project's UI design system constraints.

## Out of Scope

- An Artist filter: not present in the current filter implementation, so it is not reintroduced as part of this feature.
- New filters not requested (year, country, etc.).
- Changing the underlying catalog search integration itself: Search continues to delegate to the existing genre/style/format search parameters; only the UI that feeds them changes.
- The Wishlist screen (currently a placeholder with no real functionality).
