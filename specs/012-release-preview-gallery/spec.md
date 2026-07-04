# Feature Specification: Release Preview Popup — Full Details & Image Gallery

**Feature Branch**: `012-release-preview-gallery`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "En este incremento quiero trabajar en mejorar el popup de
previsualización de la información del disco desde la card de resultados de busqueda.
los requisitos son los siguientes:
1. Antes de la tracklist, debe aparecer toda la información que se pueda obtener de la
release desde la api de discogs. Modifica los modelos si es necesario para poder
manejarlo.
2. Implementa un layout de dos columnas si hay eespacio o solo una columna si nos
encontramos en dispositivos móviles.
3. Convierte el espacio donde ahroa está la caratula en una galeria con carrousel de
thumbnails clickables vertical con las imágenes del disco recuperadas.
4. Actualizar los modelos de datos para la vista de detalle para dejar almacenada toda
la información que se recupere para la vista de previsualización. En futuros desarrollos
mejoraremos la vista de detalle y tendremos ya el camino preparado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See everything Discogs knows about a release before adding it (Priority: P1)

A collector is searching for a record to add to their collection. Before deciding
whether this is the exact pressing/edition they want, they open the preview popup from a
search result card. Today the popup only shows the cover, title, artist, and tracklist —
missing details (label & catalogue number, country, exact release date, genres/styles,
notes, community stats, other identifiers) that Discogs actually has for that release.
The collector wants all of that supplemental information shown, positioned above the
tracklist, without having to leave the search results page or open discogs.com in
another tab.

**Why this priority**: This is the core value of the increment — richer, trustworthy
information at the point of decision (whether to add this exact release to the
collection), which the current popup doesn't provide.

**Independent Test**: Can be fully tested by opening the preview popup for a search
result whose release has label, country, release date, notes, and community data on
Discogs, and confirming each available field is shown above the tracklist, without
navigating away from search.

**Acceptance Scenarios**:

1. **Given** a search result whose release has label, catalogue number, country, and
   release date on Discogs, **When** the collector opens the preview popup, **Then**
   all of those fields are shown in a details section above the tracklist.
2. **Given** a release that has notes/description text and community statistics (rating,
   have/want counts) on Discogs, **When** the popup loads, **Then** that information is
   also shown in the details section.
3. **Given** a release for which some of these fields are missing on Discogs (e.g., no
   notes, no community rating yet), **When** the popup loads, **Then** only the fields
   that have data are shown — no empty/blank placeholders for missing fields.
4. **Given** the tracklist is present, **When** the popup renders, **Then** the tracklist
   still appears, positioned after the new details section.

---

### User Story 2 - Read the popup comfortably on any screen size (Priority: P2)

A collector opens the preview popup on a phone while browsing, and on a laptop while at
a desk. On the laptop, with the extra details from User Story 1 now shown, the popup
should make use of the available width instead of forcing a long single-column scroll.
On the phone, the popup should still stack cleanly in one column.

**Why this priority**: Adding significantly more content (per User Story 1) to a
single-column popup would make it very long to scroll through on larger screens. This
depends on the richer content existing, so it's second priority.

**Independent Test**: Can be fully tested by opening the popup at a desktop-width
viewport and confirming the content splits into two columns, then narrowing the viewport
to a typical mobile width and confirming it collapses into a single stacked column.

**Acceptance Scenarios**:

1. **Given** the popup is open on a screen wide enough to fit two columns, **When** it
   renders, **Then** the image gallery occupies one column and the release details plus
   tracklist occupy the other.
2. **Given** the popup is open on a mobile-width screen, **When** it renders, **Then**
   all content stacks in a single column in a sensible reading order (gallery, then
   details, then tracklist).
3. **Given** the popup is already open, **When** the viewport is resized across the
   breakpoint (e.g., rotating a tablet, resizing a browser window), **Then** the layout
   adapts accordingly without requiring the popup to be reopened.

---

### User Story 3 - Browse all of a release's photos, not just the cover (Priority: P3)

A collector opens the preview popup for a release that has several photos on Discogs
(front cover, back cover, label, insert, etc.), but today only the first image is ever
shown. The collector wants to flip through all of the available images from within the
popup.

**Why this priority**: Useful and requested, but delivers value independently of, and
is less central than, seeing full release details (User Story 1) or having a workable
layout (User Story 2) — a collector can still make a decision from the single cover
image if this isn't yet available.

**Independent Test**: Can be fully tested by opening the popup for a release with
multiple images on Discogs, clicking a thumbnail other than the first, and confirming
the main displayed image updates to match.

**Acceptance Scenarios**:

1. **Given** a release with multiple images on Discogs, **When** the popup loads,
   **Then** a primary image is shown alongside a vertical list of clickable thumbnails
   for every retrieved image.
2. **Given** the thumbnail list is shown, **When** the collector clicks a thumbnail,
   **Then** the primary image updates to that image, and the popup remains open.
3. **Given** a release with only one image on Discogs, **When** the popup loads,
   **Then** that single image is shown as the primary image without thumbnail
   navigation controls.
4. **Given** a release with no images at all on Discogs, **When** the popup loads,
   **Then** the existing no-image placeholder is shown in place of the gallery.

---

### Edge Cases

