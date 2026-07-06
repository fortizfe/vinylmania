# Phase 1 Data Model: Persistent Header Search & Results Page

This feature introduces no backend data model, schema, or persistence
changes. It reuses the existing Discogs catalog search and library-entry
contracts untouched (see [contracts/](./contracts/)). The entities below are
transient, client-side UI concepts only — nothing here is stored in Firebase
or any other durable store.

## Search Query (client-side, transient)

Represents the text a user has entered to look up records in the Discogs
catalog.

| Field | Type | Notes |
|---|---|---|
| `value` | string | Raw text typed into the header search box; local component state, not persisted. |
| `submittedValue` | string | The value that was actually submitted; surfaced in the results route as the `q` URL query parameter (see Decision 1 in [research.md](./research.md)). Trimmed and non-empty per FR-006. |
| `page` | number | Current results page number; surfaced as the `page` URL query parameter; defaults to `1`. |

**Lifecycle**: created on keystroke in `HeaderSearchBox` → becomes
`submittedValue`/`page` on submit (triggers navigation to
`/app/search?q=...&page=...`) → `HeaderSearchBox`'s local `value` resets to
empty as soon as the route changes away from `/app/search` (FR-002a).

## Search Result (client-side, already defined by the existing catalog search feature)

Represents one candidate record returned by the Discogs catalog for a given
query. Unchanged from the existing `CatalogSearchResponse` result shape
consumed via `useCatalogSearch` (`frontend/src/queries/discogsQueries.ts`) —
this feature does not modify its fields.

| Field | Type | Notes |
|---|---|---|
| `discogsId` | number | Identity used for add/preview actions and list keys. |
| `title` | string | Rendered on `SearchResultCard`. |
| `artist` | string | Rendered on `SearchResultCard`. |
| `year` | number \| null | Rendered on `SearchResultCard`. |
| `thumbnailUrl` | string \| null | Cover art; `SearchResultCard` falls back to a placeholder when absent. |

**Relationships**: A `Search Query` submission produces zero or more `Search
Result` items for the current `page`; the total page count comes from the
existing `CatalogSearchResponse.pagination` field, unchanged.

## No state transitions requiring a diagram

Both entities are stateless request/response and input data — there is no
multi-step lifecycle beyond "typed → submitted → rendered" already captured
above.
