# Feature Specification: Vinyl Library CRUD

**Feature Branch**: `003-vinyl-library-crud`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Desarrolla lo necesario en backend y frontend para que los usuarios dispongan de CRUD para poder gestionar los discos de sus bibliotecas. La manera de crear una nueva entrada debe ser a través de un buscador que utilice lo desarrollado de la api para discogs. Almacena en firebase lo esencial para persistir la biblioteca del usuario teniendo en cuenta que no es necesario persistir información que pueda ser obtenida de discogs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a record to my library by searching Discogs (Priority: P1)

A signed-in collector searches the Discogs catalog by title or artist,
picks the matching record from the results, and adds it to their personal
library.

**Why this priority**: This is the only way records get into a library —
without it, nothing else in this feature has anything to operate on.

**Independent Test**: Sign in, search for a well-known release, select it,
and confirm it now appears in the collector's library.

**Acceptance Scenarios**:

1. **Given** a signed-in collector, **When** they search for a release or
   artist by name, **Then** they see matching Discogs catalog results to
   choose from.
2. **Given** search results are shown, **When** the collector selects one,
   **Then** that record is added to their personal library and they can
   confirm it's there.
3. **Given** a search with no matches, **When** the collector searches,
   **Then** they see a clear "no results" state, not an error.

---

### User Story 2 - View my library (Priority: P1)

A signed-in collector opens their library and sees every record they've
added, with enough information (title, artist, cover) to recognize each
one.

**Why this priority**: Being able to see what's in your library is the
other half of the minimum useful loop — add a record, then see it's there.

**Independent Test**: Sign in as a collector with existing library entries
and confirm all of them are listed with recognizable information.

**Acceptance Scenarios**:

1. **Given** a collector with records in their library, **When** they open
   their library, **Then** they see all of their records listed.
2. **Given** a collector with an empty library, **When** they open their
   library, **Then** they see a clear empty state, not an error or a blank
   screen.
3. **Given** a collector's library, **When** they view it, **Then** they
   only ever see their own records, never another collector's.

---

### User Story 3 - View a single record's full detail (Priority: P2)

A signed-in collector opens one record from their library and sees its
full catalog information (artist, label, tracklist, cover art, etc.)
together with their own personal information about that copy (condition,
notes, date added).

**Why this priority**: Valuable for confirming details about a specific
copy, but the collector can already recognize and manage records from the
list view (User Story 2) without it.

**Independent Test**: From a library with at least one record, open that
record and confirm both its full catalog detail and the collector's
personal information are shown together.

**Acceptance Scenarios**:

1. **Given** a record in the collector's library, **When** they open it,
   **Then** they see its full Discogs catalog detail plus their own
   condition/notes for that copy.
2. **Given** a record whose Discogs catalog data can't be fetched right
   now, **When** the collector opens it, **Then** they still see their own
   personal information, with a clear "couldn't load catalog details"
   state instead of a broken page.

---

### User Story 4 - Remove a record from my library (Priority: P2)

A signed-in collector removes a record they no longer want tracked in
their library (e.g., sold or given away).

**Why this priority**: Keeping a library accurate matters, but it's
secondary to being able to add and view records in the first place.

**Independent Test**: From a library with at least one record, remove it
and confirm it no longer appears in the library afterward.

**Acceptance Scenarios**:

1. **Given** a record in the collector's library, **When** they choose to
   remove it, **Then** they're asked to confirm before it's permanently
   removed.
2. **Given** the collector confirms removal, **When** they view their
   library again, **Then** that record is no longer listed.
3. **Given** a collector attempts to remove a record that isn't theirs
   (not in their own library), **When** the removal is attempted, **Then**
   it is denied.

---

### User Story 5 - Update my personal notes on a record (Priority: P3)

A signed-in collector updates the condition and/or personal notes they've
recorded for a record they own.

**Why this priority**: A useful refinement for keeping records accurate
over time, but the library is already fully usable (add, view, remove)
without it.

**Independent Test**: From a library with at least one record, change its
condition/notes and confirm the update is reflected when viewing that
record again.

**Acceptance Scenarios**:

1. **Given** a record in the collector's library, **When** they update its
   condition or notes, **Then** viewing that record afterward shows the
   updated information.
2. **Given** a collector attempts to update a record that isn't theirs,
   **When** the update is attempted, **Then** it is denied.

---

### Edge Cases

- What happens when a collector tries to add a record while Discogs is
  temporarily unavailable? The add flow MUST fail clearly with a retry
  option rather than adding an incomplete or broken entry.
- What happens when a collector adds a release they already have in their
  library? MUST be allowed — collectors legitimately own duplicate
  physical copies (e.g., a backup copy or one bought for trade).
