# Feature Specification: "My Library" Redesign — Sorting, Infinite Scroll, WCAG 2.1 AA & Apple HIG

**Feature Branch**: `068-library-redesign-sort-scroll`

**Created**: 2026-09-19

**Status**: Draft

## Clarifications

### Session 2026-09-19

- Q: How should names starting with an article be ordered in artist/album sort? → A: Ignore common leading articles (The, A, An, El, La, Los, Las, Die, Les); "The Clash" sorts under C.
- Q: Should one server-side path serve every order, including the default newest-first? → A: Yes — every order (default included) is computed over the full matching collection (filter → sort → split into batches); the separate date-only paged lookup is retired.
- Q: How do sort and filters survive returning from a record's detail page? → A: The library passes its current address (sort + filters) along when opening a record; the detail page's Back action and the navigation after removing a record return there, falling back to the plain library address when none was passed (e.g. a deep-linked detail page).
- Q: In the sort & filter panel, does a choice apply immediately or on an Apply button? → A: Everything applies live on the Library screen: each sort or filter selection takes effect immediately and the Apply button is removed (mobile bottom sheet and ≥ 640 px filter drawer alike); Search's filters are unchanged. Each live change restarts the list, is announced politely with the new count, keeps focus on the control just changed, and a visible "Clear all filters" action remains.
- Q: On ≥ 640 px, is the sort control a native dropdown or a custom menu? → A: A native dropdown with one option group per criterion (Date added / Artist / Album); inside the mobile sheet sort is a radio group. Focus containment therefore applies only to the sheet and the filter drawer.
- Q: On ≥ 640 px, where do the filters open from the sticky toolbar? → A: A "Filters" button opens the app's existing side drawer (end-anchored, drag-dismissible on touch); its filter content is the same as the mobile sheet's.

**Input**: User description: "HU Rediseño de «Mi biblioteca» (My Library): Accesibilidad WCAG 2.1 AA, Experiencia de Usuario Apple HIG, Ordenación e Infinite Scroll" — full HU (sections 1–6: context, four P1 user stories with BDD criteria, three UX proposals A/B/C with A recommended, architect-agent phase plan, WCAG 2.1 AA matrix, success criteria) as provided in the `/speckit-specify` invocation.

## Scope Decisions (frozen at Specify, Principle III)

