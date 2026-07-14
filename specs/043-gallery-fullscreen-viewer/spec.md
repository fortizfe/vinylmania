# Feature Specification: Shared Image Gallery — Contained Size & Fullscreen Viewer

**Feature Branch**: `043-gallery-fullscreen-viewer`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Lee la definición del fichero @.hu/shared-image-gallery-fullscreen-viewer.md" — historia de usuario que pide corregir dos problemas de tamaño/scroll en la galería de imágenes compartida (`ReleaseImageGallery`, usada en `ReleaseDetailPage`, `MasterReleaseDetailPage` y `RecordDetailPage`) y añadir un visor a pantalla completa: (1) en escritorio la imagen principal ocupa casi toda la pantalla y debe tener un tamaño contenido; (2) la columna de miniaturas crece más alta que el visor cuando hay muchas imágenes y debe hacer scroll interno con la barra oculta; (3) al hacer click en la imagen principal debe abrirse un visor a pantalla completa, con las mismas miniaturas para navegar, cerrable con una "X" siempre visible o con Escape, que al cerrarse devuelve a la ficha con la imagen que estuviera seleccionada.

## Clarifications

### Session 2026-07-14

- Q: En el visor a pantalla completa, ¿debe cerrar el visor un click en el fondo (fuera de la imagen), o solo debe cerrarlo la X o Escape? → A: El click en el fondo también cierra el visor, igual que el `Modal` genérico existente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contained viewer size and scrollable thumbnails on desktop and mobile (Priority: P1)

As a user opening a record's detail page (from a search result, a master
release, or my own library), I want the main image to display at a
reasonable, contained size on desktop and the thumbnail column to never grow
taller than the viewer, so that I can still see the rest of the page's
content (metadata, tracklist, etc.) without the gallery dominating the
screen, and without losing access to any thumbnail when a release has many
images.

**Why this priority**: This is a visual regression affecting every detail
page today (the gallery is shared across all three), independent of the new
fullscreen viewer. It must be fixed regardless of whether Story 2 ships, and
delivers value on its own.

**Independent Test**: Open any of the three detail pages for a release with
10+ images, on both a desktop-sized and a mobile-sized viewport, and verify
the main image is contained (not near-fullscreen) and the thumbnail column
stops growing at the viewer's height while remaining scrollable with no
visible scrollbar.

**Acceptance Scenarios**:

1. **Given** any of the three detail pages on a desktop viewport, **When**
   the release has several images, **Then** the main image displays at a
   contained size — it no longer occupies "almost the entire screen" as it
   does today — leaving visible room for the rest of the page's content
   without excessive scrolling.
2. **Given** any of the three detail pages, **When** the release has more
   images than fit within the viewer's height (e.g., 10 or more), **Then**
   the vertical thumbnail column does **not** grow taller than the viewer
   (main image plus its container); it stays capped at that height.
