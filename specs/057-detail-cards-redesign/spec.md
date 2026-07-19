# Feature Specification: Detail Screens Card-Based Redesign

**Feature Branch**: `057-detail-cards-redesign`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Para este incremento quiero trabajar en rediseñar las pantallas de detalle de release y detalle de master release para que se basen en cards. Las cards quiero que no sean muy marcadas y que tengan poca separación entre ellas. La propuesta sería una card para la galería, una carda para la info principal, en el caso de la release una card para los datos de puntuación, estado y notas. Una card para la tracklist, en el caso de master release una card con la lista de release y una card para los demás detalles del disco. Propon una distribución de cards si consideras que hay una que encaje mejor."

## Proposed Card Distribution

The requester asked for a recommended grouping. Both detail screens currently render all their content inside one large bordered container. This redesign replaces that single container with several smaller, visually subtle cards, each holding one coherent group of content:

**Release detail** (covers both a record already in the user's library and a catalog release being previewed before it's added):

1. **Gallery card** — cover art gallery.
2. **Main info card** — title, artist, and descriptive tags (country, release date, format, label, genres, styles). When the release isn't in the library yet, the "Add to library" action lives here too, since it's the primary next step tied to this information.
3. **Your copy card** *(library copies only)* — personal rating, media condition, sleeve condition, and personal notes.
4. **Tracklist card** — the track listing.
5. **Other details card** — Discogs-provided notes, identifiers, and community stats (have/want counts, average rating), giving this data (currently an unboxed section) a proper home; omitted entirely when the release has none of this data.

**Master release detail**:

1. **Gallery card** — cover art gallery.
2. **Main info card** — title and artist.
3. **Other details card** — year, genres, styles, and the link to view the master on Discogs, split out from the main info card since this screen has no personal or community data to justify a fifth grouping.
4. **Tracklist card** — the track listing.
5. **Versions list card** — the paginated list of individual releases belonging to this master.

## Clarifications

### Session 2026-07-19

- Q: Should the release screen's "Other details" card (Discogs notes/identifiers/community, not explicitly named by the requester) actually ship, be folded into main info, or be dropped? → A: Add it as its own 5th card, as proposed.
- Q: Should the catalog release preview page (`/app/releases/:discogsId`, shown before adding a release to the library) get the same card redesign as the library record view in this increment? → A: Yes — in scope, redesign both together.
- Q: The master release "Other details" card proposes a new "view on Discogs" link that isn't shown anywhere on the page today — add it, or keep the card to existing data only (year/genres/styles)? → A: Add the new "view on Discogs" link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a library record at a glance (Priority: P1)

A user opens a record from their library and wants to quickly tell apart the cover art, the release's general info, their personal rating/condition/notes, and the tracklist, without the whole page reading as one dense block.

**Why this priority**: This is the most-visited detail screen (every library record) and the one that most benefits from separating "facts about the release" from "my personal copy data."

**Independent Test**: Open a library record's detail page and verify the gallery, main info, "your copy," and tracklist each render as their own distinct, lightly-separated card, with all existing interactions (star rating, condition dropdowns, notes editing, remove-from-library) still working.

**Acceptance Scenarios**:

1. **Given** a library record with full release data, **When** the user opens its detail page, **Then** the gallery, main info, your-copy, tracklist, and other-details cards each appear as visually distinct groups with subtle (not heavily bordered) separation.
2. **Given** a library record whose release has no Discogs notes, identifiers, or community stats, **When** the user opens its detail page, **Then** the "other details" card does not appear.
3. **Given** a library record, **When** the user updates their rating, condition, or notes inside the "your copy" card, **Then** the change saves exactly as it does today.

---

### User Story 2 - Browse a master release's card-based detail page (Priority: P2)

A user opens a master release from search results and wants the same clear separation between the cover art, general info, other details, tracklist, and the list of individual pressings/versions.

**Why this priority**: Master release pages combine more distinct groupings (versions table) than the release page and benefit similarly, but are visited less often than library records.

**Independent Test**: Open a master release detail page and verify gallery, main info, other details, tracklist, and versions-list each render as their own card, with pagination in the versions list still working.

**Acceptance Scenarios**:

1. **Given** a master release with year, genres, and styles, **When** the user opens its detail page, **Then** main info (title/artist) and other details (year/genres/styles/Discogs link) render as two separate cards.
2. **Given** a master release with more than one page of versions, **When** the user pages through the versions list card, **Then** pagination behaves exactly as it does today.
3. **Given** a master release with no year, genres, or styles, **When** the user opens its detail page, **Then** the "other details" card does not appear.

---

### User Story 3 - Preview a catalog release before adding it to the library (Priority: P3)

A user browsing the catalog (not yet in their library) opens a release's detail page to decide whether to add it, and sees the same card-based structure minus the personal "your copy" card, with "Add to library" available in the main info card.

**Why this priority**: Same underlying screen template as User Story 1 for consistency, but this specific entry point is used less frequently than viewing an already-owned record.

