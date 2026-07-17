# UI Contract: View-mode toggle & list-mode rows

**Feature**: 052-grid-list-view-toggle | **Date**: 2026-07-17

This feature adds no new route. It extends the existing `/app/search`
(`SearchResultsPage`) and `/app/library` (`LibraryListPage`) routes with a
presentation-mode toggle and a second rendering path for their existing
result/entry lists. No query param, URL, or navigation contract changes.

## `ViewModeToggle` component contract (new)

`frontend/src/components/ui/ViewModeToggle.tsx`

**Props**:

```ts
interface ViewModeToggleProps {
  mode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
  /** Distinguishes the two independent instances for testids/aria-label scoping. */
  screen: 'search' | 'library';
}
```

**Markup / accessibility contract**:

- Root: `role="radiogroup"`, `aria-label="View mode"` (or localized
  equivalent), `data-testid="view-mode-toggle"`.
- Two children, each `role="radio"`, `aria-checked={mode === 'grid'|'list'}`:
  - `data-testid="view-mode-grid"`, accessible name "Grid view" (or
    localized equivalent).
  - `data-testid="view-mode-list"`, accessible name "List view".
- Only the active option has `tabIndex={0}`; the inactive option has
  `tabIndex={-1}` (roving tabindex, standard radiogroup keyboard pattern
  — Left/Right or Up/Down arrow moves focus and selection between the two,
  matching spec US1 AC9).
- Each option MUST render at `min-h-11 min-w-11` (44px) at mobile
  viewport widths (spec FR-016), reusing `ThemeToggle`'s existing sizing
  utility class, not an arbitrary value.

**Behavior contract**:

- Clicking/activating the inactive option calls `onChange` with the newly
  selected mode; the currently-active option is a no-op on click.
- Purely controlled — this component holds no internal mode state; the
  parent page owns `mode` via `useViewModePreference` (see below).

## `useViewModePreference` hook contract (new)

`frontend/src/hooks/useViewModePreference.ts`

```ts
function useViewModePreference(
  storageKey: 'vinylmania:view-mode:search' | 'vinylmania:view-mode:library'
): { mode: 'grid' | 'list'; setMode: (mode: 'grid' | 'list') => void };
```

- Reads `storageKey` from `localStorage` once on mount; falls back to
  `'grid'` when absent or the stored value is not exactly `'grid'` or
  `'list'` (spec FR-004).
- `setMode` updates in-memory state and writes through to `localStorage`
  synchronously (no debounce — matches `ThemeContext`'s write-on-change
  pattern).
- Two independent call sites (`SearchResultsPage` with the `:search` key,
  `LibraryListPage` with the `:library` key) never share state (spec
  FR-003) — this hook holds no module-level/global state, only
  per-invocation `useState`.

## Route contract (extended — rendering only, no param/URL change)

| Route | Component | New testids when `mode === 'list'` | Notes |
|---|---|---|---|
| `/app/search` | `SearchResultsPage` | `search-results-list` (replaces `search-results-grid` container) | Toggle rendered top-right beside `<h1>`, per spec US1 AC1. Infinite scroll, filters, loading/error states unchanged (spec FR-002, FR-014). |
| `/app/library` | `LibraryListPage` | `library-record-list` (replaces `library-record-grid` container) | Toggle rendered in the existing `flex items-center justify-between` header row, alongside the existing "Refresh" button (spec US1 AC2). Pagination, filters unchanged. |

## `SearchResultListRow` component contract (new)

`frontend/src/components/SearchResultListRow.tsx`

**Props**: identical to `SearchResultCard` — `{ result: CatalogSearchResult;
searchPath: string; onAdd: () => void; adding: boolean; added: boolean }`.

**Behavior**:

- `result.resultType === 'master'`: simplified row — stacked-cover visual
  (same `data-testid="search-result-stacked-covers"` treatment as the
  grid card), title, artist, "Multiple editions" badge; no "Add to
  library" action (spec US3 AC5).
- Otherwise: cover (or `data-testid="search-result-thumbnail-placeholder"`
  when absent) on the left; title + artist (visually emphasized) and
  formats/country/year/labels (secondary style, comma-joined when
  multiple) on the right; `ResultCardActions` (unchanged component) for
  "Add to library"; community rating badge (unchanged component) overlaid
  on the cover (spec FR-018).
- Whole row wrapped in the same `<Link>` destination as the grid card
  (`/app/masters/:id` or `/app/releases/:id`) — clicking any non-button
  area of the row navigates (spec FR-009); clicking "Add to library"
  itself does not navigate (event does not bubble through the `<Link>`,
  same as the existing card's footer-outside-link structure).

## `RecordListRow` component contract (new)

`frontend/src/components/RecordListRow.tsx`

**Props**: identical to `RecordCard` — `{ entry: EnrichedLibraryEntry }`.

**Behavior**:

- `entry.catalogStatus === 'unavailable' || !entry.release`: same
  degraded-state copy and "Open record" link as `RecordCard`, adapted to
  a row layout (spec US2 AC6).
- Otherwise: cover on the left; title + artist (visually emphasized) and
  formats/country/year/labels (secondary, comma-joined across all
  entries — `release.formats.map(f => f.name)`,
  `release.labels.map(l => l.name)`, `release.artists.map(a => a.name)`
  — spec FR-007) on the right; missing optional fields simply omitted
  (spec FR-008).
- Whole row wrapped in the same `<Link to={/app/library/records/${entry.id}}>`
  as the grid card (spec FR-009).

## Non-goals

- No change to `SearchResultCard`/`RecordCard` (grid mode) markup,
  props, or testids.
- No change to `search-results-skeleton`/`search-results-loading-more`
  testid names — only their rendered shape adapts to list mode per the
  constitution's "skeleton mirrors final content" rule; the testids
  themselves are reused, not renamed.
