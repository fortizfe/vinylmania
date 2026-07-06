# Feature Specification: Link Vinylmania Account with Discogs (OAuth)

**Feature Branch**: `015-discogs-oauth-link`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Para este desarrollo quiero que mi aplicación se integre con la autenticación Oauth preparada por discogs. He adjuntado un pdf con la documentación de la misma para que puedas usarla en la integración. El login en la app, por ahora, será a través de google con firebase como hasta ahora, pero se le dará al usuario la posibilidad de enlazar su cuenta de vinylmania con su cuenta de discogs. Vinylmania ya está registrada como aplicación en Discogs (client key/secret disponibles, que deberán vivir como variables en los .env necesarios). La sincronización de cuentas debe colocarse en la sección perfil, siguiendo la línea de diseño moderna de la app. El diseño debe tener en cuenta que en futuros desarrollos se integrarán los datos del usuario entre Vinylmania y Discogs."

## Overview

Vinylmania users sign in with their Google account (unchanged by this feature). This feature adds the ability for a signed-in user to **link their Vinylmania account with their personal Discogs account** through Discogs' own authorization flow, so that in future developments the app can act on the user's behalf against Discogs (collection, wantlist, ratings, etc.). The linking experience lives in the Profile section, which until now has been a placeholder page. The scope of this feature is the account connection itself — establishing, displaying, and removing the link — not yet any synchronization of collection data.

## Clarifications

### Session 2026-07-06

- Q: Can the same Discogs account be linked to multiple Vinylmania accounts, or must it be globally unique? → A: No global uniqueness — multiple Vinylmania users may link the same Discogs account; only the one-connection-per-user rule (FR-008) applies.
- Q: When a user already has an active Discogs connection, can they start a new linking flow (replacing the old link on success), or is re-linking prevented until they disconnect? → A: Prevented — with an active connection no new linking flow can be started; the user must disconnect first.
- Q: When is the connection's validity verified against Discogs — live on every profile visit, or from stored state? → A: Stored state — the profile shows the persisted connection state without contacting Discogs; validity is verified when the link is completed, and external revocation is detected when an operation against Discogs fails with invalid credentials.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Link my Discogs account from my profile (Priority: P1)

A signed-in collector opens the Profile section and finds a clearly presented "Discogs connection" area showing that no Discogs account is linked yet. They choose to connect, are taken to Discogs' own authorization page, sign in there (if needed) and approve Vinylmania's access. They are returned to their Vinylmania profile, which now shows their connection as active, including the Discogs username the account was linked to.

**Why this priority**: This is the core capability of the feature — without a working link flow, nothing else (status display, unlinking, future data integrations) has any foundation.

**Independent Test**: Sign in with Google, navigate to Profile, start the connection flow, approve on Discogs, and verify the profile shows the linked state with the correct Discogs username. Delivers standalone value: the user's account is now connected and ready for future integrations.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no Discogs account linked, **When** they open the Profile section, **Then** they see a Discogs connection area indicating "not connected" with a clear action to link their account.
2. **Given** a signed-in user who starts the linking flow, **When** they approve access on Discogs' authorization page, **Then** they are returned to Vinylmania and their profile shows the connection as active with their Discogs username.
3. **Given** a user who has completed linking, **When** they sign out and sign back in with Google, **Then** the profile still shows their Discogs connection as active (the link persists across sessions).
4. **Given** a user who is not signed in to Vinylmania, **When** they attempt to reach the profile or the linking flow directly, **Then** they cannot initiate or complete a Discogs link.

---

### User Story 2 - See my connection status and unlink (Priority: P2)

A collector who previously linked their Discogs account visits their profile and can see at a glance that the connection is active and which Discogs username it is tied to. They can choose to disconnect, after which the profile returns to the "not connected" state and Vinylmania no longer retains the ability to act on their behalf at Discogs.

**Why this priority**: Users must be able to verify and revoke a connection they granted; trust in account linking depends on visible status and a working exit. It depends on Story 1 existing but is independently testable.

**Independent Test**: With a linked account, open Profile, confirm the active status and Discogs username are displayed, disconnect, and confirm the state returns to "not connected" and stays that way after reload.