**Independent Test**: Open a catalog release (not in the library) and verify the same gallery/main-info/tracklist/other-details card structure appears, with an "Add to library" action inside the main info card and no "your copy" card.

**Acceptance Scenarios**:

1. **Given** a catalog release not yet in the user's library, **When** the user opens its detail page, **Then** no "your copy" card is shown and an "Add to library" action appears within the main info card.
2. **Given** a catalog release, **When** the user adds it to their library from this page, **Then** the action completes exactly as it does today.

---

### Edge Cases

- A card whose underlying data is entirely absent (no notes/identifiers/community for a release; no year/genres/styles for a master) is omitted entirely rather than shown empty or with placeholder text.
- A release/master with no cover images still shows a gallery card with the existing empty/placeholder gallery state.
- On narrow (mobile) viewports, cards stack in a single column with reduced spacing while remaining fully legible and tappable.
- Dark theme: card boundaries remain distinguishable from the page background despite the more subtle styling.
- A very long tracklist or a master with many version pages does not visually break the card containing it; the card grows to fit its content.
- An error/not-found/loading state (release not found, catalog fetch failed, Discogs link invalid) continues to render using the existing single-message treatment, since these states have no multi-section content to split into cards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The release detail screen (both the library "your copy" view and the catalog pre-add preview) MUST present its content as multiple visually distinct card containers instead of one large container wrapping all sections.
- **FR-002**: The release detail screen MUST group its content into a gallery card, a main info card (title, artist, country, release date, format, label, genres, styles), and a tracklist card.
- **FR-003**: The release detail screen MUST render an "other details" card containing Discogs-provided notes, identifiers, and community stats, omitted entirely when none of that data is present.
- **FR-004**: When the release is already in the user's library, the release detail screen MUST additionally render a "your copy" card containing personal rating, media condition, sleeve condition, and personal notes.
- **FR-005**: When the release is not yet in the user's library, the "Add to library" action MUST appear within the main info card, and no "your copy" card is shown.
- **FR-006**: The master release detail screen MUST present its content as multiple visually distinct card containers: a gallery card, a main info card (title, artist), an other-details card (year, genres, styles, link to view on Discogs), a tracklist card, and a versions-list card containing the paginated list of individual releases belonging to the master.
- **FR-007**: The master release detail screen's "other details" card MUST be omitted entirely when the master has no year, genres, or styles.
- **FR-008**: Cards on both screens MUST read as visually subtle, achieved by splitting today's single large container into several smaller cards with tighter spacing between them (FR-009) rather than by introducing a new, lighter border or shadow style — each individual card keeps the app's standard card border/elevation weight, and the subtlety comes from the decomposition itself.
- **FR-009**: Vertical spacing between adjacent cards on both screens MUST be visually tighter than the spacing the app currently uses between unrelated page sections.
- **FR-010**: The card-based layout MUST remain responsive, stacking into a single column on narrow viewports and using the existing multi-column arrangement on wider viewports.
- **FR-011**: The card treatment MUST remain legible in both light and dark themes, keeping card boundaries visually distinguishable from the page background in both.
- **FR-012**: All existing interactive behavior within each content group (star rating input, condition dropdowns, inline-editable notes, gallery viewer, tracklist display, versions list pagination, add-to-library action, remove-from-library action) MUST continue to work unchanged within the new card layout.
- **FR-013**: Loading and error/not-found states for both screens MUST continue to render correctly; they are not required to adopt the new multi-card structure since they show a single message rather than multi-section content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On both the release detail and master release detail screens, users can identify each distinct content group (gallery, info, personal copy or other details, tracklist, versions list) without scrolling back and forth to compare sections, on both mobile and desktop widths.
- **SC-002**: 100% of existing interactions on these two screens (rating, condition editing, notes editing, remove from library, add to library, tracklist viewing, versions pagination, gallery browsing) continue to work with no loss of functionality after the redesign.
- **SC-003**: Content groups with no underlying data (e.g., a release with no community stats, a master with no genres/styles) never appear as visible empty cards.
- **SC-004**: The redesigned screens render without visual overlap, clipping, or broken layout across the mobile, tablet, and desktop breakpoints the app already supports.
- **SC-005**: In a design review against the current one-container layout, the card groupings and reduced spacing are confirmed by the requester as matching the intended "subtle, lightly separated" look before the increment is considered complete.

## Assumptions

- "Not heavily marked, with little separation" is interpreted as: a lighter border/background treatment than the app's current default card style, little to no shadow, and a tighter vertical gap between cards than the app's standard section spacing — exact values are a design/implementation detail to be refined visually against SC-005, not fixed numerically in this spec.
- The single outer card currently wrapping each screen's full content is removed; the individual cards described above sit directly on the page background with no additional enclosing border.
- The existing per-row cards used for the mobile layout of the versions list receive the same subtle-card visual treatment for consistency, but their underlying table/pagination behavior is unchanged.
- This is a visual/structural redesign only — no changes to underlying data, API contracts, or business logic are in scope.
- Loading skeletons and error/not-found messages are not required to be restructured into the new multi-card layout, since they display a single message rather than multiple content groups.