- What happens when a release has a very long notes/description field? The details
  section must remain readable (e.g., scrollable within the popup, consistent with the
  popup's existing scroll behavior) without breaking the two-column layout.
- What happens when a release has a large number of images (e.g., 15+)? The vertical
  thumbnail list must remain usable (e.g., scrolls within its own area) without growing
  the popup beyond its normal size.
- How does the system handle a release missing most of the optional Discogs fields
  (only title, artist, and tracklist available)? The details section shows whatever is
  available and does not show empty rows/labels for missing fields.
- What happens if the collector opens the popup for another search result while one is
  already loading? Existing loading/error behavior (skeleton, fallback message) must
  continue to work for the new, larger layout.
- What happens when the viewport width sits exactly at the two-column/one-column
  boundary? The layout must pick one of the two arrangements without a visually broken
  in-between state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The preview popup MUST display a release-details section positioned above
  the tracklist, showing supplemental release information available from Discogs beyond
  what is shown today — including label(s) and catalogue number, country, exact release
  date, genres, styles, notes/description, community statistics (rating, have/want
  counts), and other release identifiers (e.g., barcode, matrix/runout), whenever that
  data exists for the release (see Assumptions for the specific field list).
- **FR-002**: The release-details section MUST omit any individual field for which
  Discogs has no data for that release, rather than showing an empty value.
- **FR-003**: The tracklist MUST continue to be shown, immediately after the new
  release-details section, whenever tracklist data is available — unchanged in content
  from today.
- **FR-004**: The popup's layout MUST render as two columns (image gallery in one
  column; release details and tracklist in the other) when there is enough viewport
  width, and MUST collapse to a single stacked column on narrower/mobile viewports.
- **FR-005**: The layout MUST adapt fluidly to the available space (consistent with how
  the record detail view already adapts, per the existing two-column/one-column
  redesign), not solely based on device type.
- **FR-006**: The popup MUST replace today's single static cover image with an image
  gallery: a primary image plus a vertical list of clickable thumbnails, built from all
  images Discogs returns for the release.
- **FR-007**: Clicking a thumbnail MUST update the primary displayed image to the
  corresponding image, without closing the popup or navigating away.
- **FR-008**: When a release has exactly one image, the gallery MUST show that image
  as the primary image and MUST NOT show thumbnail navigation controls.
- **FR-009**: When a release has no images, the popup MUST show the existing
  no-image placeholder in place of the gallery.
- **FR-010**: The system's release data model MUST be extended to capture the
  additional Discogs release fields introduced by FR-001 (beyond what is already
  captured today), so the new details section can be populated.
- **FR-011**: The record detail view's underlying release data model MUST be updated to
  hold this same enriched release information (the full set of data retrieved for the
  preview popup), so that a future increment can surface it in the detail view without
  requiring another data-retrieval or model change. This feature does NOT change what is
  visually shown on the record detail page.
- **FR-012**: All newly displayed release-detail fields and the image gallery MUST
  remain read-only (no editing), consistent with the existing preview popup.
- **FR-013**: The popup MUST retain its existing loading state (skeleton) and error
  state (fallback message when catalog details can't be retrieved) for the expanded
  content.

### Key Entities

- **Release (Catalog)**: Existing entity representing a Discogs release, extended with
  additional descriptive attributes retrieved from Discogs — exact release date, notes/
  description, one or more identifiers (type + value, e.g., barcode or matrix/runout),
  and community statistics. Already includes label(s)/catalogue number, country,
  genres, styles, and multiple images — this feature is what starts using more of the
  data already modeled here, plus the new attributes above.
- **Community Statistics**: New attribute group on a Release — collector rating
  (average and number of ratings) and ownership counts (how many collectors have it /
  want it), shown when Discogs provides them.
- **Release Identifier**: New attribute — a labeled piece of catalog identification data
  (e.g., barcode, matrix/runout), consisting of a type and a value, zero or more per
  release.
- **Release Image**: Existing per-image entry (already modeled as an ordered list per
  release); this feature changes how the collection of images is *presented* (primary +
  clickable vertical thumbnails) rather than the entity shape itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For releases that have label, country, release date, notes, or community
  data on Discogs, collectors can see all of that information from the preview popup
  without leaving the search results screen or opening an external site.
- **SC-002**: On a desktop-width screen, the popup displays its content in two columns;
  on a mobile-width screen, the same popup displays the same content stacked in a single
  column — verified across representative viewport widths.
- **SC-003**: For releases with more than one image, collectors can bring any retrieved
  image into view within a single click, without the popup closing or reloading.
- **SC-004**: Releases with only one image, or with none, are handled without showing
  broken or non-functional gallery controls.
- **SC-005**: The record detail view's data layer already contains 100% of the release
  fields introduced by this feature, verified by inspection, ahead of any future detail
  view redesign work.

## Assumptions

- "All information obtainable from the Discogs release API" is interpreted as the set of
  collector-relevant fields Discogs commonly provides per release: label(s) + catalogue
  number, country, exact release date, genres, styles, notes/description, community
  statistics (rating average/count, have/want counts), and identifiers (e.g., barcode,
  matrix/runout). Rarely-populated or low-value fields for this app (e.g., linked
  videos, pressing-company credits, master-release series data) are treated as
  out of scope for this increment and can be added later if needed.
- The two-column/one-column breakpoint reuses the same responsive convention already
  established for the record detail view redesign (010), so the app has one consistent
  point at which layouts switch from stacked to side-by-side.
- The vertical thumbnail gallery shows every image Discogs returns for the release, in
  the order Discogs provides them (primary image first/selected by default); no
  additional pagination or lazy-loading behavior is specified beyond an internally
  scrollable thumbnail list for releases with many images.
- Updating the record detail view's data model (FR-011) is a data/typing change only;
  no visual or behavioral change to the record detail page is in scope for this
  feature.
- The preview popup continues to be opened from the search results card exactly as it
  is today (same trigger, same open/close behavior) — only its internal layout and
  content are changing.
