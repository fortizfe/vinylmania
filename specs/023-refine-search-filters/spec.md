# Feature Specification: Refine Search Filters Usability

**Feature Branch**: `023-refine-search-filters`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Quiero trabajar en refinar un poco más los filtros de la sección de búsqueda. 1. el control más impotante de todos es el de format, por lo que quiero que se coloque el primera posición de los filtros. También quiero que el control sea más complejo. Quiero que en el texto que se muestra en el control, se vayan viendo los formatos seleccionados con el objetivo de no perder el foco de los formatos por los que se está filtrando. Por ejemplo, si el usuario selecciona vinyl, el texto será 'vinyl'. Si el usuario selecciona además CD, el texto será 'vinyl, CD'. En caso de que el texto no quepa entonces se mostrará la primera selección y el total. por ejemplo 'vinyl (+3)'. Los botonoes de aplicar filtro y borrar filtro, no es necesario que tengan texto. Usa solo iconos descriptivos con el fin de que sean más pequeños y ahorren espacio. Los filtros de genre y style no es necesario que sean tan grandes. Hazlos más pequeños y aprovecha el espacio en favor del filtro format. el objetivo final es mejorar la usabilidad de los filtros en general, teniendo como principal y más importante el filtro por forma."

## Clarifications

### Session 2026-07-08

- Q: Should the filter controls (Format, Genre, Style, and any future filters) be built as independent, reusable components rather than as one combined block, to make adding new filters easier later? → A: Yes — each filter control MUST be implemented as an independent, reusable, library-first component, so a future filter can be added without modifying the existing filter components.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Format filter leads and always shows what's active (Priority: P1)

A user filtering search results considers Format the most important filter. They want it to be the first thing they see in the filter bar, and they want its visible label to always reflect exactly which format values are currently selected, so they never lose track of what they're filtering by while they're still choosing values.

**Why this priority**: Format is explicitly called out as the single most important filter. Without repositioning it first and making its state visible at a glance, the rest of the refinement (freeing space, icon-only buttons) has no clear beneficiary.

**Independent Test**: Open the search filter bar, confirm Format is the first control shown (before Genre and Style), select one format value and confirm the control's label updates to show it, then select a second value and confirm the label updates to show both.

**Acceptance Scenarios**:

1. **Given** a user opens the search filter bar, **When** they view the available filters, **Then** the Format control appears first, ahead of Genre and Style.
2. **Given** no format value is currently selected, **When** the user views the Format control, **Then** it shows a neutral label indicating no format is active (e.g., "Format").
3. **Given** a user selects a single format value (e.g., "Vinyl"), **When** the selection is made, **Then** the Format control's visible label updates to show that value (e.g., "Vinyl") without requiring the user to apply the filters first.
4. **Given** a user has "Vinyl" selected and then also selects "CD", **When** the second selection is made, **Then** the label updates to show both, comma-separated (e.g., "Vinyl, CD").
5. **Given** a user keeps adding format selections until the comma-separated list of names no longer fits within the control's available width, **When** the label would overflow, **Then** the label instead shows the first selected value plus a count of how many additional values are selected (e.g., "Vinyl (+3)").
6. **Given** a user deselects values until the remaining comma-separated list fits again, **When** the label re-renders, **Then** it switches back from the "(+N)" abbreviated form to showing the full comma-separated list.
7. **Given** a user has deselected every format value, **When** the label re-renders, **Then** it returns to the neutral "no format active" label from Acceptance Scenario 2.

---

### User Story 2 - Genre and Style shrink to give Format room (Priority: P2)

A user scanning the filter bar sees Genre and Style rendered at a smaller size than before, since they are lower priority than Format. The horizontal space they used to take up is now available to the Format control, reinforcing that Format is the primary filter.

**Why this priority**: This directly serves the P1 goal (Format standing out and having room to show its selection summary) but delivers no value on its own without Format actually being prioritized first — it is a supporting change.

