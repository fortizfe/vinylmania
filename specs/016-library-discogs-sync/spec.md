# Feature Specification: Sync Vinyl Library with Discogs Collection

**Feature Branch**: `016-library-discogs-sync`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Ahora que ya tenemos la integración desarrollada entre vinylmania y discogs vamos a empezar a explotarla. Lo primero que vamos a hacer es enlazar la librería del usuario con su colección de discogs. las implicaciones de este desarrollo son las siguientes. 1- Ya no es necesario almacenar en firebase las notas ni la condición ya que esa información, a partir de ahora se usará la integración con discogs para almacenarla. 2- Cuando se cargue la librería, debe estar sincronizado con la colección del usuario logueado. Si el usuario no tiene sus cuentas enlazadas, debe mostrarse un mensaje de es necesario enlazar las cuentas. 3- Cuando se añada un disco a la librería, debe añadirse también a la colección de discogs. 4- Cuando se elimine un disco de la librería, debe eliminarse también de la colección de discogs. 5- Debe añadirse a la vista de detalle de un disco la información editable desde discogs. Esto es rating (componente de 5 estrellas), estado del soporte, estado de la copia y notas. Los datos editados deben almacenarse en discogs también. Adapta lo necesario para encajar con los resultados de la api de discogs y no perder información."

## Overview

With the Discogs account link in place (feature 015), Vinylmania's personal vinyl library becomes a synchronized view of the user's Discogs collection. Discogs takes over as the system of record for the per-copy data that until now lived only in Vinylmania: personal notes, condition of the record, condition of the sleeve, and the user's rating. The library screen stays in sync with the linked Discogs collection; adding or removing a record in Vinylmania adds or removes it in the Discogs collection too; and the record detail view gains an editable panel (5-star rating, media condition, sleeve condition, notes) whose changes are saved to Discogs. Users who have not linked their Discogs account are told they must link their accounts before using the library.

## Clarifications

### Session 2026-07-06

- Q: When a record exists in Vinylmania but is no longer in the Discogs collection (e.g., deleted directly on discogs.com), what should sync do? → A: Union merge applies only to the first synchronization; afterwards Discogs is the source of truth — records deleted on Discogs disappear from the library on the next load.
- Q: After a user's notes/condition are successfully migrated to Discogs, what happens to the legacy fields in the app's own store? → A: They are deleted from the stored library entries, but only after the Discogs write is confirmed; no dual source of truth remains.
- Q: How are edits in the record detail's per-copy panel saved? → A: Autosave per field — rating saves when a star is tapped, conditions save on selection, notes save when their edit is confirmed (blur/inline confirm); no panel-wide Save button.
- Q: How fresh must the library be with respect to the Discogs collection? → A: Short-lived cache (~5 minutes) plus an explicit manual refresh action; changes made from Vinylmania (add/remove/edit) are reflected immediately, the cache window only affects changes made directly on discogs.com.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My library reflects my Discogs collection (Priority: P1)

A collector with a linked Discogs account opens their Vinylmania library. What they see is their Discogs collection: records they added directly on the Discogs website appear in the library, and records they previously added in Vinylmania are present in their Discogs collection. A collector who has not linked their Discogs account opens the library and, instead of a record list, sees a clear message explaining that linking their accounts is required, with a direct way to go do it.

**Why this priority**: This is the foundation of the feature — the library/collection equivalence. Every other behavior (add, remove, edit per-copy data) assumes the library and the Discogs collection are the same set of records.

**Independent Test**: With a linked account that has records both in Vinylmania and directly in Discogs, open the library and verify both sets appear as one. With an unlinked account, open the library and verify the "link required" message is shown and no library content or actions are available.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a linked Discogs account whose collection contains records added directly on Discogs, **When** they open the library, **Then** those records appear in the library alongside records added from Vinylmania.
2. **Given** a signed-in user with a linked Discogs account whose Vinylmania library contains records not yet present in their Discogs collection, **When** their FIRST synchronization runs, **Then** those records are added to their Discogs collection so both sides end up with the same set.
3. **Given** a signed-in user who has NOT linked their Discogs account, **When** they open the library, **Then** they see a message stating account linking is required, with an action leading to the profile's Discogs connection area, and no library records or record actions are shown.
4. **Given** a linked user who removed a record directly on the Discogs website, **When** the next fresh synchronization runs (cache expired or manual refresh), **Then** that record no longer appears in the library and is not re-added to Discogs.

---

### User Story 2 - Edit my copy's Discogs data from the record detail (Priority: P2)

A collector opens the detail view of a record they own. Alongside the catalog information they now see the personal, per-copy data held in their Discogs collection: their rating shown as a 5-star component, the media condition (state of the record itself), the sleeve condition (state of the cover), and their notes. They edit any of these — tap a star rating, pick a condition from the accepted grading options, rewrite the notes — and the changes are saved to their Discogs collection, visible on the Discogs website as well.

**Why this priority**: This is where the user actively benefits from the new source of record: one place to maintain per-copy data that is honored on both platforms. It depends on Story 1's synchronized library existing.