**Acceptance Scenarios**:

1. **Given** a user with a linked Discogs account, **When** they open the Profile section, **Then** the connection area shows an active state and the linked Discogs username.
2. **Given** a user with a linked Discogs account, **When** they choose to disconnect and confirm the action, **Then** the stored connection and its credentials are removed and the profile shows the "not connected" state.
3. **Given** a user who has just disconnected, **When** they start the linking flow again, **Then** they can re-link successfully (same or different Discogs account).

---

### User Story 3 - Graceful handling when authorization fails or is abandoned (Priority: P3)

A collector starts the linking flow but denies access on the Discogs page, closes the tab, or takes too long to complete the authorization. When they come back to their Vinylmania profile, the app shows a clear, friendly outcome: no partial connection exists, an understandable message explains what happened when applicable, and they can simply try again.

**Why this priority**: Failure paths do not block the happy path, but leaving broken half-linked states or cryptic errors would undermine confidence in the feature and generate support burden.

**Independent Test**: Start the flow and deny authorization on Discogs; verify return to profile with a clear "connection was not completed" message and a "not connected" state from which linking can be retried.

**Acceptance Scenarios**:

1. **Given** a user in the linking flow, **When** they deny authorization on the Discogs page, **Then** they end up back on their profile in the "not connected" state with a clear, non-technical message that the connection was not completed.
2. **Given** a user who started a linking flow but did not complete it within Discogs' allowed time window, **When** they attempt to finish the stale flow, **Then** the app reports that the attempt expired and offers to start again, leaving no partial connection behind.
3. **Given** the Discogs service being unavailable or rate-limiting requests, **When** a user attempts to link, **Then** the user sees a friendly message distinguishing a temporary external problem from an error of their own, and internal details are recorded in logs rather than shown on screen (the profile itself still loads, since connection status renders from stored state).

---

### Edge Cases

- User denies authorization on the Discogs consent page → return to profile, "not connected", clear message, retriable (Story 3).
- Authorization attempt not completed within Discogs' validity window (Discogs expires pending authorizations after roughly 15 minutes) → attempt is discarded, user can restart cleanly.
- User already has a linked account and somehow triggers the link flow again (e.g., stale tab, crafted request) → the attempt is rejected: linking is unavailable while a connection is active, the user must disconnect first, and no second connection is ever produced (per Clarifications, Session 2026-07-06).
- The user revokes Vinylmania's access from within Discogs itself (outside the app) → stored credentials become invalid; the profile keeps showing the stored "connected" state until an operation against Discogs fails with invalid credentials, at which point the app must surface a disconnected/error state and let the user disconnect and re-link rather than failing silently.
- Discogs is down or rate-limits the app during the linking flow → friendly user-facing message, detailed internal logging, no corrupted state; profile status display is unaffected since it renders from stored state.
- A user opens the linking flow in two tabs at once → completing one must not corrupt state; at most one active connection results.
- Callback/return is reached with tampered or missing parameters → the attempt is rejected safely with no partial state persisted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Profile section MUST present a Discogs connection area that always reflects the stored connection state for the signed-in user: "not connected" (with an action to link) or "connected" (showing the linked Discogs username, when the link was established, and an action to disconnect). Displaying this state MUST NOT require contacting Discogs — the profile renders from persisted state (see Clarifications, Session 2026-07-06).
- **FR-002**: A signed-in user MUST be able to start the linking flow from the Profile section and be sent to Discogs' own authorization page, where they approve or deny access; Vinylmania MUST never ask for or handle the user's Discogs password.
- **FR-003**: When the user approves access on Discogs, the system MUST complete the authorization exchange, verify the resulting credentials by confirming the authenticated Discogs identity, and persist the connection associated to the user's Vinylmania account.
- **FR-004**: The persisted connection MUST survive sign-out/sign-in cycles and be durable until the user disconnects (Discogs credentials do not expire unless revoked).
- **FR-005**: A user with a linked account MUST be able to disconnect from the Profile section; disconnecting MUST remove the stored Discogs credentials and connection data for that user.
- **FR-006**: If the user denies authorization, abandons the flow, or the attempt exceeds Discogs' validity window, the system MUST leave no partial connection state and MUST present a clear, non-technical message with the option to retry.
- **FR-007**: Only authenticated Vinylmania users MUST be able to initiate or complete a linking flow, and a completed link MUST only ever attach to the account of the user who initiated it.
- **FR-008**: Each Vinylmania user MUST have at most one active Discogs connection at any time. While a connection is active, starting a new linking flow MUST NOT be possible (neither offered in the interface nor accepted if requested directly); the user MUST disconnect first to link again.
- **FR-009**: The application's Discogs credentials (consumer key and consumer secret) MUST be provided exclusively through private environment configuration (.env files / deployment environment variables), MUST NOT be committed to the repository, and MUST NOT be exposed to the browser in any form.
- **FR-010**: The user's Discogs access credentials obtained by linking MUST be stored server-side, MUST never be delivered to the browser, and MUST be transmitted only over secure channels.
- **FR-011**: The connection area MUST follow the app's established design system (card-based layout, atomic components, skeleton loading state while status is being determined, dark mode support, no layout shift between states).
- **FR-012**: All linking lifecycle events (link started, link completed, link failed with cause, disconnect) MUST be recorded as structured logs with enough context to diagnose issues, while user-facing messages remain free of internal details.
- **FR-013**: The stored connection MUST retain what future features need to act on the user's behalf at Discogs (the user's authorized credentials and Discogs identity), so upcoming integrations (collection, wantlist, profile data) can build on this link without re-asking the user to authorize.