- **Chosen UX direction: Proposal A — "Apple Music Dynamic Glass & Floating Capsule"** (the HU's recommended option; §4 already targets it for planning).
- **Out of scope** (YAGNI):
  - Proposal B's alphabet scrubber and Proposal C's dynamic section headers, hide-on-scroll controls and Cmd+1/2/3 shortcuts.
  - Syncing the sort choice across devices/accounts: sort lives in the URL only (shareable, deep-linkable); view mode keeps its existing per-device stored preference.
  - Remembering the last-used sort between visits: a bare `/app/library` link always opens with the default sort.
  - Drag-to-reorder or any manual ordering of the collection.
  - Search-within-library (unchanged: not part of this feature).
  - Animating records moving to their new positions when the sort changes (formerly FR-022): a sort change restarts the list from the top with a new first batch, so there is nothing to move between positions. Worth adding only if sorting ever re-orders the loaded records in place.
  - Live-apply filters on the Search screen: Search keeps its Apply button; live apply is a Library-only change.
- **Preserved as-is**: genre/style/format filter options, grid/list view toggle and its stored preference, the "Refresh" action, the "link your Discogs account" gate, empty-state messages.
- **Changed on Library only**: filters apply live on each selection instead of on an Apply button (see FR-021a).
- **UI copy language**: English, matching the rest of the current Library screen; the Spanish strings in the HU are translated (e.g. «Has llegado al final de tu colección — X vinilos» → "You've reached the end of your collection — X records").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort the library by artist, album or date added (Priority: P1)

A collector with a large collection wants to reorder their records by artist, album title or the date each record was added, in either direction, so they can find a specific album fast or review their latest acquisitions.

**Why this priority**: It is the only brand-new capability that changes *what* the user can do; without it the collection is fixed to "newest first". It is the core value of the HU.

**Independent Test**: Open the library, pick "Artist (A → Z)", and verify the full collection (across every loaded batch) is in artist order, the address bar reflects the choice, and reloading or sharing the link reproduces the same order.

**Acceptance Scenarios**:

1. **Given** the library toolbar, **When** the user opens the sort control, **Then** exactly six options are offered, grouped by criterion: Date added — "Newest first" (default) / "Oldest first"; Artist — "Artist (A → Z)" / "Artist (Z → A)"; Album — "Album (A → Z)" / "Album (Z → A)"; the current option is visibly and programmatically marked as selected. On ≥ 640 px this is a native dropdown with one option group per criterion; in the mobile sheet it is a radio group with the same grouping.
2. **Given** a sort option is chosen, **When** it activates (immediately on selection, with no Apply step), **Then** the address reflects it (e.g. `/app/library?sort=artist&dir=asc`), the list restarts from the top and the first batch and every later batch are in that global order (not just re-ordered within the batch already on screen).
3. **Given** active genre/style/format filters, **When** the user changes the sort, **Then** the filters are preserved and only the order changes; **and given** an active sort, **When** the user changes filters, **Then** the sort is preserved.
4. **Given** artist or album sorting, **When** names contain accents, diacritics or mixed case (e.g. "Motörhead", "Björk", "ac/dc"), **Then** they sort as a person would expect in a language-aware alphabetical order (accents and case do not push a name to the end or start of the list).
5. **Given** a screen-reader user, **When** the sort changes, **Then** a polite live announcement states the new order (e.g. "Sorted by artist, A to Z") and focus stays on the sort control.
6. **Given** a link such as `/app/library?sort=artist&dir=asc&genre=Rock`, **When** it is opened (fresh session, other device), **Then** the page restores that exact sort and filter state.

---

### User Story 2 - Continuous loading with infinite scroll and zero layout shift (Priority: P1)

A collector browsing their records wants more records to appear automatically as they scroll, without pressing Previous/Next, and without the page jumping while new records arrive.

**Why this priority**: Replaces the current pagination buttons (removed by this feature) and is required for sorting to feel global; it aligns Library with the Search screen's existing behaviour.

**Independent Test**: With a collection of more than 20 records, scroll down and verify batches of 20 load automatically before reaching the end, placeholders match the real items' size, and an end-of-collection message appears with the total.

**Acceptance Scenarios**:

1. **Given** the collection on screen, **When** the user scrolls to within roughly 300 px of the end of the loaded content, **Then** the next batch of 20 records is requested without user action.
2. **Given** a batch is loading, **When** the user waits, **Then** placeholder items with the same dimensions as real cards (grid) or rows (list) are shown in place of the incoming records, and the content already on screen does not move (no layout shift).
3. **Given** all records matching the current filters have loaded, **When** the user reaches the end, **Then** no further requests are made and a subtle message reads "You've reached the end of your collection — X records" (X = total matching records; singular form for 1).
4. **Given** a later batch fails to load (network or server error), **When** the failure occurs, **Then** the records already shown stay intact, an alert message with an accessible "Retry" button appears at the end of the list, and automatic loading pauses until the user retries.
5. **Given** the first batch fails, **When** the page loads, **Then** the existing full-page error (or the Discogs link gate, when applicable) is shown as today.
6. **Given** the user opens a record from the library, **When** they use the detail page's Back action or remove the record, **Then** they return to the library with the same sort and filters they left (scroll position restoration is best-effort, not required); **and given** the detail page was opened directly (no library visit before), **When** they go Back, **Then** they land on the plain library address with default sort and no filters.

---

### User Story 3 - Ergonomic dual layout toolbar (Priority: P1)

A collector using the app on a phone or a desktop wants view, sort and filter controls that are within thumb reach on mobile, spacious on desktop, visually light, and always accessible while scrolling.

**Why this priority**: It is the home for the new sort control and the reason the redesign exists; the existing toolbar has no room for sort and is not thumb-friendly.

**Independent Test**: At a 390 px wide viewport, verify a floating capsule near the bottom of the screen gives access to view mode and a combined "Sort & Filter" panel; at 1280 px, verify a sticky translucent top toolbar with view toggle, sort dropdown and a Filters button opening a side drawer; in both, controls remain reachable while scrolling through the collection.

**Acceptance Scenarios**:

1. **Given** a phone-sized viewport (< 640 px), **When** the library is shown, **Then** a clean header shows the "Your library" title in the brand display typeface with a discreet record count and the "Refresh" action, and a floating translucent capsule sits 16 px above the bottom edge (respecting device safe areas) containing the grid/list segmented control and a "Sort & Filter" button with a badge showing how many filters are active.
2. **Given** the mobile capsule, **When** the user taps "Sort & Filter", **Then** a bottom sheet opens with the sort options (radio group) and the filters, each applying live on selection, plus a visible "Clear all filters" action; it can be dismissed by dragging it down, tapping outside, pressing Escape or a visible close button, and focus returns to the "Sort & Filter" button on close.
3. **Given** a tablet or desktop viewport (≥ 640 px), **When** the page is shown, **Then** the header keeps the title, record count and "Refresh" action, and the controls sit in a horizontal translucent toolbar that sticks to the top while scrolling (records slide under it with a sense of depth), spanning the page's wide content width on large screens (≥ 1280 px, the page's existing wide breakpoint) and containing the view toggle, a native sort dropdown showing the current criterion and direction (A→Z / Z→A, newest/oldest), and a "Filters" button (with active-filter count) that opens a side drawer with the same live filter content as the mobile sheet; the drawer is dismissible by Escape, outside click, a visible close button and, on touch, dragging it away, and focus returns to the "Filters" button on close.
4. **Given** any viewport, **When** the user switches grid/list, **Then** the choice is remembered on that device as today, and the control gives immediate press feedback (a subtle press-down on pointer down).
5. **Given** the floating capsule on mobile, **When** the user scrolls to the end of the list, **Then** the last records, the end-of-collection message and the retry banner are never hidden behind the capsule.
6. **Given** every interactive element on a phone-sized viewport, **When** its touch area is measured, **Then** it is at least 44×44 CSS px.
7. **Given** the sheet or drawer is open, **When** the user toggles a filter, **Then** the list behind restarts with the new results, the record count and active-filter badge update, a polite announcement states the new total (e.g. "Showing 42 records"), and focus stays on the filter the user just changed.

