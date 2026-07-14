# Feature Specification: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

**Feature Branch**: `044-gallery-mobile-fix-desktop-two-column-reflow`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Tienes las especificaciones en el fichero @.hu/gallery-mobile-fix-desktop-two-column-reflow.md" — historia de usuario con dos incrementos sobre la galería de imágenes compartida (`ReleaseImageGallery`, usada en `ReleaseDetailPage`, `MasterReleaseDetailPage` y `RecordDetailPage`), independiente del visor a pantalla completa ya construido en la spec `043`: (1) corregir un bug por el que la galería no se contiene en proporción cuadrada en viewports móviles y crece en altura según el número de miniaturas; (2) reorganizar la zona superior de las tres fichas de detalle en dos columnas desde el breakpoint `lg` (1024px) — galería a la izquierda, información principal a la derecha — en vez de apilarse verticalmente hasta `xl`.

## Clarifications

### Session 2026-07-14

- Q: In the new two-column desktop layout, when the right column (primary information) is taller than the left column (gallery), how should the height mismatch be handled? → A: Top-align both columns; the shorter column (typically the gallery, since it's bounded to a square) leaves empty space below it, with no stretching to match the other column's height.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gallery stays contained and square on mobile (Priority: P1)

As a user opening any detail page (search result, master release, or my own
library) on my phone, I want the image gallery to keep a contained, square
proportion — the same behavior it already has on desktop — instead of
stretching taller as the thumbnail strip grows, so that I can see the rest
of the page's content without excessive scrolling.

**Why this priority**: This is a visible layout bug affecting every detail
page today, since the gallery component is shared across all three. It
degrades the mobile experience independently of any desktop-layout work, so
it delivers value on its own and should land first.

**Independent Test**: Open any of the three detail pages on a mobile
viewport (360–430px wide) for a release with 10+ images. The gallery
container must stay square (bounded by its own width) and the thumbnail
strip must scroll internally with a hidden scrollbar, without pushing the
gallery's total height taller.

**Acceptance Scenarios**:

1. **Given** any of the three detail pages on a mobile viewport
   (approx. 360–430px wide), **When** the release has multiple images,
   **Then** the gallery container keeps a square proportion (main image +
   thumbnail strip) and does not grow in height beyond what that proportion
   dictates.
2. **Given** a mobile viewport, **When** the release has more images than
   fit within the thumbnail strip's height (e.g., 10 or more), **Then** the
   strip does not push the gallery's total height down — it behaves the same
   as the containment behavior already required on desktop (spec `043`,
   User Story 1) — and the user scrolls internally within the thumbnail
   strip to see them all.
3. **Given** the thumbnail strip's internal scroll on mobile, **When** it is
   shown, **Then** its scrollbar is not visible (same hidden-scrollbar
   utility already used on desktop).
4. **Given** a release with few enough images that no scroll is needed,
   **When** the gallery renders on mobile, **Then** no scrollbar or extra
   visual artifact appears.
5. **Given** the corrected mobile gallery, **When** compared to its desktop
   behavior, **Then** the containment/proportion behavior is identical
   between the two — only the pixel size differs, not the behavior.
6. **Given** that the gallery component is shared, **When** this fix is
   applied, **Then** the result is identical across all three detail pages
   (search results, master release, my library).

---

### User Story 2 - Two-column reflow on desktop: gallery left, primary info right (Priority: P2)

As a user opening any detail page on desktop, I want the top section of the
page (gallery + primary information) to organize into two columns starting
at the same breakpoint where the rest of the detail page already switches to
two columns, with the gallery on the left and the primary information on the
right, so that I can take advantage of the space freed up by containing the
gallery's size and see more content without extra scrolling.

**Why this priority**: This depends on User Story 1 being fixed first (the
gallery must already be reliably contained before reflowing the surrounding
layout), and it is a visual/layout improvement rather than a bug fix, so it
follows the mobile correction in priority.

**Independent Test**: Open any of the three detail pages at a desktop
viewport width at or above 1024px (`lg`). The gallery must appear as the
left column and the page's primary information block as the right column,
side by side, with no intermediate single-column state between `lg` and
`xl`.

**Acceptance Scenarios**:

1. **Given** any of the three detail pages at a desktop viewport starting at
   the breakpoint where the rest of the page already switches to two columns
   (`lg`, 1024px — the same breakpoint the information+tracklist block uses
   today), **When** the page renders, **Then** the top section organizes
   into two columns: the image gallery on the left and the page's primary
   information on the right, instead of stacking vertically as it does today
   until `xl`.
2. **Given** the search results detail page (`ReleaseDetailPage`) at that
   same desktop range, **When** it renders, **Then** the right column
   contains the release data (`ReleaseDetailsSection`) and the "Add to
   library" button, aligned alongside the gallery.
3. **Given** the master release detail page (`MasterReleaseDetailPage`) at
   that same range, **When** it renders, **Then** the right column contains
   the master data (`MasterReleaseDetailsSection`), aligned alongside the
   gallery.
4. **Given** the my-library detail page (`RecordDetailPage`) at that same
   range, **When** it renders, **Then** the right column contains the
   release data (`ReleaseDetailsSection`) and the "My Copy" section
   (`MyCopySection`: rating, condition, notes, remove from library), aligned
   alongside the gallery.
5. **Given** the new two-column composition, **When** it renders, **Then**
   the rest of each page's sections (tracklist, additional information, the
   master's version table) keep their current behavior — they render at
   full width below the top section, with no functional changes.
6. **Given** a wide desktop viewport (`xl`, 1280px, and above), **When** any
   detail page renders, **Then** the visual result is consistent with the
   new two-column layout — there is no third, distinct layout state between
   `lg` and `xl` that breaks the composition already achieved at `lg`.
7. **Given** any of the three detail pages, **When** this new layout is
   compared to the existing two-column pattern already used by the primary
   information + tracklist block, **Then** both use the same breakpoint
   (`lg`) and the same "two columns from desktop, one column on mobile"
   criterion — the two stay visually consistent with each other.
8. **Given** a mobile viewport (below `lg`), **When** any detail page
   renders, **Then** there is no change from current behavior: the gallery
   still appears first, at full width, followed by the primary information,
   in a single column.
9. **Given** the new two-column desktop composition, **When** page width is
   checked, **Then** no horizontal scrolling occurs at any common desktop
   viewport (1024px and above).

---

### Edge Cases

- A release with no images (the "No cover image available" placeholder) must
  stay contained within its column/cell both on mobile and in the new
  desktop layout, without becoming disproportionate or misaligning the
  information column.
- Resizing the window across the mobile/desktop range (or crossing the `lg`
  breakpoint) must recompose the layout correctly without leaving visual
  artifacts or residual scroll.
- The my-library page (`RecordDetailPage`) has the most content in the right
  column (release data + "My Copy"), the tallest right-column content among
  the three pages. Both columns are top-aligned and neither stretches to
  match the other's height, so the gallery (the shorter column in this case)
  simply leaves empty space below it — the layout must confirm this reads as
  intentional whitespace, not as a broken or misaligned column.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The shared image gallery component MUST keep a square, contained
  proportion on mobile viewports, matching the containment behavior already
  required on desktop by spec `043` (User Story 1).
- **FR-002**: On mobile viewports, the thumbnail strip MUST scroll internally
  with a hidden scrollbar when it contains more thumbnails than fit in its
  available height, without increasing the gallery's overall height.
- **FR-003**: The gallery's mobile containment/scroll behavior MUST be
  identical in structure to its desktop behavior — same proportion rule and
  same hidden-scrollbar behavior — differing only in pixel dimensions.
- **FR-004**: The mobile containment fix MUST apply uniformly across all
  three detail pages that render the shared gallery component (search
  results, master release, my library).
- **FR-005**: Each detail page's top section (gallery + primary information)
  MUST switch from a single stacked column to a two-column layout — gallery
  left, primary information right — starting at the `lg` (1024px) breakpoint.
- **FR-006**: The two-column top-section layout MUST use the same breakpoint
  (`lg`) already used by each page's existing information+tracklist
  two-column block, so the whole page has one consistent breakpoint for
  switching to two columns.
- **FR-007**: On the search results detail page, the right column of the
  two-column top section MUST contain the release details section and the
  "Add to library" action.
- **FR-008**: On the master release detail page, the right column of the
  two-column top section MUST contain the master release details section.
- **FR-009**: On the my-library detail page, the right column of the
  two-column top section MUST contain the release details section and the
  "My Copy" section (rating, condition, notes, remove-from-library action).
- **FR-010**: Sections below the top section (tracklist, additional
  information, master version table) MUST remain full-width and functionally
  unchanged by this reflow.
- **FR-011**: The two-column top-section layout MUST NOT introduce an
  intermediate layout state between `lg` and `xl` that differs visually from
  the layout established at `lg`.
- **FR-011a**: The gallery column and the primary information column MUST be
  top-aligned in the two-column desktop layout; neither column MUST stretch
  to match the other's height when their content lengths differ.
- **FR-012**: Below the `lg` breakpoint, each detail page's top section MUST
  keep its current single-column behavior: gallery first, full width,
  followed by the primary information.
- **FR-013**: No detail page MAY produce horizontal scrolling at any common
  desktop viewport width (1024px and above) after the reflow.
- **FR-014**: The no-cover-image placeholder MUST remain visually contained
  within its column/cell in both the mobile layout and the new two-column
  desktop layout.
- **FR-015**: The fullscreen viewer (spec `043`, User Story 2) MUST continue
  to open and function identically under the new desktop layout and the
  corrected mobile layout, with no changes to its own behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 100% of common mobile viewports (360–430px wide), the
  gallery keeps its square proportion and never stretches in height due to
  the thumbnail strip, across all three detail pages.
- **SC-002**: Starting at 1024px width (`lg`), 100% of detail pages show the
  gallery and primary information side by side in two columns, with no
  distinct intermediate state before `xl`.
- **SC-003**: No detail page produces horizontal scrolling at any common
  desktop viewport (1024px and above) after the reflow.
- **SC-004**: Mobile behavior (below `lg`) is unchanged except for the
  gallery height fix: it remains a single column with the gallery appearing
  first.

## Assumptions

- The reference breakpoint for the desktop reflow is `lg` (1024px), the same
  breakpoint already used today by each page's internal information+tracklist
  block (`lg:grid-cols-2`), so the entire top-of-page area switches to two
  columns at a single, consistent breakpoint.
- The exact width proportions between the gallery column and the information
  column (e.g., 1/3–2/3, or 1/2–1/2) are a design decision to be finalized
  during planning; this specification only requires that they render as two
  explicit columns from `lg`, gallery left and information right.
- The desktop reflow (User Story 2) applies to all three detail pages —
  search results, master release, and my library — not only
  release/master.
- The mobile bug (User Story 1) does not require new design decisions: it is
  a correction so that all viewports satisfy the same containment behavior
  that spec `043` (User Story 1) already requires. Investigation during
  planning confirmed the actual defect is engine-specific — a WebKit/Safari
  rendering bug in how `aspect-ratio` interacts with a scrollable flex
  child — not breakpoint-specific: it reproduces at any viewport width,
  including desktop, once a release has more than 4 images. The fix is
  applied unconditionally across all breakpoints for this reason, which is
  a superset of, not a conflict with, this story's mobile-focused
  acceptance criteria.
- The fullscreen viewer (spec `043`, User Story 2) is unaffected by either
  story in this feature; it continues to open the same way on click of the
  main image, under either layout.

## Out of Scope

- Changes to the fullscreen viewer (`GalleryFullscreenViewer`) beyond
  continuing to work correctly under the new desktop layout.
- Changes to existing business logic, data, or actions on any of the three
  detail pages (rating, editing condition, adding/removing from library,
  master version pagination, etc.).
- Introducing a device-detection mechanism; the layout switch continues to
  rely exclusively on Tailwind CSS breakpoints.
- Changes to the gallery's internal visual pattern (square main image,
  thumbnails with a selection ring, etc.), beyond what is necessary to fix
  the mobile height containment.
