# Phase 1 Data Model: Refine Search Filters Usability

This feature introduces no new persisted data, API payloads, or Firestore/backend entities — it only restructures client-side component state and presentation for the existing search filter set (spec Assumptions: "layout, sizing, and label/icon presentation refinement only"). The entities below are in-memory UI state shapes relevant to implementation, not stored records.

## Search Filter Set (existing, unchanged in shape)

Already defined by `SearchFilters` in `frontend/src/hooks/useSearchQueryParams.ts`:

| Field | Type | Notes |
|---|---|---|
| `genre` | `string \| undefined` | Free text; unchanged by this feature (FR-014). |
| `style` | `string \| undefined` | Free text; unchanged by this feature (FR-014). |
| `format` | `string[] \| undefined` | Zero or more values from the fixed `FORMAT_OPTIONS` list; unchanged matching/URL-persistence semantics (FR-014). |

This feature does not add, remove, or rename any field on `SearchFilters`, and does not change how it round-trips through the URL query string.

## Format Filter Selection (in-progress, pre-Apply state)

A new conceptual entity representing the live, not-yet-applied selection driving the Format control's label (FR-002–FR-007). It already exists today as `selectedFormats` local state in `SearchFiltersControl`; this feature relocates it into the new `FormatFilter` component without changing its shape.

| Field | Type | Notes |
|---|---|---|
| `selectedFormats` | `string[]` | Ordered by selection (append-on-toggle), a subset of `FORMAT_OPTIONS`. Drives the label per FR-004–FR-007. |
| (derived) `label` | `string` | Computed, not stored: `"Format"` when empty (FR-003); the joined list when it fits (FR-005); `"{first} (+{n-1})"` when it doesn't (FR-006). Recomputed on every change to `selectedFormats` and on container resize. |

**Lifecycle**: Initialized from the currently-applied `filters.format` (URL state) on mount/navigation, mutated locally as the user checks/unchecks options in the Format modal, reset to `[]` on Clear, and only propagated outward (to `onApply`) when the user explicitly applies — identical lifecycle to today's `selectedFormats`, just now owned by `FormatFilter` instead of `SearchFiltersControl`.

## Text Filter Field (Genre / Style)

A new conceptual entity representing the generic, reusable free-text filter (FR-008, FR-015), instantiated twice (Genre, Style) by the composing container.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | DOM id, e.g. `filter-genre` / `filter-style` (unchanged from today). |
| `label` | `string` | Display label, e.g. "Genre" / "Style". |
| `value` | `string` | Current text value (component-controlled, mirrors existing `textFields.genre` / `textFields.style`). |
| `onChange` | `(value: string) => void` | Propagates edits up to the composing container's shared `textFields` state. |

No new validation rules are introduced beyond the existing trim-on-apply behavior (FR-014).

## Filter Actions (Apply / Clear)

A stateless entity — two action handlers passed through from the composing container, rendered as icon-only controls (FR-010–FR-013). No new state; `onApply` / `onClear` retain their existing signatures from `SearchFiltersControlProps`.
