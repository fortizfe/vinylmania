# Phase 0 Research: Unified Record Detail Views

**Feature**: 063-record-detail-unification · **Date**: 2026-09-07

All Technical Context unknowns from `plan.md` are resolved below. This feature is a
frontend-only refactor; most "research" is verifying existing code contracts rather
than choosing new technology.

---

## R1. Does the release detail payload already carry the community rating + have/want?

**Decision**: Yes — no backend work is required for FR-005 / FR-005a.

**Rationale**:
- `frontend/src/services/libraryApi.ts` defines
  `CommunityStats { have, want, rating { average, count } }` and
  `Release.community?: CommunityStats`.
- `backend/src/adapters/discogsCatalog/discogsMapper.ts` → `mapRelease()` maps
  `community` (have, want, rating.average, rating.count) from the raw Discogs
  `GET /releases/{id}` response and spreads it onto the returned `Release` when
  present (`...(community ? { community } : {})`).
- `ReleaseDetailPage` gets the `Release` from `useCatalogRelease(id)`;
  `RecordDetailPage` gets it as `entry.release`. Both already hold `community`.
- It is currently rendered only inside `ReleaseAdditionalInfoSection`
  (`{have} have / {want} want · rating {average} ({count})`) — never as a
  first-class element.

**Alternatives considered**: Adding a dedicated community-stats endpoint — rejected,
the data is already in the payload (YAGNI, Principle III).

---

## R2. Converge the two page components into one, or keep two?

**Decision**: Keep both route components (`ReleaseDetailPage`, `RecordDetailPage`);
extract a shared presentational surface they both compose.

**Rationale**:
- The routes carry different params and data sources:
  `/app/library/records/:entryId` → `useLibraryEntry` (returns
  `EnrichedLibraryEntry` with `discogs` copy data + `release`);
  `/app/releases/:discogsId` → `useCatalogRelease` (returns `Release`) **plus**
  `useWantlistEntry` (returns `WantEntryDetail` when in the wishlist).
- A single component would need a branchy union of three data shapes and three
  fetch strategies — more complexity, not less. The spec Assumptions explicitly
  allow keeping two pages as long as the observed sections/order/styling match.
- The shared surface (`RecordDetailLayout` + section components + `RatingCard` +
  `RecordDetailActions`) is where "sameness" is guaranteed.

**Alternatives considered**: One `RecordDetailPage` with a `mode` prop — rejected
(Interface Segregation / KISS); a route-config abstraction — rejected (YAGNI).

---

## R3. Sticky media rail behavior, incl. a tall multi-image gallery

**Decision**: Desktop rail = `position: sticky; top: <header-safe offset>` with
`align-self: start` on the grid item. When the rail's natural height exceeds the
viewport, it scrolls with the page (native sticky) — accepted, no special-casing.
The gallery keeps its current `ReleaseImageGallery` component unchanged.

**Rationale**:
- Native `position: sticky` already degrades correctly: a too-tall sticky element
  simply stops sticking once its bottom passes the viewport. For the common case
  (cover + a few thumbnails + Rating card + streaming card) the rail is shorter
  than a laptop viewport and stays pinned while the tracklist scrolls — the
  intended benefit.
- No JS scroll listener; nothing to test for jank.
- `prefers-reduced-motion` is irrelevant to `position: sticky` (no animation), but
  any *scroll-edge* fade we add to the rail/column boundary must be static under
  reduced-transparency (Principle X, `apple-design` §12/§14).

**Alternatives considered**: A capped-height scrollable rail (`overflow-y: auto`) —
rejected: nested scroll regions are an accessibility and trackpad-feel hazard
(`apple-design` §9, Emil "friction instead of hard stops"); a JS-driven "pin then
release" — rejected (YAGNI, Principle III).

---

## R4. `StreamingLinksSection` placement + the skeleton-collapse reflow trade-off

**Decision**:
1. Remove the component's hard-coded `lg:col-span-2` class so the parent
   (`RecordDetailLayout`) decides placement (rail on desktop, position 4 in the
   mobile stack). Keep the reserved-height resolving skeleton and the
   collapse-to-`null` on no-match — that is "no functional change" (FR-014).
2. Accept that on a **cache-miss first view**, the resolving skeleton collapsing to
   nothing reflows the sections *below* it (tracklist, catalog info) once. This is
   a one-time, sub-second reflow, it only happens when Apple Music has no match,
   and reduced-motion users see no animated movement. Spec **US4 AS3** is updated
   during `/speckit-tasks` triage to read "the sections below reflow once without
   disturbing the sections above" rather than "only empty space below reflows".

