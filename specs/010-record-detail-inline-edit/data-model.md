# Phase 1 Data Model: Record Detail View Redesign with Inline Editing

No new persisted entities or schema changes. This feature reuses the existing
`Release` (catalog) and `EnrichedLibraryEntry` (my copy) types already defined
in `frontend/src/services/libraryApi.ts` / `backend/src/discogs/types.ts` /
`backend/src/library/types.ts`. Documented here are the display-mapping rules
and the one new client-side UI state introduced by this feature.

## Disc (existing `Release`, read-only display mapping)

| Spec field | Source field(s) | Display rule |
|---|---|---|
| Title | `release.title` | Shown as-is; already displayed today. |
| Artist(s) | `release.artists: ReleaseArtistCredit[]` | Render all credited artists (each has `name`); join with `, ` or list them, matching FR-005/Acceptance Scenario 3 ("all credited artists are shown"). Already partially displayed today (one `<p>` per artist). |
| Year | `release.year?` | Shown only if present (FR-005: omit if missing). |
| Format | `release.formats: FormatDescriptor[]` | Render every descriptor's `name` (e.g., "Vinyl"); if a descriptor has `descriptions` (e.g., `["12\""]`), append them. Show all entries if more than one (Acceptance Scenario 4). |
| Genre | `release.genres: string[]` | Render all genres (e.g., joined with `, `); show all if more than one (Acceptance Scenario 4). |
| Header image | `release.images: CatalogImage[]` | Use the entry with `imageType === 'primary'`; fall back to the first entry if none is marked primary; if `images` is empty, render a placeholder (Edge Case: no cover image). |

No new fields are added to `Release` — this is purely how the frontend reads
and renders the existing array-shaped fields.

## My Copy (existing `EnrichedLibraryEntry`, editable fields)

| Field | Type | Notes |
|---|---|---|
| `condition` | `string \| undefined` | Unchanged. Editable via the closed `CONDITION_OPTIONS` set already defined in `RecordDetailPage.tsx`. |
| `notes` | `string \| undefined` | Unchanged. Editable as free text. |

No schema change. The existing `PATCH /api/library/:id` contract (accepting
`condition` and/or `notes`, independently, via `undefined`-omission) already
supports the per-field autosave this feature needs (see research.md).

## New UI-only state: `InlineEditableField` state machine

This is component state, not persisted data, but is documented here since it
governs the my-copy block's behavior (FR-009 through FR-017).

**States**: `read` → `editing` → (`saving` →) `saved` (transient, reverts to
`read`) — with a possible `error` state reached from `saving` on failure
(returns to `editing`, not `read`, so the entered value is retained per
FR-016).

**Transitions**:

| From | Event | To | Side effect |
|---|---|---|---|
| `read` | click/tap on the field | `editing` | Focus the editor; keep the current value as the starting value. |
| `editing` | blur / Enter-confirm / tap-outside | `saving` | Call `libraryApi.update` with only this field's new value. |
| `editing` | Escape | `read` | Discard the in-progress value; revert to the last saved value (FR-013). No network call. |
| `saving` | update resolves | `saved` | Show transient confirmation (~1.5s), field now shows the new value. |
| `saving` | update rejects | `error` (within `editing`) | Show inline error; retain the entered (unsaved) value so the collector can retry (FR-016); log via `console.error`. |
| `saved` | timeout elapses | `read` | No further action. |

**Constraint (FR-017)**: The parent `RecordDetailPage` tracks at most one
"active" field key (`'condition' | 'notes' | null`). Starting to edit a new
field first resolves (triggers the blur/save path of) whichever field was
previously active, ensuring only one field is ever in `editing`/`saving`/
`error` at a time.

## Relationships

- One `EnrichedLibraryEntry` references exactly one `Release` (`discogsReleaseId`
  → `release`), unchanged from today.
- The `InlineEditableField` state machine is instantiated twice per detail-view
  render (once for `condition`, once for `notes`), coordinated by the single
  "active field" value held in `RecordDetailPage`.
