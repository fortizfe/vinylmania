# Feature Specification: Vinyl Search Results — Cards, Actions & Pagination

**Feature Branch**: `006-vinyl-search-results`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Vamos a trabajar en la búsqueda de vinilos. Estos serían los requisitos del desarrollo: 1. Se requiere crear una componente de tipo card que muestre la información de cada resultado. Debe contener al menos un thumbnail con la carátula, el título, el artista y el año de publicación del disco. Considera añadir más información si lo ves oportuno. Cada tarjeta debe incluir un icono para añadir el disco a la biblioteca directamente y otro para previsualizar los detalles del disco. Considera si es oportuno crear un componente separado tipo botonera para añadir estos iconos a las cards de resultado de búsqueda. 2. Se deben mostrar los cards de los resultados obtenidos ordenados en un elemento similar a listview. Dicho componente debe ser paginable para evitar scroll de gran tamaño. Opcional: configurar cuantos elementos se pueden ver por cada página. 3. Intentar aprovechar el espacio disponible en la medida de lo posible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan search results as clear, informative cards (Priority: P1)

As a collector searching the catalog for a vinyl to add to my library, I want
each search result presented as a card with its cover thumbnail, title, artist,
and release year, so I can recognize the right record at a glance instead of
reading a plain list of text.

**Why this priority**: This is the visual foundation every other part of the
feature builds on — without a proper result card, pagination and actions have
nothing to attach to. It also delivers immediate value on its own: today's
search results are a bare text list.

**Independent Test**: Can be fully tested by searching the catalog and
confirming each result renders as a card showing a cover thumbnail (or a
placeholder when none exists), the title, the artist, and the release year.

**Acceptance Scenarios**:

1. **Given** a search returns one or more releases, **When** the results
   render, **Then** each one appears as a card showing its cover thumbnail,
   title, artist, and release year.
2. **Given** a result has no cover image available, **When** its card renders,
   **Then** a neutral placeholder occupies the same space a real thumbnail
   would, so the card's layout doesn't shift or look broken.
3. **Given** a result includes additional useful catalog information (e.g. its
   format), **When** its card renders, **Then** that information is shown as a
   secondary detail without crowding out the title/artist/year.

---

### User Story 2 - Act on a result directly from its card (Priority: P1)

As a collector reviewing search results, I want each card to offer a way to
add the record straight to my library and a way to preview its full details,
so I don't have to leave the results to decide whether a record is the right
one or to add the ones I already recognize.

**Why this priority**: This is the other half of the card's core value —
without these actions, the card is just a nicer-looking version of today's
list. It's equal priority to Story 1 because a card without actions doesn't
satisfy the request either.

**Independent Test**: Can be fully tested by searching the catalog, using a
card's add action to add a record to the library, and separately using a
card's preview action to view a different record's full details without
adding it.

**Acceptance Scenarios**:

1. **Given** a search result card, **When** the collector activates its add
   action, **Then** the record is added to their library without requiring any
   additional input, and the collector remains on the search results with
   that card now showing an "added" confirmation.
2. **Given** the add action is in progress for a card, **When** it is still
   pending, **Then** that card clearly shows a busy state and cannot be
   triggered again until it resolves.
3. **Given** a search result card, **When** the collector activates its
   preview action, **Then** an overlay appears showing the record's fuller
   details (at minimum: full artist credit, tracklist if available, and cover
   art) without that record having been added to their library, and closing
   the overlay returns them to the same search results and page they were on.
4. **Given** adding a record fails (e.g. the catalog or library service is
   temporarily unavailable), **When** the failure occurs, **Then** the
   collector sees a clear error on that card and can retry, without losing
   their current search results.
5. **Given** the collector has just added several records in a row from the
   results grid, **When** they finish browsing, **Then** they can navigate to
   their library themselves (e.g. via existing navigation) to see everything
   they added, since adding no longer auto-navigates them there.

---

### User Story 3 - Browse many results without endless scrolling (Priority: P2)

As a collector who searches for a common artist or title, I want the (often
large) set of results split into pages instead of one long scrolling list, so
I can review them in manageable batches and the page stays usable.

**Why this priority**: This matters most once result sets are large; a search
with only a handful of matches already works fine without it. It builds on
Stories 1 and 2 (paginating cards that already exist) rather than being usable
on its own.

**Independent Test**: Can be fully tested by running a search broad enough to
return more results than fit on one page and confirming the results are split
into pages with working navigation between them.

**Acceptance Scenarios**:

1. **Given** a search returns more results than one page can hold, **When**
   the results render, **Then** only the first page's worth of cards is shown,
   with a way to move to subsequent pages.
2. **Given** the collector is on a page other than the first, **When** they
   navigate to a different page, **Then** the new page's cards load without a
   full-page reload and without requiring the collector to re-enter their
   search.
3. **Given** a new search is run, **When** its results render, **Then**
   pagination resets to the first page.

---

### Edge Cases

- What happens when a search returns zero results? The existing "no results
  found" messaging continues to apply; no cards or pagination controls are
  shown.
- What happens when the total number of results is smaller than one page?
  Pagination controls are hidden or disabled rather than showing a
  meaningless single page.
