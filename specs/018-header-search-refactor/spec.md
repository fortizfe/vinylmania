# Feature Specification: Persistent Header Search & Results Page

**Feature Branch**: `018-header-search-refactor`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Para esta feature quiero trabajar en refinar el componente de búsqueda. Vamos a empezar por colocar el texbox siempre visible en el centro del header. Una ves se lance la búsqueda, se navegará a la página de resultados. En la vista My Library eliminaremos el componente 'add a record' ya que no será necesario al tener siempre la busqueda en el header."

## Clarifications

### Session 2026-07-06

- Q: When "Add a record" is removed from My Library and the header search becomes the entry point, what happens to the old dedicated search/add page (today's `/app/library/add`)? → A: Retire it entirely; the new header-triggered search results page becomes the single, sole search+add destination.
- Q: Should the header search box's text reset when the user navigates away from the search results page to an unrelated page (e.g., Wishlist, Profile), or should it persist the last submitted query? → A: Reset when leaving the search results page; the header search box clears back to empty on any other page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search from anywhere in the app (Priority: P1)

As a collector browsing any screen of the app (dashboard, my library, wishlist,
record detail, profile), I want a search box always visible in the center of
the header, so I can look up a record in the Discogs catalog without first
navigating to a dedicated "add record" page.

**Why this priority**: This is the core behavior change requested — search
must stop being a destination you navigate to and become an action available
from wherever the user already is. Without this, none of the other stories
have a starting point.

**Independent Test**: Can be fully tested by loading any authenticated page
(dashboard, library, wishlist, record detail, profile) and confirming the
search box is visible, centered in the header, and usable without navigating
away first.

**Acceptance Scenarios**:

1. **Given** a user is on any authenticated page of the app, **When** the
   page renders, **Then** a search textbox is visible in the center of the
   header.
2. **Given** a user is viewing the search box on a page other than the search
   results page, **When** they type a query and submit it, **Then** the
   textbox remains visible in the header after the action completes.
3. **Given** a user resizes the browser or views the app on a smaller screen,
   **When** the header renders, **Then** the search box remains visible and
   usable (its position may adapt to the available width, but it must not
   disappear or become unreachable).
4. **Given** a user has submitted a query and is now on the search results
   page, **When** they navigate to any other page (e.g., Wishlist, Profile),
   **Then** the header search box resets to empty.

---

### User Story 2 - Launch a search and land on results (Priority: P1)

As a collector, I want submitting a search from the header to take me to a
results page showing matching records, so I can review and act on the matches
in a focused view instead of a small inline panel.

**Why this priority**: This is the second half of the core behavior change —
without navigation to a dedicated results page, the header search box has
nowhere to send its output. It directly replaces today's in-page search
experience on the "Add a record" screen.

**Independent Test**: Can be fully tested by typing a query into the header
search box, submitting it, and confirming the app navigates to a results page
that displays matching records as cards (cover, title, artist, year) with
existing add-to-library and preview actions, and pagination, per the search
results behavior already defined for the catalog.

**Acceptance Scenarios**:

1. **Given** a user types a non-empty query into the header search box and
   submits it, **When** the search is launched, **Then** the app navigates to
   the search results page and displays the matching records.
2. **Given** a user is already on the search results page, **When** they
   submit a new query from the header search box, **Then** the results page
   updates to show the new query's matches (without a full page reload if
   avoidable).
3. **Given** a user submits an empty or whitespace-only query, **When** they
   attempt to search, **Then** no navigation occurs and no request is sent.
4. **Given** a search returns no matching records, **When** the results page
   loads, **Then** the user sees a clear empty-state message instead of a
   blank page.
5. **Given** a user is on the results page and wants to add a matched record
   to their library, **When** they use the existing add action on a result
   card, **Then** the record is added to their library exactly as it is
   today.

---

### User Story 3 - Simplified My Library view (Priority: P2)

As a collector viewing "My Library", I want the page to no longer show an
"Add a record" entry point, so the page isn't cluttered with an action that
duplicates the search box now always available in the header.

**Why this priority**: This is a cleanup that depends on Story 1 being in
place (search must already be reachable from the header before its
library-page duplicate is removed), but it delivers a real, independently
observable simplification of the My Library screen.

**Independent Test**: Can be fully tested by opening "My Library" and
confirming the "Add a record" link/button is no longer present, while
confirming the header search box is present and functional on that same page.

**Acceptance Scenarios**:

1. **Given** a user opens the "My Library" page with an active Discogs link,
   **When** the page renders, **Then** no "Add a record" link or button is
   present.
2. **Given** a user is on the "My Library" page, **When** they look at the
   header, **Then** the search box is visible and can be used to reach the
   search results page.
