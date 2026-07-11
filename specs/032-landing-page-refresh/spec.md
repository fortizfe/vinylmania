# Feature Specification: Landing Page Refresh

**Feature Branch**: `032-landing-page-refresh`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "En este incremento quiero que se refine la landing del proyecto. Quiero que tenga un aspecto fresco y moderno. Quiero que refleje el objetivo y sentimiento del proyecto. Todo ello desde un punto de vista de usuario final de la aplicación. El sign in debe estar siempre muy accesible. Que se mantenga el look and feel de la aplicación."

## Clarifications

### Session 2026-07-11

- Q: Given FR-009 introduces a darker/higher-contrast palette, what accessibility conformance should the refreshed page target? → A: WCAG 2.1 AA conformance (text/background contrast ≥4.5:1, keyboard & screen-reader support)
- Q: How much visual "proof" should each of the three pillar sections (catalog, ratings, news) include? → A: Icon + short copy only per section — no real app screenshots/mockups
- Q: Besides the sign-in action, what else does the persistent/sticky header contain? → A: Just brand/logo + sign-in action, no anchor nav links
- Q: Should the refreshed landing page introduce any imagery/illustration, or stay typography-and-color only like today? → A: Typography + color only — no imagery or illustration

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First impression reflects product identity (Priority: P1)

As a first-time visitor arriving at Vinylmania's landing page, I want the page to immediately communicate what the product does and feel modern and fresh, aligned with a vinyl-collector / rock-metal music sensibility, so that I understand the value and am inclined to sign in.

**Why this priority**: This is the core ask of the refresh — the landing page's job is to create the right first impression before any conversion action. Without this, the refresh delivers no value.

**Independent Test**: Show the page to a new visitor without prior explanation and ask what the app is for and whether the visual style feels current/appealing. Success = correct value-prop identification and positive aesthetic feedback.

**Acceptance Scenarios**:

1. **Given** a visitor who has never used Vinylmania, **When** they load the landing page, **Then** they see a headline and supporting copy that describes the app's purpose (organizing a vinyl collection via Discogs, personal ratings, and curated rock/metal music news).
2. **Given** the landing page loaded in either light or dark mode, **When** the visitor views it, **Then** the visual styling (color, typography, spacing) is consistent with the rest of the signed-in application's design system.

---

### User Story 2 - Sign-in is always within easy reach (Priority: P2)

As a visitor who has decided to try the app, I want the sign-in action to be easy to find and use at any point while viewing the landing page, so that I can start without hunting for it.

**Why this priority**: Directly tied to the explicit requirement that sign-in must "always be very accessible" — this is the page's primary conversion action.

**Independent Test**: Load the landing page and, at every scroll position and viewport size, confirm the sign-in action is visible or reachable within one interaction, and can be completed successfully.

**Acceptance Scenarios**:

1. **Given** the landing page on any supported device size, **When** the visitor looks at the screen, **Then** the sign-in action is visible without needing to search the page.
2. **Given** the visitor scrolls through any of the page's sections, **When** they want to sign in, **Then** the sign-in action stays visible in a persistent header without them needing to scroll back up.
3. **Given** the visitor selects sign-in, **When** the authentication flow completes successfully, **Then** they are taken into the application exactly as today.

---

### User Story 3 - Visitors get a glimpse of what the product offers (Priority: P3)

As a visitor evaluating whether to sign in, I want to see a brief indication of what's inside the app (my collection, my ratings, curated rock/metal news) before committing, so that I have context for the value of signing in.

**Why this priority**: Reinforces the "reflect objective and feeling of the project" goal and builds conversion confidence, but the refresh remains viable without it if scope needs to be trimmed.

**Independent Test**: Review the landing page content and confirm it references the app's core value pillars (Discogs-backed catalog, personal ratings, curated rock/metal news) without requiring any live backend data on the landing page itself.

**Acceptance Scenarios**:

1. **Given** the landing page, **When** the visitor reads beyond the headline, **Then** they find supporting content describing the app's key value pillars.

---

### Edge Cases

- What happens on very small viewports (narrow phones) — does the sticky sign-in header stay usable and not crowd out the visible content?
- How does the page behave for a visitor who is already authenticated? (existing redirect-into-app behavior must be preserved)
- How does the page appear when a visitor has a system-level reduced-motion or high-contrast preference set, if any motion/animation is introduced?
- How does the page ensure the FR-009 darker/higher-contrast palette still meets the FR-010 WCAG 2.1 AA contrast minimum across all text/background pairings, including within the pillar section icons?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST present a headline and supporting copy that communicates Vinylmania's purpose to a first-time visitor.
- **FR-002**: The landing page's visual design (color palette, typography, spacing, component styles) MUST remain consistent with the design system used elsewhere in the signed-in application, in both light and dark themes.
- **FR-003**: The sign-in action MUST be visible or reachable without extended searching, at every scroll position and viewport size the page supports (satisfied by the persistent-header mechanism in FR-008).
- **FR-004**: The landing page MUST preserve the existing sign-in mechanism and its current behaviors (loading state, inline error messaging) without altering how authentication itself works.
- **FR-005**: The landing page MUST remain responsive and usable across common device sizes (mobile, tablet, desktop).
- **FR-006**: The landing page MUST continue to redirect an already-authenticated visitor into the application rather than showing landing content.
- **FR-007**: The landing page MUST expand beyond today's single headline + sign-in into a scrollable page with distinct sections that showcase the product's core pillars: the Discogs-backed catalog, personal ratings, and curated rock/metal news. Each pillar section MUST be presented as an icon paired with short supporting copy — no real app screenshots or UI mockups are included.
- **FR-008**: The sign-in action MUST be presented in a persistent (sticky) header — containing only the app's brand/logo and the sign-in action, with no anchor navigation links — that remains visible at every scroll position as the visitor moves through the page's sections.
- **FR-009**: The landing page's visual treatment MUST use subtle rock/metal-inflected styling (e.g., a darker/higher-contrast palette, expressive typography) achieved through color and type choices only — no illustration or photographic imagery — layered on top of the app's existing design tokens, and remaining clean, legible, and welcoming to any music collector rather than genre-exclusionary or overly dark/aggressive.
- **FR-010**: The landing page MUST conform to WCAG 2.1 AA accessibility standards, including minimum 4.5:1 text/background contrast ratios (checked against the FR-009 palette), full keyboard operability, and screen-reader-compatible markup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First-time visitors can state, in their own words, what Vinylmania does within 5 seconds of viewing the landing page.
- **SC-002**: The sign-in action is discoverable and actionable in under 5 seconds by a new visitor on both desktop and mobile viewports.
- **SC-003**: In a design review with at least 3 independent reviewers who each answer "does this look modern/fresh, yes or no", at least 90% answer "yes".
- **SC-004**: The redesigned page maintains or improves the sign-in completion rate compared to the current landing page (no regression in conversion).
- **SC-005**: The page renders correctly with the sign-in action reachable and no layout breakage across mobile, tablet, and desktop viewport widths.
- **SC-006**: An automated accessibility audit reports zero WCAG 2.1 AA contrast or keyboard-navigation violations on the landing page.

## Assumptions

- The existing Google sign-in mechanism, its loading/error states, and the post-login redirect behavior are reused as-is; this refresh is scoped to visual presentation and copy, not authentication logic.
- "Look and feel of the application" refers to the existing Tailwind-based design tokens (color palette, typography, dark mode support) already used in the signed-in app shell; the landing page should draw from these rather than introduce a separate visual language.
- No new backend data or API integration is required for the landing page refresh; any product-pillar copy (collection, ratings, news) is static marketing copy, not live data.
- The refresh targets only the existing unauthenticated landing route; it does not change the authenticated app experience.