3. **Given** the thumbnail column capped at the viewer's height with more
   images than fit, **When** the user wants to see the rest, **Then** they
   can scroll vertically within that column, and that container's scrollbar
   is **not visible** (same criterion already applied today via the
   project's `scrollbar-hidden` utility).
4. **Given** a release with few enough images to fit without scrolling,
   **When** the gallery is displayed, **Then** no scrollbar or extra visual
   artifact appears (no regression versus current behavior).
5. **Given** a mobile viewport, **When** the release has many images,
   **Then** the same height-capping and hidden-internal-scroll behavior
   applies as on desktop.
6. **Given** that the component is shared, **When** these changes are
   applied, **Then** the resulting behavior is identical across all three
   detail pages (search results, master release, and library), since they
   all render the same single component.

---

### User Story 2 - Fullscreen viewer on main image click (Priority: P1)

As a user viewing a record's detail page, I want to click the main image to
open a fullscreen viewer where I can comfortably browse all of the release's
images, and close it easily to return to the detail page, so that I can
examine covers/back covers/inserts in more detail than the small embedded
viewer allows.

**Why this priority**: This is the core new capability requested by the
feature and delivers the primary user-facing value (a proper way to inspect
artwork closely). It depends on User Story 1 only for a consistent embedded
starting point, but is independently testable and deployable.

**Independent Test**: On any detail page for a release with multiple images,
click the main image, verify a fullscreen viewer opens showing that same
image with a thumbnail strip, click a different thumbnail, verify the large
image updates while staying fullscreen, then close via the "X" and via
Escape and verify both return to the normal embedded viewer showing the
last-selected image.

**Acceptance Scenarios**:

1. **Given** the normal (embedded) viewer showing a main image, **When** the
   user clicks that image, **Then** a fullscreen viewer opens showing that
   same image enlarged.
2. **Given** the fullscreen viewer is open, **When** it is displayed,
   **Then** it includes the same selectable thumbnail strip as the normal
   viewer, allowing the user to jump directly to any image in the release
   without leaving fullscreen mode.
3. **Given** the fullscreen viewer is open, **When** the user clicks a
   thumbnail in that strip, **Then** the large image changes to the
   selected one, remaining in fullscreen mode.
4. **Given** the fullscreen viewer is open, **When** the user wants to close
   it, **Then** an always-visible "X" (close) button is available that, when
   pressed, closes the viewer and returns to the detail page in its normal
   state (embedded viewer, not fullscreen).
5. **Given** the fullscreen viewer is open, **When** the user presses the
   Escape key, **Then** the viewer also closes (same keyboard-close pattern
   already used by the app's generic `Modal` component).
6. **Given** the fullscreen viewer is open, **When** it is closed (via the X
   or via Escape), **Then** the detail page's normal viewer shows whichever
   image was selected at that moment inside fullscreen (it does not reset to
   the first/primary image).
7. **Given** any of the three detail pages (search results, master release,
   library), **When** the user clicks the main image, **Then** the
   fullscreen viewer opens with identical behavior on all three.
8. **Given** a release with a single image, **When** the user clicks it,
   **Then** the fullscreen viewer opens showing that single image, without a
   thumbnail strip (same as the normal viewer, which also hides the
   thumbnail strip when there is only one image).
9. **Given** a release with no images at all (the "No cover image available"
   placeholder is shown), **When** the user clicks that placeholder,
   **Then** no fullscreen viewer opens — unchanged behavior versus today.
10. **Given** a mobile viewport, **When** the user taps the main image,
    **Then** the fullscreen viewer opens the same as on desktop, using the
    full screen of the device.
11. **Given** the main image in the normal viewer, **When** a keyboard user
    focuses it and presses Enter or Space, **Then** the fullscreen viewer
    opens the same as with a click (the image must be keyboard-accessible,
    not just mouse/touch-accessible, matching how the normal viewer's
    thumbnails are already keyboard-accessible today).
12. **Given** the fullscreen viewer is open, **When** the user clicks outside
    the image (on the backdrop), **Then** the viewer closes, same as clicking
    the "X" or pressing Escape.

**Edge Cases (both stories)**:

- If the user changes the selected image in the normal viewer and then opens
  fullscreen, the fullscreen viewer must start from that same selected
  image, not always from the primary/default image.
- Resizing the window (e.g., rotating the phone) while the fullscreen viewer
  is open must not close it nor lose the currently selected image.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gallery MUST display the main image at a contained size on
  desktop viewports, no longer scaling to near-fullscreen width/height.
- **FR-002**: The gallery's thumbnail column MUST be capped so it never grows
  taller than the main viewer (main image plus its container), on both
  desktop and mobile viewports.
- **FR-003**: When the thumbnail column's content exceeds its capped height,
  it MUST become internally scrollable, and MUST NOT display a visible
  scrollbar for that scroll.
- **FR-004**: When the thumbnail column's content fits within the capped
  height, no scrollbar or extra visual artifact MUST appear.
- **FR-005**: The main image MUST be clickable (and keyboard-activatable via
  Enter/Space when focused) to open a fullscreen viewer, except when no
  image is available (the "No cover image available" placeholder is shown),
  in which case no fullscreen viewer opens.
- **FR-006**: The fullscreen viewer MUST open showing the image that was
  currently selected in the normal (embedded) viewer at the moment of the
  click — not necessarily the primary/default image.
- **FR-007**: The fullscreen viewer MUST include the same selectable
  thumbnail strip as the normal viewer when the release has more than one
  image, allowing the user to switch the displayed image without leaving
  fullscreen mode.
- **FR-008**: The fullscreen viewer MUST NOT display a thumbnail strip when
  the release has only one image, matching the normal viewer's behavior.
- **FR-009**: The fullscreen viewer MUST provide an always-visible close
  control (an "X" icon/button) that closes it and returns to the detail page
  in its normal (non-fullscreen) state.
- **FR-010**: The fullscreen viewer MUST also close when the user presses
  the Escape key.
- **FR-011**: When the fullscreen viewer closes (by either mechanism), the
  normal viewer on the detail page MUST show whichever image was selected at
  that moment within fullscreen mode, without resetting to the first/primary
  image.
- **FR-012**: All behavior described in FR-001 through FR-011 MUST be
  identical across the three detail pages that use the shared gallery
  component (search results, master release, and personal library), since
  they render the same single component.
- **FR-013**: Resizing the viewport (including orientation change on
  mobile) while the fullscreen viewer is open MUST NOT close the viewer and
  MUST NOT change the currently selected image.
- **FR-014**: Clicking outside the image (on the backdrop) within the
  fullscreen viewer MUST also close it, in addition to the "X" control and
  the Escape key, consistent with the app's existing generic `Modal`
  behavior.

### Key Entities

- **Release images collection**: The ordered list of images belonging to a
  release (from the existing `release.images` / `master.images` data,
  unchanged by this feature), each with an image type (e.g., `primary`) used
  today to pick the default main image.
- **Selected image state**: The currently displayed main image within the
  gallery (normal or fullscreen), shared between the two viewer
  presentations so that switching between them preserves the selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On desktop viewports, the main image never occupies a
  disproportionate share of the screen — it stops reading as "almost the
  entire screen" as it does today.
- **SC-002**: The thumbnail column never exceeds the viewer's height, in
  100% of cases, regardless of how many images a release has.
- **SC-003**: The thumbnail column's internal scroll never shows a visible
  scrollbar.
- **SC-004**: 100% of detail pages (search results, master release, library)
  allow opening the fullscreen viewer by clicking the main image, except
  when no image is available.
- **SC-005**: The fullscreen viewer can always be closed both via the "X"
  and via Escape, in both cases returning to the detail page without losing
  the selected image.

## Assumptions

- The affected component is the single, already-shared
  `ReleaseImageGallery` (`frontend/src/components/ReleaseImageGallery.tsx`),
  used today in `ReleaseDetailPage`, `RecordDetailPage`, and
  `MasterReleaseDetailPage`. This feature corrects and extends that existing
  component rather than creating a new one from scratch.
- The exact contained size of the main image on desktop (max pixel value or
  viewport proportion) is a design decision to be finalized during the
  planning phase; this specification only requires that it stop occupying
  "almost the entire screen" as it does today.
- Within the fullscreen viewer, navigation between images happens via the
  same selectable thumbnail strip already used in the normal viewer (not
  arrows or swipe gestures as the primary mechanism).
- The fullscreen viewer may be built by reusing the existing generic `Modal`
  component (`frontend/src/components/ui/Modal.tsx`, which already closes on
  Escape and on backdrop click) or as a dedicated fullscreen container; the
  concrete mechanism is a planning-phase decision, since the current `Modal`
  wraps content in a padded, max-width `Card` rather than an edge-to-edge
  lightbox.
- No zoom or pan over the enlarged image is required — only viewing it
  larger, fullscreen, and switching between images.
