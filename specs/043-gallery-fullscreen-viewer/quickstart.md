# Quickstart: Shared Image Gallery — Contained Size & Fullscreen Viewer

Validates both user stories end-to-end. Assumes the local dev stack is
already runnable per the repo's existing setup (`frontend`: `npm run dev`;
Firebase emulator available as usual for auth). No backend or seed-data
change is required — any release/master/library record with multiple
Discogs images works.

## Prerequisites

- A signed-in test user.
- At least one release/master/library detail page reachable that has 10+
  images (to exercise the thumbnail scroll cap) and at least one with
  exactly 1 image and one with 0 images (to exercise the edge cases).

## User Story 1 — Contained viewer size and scrollable thumbnails

1. Open any of the three detail pages (`/search` result → release detail,
   a master release detail, or a library record detail) for a release with
   several images, on a desktop-sized viewport (≥1024px width).
   **Expect**: the main image renders at a contained size (`lg:max-w-md`,
   centered) — it no longer stretches to the full row width between the
   `lg` and `xl` breakpoints (`contracts/ReleaseImageGallery.contract.md`,
   research.md Decision 1).
2. Open the detail page for a release with 10+ images, same desktop
   viewport. **Expect**: the vertical thumbnail column stops growing at the
   main image/container's height; scrolling inside that column reveals the
   remaining thumbnails with **no visible scrollbar** (`scrollbar-hidden`,
   unchanged).
3. Open a detail page for a release with few images (fits without
   scrolling). **Expect**: no scrollbar or extra visual artifact — visually
   identical to today.
4. Resize to a mobile-sized viewport (≤480px width) and repeat step 2 on a
   many-image release. **Expect**: same height-capped, hidden-scroll
   behavior as desktop.
5. Repeat steps 1–2 on all three detail pages (search result, master
   release, library record). **Expect**: identical behavior on all three
   (same shared `ReleaseImageGallery` component, per FR-012).

## User Story 2 — Fullscreen viewer

1. On any detail page for a release with multiple images, click the main
   image. **Expect**: a fullscreen viewer opens (`gallery-fullscreen-viewer`
   testid) showing the same image that was selected, enlarged, with the
   same thumbnail strip and an always-visible "X" (`gallery-fullscreen-close`
   testid).
2. Click a different thumbnail inside the fullscreen viewer. **Expect**: the
   large image updates; the viewer stays fullscreen.
3. Click the "X". **Expect**: the viewer closes, returning to the normal
   embedded viewer showing the same image selected in step 2 (not reset to
   the primary image — FR-011).
4. Reopen fullscreen (click the main image again) and press Escape.
   **Expect**: same close behavior as the "X".
5. Reopen fullscreen and click outside the image (on the dark backdrop).
   **Expect**: the viewer closes the same way (FR-014, confirmed via
   `/speckit-clarify`).
6. Change the selected thumbnail in the *embedded* viewer first, then click
   the main image. **Expect**: fullscreen opens on that same selection, not
   the primary/default image (edge case in spec.md).
7. With fullscreen open, resize the window (or rotate a mobile device
   emulation). **Expect**: the viewer stays open and the selected image is
   unchanged (FR-013).
8. Open a detail page for a release with exactly one image and click it.
   **Expect**: fullscreen opens showing that single image, with **no**
   thumbnail strip (FR-008), same as the embedded viewer's single-image
   behavior.
9. Open a detail page for a release with zero images (the "No cover image
   available" placeholder). Click the placeholder. **Expect**: nothing
   happens — no fullscreen viewer opens (FR-005/AC9).
10. Tab to the main image using the keyboard (no mouse) and press Enter or
    Space. **Expect**: fullscreen opens the same as a click (FR-005/AC11).
11. Repeat steps 1–3 on all three detail pages. **Expect**: identical
    behavior on all three (FR-012).

## Notes

- No new environment variables, seed data, or infrastructure are required.
- No zoom/pan, download/share, or swipe-gesture behavior is in scope for
  this feature (spec.md "Fuera de alcance" / Out of Scope) — do not treat
  their absence as a defect during validation.
