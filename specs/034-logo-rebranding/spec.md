# Feature Specification: Adopt New Vinylmania Logo Branding

**Feature Branch**: `035-logo-rebranding`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "He añadido los diseños de logos par ala app. Hay logos generales, grandes, pequeños, diseños para incluir en el header, para desktop y para mobile. Tanto para dark mode como para light mode. Los diseños están en la carpeta docs/Vinylmania design brief/Vinylmania Logo - Final.dc.html. Quiero modificar el branding de toda la app para adoptar los diseños propuestos en el documento antes mencionado. A tener en cuenta el uso adecuado de cada diseño en función de donde debe ser usado, landing, header, etc."

## Clarifications

### Session 2026-07-11

- Q: The design brief applies a distressed/"grunge" filter effect to the "VINYLMANIA" wordmark. Does this effect apply everywhere the wordmark appears, or only at large sizes? → A: Grunge filter only on large-format placements (landing hero, general logo); the header lockup wordmark uses clean (non-filtered) Anton typography.
- Q: The brief's wordmark uses a custom Google Font ("Anton"), which the app doesn't currently load anywhere. Should the spec require adopting it, or approximating the look with existing fonts? → A: Adopt Anton (Google Fonts) for every wordmark placement, matching the brief exactly; a loading strategy to avoid layout shift/flash is required per the constitution's "No layout shift" rule.
- Q: Should the header brand mark (icon + wordmark) use a fixed pixel size at every desktop width, or scale up on ultra-wide viewports? → A: Fixed size, never scales — the header lockup stays at one fixed size (matching the brief's header reference: 36px icon / 20px wordmark) at every desktop width, including ultra-wide monitors.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize the new brand mark in the app header (Priority: P1)

A signed-in collector browsing any page of the app sees the new Vinylmania brand mark in the persistent header — the icon-and-wordmark lockup on desktop, and the icon alone on mobile — instead of today's plain text "Vinylmania" label, correctly matching whichever light or dark theme they're using.

**Why this priority**: The authenticated header is visible on every single page of the app, every session — it is by far the most frequently seen brand placement. Getting this right delivers the large majority of the rebranding's visible impact on its own.

**Independent Test**: Can be fully tested by signing in and viewing any app page at both a desktop width and a mobile width, in both light and dark theme, and confirming the header shows the new icon (mobile) or icon+wordmark lockup (desktop) matching the design brief, rather than plain text.

**Acceptance Scenarios**:

1. **Given** a signed-in user on a desktop-width viewport, **When** they view any app page, **Then** the header shows the icon-and-wordmark lockup from the design brief (wordmark in clean, non-grunge typography) in place of the current plain-text "Vinylmania" label.
2. **Given** a signed-in user on a mobile-width viewport, **When** they view any app page, **Then** the header shows the icon-only mark from the design brief (no wordmark), sized and positioned so it doesn't crowd the existing navigation controls (hamburger menu, icons).
3. **Given** the app is in light theme, **When** the header renders, **Then** it shows the light-context brand mark variant (as defined in the design brief for a light background).
4. **Given** the app is in dark theme, **When** the header renders, **Then** it shows the dark-context brand mark variant (as defined in the design brief for a dark background), with no visible flash of the wrong variant on load or on theme toggle.
5. **Given** the header brand mark is displayed, **When** the user selects it, **Then** it navigates to the app's home/dashboard route, exactly as the current text label does today.

---

### User Story 2 - See the new brand mark on the landing page (Priority: P2)

A first-time or signed-out visitor lands on the marketing/landing page and sees the new Vinylmania brand mark — the full icon-and-wordmark lockup — in both the sticky landing header and the hero section, instead of today's plain text, in whichever theme (light/dark) the landing page is showing.

**Why this priority**: The landing page is the first impression for new visitors and is a distinct, independently valuable placement from the authenticated header, but it's seen less often overall (once per new visitor) than the in-app header (every session for existing collectors) — hence it follows User Story 1 in priority.

**Independent Test**: Can be fully tested by visiting the landing page signed out, at both desktop and mobile widths and in both themes, and confirming the sticky header and hero section both show the new brand mark instead of plain text.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on the landing page, **When** the page loads, **Then** the sticky landing header shows the icon-and-wordmark lockup instead of the current plain-text "Vinylmania" label.
2. **Given** a signed-out visitor on the landing page, **When** they view the hero section, **Then** it shows the general/full brand mark (icon + wordmark, wordmark with the brief's grunge filter effect) instead of the current plain-text heading.
3. **Given** the landing page is in light or dark theme, **When** the brand mark renders in the header or hero, **Then** it shows the variant matching that theme, consistent with User Story 1's light/dark behavior.

---

### User Story 3 - See the new icon as the browser tab favicon (Priority: P3)

A user with the app open in a browser tab sees the new circular "VM" icon as the tab favicon, instead of today's unrelated abstract mark, so the browser tab/bookmark visually matches the rest of the rebranded app.

**Why this priority**: The favicon is a small, single, low-frequency-interaction placement (glanced at, not directly interacted with) — valuable for brand consistency but the smallest, most self-contained piece of this rebranding.

**Independent Test**: Can be fully tested by loading any app page and confirming the browser tab icon is the new circular "VM" mark rather than the current favicon.

**Acceptance Scenarios**:

1. **Given** any app page is open in a browser tab, **When** the user looks at the tab, **Then** the favicon shown is the new circular "VM" icon design, replacing the current unrelated favicon.
2. **Given** the favicon is displayed at typical browser tab/bookmark sizes, **When** rendered small, **Then** it remains legible and recognizable (consistent with the design brief's small-size favicon reference crops).

---

### Edge Cases

- What happens at the narrowest supported mobile viewport (320px, per the constitution's dual-layout requirement)? The icon-only mobile mark MUST remain fully visible and unclipped alongside the existing hamburger/sign-in controls, with no overlap.
- What happens during the brief window between initial page paint and the app's theme becoming active? The brand mark MUST NOT flash the wrong light/dark variant, consistent with the app's existing no-flash theme bootstrap behavior.
- What happens when a user has never set an explicit theme preference (following the OS setting)? The brand mark MUST still show the variant matching whichever theme (light/dark) is actually active, exactly like every other themed element in the app.
- What happens on an ultra-wide desktop viewport? The header lockup MUST stay at one fixed size (36px icon / 20px wordmark, per the brief's header reference) at every desktop width, including ultra-wide monitors — it MUST NOT stretch, blur, or scale up.
- What happens to browser tabs that already have the old favicon cached? Standard browser favicon caching behavior applies; no special cache-busting is required beyond what the browser already does for a changed favicon file.
- What happens while the new "Anton" wordmark font is still loading (slow network, first visit)? The wordmark MUST NOT visibly shift layout or flash unstyled/oversized fallback text while the font loads; a fallback font MUST occupy equivalent space until "Anton" is ready.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The authenticated app header MUST display the new brand mark: the icon-and-wordmark lockup at desktop-width viewports, and the icon alone (no wordmark) at mobile-width viewports, replacing the current plain-text "Vinylmania" label.
- **FR-002**: The landing page's sticky header and hero section MUST display the new brand mark (icon-and-wordmark lockup) in place of their current plain-text "Vinylmania" label/heading.
- **FR-003**: Every brand-mark placement (app header, landing header, landing hero) MUST render the light-background or dark-background variant matching the app's currently active theme, using the existing theme-detection mechanism, with no flash of the wrong variant on load or on theme toggle.
- **FR-004**: The browser tab favicon MUST be replaced with the new circular "VM" icon design, legible at typical small browser-tab sizes.
- **FR-005**: The header brand mark (wherever shown) MUST remain a clickable link to the app's home/dashboard route, preserving current navigation behavior.
- **FR-006**: Every brand-mark placement MUST expose "Vinylmania" as its accessible name (e.g., via link/image accessible-name conventions) so screen reader users are not regressed relative to today's plain-text label.
- **FR-007**: The distinctive wordmark typography from the design brief MUST be used only where the brief specifies a wordmark (general/full logo, desktop header lockup, landing hero) — the mobile icon-only placement MUST NOT include the wordmark, consistent with the brief.
- **FR-008**: The header brand mark MUST NOT visually crowd or overlap other existing header elements (navigation icons, hamburger menu, sign-in button) at any supported viewport width, consistent with the constitution's dual-layout and touch-target requirements.
- **FR-009**: The colors, proportions, and typography used for each brand-mark placement MUST match the corresponding variant defined in `docs/Vinylmania design brief/Vinylmania Logo - Final.dc.html` (general logo, header lockup, mobile icon-only, light/dark variants).
- **FR-010**: The wordmark MUST use the "Anton" display font specified in the design brief, loaded for every wordmark placement; the loading strategy MUST NOT cause a visible layout shift or a jarring font swap on any page that shows the wordmark, consistent with the constitution's "No layout shift" rule.
- **FR-011**: The desktop header lockup (icon + wordmark) MUST render at one fixed size (36px icon / 20px wordmark, per the brief's header reference) at every desktop viewport width, including ultra-wide monitors — it MUST NOT scale up, stretch, or blur as the viewport widens.
- **FR-012**: The wordmark's distressed/"grunge" filter effect MUST be applied only to large-format placements (landing hero, general logo); the desktop header lockup wordmark MUST use clean (non-filtered) typography, since the grunge distortion is not legible/intentional-looking at small header sizes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing app pages (authenticated header) and the landing page (header + hero) show the new brand mark in place of the old plain-text label, verified by a visual audit across every existing route.
- **SC-002**: The correct light or dark brand-mark variant is shown with zero visible flash of the wrong variant, on first load and on every theme toggle, across all placements.
- **SC-003**: 100% of app pages show the new favicon in the browser tab, replacing the previous unrelated mark.
- **SC-004**: No existing header behavior regresses: sign-in, sign-out, and header navigation (profile/library/wishlist, hamburger menu) continue to work exactly as before the brand-mark change, verified by the existing header/navigation/sign-in test coverage continuing to pass.
- **SC-005**: The mobile icon-only header mark and the desktop icon-and-wordmark lockup both remain fully visible, unclipped, and non-overlapping with other header controls at viewport widths from 320px up through ultra-wide desktop.

## Assumptions

- The design brief file (`docs/Vinylmania design brief/Vinylmania Logo - Final.dc.html`) is the authoritative source for exact colors, proportions, and typography for every brand-mark variant; how those designs are technically packaged/delivered (e.g., exported SVG files vs. inline markup, specific component structure) is a planning-level decision outside this spec's scope.
- Dark/light variant selection reuses the app's existing theme-detection mechanism (the same one already driving every other themed element); no new theme-detection logic is introduced by this feature.
- The monochrome brand-mark variants shown in the design brief are reference assets for potential future or external use (e.g., print, merchandise, social media) — this feature does not require them to appear anywhere in the live app UI, since the user did not specify an in-app placement for them.
- This feature covers the browser-tab favicon only; app-install icons (e.g., a PWA manifest, Apple touch icons) are out of scope unless such a manifest already exists, since none was found in the current setup.
- The header's existing sticky positioning, sign-in call-to-action placement, and other non-brand navigation elements are unchanged — only the brand-mark portion of the header/hero is replaced.
- Any additional pages/surfaces not explicitly called out (e.g., email templates, social share previews) are out of scope for this feature unless they currently show the old brand mark in a way discovered during implementation.
