# Feature Specification: Theme Preference Toggle & Dark Mode Polish

**Feature Branch**: `031-theme-toggle-preferences`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "En este incremento quiero trabajar en pulir el modo claro y oscuro. Lo primero será añadir un control de tipo toggle a la página de perfil del usuario. Crea en dicha página la sección preferencias y añade este control como primera preferencia por ahora. Me gustaría que el diseño del toggle sea con diseño moderno. Un sol con fondo de cielo azul y nubes en la posición de habilitar el modo claro y una luna con fondo de cielo nocturno con estrellas en la posiciónn de habilitar el modo oscuro. También quiero que hagas un retoque en los colores y estilos generales del modo oscuro para que sea un poco más oscurecido que ahora mismo. La preferencia seleccionada por el usuario debe recordarse y persisitir en firebase. Propon cualquier mejora sobre este aspecto que consideres interesante."

## Clarifications

### Session 2026-07-11

- Q: When a signed-in user with an explicit saved preference loads the app, should the correct theme paint instantly, or is a brief flash of the default/OS theme acceptable while Firebase loads? → A: Cache the last-known preference locally (e.g., on-device storage) so the correct theme paints instantly on load, then reconcile with Firebase in the background.
- Q: If saving the preference to Firebase ultimately fails after retries, should the user see any indication of that, or should it fail silently? → A: Show a subtle, non-blocking notification (e.g., a toast) so the user knows their preference may not persist across devices/sessions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch theme from the profile page (Priority: P1)

A signed-in collector opens their profile page, finds a new "Preferences" section, and uses a sun/moon toggle control to switch the whole application between light mode and dark mode with a single interaction. The toggle shows a sun on a blue sky with clouds when light mode is enabled, and a moon on a starry night sky when dark mode is enabled.

**Why this priority**: This is the core, visible deliverable of the increment — without it, there is no user-controllable theme at all. It is also the foundation every other story depends on (nothing to persist or darken without a working control).

**Independent Test**: Can be fully tested by opening the profile page, locating the new "Preferences" section with the theme toggle as its first control, and confirming that clicking/tapping it switches every visible surface of the app between light and dark styling immediately, with the toggle's sun/moon artwork reflecting the active mode.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the profile page, **When** the page loads, **Then** a "Preferences" section is visible and the theme toggle is its first item, visually indicating the currently active theme (sun/blue sky/clouds for light, moon/night sky/stars for dark).
2. **Given** the app is currently in light mode, **When** the user activates the toggle, **Then** the entire application (not just the profile page) switches to dark mode and the toggle now shows the moon/night-sky artwork.
3. **Given** the app is currently in dark mode, **When** the user activates the toggle, **Then** the entire application switches to light mode and the toggle now shows the sun/blue-sky artwork.
4. **Given** a user navigating with a keyboard or screen reader, **When** they reach the toggle, **Then** they can determine its current state and activate it without a mouse.

---

### User Story 2 - Theme preference follows the user across sessions and devices (Priority: P2)

A signed-in collector who has chosen a theme wants that choice remembered — when they close the app and come back later, or sign in from a different browser or device, the app should already be showing their preferred theme instead of resetting to a default.

**Why this priority**: Persistence is what turns the toggle from a one-off cosmetic interaction into a real preference. It depends on Story 1 existing but delivers independent, testable value (the toggle could ship without persistence and still work within a single session).

**Independent Test**: Can be fully tested by setting a theme via the toggle, reloading the page (or signing out and back in, or signing in from another browser), and confirming the previously chosen theme is applied automatically without the user needing to toggle again.

**Acceptance Scenarios**:

