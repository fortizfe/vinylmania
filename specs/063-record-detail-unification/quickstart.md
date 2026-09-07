# Quickstart & Validation: Unified Record Detail Views

**Feature**: 063-record-detail-unification · **Date**: 2026-09-07

How to prove the feature works end-to-end. No implementation code here — see
`tasks.md` (after `/speckit-tasks`) for the build steps and
`contracts/ui-contracts.md` for the component contracts.

## Prerequisites

- Node + workspace deps installed (`npm install` at repo root or per package).
- Firebase emulator + backend for the full e2e run (same as any `/frontend` change).
- Nothing new to provision — no env var, no migration, no seed change.

## 1. Component tests (Vitest — write first, must fail first)

```bash
cd frontend
npm test -- RatingCard RecordDetailActions RecordDetailLayout MyCopySection ReleaseAdditionalInfoSection
```

Expected after implementation: all green. Key assertions (full list in
`contracts/ui-contracts.md` C2–C6):

- `RatingCard`: renders with no `personal` prop (search) showing "Sin valorar";
  renders the editable star control with `personal`; community `unrated` →
  placeholder badge, no count; `have`/`want` shown only when non-null; `onSave`
  rejection → `role="alert"` + "Reintentar".
- `RecordDetailActions`: correct buttons per `view`; gate/error messaging in the
  right live region.
- `RecordDetailLayout`: DOM order equals the section-order contract for both the
  rail and stack variants; "Estado de mi copia" slot present only for `library`.
- `MyCopySection`: no rating control, no Remove button, condition/notes still save.
- `ReleaseAdditionalInfoSection`: no community line; `null` when only community
  data would have shown.

## 2. Full frontend unit suite (regression)

```bash
cd frontend
npm test
```

Expected: green, including untouched `MasterReleaseDetailPage` tests (FR-023).

## 3. e2e (Playwright)

```bash
cd e2e
npx playwright test release-detail record-detail wishlist
npx playwright test master-release-detail        # regression guard — must pass untouched
```

Updated specs assert:
- **Same order, all three views**: from a search result, from My Library, and from
  the wishlist, the section testids appear in the order
  `record-detail-actions` → `…-gallery-card` → `…-main-info-card` →
  (`…-your-copy-card` only for library) → `…-rating-card` → `…-streaming-card` →
  `…-tracklist-card` → `…-other-details-card`.
- **Rating card**: community badge visible for a rated release in all three views;
  editable stars present in library + wishlist, absent in a not-in-list search
  record; have/want text present when the release has them.
- **Estado de mi copia**: shows media/sleeve/notes and **no** rating; appears only
  in the library view.
- **Action bar**: "Add to library"/"Add to wishlist" under the back-link in search;
  "Remove from library" under the back-link in library (not inside a card);
  gate/error copy unchanged.
- **Inline edit** (`record-detail-inline-edit.spec.ts`): setting a star rating
  persists via `PATCH /api/library/:id`; editing condition/notes persists as before.
- **Wishlist**: no notes field anywhere in the wishlist detail view; the personal
  rating edits via `PATCH /api/wantlist/:releaseId`.
- **Responsive**: at desktop width the left column (`record-detail-rail` anchor) holds
  gallery + rating + streaming and the right column holds general-info + tracklist +
  catalog (+ my-copy for library); at mobile width everything is a single column in
  contract order. Neither column is `position: sticky`.

## 4. Manual accessibility + design walkthrough (Principle X + XI)

Run the dev server (`npm run dev` in `frontend`) and, for each of the three views
(search result → detail, library record → detail, wishlist item → detail):

1. **Keyboard only**: Tab from the back-link through the whole page. Order must be
   back-link → action bar buttons → gallery controls → general info → (my copy) →
   rating stars → streaming links → tracklist → catalog info. No trap, visible
   focus ring on every stop.
2. **axe** (browser extension or `@axe-core/playwright`): zero serious/critical
   violations on each view, light and dark theme.
3. **Headings**: use the browser a11y tree — one `h1` (record title), each card an
   `h2`, no skipped level.
4. **Contrast**: spot-check the Rating card badge, the "Sin valoraciones" text, and
   the action-bar error text in both themes.
5. **Reduced motion**: enable OS "reduce motion"; reload. No sliding/scaling on
   section load; at most an opacity fade. (There is no sticky rail — the left
   column is a plain grid column.)
6. **Touch targets**: at 375px width, every action-bar button and each star ≥ 44px.
7. **No layout shift**: throttle network, reload a detail view; the skeleton
   footprint matches the populated card footprint (gallery, rating, streaming,
   tracklist) — nothing jumps when data lands. The one accepted exception: a
   cache-miss streaming card collapsing to nothing reflows the tracklist below it
   once (research R4).
8. **Cross-view consistency**: open the same release from search and from the
   wishlist side by side — identical layout, identical card styling, only the
   action bar contents differ.

## 5. Definition of done (maps to spec Success Criteria)

- [ ] SC-001 / SC-006: section testid order identical across the three views
      (except the library-only my-copy card) — asserted in e2e.
- [ ] SC-002: every content block renders inside the shared `<Card>` — asserted in
      component tests + visual check.
- [ ] SC-003: rating editable from one obvious place (the Rating card) — manual +
      e2e.
- [ ] SC-004: community rating visible on the detail view for a rated release in
      all three views — e2e.
- [ ] SC-005: "Estado de mi copia" has exactly media + sleeve + notes, zero rating
      controls — component test.
- [ ] SC-007: no notes field in the wishlist view; no note-mutating request from it
      — e2e + network assertion.
- [ ] SC-008: no layout shift between section states — manual throttled reload.
- [ ] SC-009: axe + keyboard walkthrough, zero AA violations, both themes.
- [ ] SC-010: three layout options documented and one chosen — done (design brief +
      spec Clarifications).
- [ ] FR-023 regression: `MasterReleaseDetailPage` + its e2e unchanged and green.