---

### User Story 4 - Rigorous accessibility and system preferences (Priority: P1)

A user with visual or motor accessibility needs wants every part of the redesigned library to respect their system preferences and to be fully operable by keyboard and screen reader.

**Why this priority**: WCAG 2.1 AA is a non-negotiable merge gate (Constitution Principle X); it applies to every surface introduced in stories 1–3.

**Independent Test**: Run an automated accessibility audit in light and dark themes, complete sort → filter → load more → retry using only the keyboard, and repeat with reduced motion enabled.

**Acceptance Scenarios**:

1. **Given** any text, badge or control in light or dark theme, including over translucent materials with record artwork scrolling beneath, **When** contrast is measured, **Then** normal text is at least 4.5:1 and UI components/large text at least 3:1.
2. **Given** the system setting "reduce motion", **When** any sheet, drawer or press transition runs, **Then** springs and movement are replaced by a short static cross-fade (about 150 ms) or no animation.
3. **Given** keyboard-only use, **When** the user moves with Tab, Shift+Tab, Enter, Space, Escape and arrow keys, **Then** every control is reachable and operable in a logical order, focus is always visibly indicated, focus is contained within the bottom sheet / filter drawer only while it is open and returns to the trigger when closed, the sort dropdown behaves as a standard native dropdown, and no keyboard trap exists anywhere.
4. **Given** assistive technology, **When** the sort control, filters, sheet, drawer or view toggle are inspected, **Then** each exposes an accessible name, role, current value/selection and (for the sheet/drawer triggers) expanded/collapsed state.
5. **Given** a new batch loads or the end is reached, **When** a screen-reader user is on the page, **Then** the change is announced politely without stealing focus (e.g. "20 more records loaded", "End of collection, X records").
6. **Given** state conveyed by color (active filter badge, selected sort option, selected view), **When** viewed without color perception, **Then** the state is also conveyed by text, icon or shape.

