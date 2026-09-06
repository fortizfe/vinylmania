# Feature Specification: Discogs-Integrated Wantlist (Lista de Deseos)

**Feature Branch**: `060-discogs-wantlist-integration`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Ahora que la biblioteca ya está sincronizada con la colección de Discogs (features 015 y 016), quiero añadir la otra mitad del flujo de un coleccionista: la lista de deseos (wantlist). Debe funcionar igual de integrada con Discogs que la biblioteca, no como una lista aparte guardada solo en Vinylmania."

## Overview

With the Discogs account link (feature 015) and the synchronized library (feature 016) in place, Vinylmania covers the "records I own" half of a collector's workflow. This feature adds the other half: the **wantlist** (lista de deseos) — the records a collector wants to acquire. Like the library, the wantlist is a synchronized view of the user's real Discogs wantlist, not a separate list stored only in Vinylmania. Discogs remains the system of record.

A new "Lista de deseos" navigation section sits alongside "Mi biblioteca" and shows the wantlist as a list of cards using the same card style already used in the library and in search results, including the existing community rating badge (unchanged in meaning). From search results and from a release detail page, a distinct "Añadir a mi lista de deseos" action writes the release directly into the user's Discogs wantlist. When a release in the wantlist is opened on its detail page, a wantlist panel — analogous to the library's per-copy ("mi copia") panel — lets the user edit, with per-field autosave and no Save button, the two fields Discogs exposes per wantlist entry: notes and a personal rating (a separate star control, not the community badge). Removing a record from the wantlist is an explicit action available from the wantlist view and asks for a lightweight confirmation. When a record already in the wantlist is added to the library (the collector bought it), it is automatically removed from the wantlist, mirroring discogs.com's native behavior; adding a release the user already owns to the wantlist is allowed but flagged as already owned. Synchronization follows the same pattern already chosen for the library: sync-on-read with a short (~5 minute) cache window plus manual refresh — no background sync, no scheduled jobs. The feature is an extension of the existing OAuth + Discogs domain and reuses the authenticated Discogs collection client/port and the existing resilience layer (rate limiting, retry, circuit breaker).

## Clarifications

### Session 2026-09-06

- Q: What per-entry fields are editable on a wantlist item? → A: Only the fields the Discogs Wantlist API exposes per entry — notes and rating. No new Vinylmania-only fields are introduced.
- Q: How fresh must the wantlist be with respect to the Discogs wantlist? → A: Same pattern as the library — short-lived cache (~5 minutes) plus an explicit manual refresh; changes made from Vinylmania (add/remove/edit) are reflected immediately, the cache window only affects changes made directly on discogs.com.
- Q: What happens when a record in the wantlist is added to the library? → A: It is automatically removed from the wantlist after the library/collection write is confirmed, so it is never shown in both places at once.
- Q: What does the rating badge on a wantlist card show, given the existing badge shows the Discogs community rating but the Wantlist API stores a personal per-entry rating? → A: The existing badge keeps showing the Discogs community rating (unchanged, consistent with library and search cards); the user's personal wantlist rating is a separate editable star control.
- Q: Where does the user edit a wantlist entry's notes and personal rating? → A: On the release detail page, in a wantlist panel analogous to the library's per-copy ("mi copia") panel — shown when the release is in the user's wantlist, edited with per-field autosave. Not inline on the wantlist card.
- Q: What should "Añadir a mi lista de deseos" do for a release already in the user's library? → A: Allow the add (Discogs permits an item in both), but the action visibly indicates the release is already in the library. No automatic removal from the library.
- Q: Does removing an entry from the wantlist require an explicit confirmation step? → A: Yes — a lightweight confirmation (dialog or inline confirm) before the removal is written to Discogs (2 interactions total).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse my wantlist as a synchronized view of my Discogs wantlist (Priority: P1)

A collector with a linked Discogs account opens the new "Lista de deseos" section. What they see is their Discogs wantlist: records they added to their wantlist directly on discogs.com appear here, shown as cards in the same style as the library and search results, including the rating badge. A collector who has not linked their Discogs account opens the section and, instead of a list, sees the same "you need to link your account" message already used for the library, with a direct way to go link it.

**Why this priority**: This is the foundation of the feature — the wantlist/Discogs-wantlist equivalence and its own place in navigation. Every other behavior (add, edit, remove, auto-remove on purchase) assumes this synchronized view exists.

