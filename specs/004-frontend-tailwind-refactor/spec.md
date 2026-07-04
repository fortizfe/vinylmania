# Feature Specification: Frontend Look-and-Feel Refactor (Design System Alignment)

**Feature Branch**: `004-frontend-tailwind-refactor`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Necesitamos refasctorizar el look and feel realizado hasta ahora en la parte de frontend para adaptarse a los requisitos de estilos y de trabajo añadidos a constitution. Se requiere refactorizar el código de frontend existente para adaptarse a la definición de constitution."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent card-based experience across every screen (Priority: P1)

As a vinyl collector using Vinylmania, I want every screen (landing, library list,
record detail, add-record) to present its content with the same visual language —
cards, spacing, typography hierarchy, and color palette — so the app feels like a
single cohesive product instead of a set of loosely related screens.

**Why this priority**: Visual inconsistency is the most visible symptom of the current
implementation and the primary driver for this refactor. Fixing it delivers immediate,
observable value to every user on every screen.

**Independent Test**: Can be fully tested by navigating through the landing page, the
library list, a record detail page, and the add-record page, and confirming that
content blocks share the same card treatment (rounded corners, border, soft shadow,
consistent padding) and spacing rhythm, without needing any other story implemented.

**Acceptance Scenarios**:

1. **Given** a user opens the library list, **When** the page renders, **Then** each
   record is presented inside a card with consistent rounded corners, border, shadow,
   and padding matching every other card-based surface in the app.
2. **Given** a user navigates between the landing page, library list, record detail,
   and add-record screens, **When** comparing the same UI element (e.g., primary
   button, section container) across screens, **Then** the element looks and behaves
   identically everywhere it appears.
3. **Given** a design element (card, button, badge, input) is used on more than one
   screen, **When** inspecting the implementation, **Then** it is backed by a single
   shared, reusable component rather than duplicated per-screen styling.

---

### User Story 2 - Predictable loading feedback with no layout jumps (Priority: P2)

As a user browsing my collection or opening a record's detail page, I want to see a
placeholder that already has the same shape and size as the content that is about to
appear, so I immediately understand something is loading and the page doesn't jump
around once the real content arrives.

**Why this priority**: Loading feedback directly affects perceived performance and
trust, especially given the app's dependency on an external catalog data source whose
response time can vary. It builds on the card system from Story 1 but can be
demonstrated independently on any single async screen.

**Independent Test**: Can be fully tested by throttling the network and opening the
library list or a record detail page, observing that a skeleton placeholder (matching
the final layout's shape and size) appears immediately, and that no blank screen,
generic spinner, or visible content jump occurs when real data replaces it.

**Acceptance Scenarios**:

1. **Given** a user navigates to the library list or a record detail page, **When**
   the data is still being fetched, **Then** a skeleton placeholder mimicking the
   final content's structure (same number of approximate lines/blocks, same card
   dimensions) is shown instead of a blank screen or a generic spinner.
2. **Given** a skeleton placeholder is showing, **When** the real content finishes
   loading, **Then** the transition from skeleton to content happens without any
   visible shift in size or position of surrounding page elements.
3. **Given** a data request fails (e.g., the external catalog is unavailable),
   **When** the error state is shown, **Then** it occupies the same footprint as the
   loading and loaded states so the surrounding layout does not shift.

---

### User Story 3 - Comfortable, low-fatigue visual style (Priority: P3)

As a user who spends time browsing a personal collection, I want the interface to feel
light and easy to read — generous spacing, clear typographic hierarchy without heavy
bold text, a restrained color palette, and soft rather than harsh shadows — so
extended browsing sessions feel comfortable rather than visually noisy.

**Why this priority**: This is a refinement of the visual language established in
Story 1; it improves comfort and polish but the app remains fully usable without it,
so it is lower priority than structural consistency and loading feedback.

**Independent Test**: Can be fully tested by visually reviewing any screen with real
content and confirming generous spacing between elements, restrained use of heavy
bold weights (used only for primary hierarchy), a small, consistent color palette, and
soft shadows on standard content (reserving stronger shadows only for floating
elements like modals).

**Acceptance Scenarios**:

1. **Given** any screen with multiple content blocks, **When** reviewing the spacing
   between them, **Then** spacing is generous and consistent rather than cramped or
   ad hoc.
2. **Given** any screen with a heading and supporting text, **When** reviewing the
   typographic hierarchy, **Then** hierarchy is conveyed primarily through medium/
   semibold weight rather than heavy bold text.
3. **Given** a standard content surface (e.g., a card), **When** reviewing its shadow,
   **Then** the shadow is soft/subtle; strong, pronounced shadows only appear on
   floating elements such as modals or overlays.

---

### Edge Cases

- What happens when a card's content (e.g., a very long album or artist title) would
  overflow its fixed card dimensions? The card MUST truncate or wrap the text without
  breaking the shared card layout or causing layout shift.
- How does the library list behave when a collection is empty? The empty state MUST
  use the same sizing/footprint as the loaded and skeleton states so no layout shift
  occurs when data first arrives.