**Independent Test**: Open the search filter bar and compare the rendered size of Genre and Style against their previous size, confirming they are visibly smaller and that Format occupies more of the freed horizontal space.

**Acceptance Scenarios**:

1. **Given** a user opens the search filter bar, **When** they view the Genre and Style controls, **Then** both are visibly more compact than their previous size.
2. **Given** the Genre and Style controls are now more compact, **When** the user views the overall filter bar, **Then** the Format control occupies a visibly larger share of the available horizontal space than before.
3. **Given** the Genre and Style controls are smaller, **When** the user interacts with them (typing a free-text value), **Then** they continue to work exactly as before — only their size changed, not their behavior.

---

### User Story 3 - Apply and Clear become icon-only (Priority: P3)

A user looking at the filter bar's action buttons sees only descriptive icons for "Apply filters" and "Clear filters", with no text labels, so the buttons take up less space and leave more room for the filters themselves.

**Why this priority**: A smaller, purely cosmetic/space-saving change that further supports the overall goal but has the least individual impact of the three stories.

**Independent Test**: Open the search filter bar and confirm the Apply and Clear actions are rendered as icon-only controls that a user can still recognize and operate without visible text.

**Acceptance Scenarios**:

1. **Given** a user views the filter bar's action controls, **When** they look at the "Apply filters" and "Clear filters" actions, **Then** neither shows a visible text label — only an icon.
2. **Given** the icons used for "Apply filters" and "Clear filters", **When** a user looks at them, **Then** each icon is distinct and commonly understood to represent its respective action (e.g., a confirm/check icon for Apply, a clear/reset icon for Clear).
3. **Given** the "Apply filters" and "Clear filters" controls now show only icons, **When** a user relying on assistive technology (e.g., a screen reader) encounters them, **Then** each control is still identifiable by its action, despite lacking visible text.
4. **Given** the icon-only Apply and Clear controls, **When** a user activates either one, **Then** it performs exactly the same action as before (apply the active filter selections, or clear all filter selections) — only the visual presentation changed.

### Edge Cases

