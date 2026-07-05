# Quickstart: Validating the Record Detail View Redesign

This is a presentation-only frontend change. There is no new API contract to exercise — validation is done by running the app and the frontend/e2e test suites.

## Prerequisites

- Node.js installed, dependencies installed in `frontend/` and `e2e/` (`npm install` in each, if not already done).
- At least one record already added to your library (via the "Add a record" search flow), ideally one with multiple images, a format/genre/style/label, and a tracklist, to exercise the full layout.

## Run the frontend locally

```bash
cd frontend
npm run dev
```

1. Sign in, open the "Add a record" search flow, and use "Preview details" on a search result — note the gallery/key-details/tracklist/remaining-info layout and single bordered container.
2. Add that record to your library, then open it from the library list to reach its detail page (`/app/library/records/:entryId`).
3. On a desktop-width window, confirm the detail page matches the preview's structure:
   - One shared bordered container wraps the whole page content (no separate card per section).
   - The gallery spans the full width, main image is square, thumbnail strip has no visible scrollbar.
   - Below it: key details (title, artist, format, genres, styles, date, label) on the left, tracklist on the right.
   - Directly below key details, in the same left column: "Your copy" (condition and notes), as a plain section (no separate card border).
   - Below that row: remaining info (notes, identifiers, community stats) full width, if the release has any.
4. Confirm inline editing still works exactly as before: click/tap the condition value, pick a new option, blur/confirm — it autosaves and shows a brief confirmation. Click/tap notes, edit, press Escape — the edit is discarded and the original value is restored.
5. Resize the window to a mobile width (or use devtools device emulation) and confirm the sections stack in order: gallery, key details, my copy, tracklist, remaining info.
6. Open a record with a single image, no images, missing optional metadata, no tracklist, and a library entry whose catalog status is unavailable, and confirm each case degrades gracefully (see spec Edge Cases) while "Your copy" remains visible and editable.

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

**Expected outcome**: all existing and newly added/updated unit tests pass (`ReleaseDetailsSection`, `MyCopySection`, and the `recordDetailFlow` integration test), the three deleted component test files (`DiscInfoCard`, `RecordHeaderImage`, `TracklistCard`) no longer exist, and the extended `record-detail-inline-edit.spec.ts` e2e spec passes — asserting both the new layout and that the condition-autosave-survives-reload flow is unchanged.

## Manual visual/regression check (per Constitution's e2e + no-layout-shift gates)

- Compare the loading skeleton (`RecordDetailSkeleton`) against the loaded state for the same record — confirm no visible layout shift.
- Toggle dark mode and confirm all sections (gallery, key details, my copy, tracklist, remaining info) render correctly in both themes.
- Confirm the "Remove from library" action still works and returns to the library list after confirmation.
- Confirm the "back to library" link is still present and unchanged.

## Out of scope for this quickstart

- No database, migration, or backend endpoint changes to validate — this feature does not touch `backend/`.
- No new environment variables or configuration.
