# Contract: Search Results Filter UI (delta from feature 021)

**Feature**: 022-search-filter-refinements

This documents only the **changes** to the UI contract established in
`specs/021-search-result-filters/contracts/search-results-filter-ui.md`. Layout
placement (filter control appears above results, below the page `<h1>`), the
explicit "Apply filters"/"Clear filters" actions, and the filtered-empty-state
messaging pattern are unchanged.

## `SearchFiltersControl` component

**Removed**: The Artist field (`Input` with `id="filter-artist"`) is removed
entirely. No replacement element takes its place — the control has one fewer
field.

**Changed**: The Format field is no longer an `Input`. It becomes:

- A trigger `Button` (e.g. `id="filter-format-trigger"`) labeled `Format` when no
  values are selected, or `Format (N)` when `N` values are selected.
- Clicking the trigger opens a `Modal` (title: "Format") containing:
  - A scrollable list of `Checkbox` inputs, one per `FORMAT_OPTIONS` entry
    (`id="filter-format-option-{label}"`, sanitized for DOM-safety), each showing
    the format's label.
  - No internal "apply"/"cancel" button inside the modal — checking/unchecking
    updates the control's pending format selection immediately; closing the
    modal (via the existing close button, Escape key, or backdrop click, all
    already supported by the `Modal` atom) does not discard the selection.
  - The outer "Apply filters" button remains the only action that triggers a new
    search (FR-008 unchanged); the outer "Clear filters" button resets format to
    an empty selection along with genre/style, same as before.

**Unchanged**: Genre and Style remain `Input` fields (`id="filter-genre"`,
`id="filter-style"`), unaffected by this feature (FR-006).

## New atom: `Checkbox`

`frontend/src/components/ui/Checkbox.tsx` — a labeled checkbox atom following the
existing `Input` atom's conventions (Tailwind v4 utilities, dark-mode support,
`id`/`label` props), added because no such atom exists yet and the format picker
needs ~33 of them.

## Active-filter summary (`SearchResultsPage`)

The existing "no results, filters are active" messaging and any other
display naming active filters (feature 021) drops the Artist label and renders
the Format filter's active value as a comma-joined list of selected labels (e.g.
"Vinyl, CD") when one or more are selected — consistent with the spec's Edge
Cases section.

## Frontend contract test coverage (feature 022 delta)

- `SearchFiltersControl` renders exactly Genre, Style, and a Format trigger
  button — no Artist field present.
- Opening the Format trigger renders all `FORMAT_OPTIONS` as checkboxes; none
  pre-checked when no format filter is active.
- Checking two format checkboxes and clicking "Apply filters" calls `onApply`
  with `format: ['Vinyl', 'CD']` (order consistent with `FORMAT_OPTIONS` order or
  selection order — implementation's choice, tasks.md will pin down one).
- "Clear filters" resets format to an empty selection and closes/keeps the modal
  state consistent with a fresh, all-unchecked render.
