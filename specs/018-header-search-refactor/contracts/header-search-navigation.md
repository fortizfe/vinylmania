# UI Contract: Header Search → Search Results Navigation

This feature adds no backend API. The only new "contract" is the client-side
navigation/URL contract between the header search box and the search results
page, plus the (unchanged) reuse of existing Discogs/library contracts.

## Route contract

| Route | Component | Query params | Notes |
|---|---|---|---|
| `/app/search` | `SearchResultsPage` | `q` (string, required for results; absent → empty/prompt state), `page` (number, optional, default `1`) | New route. Replaces `/app/library/add`, which is removed (no route registered, no redirect). |

## Header search box contract (`HeaderSearchBox`)

- **Input**: user keystrokes into a single text field.
- **On submit** (Enter key or a submit action) with a non-empty, trimmed
  value:
  - Navigates to `/app/search?q=<trimmed value>&page=1`.
  - If already on `/app/search`, updates the same route's `q`/`page` params
    instead of pushing a new history entry with reload semantics (FR-005).
- **On submit** with an empty/whitespace-only value: no navigation, no
  request (FR-006).
- **On route change away from `/app/search`**: local input value resets to
  empty (FR-002a).
- **On route change into `/app/search` directly** (e.g., back/forward,
  bookmark): local input value initializes from the `q` param if present.

## Reused, unchanged contracts

These existing contracts are consumed by `SearchResultsPage` exactly as they
are consumed today by `AddRecordPage` — no request/response shape changes:

- `discogsApi.search(query, type, page, perPage)` via
  `useCatalogSearch` (`frontend/src/queries/discogsQueries.ts`)
- `discogsApi.getRelease(discogsId)` via `useCatalogRelease`
  (`frontend/src/queries/discogsQueries.ts`)
- `useCreateLibraryEntry` (`frontend/src/queries/libraryQueries.ts`)

## Removed surface

- Route `/app/library/add` and its component `AddRecordPage` (FR-011).
- The "Add a record" `Link` on `LibraryListPage` (FR-008).