- How does the system handle a record whose Discogs catalog data becomes
  temporarily unreachable while browsing the library list? That single
  record MUST degrade gracefully (e.g., a placeholder with the collector's
  own notes still visible) without breaking the rest of the list.
- What happens when a collector with a large library (hundreds of records)
  opens it? The library view MUST remain usable (see Success Criteria) —
  reasonable loading/pagination behavior is expected rather than fetching
  everything from Discogs at once.
- What happens if a collector tries to view, edit, or remove a library
  entry belonging to another collector (e.g., by guessing an identifier)?
  MUST be denied, consistent with every library being private to its
  owner.
- What happens when a collector double-submits a removal (e.g., clicks
  delete twice quickly)? The second attempt MUST be handled gracefully
  (e.g., "already removed") rather than causing an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in collector add a record to
  their personal library by searching the Discogs catalog and selecting a
  matching result.
- **FR-002**: The system MUST let a signed-in collector view the full list
  of records in their own personal library.
- **FR-003**: The system MUST let a signed-in collector view the full
  detail of a single record in their library, combining their own
  personal information with that release's live Discogs catalog data.
- **FR-004**: The system MUST let a signed-in collector remove a record
  from their library, with confirmation required before permanent removal.
- **FR-005**: The system MUST let a signed-in collector update the
  personal information (condition, notes) they've recorded for a record in
  their library.
- **FR-006**: The system MUST scope every library operation (add, view,
  update, remove) to the authenticated collector's own library; a
  collector MUST NOT be able to view, modify, or remove another
  collector's library entries.
- **FR-007**: The system MUST persist only collector-specific information
  for each library entry — a reference to the Discogs release, when it was
  added, and any personal condition/notes — and MUST NOT duplicate catalog
  information (title, artist, tracklist, images, genres, etc.) that
  Discogs already provides.
- **FR-008**: The system MUST allow a collector to add the same Discogs
  release to their library more than once, to represent owning multiple
  physical copies.
- **FR-009**: When a library entry's Discogs catalog data cannot be
  retrieved (temporarily unavailable), the system MUST still show the
  entry with its personal information and a clear "couldn't load catalog
  details" state, rather than hiding the entry or failing the whole
  library view.
- **FR-010**: The system MUST only allow adding a library entry for a
  release that genuinely exists in the Discogs catalog (via the search
  and selection flow) — there is no way to add a record that isn't backed
  by a real Discogs release.

### Key Entities

- **Library Entry**: Represents one physical copy of a record that belongs
  to a specific collector's personal library. Key attributes: which
  collector it belongs to, a reference to its Discogs release, the date it
  was added, and optional personal condition/notes for that copy.
  Deliberately does not include any catalog information already available
  from Discogs (title, artist, label, tracklist, images, genres, etc.) —
  that is fetched live when a Library Entry is displayed, per FR-007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A collector can find and add a real record to their library
  in under 30 seconds under normal conditions (search, pick, confirm).
- **SC-002**: A collector's library list, for a typical personal collection
  (up to a few hundred records), loads within a few seconds under normal
  network conditions.
- **SC-003**: 100% of a collector's library entries remain visible with
  their personal information intact even when Discogs' catalog data can't
  be fetched for some of them at that moment.
- **SC-004**: 100% of attempts to view, edit, or remove another collector's
  library entries are denied.
- **SC-005**: 100% of successful removals result in the record no longer
  appearing in the collector's library afterward.

## Assumptions

- "Manage" (CRUD) means: add (create), view the list and view a single
  record's detail (read), edit personal condition/notes (update), and
  remove (delete). Additional organization features (folders, tags,
  wantlist-vs-owned distinction, valuation/pricing) are out of scope for
  this version.
- Adding a record always goes through Discogs search and selection, per
  the request — there is no manual/free-form entry path that bypasses
  Discogs, consistent with the constitution's requirement that vinyl data
  come from Discogs.
- "Condition" uses the record-collecting industry's standard grading terms
  (e.g., Mint, Near Mint, Very Good Plus, Good, Fair, Poor) as a reasonable
  default set of options; this value is the collector's own record of
  their physical copy's condition, not something Discogs provides.
- Every library entry belongs to exactly one collector (the one who added
  it). Libraries are private and not shared or visible between
  collectors in this version, consistent with feature 001's multi-user
  model.
- Caching Discogs data in Firebase for performance (permitted by the
  constitution) is not required for this version; library entries are
  enriched by fetching live Discogs data when displayed, per the request
  not to persist Discogs-obtainable data. Revisit if real-world library
  sizes make this too slow.