- What happens when a user selects every available format value (a long list)? → The label falls back to the "first selection (+N)" abbreviated form per Acceptance Scenario 5, since the full list will not fit.
- What happens when the browser/viewport is narrow (e.g., mobile) and even the abbreviated "First (+N)" label risks not fitting? → The Format control's available width still governs the fit check described in Acceptance Scenario 5; the abbreviated form is the intended fallback for constrained widths, including narrow viewports.
- What happens when a user selects and then immediately deselects the same value before applying? → The label updates live at each step (per Acceptance Scenario 3-4), so it reflects the deselection immediately, returning toward the neutral label if that was the last selection.
- What happens to the Genre/Style/Format filtering behavior itself (matching logic, Apply/Clear semantics, URL persistence)? → Unchanged; this feature only changes position, size, and label/icon presentation, not filter logic (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Format filter control MUST be positioned first among the search filter controls, ahead of Genre and Style.
- **FR-002**: The Format filter control MUST display a live label reflecting the currently selected format value(s), updating immediately as selections change, independent of the "Apply filters" action.
- **FR-003**: When no format value is selected, the Format control MUST show a neutral label indicating no format filter is active.
- **FR-004**: When exactly one format value is selected, the Format control's label MUST show that value's name.
- **FR-005**: When multiple format values are selected and their comma-separated names fit within the control's available width, the label MUST show all selected values as a comma-separated list, in the order they were selected.
- **FR-006**: When multiple format values are selected and their comma-separated names do NOT fit within the control's available width, the label MUST instead show the first selected value followed by a count of the additional selected values in parentheses (e.g., "Vinyl (+3)").
- **FR-007**: The label MUST re-evaluate and switch between the full comma-separated form (FR-005) and the abbreviated "first (+N)" form (FR-006) as selections are added or removed, always reflecting the current selection state.
- **FR-008**: The Genre and Style filter controls MUST be rendered at a visibly smaller size than their previous size, without changing their existing free-text filtering behavior.
- **FR-009**: The horizontal space no longer used by the smaller Genre and Style controls MUST be made available to the Format filter control.
- **FR-010**: The "Apply filters" action MUST be presented without a visible text label, using only an icon.
- **FR-011**: The "Clear filters" action MUST be presented without a visible text label, using only an icon.
- **FR-012**: The icons used for "Apply filters" and "Clear filters" MUST be visually distinct from each other and MUST be commonly recognizable as representing their respective actions.
- **FR-013**: The "Apply filters" and "Clear filters" controls MUST remain identifiable by their action to assistive technology (e.g., screen readers) despite showing no visible text.
- **FR-014**: All existing filter matching behavior established in prior features (free-text Genre/Style, fixed-list multi-select Format with AND-matching, explicit Apply/Clear actions, URL persistence of selections) MUST remain unchanged — this feature governs only the position, size, and label/icon presentation of the filter controls.
- **FR-015**: Each filter control (Format, Genre, Style) MUST be implemented as an independent, reusable, "library-first" component with its own self-contained selection/display logic, so that a new filter type can be added in the future by introducing a new component without modifying the existing filter components' internals.
- **FR-016**: Adding a new filter component in the future MUST NOT require changes to the internal logic of the Format, Genre, or Style components — only registration/placement of the new component within the filter bar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify every currently active format selection just by reading the Format control's label, without opening it, whenever the full selection list fits — 100% of the time the selection count stays within the available width.
- **SC-002**: A user can identify at least the first active format selection and the total count of active selections at a glance, even when the full list of names would not fit — 100% of the time, regardless of how many formats are selected.
- **SC-003**: The Format control is the first filter a user encounters when scanning the filter bar left-to-right (or top-to-bottom on narrow layouts), in 100% of renders.
- **SC-004**: The Genre and Style controls consume less horizontal space than before, and the Format control gains a corresponding increase in available space, in every render of the filter bar.
- **SC-005**: The "Apply filters" and "Clear filters" actions are operable and distinguishable from each other by icon alone, without any visible text, in 100% of renders — including for users of assistive technology.

## Assumptions

- The Format control's live label reflects the user's in-progress (not-yet-applied) selection as they check/uncheck values, matching the stated goal of "not losing track" of the formats being filtered while still choosing them; the label is not limited to only showing the last-applied selection.
- "First selected" in the abbreviated "First (+N)" label form (FR-006) refers to the first value in the user's selection order (the order in which they checked the values), consistent with the worked example in the request (Vinyl selected first, shown first).
- The exact width/character threshold at which the label switches from the full comma-separated form to the abbreviated "First (+N)" form is an implementation detail to be determined during planning, not fixed by this specification — the requirement is the behavior (switch when it doesn't fit), not a specific pixel or character count.
- The relative order between Genre and Style (which one is second and which is third, after Format) is unchanged from the current filter bar; only Format's position moves to first.
- The specific icons chosen to represent "Apply filters" and "Clear filters" are an implementation detail to be selected during planning, as long as they meet FR-012 (distinct and commonly recognizable) and FR-013 (assistive-technology identifiable).
- This feature is a layout, sizing, and label/icon presentation refinement only. It builds on the existing Genre/Style/Format filtering behavior already delivered in prior features (021, 022) and does not alter how filters are matched, combined, applied, cleared, or persisted in the URL.
- Existing responsive behavior of the filter bar across desktop and mobile layouts continues to apply; no new breakpoints or layout modes are introduced by this feature beyond accommodating the reordered/resized controls.
- The library-first componentization requirement (FR-015, FR-016) is a structural constraint on how the filter controls are built during this feature's implementation; it does not itself add a new filter type — it only ensures the Format/Genre/Style components (and the filter bar that composes them) are structured so a future filter can be added with minimal, additive changes. This is consistent with, and reinforces, the project's existing modularity principles.
