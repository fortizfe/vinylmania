# Phase 1 Data Model: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

This feature introduces no persisted data, no Firestore/Discogs schema
change, no new backend entity, and no new component state or props. Both
changes are pure CSS/markup restructuring:

- The mobile containment fix (research.md Decision 1) adds one class
  (`overflow-hidden`) to `ReleaseImageGallery`'s existing root element — no
  new state, no new prop.
- The desktop two-column reflow (research.md Decision 3) changes the grid
  class structure and DOM nesting on the three detail pages — no new state,
  no new prop, no change to any of the existing data already flowing
  through `ReleaseDetailsSection`, `MasterReleaseDetailsSection`,
  `MyCopySection`, `ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`,
  or `MasterVersionsTable`, all of which keep their current props exactly
  as-is.

See `contracts/ReleaseImageGallery.contract.md` and
`contracts/DetailPageLayout.contract.md` for the DOM-structure contracts
this feature does change (testid positions, grid membership), since there
are no data entities or state transitions to document here.
