# Feature Specification: Record Detail View Aligned with Preview Layout

**Feature Branch**: `014-record-detail-preview-layout`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Para el siguiente desarrollo quiero construir la vista de detalle de un disco con el mismo diseño que la vista de previsualización para mantener la coherencia dentro de la app. El único matiz es que en la columna de la izquierda, debajo de la información relevante, colocaremos la información del usuario sobre cada disco."

## Clarifications

### Session 2026-07-05

- Q: The preview modal wraps its whole content in one bordered surface with plain, unbordered inner sections; the detail page today wraps each block in its own separate bordered surface. How should the redesign reconcile this with the app's existing design convention that primary content blocks are presented as bordered surfaces? → A: Wrap the entire detail content area in a single outer bordered surface (mirroring the preview modal's container), with the gallery, key details, my copy, tracklist, and remaining information all rendered as plain, unbordered sections inside it — including my copy, which does not get its own separate inner border either.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize the detail view as the same design language as the preview (Priority: P1)

A collector who has already used the record preview (opened while searching for a release to add) navigates to a record's full detail page and immediately recognizes the same visual structure: a full-width square cover gallery with browsable thumbnails, key release details and tracklist arranged below it, and any remaining catalog information after that — instead of a differently organized screen that feels like a separate part of the app.

**Why this priority**: This is the core ask — visual and structural consistency between the two screens that show the same underlying release data. Without this, the rest of the redesign has no foundation, since every other story builds on the shared layout.

**Independent Test**: Open the preview for a release from the "add a record" search flow, then open that same release's detail page from the library once added. Confirm both present the cover gallery, key details, tracklist, and remaining catalog information in the same relative arrangement and visual style.

**Acceptance Scenarios**:

1. **Given** a record with multiple catalog images, **When** the collector opens its detail page, **Then** the gallery spans the full width of the page content, shows the main image in a square aspect ratio, and offers a browsable thumbnail strip alongside it, matching the preview's gallery.
2. **Given** a record with title, artist(s), genres, styles, release date, and label, **When** the collector opens the detail page on a wide viewport, **Then** the key details appear in the left column and the tracklist appears in the right column, directly below the gallery, matching the preview's arrangement.
3. **Given** a record with notes, identifiers, or community statistics available, **When** the collector opens the detail page, **Then** that information appears as its own section below the two columns, matching the preview's remaining-information section.
4. **Given** the same record open in both the preview and the detail page, **When** the collector compares spacing, typography, and surface styling, **Then** both screens are visually consistent with each other.

---

### User Story 2 - Find my copy's condition and notes right below the key details (Priority: P1)

A collector viewing a record's detail page wants to check or update their own copy's condition and notes without losing the layout consistency delivered by User Story 1 — that information should sit directly beneath the key release details in the left column, since it's the collector's own annotation on the same information they just read.

**Why this priority**: This is the one deliberate deviation from an exact copy of the preview layout, explicitly called out by the requester as necessary for the detail page (the preview has no personal-copy data to show). It has to ship together with User Story 1 for the page to make sense — key details and the collector's own notes about that same release are read together.

**Independent Test**: Open a record's detail page on a wide viewport. Confirm the left column shows key release details first, immediately followed by the collector's own condition and notes for that copy, rendered as a plain section (no separate border of its own) within the page's shared content container, both still editable in place exactly as before this change.

**Acceptance Scenarios**:

1. **Given** the detail page is displayed on a wide viewport, **When** the collector looks at the left column, **Then** they see the key release details first and their own copy's condition and notes directly below it, with the tracklist in the separate right column.
2. **Given** the collector clicks or taps the condition value, **When** it becomes editable, **Then** the existing inline-edit behavior (fixed options, autosave on confirm, Escape to cancel, transient save confirmation, editable-field affordance) continues to work exactly as it did before this redesign.
3. **Given** the collector clicks or taps the notes value, **When** it becomes editable, **Then** the existing inline-edit behavior (free text, autosave on confirm, Escape to cancel, transient save confirmation, editable-field affordance) continues to work exactly as it did before this redesign.
4. **Given** the "remove from library" action available on today's detail page, **When** the redesigned page is displayed, **Then** that action is still present and functions the same way.

