# Feature Specification: Landing Page & Google Sign-In

**Feature Branch**: `001-landing-google-login`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "La primera funcionalidad que quiero es crear la landing page y el login contra firebase usando las cuentas de google. la landing debe ser sencilla, de aspecto plano y moderno y mostrar rápidamente el objetivo de la app. El login with google debe estar accesible y visible sin necesidad de scroll. Configura lo necesario para usar firebase, el back y el front para el login."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the app at a glance (Priority: P1)

A first-time visitor lands on the site and, without scrolling or clicking anything,
understands what Vinylmania does (help vinyl collectors manage and organize their
personal record library) and what to do next.

**Why this priority**: If visitors don't understand the value within seconds, they
leave before ever attempting to sign in. This is the entry point for every other
feature in the product.

**Independent Test**: Load the landing page on a fresh browser session (no prior
visit) at common desktop and mobile viewport sizes and confirm the app's purpose is
readable without scrolling.

**Acceptance Scenarios**:

1. **Given** a visitor who has never used the app, **When** they open the landing
   page, **Then** they see a short, clear statement of what the app is for within
   the first viewport (no scrolling required).
2. **Given** a visitor on a mobile-sized screen, **When** they open the landing
   page, **Then** the value proposition and layout remain legible and uncluttered
   (flat, modern visual style).

---

### User Story 2 - Sign in with Google (Priority: P1)

A visitor decides to use the app and signs in using their existing Google account,
without needing to create a new username/password.

**Why this priority**: Google sign-in is the only entry point into the app for this
release; without it nobody can reach any other feature.

**Independent Test**: From the landing page, click the "Sign in with Google" call
to action, complete the Google account chooser/consent flow, and confirm the user
ends up authenticated with their identity recognized by the system.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they look at the page without
   scrolling, **Then** the "Sign in with Google" action is visible and reachable.
2. **Given** a visitor clicks "Sign in with Google", **When** they select a Google
   account and grant consent, **Then** the system recognizes them as an
   authenticated user and takes them past the login step.
3. **Given** a visitor who already signed in before, **When** they return to the
   site in a new session, **Then** they are recognized automatically without being
   asked to sign in again (until they explicitly sign out).

---

### User Story 3 - Sign out (Priority: P3)

A signed-in user chooses to end their session and return to the anonymous landing
page state.

**Why this priority**: Needed to validate the authenticated-state transition
cleanly and satisfy basic account-control expectations, but it is not on the
critical path to first getting users signed in.

**Independent Test**: While signed in, trigger sign-out and confirm the user
returns to the landing page as an anonymous visitor and is no longer recognized as
authenticated.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they choose to sign out, **Then** their
   session ends and they see the landing page as an anonymous visitor.

---

### Edge Cases

- What happens when the visitor cancels or closes the Google account chooser
  without completing sign-in? The system MUST return them to the landing page in
  the anonymous state with no error left hanging.
- What happens when the visitor denies the requested Google permissions? The
  system MUST show a clear, friendly message explaining sign-in could not be
  completed and allow them to retry.
- How does the system handle a temporary failure reaching the authentication
  service (e.g., network issue)? The visitor MUST see a clear error message and be
  able to retry without reloading the whole page.
- What happens if the visitor's browser blocks the sign-in popup/redirect? The
  visitor MUST receive guidance on how to proceed (e.g., allow popups) rather than
  a silent failure.
- What happens when an already-authenticated user manually navigates back to the
  landing page? They MUST be treated as signed in, not prompted to log in again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST present a concise statement of the app's
  purpose (helping vinyl collectors manage and organize their personal record
  library) fully visible within the first viewport, with no scrolling required, on
  common desktop and mobile screen sizes.
- **FR-002**: The landing page MUST present a "Sign in with Google" call to action
  that is visible and reachable within the first viewport, with no scrolling
  required, on common desktop and mobile screen sizes.
- **FR-003**: The landing page visual style MUST be simple, flat, and modern
  (minimal visual clutter, no decorative elements that delay comprehension of the
  app's purpose).
- **FR-004**: The system MUST let a visitor authenticate using their Google
  account.
- **FR-005**: The system MUST recognize a returning, previously-authenticated
  visitor automatically on subsequent visits without requiring them to sign in
  again, until they explicitly sign out.
- **FR-006**: The system MUST create a corresponding user record the first time a
  given Google account signs in, and reuse that same record on every later
  sign-in.
- **FR-007**: The system MUST show a clear, actionable message when sign-in fails,
  is cancelled, or is denied, and MUST let the visitor retry without a full page
  reload.
- **FR-008**: Access MUST be open to any visitor with a valid Google account; no
  invitation, allow-list, or approval step is required to sign in. Vinylmania is a
  multi-user app where each authenticated Google account manages its own,
  separate personal collection.
- **FR-009**: Explicit sign-out (User Story 3) MUST be included in this feature:
  a signed-in user MUST be able to end their session and return to the anonymous
  landing page state.
- **FR-010**: After a successful sign-in, the system MUST take the user to a
  simple placeholder screen confirming they are signed in (showing their Google
  display name and profile photo), standing in for the eventual application home
  area since the rest of the app is not built yet in this release.

### Key Entities

- **User**: Represents a person who has signed in with Google. Key attributes:
  a unique identifier for the account, display name, email address, profile photo,
  and the date they first signed in. One User record per Google account; each
  User's future collection data is isolated from every other User's.
- **Session**: Represents a period during which a visitor is recognized as
  authenticated. Tied to exactly one User; ends when the user explicitly signs out
  or the session naturally expires.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New visitors can state, in their own words, what the app is for
  after looking at the landing page for no more than 5 seconds, without scrolling.
- **SC-002**: The "Sign in with Google" action is visible without scrolling on
  100% of common desktop, tablet, and mobile screen sizes.
- **SC-003**: A visitor can go from clicking "Sign in with Google" to being
  recognized as signed in within 10 seconds under normal network conditions
  (excluding time spent by the visitor choosing an account).
- **SC-004**: 95% of sign-in attempts by visitors with a valid Google account
  complete successfully on the first try.
- **SC-005**: 100% of returning, previously-authenticated visitors are recognized
  automatically on their next visit without re-entering credentials.
- **SC-006**: 100% of cancelled, denied, or failed sign-in attempts leave the
  visitor with a clear next step (retry or clear explanation) rather than a dead
  end or unexplained blank state.

## Assumptions

- Google is the only sign-in method required for this release; no email/password
  or other identity providers are in scope.
- "Common desktop and mobile screen sizes" means current mainstream browser
  viewport widths (roughly 360px mobile through 1920px desktop); unusually small
  or non-standard devices are out of scope for the no-scroll guarantee.
- Session persistence follows standard web-session expectations (the user stays
  signed in across reloads and browser restarts until they explicitly sign out or
  clear their browser data).
- No administrative controls (e.g., banning a user, managing accounts) are in
  scope for this feature.
- Vinylmania is a multi-user product: any visitor with a valid Google account may
  sign in and will, in future features, manage their own separate collection.
- Visual copy, exact wording, and imagery for the landing page are not
  prescribed by the requester beyond "simple, flat, modern, and quick to
  understand"; final copy/design details are a design decision made during
  planning, not a specification constraint.