---

### Edge Cases

- **Empty collection / no matches**: the existing "No records yet" and "No results for the active filters" messages still appear; no end-of-collection message and no loading sentinel. With live filters, "Clear all filters" stays reachable in the sheet/drawer so the user can recover from zero matches.
- **Exactly 20 records or fewer**: a single batch; the end message shows immediately after the first batch.
- **Records missing an artist or album name** (e.g. not yet synced from Discogs): they are placed after all named records in both A→Z and Z→A, ordered among themselves by newest added.
- **Records just added from within the app**: they carry no artist or album name until the next Discogs collection sync, so under artist/album sort they appear after all named records (as above) until then.
- **Ties**: order is stable and deterministic across batches — no record is duplicated or skipped between batches. Artist sort ties break by album title, then newest added, then a unique record identifier; album sort ties break by artist, then newest added, then a unique record identifier; date-added ties break by a unique record identifier.
- **"Various" / "Various Artists"** compilations sort by that literal name like any other artist.
- **Articles in names** ("The Clash", "Los Suaves", "Die Toten Hosen"): a single leading article from the list The, A, An, El, La, Los, Las, Die, Les is ignored for ordering ("The Clash" sorts under C), while the name is still displayed as written. A name that is only the article (e.g. a band literally called "The") sorts by that word. Known limitation: band names that genuinely begin with one of these words (e.g. "A Perfect Circle" sorts under P) follow the same rule.
- **Invalid or unknown URL values** (e.g. `?sort=foo`, `?dir=up`, `?sort=artist` without `dir`): fall back to the default for the missing/invalid part (default criterion is date added newest-first; default direction is A→Z for artist/album, newest-first for date) without an error.
- **Legacy `?page=N` links**: ignored; the list starts from the top.
- **Detail page opened directly** (bookmark, shared link): Back and post-removal navigation go to the plain library address with default sort and no filters.
- **Collection changes while scrolling** (record added/removed elsewhere, or "Refresh" run): refreshing restarts the list from the first batch with the current sort and filters, so no duplicates or gaps are shown.
- **Rapid sort/filter changes** (more likely with live apply, e.g. ticking several filters quickly): only the latest choice's results are displayed; results from an earlier choice never replace newer ones, and each change is announced only once its results are shown.
- **Viewport resized across the 640 px breakpoint** (rotation, window resize): layout switches between capsule and top toolbar without losing sort, filters, view mode or loaded records; an open sheet or drawer closes gracefully.
- **Very tall screens** where the first batch does not fill the viewport: the next batch loads automatically until the screen is filled or the collection ends.
- **Browser without translucency support**: toolbar and capsule fall back to an opaque surface that still meets contrast requirements.

## Requirements *(mandatory)*

### Functional Requirements

**Sorting**

- **FR-001**: Users MUST be able to sort their library by date added (newest first — default; oldest first), artist (A→Z; Z→A) and album title (A→Z; Z→A).
- **FR-002**: Every order, including the default newest-first, MUST be computed over the whole matching collection (filter, then sort) before it is split into batches, so every batch continues the same global order.
- **FR-003**: Alphabetical sorting MUST be language-aware: case-insensitive and treating accented/diacritic letters as their base letter for ordering purposes.
- **FR-003a**: Alphabetical sorting MUST ignore a single leading article (The, A, An, El, La, Los, Las, Die, Les — case-insensitive, followed by a space) when ordering, while displaying the name unchanged.
- **FR-004**: Records lacking the sort field MUST appear after all records that have it, regardless of direction.
- **FR-005**: Sorting MUST be deterministic with a stable tie-break ending in a unique record identifier (see Edge Cases → Ties) so batch boundaries never duplicate or skip records.
- **FR-006**: The active sort MUST be represented in the page address (criterion and direction) alongside the existing filters; changing sort MUST preserve filters and vice versa. Default values MAY be omitted from the address.
- **FR-007**: Opening an address containing sort and filter parameters MUST restore that exact state; invalid or unknown values MUST fall back to defaults silently.
- **FR-008**: Changing sort MUST apply immediately on selection and announce the new order to assistive technology through a polite live region, keeping focus on the sort control.
- **FR-009**: *Removed* (merged into SC-002).
- **FR-009a**: The sort control MUST take the per-viewport form given in US1 AS1 (native grouped dropdown on ≥ 640 px, grouped radio group in the mobile sheet).

