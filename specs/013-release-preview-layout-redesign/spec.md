# Feature Specification: Release Preview Layout Redesign

**Feature Branch**: `013-release-preview-layout-redesign`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Vamos a refinar la vista de previsualización de los discos con una presentación mejor. 1. La galeria de imágenes con carrusel de thumbnails vertical debe ocupar las 2 columnas del grid. La idea es que se vea en formato cuadrado. Evita que tenga visible la barra de scroll. 2. Lo siguiente empezando por la izquierda será la información de interés, como por ejemplo título, artista, generos, estilos, fecha y sello. 3. A la izquierda aparecerá la tracklist. 4. Y por último el resto de información de la release. 5. En el caso de dispositivos móviles el orden será Galeria, información de interés, tracklist, resto de información obtenida. 6. Reenfoca los estilos para que tenga un look and feel mucho más moderno y acorde con la app. 7. Evita que las barras de scroll sean visibles ya que no es nada elegante."

## Clarifications

### Session 2026-07-04

- Q: On the wide (desktop) layout, how should key details and the tracklist be arranged in the two columns below the gallery? → A: Key details on the left column, tracklist on the right column (matches the mobile reading order: info before tracklist).
- Q: The shared modal component's outer container currently relies on the browser's default scrollbar and is reused elsewhere in the app. Should "no visible scrollbar" cover only the new preview-specific areas (thumbnail strip, tracklist), or the entire preview modal? → A: The entire preview modal must hide scrollbars end-to-end, without changing the shared modal component's default behavior for its other usages.
- Q: For releases with very long tracklists, how should the tracklist column behave relative to the (usually short) key details column? → A: Neither column has its own bounded/scrollable height; long content grows the whole modal, which scrolls as one unit (with its scrollbar hidden per the prior clarification).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the cover gallery front and center (Priority: P1)

A collector opens the preview of a record in their library and immediately sees a large, square image gallery with a vertical strip of thumbnails they can browse, spanning the full width of the preview panel.

**Why this priority**: The cover art is the primary visual identifier for a vinyl record and the main reason collectors open a preview. A cramped or narrow gallery undermines the entire redesign, so this is the foundation the rest of the layout builds on.

**Independent Test**: Open the preview for a record with multiple catalog images. Confirm the gallery spans the full width of the preview panel, the main image renders as a square, the thumbnail strip is fully visible without a visible scrollbar, and clicking a thumbnail swaps the main image.

**Acceptance Scenarios**:

1. **Given** a record with more than one catalog image, **When** the preview opens, **Then** the gallery occupies the full width of the preview panel and displays the main image in a square aspect ratio with a vertical thumbnail strip alongside it.
2. **Given** the vertical thumbnail strip contains more thumbnails than fit in the visible area, **When** the preview is displayed, **Then** the collector can still browse all thumbnails (e.g., by scrolling within the strip) without any scrollbar track or handle being visible.
3. **Given** a record with only one catalog image, **When** the preview opens, **Then** the gallery still occupies the full width and shows the single image in square format without an empty or broken thumbnail strip.
4. **Given** a record with no catalog images, **When** the preview opens, **Then** a clear placeholder is shown in the same full-width, square layout instead of the gallery.

---

### User Story 2 - Scan key details and tracklist together (Priority: P2)

A collector wants to quickly confirm which pressing they are looking at (title, artist, genres, styles, release date, label) and browse the tracklist, with both pieces of information visible together right below the gallery.

**Why this priority**: These are the two pieces of information collectors check most often after the cover art — "is this the right record?" and "what's on it?". Placing them together immediately below the gallery, in a clearly separated layout, is the core of the requested reorganization.

**Independent Test**: Open the preview for a record with a full set of metadata and a tracklist. Confirm the key details (title, artist, genres, styles, date, label) and the tracklist are both visible directly below the gallery, in their own clearly distinguished areas, without needing to scroll the whole preview to find either one.

**Acceptance Scenarios**:

