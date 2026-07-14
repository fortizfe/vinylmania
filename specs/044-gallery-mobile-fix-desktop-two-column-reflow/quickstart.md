# Quickstart: Shared Image Gallery — Mobile Height Fix & Desktop Two-Column Reflow

Validates both user stories end-to-end. Assumes the local dev stack is
already runnable per the repo's existing setup (`frontend`: `npm run dev`;
Firebase emulator available as usual for auth). No backend or seed-data
change is required — any release/master/library record with more than 4
Discogs images exercises the mobile fix.

## Prerequisites

- A signed-in test user.
- At least one release/master/library detail page reachable that has more
  than 4 images (to exercise the fixed containment bug) and at least one
  with 0 images (to exercise the placeholder edge case).
- **A WebKit-based browser or Playwright's `webkit` project.** The bug
  User Story 1 fixes is WebKit-specific (research.md Decision 1) — it does
  **not** reproduce in Chromium/Chrome/Edge. Manual verification in
  Chrome alone will not show the pre-fix bug or confirm the fix; use
  Safari (macOS or iOS) or `npx playwright test --project=webkit` for the
  gallery-responsive specs.

## User Story 1 — Gallery stays contained and square on mobile

1. In **Safari** (or Playwright's `webkit` project), open any of the three
   detail pages for a release with more than 4 images, on a mobile-sized
   viewport (360–430px width). **Expect (pre-fix)**: the gallery container
   grows taller than it is wide, tracking the thumbnail strip's content
   height. **Expect (post-fix)**: the container stays square, bounded by
   its own width; the thumbnail strip scrolls internally.
2. Same page/browser, scroll within the thumbnail strip. **Expect**: no
   visible scrollbar (`scrollbar-hidden`, unchanged from spec `043`).
3. Open a detail page for a release with 4 or fewer images. **Expect**: no
   scrollbar or extra visual artifact, in either browser engine — this case
   already worked before the fix (research.md Decision 1's repro showed
   WebKit only breaks above 4 images).
4. Repeat step 1 at a desktop-sized viewport (≥1024px) in Safari.
   **Expect**: same square containment — the fix is unconditional
   (research.md Decision 1), so desktop Safari is protected too, not just
   mobile.
5. Repeat steps 1–2 on all three detail pages (search result, master
   release, library record). **Expect**: identical behavior on all three
   (same shared `ReleaseImageGallery` component).
6. In **Chromium/Chrome** at the same viewports, confirm no regression —
   containment was already correct there and must remain so.

## User Story 2 — Two-column reflow on desktop

1. Open any of the three detail pages at exactly 1024px width (`lg`).
   **Expect**: the gallery renders as the left column and the page's
   primary information (release/master details, plus "Add to library" or
   `MyCopySection` depending on the page) renders as the right column, side
   by side — not stacked.
2. On `RecordDetailPage` specifically, confirm the right column contains
   both the release details **and** the "My Copy" section (rating,
   condition, notes, remove-from-library), aligned next to the gallery.
3. On `MasterReleaseDetailPage`, confirm the tracklist and the versions
   table both render full-width, below the gallery/details row, not beside
   it.
4. On `ReleaseDetailPage`/`RecordDetailPage`, confirm the tracklist and the
   additional-info section both render full-width below the gallery/info
   row.
5. Resize the window from 1024px up to 1280px+ (`xl`) and beyond.
   **Expect**: no visible change in composition — the two-column layout
   established at `lg` is the same layout all the way up (no third state).
6. Check page width at 1024px, 1280px, and a wide viewport (e.g. 1600px).
   **Expect**: no horizontal scrollbar at any of them.
7. On `RecordDetailPage` (the page with the most right-column content),
   confirm the gallery (left column) and the info+"My Copy" column (right)
   are top-aligned — the shorter column (typically the gallery) simply
   leaves empty space below it; neither column stretches to match the
   other's height (`/speckit-clarify` resolution).
8. Resize below 1024px. **Expect**: reverts to a single column, gallery
   first, full width, exactly as it behaves today — no change from current
   mobile behavior.
9. Open a detail page with 0 images. **Expect**: the "No cover image
   available" placeholder stays contained within its column/cell, in both
   the single-column mobile layout and the new two-column desktop layout,
   without disproportionate sizing or misaligning the info column.

## Notes

- No new environment variables, seed data, or infrastructure are required.
- The fullscreen viewer (spec `043`, US2) is unaffected — verify it still
  opens/closes/navigates identically under the new desktop layout and the
  fixed mobile layout, but do not expect any behavior change there.
- Do not rely on Chromium alone to validate User Story 1 — see
  Prerequisites above.
