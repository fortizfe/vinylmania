# Data Model: Detail Screens Card-Based Redesign

No new entities, fields, or state transitions. This feature reorganizes the *presentation* of data that already exists and is already fully typed:

- **`Release`** (`frontend/src/services/libraryApi.ts`) — unchanged. Fields already consumed: `title`, `artists`, `country`, `releaseDate`, `formats`, `labels`, `genres`, `styles`, `images`, `tracklist`, `notes`, `identifiers`, `community`.
- **`EntryDiscogsData`** (`frontend/src/services/libraryApi.ts`) — unchanged. Fields already consumed: `rating`, `mediaCondition`, `sleeveCondition`, `notes`, `editable`.
- **`MasterRelease`** (`frontend/src/services/discogsApi.ts`) — unchanged shape. One previously-fetched-but-unrendered field becomes rendered: `discogsUrl` (used for the new "view on Discogs" link, spec Clarification Q3). No new field is added to the type.
- **`MasterReleaseVersion`** / **`MasterReleaseVersionsPage`** (`frontend/src/services/discogsApi.ts`) — unchanged; still driven by `MasterVersionsTable`'s existing pagination.

The only "grouping" concept this feature introduces is purely visual (which existing fields render inside which `Card`), captured in spec.md's "Proposed Card Distribution" section — not a new data structure.
