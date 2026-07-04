# Feature Specification: App Navigation — Hamburger Menu, Dashboard & Back Navigation

**Feature Branch**: `007-app-navigation-menu`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "En el siguiente desarrollo quiero empezar a diseñar el menú hamburger del header de la aplicación y definir un poco la navegación. Los requisitos del desarrollo son los siguientes: 1. El punto de entrada de la app no será directo a la biblioteca, sino que será a una sección llamada Dashboard. No es necesario que aparezca en el menú, ya que se podrá navegar haciendo click en el logo/nombre de la app en el header. No es necesario el desarrollo del dashboard, simplemente que aparezca 'under construction'. 2. El menú del header debe tener las siguientes opciones: Mi biblioteca, Mi lista de deseos, Perfil. El desarrollo de las páginas que aún no existen no es responsabilidad de este desarrollo; es suficiente con que se haga la navegación y se vea en la pantalla 'under construction'. 3. El menú hamburguer no debe ser ni visible, ni interactuable ni invocable desde la landing de la app. Solo se mostrará una vez se haya hecho login. 4. Diseña y desarrolla el menú hamburguer teniendo en cuenta que sea usable tanto desde navegadores web como desde dispositivos móviles. 5. Cada una de las secciones de la aplicación deben tener la posibilidad de volver atrás. Se propone una flecha en la zona superior izquierda de cada vista pero puedes investigar y proponer cuál sería la mejor zona para colocarla."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Land on a Dashboard after signing in (Priority: P1)

As a collector who just signed in, I want to arrive at a Dashboard section
instead of being dropped straight into my library, and be able to return to
that Dashboard at any time by clicking the app's logo/name, so the app has a
clear "home" I can always get back to.

**Why this priority**: This changes the app's entry point and is foundational
to the rest of the navigation redesign — the hamburger menu and back
navigation are both defined relative to this new home.

**Independent Test**: Can be fully tested by signing in and confirming the
Dashboard section (showing an "under construction" placeholder) is what
appears, then navigating to any other authenticated section and confirming
clicking the logo/app name returns to the Dashboard.

**Acceptance Scenarios**:

1. **Given** a collector signs in, **When** authentication completes, **Then**
   they land on the Dashboard section showing an "under construction"
   placeholder.
2. **Given** a collector is anywhere in the authenticated app, **When** they
   click the logo/app name in the header, **Then** they are taken to the
   Dashboard.
3. **Given** the Dashboard is not a fully built section yet, **When** it is
   shown, **Then** it clearly communicates it is under construction rather
   than appearing broken or empty.

---

### User Story 2 - Navigate the app through the hamburger menu (Priority: P1)

As a signed-in collector, I want a menu in the header offering "My library",
"My wishlist", and "Profile", so I can get to every major area of the app
from anywhere, even the ones that aren't built yet.

**Why this priority**: This is the core deliverable requested — a working
navigation menu — and it delivers value the moment it exists, independent of
whether the destination sections are fully built.

**Independent Test**: Can be fully tested by opening the menu from any
authenticated screen and confirming all three options are present and each
navigates to its destination — "My library" to the existing library screen,
"My wishlist" and "Profile" to an "under construction" placeholder each.

**Acceptance Scenarios**:

1. **Given** a signed-in collector on any authenticated screen, **When** they
   open the header menu, **Then** they see exactly three options: "My
   library", "My wishlist", and "Profile".
2. **Given** the menu is open, **When** the collector selects "My library",
   **Then** they are taken to the existing library section.
3. **Given** the menu is open, **When** the collector selects "My wishlist"
   or "Profile", **Then** they are taken to that section and see an "under
   construction" placeholder, since neither is built yet.
4. **Given** the collector is using a narrow (mobile-width) viewport, **When**
   they open and use the menu, **Then** every option remains reachable and
   tappable without being cut off or overlapping other content.
5. **Given** the collector is using a wide (desktop-width) viewport, **When**
   they open and use the menu, **Then** it behaves the same way (same
   options, same destinations) as on a narrow viewport.

---

### User Story 3 - Go back from any section (Priority: P2)

As a collector browsing the app, I want a consistent way to go back to where
I came from on every screen, so I never feel stuck or have to rely on my
browser's own back button.

**Why this priority**: This improves navigation confidence across the whole
app, but the app remains usable without it (the existing browser back button
and header logo already provide some way out), so it's lower priority than
having the menu and Dashboard in place at all.