**Infinite scroll**

- **FR-010**: The Previous/Next pagination buttons MUST be removed and replaced by automatic loading of the next batch of 20 records when the user scrolls within about 300 px of the end of the loaded content.
- **FR-011**: While a batch is loading, the system MUST show placeholders with the same dimensions as the real items for the active view mode, and MUST NOT shift content already on screen.
- **FR-012**: When no more records match, the system MUST stop requesting and show "You've reached the end of your collection — X records" with the total matching count.
- **FR-013**: When a later batch fails, already displayed records MUST remain, an alert with an accessible "Retry" button MUST appear, and automatic loading MUST pause until retry succeeds.
- **FR-014**: Changing sort, changing filters, or running "Refresh" MUST restart the list from the first batch.
- **FR-015**: Only the results of the most recent sort/filter selection MAY be displayed. (Each sort + filter combination is loaded and kept as its own result set, so a late answer for an earlier choice can never replace the current one; no extra cancellation mechanism is required.)
- **FR-015a**: Opening a record from the library MUST carry the library's current address (sort + filters); the record detail's Back action and the navigation after removing the record MUST return to it, falling back to the plain library address when none was carried.

**Layout & toolbar (Proposal A)**

- **FR-016**: On viewports narrower than 640 px, controls MUST live in a floating translucent capsule 16 px above the bottom edge (safe-area aware) with the grid/list control and a "Sort & Filter" button showing the active filter count.
- **FR-017**: "Sort & Filter" MUST open a bottom sheet containing the sort options and the filters (both applying live), dismissible by drag-down, outside tap, Escape and a visible close control, with interruptible spring motion.
- **FR-018**: On viewports 640 px and wider, controls MUST live in a sticky translucent top toolbar with the view toggle, the native sort dropdown showing the current criterion and direction, and a "Filters" button showing the active filter count that opens the app's existing end-anchored side drawer (drag-dismissible on touch) with the same filter content as the mobile sheet; on ≥ 1280 px the toolbar spans the page's wide content width.
- **FR-019**: The page content MUST reserve space so the floating capsule never hides the last records, the end message or the retry alert.
- **FR-020**: The header MUST show, on every viewport, the page title in the brand display typeface, a discreet record count equal to the total records matching the current filters (the same X as the end message), and the "Refresh" action.
- **FR-021**: The filter options (genre/style/format), grid/list toggle with its per-device remembered preference, "Refresh" action, Discogs link gate and empty states MUST keep working unchanged in behaviour, except for how filters apply (FR-021a).
- **FR-021a**: On the Library screen, each filter selection MUST apply immediately (no Apply button), restart the list (FR-014), update the address, record count and active-filter badge, be announced as required by FR-028 while focus stays on the control just changed, and a visible "Clear all filters" action MUST remain available whenever at least one filter is active. The Search screen's filters are unchanged.
- **FR-022**: *Removed* (reorder animation moved to Out of scope).

**Accessibility (WCAG 2.1 AA, Principle X)**

