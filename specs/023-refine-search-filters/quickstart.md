# Quickstart: Validate Refine Search Filters Usability

Validates the feature described in [spec.md](./spec.md) against its acceptance scenarios, using the component split from [plan.md](./plan.md) and [data-model.md](./data-model.md).

## Prerequisites

- Node.js and the repo's package manager already set up (see repo root `README.md`).
- `frontend/` dependencies installed: `npm install` (run from `frontend/`).
- For e2e: `e2e/` dependencies installed and Playwright browsers available (see `e2e/README.md` if present, or `npx playwright install` from `e2e/`).

## Automated validation

From `frontend/`:

```bash
npm run test -- SearchFiltersControl FormatFilter TextFilterField FilterActions
```

Expected: all unit tests pass, covering — per [data-model.md](./data-model.md) and spec FR-002–FR-013 —
- `FormatFilter` label states: none selected → "Format"; one selected → the value name; multiple selected fitting → comma-separated list; multiple selected overflowing → "First (+N)".
- `TextFilterField` renders Genre/Style at the new compact size and preserves free-text behavior.
- `FilterActions` renders Apply/Clear as icon-only, each with an accessible name (e.g. `aria-label`).
- `SearchFiltersControl` renders Format before Genre/Style (FR-001).

From `e2e/`:

```bash
npx playwright test search-result-filters
```

Expected: the extended spec passes, including new assertions for Format-first ordering, the live label updating without an Apply click, and the icon-only Apply/Clear controls remaining operable by their accessible name/role.

## Manual validation (matches spec Acceptance Scenarios)

1. Run the frontend dev server (`npm run dev` from `frontend/`) and navigate to a search results page with query params, e.g. `/search?q=nirvana`.
2. **Format-first (US1, AS1)**: Confirm the Format control is the first filter shown, ahead of Genre and Style.
3. **Live label (US1, AS2–AS4)**: With no format selected, confirm the control shows "Format". Open it, select "Vinyl" — confirm the label updates to "Vinyl" immediately (no Apply click). Select "CD" as well — confirm the label updates to "Vinyl, CD".
4. **Abbreviation (US1, AS5–AS6)**: Keep selecting formats until the comma-separated text would overflow the control's width — confirm the label switches to "Vinyl (+N)" form. Deselect down to a count that fits again — confirm it switches back to the full list.
5. **Reset (US1, AS7)**: Deselect all formats — confirm the label returns to "Format".
6. **Compact Genre/Style (US2)**: Confirm Genre and Style render visibly smaller than before, and that Format visually occupies more of the filter bar's width. Type into Genre/Style and confirm they still filter as before once Apply is pressed.
7. **Icon-only actions (US3)**: Confirm "Apply filters" and "Clear filters" show only icons, with no visible text, are visually distinguishable from each other, and — via a screen reader or the browser accessibility tree inspector — each exposes a distinct accessible name (e.g., "Apply filters" / "Clear filters").
8. **Regression check (FR-014)**: Apply a Format + Genre combination, confirm results match prior (pre-feature) matching behavior, and confirm the resulting URL still encodes `genre`/`style`/`format` exactly as before.
9. **Dark mode (constitution UI Design System)**: Toggle the app's dark mode and repeat steps 2–7 — confirm the Format label, compact Genre/Style fields, and icon-only Apply/Clear controls all remain legible and correctly styled.
10. **Extensibility (FR-016)**: In `SearchFiltersControl.tsx`, confirm a hypothetical new filter could be added as one new component in `frontend/src/components/filters/` plus one new line in the composing container, without editing `FormatFilter.tsx`, `TextFilterField.tsx`, or `FilterActions.tsx`.

## Definition of done for this quickstart

All automated checks above pass, and all 10 manual steps produce the expected outcome with no regressions in existing filter matching or URL persistence.