**Independent Test**: With a linked account whose Discogs wantlist has entries, open "Lista de deseos" and verify the entries appear as cards matching the library/search card style. With an unlinked account, open the section and verify the "link required" message is shown and no wantlist content or actions are available.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a linked Discogs account whose Discogs wantlist contains records added on discogs.com, **When** they open "Lista de deseos", **Then** those records appear as cards in the same style used in the library and search results, including the rating badge.
2. **Given** a signed-in user who has NOT linked their Discogs account, **When** they open "Lista de deseos", **Then** they see a message stating account linking is required, with an action leading to the Discogs connection area, and no wantlist records or wantlist actions are shown.
3. **Given** a linked user with an empty Discogs wantlist, **When** they open "Lista de deseos", **Then** they see a clear empty state rather than an error.
4. **Given** a linked user viewing "Lista de deseos", **When** they trigger the manual refresh action, **Then** the list is re-synchronized with their Discogs wantlist and reflects any changes made on discogs.com.
5. **Given** "Lista de deseos" is present in the navigation, **When** the user views the navigation, **Then** it appears at the same level as "Mi biblioteca".

---

### User Story 2 - Add a record to my wantlist from search results and release detail (Priority: P1)

A collector searches for a release, or opens a release detail page, and wants to remember it as something to buy later. Next to the existing "Añadir a mi biblioteca" button there is a separate, visually distinguishable "Añadir a mi lista de deseos" action. Choosing it writes the release directly into the user's real Discogs wantlist (not into Firestore), the same way "Añadir a mi biblioteca" writes into their Discogs collection today. After adding, the release shows as being in the wantlist.

**Why this priority**: Adding is the primary way a wantlist gets populated from within Vinylmania; without it the wantlist is read-only. It is P1 alongside Story 1 because the two together form the minimum useful feature.

**Independent Test**: From a search result and from a release detail page, use "Añadir a mi lista de deseos", then open "Lista de deseos" and verify the release appears; verify on discogs.com that the same release is now in the Discogs wantlist.

**Acceptance Scenarios**:

1. **Given** a linked user viewing a search result for a release not in their wantlist, **When** they choose "Añadir a mi lista de deseos", **Then** the release is added to their Discogs wantlist and the action reflects the new state (e.g. shows as already in the wantlist).
2. **Given** a linked user on a release detail page, **When** they choose "Añadir a mi lista de deseos", **Then** the release is added to their Discogs wantlist.
3. **Given** the "Añadir a mi biblioteca" and "Añadir a mi lista de deseos" actions are both shown, **When** the user views them, **Then** the two actions are independent and visually distinguishable from each other.
4. **Given** a user who is NOT linked, **When** they attempt "Añadir a mi lista de deseos", **Then** they are shown the same "link your account" message used elsewhere and the record is not added.
5. **Given** a linked user whose add request fails to reach Discogs (outage, revoked link, rate limiting exhausted), **When** they add, **Then** they see a clear error, the action is not shown as succeeded, and they can retry.
6. **Given** a release already present in the user's wantlist, **When** they view its search result or detail page, **Then** the wantlist action indicates it is already in the wantlist rather than offering to add it again.

---

### User Story 3 - Edit a wantlist entry's notes and personal rating from the release detail page (Priority: P2)

A collector opens the detail page of a release that is in their wantlist and wants to annotate it — jot why they want it, or rate how much they want it. The detail page shows a wantlist panel, analogous to the library's per-copy ("mi copia") panel, with the two fields Discogs holds per wantlist entry: notes and a personal rating. Editing works the same way as editing "mi copia" in the library: autosave per field, no Save button — the personal rating saves when a star is tapped, the notes save when the edit is confirmed. Changes are written to the user's Discogs wantlist and are visible on discogs.com. A wantlist card links to this detail page; it is not edited inline in the list.

**Why this priority**: This makes the wantlist a working tool rather than a static list, but the feature is still useful without it, so it ranks below Stories 1 and 2.

**Independent Test**: Open the detail page of a release in the wantlist, set its personal rating and type a note; reload the page and verify the values persisted; verify on discogs.com that the same values appear on that wantlist entry.

**Acceptance Scenarios**:

