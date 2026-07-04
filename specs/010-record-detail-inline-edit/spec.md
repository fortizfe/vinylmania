# Feature Specification: Record Detail View Redesign with Inline Editing

**Feature Branch**: `010-record-detail-inline-edit`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Quiero mejorar la vista de detalle de un disco de mi colección.
LAYOUT: La vista debe organizarse en cuatro bloques: imagen de cabecera del disco,
información del disco, tracklist, y detalles de mi copia personal. En móvil los cuatro
bloques se apilan en una columna (imagen, información, mi copia, tracklist). En
tablet/escritorio pasa a dos columnas: imagen arriba a todo el ancho, columna izquierda
con información + mi copia, columna derecha con tracklist. El cambio de layout debe ser
fluido según el espacio disponible, no solo por tipo de dispositivo. INFORMACIÓN DEL
DISCO (solo lectura): título, artista, año, formato, género. TRACKLIST (solo lectura):
lista de pistas, sin interacción. DETALLES DE MI COPIA (editable): condición y notas,
rediseñado para edición inline sobre la propia tarjeta sin botón "Editar" ni modal;
autoguardado al perder foco/confirmar; indicador de que el campo es editable (hover en
escritorio, estilo permanente en móvil); confirmación visual tras guardar; Escape cancela
sin guardar; condición es un valor de un conjunto cerrado, notas es texto libre. Fuera de
alcance: edición inline de información del disco; interacción en tracklist más allá de
mostrarla."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit my copy's condition and notes without leaving the page (Priority: P1)

A collector viewing one of their records wants to update how they'd grade its condition,
or jot down a note about it (e.g., a scratch, where they bought it), without hunting for
an "Edit" button or being taken to a separate editing mode.

**Why this priority**: This is the explicit usability problem the request calls out —
the current edit flow ("Edit" button → separate form → "Save"/"Cancel") is described as
"poco usable" and is the main reason to redesign this screen. It delivers value on its
own, independent of the layout or read-only info work.

**Independent Test**: Can be fully tested by opening a record's detail view, interacting
with the condition field and the notes field directly (without pressing any "Edit"
button), confirming each change autosaves, and confirming Escape reverts an in-progress
edit.

**Acceptance Scenarios**:

1. **Given** a record's detail view showing "Your copy" in read mode, **When** the
   collector clicks (desktop) or taps (mobile) the condition value, **Then** it turns
   into an editable control, in place, showing the current value.
2. **Given** the condition field is now editable, **When** the collector picks a
   different condition and the field loses focus (desktop) or they confirm on the mobile
   keyboard / tap outside the field (mobile), **Then** the new value is saved
   automatically and the field returns to read mode showing the new value.
3. **Given** a field was just saved successfully, **When** the save completes, **Then**
   a brief visual confirmation appears (e.g., a transient checkmark or highlight) and
   then fades, without requiring any user action to dismiss it.
4. **Given** the collector is editing the notes field, **When** they press Escape
   (desktop), **Then** the field discards the in-progress edit, reverts to the
   previously saved value, and returns to read mode without saving anything.