- What happens when a collector triggers the add action on a card whose record
  is already in their library? The add proceeds the same as any other add
  (collectors may legitimately own more than one copy of a release); no
  special duplicate handling is required.
- What happens if the cover thumbnail URL fails to load (broken image)? The
  card falls back to the same neutral placeholder used when no thumbnail
  exists at all.
- How does the layout adapt across viewport sizes? On narrow viewports, cards
  MUST remain fully readable (no cut-off text, no overlapping actions); on
  wide viewports, the available width MUST be used to show more cards per
  page rather than leaving empty space.
- After a card's add action succeeds, the collector stays on the search
  results (with that card showing an "added" confirmation) so they can keep
  browsing and add more records in the same session, rather than being taken
  to their library as happens today after the existing "Add to library"
  action.
- The "preview details" action presents its information as an overlay on top
  of the current search results, so the collector never loses their place or
  navigates away to see a record's fuller details.
- Results are arranged as a responsive multi-column grid of cards (more cards
  per row on wider screens), consistent with the existing library grid,
  rather than a strict single-column list — this is what satisfies the "use
  available space" requirement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each search result MUST be presented as a card showing, at
  minimum: a cover thumbnail (or a neutral placeholder when none is
  available), the title, the artist, and the release year.
- **FR-002**: A card MAY show additional catalog information (e.g. format)
  as secondary detail, without displacing or crowding the title/artist/year.
- **FR-003**: Every card MUST offer an action to add its record directly to
  the collector's library, requiring no additional input to complete.
- **FR-004**: Every card MUST offer an action to preview the record's fuller
  details (at minimum: full artist credit, tracklist if available, cover art)
  without adding it to the library.
- **FR-005**: The add and preview actions MUST be presented consistently
  across every card (same position, appearance, and behavior), rather than
  being redefined per card instance.
- **FR-006**: While a card's add action is in progress, that card MUST show a
  busy state and MUST NOT allow the action to be triggered again until it
  resolves.
- **FR-007**: If a card's add action fails, the collector MUST see a clear,
  card-scoped error and MUST be able to retry without losing their current
  search results or page position.
- **FR-008**: Search results MUST be split into pages once they exceed a
  single page's worth of cards, with navigation to move between pages without
  a full-page reload and without re-entering the search.
- **FR-009**: Running a new search MUST reset the results view to the first
  page.
- **FR-010**: When the total number of results fits within a single page,
  pagination controls MUST be hidden or disabled rather than shown as a
  no-op.
- **FR-011**: The results layout MUST make effective use of the available
  viewport width — showing more cards per page on wider screens rather than
  leaving unused horizontal space — while keeping every card fully readable at
  narrow widths.
- **FR-012**: After a card's add action succeeds, the collector MUST remain on
  the search results (with that card showing an "added" confirmation) rather
  than being navigated away to their library.
- **FR-013**: The preview action MUST present the record's fuller details as
  an overlay on top of the current search results; closing it MUST return the
  collector to the same results and page they were viewing.
- **FR-014**: Results MUST be arranged as a responsive multi-column grid of
  cards (more columns on wider viewports), not a fixed single-column list.

### Key Entities

- **Search Result**: A candidate vinyl release returned by a catalog search,
  not yet part of the collector's library. Represented by a cover thumbnail,
  title, artist, release year, and optionally format — the same data a card
  displays.
- **Library Entry**: An existing concept (from prior features) representing a
  record the collector has already added to their personal library. This
  feature's add action creates one of these from a Search Result; it does not
  change what a Library Entry is.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Collectors can identify the record they're looking for in a
  search results page using only the card's visible information (cover,
  title, artist, year) without needing to open every result.
- **SC-002**: Collectors can add a recognized record to their library in a
  single action from the search results, without navigating to a separate
  add-confirmation step.
- **SC-003**: Collectors can preview a candidate record's fuller details
  without it being added to their library, and without losing their place in
  the search results afterward.
- **SC-004**: A search returning significantly more results than fit on one
  screen remains fully navigable — every result is reachable through
  pagination — without the page requiring large amounts of continuous
  scrolling.
- **SC-005**: On a wide viewport, the results area shows visibly more cards
  per page than on a narrow viewport, demonstrating effective use of
  available space.

## Assumptions

- This feature enhances the existing "add a record" search flow (today's
  search-and-add screen); it is not a new, separate catalog-browsing area of
  the application.
- The feature covers release-type search results only (matching today's
  behavior), not artist-type results.
- The artist name shown on a card is derived from the catalog's existing
  combined "Artist - Title" search result convention; when no separator can be
  found, the full string is shown as the title with no separate artist shown,
  rather than the feature failing.
- Configurable page size (letting the collector choose how many cards appear
  per page) is a nice-to-have explicitly marked optional by the requester; a
  single well-chosen fixed default page size satisfies the core requirement,
  and a page-size control MAY be added if time allows without being required
  for this feature to be considered complete.
- No changes are required to what happens after a record is added regarding
  condition/notes — those remain editable afterward from the existing library
  entry detail view, unchanged by this feature.