### Key Entities

- **Discogs Connection**: Represents the link between one Vinylmania user and one Discogs account. Attributes: owning Vinylmania user, linked Discogs username/identity, the authorized credentials that let the app act on the user's behalf (held server-side only), and when the link was established. One per user at most; removed entirely on disconnect.
- **Pending Link Attempt**: A short-lived record of an authorization flow in progress, needed to complete the exchange when the user returns from Discogs. Expires per Discogs' validity window and is discarded on completion, denial, or expiry; never visible to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can go from opening their profile to a confirmed Discogs connection in under 2 minutes, including the approval step on Discogs.
- **SC-002**: 100% of linking attempts that are denied, abandoned, or expired leave the user's account with no partial or inconsistent connection state.
- **SC-003**: The profile always shows the correct connection state: after linking, the linked Discogs username is visible on the profile immediately upon return, and after disconnecting the "not connected" state is shown immediately and persists across reloads.
- **SC-004**: A user can disconnect their Discogs account from their profile in 2 interactions or fewer (action + confirmation).
- **SC-005**: The application's Discogs credentials and users' authorized Discogs credentials are absent from the repository history and from everything delivered to the browser (verifiable by inspection of the repo and of client-delivered assets/network responses).
- **SC-006**: Every failed linking attempt produces a log entry with an actionable cause, and no user-facing message exposes internal error details.

## Assumptions

- Sign-in to Vinylmania remains exclusively Google via the existing mechanism; Discogs is an account *link*, not an alternative login method, and unlinking never affects the user's ability to sign in.
- The Profile section currently shows an "under construction" placeholder; this feature introduces the Discogs connection area as its first real content block. Building out the rest of the profile (user info display, preferences, etc.) is out of scope.
- Synchronizing any user data with Discogs (collection, wantlist, ratings, marketplace) is explicitly out of scope for this feature; the design only needs to leave the stored connection usable by those future features (FR-013).
- Vinylmania is already registered as an application at Discogs and the consumer key/secret exist; the user will place them in the appropriate .env files themselves — no secret values are part of this specification.
- Discogs' authorization uses their standard three-step flow with a return/callback into the app; per Discogs, user credentials obtained this way do not expire unless the user revokes access.
- Multiple Vinylmania users MAY link the same Discogs account; no global uniqueness is enforced across users (confirmed in Clarifications, Session 2026-07-06). Only one connection per Vinylmania user applies (FR-008).
- Disconnecting removes Vinylmania's stored credentials; fully revoking the grant on Discogs' side is the user's action within Discogs and is out of the app's control (the app copes with external revocation per the edge cases).
- Standard desktop and mobile web browsers are the target; no native-app deep-link handling is required.
