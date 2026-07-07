# Feature Specification: Responsive Header Navigation — Icons on Desktop, Hamburger on Mobile

**Feature Branch**: `020-responsive-header-icons`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Quiero trabajar en mejorar el header de la aplicación. Lo que me gustaría es que si es un dispositivo móvil, que no tiene espacio, salga el menú hamburguer. Pero si se accede desde navegador o dispositivos con espacio, me gustaría que las 3 secciones que tenemos en el hamburguer (profile, my whislist y my library) salieran como iconos clickables en la parte derecha. Los iconos quiero que sean modernos y que tiendan a los flat styles actuales."

## Clarifications

### Session 2026-07-07

- Q: At what screen-width threshold should the header switch from the icon
  layout to the hamburger menu? → A: The `md` breakpoint (768px) — phones and
  small tablets show the hamburger menu; tablet-landscape and wider show the
  icon layout, consistent with the breakpoint already used by the header
  search box.
- Q: What visual style should the three new icons follow? → A: Outline/stroke
  icons matching the header's existing icon style (line-based, `currentColor`,
  no fill), consistent with the current hamburger and search icons.
- Q: Should the "Sign out" control also become icon-only on desktop to match
  the new nav icons? → A: No — keep "Sign out" as a text-labeled button in
  both the icon layout and the hamburger-menu layout; it is out of scope for
  this redesign.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate via header icons on wide screens (Priority: P1)

As a signed-in collector using a desktop browser or any device with enough
screen width, I want to see "Profile", "My wishlist", and "My library" as
individual clickable icons directly in the header, so I can jump to any
section in a single click without opening a menu first.

**Why this priority**: This is the core value of the feature — the whole
point is to remove the extra click of opening the hamburger menu on screens
that have room for direct navigation.

**Independent Test**: Can be fully tested by signing in on a wide browser
window (or resizing an existing session above the mobile breakpoint) and
confirming three distinct, clickable icons for Profile, My wishlist, and My
library appear on the right side of the header, each navigating to the
correct section on click.

**Acceptance Scenarios**:

1. **Given** a collector is signed in and viewing the app on a wide screen,
   **When** the header renders, **Then** three separate icon buttons for
   Profile, My wishlist, and My library are visible on the right side of the
   header, and the hamburger menu is not shown.
2. **Given** the header icons are visible, **When** the collector clicks the
   My library icon, **Then** they are taken to the My library section.
3. **Given** the header icons are visible, **When** the collector clicks the
   My wishlist icon, **Then** they are taken to the My wishlist section.
4. **Given** the header icons are visible, **When** the collector clicks the
   Profile icon, **Then** they are taken to the Profile section.
5. **Given** the header icons are visible, **When** the collector hovers or
   focuses an icon (keyboard navigation), **Then** its purpose is
   identifiable (e.g., via an accessible label or tooltip) without relying on
   visible text.

---

### User Story 2 - Navigate via hamburger menu on narrow screens (Priority: P1)

As a signed-in collector on a mobile device or narrow browser window, I want
the existing hamburger menu to keep giving me access to Profile, My
wishlist, and My library, so navigation still works when there isn't enough
horizontal space for separate icons.

**Why this priority**: Equally critical to User Story 1 — the feature is a
responsive *replacement* of one navigation style with the other, so the
narrow-screen experience must keep working exactly as it does today.

**Independent Test**: Can be fully tested by signing in on a narrow
screen/viewport and confirming the hamburger menu icon is shown (and the
individual icons are not), and that opening it still lists Profile, My
wishlist, and My library as navigable links.

**Acceptance Scenarios**:

1. **Given** a collector is signed in and viewing the app on a narrow screen,
   **When** the header renders, **Then** the hamburger menu icon is visible
   on the right side of the header, and the three individual icons are not
   shown.
2. **Given** the hamburger menu is visible, **When** the collector opens it,
   **Then** Profile, My wishlist, and My library appear as links, each
   navigating to the correct section on click, exactly as before this
   change.

---

### User Story 3 - Seamless transition when screen size changes (Priority: P2)

As a collector who resizes their browser window or rotates/opens their
device (e.g., a tablet switching between portrait and landscape), I want the
header to switch between the icon layout and the hamburger menu
automatically as space becomes available or constrained, so navigation
always matches how much room the screen actually has.

**Why this priority**: This makes the responsive behavior robust across the
full range of real-world usage (window resizing, foldables, tablets)
rather than only working for the two extremes of "phone" and "desktop."

**Independent Test**: Can be fully tested by starting on a wide browser
window, resizing it down below the threshold at which space runs out, and
confirming the icons are replaced by the hamburger menu, then resizing back
up and confirming the icons return — with no broken or duplicate controls
at any point.

**Acceptance Scenarios**:

1. **Given** the header is showing the individual icons, **When** the
   viewport is narrowed past the point where all icons plus other header
   content (logo, search, sign out) no longer fit comfortably, **Then** the
   header switches to showing the hamburger menu instead.
2. **Given** the header is showing the hamburger menu, **When** the viewport
   is widened past that same point, **Then** the header switches to showing
   the individual icons instead.
