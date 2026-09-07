---
description: "Task list for Unified Record Detail Views (feature 063)"
---

# Tasks: Unified Record Detail Views

**Input**: Design documents from `/specs/063-record-detail-unification/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contracts.md](./contracts/ui-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle I (Test-First, NON-NEGOTIABLE) and the plan
both mandate a failing test before implementation for every new/changed component, plus
e2e for every affected `/frontend` flow.

**Organization**: Phases 3–7 map to the five user stories in priority order. This is a
refactor, so the stories share files; per-story dependencies are called out explicitly
in "Dependencies & Execution Order".

## Path Conventions

Web app — all changes under `frontend/` and `e2e/`. Component tests are colocated as
`*.test.tsx` next to the component. `backend/` is not touched.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Create `frontend/src/components/recordDetail/` folder and add `frontend/src/components/recordDetail/testIds.ts` exporting the `record-detail-*` id constants from contracts/ui-contracts.md §C8 (`LAYOUT`, `RAIL`, `ACTIONS`, `GALLERY_CARD`, `MAIN_INFO_CARD`, `RATING_CARD`, `YOUR_COPY_CARD`, `STREAMING_CARD`, `TRACKLIST_CARD`, `OTHER_DETAILS_CARD`).
- [X] T002 [P] Verify `frontend/src/components/ui/Button.tsx` encodes `:active { transform: scale(0.97) }` with `transition: transform ~160ms ease-out` and gates any `:hover` styling behind `@media (hover: hover) and (pointer: fine)` (research R8); add it if missing, keeping existing variants/props unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ No user-story work starts until this phase is complete.**

- [X] T003 [P] Write failing test `frontend/src/components/recordDetail/RecordDetailLayout.test.tsx` per contracts/ui-contracts.md §C2: (1) rendered slot-wrapper DOM order equals the §C1 order for BOTH the stack and rail variants; (2) `myCopy` omitted → no §2a wrapper; (3) `myCopy` provided → §2a wrapper sits between `generalInfo` and `rating`; (4) the actions wrapper is the first child after the back-link.
- [X] T004 Create `frontend/src/components/recordDetail/RecordDetailLayout.tsx` per §C2: `<main>` (`max-w-5xl … xl:max-w-7xl`, `p-6 sm:p-8`) → `<BackLink>` → `{actions}` → section grid. Children rendered in fixed §C1 DOM order regardless of viewport. Mobile `< lg`: single `flex-col gap-4` column. `lg:`+: CSS grid, left track = sticky rail (`position: sticky; top: <safe>; align-self: start`, `data-testid` RAIL) holding gallery + rating + streaming, right track = generalInfo + myCopy? + tracklist + catalogInfo — placement via `lg:` classes on wrappers, never by reordering JSX, never with CSS `order`. No entrance animation. `data-testid` LAYOUT on the grid. Make T003 pass.
- [X] T005 [P] Write failing test `frontend/src/components/recordDetail/RecordDetailSkeleton.test.tsx`: skeleton renders a gallery block + info block + rating block + streaming block + tracklist block whose sizing classes (`w-*`/`h-*`/`min-h-*`/aspect) match the populated cards so there is no layout shift (UI Design System "No layout shift").
- [X] T006 Move and rework `frontend/src/components/RecordDetailSkeleton.tsx` → `frontend/src/components/recordDetail/RecordDetailSkeleton.tsx` to mirror the new `RecordDetailLayout` shape (rail + column on `lg:`, stack on mobile); update the imports in `ReleaseDetailPage.tsx` and `RecordDetailPage.tsx`. Make T005 pass.

- [X] T006a Preserve the master-release loading visual (FR-023 / §C9): `MasterReleaseDetailPage.tsx` was repointed to the reworked `recordDetail/RecordDetailSkeleton.tsx` in T006, which changes its loading appearance. Give the master page its own `frontend/src/components/MasterReleaseDetailSkeleton.tsx` (restore the pre-T006 skeleton shape, keeping `data-testid="record-detail-skeleton"` so `MasterReleaseDetailPage.test.tsx` stays green) and point `MasterReleaseDetailPage.tsx` back at it. Run `npm test -- MasterReleaseDetailPage` and the master unit test; both green.

**Checkpoint**: shared layout + skeleton exist and are unit-tested; the master page keeps its own skeleton; pages still render old content through the new shell only after Phase 3.

---

## Phase 3: User Story 1 - Consistent detail experience across all three entry points (Priority: P1) 🎯 MVP

**Goal**: All three views (search, library, wishlist) render the same sections in the
same DOM/visual order, in the same `<Card>`, with a consistent action bar under the
back-link, plus a standalone Rating card that (for this increment) shows the Discogs
**community** rating + rating count + have/want — data never shown on the detail pages
before. Streaming card sits at position 4. The community "have/want · rating" line is
removed from the catalog-info card.

**Independent Test**: Open the same release from a search result and from the wishlist,
and a comparable record from My Library. The ordered list of section `data-testid`s is
identical (except the library-only `record-detail-your-copy-card`); every section is in
the shared `<Card>`; the action bar is directly under the back-link in every view; the
community rating badge is visible on all three for a rated release.

### Tests for User Story 1 (write first, must FAIL)

- [X] T007 [P] [US1] Failing test `frontend/src/components/recordDetail/RatingCard.test.tsx` per §C4 — community cases only for this story: card always renders with its heading; valid rating → `ReleaseRatingBadge` value + `(count)`; `band='unrated'` → placeholder badge, no count, "Sin valoraciones" text; `have=1200,want=340` → both lines; `have=null` → no "lo tienen" line; `personal` omitted → no star/slider control, "Sin valorar" read-only text.
- [X] T008 [P] [US1] Failing test `frontend/src/components/recordDetail/RecordDetailActions.test.tsx` per §C3: `view='search'` → both add buttons; `view='wishlist'` → only "Add to library"; `view='library'` → only "Remove from library"; `gateMessage`/`notice` → `role="status"`; `*Error` → `role="alert"`; `addedToLibrary` → button reads "Added to library" and is `disabled`; `view='library'` Remove click calls `onRemove`.
- [X] T009 [P] [US1] Failing test `frontend/src/components/ReleaseAdditionalInfoSection.test.tsx` per §C6: no "have"/"want"/"rating" aggregate text; renders identifiers and notes when present; renders `null` when there are no notes and no identifiers (community no longer counts).
- [X] T010 [P] [US1] Update `e2e/tests/release-detail.spec.ts` with failing assertions: section `data-testid`s appear in the order ACTIONS → GALLERY_CARD → MAIN_INFO_CARD → RATING_CARD → STREAMING_CARD → TRACKLIST_CARD → OTHER_DETAILS_CARD for the search view; community rating badge visible; "Add to library"/"Add to wishlist" live directly under the back-link, not inside a card. — DONE: replaced the old "documented layout" test with a §C1/§C8 DOM-order + community-badge + action-bar-placement assertion; passes against the shipped UI (chromium, 3 runs). Re-verified green after the T011/rail-stickiness removal (chromium + webkit).
- [X] T011 [P] [US1] Update `e2e/tests/release-detail-responsive.spec.ts` and `e2e/tests/record-detail-responsive.spec.ts` with failing assertions: at desktop width the gallery, rating and streaming cards sit in the sticky left column (the `record-detail-rail` anchor is `position: sticky` and stays in the viewport while the tracklist is scrolled past it) and the general-info / tracklist / catalog cards are in the right column; at mobile width all sections are a single column in §C1 DOM order. (Per contracts §C2: there is no single wrapper containing the three left-column sections — assert on column placement, not containment.) — DONE (desktop + mobile tests in both specs, passing on chromium + webkit). UPDATE (Phase 3 follow-up): `lg:sticky lg:top-6` was removed from the `railSlot` wrappers in `RecordDetailLayout.tsx` — it had ~zero scroll travel and its stacking context trapped the gallery's fullscreen `Overlay` (`z-50`) under `AppHeader` (`z-40`). The layout is now an honest two-column "media-left" grid. T011 no longer asserts stickiness: the desktop tests now assert `record-detail-rail` is `position: static`, the left column is narrower than the right, there is no horizontal scroll, and on scroll both columns move up in lock-step (rail in normal flow, no pinning). Spec/contracts/plan updated to match.

### Implementation for User Story 1

- [X] T012 [US1] Create `frontend/src/components/recordDetail/RatingCard.tsx` per §C4 — full prop shape (`community` + optional `personal`), but implement only the community half + have/want + the read-only "Sin valorar" state for absent `personal`. Uses `presentRating` + `ReleaseRatingBadge`. Wrapped in `<Card>`, single `<h2>`, `data-testid` RATING_CARD, side-by-side halves on `sm:`+ with shared min-height. Make T007 pass.
- [X] T013 [US1] Create `frontend/src/components/recordDetail/RecordDetailActions.tsx` per §C3 — presentational bar (`flex flex-wrap gap-2`, not a `<Card>`), existing `<Button>` atom, messages in `role="status"`/`role="alert"` below the buttons, copy strings unchanged, `data-testid` ACTIONS. Make T008 pass.
- [X] T014 [US1] Trim `frontend/src/components/ReleaseAdditionalInfoSection.tsx` per §C6: remove the `community` prop and the have/want/rating line; `null` when `!notes && identifiers.length === 0`. Make T009 pass.
- [X] T015 [US1] Recompose `frontend/src/pages/ReleaseDetailPage.tsx` onto `RecordDetailLayout`: derive `view` (`'wishlist'` when `wantlistEntry.data` present, else `'search'`); move the add-to-library / add-to-wishlist buttons and all gate/error/notice state into `<RecordDetailActions>` (keep the `useCreateLibraryEntry`/`useAddToWantlist` mutations and the `ApiError.code` → message mapping in the page); pass gallery, `ReleaseDetailsSection`, community-only `<RatingCard>`, `<StreamingLinksSection>`, `ReleaseTracklistSection`, trimmed `<ReleaseAdditionalInfoSection>` (no `community` prop) into the layout slots in §C1 order.
- [X] T016 [US1] Recompose `frontend/src/pages/RecordDetailPage.tsx` onto `RecordDetailLayout`: `view='library'`; move "Remove from library" (keeping the `window.confirm` guard in the page handler) into `<RecordDetailActions>`; keep the existing `<MyCopySection>` (still with its rating field for now) in the `myCopy` slot; community-only `<RatingCard>` from `entry.release.community`; trimmed `<ReleaseAdditionalInfoSection>`.
- [X] T017 [US1] Route the `notFound`, `relinkRequired`/`DiscogsRelinkNotice`, and `catalogStatus === 'unavailable'` / `!entry.release` branches of both pages through `RecordDetailLayout` so the action bar always renders and — for the library view — `MyCopySection` still renders when catalog data is missing (FR-018, FR-019).
- [X] T018 [P] [US1] Unify `data-testid`s to the §C8 `record-detail-*` set in both pages and at the gallery/tracklist/streaming call sites (replace the old `release-detail-*` / mixed ids), importing from `recordDetail/testIds.ts`.
- [X] T019 [US1] Make T010 and T011 pass; adjust selectors in any other spec that referenced an old `release-detail-*` id (grep `e2e/tests` for `release-detail-`). — DONE: T010/T011 green; updated stale `release-detail-*` testids in `release-detail.spec.ts`, `release-detail-responsive.spec.ts`, `streaming-links.spec.ts` to the `record-detail-*` set (kept `release-detail-wantlist-panel-card`, removed in US2/T026); scoped the mobile Remove-button locator in `record-detail-responsive.spec.ts` to `record-detail-actions` (transient duplicate button). SEPARATE REGRESSION (was: needs frontend/src): `release-detail.spec.ts` "fullscreen viewer … closes via X" and `record-detail-responsive.spec.ts` "no-cover placeholder … X closing it" failed at `lg:` widths — the gallery sat inside `RecordDetailLayout`'s `lg:sticky` rail slot, whose stacking context trapped the non-portaled `Overlay` (`z-50`) beneath `AppHeader` (`sticky … z-40`), so the fullscreen close button was covered by the header. RESOLVED (Phase 3 follow-up): `lg:sticky lg:top-6` removed from the `railSlot` wrappers in `RecordDetailLayout.tsx` (the sticky had ~zero travel anyway). No stacking context, `z-50` wins again. Both fullscreen tests pass on chromium + webkit; full `release-detail record-detail master-release-detail` run = 84/84 green, master specs unchanged.
- [X] T020 [US1] Regression: run `e2e/tests/master-release-detail.spec.ts` and `e2e/tests/master-release-detail-responsive.spec.ts` and the `MasterReleaseDetailPage` unit test — all must pass **unchanged** (FR-023 / §C9). If a shared component edit broke them, fix the shared component, not the master page. — DONE: all 14 master e2e tests pass on chromium AND webkit (3 runs); `npx vitest run MasterReleaseDetailPage` 6/6 pass. Master specs and page untouched. The fullscreen regression above does NOT affect the master page (no sticky rail there) — its fullscreen tests stay green.

**Checkpoint**: US1 done — the three views share layout, card style, action bar, section order, skeleton; the Discogs community rating + have/want are now on the detail pages. Personal rating is still (transitionally) inside `MyCopySection` / the wishlist panel.

---

## Phase 4: User Story 2 - Standalone rating card with personal and community scores (Priority: P2)

**Goal**: The Rating card also shows the user's **personal** rating — editable — in the
library and wishlist views (absent in pure search); the old `WantlistPanel` is deleted.

**Independent Test**: Open a library record → the Rating card has an editable star
control at the stored value and changing it persists via `PATCH /api/library/:id`. Open
a wishlist record → same, persisting via `PATCH /api/wantlist/:releaseId`. Open a
search record in neither list → no editable personal control, "Sin valorar" text only.

### Tests for User Story 2 (write first, must FAIL)

- [X] T021 [P] [US2] Extend `frontend/src/components/recordDetail/RatingCard.test.tsx` per §C4: `personal` present, `value=3` → editable star control at 3; `onChange` invokes `personal.onSave`; `value=0` with `personal` → empty **editable** control (distinct from the search read-only state); `onSave` rejects → `role="alert"` "No se pudo guardar tu valoración." + "Reintentar" button that re-invokes `onSave` with the last attempted value.
- [X] T022 [P] [US2] Failing e2e in `e2e/tests/record-detail-inline-edit.spec.ts`: setting a star rating in the Rating card on a library record issues `PATCH /api/library/:id` with `{ rating }` and the value survives reload. — DONE: retargeted the existing "editing the rating via star buttons autosaves" test → scoped to `getByTestId('record-detail-rating-card').getByRole('group', { name: 'Tu valoración' })` (library view transiently has a 2nd star group in MyCopySection until US3), asserts the `{ rating: 4 }` PATCH and re-reads `aria-pressed="true"` after `page.reload()`. Also scoped the other two library-view star locators in this file (press-feedback + focus-contrast tests) and the equivalents in `record-detail-responsive.spec.ts` and `press-feedback.spec.ts` to the Rating card, all of which the duplicate group would otherwise break with a strict-mode violation. Green on chromium (+ webkit for the responsive spec).
- [X] T023 [P] [US2] Failing e2e in `e2e/tests/wishlist-discogs-sync.spec.ts` (or the wishlist detail spec): the wishlist detail shows the Rating card with editable stars (no `release-detail-wantlist-panel-card`), and a rating change issues `PATCH /api/wantlist/:releaseId`. — DONE: reworked the US3 describe block. `T0YY-1` is now the T023 test — opens wishlist release 222, asserts `record-detail-rating-card` visible + `release-detail-wantlist-panel-card` absent + editable "Tu valoración" group, clicks 4 stars, asserts the observed `PATCH /api/wantlist/222` body `{ rating: 4 }`, then reloads and re-reads `aria-pressed` + the stub wantlist (`rating === 4`). Green (chromium).

### Implementation for User Story 2

- [X] T024 [US2] Extend `frontend/src/components/recordDetail/RatingCard.tsx`: when `personal` is provided render `<StarRating value onChange={personal.onSave} disabled={personal.saving} ariaLabel="Tu valoración" />` plus the retry-on-failure pattern (mirror the deleted `WantlistPanel`'s `role="alert"` + "Reintentar"). Make T021 pass. — DONE: `handlePersonalSave` wraps `personal.onSave`, catches rejection → `role="alert"` "No se pudo guardar tu valoración." + "Reintentar" button re-invoking with `lastAttempt`. Shared `min-h-[7.5rem]` kept; press feedback + reduced-motion inherited from `StarRating`/`press.ts`.
- [X] T025 [US2] `frontend/src/pages/ReleaseDetailPage.tsx`: for `view='wishlist'` build the `personal` model from `wantlistEntry.data.rating` + `useUpdateWantEntry(parsedId).mutateAsync({ rating })` (with `saving`) and pass it to `<RatingCard>`; remove the `<WantlistPanel>` import and usage and the `handleSaveWantlistRating` wrapper (fold into the model). — DONE: `personal` passed only when `isInWantlist && wantlistEntry.data`. Removed `<WantlistPanel>` import + `<Card data-testid="release-detail-wantlist-panel-card">` JSX + `handleSaveWantlistRating`. Also removed `handleSaveWantlistNotes` (dead after panel removal, was blocking lint) — US5/T039-T040 re-adds the wishlist note.
- [X] T026 [US2] Delete `frontend/src/components/WantlistPanel.tsx` and its colocated test; remove every `release-detail-wantlist-panel-card` reference from `e2e/tests/`. — DONE (frontend): deleted `frontend/src/components/WantlistPanel.tsx` + `frontend/tests/unit/WantlistPanel.test.tsx`; no `WantlistPanel` refs remain in `frontend/src`. `e2e/tests/` refs left for the e2e agent (T028) per scope.
- [X] T027 [US2] `frontend/src/pages/RecordDetailPage.tsx`: build the `personal` model from `entry.discogs.rating` + `useUpdateLibraryEntry(entryId).mutateAsync({ rating })` and pass it to `<RatingCard>` (do **not** remove the rating from `MyCopySection` yet — that is US3). — DONE: `personal` passed only when `entry.discogs` is non-null (community-only when the copy is gone from Discogs). Reused the existing `saveRating` wrapper for both `<RatingCard>` and `<MyCopySection>` (transient duplicate per plan); `saving: updateEntry.isPending`.
- [X] T028 [US2] Make T022 and T023 pass; update `e2e/tests/wishlist-responsive.spec.ts` if it asserted the wantlist panel. — DONE.
  - `grep -rn 'release-detail-wantlist-panel-card' e2e/` → all refs were in `wishlist-discogs-sync.spec.ts` (US3 block). Converted every one to the new UI: `T0YY-1` (rating persistence, = T023), `T0YY-3` (rating card autosaves, no Save button), `T0YY-4` (release NOT in wantlist → Rating card renders but personal half is read-only "Sin valorar", not an editable group; panel absent), `T0YY-5` (adding from the detail page turns the personal stars editable with no reload). Each keeps a `release-detail-wantlist-panel-card` → `.toHaveCount(0)` guard.
  - Wishlist **note** assertion: `T0YY-2` (per-field notes autosave) has no UI to exercise — the note UI was removed entirely in US2, not deferred. Marked `test.fixme` with a `// feat-063 US5` comment pointing at T038 (which will assert the inverse: no notes field anywhere). NOT converted to a note-absence assertion here, to preserve T038's TDD red step.
  - `wishlist-responsive.spec.ts`: no panel reference — left unchanged.
  - Absorbed a latent US1 regression in two feature-060 tests (`T0XX-2`, and the converted `T0YY-5`): US1's `RecordDetailActions` has no "Added to wishlist" confirmation button — once a release is in the wantlist the bar switches to its `view='wishlist'` variant ("Add to library" only) and the Rating card's personal half becomes editable. Both tests now confirm the add via that transition + the editable "Tu valoración" group instead of the old button label. (US1's e2e pass ran only `release-detail record-detail master-release-detail`, so `wishlist-discogs-sync.spec.ts` never exercised the recomposed bar.)
  - Runs (`emulators:exec` wrapping a scoped `playwright test`): `wishlist record-detail release-detail master-release-detail press-feedback` (chromium + webkit) = **125 passed / 2 failed**, both failures the button-label issue above; after the fix, `wishlist-discogs-sync` re-run = **22 passed** (T0YY-2 skipped/fixme). `master-release-detail*` = 21 passed, 0 failed, spec files byte-for-byte unchanged.

**Checkpoint**: personal + community ratings both live in the Rating card in library and wishlist views. Library `MyCopySection` briefly still shows a rating too — removed next in US3.

---

## Phase 5: User Story 3 - "Estado de mi copia" reduced to condition and notes (Priority: P2)

**Goal**: `MyCopySection` holds only media condition, sleeve condition, and notes — no
rating control, no Remove button.

**Independent Test**: Open a library record → the "Estado de mi copia" card shows the
three condition/notes controls and no rating; the rating for that record is editable in
the Rating card; editing condition/notes still saves; the card does not appear in the
search or wishlist views.

### Tests for User Story 3 (write first, must FAIL)

- [X] T029 [P] [US3] Failing test `frontend/src/components/MyCopySection.test.tsx` per §C5: no control with an accessible name matching "Rating"/"Valoración"; no "Remove from library" button; changing media/sleeve condition calls the respective `onSave*`; notes blur calls `onSaveNotes`; `editable.notes=false` + `discogs != null` → "not available on this collection" note shown and field disabled.

### Implementation for User Story 3

- [X] T030 [US3] Trim `frontend/src/components/MyCopySection.tsx` per §C5: remove the Rating label + `StarRating` + `onSaveRating` prop, and remove the "Remove from library" `<Button>` + `onRemove` prop. Keep the heading, the two condition `<select>`s, the notes `InlineEditableField`, all `editable.*` disabled states and messaging, and `data-testid` YOUR_COPY_CARD. Make T029 pass.
- [X] T031 [US3] `frontend/src/pages/RecordDetailPage.tsx`: stop passing `onSaveRating` and `onRemove` to `<MyCopySection>` (Remove is already in `RecordDetailActions` from US1; rating is already in `RatingCard` from US2); delete the now-unused `saveRating` wrapper.
- [X] T032 [US3] Update `e2e/tests/record-detail-inline-edit.spec.ts`: the rating assertion targets the Rating card; the condition/notes assertions target `record-detail-your-copy-card` and stay green. — DONE: the personal-rating tests already scope to `record-detail-rating-card` (US2). Tightened the `(T032)` media-condition test: added `record-detail-your-copy-card` → `getByRole('button', { name: /stars/i })` count 0 and `getByRole('button', { name: /remove from library/i })` count 0, and scoped the Media Condition `<select>` locator (both the edit and the post-reload assertion) to `record-detail-your-copy-card`. Media/sleeve/notes inline-edit + press-feedback + focus-contrast assertions unchanged and green.

**Checkpoint**: US3 done — "Estado de mi copia" is condition + notes only; personal rating has exactly one home.

---

## Phase 6: User Story 4 - Streaming links appear in their new position in all three views (Priority: P3)

**Goal**: The streaming card (feature 062) renders at position 4 — after Rating, before
Tracklist — in all three views, placed by the layout rather than by its own hard-coded
grid span.

**Independent Test**: Open a record with a resolvable streaming match from each entry
point → the streaming card is between the Rating card and the tracklist in all three;
a record with no match → the card collapses to nothing and the sections above are
undisturbed.

### Tests for User Story 4 (write first, must FAIL)

- [X] T033 [P] [US4] Update `frontend/src/components/StreamingLinksSection.test.tsx`: the rendered card no longer carries `lg:col-span-2`; the resolving skeleton still renders at a reserved height; no-match / error still renders `null`.
- [X] T034 [P] [US4] Failing e2e in `e2e/tests/release-detail.spec.ts`: `record-detail-streaming-card` appears immediately after `record-detail-rating-card` and immediately before `record-detail-tracklist-card` in the search, wishlist and library views; on a no-match fixture the streaming card is absent and the rating card still sits directly above the tracklist. — DONE: new `test.describe('Streaming card contract position (feature 063, US4 — T034)')`. Parametrized over `['search','wishlist','library']` with a `stubStreamingMatch` stub — each asserts the full document-ordered section-testid list equals the §C1 expected list for that view (which proves streaming is adjacent-after rating and adjacent-before tracklist AND every section above is unmoved), plus explicit `order[i-1]===rating` / `order[i+1]===tracklist` checks. Two no-match tests (search + library) with `stubStreamingNoMatch`: `record-detail-streaming-card` → count 0, rating immediately followed by tracklist, sections above unmoved, `your-copy` card undisturbed in the library case. New `openDetailForView` helper stubs catalog + `GET /api/wantlist/1` (wishlist) or `GET /api/library/:id` (library).

### Implementation for User Story 4

- [X] T035 [US4] `frontend/src/components/StreamingLinksSection.tsx`: remove the hard-coded `CARD_SPAN = 'lg:col-span-2'` usage so `RecordDetailLayout` controls placement; keep `RESERVED_HEIGHT`, the resolving skeleton, and the collapse-to-`null` behavior (FR-014/FR-015). Make T033 pass.
- [X] T036 [US4] Update `specs/063-record-detail-unification/spec.md` User Story 4 acceptance scenario 3 and the `quickstart.md` §4.7 note to read: a cache-miss streaming skeleton collapsing to nothing reflows the sections **below** it once, without disturbing the sections above (research R4) — replacing "only empty space below it reflows". — DONE (spec.md US4 AS3 + quickstart.md §4.7 both updated; scoped to "left column" per the shipped media-left layout).
- [X] T037 [US4] Make T034 pass. — DONE: T035 already removed `lg:col-span-2` from `StreamingLinksSection` and `RecordDetailLayout` places `streaming` in the §4 slot for all three views, so the position is already shipped structurally. Lifted `stubStreamingMatch` to module scope in `release-detail.spec.ts` (was nested in the US1 describe) and added `stubStreamingNoMatch`; the US1 test's call site resolves to the module-scope helper unchanged.

**Checkpoint**: US4 done — streaming card is in its contract position everywhere. (Most of this landed structurally in US1; this phase pins the component change and the tests.)

---

## Phase 7: User Story 5 - Wishlist detail loses its notes field cleanly (Priority: P3)

**Goal**: No notes field anywhere in the wishlist detail view; the Discogs wantlist
note is never written or deleted from this view.

**Independent Test**: Open a wishlist record that has a saved Discogs wantlist note →
no notes field or note text is shown; the personal rating is still editable in the
Rating card; inspecting the wantlist entry in Discogs shows the note value unchanged.

### Tests for User Story 5 (write first, must FAIL)

- [X] T038 [P] [US5] Failing e2e in `e2e/tests/wishlist-discogs-sync.spec.ts`: on a wishlist record whose fixture has a non-empty wantlist note, the detail view renders no textarea / no notes label / no note text anywhere, and no `PATCH /api/wantlist/:releaseId` request carrying a `notes` field is issued while on the view. — DONE: un-`fixme`'d `T0YY-2`, now a real test. Seeds wantlist 222 with `notes: 'Original UK pressing — sleeve VG+'`, opens the detail view, asserts the wishlist Rating card is present + editable, then: `page.locator('textarea')` count 0, `getByRole('textbox', { name: /nota[s]?/i })` count 0, `getByText(/^\s*nota(s)?\s*$/i)` count 0, `getByText(/your wishlist notes/i)` count 0, the seeded note string not visible anywhere. Route-intercepts `**/api/wantlist/**`, records every PATCH body, clicks 4 stars (asserts the observed PATCH body is exactly `{ rating: 4 }`), then asserts no recorded PATCH body has a `notes` property and the stub wantlist note is byte-for-byte the seed. T039/T040 already removed every `notes` read/write path from the detail flow, so it passes.

### Implementation for User Story 5

- [X] T039 [US5] Audit `frontend/src/pages/ReleaseDetailPage.tsx` and `frontend/src/queries/wantlistQueries.ts` usage: remove `handleSaveWantlistNotes`, any `notes` read from `wantlistEntry.data`, and any `useUpdateWantEntry({ notes })` path reachable from the detail view (FR-016). Leave the wantlist API client and its `notes` type intact (other surfaces may use it). Make T038 pass.
- [X] T040 [US5] Grep `frontend/src` for remaining references to a wishlist note in the detail flow (`wantlistNote` state used for the note, `WantEntryDetail.notes` in a detail component) and delete the dead code.

**Checkpoint**: US5 done — SC-007 satisfied.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Motion/design pass (Principle XI) on `RecordDetailLayout.tsx` and the new cards: skeleton→content is opacity-only cross-fade ≤200ms and removed under `@media (prefers-reduced-motion: reduce)`; sticky rail uses no animation; rail/column boundary is a static divider (no blur); action-bar buttons have the `:active` scale + hover media-query from T002. Cross-check against `apple-design` §7/§12/§14 and `emil-design-eng`.
- [ ] T042 [P] Accessibility verification per `quickstart.md` §4 on all three views in light **and** dark theme: axe zero serious/critical; keyboard tab order == §C1 order with visible focus and no trap; one `<h1>` + `<h2>` per card, no skipped level; action-bar controls named; contrast spot-checks on the rating badge, "Sin valoraciones", and action-bar error text; 44×44 targets at 375px. Fix any AA violation before proceeding.
- [ ] T043 [P] Layout-shift check per `quickstart.md` §4.7: throttle network, reload each detail view; skeleton footprint matches populated footprint for gallery / rating / streaming / tracklist (CLS ≈ 0). Only the accepted streaming no-match reflow (T036) is allowed.
- [ ] T044 Run the full `frontend` Vitest suite (`npm test`) and the `e2e` detail + master specs (`npx playwright test release-detail record-detail wishlist master-release-detail`); everything green, master specs unchanged.
- [ ] T045 Walk `quickstart.md` §5 Definition-of-Done checklist and tick SC-001…SC-010 + the FR-023 regression item.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: after Setup. **Blocks all user stories** — `RecordDetailLayout` + skeleton are the vehicle for every story.
- **Phase 3 (US1)**: after Foundational. Delivers the MVP shell + community Rating card + action bar.
- **Phase 4 (US2)**: after US1 (extends `RatingCard.tsx` and both recomposed pages).
- **Phase 5 (US3)**: after US2 (rating must have its new home in the Rating card before it is removed from `MyCopySection`; Remove button already relocated in US1).
- **Phase 6 (US4)**: after US1 (needs the layout `streaming` slot). Independent of US2/US3.
- **Phase 7 (US5)**: after US2 (`WantlistPanel` deleted in US2; US5 finishes removing the note data path). Independent of US3/US4.
- **Phase 8 (Polish)**: after all targeted stories.

### Within each story

- Every test task (T003, T005, T007–T011, T021–T023, T029, T033–T034, T038) is written and MUST fail before its implementation task.
- Component before page recomposition; page recomposition before its e2e turns green.
- `MasterReleaseDetailPage` regression (T020) gates the end of US1.

### Parallel opportunities

- Setup: T001, T002 in parallel.
- Foundational: T003 and T005 (tests) in parallel; then T004, then T006.
- US1 tests: T007, T008, T009, T010, T011 all in parallel (different files).
- US1 impl: T012, T013, T014 in parallel (three separate component files); T015 and T016 touch different pages and can run in parallel after T012–T014; T018 after T015/T016.
- US2 tests: T021, T022, T023 in parallel.
- US4 tests: T033, T034 in parallel.
- Polish: T041, T042, T043 in parallel; T044 then T045.

---

## Parallel Example: User Story 1

```bash
# Failing tests first (all different files):
Task: "T007 RatingCard.test.tsx — community cases"
Task: "T008 RecordDetailActions.test.tsx — three variants"
Task: "T009 ReleaseAdditionalInfoSection.test.tsx — no community line"
Task: "T010 e2e release-detail.spec.ts — section order + action bar"
Task: "T011 e2e responsive specs — rail vs stack"

# Then new components in parallel:
Task: "T012 Create RatingCard.tsx (community half)"
Task: "T013 Create RecordDetailActions.tsx"
Task: "T014 Trim ReleaseAdditionalInfoSection.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: three views share layout, card style, action bar, section
   order, skeleton; Discogs community rating + have/want now visible on the detail
   pages; `MasterReleaseDetailPage` untouched and green.
3. Deploy/demo — this alone delivers "one product, three doors".

### Incremental delivery

- US1 → demo (MVP).
- US2 (personal rating in the card, `WantlistPanel` gone) → demo.
- US3 ("Estado de mi copia" is condition + notes only) → demo.
- US4 (streaming card pinned to position 4 + component span removed) → demo.
- US5 (wishlist notes fully retired, dead code gone) → demo.
- Polish (motion, a11y, layout-shift, full-suite green, DoD).

### Notes

- `[P]` = different files, no incomplete dependency.
- This is a refactor: US2/US3/US5 legitimately edit files US1 created — that is a
  linear dependency, not a broken-independence smell. Each checkpoint is still a
  demoable, independently testable state.
- Commit after each task or logical group; keep `master-release-detail*` green at
  every commit.
