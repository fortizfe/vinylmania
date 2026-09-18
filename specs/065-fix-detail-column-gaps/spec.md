# Feature Specification: Fix gaps in the two-column record detail layout

**Feature Branch**: `065-fix-detail-column-gaps`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "En el diseño de layout actual en dos columnas para las vistas de detalle de los discos, han quedado gaps entre columnas. De manera que en una culumna se forma un hueco del tamaño de la tarjeta de la otra columna. Revisa por qué no se están apilando bien y corrige el desvío."

## Clarifications

### Session 2026-09-18

- Q: The loading skeletons for these pages (`RecordDetailSkeleton`, `MasterReleaseDetailSkeleton`) mirror the same column layout, explicitly to avoid layout shift on the skeleton→content swap. Are they in scope for this fix? → A: Yes — the skeleton loading states MUST also stack independently, gap-free, and keep matching the real layout's footprint (no layout shift).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean stacking on release/record detail pages (Priority: P1)

A collector opens a release or record detail page on a desktop-sized screen. The page shows two columns of cards (gallery/rating/streaming on one side, general info/tracklist/other details on the other). Today, when one column's cards are noticeably shorter or taller than the cards next to them in the other column, an empty gap appears — sized roughly like the neighboring card — before the next card in the shorter column continues. The collector should instead see each column's cards stack directly one after another, with only the normal spacing between them, no matter how tall the cards in the other column are.

**Why this priority**: This is the exact defect reported — it's visible on every visit to the two most-used detail pages (search result detail and library record detail) and makes the layout look broken.

**Independent Test**: Open a release detail page and a library record detail page on a desktop-width viewport for records whose column content lengths differ substantially (e.g., a short "listen on streaming" card next to a long tracklist). Confirm no empty gap appears in either column between cards.

**Acceptance Scenarios**:

1. **Given** a release detail page on a desktop-width viewport where the tracklist card is much taller than the streaming-links card next to it, **When** the page renders, **Then** there is no empty gap under the streaming-links card — the next card in that same column (if any) starts immediately after it, and if there is no further card, the column simply ends there.
2. **Given** a library record detail page on a desktop-width viewport with the "Estado de mi copia" card present, **When** the page renders, **Then** each of the two columns stacks its own cards independently, with neither column's card spacing depending on the height of any card in the other column.
3. **Given** any of these pages on a narrow (mobile/tablet) viewport, **When** the page renders, **Then** the single-column stacked layout and card order remain exactly as they are today (unaffected by this fix).

---

### User Story 2 - Clean stacking on the master release detail page (Priority: P2)