1. **Given** a record with title, artist, genres, styles, release date, and label information, **When** the preview is displayed on a wide screen, **Then** the key details appear in one area and the tracklist appears in an adjacent area, both directly below the gallery.
2. **Given** a record with a long tracklist, **When** the preview is displayed, **Then** the tracklist area grows to show all tracks (it is not independently height-capped), and if this makes the overall preview taller than the visible area, the collector can still reach all content by scrolling the preview as a whole without any scrollbar being visible.
3. **Given** a record missing some optional metadata (e.g., no label or no styles), **When** the preview is displayed, **Then** the key details area omits the missing fields gracefully without leaving obvious blank gaps.
4. **Given** a record with no tracklist data, **When** the preview is displayed, **Then** the tracklist area is omitted or clearly indicates no tracklist is available, without breaking the layout.

---

### User Story 3 - Review remaining release information last (Priority: P3)

A collector who wants deeper catalog detail (notes, identifiers, community stats such as have/want counts and rating) can find that information below the key details and tracklist, without it crowding the primary content.

**Why this priority**: This information is useful but secondary — most collectors only consult it occasionally. It should remain available but visually de-prioritized below the more frequently used sections.

**Independent Test**: Open the preview for a record with notes, identifiers, and community stats populated. Confirm this content appears after the key details and tracklist sections, in a visually distinct area, and confirm it disappears cleanly when the underlying data is absent.

**Acceptance Scenarios**:

1. **Given** a record with notes, identifiers, and community statistics, **When** the preview is displayed, **Then** this information appears as the last section of the preview, below the gallery, key details, and tracklist.
2. **Given** a record missing notes, identifiers, or community statistics, **When** the preview is displayed, **Then** only the available pieces render and no empty section placeholders are shown.

---

### User Story 4 - Consistent reading order on mobile (Priority: P2)

A collector browsing on a phone opens the same preview and reads the content top to bottom in the order: gallery, key details, tracklist, remaining information — matching the priority of the information rather than a side-by-side layout.

**Why this priority**: Mobile is a primary usage context for a personal collection app, and an explicit reading order was called out by the requester as essential; getting this wrong would make the feature feel unfinished on the most common device type.

**Independent Test**: Open the preview on a narrow (mobile-width) viewport for a record with full data. Confirm the sections stack vertically in the exact order: gallery, key details, tracklist, remaining information.

**Acceptance Scenarios**:

1. **Given** the preview is viewed on a narrow viewport, **When** it renders, **Then** the sections stack in this order top to bottom: gallery, key details, tracklist, remaining release information.
2. **Given** the viewport is resized from wide to narrow (or vice versa) while the preview is open, **When** the resize crosses the layout breakpoint, **Then** the content reflows into the correct order and column arrangement for the new viewport size without loss of information or duplicated sections.

---

### User Story 5 - A modern, cohesive visual style (Priority: P3)

A collector viewing the preview perceives it as visually consistent with the rest of the app — modern spacing, typography, and surfaces — rather than a collection of default or dated-looking elements, and never sees a visible scrollbar anywhere in the preview.

**Why this priority**: Visual polish affects perceived quality but does not change what information is available or how it's structured, so it is prioritized below getting the structure and content right.

**Independent Test**: Open several previews (with and without images, short and long tracklists, complete and incomplete metadata) and confirm the visual treatment is consistent with the app's existing design language and that no scrollbar is visibly rendered anywhere within the preview, even when content overflows.

**Acceptance Scenarios**:

1. **Given** any release preview, **When** it is displayed, **Then** its visual style (spacing, corner treatment, color usage, typography hierarchy) is visibly consistent with the rest of the application.
2. **Given** the thumbnail strip overflows its fixed-height area, or the preview's overall content is taller than the visible area, **When** the collector interacts with it, **Then** the content remains scrollable/reachable but no scrollbar track or handle is ever visibly rendered.

---

### Edge Cases

