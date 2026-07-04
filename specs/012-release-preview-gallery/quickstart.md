# Quickstart: Validating the Release Preview Popup Redesign

## Prerequisites

- Frontend dev server running: `cd frontend && npm run dev`
- Backend running (with `DISCOGS_TOKEN` configured, per existing project
  setup) so `GET /api/discogs/releases/:discogsId` resolves against real
  Discogs data — pick a search result whose release has notes, community
  data, identifiers, and multiple images on Discogs to exercise the full
  details section and gallery.
- Signed in (existing auth flow) on the "Add record" / search page.

## Validation Scenarios

### 1. Full release details shown above the tracklist (User Story 1)

1. Search for a release known to have label/catalogue number, country,
   release date, notes, and community stats on Discogs (check
   discogs.com directly if unsure).
2. Click that search result card to open the preview popup.

**Expected outcome**: A details section appears above the tracklist showing
label + catalogue number, country, release date, genres, styles, notes, and
community stats (have/want, rating) — in addition to the title/artist
already shown today. The tracklist still renders after this section,
unchanged.

### 2. Missing fields are omitted, not blank (User Story 1 / Edge Case)

1. Open the popup for a release known to have little metadata on Discogs
   (e.g., no notes, no community rating yet).

**Expected outcome**: Only the fields Discogs actually has are shown — no
empty labels, no "N/A" placeholders, no blank rows in the details section.

### 3. Two-column layout on a wide viewport (User Story 2)

1. Open the preview popup with the browser window widened past the
   breakpoint (e.g., ~1200px).

**Expected outcome**: The image gallery renders in one column; the release
details section and tracklist render in the other column.

### 4. Single stacked column on a mobile viewport (User Story 2)

1. Open the preview popup with the browser narrowed to a phone width (e.g.,
   ~375px, or via devtools device toolbar).

**Expected outcome**: Gallery, details section, and tracklist all stack in a
single column, in that reading order.

### 5. Fluid transition while resizing (User Story 2)

1. With the popup open, drag the browser window's width across the
   breakpoint.

**Expected outcome**: The layout switches once, at the breakpoint, with no
overlapping or visually broken intermediate state on either side of it.

### 6. Browsing multiple images via the vertical thumbnail gallery (User Story 3)

1. Open the popup for a release with several images on Discogs (front cover,
   back cover, label, etc.).
2. Click a thumbnail other than the first one in the vertical thumbnail
   list.

**Expected outcome**: The primary displayed image updates to match the
clicked thumbnail; the popup stays open; no navigation occurs.

### 7. Single-image release (User Story 3 / Edge Case)

1. Open the popup for a release that has exactly one image on Discogs.

**Expected outcome**: That single image is shown as the primary image; no
thumbnail list/carousel controls are rendered.

### 8. No-image release (User Story 3 / Edge Case)

1. Open the popup for a release with no images on Discogs.

**Expected outcome**: The existing no-image placeholder is shown in place of
the gallery — no broken image icons, no empty thumbnail rail.

### 9. Loading and error states still work (Edge Case)

1. Click a search result's preview action, and — before the request
   resolves — observe the popup.
2. Separately, simulate a catalog-unavailable response (e.g., via devtools
   network throttling/blocking, or temporarily invalid `DISCOGS_TOKEN`) and
   open a preview.

**Expected outcome**: A skeleton matching the new (larger) layout shows
while loading; the existing "Couldn't load catalog details..." fallback
message shows on failure — both unchanged in behavior from today, just
resized to the new layout.

### 10. Record detail page unaffected visually (FR-011)

1. Open an existing record's detail page (`/app/library/records/:entryId`)
   for a release that now has the new fields available.

**Expected outcome**: The detail page's visible layout and content are
identical to before this feature (no new fields shown there yet) — confirms
FR-011 is a data-model change only, with display work deferred to a future
increment.

## Automated Coverage to Run

```bash
# Backend unit + contract tests
cd backend && npm test

# Frontend component/unit tests
cd frontend && npm test

# End-to-end (Playwright), per the constitution's /frontend e2e quality gate
cd e2e && npm test
```

**Expected outcome**: All existing tests continue to pass; new/updated tests
for this feature pass as well — `discogsMapper.test.ts` (new field mapping),
`discogsRelease.contract.test.ts` (widened response shape),
`ReleasePreviewModal.test.tsx` (details section + layout), a new
`ReleaseImageGallery` component test, and a new
`e2e/tests/release-preview-gallery.spec.ts`.