1. **Given** a linked user opening the detail page of a release that is in their wantlist, **When** the page loads, **Then** it shows a wantlist panel with the current notes and personal rating held for that entry in their Discogs wantlist.
2. **Given** a linked user editing the wantlist panel on a release detail page, **When** they tap a star in the personal rating or confirm an edit of the notes, **Then** that field is saved to their Discogs wantlist immediately (per-field autosave, no Save button) and shown when the page is reloaded.
3. **Given** a linked user whose field edit fails to reach Discogs, **When** they save, **Then** they see a clear error, the displayed value is not silently reported as saved, and they can retry.
4. **Given** the Discogs Wantlist API exposes only notes and rating per entry, **When** the user edits the wantlist panel, **Then** only those two fields are offered — no additional Vinylmania-only fields.
5. **Given** a linked user viewing the detail page of a release that is NOT in their wantlist, **When** the page loads, **Then** the wantlist panel is not shown (only the "Añadir a mi lista de deseos" action is available).

---

### User Story 4 - Remove a record from my wantlist (Priority: P2)

A collector decides they no longer want a record. From the wantlist view itself, each entry offers an explicit "remove from wantlist" action. Choosing it asks for a quick confirmation; on confirming, the entry is removed from the user's Discogs wantlist and disappears from "Lista de deseos".

**Why this priority**: Keeping the wantlist tidy matters, but the feature delivers value before removal exists, so it ranks with Story 3.

**Independent Test**: In "Lista de deseos", remove an entry, verify it disappears from the list, and verify on discogs.com that it is no longer in the Discogs wantlist.

**Acceptance Scenarios**:

1. **Given** a linked user viewing "Lista de deseos", **When** they choose the explicit remove action on an entry and confirm the lightweight confirmation prompt, **Then** the entry is removed from their Discogs wantlist and no longer appears in the list.
2. **Given** the remove action, **When** the user views a wantlist entry, **Then** the remove action is available from the wantlist view itself (not only from a detail page).
3. **Given** a linked user who chose the remove action, **When** they dismiss the confirmation prompt without confirming, **Then** the entry is left unchanged in their Discogs wantlist and the list.
4. **Given** a linked user whose remove request fails to reach Discogs, **When** they confirm the removal, **Then** they see a clear error, the entry is not shown as removed, and they can retry.

---

### User Story 5 - Buying a wanted record removes it from the wantlist automatically (Priority: P2)

A collector has a record in their wantlist and then adds it to their library because they bought it. The record is automatically removed from the wantlist, so it is never held in both the library and the wantlist at the same time — the same behavior discogs.com applies natively.

**Why this priority**: This keeps the two lists mutually consistent and avoids collector confusion, but depends on Stories 1 and 2 and on the existing library-add flow, so it ranks below the core.

**Independent Test**: With a record in the wantlist, add it to the library; verify the library contains it (Discogs collection updated) and that "Lista de deseos" no longer shows it (Discogs wantlist updated).

**Acceptance Scenarios**:

1. **Given** a linked user with a record in their wantlist, **When** they add that record to their library, **Then** after the collection write is confirmed the record is removed from their Discogs wantlist and no longer appears in "Lista de deseos".
2. **Given** the automatic wantlist removal, **When** the library add succeeds but the wantlist removal fails, **Then** the user is informed that the record was added to the library but could not be removed from the wantlist, and the record is not silently shown as removed.
3. **Given** a record that is only in the library (never in the wantlist), **When** it is added to the library, **Then** no wantlist change is attempted and no error is shown.

---

### Edge Cases

