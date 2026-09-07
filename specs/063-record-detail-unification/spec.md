# Feature Specification: Unified Record Detail Views

**Feature Branch**: `063-record-detail-unification`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Quiero rediseñar las vistas de detalle de un disco para que sean mucho más parecidas entre sí de lo que son hoy. Hoy existen dos páginas de detalle distintas con secciones en distinto orden: ReleaseDetailPage (usada tanto desde resultados de búsqueda como desde la lista de deseos) y RecordDetailPage (usada desde mi biblioteca). Quiero que las tres experiencias (búsqueda, mi biblioteca y lista de deseos) muestren las mismas secciones, en el mismo orden y con el mismo estilo de card [...]"

## Overview

Vinylmania currently shows the detail of a record through two different pages with
sections in a different order and with different content emphasis:

- **`ReleaseDetailPage`** — reached from search results **and** from the wishlist.
  Shows: gallery, general info + add actions, wishlist panel (personal rating +
  wishlist notes, only when the record is in the wishlist), tracklist, additional
  catalog info, streaming links.
- **`RecordDetailPage`** — reached from *My library*. Shows: gallery, general info,
  "Your copy" block (personal rating + media condition + sleeve condition + notes),
  tracklist, additional catalog info, streaming links.

The two pages diverge in section order, in which card holds the personal rating, and
in whether the Discogs community rating is shown at all (today it is not shown on
either detail page — only on list/grid cards). This makes the three entry points
(search, library, wishlist) feel like three different products.

This feature makes the **three experiences present the same sections, in the same
order, with the same card style**, with one view-specific exception for *My library*.

Target section order for all three views:

1. **Image gallery** — cover art and other release images.
2. **General information card** — the release's catalog metadata (artist, title,
   year, label, format, etc.).
3. **Rating card** *(new, standalone)* — the user's personal score (only when the
   record is in their library or wishlist) **and** the Discogs community's aggregate
   score (always, when Discogs provides one).
4. **Streaming services card** — links to streaming platforms. This is the existing
   feature 062 section, reused as-is; this feature only changes **where** it appears
   in the order, in all three views.
5. **Tracklist**.
6. **Rest of catalog information** — identifiers and catalog notes (a subset of
   today's "additional information"; the community rating and have/want counts that
   share that block today move up to the Rating card).
7. **Other users' reviews** — out of scope for this increment (see below); no data
   source exists yet.

