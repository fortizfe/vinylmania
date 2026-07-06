# Feature Specification: Record Rating Badges on Search and Library Cards

**Feature Branch**: `017-record-rating-cards`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Para el siguiente incremento quiero que tanto en las cards de resultado de búsqueda como en las cards de my library, aparezca el rating del disco. Debe aparecer un cuadrado con bordes redondeados con el rating. Entre 0 y 2,5 el fondo será rojo. Entre 2,51 y 4,09 el fondo será amarillo y entre 4,10 hasta 5 en fondo será verde. Investiga cual es el mejor sitio de la carda para colocar la puntuación sin que sea demasiado invasivo. el look and feel debe sentirse moderno."

## Clarifications

### Session 2026-07-06

- Q: When a search-result card's per-release rating lookup fails or times out (while the base search itself still succeeds), what should that card show? → A: Omit the badge on that card only, identical to how a release with no available rating is treated; the rest of the search page renders normally.
- Q: How long may a per-release rating lookup take before a search-result card is treated as unrated for that response? → A: 2 seconds per lookup; any release still pending past that point is treated as "no rating available" for that response.
- Q: Should the badge's color-coding (red/yellow/green) carry any accessibility guarantee beyond the numeric value already shown inside it? → A: Yes — badge text MUST meet WCAG AA contrast (4.5:1) against all three band backgrounds; the numeric value remains the color-independent signal, so no additional icon/pattern is required.
- Q: SC-001 currently describes a subjective usability outcome ("collectors can correctly identify... during a quick visual scan") with no automatable check. How should it be verified? → A: Replace it with an objective, testable color-distinguishability requirement between the three band colors themselves, rather than a manual usability claim.
- Q: Does this increment include sorting/filtering by rating, or changes to the record detail page's existing rating display? → A: No — out of scope. No sort/filter control by rating is added, and the record detail page's existing rating display is unchanged; this increment is limited to the badge on search-result and library cards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a release's rating at a glance in search results (Priority: P1)

A collector browsing search results wants to recognize, without opening each release, whether a record is poorly, moderately, or highly rated, so they can decide faster which releases deserve a closer look.

**Why this priority**: The search-results card is the highest-volume decision surface in this flow. If the rating is not visible there, the feature fails to reduce decision effort where it matters most.

**Independent Test**: Run a search that returns releases with low, medium, and high ratings. Confirm each result card shows a compact numeric rating badge whose color band matches the release's rating range and can be interpreted without opening the release.

**Acceptance Scenarios**:

1. **Given** a search results grid containing releases with different ratings, **When** the collector scans the cards, **Then** each rated release shows a visible numeric badge that communicates its rating level directly on the card.
2. **Given** a rated release in the search results, **When** its card is rendered, **Then** the rating badge appears in a consistent, unobtrusive position that does not displace the title, artist, year, format, or action controls.
3. **Given** a release rated in the low, medium, or high band, **When** its card is rendered, **Then** the badge background color matches the configured range for that band.

---

### User Story 2 - Compare owned records by rating inside My Library (Priority: P1)

A collector reviewing their own library wants the same rating cue visible on library cards, so they can compare records quickly using the same visual language they already saw while searching.

**Why this priority**: The user explicitly asked for the same enhancement in both card types. If the badge exists only in search results, the product creates an inconsistent mental model between discovery and ownership views.

**Independent Test**: Open My Library with multiple records of different ratings. Confirm the same rating badge appears on each applicable library card in the same position and with the same color behavior as in search results.

**Acceptance Scenarios**:

1. **Given** a library grid with rated releases, **When** the collector views their cards, **Then** each applicable card shows the same style of rating badge used in search results.
2. **Given** the collector moves between search results and My Library, **When** they compare the two card types, **Then** the rating badge occupies the same relative placement and visual prominence in both places.
3. **Given** a library card remains clickable to open the record, **When** the rating badge is shown, **Then** the badge does not interfere with opening the record or reading the card's core information.

---

### User Story 3 - Keep the badge informative but not invasive (Priority: P2)

A collector wants the rating to feel like a useful secondary signal, not the dominant element of the card, so the interface remains modern, clean, and easy to scan.

**Why this priority**: The user did not ask just for raw visibility; they asked specifically for a placement investigation and a modern, non-invasive feel. That makes restraint part of the feature itself.

**Independent Test**: Review rated cards on narrow and wide viewports. Confirm the badge is discoverable within the card's first visual scan but does not push content, cover important artwork, or compete with primary actions.

**Acceptance Scenarios**:

1. **Given** a card with a cover image, **When** the collector sees it, **Then** the rating badge is anchored in the upper-right area of the visual thumbnail zone, where it can be found immediately without consuming text rows.
2. **Given** the badge is present, **When** the collector reads the card title, artist, and metadata, **Then** those primary details remain the dominant reading path and the badge behaves as a secondary accent.
3. **Given** the same card is shown on a narrow viewport, **When** the layout compresses, **Then** the badge remains legible and contained within the card without causing overlap, truncation, or layout shift.

---

### User Story 4 - Handle unrated and boundary values predictably (Priority: P3)

