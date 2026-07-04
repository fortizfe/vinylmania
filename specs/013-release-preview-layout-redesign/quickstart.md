# Quickstart: Validating the Release Preview Layout Redesign

This is a presentation-only frontend change. There is no new API contract to exercise — validation is done by running the app and the frontend/e2e test suites.

## Prerequisites

- Node.js installed, dependencies installed in `frontend/` and `e2e/` (`npm install` in each, if not already done).
- A Discogs-backed record in your library (or use the e2e suite's fixture data — see `e2e/tests/release-preview-gallery.spec.ts`, which fakes the Discogs endpoints).

## Run the frontend locally

```bash
cd frontend
npm run dev
```

1. Sign in and navigate to the library/add-record search flow.
2. Search for and open a record's preview (the "Preview details" action).
3. On a desktop-width window, confirm:
   - The gallery spans the full width, main image is square, thumbnail strip has no visible scrollbar.
   - Below it: key details (title, artist, genres, styles, date, label) on the left, tracklist on the right.
   - Below that: remaining info (notes, identifiers, community stats) full width.
   - No scrollbar is visible anywhere in the modal, even if the tracklist is long enough to make the modal scroll.
4. Resize the window to a mobile width (or use devtools device emulation) and confirm the sections stack in order: gallery, key details, tracklist, remaining info.
5. Open a record with a single image, no images, missing optional metadata, and no tracklist, and confirm each section degrades gracefully (see spec Edge Cases).

## Run the automated checks

```bash
# Unit/component tests
cd frontend
npm test

# Type check (no new type errors introduced)
npm run typecheck   # or: npx tsc --noEmit, per existing frontend script

# e2e (from repo root or e2e/, per existing project convention)
cd e2e
npm test
```

**Expected outcome**: all existing and newly added/updated unit tests pass (`ReleasePreviewModal`, `ReleaseImageGallery`, `ReleaseDetailsSection`, `ReleaseTracklistSection`, `ReleaseAdditionalInfoSection`, `addRecordFlow` integration test), and the extended `release-preview-gallery.spec.ts` e2e spec passes, asserting: full-width square gallery, desktop column order (details left / tracklist right), mobile stacking order, and no visible scrollbar in any preview scroll container.

## Manual visual/regression check (per Constitution's e2e + no-layout-shift gates)

- Compare the loading skeleton against the loaded state for the same record — confirm no visible layout shift (skeleton proportions match the new 4-section layout).
- Toggle dark mode and confirm all four sections (gallery, key details, tracklist, remaining info) render correctly in both themes.
- Confirm no regression to the existing "Preview details" button flow or modal close/escape behavior (unchanged `Modal` component).

## Out of scope for this quickstart

- No database, migration, or backend endpoint changes to validate — this feature does not touch `backend/`.
- No new environment variables or configuration.