5. **Given** the "Your copy" section is in read mode, **When** the collector hovers a
   field with a mouse (desktop), **Then** a subtle visual cue indicates the field can be
   edited; on a touch device, that same affordance is shown permanently (since hover
   doesn't exist), so the collector knows before tapping that the field is editable.
6. **Given** the condition field, **When** the collector opens it for editing, **Then**
   they are shown a fixed set of valid condition options to choose from (not free text).
7. **Given** the notes field, **When** the collector opens it for editing, **Then** they
   can enter or edit free-form text.

---

### User Story 2 - View a record's details in a layout that adapts to available space (Priority: P1)

A collector opens a record's detail view on their phone while browsing their shelf, and
later checks the same record on a tablet or desktop screen. In both cases the content
(cover image, disc information, tracklist, and their own copy's details) should be
organized so the most relevant information is easy to scan for the screen size in use,
and the transition between arrangements should feel smooth as the window is resized
rather than only at fixed device breakpoints.

**Why this priority**: The layout restructuring (four blocks, stacked vs. two-column)
is called out as a first-class requirement alongside the inline-editing redesign, and
without it the "Your copy" and disc-information blocks remain in a single unstructured
column with no cover image at all, which is also part of what makes the current screen
feel unfinished.

**Independent Test**: Can be fully tested by opening a record's detail view at a narrow
viewport width and confirming the four blocks stack in the specified order, then
progressively widening the viewport and confirming the layout transitions to two columns
at some point, with the header image spanning full width above both columns.

**Acceptance Scenarios**:

1. **Given** a narrow viewport (e.g., a phone), **When** the collector opens a record's
   detail view, **Then** the four blocks appear stacked in a single column in this
   order: header image, disc information, my copy details, tracklist.
2. **Given** a wide viewport (e.g., a tablet or desktop window), **When** the collector
   opens the same detail view, **Then** the header image spans the full width at the
   top, and below it two columns appear: the left column contains disc information
   followed by my copy details, and the right column contains the full tracklist.
3. **Given** the detail view is open on a resizable window, **When** the collector
   gradually resizes the window across the point where the layout changes, **Then** the
   transition between the stacked and two-column arrangements happens smoothly based on
   the available width at that moment, not only when crossing a specific device-type
   detection.
4. **Given** either layout, **When** the tracklist is long, **Then** it remains fully
   readable (scrolling with the page) without breaking the surrounding layout.

---

### User Story 3 - View read-only disc information at a glance (Priority: P2)

A collector wants to see the key facts about a disc — its title, artist(s), release
year, format, and genre — without having to look them up elsewhere, so they can quickly
confirm they're looking at the right item in their collection.

**Why this priority**: This is read-only, additive information display; it improves the
detail view but the screen remains usable (and the higher-priority inline-editing and
layout work still deliver value) even if this story were the last one implemented,
since some of these fields (title, artist) are already shown today.

**Independent Test**: Can be fully tested by opening a record's detail view and
confirming the disc-information block shows title, artist(s), year, format, and genre
whenever that data is available, without any interactive controls in that block.

**Acceptance Scenarios**:

1. **Given** a record with complete catalog data, **When** the collector views the disc
   information block, **Then** they see the title, artist(s), release year, format, and
   genre, all as plain read-only text/labels.
2. **Given** a record missing one of these fields in its catalog data (e.g., no year on
   file), **When** the collector views the disc information block, **Then** that field
   is simply omitted rather than shown as broken or as an error.
3. **Given** a record credited to multiple artists, **When** the collector views the
   disc information block, **Then** all credited artists are shown.
4. **Given** a record available in more than one format descriptor or tagged with more
   than one genre, **When** the collector views the disc information block, **Then** all
   of them are shown together for that field (not just the first one).

### Edge Cases

- What happens when the collector rapidly edits and confirms the same field multiple
  times in quick succession? The field MUST always end up reflecting the last confirmed
  value, and MUST NOT show a stale confirmation for a value that was since superseded.
- What happens if saving a field's new value fails (e.g., the collector loses
  connectivity mid-edit)? The field MUST show a brief, unobtrusive error indication and
  MUST retain the collector's entered value so they can retry, rather than silently
  discarding their edit or silently pretending it saved.
- What happens when the collector taps a field on mobile and then taps a different
  field before confirming the first one? The first field MUST behave as if it lost
  focus (attempt to save/confirm its current value) before the second field becomes
  editable, so at most one field is being edited at a time.
- What happens when a record has no cover image available? The header image block MUST
  show a clear placeholder rather than a broken image or an empty gap.
- What happens when the tracklist is empty (no tracks on file)? The tracklist block
  MUST indicate there is no tracklist available rather than showing an empty list with
  no explanation.
- What happens when the collector's copy has no condition or notes recorded yet? Each
  field MUST show a clear empty/placeholder state in read mode (e.g., "Add a condition")
  that is still recognizable as an editable field, per User Story 1's affordance
  requirement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The detail view MUST present exactly four content blocks: header image,
  disc information, tracklist, and my copy details.
- **FR-002**: At narrow viewport widths, the four blocks MUST stack in a single column
  in this order: header image, disc information, my copy details, tracklist.
- **FR-003**: At sufficiently wide viewport widths, the layout MUST switch to: header
  image full-width at the top; a left column with disc information followed by my copy
  details; a right column with the full tracklist.
- **FR-004**: The switch between the stacked and two-column arrangements MUST be driven
  by available horizontal space, MUST NOT be determined by device-type detection alone,
  and MUST transition smoothly as that space changes.
- **FR-005**: The disc information block MUST show, when available: title, artist(s),
  release year, format, and genre. A field with no data MUST be omitted rather than
  shown empty or as an error.
- **FR-006**: The disc information block MUST be read-only — it MUST NOT offer any
  inline editing, buttons, or controls in this iteration.
- **FR-007**: The tracklist block MUST list the disc's tracks in order, read-only, with
  no editing, playback, or favoriting controls in this iteration.
- **FR-008**: The my-copy block MUST show condition and notes as plain text/labels when
  not being edited.
- **FR-009**: Interacting with the condition value (click on pointer devices, tap on
  touch devices) MUST turn that field, in place, into an editable control offering a
  fixed set of valid condition options — MUST NOT open a modal, a separate edit mode
  for the whole block, or navigate to another screen.
- **FR-010**: Interacting with the notes value MUST turn that field, in place, into an
  editable free-text control — MUST NOT open a modal, a separate edit mode for the whole
  block, or navigate to another screen.
- **FR-011**: Confirming an edit (losing focus on pointer devices; tapping outside the
  field or confirming via the on-screen keyboard on touch devices) MUST save the new
  value automatically, with no explicit "Save" button required.
- **FR-012**: After a field's value is saved, the view MUST show a brief, self-dismissing
  visual confirmation that the save succeeded.
- **FR-013**: Cancelling an in-progress edit (Escape key on desktop) MUST discard the
  change and restore the field's previously saved value, without persisting anything.
- **FR-014**: In read mode, each editable field in the my-copy block MUST convey that it
  is editable before interaction: via a hover-triggered visual cue on pointer devices,
  and via a permanent, always-visible visual treatment on touch devices (since hover has
  no touch equivalent).
- **FR-015**: The my-copy block MUST NOT require an "Edit" button, a modal, or a
  separate edit screen/route at any point in the interaction.
- **FR-016**: If a field is left editable and a save attempt fails, the view MUST
  indicate the failure without discarding the collector's entered value, per the Edge
  Cases above.
- **FR-017**: Only one field in the my-copy block MAY be in edit mode at a time; starting
  to edit a different field MUST first resolve (confirm or cancel) any field currently
  being edited.

### Key Entities

- **Disc (catalog release)**: The read-only, catalog-sourced information about a vinyl
  release — title, artist(s), release year, format(s), genre(s), cover image, and
  tracklist (ordered list of tracks). Shared across every collector who owns a copy of
  the same release.
- **My copy (personal collection entry)**: The collector's own record of owning a
  specific disc — currently holds condition (one value from a fixed, closed set of
  grading options) and notes (free text). Belongs to one collector and references one
  disc.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A collector can update their copy's condition or notes in 2 interactions
  or fewer (e.g., tap field, type/select, confirm) — down from the current 4-step
  flow (open edit mode, change value, press Save, and implicitly leave edit mode).
- **SC-002**: 100% of edits to condition or notes are saved without the collector ever
  seeing or needing to press a "Save" button.
- **SC-003**: On both a narrow (phone-sized) and a wide (desktop-sized) viewport, a
  collector can identify the disc's title, artist, year, format, genre, tracklist, and
  their own copy's condition and notes within a single screen's scroll, in the block
  order specified for that viewport.
- **SC-004**: When resizing a window across the layout's transition point, no content
  block visibly jumps, overlaps, or becomes unreadable at any intermediate width.
- **SC-005**: A collector who accidentally starts editing a field and presses Escape
  sees their original value preserved, with zero data loss, 100% of the time.

## Assumptions

- The vinyl detail view already exists as a screen in the application (currently a
  single-column layout without a cover image and with a separate Edit/Save/Cancel flow
  for condition and notes); this feature redesigns that existing screen rather than
  introducing a new one.
- Title, artist(s), release year, and tracklist are already available as catalog data
  for a disc; format and genre are also already available as catalog data (each as a
  list, since a release can have more than one format descriptor or genre tag) — this
  feature is about surfacing and laying out existing catalog data, not sourcing new
  data.
- "Format" refers to the physical/media format descriptor(s) of the release (e.g.,
  "Vinyl", "12\"", "LP"), and "genre" refers to the release's genre tag(s) (e.g.,
  "Electronic", "Rock") — both already exist as catalog-sourced classification data
  rather than being derived or guessed by this feature.
- The closed set of condition options is the standard record-grading scale already in
  use elsewhere in the app (e.g., Mint, Near Mint, Very Good Plus, Good, Fair, Poor);
  this feature does not change what those options are, only how the field is edited.
- The layout's stacked-vs-two-column transition point is a reasonable "tablet-sized"
  width consistent with the app's existing responsive conventions, rather than a
  value requiring product sign-off.
- A failed autosave is communicated with a lightweight inline indicator (not a blocking
  dialog), and the collector can simply retry the same field; no offline queueing or
  background retry mechanism is required in this iteration.
- Removing a copy from the collection and any other existing detail-view actions not
  mentioned in this request (e.g., a "remove from library" action) continue to exist
  but are unchanged by this feature.
- Inline editing of disc information fields, and any tracklist interaction beyond
  display (playback, favoriting, editing), are explicitly out of scope for this
  iteration, as stated in the request.