**Independent Test**: Open a owned record's detail, set rating to 4 stars, choose a media condition, a sleeve condition, and type a note; reload the detail view and verify the values persisted; verify on the Discogs website that the same values appear on that collection item.

**Acceptance Scenarios**:

1. **Given** a linked user viewing the detail of a record in their library, **When** the view loads, **Then** it shows the current rating (as 5 stars), media condition, sleeve condition, and notes from their Discogs collection.
2. **Given** a linked user on a record's detail view, **When** they change a field — tap a star rating, select a media or sleeve condition, or confirm an edit of the notes — **Then** that field is saved to their Discogs collection immediately (per-field autosave, no panel-wide Save button) and shown when the view is reloaded.
3. **Given** a user editing condition values, **When** they choose a condition, **Then** only the grading options accepted by Discogs are offered (no free-text condition entry).
4. **Given** a linked user whose edit fails to reach Discogs (outage, revoked link), **When** they save, **Then** they see a clear error, the displayed values are not silently reported as saved, and they can retry.

---

### User Story 3 - Adding a record updates both sides (Priority: P2)

A collector finds a release in Vinylmania and adds it to their library. The record immediately becomes part of their Discogs collection as well — checking their collection on the Discogs website shows the newly added record.

**Why this priority**: Adding records is the library's primary growth action; if it doesn't propagate, the Story 1 equivalence degrades with every addition.

**Independent Test**: Add a release to the library from Vinylmania, then verify it appears in the library and in the user's collection on the Discogs website.

**Acceptance Scenarios**:

1. **Given** a linked user viewing a release they don't own, **When** they add it to their library, **Then** the record appears in their library and in their Discogs collection.
2. **Given** a linked user whose addition fails on the Discogs side, **When** the failure occurs, **Then** the user is informed the addition did not complete and the library does not show the record as owned while Discogs lacks it.
3. **Given** an unlinked user, **When** they attempt to add a release to their library, **Then** the action is unavailable or prompts them to link their accounts first.

---

### User Story 4 - Removing a record updates both sides (Priority: P3)

A collector removes a record from their Vinylmania library. The record is also removed from their Discogs collection, so both platforms agree the copy is gone.

**Why this priority**: Removal completes the lifecycle; it is less frequent than adding or editing but necessary to keep the two sides equivalent.

**Independent Test**: Remove an owned record from the library in Vinylmania, then verify it is gone from the library and from the user's collection on the Discogs website.

**Acceptance Scenarios**:

1. **Given** a linked user with a record in their library, **When** they remove it, **Then** it disappears from the library and from their Discogs collection.
2. **Given** a removal that fails on the Discogs side, **When** the failure occurs, **Then** the user is informed and the record is not shown as removed while it still exists in the Discogs collection.

---

### Edge Cases

- **Existing personal data**: Users already have notes and condition values stored in Vinylmania. On first synchronization these MUST be carried into the Discogs collection so no information is lost (see FR-010). Condition values that don't match a Discogs grading option cannot be mapped silently — the original text must be preserved (e.g., merged into the notes).
- **Multiple copies of the same release**: Discogs allows several instances of the same release in a collection, each with its own rating/condition/notes. Vinylmania's library models one copy per release; the app manages a single instance per release (see Assumptions) and must not corrupt or delete other instances the user may hold.
- **Link revoked externally**: If the user revoked Vinylmania's access on Discogs, library operations will fail with invalid credentials. The app must detect this, inform the user that re-linking is required, and avoid presenting stale data as current.
- **Discogs outage or rate limiting**: Library load, add, remove, and edits depend on Discogs. Temporary failures must surface a friendly, retryable error — never a silent divergence between library and collection.
- **Large collections**: A linked Discogs collection may contain hundreds or thousands of records delivered in pages; the library must load them completely and remain responsive (skeleton loading states, no layout shift).
- **Release removed from Discogs catalog**: A collection item whose release is no longer retrievable from the catalog must still be listed (with whatever identifying data the collection provides) rather than disappearing silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library view MUST present the content of the linked user's Discogs collection; records present in the Discogs collection but absent from the Vinylmania library MUST appear in the library after synchronization.
- **FR-002**: During a user's FIRST synchronization only, records present in the Vinylmania library but absent from the Discogs collection MUST be added to the Discogs collection (one-time union merge — no user record is dropped by the initial migration). After that first synchronization, the Discogs collection is the sole source of truth for library membership: records absent from the Discogs collection MUST be removed from the library on subsequent synchronizations, and MUST NOT be re-added to Discogs.
- **FR-003**: Users without a linked Discogs account MUST see a message on the library screen explaining that account linking is required, with a direct path to the profile's Discogs connection area; library content and record actions MUST NOT be available to them.
- **FR-004**: Adding a record to the library MUST also add it to the user's Discogs collection. If the Discogs addition fails, the user MUST be informed and the record MUST NOT be presented as successfully owned.
- **FR-005**: Removing a record from the library MUST also remove the corresponding instance from the user's Discogs collection. If the Discogs removal fails, the user MUST be informed and the record MUST NOT be presented as removed.
- **FR-006**: The record detail view MUST display, for owned records, the per-copy data held in the Discogs collection: rating (rendered as a 5-star component), media condition (record), sleeve condition (cover), and notes.
- **FR-007**: The user MUST be able to edit rating, media condition, sleeve condition, and notes from the record detail view, and the edited values MUST be persisted to the user's Discogs collection. Saving is per field (autosave): rating persists when a star is selected, conditions persist on selection, and notes persist when their edit is confirmed; there is no panel-wide Save button.
- **FR-008**: Condition inputs MUST offer exactly the grading options accepted by Discogs for media and sleeve condition; free-text condition entry MUST NOT be offered.
- **FR-009**: Vinylmania MUST stop storing notes and condition in its own user-data store; Discogs becomes the sole system of record for per-copy notes, condition, and rating.
- **FR-010**: Notes and condition values already stored in Vinylmania MUST be migrated into the user's Discogs collection during their first synchronization, without information loss: notes map to Discogs notes; a stored condition matching a Discogs grading option maps to media condition; a stored condition that matches no grading option MUST be preserved verbatim (appended to the notes) rather than discarded. Once the Discogs write is confirmed for an entry, its legacy notes/condition values MUST be deleted from Vinylmania's store; if the Discogs write is not confirmed, the legacy values MUST be retained and migration retried on a later synchronization.
- **FR-011**: Synchronization and per-copy data operations MUST fail visibly and recoverably: the user sees a clear, friendly error and can retry; the app MUST NOT show a record or a value as saved/removed when the Discogs side did not confirm it.
- **FR-012**: When Discogs rejects operations because the account link is no longer valid, the app MUST tell the user that re-linking is required and guide them to the profile's Discogs connection area.
- **FR-013**: The app MUST record its key sync operations (record added/removed, migration performed, sync errors) in its operational logs with enough context to diagnose issues.
- **FR-014**: The library MAY serve the synchronized collection from a short-lived cache (on the order of 5 minutes) to protect Discogs usage limits, and MUST offer an explicit refresh action that forces a fresh synchronization. Changes performed from Vinylmania (add, remove, per-copy edits) MUST be reflected in the library immediately, regardless of the cache window; only changes made directly on Discogs may be deferred until the cache expires or the user refreshes.

