# Feature Specification: Search Result Filters

**Feature Branch**: `021-search-result-filters`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Quiero que la búsqueda se produzca por el endpoint /database/search?q={query} si no se está haciendo ya. Aprovechando ese endpoint quiero que en la pantalla de resultados de búsqueda se implemente un control para aplicar filtros. Los filtros que quiero por ahora son: artist, genre, style and format. Revisa el documento pdf adjunto donde aparece la definición de ese endpoint de la api y haz los cambios necesarios para aplicar estos filtros."

## Clarifications

### Session 2026-07-07

- Q: How should filter changes trigger a new search — automatically as the user types/selects, or only when they explicitly submit? → A: Explicit Apply action (an "Apply filters" control); no automatic/debounced search on every keystroke.
- Q: Should the four filter fields (Artist, Genre, Style, Format) be free-text inputs, or constrained selections (e.g., dropdowns) limited to known Discogs values? → A: Constrained dropdown/select (superseded by later clarification below).
- Q: Given Discogs has millions of artists (no fixed list is feasible), how should the Artist filter work compared to Genre/Style/Format? → A: Artist stays free-text (moot once all four were confirmed free-text below).
- Q: Where should the dropdown values for Genre, Style, and Format come from? → A: Maintain as free text (prompted reversal of the dropdown decision).
- Q: To confirm — should Genre, Style, and Format actually be free-text inputs (like Artist), with no dropdown/curated list at all? → A: Yes, all four filters (Artist, Genre, Style, Format) are free-text inputs; no dropdown or curated value list is introduced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Narrow search results by filter (Priority: P1)

A user searches the catalog and gets back a broad list of results. They want to narrow that list down to records matching a specific artist, genre, style, and/or format without retyping their search query.

**Why this priority**: This is the entire value of the feature — without it, filtering doesn't exist. It must work standalone to deliver any value.

**Independent Test**: Run a catalog search, apply a single filter (e.g., genre "Rock"), and confirm the result list updates to show only matching records.

**Acceptance Scenarios**:

1. **Given** a user has searched for "nirvana" and results are displayed, **When** they use the filter control to enter a value for "Genre", and select "Apply filters", **Then** the results list refreshes to show only records matching both the search query and the genre filter.
2. **Given** a user is on the search results screen with no filters applied, **When** they view the filter control, **Then** they see four free-text filter fields: Artist, Genre, Style, and Format, all empty.
3. **Given** a user has applied a filter, **When** the filtered results return zero matches, **Then** the screen shows a clear "no results" message reflecting the active search and filters, rather than an empty blank screen.

---

### User Story 2 - Combine multiple filters at once (Priority: P2)

A user wants to combine more than one filter (e.g., genre "Rock" and format "Vinyl") to narrow results further than a single filter would allow.

**Why this priority**: Adds meaningful precision on top of the P1 single-filter capability, but the feature is still useful with just one filter active at a time.

**Independent Test**: Apply two or more filters simultaneously and confirm the results reflect the intersection of all active filters.

**Acceptance Scenarios**:

1. **Given** a user has entered values into both the Genre and Format fields, **When** they select "Apply filters", **Then** the results only include records matching the search query AND both filter values.
2. **Given** a user has multiple filters active, **When** they clear one filter field and select "Apply filters" again, **Then** the results update to reflect only the remaining active filters.

---

### User Story 3 - Reset filters and preserve filter state across navigation (Priority: P3)

A user wants to clear all applied filters in one action, and wants their active filters preserved if they navigate between result pages (pagination) or share/reload the results URL.

**Why this priority**: A quality-of-life improvement. The core filtering value (P1/P2) works without it, but losing filter state on pagination or reload would be a frustrating rough edge.

**Independent Test**: Apply filters, navigate to page 2 of results, and confirm the same filters remain active; then use a "clear filters" action and confirm all filters reset and results revert to the unfiltered search.

**Acceptance Scenarios**:

1. **Given** a user has active filters and multiple result pages, **When** they navigate to the next page, **Then** the same filters remain applied to the new page of results.
2. **Given** a user has one or more active filters, **When** they trigger "clear filters", **Then** all filter fields reset to empty and the results revert to the plain search-query results.
3. **Given** a user has applied filters and copies the current results URL, **When** that URL is opened again, **Then** the same filters are pre-applied and the same filtered results are shown.