- **Unlinked mid-session**: a user's Discogs link is revoked while they are on "Lista de deseos" — subsequent reads/writes surface the "link required" message rather than a raw failure.
- **Record removed on discogs.com**: an entry deleted directly in the Discogs wantlist disappears from "Lista de deseos" on the next fresh synchronization (cache expired or manual refresh); it is not re-added.
- **Duplicate add**: adding a release already in the wantlist does not create a duplicate entry; the action reflects "already in wantlist".
- **Adding to wantlist a record already owned (in the library)**: allowed; the release is added to the Discogs wantlist and the action indicates it is already in the library. The library entry is not removed. Only the reverse (adding a wanted release to the library) auto-removes the wantlist entry.
- **Personal rating scale**: the personal wantlist rating uses the same 0–5 scale as personal ratings in the library; values outside the accepted range are rejected before being sent to Discogs.
- **Empty notes**: clearing a note and confirming saves an empty note to Discogs (removes the annotation), not a no-op.
- **Rate limiting / circuit breaker open**: wantlist reads and writes degrade the same way library operations do today — a clear, retryable error, no partial state reported as success.
- **Large wantlist**: a wantlist with many entries still loads and paginates/scrolls without blocking the rest of the app (same expectation as the library list).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a "Lista de deseos" section in the primary navigation, at the same level as "Mi biblioteca".
- **FR-002**: The "Lista de deseos" section MUST be available only to users whose Discogs account is linked (the same OAuth link as feature 015). For users who have not linked their account, the section MUST show the same "you need to link your account" message used by the library, with an action leading to the Discogs connection area, and MUST NOT show wantlist content or actions.
- **FR-003**: For a linked user, "Lista de deseos" MUST display the user's Discogs wantlist as a list of cards, reusing the same card style used in the library and search results, including the existing rating badge. The badge MUST continue to show the Discogs community rating for the release (same meaning and treatment as on library and search cards); it MUST NOT be repurposed to show the personal wantlist rating.
- **FR-004**: "Lista de deseos" MUST show a clear empty state when the user's Discogs wantlist has no entries, distinct from an error state.
- **FR-005**: The system MUST offer, from both search results and the release detail page, an "Añadir a mi lista de deseos" action that is independent from and visually distinguishable from the existing "Añadir a mi biblioteca" action.
- **FR-006**: "Añadir a mi lista de deseos" MUST write the release directly to the user's Discogs wantlist (not to Firestore), analogous to how "Añadir a mi biblioteca" writes to the user's Discogs collection today.
- **FR-007**: When a release is already in the user's wantlist, the wantlist action on its search result and detail page MUST indicate it is already in the wantlist rather than adding a duplicate entry.
- **FR-007a**: "Añadir a mi lista de deseos" MUST be available for a release the user already has in their library; the action MUST still add the release to the Discogs wantlist but MUST visibly indicate the release is already in the library. It MUST NOT remove the release from the library.
- **FR-008**: The release detail page MUST show a wantlist panel — analogous to the library's per-copy panel — when the release is in the user's wantlist, exposing exactly the fields the Discogs Wantlist API holds per entry (notes and personal rating) and no additional Vinylmania-only fields. When the release is not in the user's wantlist, the panel MUST NOT be shown. Wantlist entries MUST NOT be edited inline on the wantlist card; the card links to the detail page.
- **FR-009**: Wantlist panel edits MUST use per-field autosave with no Save button: the personal rating saves when a star is selected, the notes save when the edit is confirmed (blur/inline confirm). Saved values MUST be written to the user's Discogs wantlist.
- **FR-010**: The personal wantlist rating MUST be presented as a separate editable star control (distinct from the community rating badge), using the same star component and 0–5 scale already used for personal ratings elsewhere in the app.
- **FR-011**: The system MUST provide an explicit "remove from wantlist" action on each entry, available from the "Lista de deseos" view itself. The action MUST require a lightweight confirmation step (dialog or inline confirm) before the removal is written to the user's Discogs wantlist; on confirmation the entry is removed from the Discogs wantlist and disappears from the list.
- **FR-012**: When a user adds to their library a release that is currently in their wantlist, the system MUST automatically remove that release from the user's Discogs wantlist after the collection write is confirmed, so the release is not held in both lists simultaneously.
- **FR-013**: If the automatic wantlist removal in FR-012 fails after a successful library add, the system MUST inform the user that the release was added to the library but not removed from the wantlist, and MUST NOT report the wantlist removal as done.
- **FR-014**: The wantlist MAY be served from a short-lived cache (on the order of 5 minutes — the same window used by the library) to protect Discogs usage limits, and MUST offer an explicit refresh action that forces a fresh synchronization. Changes performed from Vinylmania (add, remove, per-entry edits) MUST be reflected immediately regardless of the cache window; only changes made directly on discogs.com may be deferred until the cache expires or the user refreshes.
- **FR-015**: Wantlist synchronization MUST happen on read (when the section is opened, subject to the cache window) or on manual refresh only. Background synchronization and scheduled jobs are out of scope.
- **FR-016**: All wantlist reads and writes MUST reuse the existing authenticated Discogs integration — the same authenticated collection client/port and the existing resilience behavior (rate limiting, retry, circuit breaker) — rather than a new integration built from scratch.
- **FR-017**: Every wantlist operation that fails (add, remove, edit, sync) MUST surface a clear, actionable, retryable error to the user and MUST NOT report a failed operation as succeeded or leave the displayed state inconsistent with Discogs.
- **FR-018**: An entry deleted directly in the user's Discogs wantlist MUST disappear from "Lista de deseos" on the next fresh synchronization and MUST NOT be re-added by Vinylmania.
- **FR-019**: The system MUST emit structured logs for key wantlist operations (entry added, entry removed, entry edited, automatic removal on purchase, sync performed, and errors) with enough context to diagnose issues without a debugger.
- **FR-020**: The "Lista de deseos" UI MUST conform to the project's accessibility (WCAG 2.1 AA) and design-consistency requirements, matching the existing library and search-results experiences.