- How does the add-record flow present in-progress states (e.g., searching the
  catalog for a match, submitting a new entry)? These MUST use the same
  skeleton/loading treatment as other asynchronous content rather than a generic
  spinner.
- What happens if the user's system theme preference changes while the app is open
  (e.g., OS switches from light to dark at sunset)? The app MUST reflect the change
  without requiring a page reload, and no screen (including skeletons) may be left in
  a mismatched, low-contrast state.
- What happens on very small (mobile) and very large (desktop) viewports? Card grids
  and spacing MUST remain consistent and readable without introducing screen-specific
  one-off styles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every existing screen (landing, library list, record detail, add
  record) MUST present its primary content blocks using a single, shared card
  presentation (consistent corner rounding, border, soft shadow, and padding) rather
  than screen-specific, hand-rolled styling.
- **FR-002**: Any visual pattern (card, button, badge, avatar, input, or similar)
  that appears on two or more screens MUST be implemented as a single shared,
  reusable component rather than being duplicated per screen.
- **FR-003**: Every screen whose content depends on an asynchronous request (library
  list, record detail, and the add-record catalog lookup/submission flow) MUST show a
  skeleton placeholder that mirrors the final content's shape and approximate size
  while the request is pending.
- **FR-004**: The system MUST NOT present a blank screen or a generic, content-
  agnostic spinner as the default loading state for any data-dependent screen.
- **FR-005**: For a given screen or component, the skeleton, empty, error, and
  loaded states MUST occupy the same sizing/footprint so that transitioning between
  them never causes a visible layout shift.
- **FR-006**: The application MUST support both a light and a dark visual theme,
  with light as the default theme and dark applied automatically when the user's
  operating system preference indicates dark mode, replacing today's dark-only
  design. Every component — including skeleton placeholders — MUST render correctly
  and legibly in both themes.
- **FR-007**: The application MUST derive its theme solely from the operating
  system's theme preference; no manual, persistent light/dark toggle control is
  required in the UI for this refactor.
- **FR-008**: The refactor MUST preserve all existing user-facing behavior and
  functionality (navigation, sign-in, library browsing, record detail viewing, adding
  a record) exactly as it works today; this is a visual/structural refactor, not a
  functional change.
- **FR-009**: The refactor MUST define a new color palette (neutral base plus
  accent) rather than preserving the current dark-only accent/backdrop as-is; the
  new palette MUST satisfy the small/restrained palette requirement (FR-013) and
  support both the light and dark themes (FR-006).
- **FR-010**: Spacing between content blocks on every screen MUST be generous and
  consistent rather than cramped or varying ad hoc from screen to screen.
- **FR-011**: Typographic hierarchy on every screen MUST be conveyed primarily
  through medium/semibold weight rather than heavy bold text.
- **FR-012**: Standard content surfaces MUST use soft, subtle shadows; stronger,
  more pronounced shadows MUST be reserved for floating elements such as modals or
  overlays.
- **FR-013**: The color palette used across the application MUST remain small and
  restrained (a neutral base plus a single accent) rather than introducing many
  one-off colors per screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing screens (landing, library list, record detail,
  add record) present their content using the shared card treatment, verified by
  visual review.
- **SC-002**: Users see a loading placeholder immediately (perceived as instant, no
  blank screen) whenever they open a screen whose content depends on an external
  request.
- **SC-003**: Zero instances of visible content "jumping" (layout shift) are observed
  when any screen transitions between its skeleton, empty, error, and loaded states.
- **SC-004**: 100% of screens and components remain fully legible (no unreadable
  text or broken contrast) when the application's theme is light and when it is dark.
- **SC-005**: A visual pattern used in two or more places in the UI is implemented
  exactly once (as a shared component) 100% of the time, verified by absence of
  duplicated styling definitions across the codebase.
- **SC-006**: All existing user journeys (sign in, browse library, view a record's
  detail, add a record) complete successfully after the refactor with no change in
  outcome compared to before the refactor.

## Assumptions

- This is a purely visual/structural refactor: no new user-facing features are
  being added, and no existing functional behavior is intended to change.
- All currently existing frontend screens and shared elements (landing page, app
  header, sign-in control, library list, record detail, add-record flow) are in
  scope for this refactor; no screen is excluded.
- The add-record flow's catalog lookup step is treated as an asynchronous,
  data-dependent interaction and therefore falls under the loading-state
  requirements (FR-003) in the same way as the library list and record detail pages.
- No backend, API contract, or data model changes are required; this refactor is
  scoped entirely to the frontend presentation layer.
- Performance targets for loading-state responsiveness follow standard web-app
  expectations (perceived as instant, i.e. a placeholder appears before the user
  would otherwise notice a delay) rather than a specific millisecond figure, since
  no specific target was provided.
- The application adopts light as its default theme, switching to dark
  automatically based on the operating system's `prefers-color-scheme` setting;
  no manual in-app theme toggle is included in this refactor's scope.
- The current dark-only accent/backdrop is not preserved; a new neutral-plus-accent
  palette is defined as part of this refactor to satisfy both the light and dark
  themes and the small/restrained palette requirement.