- What happens when a record has an extremely long title or artist name that could overflow the key details area? The layout must wrap or truncate gracefully without breaking the grid.
- What happens when a record has dozens of catalog images? The thumbnail strip must remain usable (scrollable without a visible scrollbar) rather than growing unbounded.
- What happens when the preview is opened while data is still loading? The existing loading placeholder behavior must be adapted to the new section order and proportions so it doesn't flash a mismatched layout once data arrives.
- What happens when a record has none of the "information of interest" fields (no genres, styles, date, or label) beyond title/artist? The key details area should degrade to just title and artist without leaving a visually empty block.
- How does the layout behave at intermediate viewport widths (e.g., tablets) between the mobile single-column order and the full desktop layout?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The preview MUST display the image gallery (main image plus vertical thumbnail strip) spanning the full width of the preview panel on layouts wide enough for a multi-column arrangement.
- **FR-002**: The preview MUST render the gallery's main image in a square aspect ratio.
- **FR-003**: The preview MUST allow browsing all thumbnails in the vertical thumbnail strip when they exceed the visible area, without ever showing a visible scrollbar track or handle.
- **FR-004**: On wide layouts, the preview MUST place the key release details (title, artist, genres, styles, release date, label) in the left column and the tracklist in the right column, in two adjacent areas directly below the gallery.
- **FR-005**: On wide layouts, the preview MUST place the remaining release information (notes, identifiers, community statistics) below the key details and tracklist areas, spanning the full width of the preview panel.
- **FR-006**: On narrow (mobile-width) layouts, the preview MUST stack all sections in a single column in this exact order: gallery, key details, tracklist, remaining release information.
- **FR-007**: The preview MUST omit any section or field for which the underlying data is absent, without leaving visible empty placeholders.
- **FR-008**: The preview MUST NOT render a visible scrollbar (track or handle) anywhere within the preview, including within the thumbnail strip, the tracklist, and the modal's own outer scroll container, regardless of content length — without changing the shared modal component's default scrollbar behavior for its other usages elsewhere in the app.
- **FR-009**: The preview's loading state MUST reflect the same section order and proportions as the loaded state, so the layout does not visibly shift once data arrives.
- **FR-012**: The key details column and the tracklist column MUST NOT have their own independently bounded/scrollable height; when their combined content exceeds the visible area, the preview MUST grow and scroll as a single unit (per FR-008, without a visible scrollbar) rather than scrolling either column internally.
- **FR-010**: The preview's visual styling (spacing, surfaces, typography, color usage) MUST be visually consistent with the rest of the application's existing design language.
- **FR-011**: The preview MUST remain fully readable and navigable (via touch or pointer scrolling) even where scrollbars are visually hidden, so no content becomes unreachable.

### Key Entities

- **Release Preview**: The read-only summary view of a single catalog record shown to a collector, composed of an image gallery, key details, a tracklist, and remaining release information.
- **Catalog Image**: An image associated with a release, one of which is the currently selected/main image and the rest of which appear as browsable thumbnails.
- **Key Release Details**: The subset of release metadata considered high priority for quick identification — title, artist(s), genres, styles, release date, and label(s).
- **Remaining Release Information**: Lower-priority release metadata such as notes, identifiers, and community statistics (have/want counts, rating).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Collectors can identify the correct pressing (title, artist, date, label) and see the tracklist within the first screen of the preview on desktop-sized viewports, without scrolling, for records with typical amounts of metadata.
- **SC-002**: On mobile-width viewports, 100% of preview sections appear in the specified order (gallery, key details, tracklist, remaining information) across all tested record data variations (complete data, missing optional fields, no images, no tracklist).
- **SC-003**: No scrollbar track or handle is visibly rendered in any part of the preview panel in a visual audit across at least 5 representative records with varying content lengths (short/long tracklists, few/many images).
- **SC-004**: In an informal visual comparison, the redesigned preview is rated as more consistent with the rest of the app's look and feel than the previous version by reviewers familiar with the app.
- **SC-005**: The redesigned preview introduces no loss of previously available information — every data point shown before the redesign remains visible somewhere in the new layout.

## Assumptions

- "Información de interés" (information of interest) refers to: title, artist(s), genres, styles, release date, and label(s), as explicitly listed by the requester.
- "Resto de información" (remaining information) refers to the release data not covered by the gallery or key details: notes, identifiers, and community statistics (have/want counts, rating) — i.e., everything currently shown in the preview beyond the gallery, key details, and tracklist.
- "Desktop/wide layout" and "mobile layout" are treated as two breakpoints (a two/four-column arrangement vs. a single stacked column); intermediate (tablet) widths default to whichever of the two arrangements is closer to typical device widths, following existing app breakpoint conventions.
- The existing set of catalog data available for a release (images, title, artists, genres, styles, release date, labels, tracklist, notes, identifiers, community stats) is unchanged by this feature; this is a presentation-only redesign.
- "No visible scrollbar" means the scrollbar is hidden from view while scroll interaction (touch, wheel, drag) remains fully functional — content is never clipped or made permanently inaccessible.