### Key Entities *(include if feature involves data)*

- **Wantlist**: the user's list of releases they want to acquire, equivalent to and synchronized with the user's Discogs wantlist. Belongs to one linked user. Not stored as an independent list in Vinylmania.
- **Wantlist Entry**: a single release in the wantlist. Attributes: the release it refers to (catalog identity, reused from Discogs). Editable per entry (on the release detail page): notes (free text) and a personal rating (0–5, same star component as personal ratings elsewhere). The Discogs community rating shown on the card is a property of the release, not of the entry. Mirrors a Discogs wantlist item.
- **Release**: an existing catalog concept (Discogs-sourced). A release can be referenced from search results, the library, and the wantlist; the same release must not be simultaneously in both the library and the wantlist for a given user.
- **Discogs Account Link**: the existing OAuth link (feature 015) that gates access to the wantlist and authorizes wantlist reads/writes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a wantlist synchronization completes for a linked user (fresh load or manual refresh), the set of releases shown in "Lista de deseos" equals the set of items in their Discogs wantlist — 100% match, in both directions.
- **SC-002**: A release added via "Añadir a mi lista de deseos" appears in the user's Discogs wantlist (verifiable on discogs.com) in 100% of successful add operations, and never as a duplicate entry.
- **SC-003**: An edit to a wantlist entry's notes or personal rating is persisted to Discogs and still present after reloading the view in 100% of successful edits, with no explicit Save action required.
- **SC-004**: In 100% of cases where a wanted release is added to the library, it is removed from the wantlist (or, if removal fails, the user is explicitly told it was not removed) — the release is never silently left in both lists.
- **SC-005**: Every failed wantlist operation results in a visible, retryable error message; no failed operation is reported to the user as successful (0 silent failures in testing).
- **SC-006**: A linked user can add a release to their wantlist from a search result or detail page in a single interaction, and can remove an entry from "Lista de deseos" in exactly 2 interactions (choose remove, confirm).
- **SC-007**: An unlinked user attempting to open "Lista de deseos" or use the wantlist action always sees the account-link message and is never shown wantlist data or a raw integration error.
- **SC-008**: Opening "Lista de deseos" within the cache window issues no new Discogs wantlist request; opening it after the window, or using manual refresh, issues exactly one fresh synchronization.

## Assumptions

- The Discogs Wantlist API exposes notes and rating as the per-entry editable fields, on the same scale/format Vinylmania already uses for release ratings; no field mapping beyond what feature 016 established for the collection is needed.
- The existing authenticated Discogs client/port built for the collection (features 015, 016, and the OAuth collection migration) can be extended to cover wantlist endpoints; a wantlist read/write is the same class of authenticated call as a collection read/write.
- The "link your account" message, the community rating badge, the personal star-rating component, the per-copy edit panel pattern, and the card component are existing, reusable UI pieces; this feature reuses them rather than creating new variants.
- The cache window for the wantlist is the same ~5-minute short-lived cache plus manual refresh already implemented for the library (feature 016); no separate caching policy is introduced.
- Automatically removing an owned release from the wantlist is out of scope; only the reverse — removing a wanted release from the wantlist when it is added to the library — is in scope (see FR-007a, FR-012).
- "Añadir a mi lista de deseos" operates at the release level (not master level), consistent with how "Añadir a mi biblioteca" behaves today.
- Wantlist operations are subject to the same Discogs rate-limit budget as collection operations; no separate quota or smoothing policy is introduced by this feature.
- Out of scope for this first version: price or marketplace-availability alerts when a wanted release goes on sale; folders or categories within the wantlist; manual reordering of the wantlist; push notifications. These are deferred to a future increment.