### Key Entities

- **Library Entry**: A record the user owns, as known to Vinylmania. After this feature it carries ownership/membership data only (which release, when added, and the reference to the corresponding Discogs collection instance); it no longer carries notes or condition.
- **Discogs Collection Instance**: The user's copy of a release inside their Discogs collection. Holds the per-copy data this feature exposes and edits: rating (0–5), media condition, sleeve condition, and notes. A release can have multiple instances; Vinylmania manages exactly one per release.
- **Discogs Account Link**: The existing connection (feature 015) between the Vinylmania account and the user's Discogs account. Its presence gates the entire library experience; its validity gates every sync and edit operation.
- **Condition Grading Options**: The closed set of condition values accepted by Discogs for media and sleeve (e.g., Mint, Near Mint, Very Good Plus…). Presented as the only selectable options when editing condition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a synchronization completes for a linked user (fresh load or manual refresh), the set of records shown equals the set of records in their Discogs collection — 100% match, in both directions.
- **SC-002**: A record added or removed in Vinylmania is visible as added or removed in the user's collection on the Discogs website immediately afterwards (verifiable on first check, no delayed reconciliation needed).
- **SC-003**: Rating, media condition, sleeve condition, and notes edited in the record detail view are visible on the Discogs website with the same values on first check after saving.
- **SC-004**: 100% of unlinked users who open the library see the "link your accounts" message with a working path to the linking flow; none see a partial or empty library instead.
- **SC-005**: After a user's first synchronization, zero pre-existing notes or condition values are lost: every previously stored note/condition is retrievable from their Discogs collection data (directly mapped or preserved in notes).
- **SC-006**: Users can complete an edit of their copy's data (e.g., set a rating and a condition) from the record detail view in under 30 seconds, including save confirmation.

## Assumptions

- The Discogs account link from feature 015 is in place and provides the ability to act on the user's behalf against their Discogs collection; this feature builds on it and does not modify the linking flow itself.
- Vinylmania models one copy per release. When the user's Discogs collection holds multiple instances of the same release, Vinylmania manages the earliest/first instance and leaves the others untouched; per-copy edits apply only to the managed instance.
- Records added by Vinylmania to the Discogs collection go to the user's default ("Uncategorized") collection folder; Discogs folder organization is out of scope for this feature. Records from any folder of the collection appear in the library.
- The unlinked-user experience blocks the library entirely (message + call to action) rather than offering a degraded read-only library; per the feature description, the library is now defined as the synchronized collection.
- The one-time migration of existing notes/condition happens automatically as part of the user's first synchronization after this feature ships; no separate user action is required.
- Synchronization happens when the library is loaded (subject to the short cache window of FR-014) or when the user manually refreshes; a background/scheduled sync is out of scope. Changes made directly on Discogs become visible on the next fresh synchronization.
- The wantlist, marketplace, custom Discogs folders, and Discogs custom note fields beyond the standard media condition / sleeve condition / notes are out of scope.