---

### User Story 3 - Consistent reading order on mobile (Priority: P2)

A collector browsing on a phone opens a record's detail page and reads it top to bottom in an order that mirrors the preview's mobile order, with the addition of their own copy's details appearing right after the key details, before the tracklist.

**Why this priority**: Mobile is a primary usage context for this app, and the preview redesign already established a specific mobile reading order; extending that same order (with the copy details inserted in their logical place) keeps the two screens coherent on the device type where most browsing happens. It depends on Stories 1 and 2 being in place first.

**Independent Test**: Open the detail page on a narrow (mobile-width) viewport for a record with full data. Confirm the sections stack vertically in this order: gallery, key details, my copy, tracklist, remaining release information.

**Acceptance Scenarios**:

1. **Given** the detail page is viewed on a narrow viewport, **When** it renders, **Then** the sections stack in this order top to bottom: gallery, key details, my copy (condition and notes), tracklist, remaining release information.
2. **Given** the viewport is resized from wide to narrow (or vice versa) while the detail page is open, **When** the resize crosses the layout breakpoint, **Then** the content reflows into the correct order and column arrangement for the new viewport size without loss of information, editability, or duplicated sections.

---

### User Story 4 - Graceful handling of missing or unavailable catalog data (Priority: P3)

A collector opens the detail page for a record whose catalog details can't be loaded, or whose release data is missing some optional fields, and still sees a coherent page: whatever is available renders in the new layout, and my copy's condition/notes (which don't depend on catalog data) remain visible and editable regardless.

**Why this priority**: This preserves an existing safety net (the page already has to handle catalog-unavailable records today); it's lower priority than the main layout change because it's about not regressing an edge case rather than delivering new value.

**Independent Test**: Open the detail page for a library entry whose catalog status is unavailable. Confirm the page shows an explanatory message in place of the catalog-dependent sections while still showing my copy's condition and notes, editable as usual.

**Acceptance Scenarios**:

1. **Given** a library entry whose catalog details are unavailable, **When** the collector opens its detail page, **Then** a clear message explains the catalog data couldn't be loaded, and the my-copy section (condition and notes) still renders and remains editable.
2. **Given** a record missing optional key-detail fields (e.g., no label or no styles) or with no tracklist, **When** the collector opens the detail page, **Then** the layout omits the missing pieces gracefully without leaving obvious empty gaps or broken sections.

---

### Edge Cases

- What happens when a record has only one catalog image, or none at all? The gallery must behave the same way it does in the preview (single full-width square image, or a clear placeholder), without an empty or broken thumbnail strip.
- What happens when a record has a very long tracklist or long notes/identifiers text? The page must grow and scroll as a normal page, without breaking the two-column arrangement or clipping content.
- What happens when the collector is mid-edit on condition or notes and resizes the viewport across the layout breakpoint? The field being edited must not lose its in-progress value or interrupt the edit.
- What happens when a record has none of the "key details" fields beyond title and artist? The key details area degrades to just title and artist, and my copy still appears directly below it.
- What happens when the record has no notes, identifiers, or community statistics at all? The remaining-information section is omitted entirely rather than shown empty.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The detail page MUST display the release's cover gallery (main image plus browsable thumbnail strip) using the same full-width, square-aspect presentation as the release preview.
- **FR-002**: On wide layouts, the detail page MUST arrange, directly below the gallery, a left column containing the key release details (title, artist(s), format, genres, styles, release date, label) followed immediately by the collector's own copy details (condition and notes), and a right column containing the full tracklist — matching the preview's two-column arrangement with the addition of the copy details and the format field.
- **FR-003**: On wide layouts, the detail page MUST display the remaining release information (notes, identifiers, community statistics) below the two columns, spanning the full width, matching the preview's remaining-information section.
- **FR-004**: On narrow (mobile-width) layouts, the detail page MUST stack all sections in a single column in this exact order: gallery, key release details, my copy (condition and notes), tracklist, remaining release information.
- **FR-005**: The my-copy section's existing inline-editing behavior — click/tap to edit, fixed condition options, free-text notes, autosave on confirm, Escape to cancel, transient save confirmation, and hover/permanent editable-field affordance — MUST continue to work unchanged in its new position.
- **FR-006**: The detail page's existing "remove from library" action MUST remain available and continue to function unchanged.
- **FR-007**: The detail page MUST omit any section or field for which the underlying data is absent, without leaving visible empty placeholders, consistent with the preview's behavior.
- **FR-008**: When the release's catalog details are unavailable, the detail page MUST show an explanatory message in place of the catalog-dependent sections while still rendering the my-copy section, editable as usual.
- **FR-009**: The detail page's visual styling (spacing, surfaces, typography, color usage, gallery/thumbnail behavior, and the single-outer-surface structure per FR-011) MUST be visually consistent with the release preview's styling.
- **FR-010**: The switch between the stacked (mobile) and two-column (wide) arrangements MUST be driven by available viewport width and MUST transition without loss of information, editability, or duplicated sections.
- **FR-011**: The detail page MUST wrap its gallery, key details, my copy, tracklist, and remaining-information sections in a single shared outer bordered surface (matching the preview modal's own container treatment), with none of those sections — including my copy — rendered inside their own separate, independent border.

### Key Entities

- **Record Detail View**: The full-page, navigable view of a single library entry, composed of a cover gallery, key release details, the collector's own copy details, a tracklist, and remaining release information.
- **Release (catalog data)**: The read-only, catalog-sourced information about a vinyl release — title, artist(s), genres, styles, release date, label(s), cover images, tracklist, notes, identifiers, and community statistics. Shared with the release preview.
- **My Copy (personal collection entry)**: The collector's own record of owning a specific release — condition (fixed set of grading options) and notes (free text), both editable in place. Unique to the detail page; not shown in the preview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A collector who has used the release preview can correctly anticipate the detail page's layout (gallery, then key details/tracklist, then remaining information) without guidance, on first visit after this change.
- **SC-002**: On wide viewports, a collector can locate their own copy's condition and notes directly below the key release details, within the left column, in 100% of visits.
- **SC-003**: On narrow viewports, 100% of detail-page sections appear in the specified order (gallery, key details, my copy, tracklist, remaining information) across representative data variations (complete data, missing optional fields, no images, no tracklist, catalog-unavailable entries).
- **SC-004**: 100% of existing inline-edit behaviors for condition and notes (autosave, Escape-to-cancel, save confirmation, editable affordance) continue to pass their existing acceptance checks after the redesign.
- **SC-005**: No previously visible piece of information on the detail page (title, artist, year/date, format, genre, label, tracklist, my copy's condition/notes) is lost or hidden as a result of the redesign.

## Assumptions

- "La misma información relevante" (key release details) is the set already defined for the preview redesign — title, artist(s), genres, styles, release date, and label(s) — plus the format field the detail page already shows today (e.g., "Vinyl", "12\""), which the preview's field set omits. Format is kept so this redesign introduces no information loss (per SC-005): it is added to the shared key-details presentation rather than dropped, so both the preview and the detail page gain it.
- "La información del usuario sobre cada disco" (the user's information about each disc) refers to the existing "my copy" data already supported by the app: condition and notes, with their existing inline-edit interaction (from the prior record-detail redesign) — no new personal fields are introduced by this feature.
- Adopting the preview's layout for the detail page also means adopting the preview's remaining-information section (notes, identifiers, community statistics), which the detail page does not currently show; this is treated as part of "the same design" rather than out of scope, since the requester asked for the same layout for coherence across the app.
- The detail page is a full page reached by navigation (not a modal), so it keeps the browser's normal page-level scrolling; only the gallery's internal thumbnail strip needs to avoid a visible scrollbar, matching how that component already behaves in the preview. The page as a whole is not required to hide its own scrollbar the way the preview modal does.
- The stacked-vs-two-column breakpoint reuses the same breakpoint convention already used by the release preview, so the two screens change layout at consistent viewport widths.
- This feature is a presentation-layer change: it reuses the release preview's existing gallery, key-details, tracklist, and remaining-information presentation together with the detail page's existing my-copy editing behavior; no new data fields, APIs, or catalog information are introduced.
- The detail page's existing top-level navigation affordance (a link back to the library) is unchanged by this redesign.