- **FR-023**: All text MUST meet 4.5:1 contrast and all UI components/large text 3:1, in light and dark themes, including over translucent surfaces; an opaque fallback MUST be used where translucency is unsupported.
- **FR-024**: Every interactive element MUST have a touch target of at least 44×44 CSS px on phone-sized viewports.
- **FR-025**: All controls MUST be keyboard operable with a visible focus indicator; the bottom sheet and the filter drawer MUST contain focus only while open, close on Escape, and return focus to their trigger; no keyboard traps.
- **FR-026**: The sort control, filter controls, "Sort & Filter" / "Filters" triggers, sheet, drawer and view toggle MUST expose accessible name, role and current value/selection; the sheet and drawer triggers MUST also expose expanded state.
- **FR-027**: With reduced motion enabled, springs and translations MUST be replaced by a ~150 ms cross-fade or no animation.
- **FR-028**: Batch loaded, end reached, load failure and the result of a live sort/filter change (the new order, or the new total, e.g. "Showing 42 records") MUST be announced politely to assistive technology without moving focus.
- **FR-029**: No state (selected sort, selected view, active filters, errors) may be conveyed by color alone.

### Key Entities

- **Library record**: a record in the user's collection; for this feature it needs a date added, a primary artist name, an album title and a unique identifier, plus the existing genre/style/format facets. Album title is taken from the same Discogs collection sync that already provides the primary artist.
- **Sort selection**: criterion (date added | artist | album) + direction (ascending | descending); default date added, newest first. Lives in the page address only.
- **Library view state**: sort selection + facet filters (address) + view mode (per-device preference) + loaded batches (session only). The address part is carried into a record's detail page so Back returns to it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cumulative layout shift while loading additional batches by scrolling is 0 (measured over scrolling through at least 3 batches in grid and list modes).
- **SC-002**: After the response for a new sort or filter selection is received, the updated list is painted in under 100 ms, measured in an automated browser test from response received to the first record of the new order being visible.
- **SC-003**: 100% of the redesigned Library screen passes automated WCAG 2.1 AA checks with zero violations in light and dark themes, at phone and desktop widths, and in each state (loading, loaded, end, error, sheet/drawer open).
- **SC-004**: A keyboard-only user can change sort, apply and clear a filter, switch view, load further records and trigger a retry without a pointer and without getting trapped.
- **SC-005**: 100% of interactive elements at a 390 px wide viewport measure at least 44×44 CSS px.
- **SC-006**: Any link combining sort and filters restores the identical ordered list (same first 20 records in the same order) on a fresh session.
- **SC-007**: Scrolling through an entire collection of 200+ records under any sort shows every matching record exactly once (no duplicates, no gaps) and ends with the correct total.
- **SC-008**: Users reach the next records without any explicit pagination action; the next batch starts loading before the user reaches the end of the loaded content.
- **SC-009**: Opening a record from a sorted and filtered library and pressing Back returns to the same sort and filters in 100% of cases.

## Assumptions

- Collections are in the "few hundred records" per-user range already assumed by the Library listing (spec 038), so filtering and sorting the whole matching collection on every batch request is acceptable; this replaces today's separate date-only paged lookup for the unfiltered case.
- Primary artist is already stored per record from the Discogs collection sync (feature 061); album title will be stored the same way as a prerequisite, backfilled on the next sync. Records not yet backfilled (including records just added from within the app) follow the "missing field goes last" rule (FR-004).
- "Date added" is the date the record entered the user's Discogs collection, as already stored and used for today's newest-first order.
- The batch size (20) and the sentinel + Retry pattern follow the existing Search screen's infinite scroll; unlike Search (which starts loading only when the end of the list becomes visible), Library starts loading about 300 px before the end.
- The 640 px (mobile/tablet) breakpoint and the 1280 px wide-content breakpoint follow the Library page's existing responsive breakpoints; widths from 640 px up to 1279 px use the top toolbar in a compact form.
- The existing filter options are reused inside the bottom sheet and the ≥ 640 px side drawer; the options do not change, but on Library they apply live instead of via an Apply button (FR-021a). The existing side drawer and bottom-sheet behaviour (focus trap, Escape, drag-to-dismiss) are reused, not rebuilt.
- Scroll position restoration when returning from a record's detail page is best-effort; restoring sort and filters is required (FR-015a).
- The design must be built consulting the installed `apple-design`, `emil-design-eng` and `animate` skills (Constitution Principle XI); where Apple-style translucency conflicts with contrast, WCAG wins (Principle X).