A collector opens a master release detail page (an album's overview page, independent of a specific pressing) on a desktop-sized screen. The top of the page shows a gallery card next to a stack of info cards; today a height mismatch between them can leave visible empty space under the shorter one before the full-width sections below resume. The collector should see this top pair sit flush against the full-width content below it, regardless of which of the two cards is taller.

**Why this priority**: Same underlying defect, but on a lower-traffic page and with a smaller visual impact (only the top card pair is affected, not the full column stack).

**Independent Test**: Open a master release detail page on a desktop-width viewport for a release whose gallery image is much taller or shorter than the adjacent info cards, and confirm no empty gap is left before the tracklist/versions sections that follow.

**Acceptance Scenarios**:

1. **Given** a master release detail page on a desktop-width viewport where the gallery card is taller than the adjacent info card(s), **When** the page renders, **Then** the full-width sections below (tracklist, versions, streaming) begin immediately after the taller of the two, with no dead space reserved to match the shorter card.

---

### User Story 3 - No regression to reading order or accessibility (Priority: P3)

A collector using a screen reader or keyboard-only navigation moves through a detail page. The fix to the visual column layout must not change the order in which content is announced or focused, and must not change the single-column order already used on mobile/tablet.

**Why this priority**: Guards against trading one defect (visual gaps) for another (broken reading/tab order) while implementing the fix.

**Independent Test**: Tab through a detail page before and after the fix and confirm the focus order of interactive elements is unchanged; compare the mobile-viewport card order before and after the fix and confirm it is identical.

**Acceptance Scenarios**:

1. **Given** a detail page on any viewport, **When** a keyboard user tabs through its interactive elements, **Then** the focus order is identical to the order before this fix.
2. **Given** a detail page on a mobile/tablet viewport, **When** the page renders, **Then** the stacked card order is identical to the order before this fix.

---

### Edge Cases

- What happens when the two columns end up with almost exactly the same total height? No gap should appear either way — the fix must not depend on the columns being mismatched.
- What happens when a column contains only a single, short card (e.g., a release with no "other details" and no resolvable streaming links)? That column should simply end after its last card, without stretching or leaving trailing empty space to match the other column.
- What happens on a viewport size right at the boundary between the single-column and two-column layouts? Cards must not straddle a gap-producing state during the transition.
- What happens in dark mode vs. light mode? The gap defect and its fix are layout-only and must behave identically regardless of theme.
- What happens when a card's content changes height after initial render (e.g., a gallery image finishes loading, or a tracklist expands)? The columns must reflow independently without reintroducing a gap in the other column.
- What happens while a page is still loading (skeleton state)? The skeleton placeholders MUST show the same gap-free, independently stacked columns as the loaded content, since they are designed to mirror the real layout's footprint so the skeleton→content swap causes no layout shift.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On desktop-width viewports, each column of cards MUST stack its own cards directly one after another, separated only by the standard spacing already used between cards — never by an empty gap sized to a card in the other column.
- **FR-002**: The height of any card MUST NOT be stretched, and no empty space MUST be reserved in a column, in order to match the height of a card (or group of cards) in the other column.
- **FR-003**: This fix MUST apply to all three two-column detail views: the release detail page (search context), the record detail page (library context), and the master release detail page.
- **FR-004**: The fix MUST hold regardless of which optional cards are present or absent in a given view (e.g., "Estado de mi copia" shown only in the library view, "Otros detalles" shown only when notes or identifiers exist, streaming links shown only when they resolve), and regardless of how long any given card's content is (e.g., long vs. short tracklists).
- **FR-005**: The reading/DOM order and keyboard focus order of cards on every affected page MUST remain exactly as they are today.
- **FR-006**: The single-column stacked layout and card order used on mobile/tablet viewports MUST remain exactly as they are today.
- **FR-007**: No card's visual design, content, or spacing scale MUST change as part of this fix — only the column-stacking mechanics are corrected.
- **FR-008**: The loading skeleton placeholders for these pages (the release/record detail skeleton and the master release detail skeleton) MUST also stack independently without gaps, and MUST continue to mirror the loaded content layout's column footprint so no layout shift occurs when loading completes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On desktop-width viewports, zero empty gaps are visible between cards in either column across the three affected pages, verified against at least five representative combinations of mismatched card content lengths.
- **SC-002**: The originally reported defect (a gap in one column sized like a card in the other column) cannot be reproduced on any of the three affected pages after the fix.
- **SC-003**: 100% of existing automated responsive/visual tests for the three affected pages continue to pass without any change to the documented card order (mobile or desktop).
- **SC-004**: A user can visually scan any column of any affected page from top to bottom, at any desktop viewport width, without encountering unexplained blank space between cards.
- **SC-005**: The loading (skeleton) state of each affected page shows zero visible gaps between placeholder cards and matches the loaded layout's column footprint closely enough that no layout shift occurs when the real content replaces it.

## Assumptions

- The affected pages are exactly the three identified during investigation: the release detail page, the library record detail page, and the master release detail page — no other page uses this two-column pattern.
- This is a visual/layout defect only; no new cards, sections, fields, or data are introduced or removed.
- The existing breakpoint that switches between the single-column (mobile/tablet) and two-column (desktop) layouts stays the same.
- Preserving today's reading/DOM order and mobile card order (FR-005, FR-006) takes precedence over any specific layout technique used to achieve independent column stacking.