3. **Given** a user is on the "My Library" page in a state where Discogs
   linking is required (library gated), **When** the page renders, **Then**
   the existing gating message is shown as it is today, unaffected by the
   removal of the "Add a record" link.

---

### Edge Cases

- What happens if a user submits a search while a previous search from the
  same box is still loading? The most recent submission's results MUST be
  what the user ultimately sees (no stale results overwriting newer ones).
- What happens if a user navigates directly to the search results page
  without a query (e.g., via back/forward navigation or a bookmarked link)?
  The page MUST show an empty/prompt state rather than an error.
- What happens if the Discogs catalog search fails (e.g., network or
  upstream error)? The results page MUST show a clear error state, consistent
  with existing error handling elsewhere in the app.
- What happens if a user is on the search results page and clears the header
  search box entirely? The results page MUST NOT crash; it MAY return to an
  empty/prompt state.
- How does the header search box behave for a user whose Discogs account is
  not linked? Search and browsing of catalog results MUST still work; only
  the add-to-library action is gated behind the existing Discogs-link
  requirement, consistent with current behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application header MUST display a search textbox centered
  in the header on every authenticated page of the app.
- **FR-002**: The header search textbox MUST remain visible and usable across
  page navigations — it is part of the persistent header, not a page-specific
  element.
- **FR-002a**: The header search textbox MUST reset to empty whenever the
  user navigates to a page other than the search results page.
- **FR-003**: Submitting a non-empty query from the header search box MUST
  navigate the user to a dedicated search results page.
- **FR-004**: The search results page MUST display matching Discogs catalog
  records using the existing result-card presentation (cover thumbnail,
  title, artist, release year) with existing add-to-library and preview
  actions, and existing pagination behavior.
- **FR-005**: Submitting a new query from the header search box while already
  on the search results page MUST update the results page's content to
  reflect the new query.
- **FR-006**: Submitting an empty or whitespace-only query MUST NOT trigger
  navigation or a catalog search request.
- **FR-007**: The search results page MUST show a clear empty-state message
  when a query returns no matches, and a clear error state when the search
  request fails.
- **FR-008**: The "My Library" page MUST NOT display an "Add a record"
  link/button.
- **FR-009**: Removing the "Add a record" entry point from "My Library" MUST
  NOT alter any other existing behavior of that page (e.g., the Discogs-link
  gating state and its messaging MUST continue to work unchanged).
- **FR-010**: All existing ways of acting on a search result (adding to
  library, previewing details) MUST continue to function identically when
  reached via the header search box and results page.
- **FR-011**: The previous dedicated "Add a record" page/route MUST be
  retired once the header search results page replaces it; it MUST NOT
  remain independently reachable (no leftover link, bookmark target, or
  redirect destination distinct from the new search results page).

### Key Entities

- **Search Query**: The text a user enters to look up records in the Discogs
  catalog; transient input, not persisted.
- **Search Result**: A candidate record returned by the Discogs catalog for a
  given query, represented as a card (cover, title, artist, year) with
  add-to-library and preview actions; already defined by the existing search
  results feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start a catalog search from any authenticated screen
  without first navigating to a separate "add record" page.
- **SC-002**: 100% of authenticated pages display the header search box in a
  centered position.
- **SC-003**: Users reach the search results page in a single action (submit)
  from wherever they currently are in the app.
- **SC-004**: The "My Library" page no longer presents a redundant "Add a
  record" action once the header search box is available.
- **SC-005**: Existing add-to-library and preview actions on search results
  continue to succeed at the same rate as before this change (no functional
  regression).
- **SC-006**: No user-facing path (link, bookmark, or direct navigation)
  reaches the retired "Add a record" page after the change; the header
  search results page is the only way to search and add records.

## Assumptions

- The header search box replaces the standalone search form currently
  embedded in the "Add a record" page; the underlying result-card display,
  pagination, add-to-library, and preview behaviors (already specified by the
  existing vinyl search results feature) are reused as-is on the new results
  page rather than redesigned. The old "Add a record" page/route itself is
  retired (see Clarifications and FR-011), not kept alongside the new page.
- "Always visible in the header" applies to the authenticated application
  area (the pages wrapped by the app header today: dashboard, my library,
  wishlist, record detail, profile), not to the public/unauthenticated
  landing page, which has no app header.
- The search results page is a distinct destination from "My Library"; it is
  reached only via the header search box (there is no other link to it,
  mirroring how "Add a record" was previously the only entry point).
- Removing the "Add a record" link from "My Library" only removes that
  specific entry point; it does not remove or change the Discogs-link gating
  behavior already present on that page.
- Minimum query validation (non-empty, trimmed) is treated as sufficient
  input validation; no additional minimum character length is required beyond
  what the existing catalog search already enforces.