Directly under the back-link, above the gallery, every view shows a **consistent
action bar** in the same position, holding the transactional actions that apply to
that view (search: "Add to library" + "Add to wishlist"; *My library*: "Remove from
library"; wishlist: "Add to library"), together with their gate/error/notice
messaging. These actions no longer live inside any content card.

*My library* view additionally shows one **view-specific card** — "Estado de mi
copia" (state of my copy) — holding the media (soporte) condition, the sleeve
(portada) condition, and the user's personal notes. On wide screens it sits in the
right-hand scrolling column, directly after the general-information card.

The wishlist detail view carries **no notes field** after this change (see
Clarifications): the note is retired from the Vinylmania UI, though the underlying
Discogs wantlist note is left untouched in Discogs.

## Clarifications

### Session 2026-09-07

- Q: ¿Dónde queda el campo de notas de la lista de deseos en la nueva vista? → A:
  **No hay notas en la lista de deseos.** El campo de notas se retira de la vista de
  detalle del wishlist: no se muestra ni se puede editar desde Vinylmania. La nota que
  cada usuario pueda tener hoy en su entrada del wantlist de Discogs **permanece intacta
  en Discogs** (no se borra), simplemente deja de exponerse en la aplicación.
- Q: ¿Qué se hace con la card "Críticas de otros usuarios" (punto 7) en este incremento?
  → A: **Se omite por completo de esta fase.** No se implementa ni se reserva hueco
  oculto; queda documentada en la spec como sección pendiente de una futura fuente de
  datos, a decidir en una spec posterior.
- Q: ¿Qué alternativa de layout se adopta (de las 3 investigadas y presentadas en el
  artefacto)? → A: **Opción 2 — "Sticky media rail + liner-notes column"**, tomando
  como base móvil la pila por prioridad de la Opción 1. En escritorio: raíl izquierdo
  fijo (galería + card de rating + card de streaming) y columna derecha con scroll
  (información general + tracklist + resto de información del catálogo + "Estado de mi
  copia" en biblioteca). En móvil: una sola columna en el orden de prioridad. El DOM
  mantiene el orden de prioridad del contrato; solo la colocación CSS mueve el raíl.
  La Opción 3 (hero de carátula) se revisará como mejora visual futura, fuera del
  alcance de este incremento.
- Q: When a search-view record is in neither list and has no Discogs community rating,
  is the Rating card still shown? → A: **Yes — the Rating card is always rendered in
  every view.** Each missing half shows a neutral "not rated" state (reusing the
  project's existing `unrated` rating-band placeholder); when both halves are absent
  the whole card shows that placeholder. The card never disappears, so the section
  order and card count stay constant and no layout shift occurs when data resolves.
- Q: How is each rating rendered inside the Rating card? → A: **Reuse both existing
  widgets unchanged.** The community aggregate uses the existing color-banded
  `ReleaseRatingBadge` (the same treatment as the list/grid cards, satisfying the
  constitution's color-banded-severity rule) plus the rating count; the personal
  rating uses the existing editable `StarRating` stars. Each half is clearly labeled
  as "yours" vs. "community".
- Q: Where do the Discogs have/want counts go once the rating moves out of section 6?
  → A: **Into the Rating card**, alongside the community rating (they are the same
  class of Discogs community-aggregate data). The "rest of catalog information" section
  keeps only true catalog data — identifiers and catalog notes — and no longer renders
  any community line.
- Q: Where do the transactional actions ("Add to library" / "Add to wishlist" /
  "Remove from library") live? → A: **A consistent action bar** placed directly under
  the back-link, in the same position in all three views, holding whichever actions
  apply to that view (search: add-to-library + add-to-wishlist; library: remove;
  wishlist: add-to-library). The associated gate / error / notice messaging for these
  actions lives with the action bar. Actions are removed from the general-information
  card and from the "Estado de mi copia" card.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent detail experience across all three entry points (Priority: P1)

A collector opens the detail of a record from *search results*, then later opens a
record from *My library*, then a record from their *wishlist*. In every case the page
presents the same sections in the same order, styled with the same card component, so
that the collector always knows where to look for the gallery, the general
information, the rating, the streaming links, the tracklist, and the catalog details.

**Why this priority**: This is the core value of the feature and the reason it exists.
Without a single, shared section order and card style, none of the finer changes
(standalone rating card, "my copy" simplification) deliver the intended
"one product, three doors" experience. Delivering just this — the same ordered,
consistently styled sections — is already a usable improvement.

**Independent Test**: Open the same record (or three comparable records) from each of
the three entry points and confirm the sections appear in the identical order, use the
identical card styling, and that navigating between the three feels like the same
screen with different data.

**Acceptance Scenarios**:

1. **Given** a record shown from a search result, **When** the detail page renders,
   **Then** the sections appear in this order: gallery, general information, rating,
   streaming, tracklist, rest of catalog information.
2. **Given** the same record shown from *My library*, **When** the detail page
   renders, **Then** the same sections appear in the same order, plus the *My library*
   view-specific "Estado de mi copia" card.
3. **Given** the same record shown from the *wishlist*, **When** the detail page
   renders, **Then** the sections appear in the same order as the search view.
4. **Given** any of the three views, **When** the page renders, **Then** a consistent
   action bar sits directly under the back-link in the same position, showing only the
   transactional actions that apply to that view.
5. **Given** any of the three views, **When** comparing the card containers,
   **Then** every section uses the same shared card component and visual treatment
   (corner radius, border, elevation, padding, spacing between cards).
6. **Given** any of the three views on a wide (desktop) viewport, **When** the page
   renders, **Then** it uses a purpose-built wide layout (not a single stretched
   column); **and** on a mobile viewport it uses a single-column, touch-first layout.

---

### User Story 2 - Standalone rating card with personal and community scores (Priority: P2)

A collector viewing a record's detail sees a dedicated **Rating card** that shows,
side by side and clearly distinguished:

- their **personal rating** for this record — editable — but only when the record is
  in their library or their wishlist; and
- the **Discogs community's aggregate rating** — read-only — whenever Discogs
  provides one, in all three views (including plain search results where the record
  is in neither list).

**Why this priority**: The personal rating exists today but is buried inside the
"my copy" block (library) and the wishlist panel; the community rating is not shown
on the detail pages at all. Surfacing both in one consistent, prominent card is the
main content change of the redesign and enables User Story 3's simplification of
"my copy".

**Independent Test**: Open a record that is in the library and confirm the Rating
card shows an editable personal rating and the Discogs community score; open a record
that is only in the wishlist and confirm the same; open a record from search that is
in neither list and confirm the card shows only the community score (or an
appropriate empty state) with no editable personal rating.

**Acceptance Scenarios**:

1. **Given** a record in the user's library, **When** the detail renders, **Then**
   the Rating card shows the user's personal rating as an editable control and the
   Discogs community aggregate rating as read-only.
2. **Given** a record in the user's wishlist, **When** the detail renders, **Then**
   the Rating card shows the user's personal wishlist rating as an editable control
   and the Discogs community aggregate rating as read-only.
3. **Given** a record from search that is in neither the library nor the wishlist,
   **When** the detail renders, **Then** the Rating card shows the Discogs community
   aggregate rating and does **not** show an editable personal rating.
4. **Given** the user changes their personal rating in the Rating card, **When** the
   change is made, **Then** it is saved to the same place it is saved today (library
   entry rating for library records; Discogs wantlist rating for wishlist records)
   with per-interaction autosave and no separate "Save" button.
5. **Given** Discogs returns no community rating for the record, **When** the detail
   renders, **Then** the community portion shows a neutral "not rated" state without
   breaking the card, and the personal rating (if applicable) still shows.
6. **Given** a search-view record in neither list and with no community rating,
   **When** the detail renders, **Then** the Rating card is still present and shows the
   neutral "not rated" state for both halves (the card is never omitted).
7. **Given** the personal and community scores use different scales or meanings,
   **When** both are shown, **Then** each is labeled so the collector can tell which
   is theirs and which is the community's, and state is never conveyed by color alone.

---

### User Story 3 - "Estado de mi copia" reduced to condition and notes (Priority: P2)

A collector viewing a record from *My library* sees the view-specific "Estado de mi
copia" card containing **only** the media (soporte) condition, the sleeve (portada)
condition, and their personal notes — the personal rating has moved out to the
Rating card (User Story 2).

**Why this priority**: Depends on User Story 2 having a home for the personal rating.
Removing the rating from this block is what makes the three views' shared sections
line up; the residual card is genuinely library-specific (physical copy condition)
and has no equivalent in search or wishlist.

**Independent Test**: Open a library record and confirm the "Estado de mi copia" card
shows media condition, sleeve condition, and notes controls, and does **not** show a
rating control; confirm the rating for that record is editable in the Rating card
instead; confirm editing condition/notes still saves as it does today.

**Acceptance Scenarios**:

1. **Given** a library record detail, **When** the "Estado de mi copia" card renders,
   **Then** it contains media condition, sleeve condition, and notes, and no rating
   control.
2. **Given** a library record where a condition/notes field is not editable for that
   collection, **When** the card renders, **Then** the existing "not available on this
   collection" messaging and disabled state are preserved.
3. **Given** the "Remove from library" action lives in this block today, **When** the
   redesign ships, **Then** it has moved to the consistent action bar under the
   back-link and no longer appears inside the "Estado de mi copia" card.
4. **Given** the search view or the wishlist view, **When** the detail renders,
   **Then** no "Estado de mi copia" card appears (it is *My library*-only).

---

### User Story 4 - Streaming links appear in their new position in all three views (Priority: P3)

A collector sees the streaming services card (feature 062) in position 4 — directly
after the Rating card and before the tracklist — in search, library, and wishlist
views alike.

**Why this priority**: Low risk and low effort (the section already exists and is
already on all three pages); it is a reordering, not new functionality. It is
separable from the rest and can ship independently once the shared order exists.

**Independent Test**: Open a record with a resolvable streaming match from each of the
three entry points and confirm the streaming card renders between the Rating card and
the tracklist in all three.

**Acceptance Scenarios**:

1. **Given** any of the three views and a record with at least one resolvable
   streaming link, **When** the detail renders, **Then** the streaming card appears
   immediately after the Rating card and immediately before the tracklist.
2. **Given** a record with no resolvable streaming match, **When** the detail renders,
   **Then** the streaming card collapses to nothing (existing feature 062 behavior)
   and the sections below reflow without disturbing the sections above.
3. **Given** the streaming card is still resolving on first view, **When** its
   skeleton is shown then collapses, **Then** only empty space below it reflows.

---

### User Story 5 - Wishlist detail loses its notes field cleanly (Priority: P3)

A collector opening a wishlist record sees the unified layout with **no notes field**.
The wishlist detail's only editable concern is the personal rating (now in the Rating
card). Any note the collector previously kept on that wantlist entry is not shown and
not editable in Vinylmania, but is not deleted from Discogs.

**Why this priority**: The wishlist (unlike the library) has no view-specific card in
the target design, and the decision (see Clarifications) is to retire the note from
the UI rather than find it a new home. This is a removal, separable from the rest, and
low-risk because no Vinylmania-owned data is destroyed.

**Independent Test**: Open a wishlist record that has a saved Discogs wantlist note and
confirm the redesigned view shows no notes field anywhere; confirm the personal rating
is still editable in the Rating card; confirm (via Discogs directly) that the note
value on the wantlist entry is unchanged.

**Acceptance Scenarios**:

1. **Given** a wishlist record with a saved Discogs wantlist note, **When** the
   redesigned wishlist detail renders, **Then** no notes field or note text is shown
   anywhere on the page.
2. **Given** the wishlist detail, **When** the collector looks for a way to edit a
   note, **Then** there is none — the wishlist view exposes only the personal rating
   as editable state.
3. **Given** the note was retired from the UI, **When** the same wantlist entry is
   inspected in Discogs, **Then** its note value is unchanged (no write, no delete).

---

### Edge Cases

- **Catalog details unavailable**: Discogs release fetch fails or the catalog entry
  is unavailable. The view MUST still render the sections that do not depend on
  catalog data — for *My library*, the "Estado de mi copia" card and (where possible)
  the personal portion of the Rating card MUST still be shown, matching today's
  graceful-degradation behavior.
- **Discogs link revoked / re-link required**: the existing re-link notice behavior
  on the search/wishlist view is preserved.
- **Record not found**: the existing "couldn't find that release/record" message is
  preserved per entry point (wording may name the entry point: catalog vs. library).
- **Record in neither list (search)**: no personal rating shown; the Rating card is
  still rendered — it shows the community score, or a neutral "not rated" state for
  both halves if Discogs has none. The card is never omitted.
- **Record in both library and wishlist**: the detail is opened from one specific
  entry point; the personal rating shown is the one belonging to that entry point's
  list (library rating from library, wishlist rating from wishlist). Cross-list
  reconciliation is out of scope.
- **Empty tracklist**: the tracklist section handles an empty tracklist without an
  empty broken card (existing behavior preserved).
- **No community rating**: the Rating card's community half shows the neutral
  "not rated" state (and have/want counts if present); the card is not removed and
  there is no layout shift.
- **Transactional actions**: "Add to library" / "Add to wishlist" (search, wishlist)
  and "Remove from library" (library), plus their gate/error/notice messaging, live in
  the consistent action bar under the back-link; the action bar renders even when
  catalog details are unavailable.
- **Reduced motion**: any transition introduced by the redesign respects
  `prefers-reduced-motion`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The record detail experience reached from **search results**, from
  **My library**, and from the **wishlist** MUST present the same set of sections in
  the same order: (1) image gallery, (2) general information, (3) rating,
  (4) streaming services, (5) tracklist, (6) rest of catalog information.
- **FR-002**: All sections across all three views MUST use the same shared card
  component and the same visual treatment (corner radius, border, elevation, internal
  padding, and inter-card spacing).
- **FR-003**: Each view MUST provide both a purpose-built wide/desktop layout and a
  single-column, touch-first mobile layout for the shared section set (not one
  stretched column).
- **FR-004**: The **Rating card** MUST be a standalone section (its own card),
  distinct from the general-information card, the streaming card, and the *My library*
  "Estado de mi copia" card. It MUST be rendered in every view regardless of whether
  any rating data is available — when a half has no data it MUST show a neutral
  "not rated" state (reusing the project's existing `unrated` rating-band placeholder),
  and when both halves are absent the whole card MUST show that placeholder. The card
  MUST NOT be conditionally omitted, so the section set and order stay constant and no
  layout shift occurs when rating data resolves.
- **FR-005**: The Rating card MUST display the **Discogs community aggregate rating**
  (value and, where available, the count of community ratings) as read-only content in
  all three views whenever Discogs provides one for the record; when Discogs provides
  none, the community half MUST show the neutral "not rated" state per FR-004.
- **FR-005a**: The Rating card MUST also display the Discogs **have/want counts** for
  the record (read-only), alongside the community rating. The "rest of catalog
  information" section (FR-001 item 6) MUST NOT render any community rating or
  have/want line — it is limited to identifiers and catalog notes.
- **FR-006**: The Rating card MUST display the user's **personal rating** as an
  editable control **only** when the record is in the user's library (library view)
  or in the user's wishlist (wishlist view). In the search view for a record in
  neither list, no editable personal rating is shown.
- **FR-007**: Editing the personal rating in the Rating card MUST persist to the same
  destination as today — the library entry's rating for library records, and the
  Discogs wantlist entry's rating for wishlist records — using per-interaction
  autosave with no separate "Save" button, and MUST surface a save failure with a
  retry affordance.
- **FR-008**: The personal rating and the community rating MUST each be labeled so a
  user can distinguish them, and rating state/severity MUST NOT be conveyed by color
  alone. The community aggregate MUST use the existing color-banded rating badge
  (the same component and banding as the list/grid cards) together with the rating
  count; the personal rating MUST use the existing editable star control. This feature
  MUST NOT introduce a new rating widget.
- **FR-009**: The personal rating MUST be removed from the *My library* "Estado de mi
  copia" content and from the wishlist panel content; those blocks MUST NOT show a
  rating control after this change.
- **FR-010**: In the *My library* view, a **view-specific card** ("Estado de mi
  copia") MUST show only: media (soporte) condition, sleeve (portada) condition, and
  the user's personal notes.
- **FR-011**: The "Estado de mi copia" card MUST preserve the existing per-collection
  editability rules, including the disabled state and the "not available on this
  collection" messaging for fields Discogs does not allow editing.
- **FR-012**: All three views MUST render a **consistent action bar** directly under
  the back-link (above the gallery), occupying the same position in every view. It
  holds the transactional actions applicable to that view — search: "Add to library"
  and "Add to wishlist"; *My library*: "Remove from library"; wishlist: "Add to
  library" — plus their gate/error/notice messaging. Transactional actions MUST NOT be
  rendered inside any content card (general-information card or "Estado de mi copia"
  card included).
- **FR-013**: The "Estado de mi copia" card MUST appear **only** in the *My library*
  view and MUST NOT appear in the search or wishlist views.
- **FR-014**: The streaming services card MUST be the existing feature 062 section,
  reused without functional change; this feature MUST only change its position so it
  renders immediately after the Rating card and immediately before the tracklist in
  all three views.
- **FR-015**: When the streaming card resolves to no links (no match), it MUST
  collapse without leaving an empty card and without disturbing the layout of the
  sections above it.
- **FR-016**: The redesigned wishlist detail view MUST NOT show or provide an editable
  notes field. The wishlist view's only editable concern is the personal rating (in
  the Rating card). This feature MUST NOT write to or delete the note value on the
  user's Discogs wantlist entry as part of retiring the field — the note is left as-is
  in Discogs, merely no longer surfaced.
- **FR-017**: The "Other users' reviews" section MUST NOT be implemented in this
  increment and MUST NOT have any reserved/hidden slot in the layout, because no data
  source for free-text user reviews exists (Discogs exposes only aggregate numeric
  rating and have/want counts). The specification records it here as a section pending
  a future data source, to be designed in a later spec.
- **FR-018**: The graceful-degradation behavior when catalog details are unavailable
  MUST be preserved: the view MUST still render the sections that do not depend on
  catalog data — the action bar in every view, and for *My library* at minimum the
  "Estado de mi copia" card.
- **FR-019**: The existing not-found and Discogs re-link notices MUST be preserved per
  entry point.
- **FR-020**: The "Add to library" / "Add to wishlist" actions and their associated
  gate / error / notice messaging (Discogs-not-linked, re-link required, wishlist
  removal failed, already-in-library, etc.) MUST live in the consistent action bar
  defined in FR-012, with the same behavior they have today.
- **FR-021**: Every section that depends on an asynchronous request MUST show a
  skeleton loading state that mirrors the final content's shape, and transitions
  between loading/empty/populated states MUST NOT cause layout shift.
- **FR-022**: Three distinct layout alternatives, informed by how reference apps
  (Discogs, Apple Music, Spotify, and physical-collection managers such as CLZ Music)
  solve the same screen, were produced and presented for selection before planning
  (design decision brief published 2026-09-07). The adopted direction is **"Sticky
  media rail + liner-notes column"** (see Clarifications for the full description):
  - **Action bar**: in both layouts, the consistent action bar (FR-012) spans the full
    content width directly under the back-link, above the gallery and above the
    rail/column split — it is not part of the rail.
  - **Wide/desktop layout**: a sticky left rail holding, top to bottom, the image
    gallery, the Rating card, and the streaming card; a scrolling right column holding
    the general-information card, the tracklist, the rest-of-catalog-information card,
    and — in the *My library* view only — the "Estado de mi copia" card immediately
    after the general-information card.
  - **Mobile layout**: a single column in the exact priority order of the shared
    contract (gallery, general info, rating, streaming, tracklist, catalog info); in
    the *My library* view the "Estado de mi copia" card is inserted immediately after
    the general-information card, matching its desktop position.
  - The document order of the sections MUST follow the shared-contract priority order
    regardless of where CSS places them, so keyboard and screen-reader traversal
    always matches the contract.
- **FR-023**: The redesign MUST NOT change the **master release** detail page
  (`MasterReleaseDetailPage`); this feature is limited to the search, library, and
  wishlist detail views.
- **FR-024**: All three redesigned views MUST conform to WCAG 2.1 AA (semantic
  headings and section structure, keyboard operability, visible focus, contrast,
  accessible names) and follow the project's Apple design guidance via the installed
  design skills.

### Key Entities *(include if feature involves data)*

- **Release catalog data**: artist(s), title, year, label, format, images,
  tracklist, identifiers, catalog notes — sourced from Discogs; unchanged by this
  feature, only reorganized in the view.
- **Community rating**: Discogs aggregate rating (average value and count of ratings)
  plus have/want counts — read-only external data, all shown together in the Rating
  card. The rating value is newly surfaced on the detail views; the have/want counts
  move here from today's "additional information" block.
- **Personal rating**: the user's own score for a record. For library records it is
  library-entry state; for wishlist records it is the Discogs wantlist entry's
  rating. Editable, autosaved.
- **My-copy state** (*My library* only): media condition, sleeve condition, personal
  notes — user state, editable subject to per-collection rules.
- **Wishlist note**: free-text note on the Discogs wantlist entry. No longer read or
  written by Vinylmania after this feature; the value persists in Discogs, unreferenced
  by the app.
- **Streaming links**: feature 062 resolved platform links — reused unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the same record opened from all three entry points, the ordered
  list of visible section titles is identical except for the *My library*-only
  "Estado de mi copia" card — verifiable by direct comparison.
- **SC-002**: 100% of sections across the three views render inside the same shared
  card component (no bespoke per-view card styling).
- **SC-003**: On a record that is in the library, a user can find and change their
  personal rating from the detail view in a single, obvious location (the Rating
  card) without scrolling past unrelated fields — task success on first attempt for
  at least 90% of test users.
- **SC-004**: The Discogs community rating is visible on the detail view for 100% of
  records for which Discogs provides one, across all three entry points (today: 0%).
- **SC-005**: The *My library* "Estado de mi copia" card contains exactly three
  editable concerns (media condition, sleeve condition, notes) and zero rating
  controls.
- **SC-006**: The streaming card renders in the same ordinal position (after rating,
  before tracklist) in all three views — verifiable by comparison.
- **SC-007**: Retiring the wishlist notes field causes zero writes or deletes to any
  user's Discogs wantlist note (verifiable: no note-mutating request is issued by the
  wishlist detail view), and no notes field is present anywhere in the redesigned
  wishlist view.
- **SC-008**: Switching between loading, empty, and populated states of any section
  causes no measurable layout shift (CLS contribution ~0 for the section).
- **SC-009**: All three redesigned views pass an automated WCAG 2.1 AA check and
  keyboard-only walkthrough with zero AA violations.
- **SC-010**: Three distinct layout alternatives are documented and one is explicitly
  selected before the planning phase begins.

## Assumptions

- The three entry points continue to map to two route/page implementations today
  (`ReleaseDetailPage` for search + wishlist, `RecordDetailPage` for library); this
  feature may keep two pages or converge them, as long as the observable sections,
  order, and styling match — that is an implementation decision for the planning
  phase, not a spec requirement.
- The Discogs community rating data is already available in the release payload the
  backend returns (it is shown today on list/grid cards), so no new backend data
  source is required for FR-005. If it turns out the detail payload omits it, exposing
  it is in scope as a supporting change.
- "Same style of card" means the existing shared `Card` component and the project's
  established card visual language; this feature does not redefine the card component
  itself.
- The personal rating scale and the community rating scale are presented as they are
  today (personal: the existing star control; community: the existing aggregate
  value); harmonizing the two scales into one visual metric is **not** required.
- The wishlist notes field is retired from the UI (FR-016, per clarification). The
  Discogs wantlist note value is deliberately left untouched in Discogs so the
  decision is reversible by a future feature without data loss.
- "Other users' reviews" is fully out of scope with no reserved slot: no design or
  backend work for it beyond documenting it as future (FR-017).
- Master release detail (`MasterReleaseDetailPage`) is untouched (FR-023).
- Mobile and desktop layouts are both required per the project's dual-layout rule;
  "layout alternatives" (FR-022) covers both breakpoints for each alternative.
- Existing e2e coverage for the affected flows (search → detail, library → detail,
  wishlist → detail) will be updated to the new section order as part of
  implementation.