A collector wants cards to treat missing or threshold ratings consistently, so the badge never communicates a misleading value or ambiguous color.

**Why this priority**: This protects the feature from the most likely trust-breaking cases: cards with no real rating and ratings that sit exactly on a threshold.

**Independent Test**: Verify cards for a release with no available rating, a release rated exactly 2.50, one rated 2.51, one rated 4.09, and one rated 4.10. Confirm each card uses the correct display rule.

**Acceptance Scenarios**:

1. **Given** a release has no available rating, **When** its card is shown, **Then** no misleading numeric badge is displayed.
2. **Given** a release is rated exactly 2.50, **When** its card is shown, **Then** the badge uses the low-rating color band.
3. **Given** a release is rated exactly 2.51 or 4.09, **When** its card is shown, **Then** the badge uses the medium-rating color band.
4. **Given** a release is rated exactly 4.10 or higher up to 5.00, **When** its card is shown, **Then** the badge uses the high-rating color band.

---

### Edge Cases

- What happens when a card has no cover image? The rating badge still occupies the same upper-right position within the thumbnail area so card layouts stay consistent.
- What happens when the release has no available rating? The card omits the badge instead of showing a false zero or an ambiguous placeholder.
- What happens when a search-result card's rating lookup fails or times out even though the base search succeeds? The card omits the badge exactly as it would for "no available rating"; the rest of the search page continues to render normally.
- What happens when a card is rendered in a dense multi-column grid on a small screen? The badge remains readable and contained without overlapping text or actions.
- What happens when the card is in a busy state or already-added state in search results? The badge remains visible without obscuring the state or the action affordances.
- What happens when a rating value sits exactly on a threshold? The inclusive boundaries defined in the requirements determine the badge color consistently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Search result cards MUST display the release's rating whenever a valid release rating is available.
- **FR-002**: My Library cards MUST display the same release rating signal, using the same position, shape, and visual treatment as search result cards.
- **FR-003**: The rating MUST be shown inside a compact rounded-square badge containing the numeric rating value.
- **FR-004**: The badge MUST be positioned in the upper-right area of the card's thumbnail zone so it is visible at first glance without consuming the card's text rows or action area.
- **FR-005**: Ratings from 0.00 through 2.50 inclusive MUST use a red background.
- **FR-006**: Ratings from 2.51 through 4.09 inclusive MUST use a yellow background.
- **FR-007**: Ratings from 4.10 through 5.00 inclusive MUST use a green background.
- **FR-008**: If no valid release rating is available, the card MUST omit the badge rather than display a misleading numeric value.
- **FR-009**: The badge MUST remain legible on top of both real cover images and image placeholders.
- **FR-010**: The badge MUST NOT obscure or displace the card's primary information, primary actions, or navigation affordances.
- **FR-011**: The badge MUST behave consistently across narrow and wide viewports, without overlap, truncation, or layout shift.
- **FR-012**: The presence of the badge MUST preserve a modern, lightweight card presentation by reading as a secondary visual accent rather than the dominant element.
- **FR-013**: The badge's numeric text MUST meet WCAG AA contrast (4.5:1) against each of the three band background colors, so the rating remains legible without relying solely on color perception.

### Key Entities

- **Release Rating**: The shared 0-to-5 score associated with a release and used as the comparison signal across both search and library cards.
- **Rating Badge**: The compact rounded-square visual token that presents a release's numeric rating and communicates its band through color.
- **Search Result Card**: The discovery card shown while a collector browses catalog search results.
- **Library Card**: The ownership card shown while a collector browses records already present in My Library.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The three band background colors (red, yellow, green) are objectively distinguishable from one another (not just from their text), so a mixed grid of low-, medium-, and high-rated releases never presents two bands that could be confused at a glance.
- **SC-002**: 100% of cards with rating values at the defined thresholds (2.50, 2.51, 4.09, 4.10, and 5.00) display the correct badge color.
- **SC-003**: 100% of cards without a valid release rating avoid showing a misleading numeric badge.
- **SC-004**: Existing card interactions remain fully usable after the badge is added, with no blocked add, preview, or open-record actions.
- **SC-005**: The same collector can move between search results and My Library and find the rating badge in the same relative location on both card types without relearning the layout.
- **SC-006**: A per-release rating lookup that has not resolved within 2 seconds is treated as "no rating available" for that search response, so no search page render is blocked or perceptibly delayed by rating enrichment.

## Assumptions

- "Rating del disco" refers to the release's shared rating, not the collector's private per-copy rating, because the same signal must appear consistently on both search-result cards and library cards.
- The least invasive placement is the upper-right corner of the thumbnail zone, because that area is immediately scannable while avoiding competition with titles, metadata rows, and card actions.
- Cards with no valid release rating should omit the badge rather than invent a zero value, since an absent rating and a poor rating are not the same user signal.
- The feature changes only how cards present rating information; it does not change how collectors rate their own copy elsewhere in the product.

## Out of Scope

- Sorting or filtering search results or library records by rating.
- Any change to the record detail page's existing rating display.