**Independent Test**: Can be fully tested by navigating into any section
reached from the library (e.g. a record's detail) or from the menu, and
confirming a consistent back action is available and returns to the expected
previous section.

**Acceptance Scenarios**:

1. **Given** a collector is on a section reached from another section (e.g.
   a record's detail page, reached from the library), **When** they look for
   a way back, **Then** a consistently placed back action is available and
   returns them to that section.
2. **Given** a collector uses the back action from a given section, **When**
   they activate it, **Then** they return to the section they most recently
   came from, not an arbitrary or unrelated screen.
3. **Given** the back action appears on more than one section, **When**
   comparing its position/appearance across sections, **Then** it is in the
   same place and looks/behaves the same way everywhere it appears.

---

### Edge Cases

- The hamburger menu (and any trigger for it) MUST NOT appear, respond to
  interaction, or be reachable in any way on the landing page (the
  unauthenticated entry screen) — it only exists once a collector has signed
  in.
- What happens if a collector is on the Dashboard, wishlist, or profile
  placeholder and tries to go back? The back action MUST behave consistently
  with every other section per User Story 3's resolution, without leading to
  a dead end or an error state.
- What happens if a collector opens the menu and then decides not to
  navigate anywhere? Closing the menu without making a selection MUST leave
  them exactly where they were, with no navigation occurring.
- What happens on a very narrow viewport where the header also contains the
  logo/name and (today) a sign-out control? The menu trigger MUST remain
  reachable and unambiguous alongside that existing control, per FR-011.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After signing in, collectors MUST land on a Dashboard section
  rather than directly on their library.
- **FR-002**: The Dashboard MUST clearly display that it is under
  construction; no further functionality is required of it in this feature.
- **FR-003**: Clicking the logo/app name in the header MUST navigate to the
  Dashboard from anywhere in the authenticated app.
- **FR-004**: The Dashboard MUST NOT appear as an option inside the
  hamburger menu — it is reached only via the logo/app name.
- **FR-005**: The header MUST provide a menu with exactly three options: "My
  library", "My wishlist", and "Profile".
- **FR-006**: Selecting "My library" MUST navigate to the existing library
  section, unchanged in behavior from today.
- **FR-007**: Selecting "My wishlist" or "Profile" MUST navigate to a
  section that clearly displays an "under construction" placeholder, since
  building those sections is out of scope for this feature.
- **FR-008**: The hamburger menu (including its trigger) MUST NOT be
  visible, interactive, or reachable in any way on the landing page; it MUST
  only appear once a collector has signed in.
- **FR-009**: The hamburger menu MUST be fully usable — visible, operable,
  and legible — on both desktop-browser and mobile-device viewports, using a
  single consistent design rather than unrelated designs per device type.
- **FR-010**: Every section of the authenticated app that is reached by
  navigating deeper from another section (e.g. a record's detail, the add-
  record flow) MUST offer a consistent way to go back to where the collector
  came from.
- **FR-011**: The back action's position and appearance MUST be consistent
  across every section that has one, so collectors learn its location once
  and can rely on it everywhere.
- **FR-012**: Opening the menu MUST NOT itself navigate anywhere; navigation
  MUST only occur when the collector selects one of its options.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful sign-ins land the collector on the
  Dashboard rather than the library.
- **SC-002**: From any authenticated screen, a collector can reach any of
  the four destinations (Dashboard via logo, library, wishlist, profile) in
  a single additional action (one click/tap beyond opening the menu, or a
  single click on the logo).
- **SC-003**: Collectors can operate the full menu (open it and select any
  option) equally well on a narrow mobile-width viewport and a wide desktop-
  width viewport, with no option becoming unreachable or unusable on either.
- **SC-004**: The hamburger menu never appears or responds to any
  interaction on the landing page, verified across both viewport sizes.
- **SC-005**: Every section with a back action places it in the same
  location, so a collector who learns it once can find it on any other
  section without re-learning.

## Assumptions

- "My library" continues to mean the existing library section (today's
  `/app`); this feature does not change what that section does, only how it
  is reached.
- "My wishlist" and "Profile" are new, currently non-existent sections; per
  the request, this feature only needs to make them reachable and show an
  "under construction" placeholder — no wishlist or profile functionality is
  built here.
- The existing sign-in/sign-out flow and the existing library, add-record,
  and record-detail sections are unaffected by this feature except where
  explicitly changed above (entry point, and the addition of a back action).
- A top-left back arrow (as proposed) is a well-established, widely
  recognized convention for "return to the previous section" in both web and
  mobile interfaces, and is adopted as the back action's consistent
  position referenced in FR-011, rather than relying solely on the browser's
  own back button.
- The hamburger menu is presented as a single, consistent design (e.g. an
  icon that opens a panel listing the three options) that adapts to
  available space rather than using entirely different navigation patterns
  for desktop versus mobile.
- Sections reached directly from the hamburger menu or the logo (Dashboard,
  My library, My wishlist, Profile) are the app's top-level destinations and
  don't require their own back action, since they are always one menu
  selection away from each other; the back action specifically addresses
  sections reached by navigating deeper from a top-level destination (e.g.
  a record's detail, or the add-record flow, both reached from My library).
- Introducing the Dashboard as the new sign-in destination means the
  existing library section moves to its own distinct address separate from
  the Dashboard's, so each can be linked to and returned to independently;
  the exact addressing scheme is a planning-phase detail.