**Rationale**: Putting the card in its contract position (after Rating, before
tracklist) is the whole point of FR-014/US4; keeping a permanent reserved gap when
there is no streaming match would violate FR-015 ("collapse without leaving an empty
card"). The streaming resolution is normally cached and resolves before first paint,
so the reflow is an edge case of an edge case.

**Alternatives considered**: Mount streaming last in the DOM and use CSS `order` to
visually place it at position 4 — rejected: breaks the "DOM order == contract order"
accessibility rule (FR-022). Keep a permanent reserved slot — rejected (FR-015).

---

## R5. Rating widgets — reuse vs. new

**Decision**: Reuse unchanged.
- **Community half**: `presentRating(release.community?.rating)` →
  `ReleaseRatingBadge` (`frontend/src/lib/releaseRating.ts` +
  `components/ui/ReleaseRatingBadge.tsx`). `presentRating` already returns the
  `unrated` placeholder (`displayValue: '-'`, `band: 'unrated'`) when the rating is
  absent or has `count <= 0` — exactly the FR-004 "not rated" state. Show the
  rating count next to the badge.
- **Personal half**: `StarRating` (`components/ui/StarRating.tsx`) — editable in the
  library and wishlist views, absent in the pure-search view.
- **have/want**: plain text (`{have} · have`, `{want} · want`) inside the Rating
  card, moved out of `ReleaseAdditionalInfoSection`.

**Rationale**: KISS/YAGNI (Principle III); the community badge already satisfies the
constitution's color-banded-severity requirement (Principle VII) and matches the
list/grid cards the user just came from (spatial/visual consistency,
`apple-design` §16.4, Emil "cohesion matters"). No new rating component.

**Alternatives considered**: Unifying both onto one visual scale — rejected by spec
Assumptions and Principle III.

---

## R6. Where the personal rating currently lives, and what "extracting" it means

**Decision**: Move the rating control out of `MyCopySection` and delete
`WantlistPanel`; both destinations' save handlers move up to `RatingCard`.

**Findings**:
- `MyCopySection` (library) renders `StarRating value={discogs.rating}
  onChange={onSaveRating}` → `useUpdateLibraryEntry(entryId).mutateAsync({ rating })`
  → `PATCH /api/library/:id`. After extraction, `MyCopySection` keeps only media
  condition, sleeve condition, and notes (`editable` flags preserved).
- `WantlistPanel` (wishlist) renders a personal `StarRating` +
  `InlineEditableField` note → `useUpdateWantEntry(releaseId).mutateAsync({ rating |
  notes })` → `PATCH /api/wantlist/:releaseId`. The rating handler moves to
  `RatingCard`; the **note is retired entirely** (FR-016) — `WantlistPanel` is
  deleted, `onSaveNotes` / `notes` are simply not wired anywhere. No
  note-mutating request is issued from the wishlist detail view (SC-007).
- `RatingCard` receives an optional `personal` model:
  `{ value: number; onSave: (rating:number)=>Promise<void>; saving?: boolean }`.
  When `personal` is `undefined` (search, not in either list) the personal half
  renders the read-only "not rated" state, not an editable control.
- Save-failure UX: reuse the retry affordance pattern already in `WantlistPanel`
  (`role="alert"` + "Try again" button) so FR-007 is met consistently.

---

## R7. Action bar — content per view and where the messaging goes

**Decision**: `RecordDetailActions` renders directly under `<BackLink>` in every
view, full content width, above the gallery/rail split.

| View | Actions | Messaging it owns |
|------|---------|-------------------|
| Search (release, not in library, not in wishlist) | "Add to library", "Add to wishlist" | `gateError` (not-linked / relink, per target), `wantlistNote` (already in library / removal failed), `addError`, `wantlistError` |
| Wishlist (release, in wishlist) | "Add to library" | same gate/error/notice set |
| Library (entry) | "Remove from library" (with the existing `window.confirm`) | remove-failure error |

**Rationale**: FR-012/FR-020 + clarification. Consolidating the buttons + their
`role="status"`/`role="alert"` messages in one component keeps the three pages'
JSX symmetric and moves ~60 lines of action state out of `ReleaseDetailPage`.
Grouping the message with the control that caused it satisfies `apple-design` §16
(grouping & mapping) and WCAG 3.3 (error identification near the field).

**Note**: All the mutation hooks (`useCreateLibraryEntry`, `useAddToWantlist`,
`useRemoveLibraryEntry`) and the `ApiError` code handling stay in the page
components; `RecordDetailActions` takes callbacks + pending/served flags as props
(Dependency Inversion — the bar doesn't know about TanStack Query).

---

## R8. Layout / motion guidance from the installed design skills

Consulted `apple-design` and `emil-design-eng` per Principle XI before designing the
surface.

**Decisions**:
- **The rail is a spatial-consistency device, not a motion opportunity.** No
  entrance animation on the detail sections — the page is seen many times
  (`emil-design-eng` "Should this animate at all?" → occasional/frequent → no).
  The value is a stable, predictable layout (`apple-design` §16.4 Familiarity,
  §7 spatial consistency).
- **Card / section transitions**: skeleton → content is an opacity cross-fade only
  (no translate), ≤200ms, `ease` — and disabled under `prefers-reduced-motion`
  (Principle X, `emil-design-eng` accessibility). Sizing classes are shared across
  skeleton/empty/populated so the cross-fade never moves layout (UI Design System
  "No layout shift").
- **Buttons in the action bar**: `:active { transform: scale(0.97) }`, `transform
  160ms ease-out`, gated behind `@media (hover:hover)` for hover styles
  (`emil-design-eng` "Buttons must feel responsive" / "Touch device hover states").
  Reuse the existing `<Button>` atom, which should already encode this — verify
  during implementation, add if missing.
- **`StarRating` interaction** is unchanged (existing component), already
  keyboard-operable; the Rating card must give it a real 44×44 hit area at mobile
  width (constitution touch-target rule).
- **Scroll-edge treatment** between the sticky rail and the scrolling column: a
  subtle static divider is sufficient; no blur/gradient chrome is required and it
  would add reduced-transparency handling for little gain (`apple-design` §12 —
  "only where floating UI actually overlaps content"; here it doesn't overlap).

---

## R9. Test surface (Principle I — Test-First)

**Existing coverage to update**:
- e2e: `release-detail.spec.ts`, `release-detail-responsive.spec.ts`,
  `record-detail-inline-edit.spec.ts`, `record-detail-responsive.spec.ts`,
  `wishlist-*.spec.ts` (assertions on the wishlist panel / notes field).
  `master-release-detail*.spec.ts` — **must stay green untouched** (FR-023
  regression guard).
- The current pages use stable `data-testid`s
  (`release-detail-gallery-card`, `record-detail-your-copy-card`,
  `release-detail-wantlist-panel-card`, `release-detail-streaming-card`, …). The
  new components MUST keep an equivalent, documented set (see
  `contracts/ui-contracts.md`) so e2e updates are mechanical.

**New component tests (written first, must fail first)**:
- `RatingCard.test.tsx` — personal editable / personal absent / community present /
  community `unrated` / both absent / have-want rendering / save-failure retry.
- `RecordDetailActions.test.tsx` — the three view variants; gate/error/notice
  rendering; `Remove` confirm path.
- `MyCopySection.test.tsx` — no rating control present; media/sleeve/notes still
  save; `editable=false` messaging preserved.
- `ReleaseAdditionalInfoSection.test.tsx` — no community line; still renders
  identifiers + notes; renders `null` when only community data would have shown.
- `RecordDetailLayout.test.tsx` — DOM order equals the contract order regardless of
  the `variant` (rail vs stack) prop; action-bar slot is first; "Estado de mi
  copia" slot present only for the library variant.

---

## Summary of decisions

| # | Decision | Backend impact |
|---|----------|----------------|
| R1 | Community + have/want already in payload | None |
| R2 | Keep two route components, share a presentational surface | None |
| R3 | Native `position: sticky` rail, no JS, gallery unchanged | None |
| R4 | Parent places streaming card; accept one-time below-reflow on no-match | None |
| R5 | Reuse `ReleaseRatingBadge` (community) + `StarRating` (personal); no new widget | None |
| R6 | Extract rating from `MyCopySection`; delete `WantlistPanel`; retire wishlist note | None |
| R7 | `RecordDetailActions` bar under the back-link; pages keep the mutation logic | None |
| R8 | No section entrance motion; ≤200ms reduced-motion-aware cross-fades only | None |
| R9 | Update 6 e2e specs; 5 new component test files, tests first | None |
