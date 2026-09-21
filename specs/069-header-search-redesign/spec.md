# Feature Specification: Header Search Bar Redesign — Instant Suggestions, WCAG 2.1 AA & Apple HIG

**Feature Branch**: `069-header-search-redesign`

**Created**: 2026-09-21

**Status**: Draft

**Input**: `VINYLMANIA-6 — [Search] [HU-1] Rediseño de la Barra de Búsqueda del Header` (https://fortizfe.atlassian.net/browse/VINYLMANIA-6), child of epic `VINYLMANIA-5`; refined user story in `.hu/search-ux-redesign.md` §2 Historia 1.

## Clarifications

### Session 2026-09-21

- Q: ¿Bajo qué diseño de referencia se implementa la barra del header, dado que VINYLMANIA-9 sigue sin decidirse? → A: El BDD de VINYLMANIA-6 es el contrato del header; la forma "empujar contenido" de la Propuesta B no se adopta y VINYLMANIA-9 queda acotado a resultados y filtros.
- Q: ¿Cómo se reparten los 5 huecos del panel entre artistas y álbumes? → B: Cupo con relleno — hasta 2 artistas y hasta 3 álbumes; si un tipo no llena su cupo, el otro lo ocupa hasta completar 5, sirviéndose de una única petición al catálogo.
- Q: ¿La búsqueda móvil expandida es un diálogo modal o una expansión no modal? → A: No modal — se expone como un campo de búsqueda con su lista de sugerencias, con backdrop decorativo y clicable, sin atrapar el foco ni ocultar el resto de la página a la tecnología asistiva; solo se suspende el scroll de la página detrás.
- Q: Al activar la búsqueda con el campo ya pre-rellenado (≥2 caracteres), ¿se abre el panel de sugerencias? → A: No — el panel solo aparece tras una edición real; el texto queda seleccionado para poder reemplazarlo de un tecleo.
- Q: ¿Cómo se verifica SC-006 para dar la historia por terminada? → A: Automatizado — flujo completo por teclado más aserciones sobre la región de anuncios y sobre el estado expuesto; la pasada manual con lector de pantalla es recomendada, no bloqueante.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a search from anywhere, on any screen size (Priority: P1)

A collector browsing any screen of the app wants to reach for search, get a field that is clearly there and comfortably sized, and start typing immediately — on a phone as readily as on a wide monitor. Today the field is cramped at phone width, gives no sense of entering a search mode, and the rest of the page competes for attention while the collector types.

**Why this priority**: It is the entry point to the whole search ecosystem; every other scenario in this feature starts here, and the redesigned bar already delivers value on its own even before suggestions exist.

**Independent Test**: On a phone-width and a desktop-width screen, activate the header search from three different screens of the app, confirm the field is focused and ready for typing without a second tap, that the page behind is visibly de-emphasised, and that submitting a query lands on the full results screen as before.

**Acceptance Scenarios**:

1. **Given** the collector is on any screen of the app, **When** they tap or click the header search, **Then** the bar expands with a physically believable settle (no bounce, ~0.35 s), the field takes focus automatically so typing starts immediately, and a translucent blurred backdrop appears over the content behind it.
2. **Given** the screen is narrower than 640 px, **When** search is activated, **Then** the field occupies the full width as an overlay, every control in it is at least 44×44 px, and no horizontal scrolling of the page is introduced.
3. **Given** the screen is 1024 px or wider, **When** the collector interacts with the search, **Then** it expands within the header and the rest of the layout stays visible and in place — nothing below the header moves.
4. **Given** an active search with text typed, **When** the collector submits it, **Then** they land on the full results screen for that query, exactly as today; **and given** they were already on the results screen, **Then** their active filters are re-applied to the new query.
5. **Given** an expanded search, **When** the collector presses Escape, taps the backdrop, or moves focus away without submitting, **Then** the bar collapses, the backdrop disappears, and the page returns to its normal state with focus back on the control that opened it.
6. **Given** the collector has asked their system to reduce motion, **When** search opens or closes, **Then** the change is instant with no expansion or fade, while the backdrop and focus behaviour are unchanged.

---

### User Story 2 - See instant suggestions while typing (Priority: P1)

A collector who knows roughly what they are looking for wants the app to propose matching artists and albums as they type, so they can jump straight to the record instead of reading a full results page.

**Why this priority**: It is the new capability this feature adds and the main reason the redesign exists; it shortens the path from intent to record.

**Independent Test**: Type a two-character fragment of a known artist, pause, and confirm a short list appears without leaving the page holding both artist and album matches within their allowances; repeat with a fragment that matches albums only and confirm the panel still fills to 5 with albums. Choosing a suggestion goes straight to that record (album) or to its results (artist).

**Acceptance Scenarios**:

1. **Given** the collector has typed at least 2 characters, **When** they pause typing briefly (~300 ms), **Then** a panel appears below the field with up to 5 quick matches, each clearly identified as an artist or an album, without navigating away from the current page.
2. **Given** the collector has typed fewer than 2 characters, **When** they stop typing, **Then** no lookup is made and no suggestion panel is shown.
3. **Given** the suggestion panel is open, **When** the collector picks an album suggestion, **Then** they go directly to that record's detail; **and when** they pick an artist suggestion, **Then** they go to the full results for that artist.
4. **Given** the collector keeps typing or deletes characters quickly, **When** several lookups were started, **Then** the panel only ever shows matches for the text currently in the field — a slower earlier lookup never replaces a newer result.
5. **Given** a lookup is in progress, **When** the collector waits, **Then** placeholders of the same shape and size as real suggestions are shown, so the panel does not resize or shift when results arrive.
6. **Given** the collector clears the field, **When** it becomes empty, **Then** the panel closes and any in-flight lookup is discarded.

---

### User Story 3 - Operate the whole search with keyboard or screen reader (Priority: P1)

A collector who navigates by keyboard, or who uses a screen reader, wants to open the search, move through suggestions, choose one, and get out — without a mouse and without losing track of where they are.

**Why this priority**: Accessibility is a non-negotiable release gate for the project (Constitution Principle X); a suggestion panel that is only usable by pointer would block the feature entirely.

**Independent Test**: With the pointer unused, Tab to the search, type a query, move through the suggestions with the arrow keys, confirm one with Enter, and close with Escape, checking at each step that the announcement region carries the current result count and that the active suggestion is the one highlighted.

**Acceptance Scenarios**:

1. **Given** the collector navigates with the keyboard, **When** they Tab to the search, **Then** the focus indicator is clearly visible against both light and dark backgrounds, and they can type without any further action.
2. **Given** suggestions are shown, **When** the collector presses the Down/Up arrows, **Then** the highlighted suggestion moves through the list and is announced as the active option; **When** they press Enter, **Then** the highlighted suggestion is opened, or — if none is highlighted — the typed query is submitted as a full search.
3. **Given** the suggestion panel is open, **When** the collector presses Escape, **Then** the panel closes and the typed text stays; **When** they press Escape again, **Then** the search collapses and focus returns to the control that opened it.
4. **Given** a screen reader is in use, **When** suggestions appear, change, or come back empty, **Then** the number of available results is announced politely, without interrupting what the user is typing.
5. **Given** the collector is anywhere inside the expanded search, **When** they Tab forward or backward, **Then** focus moves in a predictable order and is never trapped with no way out.
6. **Given** any state of the search (idle, loading, suggestions, empty, error), **When** it is shown, **Then** text meets a 4.5:1 contrast ratio (3:1 for large text and control boundaries) in both light and dark themes, and no state is conveyed by colour alone.

---

### User Story 4 - Understand when there is nothing to show or something went wrong (Priority: P2)

A collector whose query matches nothing, or who is on a flaky connection, wants to be told plainly what happened and be able to carry on, instead of staring at an empty box or a panel that never resolves.

**Why this priority**: The feature is usable without it — suggestions simply would not appear — but without it a failed lookup looks like a broken app, and a zero-match query looks like a frozen one.

**Independent Test**: Search for a string that matches nothing and confirm an explanatory empty state; then force the lookup to fail and confirm an error message with a working Retry action, while the full search submission still works.

**Acceptance Scenarios**:

1. **Given** the collector has typed 2 or more characters, **When** the lookup returns no matches, **Then** the panel shows an accessible empty state naming the searched text and suggesting how to broaden the search, and this is announced politely.
2. **Given** the lookup fails (network or service error), **When** the failure happens, **Then** a non-intrusive error message with an accessible "Retry" action is shown in place of the list, and it is announced politely.
3. **Given** an error message is shown, **When** the collector activates "Retry", **Then** the same query is looked up again and the panel returns to the loading state.
4. **Given** suggestions are unavailable for any reason, **When** the collector submits the typed query, **Then** the full results screen opens normally — the failure never blocks the main search path.

---

### Edge Cases

- **Below the minimum**: a 1-character query, or one made only of spaces, produces no lookup and no panel; typing a second meaningful character starts one.
- **No matches**: a valid 2+ character query with zero results shows the empty state rather than an empty panel or the previous query's list.
- **Lookup failure**: a network or service failure shows a retryable error; repeated failures do not stack up messages.
- **Out-of-order responses**: when the collector types faster than the app answers, a late response for an older query is discarded and never overwrites the current one.
- **Field cleared mid-flight**: clearing the field while a lookup is running closes the panel and discards the result when it arrives.
- **Dismiss while loading**: closing the search (Escape, backdrop, focus change) while a lookup is running leaves nothing pending on screen or announced.
- **Same query repeated**: retyping a query just searched does not trigger a fresh upstream lookup within a short window (Discogs rate-limit discipline).
- **Slow lookup**: while a lookup is outstanding, placeholders keep the panel's size stable; the panel never appears and disappears repeatedly between keystrokes.
- **Very long or pasted query**: pasting a long string counts as a single change — one lookup, not one per character — and the field does not overflow its container at any width.
- **Re-opening on the results screen**: activating the search while already viewing results pre-fills the current query, selected and ready to be replaced, and shows no suggestion panel until the collector edits the text — the results already on screen are not duplicated in a panel over them.
- **Session expired**: a lookup rejected because the session is no longer valid is treated as a failure of the panel only, and follows the app's existing sign-in handling rather than showing a raw error.
- **Scroll behind the phone overlay**: with the overlay open, scrolling gestures over the darkened area do not move the page underneath; closing the search restores scrolling at the same position.
- **Intermediate widths (640–1023 px)**: behaves as the wide layout — expanded in the header, page layout intact.

## Requirements *(mandatory)*

### Functional Requirements

**Activation, layout and dismissal**

- **FR-001**: The header MUST expose a single search entry point on every signed-in screen of the app, at every viewport width, reachable without navigating away from the current screen.
- **FR-002**: Activating the search MUST expand it with a spring-like settle of about 0.35 s with no overshoot, and MUST place a translucent, blurred (≈20 px) backdrop over the content behind it.
- **FR-003**: On activation the text field MUST receive focus automatically, with no second interaction required before typing.
- **FR-004**: When the search is activated from the full results screen, the field MUST be pre-filled with the query currently in effect and that text MUST be selected, so a single keystroke replaces it. Activation alone MUST NOT trigger a suggestion lookup or open the panel, however many characters are pre-filled: the panel only follows an actual edit by the collector.
- **FR-005**: Below 640 px the search MUST present as a full-width overlay, MUST NOT introduce horizontal page scrolling, and every interactive control within it MUST be at least 44×44 CSS px. The overlay MUST NOT be modal: the rest of the page stays reachable by assistive technology and focus is never trapped inside the search. Scrolling of the content behind it MUST be suspended while it is open, so the page does not move under the overlay.
- **FR-006**: At 640 px and above the search MUST expand within the header while the rest of the layout remains visible and unmoved (no layout shift in the page behind).
- **FR-007**: The search MUST collapse — removing the backdrop, restoring page scrolling and returning focus to the control that opened it — on Escape, on activating the backdrop, and when focus leaves the search without a submission. This applies at every viewport width, including the phone-width overlay.
- **FR-008**: Submitting the typed query MUST open the full results screen for that query, preserving the existing behaviour of re-applying active filters when the collector is already on the results screen.
- **FR-009**: When the system reports a reduced-motion preference, the expand/collapse animation MUST be replaced by an instant state change, with backdrop, focus and announcement behaviour unchanged.

**Suggestions**

- **FR-010**: The app MUST look up suggestions only once the field holds at least 2 non-whitespace characters, and only after typing has paused for about 300 ms; continuous typing MUST NOT produce one lookup per keystroke.
- **FR-011**: The app MUST display at most 5 suggestions, each showing enough to be recognised (artist or album name plus a secondary detail such as the artist, year or format) and each labelled as an artist or an album by means other than colour alone. The 5 slots MUST be allocated as up to 2 artists and up to 3 albums, and when one kind returns fewer matches than its allowance the other kind MUST fill the remaining slots, so a panel is never short of 5 while matches remain.
- **FR-012**: Choosing an album suggestion MUST open that record's detail directly; choosing an artist suggestion MUST open the full results for that artist (the app has no standalone artist screen).
- **FR-013**: The panel MUST always reflect the text currently in the field: responses belonging to a superseded query MUST be discarded rather than rendered.
- **FR-014**: While a lookup is outstanding the panel MUST show placeholders that match the final suggestions in shape and size, so the panel does not resize when results arrive.
- **FR-015**: Emptying the field, or dismissing the search, MUST close the panel and discard any outstanding lookup and its announcement.
- **FR-016**: Suggestion lookups MUST be served exclusively by Vinylmania's own backend; the browser MUST NOT contact Discogs or any other external provider directly (Constitution Principle IX).
- **FR-017**: Repeating a query that was just looked up MUST reuse the recent result within a short window rather than issuing a new upstream request, so typing in the header cannot burn through the catalogue provider's rate limit (Constitution Principle II).

**Empty and error states**

- **FR-018**: A query with 2+ characters and zero matches MUST show an empty state that names the searched text and suggests broadening the search.
- **FR-019**: A failed lookup MUST show a non-intrusive error message with an accessible "Retry" action that re-runs the same query; consecutive failures MUST replace, not accumulate, the message.
- **FR-020**: A failing or unavailable suggestion lookup MUST NOT prevent the collector from submitting the typed query and reaching the full results screen.

**Accessibility (Constitution Principle X — non-negotiable)**

- **FR-021**: The search field and every suggestion MUST show a clearly visible focus indicator, and the whole flow (open, type, browse, choose, dismiss) MUST be completable with the keyboard alone, with no keyboard trap.
- **FR-022**: Down/Up arrows MUST move the active suggestion through the list; Enter MUST open the active suggestion, or submit the typed query when none is active; Escape MUST close the panel first and collapse the search on a second press.
- **FR-023**: The number of available suggestions, and the empty and error states, MUST be announced politely to assistive technology whenever they change, without interrupting typing.
- **FR-024**: The search field MUST carry a persistent accessible name and MUST be exposed as a text input with an associated list of suggestions — not as a dialog — with its expanded/collapsed state, the presence of the suggestion list, and the currently active suggestion all exposed programmatically.
- **FR-025**: Every state (idle, loading, suggestions, empty, error) MUST meet a 4.5:1 contrast ratio for text and 3:1 for large text and control boundaries, in both light and dark themes, and MUST NOT rely on colour alone to convey state.

### Key Entities

- **Suggestion**: one quick match shown in the panel — a primary label (album or artist name), a secondary detail that disambiguates it (artist, year, format), its kind (artist or album), and the destination it opens.
- **Suggestion request**: the trimmed text the collector typed, the moment it was issued, and whether it is still the current one; used to decide what the panel is allowed to display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any signed-in screen, a collector can go from "wanting to search" to "typing" in a single tap or click, with no second interaction to place the cursor — verified on phone and desktop widths.
- **SC-002**: A collector who knows the album they want reaches its detail screen from the header in at most 3 interactions (activate, type, choose), against 4 or more today (activate, type, submit, pick from the results page).
- **SC-003**: After the collector pauses typing, quick matches appear within 1 second for a recently searched term and within 2.5 seconds for a first-time term on a typical mobile connection.
- **SC-004**: Typing a 10-character query at normal speed produces no more than 3 suggestion lookups; typing continuously produces none until the collector pauses.
- **SC-005**: In a rapid typing-and-deleting test of at least 20 keystrokes, the list shown never belongs to anything other than the text currently in the field (0 stale lists).
- **SC-006**: An automated check drives the entire flow — open, type, browse suggestions, choose, dismiss — with the keyboard alone, at phone and desktop widths, and asserts that the announcement region carries the current result count after every change of state (loading, results, empty, error) and that the expanded state and the active suggestion are correctly exposed at each step. A manual pass with a real screen reader is recommended before release but is not a merge gate.
- **SC-007**: Automated accessibility checks of the header search report 0 WCAG 2.1 AA violations in light and dark themes at 375 px and 1440 px, in every state (idle, loading, suggestions, empty, error).
- **SC-008**: Opening, using and closing the search causes no visible movement of the page content behind it, and the panel itself does not change size between its loading and loaded states.
- **SC-009**: When suggestions cannot be retrieved, 100 % of attempts to submit the typed query still reach the full results screen.
- **SC-010**: Every interactive control in the search measures at least 44×44 CSS px at phone widths, with no exceptions.
- **SC-011**: A single suggestion lookup costs at most one request to the external catalogue, and a query whose matches are all of one kind still fills the panel to 5 when 5 matches exist.

## Assumptions

- **This is a redesign plus one new capability, not a new screen.** A header search bar already exists and already navigates to the full results screen with filter preservation; this feature restyles and re-behaves it (expansion, backdrop, focus, mobile overlay) and adds the suggestion panel, which does not exist today. The existing submit-and-navigate behaviour is preserved rather than rebuilt.
- **Suggestions reuse the catalogue search the app already performs**, narrowed to a handful of results and without the rating enrichment the full results screen needs, rather than a new external integration. The ticket names a dedicated address for it; whether that is a new address or the existing one with a narrower shape is a planning-phase decision and is deliberately not fixed here.
- **Catalogue search already works for collectors who have not linked a Discogs account**, so suggestions are available to every signed-in collector. No new gate or prompt is introduced.
- **The header search only exists on signed-in screens**; the public landing screen is unchanged.
- **Product constraints taken from the ticket and adopted as defaults**: 2-character minimum, ~300 ms typing pause, at most 5 suggestions, ~0.35 s settle with no overshoot, ~20 px backdrop blur, 44×44 px minimum targets. The settle timing matches the motion settings already used elsewhere in the app, so no new motion vocabulary is introduced.
- **This ticket's acceptance scenarios prevail over the epic's prototype sketches for the header.** Where the epic's "Proposal B" sketch has the bar push the page content downwards, this feature does not: the layout behind the search stays put (FR-006, SC-008). Grouping suggestions into labelled artist/album sections, sketched in "Proposal A", likewise stays out of scope.
- **The 640–1023 px band follows the wide-layout behaviour** (expanded in the header). The ticket only specifies below 640 px and at or above 1024 px; splitting the middle band into a third layout would add a state nobody asked for.
- **Suggestions cover the external catalogue only** — artists and albums — not the collector's own library or wishlist entries.
- **Artist suggestions open results, not a detail screen**, because the app has no standalone artist screen and adding one is not part of this ticket.
- **UI copy is in English**, matching the rest of the app; the Spanish strings in the ticket are translated.
- **Result ordering within each kind is whatever the catalogue returns**; the only shaping applied is the 2-artist/3-album allowance with fill-up from the other kind. No custom relevance ranking or re-scoring is introduced.

### Out of scope

- Redesign of the search results view (`VINYLMANIA-7`) and of the filter component (`VINYLMANIA-8`) — separate stories in the same epic; this feature must not change either.
- Choosing between the epic's three UX prototypes (`VINYLMANIA-9`) — that decision is scoped to the results view and the filter component; the header's behaviour is fixed by this ticket's own acceptance scenarios and is not re-opened by it.
- Search history, recent searches, saved searches — add when collectors ask to return to a previous search.
- Searching the collector's own library or wishlist from the header — add if "where is this in my collection?" becomes a common need.
- Typo tolerance, fuzzy matching or semantic/AI search — add if zero-result queries prove to be mostly misspellings.
- Keyboard shortcut to open search from anywhere — add if collectors report the pointer trip to the header is the bottleneck.
- Grouping suggestions into labelled sections (artists / albums) — add if a flat list of 5 proves ambiguous in testing.
- Voice input, barcode scan or image search — not part of this epic.

### Dependencies

- The existing full results screen and its filter behaviour (specs 021/022/027/040) remain in force and are the destination of a submitted query.
- The app's existing motion settings, focus-management and overlay behaviour (spec 059) are the basis for the expansion and backdrop; no new motion tokens are assumed.
- Constitution Principles I (test-first), II (Discogs integration discipline and rate limits), III (YAGNI), IX (the browser calls only Vinylmania's backend), X (WCAG 2.1 AA) and XI (Apple design principles).