1. **Given** a signed-in user sets the theme to dark, **When** they reload the page or sign in again later, **Then** the app opens in dark mode without any extra action from the user.
2. **Given** a signed-in user has an explicit saved preference, **When** the app loads (including before the account's data has finished loading from Firebase), **Then** the correct theme paints immediately, without a visible flash of the default/OS theme first.
3. **Given** a user has set a theme preference on one device, **When** they sign in on a different device or browser, **Then** the same preference is applied there too.
4. **Given** a user has never explicitly set a preference, **When** they visit the app, **Then** it falls back to the current default behavior (matching the operating system's light/dark setting) rather than forcing a specific theme.
5. **Given** the preference cannot be saved (e.g., a temporary connectivity problem), **When** the user toggles the theme, **Then** the visual change still applies immediately and the user is not blocked, while the system makes a reasonable effort to retry saving.

---

### User Story 3 - More legible, deliberately darker dark mode (Priority: P3)

A collector who prefers dark mode finds the current dark styling too close to the light palette in places (low contrast, "washed out" feel). After this increment, dark mode across the app uses a deliberately deeper, more consistent dark palette that is easier on the eyes and reads clearly as "dark mode."

**Why this priority**: This is a visual polish pass that improves the experience for existing dark-mode users but does not block the toggle or persistence functionality from shipping, so it is independently valuable and independently testable.

**Independent Test**: Can be fully tested by enabling dark mode and visually/programmatically comparing background, surface, and text colors on key screens (dashboard, search, record detail, profile) against the previous palette, confirming they are darker and meet standard text-contrast expectations.

**Acceptance Scenarios**:

1. **Given** dark mode is active, **When** the user browses the dashboard, search results, record detail, and profile pages, **Then** background and surface colors are visibly darker than before this increment, with a consistent look across all of them.
2. **Given** dark mode is active, **When** the user reads body text, labels, and headings on any screen, **Then** text remains clearly legible against the darker backgrounds (meeting standard accessibility contrast expectations).
3. **Given** dark mode is active, **When** the user views cards, badges, and other UI elements that previously blended into the background, **Then** those elements remain visually distinguishable from their surrounding surface.

---

### Edge Cases

- What happens when a brand-new user (no stored preference yet) opens the app for the first time? System falls back to the operating system's light/dark setting, and no explicit preference is written until the user actively toggles.
- What happens if the user changes their operating system's theme setting after already choosing an explicit in-app preference? The explicit in-app preference takes precedence over the OS setting until the user changes it again via the toggle.
- What happens if saving the preference to Firebase fails (network issue, backend unavailable)? The theme change still applies locally right away; the system retries saving and does not silently lose the user's choice or block further use of the app. If the save ultimately fails after retries, the user sees a subtle, non-blocking notification that the preference may not persist across devices/sessions.
- What happens if the user toggles the control rapidly multiple times in a row? Only the final selected state is persisted; no intermediate flicker or lost update should leave the UI and the saved preference out of sync.
- What happens when the same account is open in two tabs or two devices at once and the theme is changed in one of them? The other open sessions are not required to update instantly, but the next time each of them loads or reconnects, they reflect the latest saved preference.
- What happens on a user's very first sign-in immediately after account creation? Same as the first bullet — default to OS setting until an explicit choice is made.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The user profile page MUST include a "Preferences" section, and the theme toggle MUST be the first control within that section.
- **FR-002**: The Preferences section MUST provide a two-state toggle control for switching between light mode and dark mode.
- **FR-003**: The toggle control MUST visually represent the light-mode state as a sun with a blue sky and clouds, and the dark-mode state as a moon with a night sky and stars, using a modern toggle-switch presentation.
- **FR-004**: Activating the toggle MUST immediately apply the selected theme across the entire application, not only the profile page.
- **FR-005**: The system MUST persist the signed-in user's selected theme preference as part of their account data in Firebase.
- **FR-006**: On any subsequent sign-in — same device or a different one — the system MUST automatically apply the user's last saved theme preference without requiring the user to toggle again.
- **FR-007**: When a user has no explicit saved preference, the system MUST fall back to the current default behavior of following the operating system's light/dark setting.
- **FR-008**: Once a user has set an explicit preference, that preference MUST take precedence over the operating system's setting until the user changes it again.
- **FR-009**: The toggle control MUST be operable via keyboard and MUST expose its current state (light/dark) to assistive technology.
- **FR-010**: If persisting the preference to Firebase fails, the system MUST still apply the chosen theme locally and MUST make a reasonable attempt to retry the save without blocking the user's continued use of the app.
- **FR-011**: If saving the preference ultimately fails after retries, the system MUST show the user a subtle, non-blocking notification indicating the preference may not persist across devices/sessions.
- **FR-012**: The theme preference MUST persist independently of other profile edits — editing unrelated profile information MUST NOT reset or lose the saved theme preference.
- **FR-013**: The dark-mode color palette and styling MUST be updated to be visibly darker and more consistent than the current implementation across all major screens (dashboard, search, record detail, profile, and other primary views).
- **FR-014**: Text and interactive elements in dark mode MUST remain clearly legible against the darker backgrounds, meeting standard accessibility contrast expectations.
- **FR-015**: For a signed-in user with an explicit saved preference, the system MUST cache the last-known theme preference locally on the device so the correct theme paints immediately when the app loads, without waiting for the account's preference to finish loading from Firebase, then reconcile with the Firebase value once it arrives.

### Key Entities

- **Theme Preference**: A per-account setting representing the collector's chosen theme (light or dark). Belongs to a single user account, has no value until the user makes an explicit choice (in which case the app falls back to the system setting), and persists until the user changes it again.
- **User Account** *(existing entity)*: Gains an association to the Theme Preference described above, alongside its existing profile attributes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can switch the entire application's theme in a single interaction with the toggle, with the visual change appearing instantly (no full page reload required).
- **SC-002**: 100% of users who have explicitly set a theme preference see that exact preference automatically applied the next time they open the app, on any device, without needing to re-select it, and without a visible flash of a different theme first.
- **SC-003**: A saved theme preference remains in effect indefinitely until the user actively changes it — it is never silently reset by unrelated actions (e.g., editing other profile information, signing out and back in).
- **SC-004**: After the dark-mode polish, text and key UI elements across all major screens meet standard accessibility text-contrast expectations (WCAG 2.1 AA) against their backgrounds.
- **SC-005**: The theme toggle is fully operable using keyboard-only navigation and is correctly announced by screen readers (current state and how to change it).
- **SC-006**: In an informal first-use check, users can identify what the toggle does and which mode is currently active from its sun/moon artwork alone, without needing additional labels or instructions.
- **SC-007**: When a preference save ultimately fails after retries, 100% of affected users are shown a non-blocking notification of the issue, and the app otherwise remains fully usable (no blocked interactions).

## Assumptions

- The theme toggle supports two explicit states only (light, dark); there is no third "automatic/system" option in this increment beyond the unset/default fallback described in FR-007. Adding an explicit "automatic" option is listed under Suggested Enhancements below.
- The local cache used for instant theme painting (FR-015) is a performance/UX optimization only — Firebase remains the source of truth for the preference; the local cache is reconciled with (and overridden by) the Firebase value once it loads, so a stale local cache never permanently overrides a preference saved from another device.
- The profile page (and therefore the Preferences section) is only reachable by signed-in users, consistent with the rest of the app's existing access model, so Firebase-backed persistence is scoped to authenticated accounts.
- "A bit more darkened" is interpreted as: dark-mode backgrounds and surfaces should move to a deeper, more consistent set of dark tones than the current ad hoc usage, while all text and interactive elements continue to meet WCAG 2.1 AA contrast — the exact palette values are a design/implementation decision, not a fixed requirement of this spec.
- "Preferences" is being introduced as a section that will hold more than just the theme toggle over time; this increment adds only the theme control, but the section is expected to be extended with further preferences later (per the user's framing of this as "the first preference for now").
- Unauthenticated visitors (e.g., on a public/login screen) continue to see the OS-driven default theme, since there is no account yet to attach an explicit preference to.

## Suggested Enhancements *(proposed, out of scope for this increment)*

The user asked for any interesting improvements to consider around this theme/preference work. These are proposals only, not commitments for this increment:

- **Cross-tab sync**: if a user changes the theme in one open tab, reflect the change live in other open tabs of the same session instead of waiting for a reload.
- **Explicit "Automatic (match device)" option**: extend the two-state toggle to a three-way choice (Light / Dark / Automatic) for users who want to keep following their OS setting even after visiting Preferences once.
- **Smooth transition animation**: a brief, subtle cross-fade or color transition when switching themes, so the change feels intentional rather than an abrupt flash.
- **Preferences section growth**: since this establishes the first entry in "Preferences," consider what else belongs there next (e.g., notification settings, language/region, default library view) so the section's structure anticipates future entries rather than being rebuilt each time.
- **Usage insight**: lightweight, privacy-respecting tracking of how many users switch away from the OS default, to inform whether dark mode should become the default in a future release.
