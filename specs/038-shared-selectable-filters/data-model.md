# Data Model: Shared Collapsible Filters with Selectable Lists

## LibraryEntry (stored Firestore document) — extended

Path: `users/{uid}/libraryEntries/{id}` (`backend/src/library/types.ts`).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | existing, unchanged |
| `discogsReleaseId` | `number` | existing, unchanged |
| `addedAt` | `Timestamp` | existing, unchanged |
| `discogsInstanceId` / `discogsFolderId` | `number?` | existing, unchanged |
| `legacyCondition` / `legacyNotes` | `string?` | existing, unchanged |
| **`genre`** | `string[]?` | **NEW.** Raw `release.genres` at last successful enrichment. Absent until the entry's first successful enrichment (Decision 3). |
| **`style`** | `string[]?` | **NEW.** Raw `release.styles` at last successful enrichment. |
| **`format`** | `string[]?` | **NEW.** Derived as `release.formats.map(f => f.name)` at last successful enrichment (Discogs' `formats` field is `FormatDescriptor[]`, not a flat string array — `backend/src/discogs/types.ts`). |

**Write rule** (FR-018, FR-020, FR-024): all three fields are written together, only on a successful release lookup during enrichment (`enrichEntry`/`enrichEntries`), overwriting any previous values. On a failed lookup, none of the three fields are touched — the document keeps whatever it had before (including `undefined` if never yet populated).

**Not modeled as a migration**: no schema version bump or backfill script. Per Decision 3, values populate lazily via normal enrichment traffic (page loads and explicit Refresh). This is additive/backward-compatible (Principle VI: MINOR) — existing readers/writers unaware of the three new fields are unaffected; entries lacking them are simply unmatched by any active filter until backfilled (documented spec Edge Case).

## Filter Selection State (frontend, per screen)

Not persisted server-side; lives in component state + URL query params, one instance per screen (Search, Library — independent state, no cross-screen sharing).

| Field | Type | Notes |
|---|---|---|
| `genre` | `string[]` | was `string` (free text) pre-feature; now multi-select, comma-joined in the URL like `format` already is |
| `style` | `string[]` | same change as `genre` |
| `format` | `string[]` | unchanged shape, only the option catalog backing it grows from 33 → 51 values |
| `expanded` | `boolean` | **NEW.** Collapsed by default (FR-002); not persisted in the URL — resets to collapsed on fresh navigation/reload, independent of whether filters are active (spec does not require the expand state itself to survive reload, only the filter *values* do, via existing URL-state mechanics) |

## Genre / Style / Format Catalogs (static reference data)

Three flat, alphabetically-ordered `readonly string[]` constants, generated once from the supplied source files (Decision 4):

| Constant | File | Source | Count |
|---|---|---|---|
| `GENRE_OPTIONS` | `frontend/src/constants/genreOptions.ts` (new) | `.hu/filters-component-data/genres.json` | 15 |
| `STYLE_OPTIONS` | `frontend/src/constants/styleOptions.ts` (new) | `.hu/filters-component-data/styles.json` | 757 |
| `FORMAT_OPTIONS` | `frontend/src/constants/formatOptions.ts` (replaced) | `.hu/filters-component-data/formats-distinct.json` | 51 (was 33) |

No relationships between these three lists; each is an independent flat vocabulary used only to render selectable checkboxes and to validate/reorder incoming URL values (mirroring `FORMAT_OPTIONS`' existing role in `parseFormatParam`/`buildFormatParam`).

## Relationships

```
LibraryEntry (Firestore, per user)
  └─ genre[] / style[] / format[]  ──matched-against──>  Filter Selection State (Library screen)
                                                              (AND across fields, OR within a field's values)

Discogs catalog search (external, per query)
  └─ genre / style / format params (comma-joined)  <──fed-by──  Filter Selection State (Search screen)
```

No new entity is introduced beyond extending `LibraryEntry`; `Filter Selection State` and the three catalogs are UI/request-shaping concepts, not persisted domain entities.