3. **Given** the transition point is crossed, **When** the switch happens,
   **Then** exactly one navigation control (either the icon set or the
   hamburger menu) is visible at a time — never both, never neither.

---

### Edge Cases

- What happens if the header is very narrow (e.g., a small phone) and even
  the logo, search box, hamburger icon, and sign-out button together don't
  fit? The hamburger + sign-out controls must remain reachable; other header
  elements may wrap or shrink, but navigation and sign-out must never be
  clipped off-screen.
- What happens if a collector is mid-interaction with the hamburger menu
  open (modal visible) when the screen crosses the size threshold (e.g.,
  rotating a tablet)? The menu is allowed to remain open across the
  breakpoint change — it stays fully usable (links still navigate,
  Escape/backdrop still close it) while the icon row appears underneath;
  this is not considered a broken state.
- What happens for keyboard-only or screen-reader users on the icon layout?
  Each icon must be reachable via tab order and announce its destination,
  matching the accessibility already provided by the hamburger menu's links.
- What happens if a new navigable section is added in the future (a fourth
  item)? Out of scope for this feature, but the chosen layout should not
  visually break with one extra icon (noted only as a forward-looking
  consideration, not a requirement).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The header MUST present the same three navigation
  destinations — Profile, My wishlist, and My library — regardless of screen
  size; only their presentation (icon set vs. hamburger menu) changes.
- **FR-002**: At viewport widths of 768px and above, the header MUST display
  Profile, My wishlist, and My library as three separate, individually
  clickable icon controls positioned on the right side of the header, and
  MUST NOT display the hamburger menu control.
- **FR-003**: At viewport widths below 768px, the header MUST display the
  hamburger menu control on the right side of the header, giving access to
  Profile, My wishlist, and My library as it does today, and MUST NOT display
  the individual icon controls.
- **FR-004**: The header MUST show exactly one of the two navigation
  presentations (icon set or hamburger menu) at any given time — never both
  simultaneously, never neither.
- **FR-005**: Each individual icon control MUST use a visually distinct,
  flat outline/stroke-style icon (line-based, single `currentColor` stroke,
  no fill, no shadows or gradients) consistent with the existing hamburger
  and search icons already in the header, and easily distinguishable from
  the other two.
- **FR-006**: Each individual icon control MUST expose an accessible name
  (e.g., "Profile", "My wishlist", "My library") for assistive technology,
  even though no visible text label is shown alongside the icon.
- **FR-007**: Clicking/activating an icon control MUST navigate to the same
  destination as its equivalent hamburger menu link does today (Profile →
  profile section, My wishlist → wishlist section, My library → library
  section).
- **FR-008**: The switch between icon layout and hamburger menu MUST respond
  to the available header width (e.g., viewport resize, device rotation)
  without requiring a page reload.
- **FR-009**: The hamburger menu behavior and its trigger visibility rules
  already in place (e.g., hidden on the landing page, shown only after
  sign-in) MUST continue to apply unchanged; this feature only changes what
  replaces it on wider screens.
- **FR-010**: The sign-out control MUST remain visible and usable, and MUST
  keep its current text-labeled button appearance unchanged, in both the
  icon layout and the hamburger-menu layout.

### Key Entities

*(No new data entities are introduced — this feature only changes the
presentation and layout of existing navigation destinations.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a wide browser window or large-screen device, a signed-in
  user can reach Profile, My wishlist, or My library in a single click
  directly from the header, with zero intermediate menu-opening steps.
- **SC-002**: On a narrow/mobile viewport, navigation to Profile, My
  wishlist, and My library continues to work exactly as before, with no
  regression in the number of steps or clarity of the hamburger menu.
- **SC-003**: Across 100% of tested viewport widths (from smallest supported
  mobile width to large desktop), the header always shows exactly one
  navigation control style on each side of the 768px threshold — never
  overlapping icons and hamburger, never neither.
- **SC-004**: Keyboard-only and screen-reader users can identify and
  activate all three navigation destinations in the icon layout with the
  same success rate as in the hamburger menu layout today.
- **SC-005**: The three new icons use the same outline/stroke visual
  treatment as the header's existing hamburger and search icons, with no
  visually mismatched icon style introduced in the header.

## Assumptions

- The icon layout reuses the same shared destination list (and therefore
  the same order) as the existing hamburger menu — My library, My wishlist,
  Profile — rather than a new order, so both presentations stay trivially
  in sync; the exact order remains a visual-design decision, not a
  functional requirement.
- The icon-layout/hamburger-menu switch happens at the `md` breakpoint
  (768px), matching the breakpoint already used by the header search box
  (see Clarifications).
- Icons are shown without adjacent visible text labels on the icon layout
  (icon-only buttons), consistent with how the existing hamburger and search
  trigger buttons are already presented in the header; accessible names are
  still required for assistive technology (see FR-006).
- The sign-out control is out of scope for this redesign and keeps its
  current behavior; only the Profile/My wishlist/My library navigation
  presentation changes.
- No new destinations, permissions, or content are introduced — this is a
  presentation/layout change over existing, already-functional navigation
  links.
- This feature applies only to the authenticated app header; the landing
  page's header (where the hamburger menu is already hidden) is unaffected.