### Edge Cases

- What happens when a user applies a filter value that matches no records? → Show the existing "no results" state, updated to acknowledge that filters are active (e.g., suggest adjusting or clearing filters).
- What happens when a user enters a filter value but no search query? → Existing behavior requires a search query to trigger a catalog lookup; filters alone (without a query) are out of scope for this feature and the current "use the search box" prompt continues to apply.
- What happens when the catalog service is unavailable while filters are applied? → The existing catalog-unavailable error state is shown, unchanged by filters being active.
- What happens when a user changes the search query while filters are active? → Filters remain active and are re-applied against the new query's results.
- How does the system handle filter values containing special characters or extra whitespace? → Values are trimmed before being applied; otherwise passed through as free text, consistent with how the search query itself is handled today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search results screen MUST provide a filter control exposing four filter fields: Artist, Genre, Style, and Format.
- **FR-002**: Users MUST be able to enter a free-text value into any combination of the four filter fields.
- **FR-003**: The filter control MUST provide an explicit "Apply filters" action, and the system MUST re-run the catalog search using the current query together with all currently populated filter values only when that action is triggered; editing a filter field MUST NOT by itself trigger a new search, and no automatic/live search MUST fire on every keystroke or field change.
- **FR-004**: System MUST support any combination of the four filters being active simultaneously (zero, one, or all four).
- **FR-005**: Users MUST be able to clear all active filters in a single action, returning results to the unfiltered (query-only) state.
- **FR-006**: The system MUST preserve active filter values when the user navigates between result pages (pagination).
- **FR-007**: The system MUST reflect active filter values in the results screen's URL so that reloading or sharing the URL reproduces the same filtered results.
- **FR-008**: When filters are active and no records match, the system MUST present a "no results" message that acknowledges the active filters (rather than the plain no-query-results message).
- **FR-009**: Search requests MUST continue to be issued through the catalog's underlying search lookup (the same one already used for plain query searches), extended to pass along the artist, genre, style, and format filter values as additional search criteria rather than introducing a separate/parallel search path.
- **FR-010**: Filter values MUST be trimmed of leading/trailing whitespace before being applied; empty or whitespace-only values are treated as "not set" and excluded from the search criteria.

### Key Entities

- **Search Filter Set**: The collection of currently active filter values (Artist, Genre, Style, Format) associated with a given search. Each value is optional free text; an unset value is excluded from the underlying search entirely.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can narrow an existing search's results using one or more filters in under 10 seconds, without needing to retype their search query.
- **SC-002**: 100% of combinations of the four filters (any subset, including none or all four) produce a results list consistent with all currently active filter values.
- **SC-003**: Reloading or sharing a filtered results URL reproduces the identical filtered result set 100% of the time.
- **SC-004**: Users can return to an unfiltered view of their current search in a single action, 100% of the time.

## Assumptions

- Filter values are free-text inputs matching the corresponding Discogs catalog search parameters (artist, genre, style, format), not pre-populated dropdown lists of known values — confirmed during clarification: Discogs' documented API offers no endpoint to enumerate valid genres/styles/formats, and artist names cannot be enumerated at all, so a curated or fetched value list is not pursued for any of the four fields.
- Filtering applies only to the "release" result type already used on the search results screen; the "artist" result-type search path is out of scope for this feature.
- The catalog search endpoint already in use (Discogs' `/database/search`) natively supports `artist`, `genre`, `style`, and `format` as query parameters, so no new external integration is required — only extending the existing request with these additional parameters.
- Applying filters (via the explicit "Apply filters" action) re-runs the search starting from page 1, consistent with how changing the search query itself is expected to behave.
- No changes are needed to the underlying search transport (the app already issues catalog searches through `/database/search`); this feature only adds filter parameters and results-screen UI on top of that existing integration.
- Filters are submitted via an explicit "Apply filters" action rather than live/debounced-as-you-type search, to avoid firing a Discogs request on every keystroke (consistent with the project's rate-limit-aware integration principle).
