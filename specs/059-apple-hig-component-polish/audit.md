# Component Audit — Apple HIG Compliance (FR-016)

**Created**: 2026-09-05 (planning phase) · **Feature**: [spec.md](./spec.md) · **Skills consulted**: `apple-design`, `emil-design-eng`, `animate`

**Disposition key**: `conforms` = no change · `refine` = token / press-state / focus / typography adjustment, no structural change · `rework` = structural interaction change.

**HIG principle codes**: RESP = Response/kill-latency · DM = Direct manipulation · INT = Interruptibility · FB = Feedback · DEPTH = Depth & materials · SPACE = Spatial consistency · TYPO = Typography · CONS = Consistency/Familiarity · CRAFT = Craft.

Every implementation task in `tasks.md` MUST cite a `component` + `story` row here (SC-002).

---

## Foundational (no single story — blocks all)

| Component / file | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `frontend/src/motion/` (new) | rework | INT, DM, DEPTH | apple-design, animate | New wrapper: `tokens.ts`, `MotionProvider`, `Overlay`, `Sheet`, `useFocusTrap/useScrollLock/useRestoreFocus` | overlay-focus-management, sheet-drag-dismiss |
| `frontend/src/styles/global.css` | refine | INT, TYPO, CRAFT | animate, apple-design | Add `--ease-*`, `--motion-duration-*`, `--tracking-display`/`--leading-display`; `@media (prefers-reduced-motion\|-transparency\|-contrast)` blocks | reduced-motion |
| `frontend/src/components/ui/focusRing.ts` (new) | refine | CONS | emil-design-eng | Single shared focus-ring constant; replace per-component copies + legacy `outline-primary` | (covered by each control's spec) |
| App root (`main.tsx` / `App.tsx`) | refine | INT | apple-design | Mount `<MotionProvider>` beside `<ThemeProvider>` | reduced-motion |

---

## US1 — Instant press feedback (P1)

**Status**: ✅ done (T022/T043/T044). `e2e/tests/press-feedback.spec.ts` (new, 13 cases)
covers Button, filter chip, star, header nav icon, inline-edit trigger, BackLink nudge,
disabled-Button suppression, whole-card scale, `prefers-reduced-motion` (brightness kept,
no scale), and keyboard activation + shared `focusRing` visible & AA on both themes.
`view-mode-toggle.spec.ts` and `record-detail-inline-edit.spec.ts` extended with
press-state assertions (T043). Axe: zero serious/critical on the authed Dashboard,
light + dark (SC-005 ≥ baseline). Full US1 gate green.

| Component | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `ui/Button` (+ `buttonClassName`, `iconButtonClassName`) | refine | RESP, FB | emil-design-eng | `active:scale-[0.97]` + `active:brightness` on pointer-down; token transition; suppressed when disabled/loading & reduced-motion; adopt `focusRing` | ✅ press-feedback |
| `ui/StarRating` | refine | RESP, FB, CONS | emil-design-eng | Per-star press scale; adopt `focusRing` (removes the documented `outline-primary` race) | ✅ press-feedback, record-detail-inline-edit |
| `ui/ThemeToggle` | refine | RESP, FB | emil, animate | Press feedback on the track; (motion handled in US2) | ✅ theme-preference (unit-covered; e2e press in US2) |
| `ui/ViewModeToggle` | refine | RESP, FB | emil | Press feedback on each option; adopt `focusRing` | ✅ view-mode-toggle |
| `ui/BackLink` | refine | RESP | emil | Press state (`active:-translate-x-0.5` nudge toward the chevron); `focusRing` | ✅ press-feedback, record-detail-inline-edit |
| `ui/InlineEditableField` (read trigger) | refine | RESP, FB | emil | Press state on the trigger button; `focusRing` | ✅ press-feedback, record-detail-inline-edit |
| `ui/Checkbox` | refine | RESP, FB | emil | Press feedback on the row; keep spec-058 dark `bg-stone-300` fix | ✅ library-filters (unit-covered) |
| `filters/SelectableListFilter` | refine | RESP, FB, CONS | emil | Press state on each selectable row; ensure it maps to `multi-select-list` pattern | ✅ library-filters, search-result-filters (unit-covered) |
| `filters/FilterActions` | refine | RESP | emil | Buttons inherit `Button` press state — verify | ✅ library-filters (unit-covered) |
| `filters/CollapsibleFilterPanel` (trigger) | refine | RESP | emil | Trigger inherits `Button` press; (disclosure motion in US2) | ✅ library-filters (unit-covered) |
| `components/HeaderNavIcons` | refine | RESP, FB | emil | Icon-button press state; `focusRing` | ✅ press-feedback |
| `components/HamburgerMenu` (trigger) | refine | RESP | emil | Inherits `Button` press; (drawer gesture in US4) | ✅ header-responsive-nav (unit-covered) |
| `components/HeaderSearchBox` | refine | RESP | emil | Submit/clear controls press; input focus unchanged | ✅ press-feedback (Search button) |
| `components/ResultCardActions` | refine | RESP, FB | emil | Action buttons press state | ✅ press-feedback (disabled "Added to library"), search-results-responsive |
| `components/GoogleSignInButton` | refine | RESP, FB | emil | Press state; keep the spec-032 AA indigo | ✅ sign-in (inherits `Button`; unit-covered) |
| `components/RecordCard`, `RecordListRow`, `SearchResultCard`, `SearchResultListRow` | refine | RESP, FB | emil | Whole-card press affordance (`active:scale-[0.99]`) on the `<Link>`; keep skeleton parity | ✅ press-feedback (SearchResultCard link), library-list-responsive, search-results-responsive |
| `components/FeedArticleCard` | refine | RESP | emil | Card press affordance | ✅ dashboard-feed-grid (unit-covered) |
| `components/FeedCategoryFilterBar`, `FeedSourceFilterBar` | refine | RESP, CONS | emil | Chip press state; map chips to one pattern | ✅ press-feedback (FeedCategoryFilterBar chip), dashboard-feed-grid |
| `components/MasterVersionsTable` (rows) | refine | RESP | emil | Row press affordance where rows navigate | ✅ master-release-detail-responsive (unit-covered) |

---

## US2 — Physical, interruptible transitions (P1)

**Status**: ✅ done (T045–T059). Motion implementation shipped in commit 75c00d4
(T046–T056). E2E coverage (T045/T057/T058/T059): `e2e/tests/reduced-motion.spec.ts`
(new, 6 cases — Modal, end-drawer, ViewModeToggle pill, CollapsibleFilterPanel,
gallery viewer + image swap all opacity-only with no translate/scale under
`emulateMedia({ reducedMotion: 'reduce' })`; skeleton `animation-name: none`),
`e2e/tests/overlay-focus-management.spec.ts` (new, 2 cases — SC-003: closing the
centered Modal mid-enter and reversing the end-drawer mid-slide both track from
the current on-screen value with no single-frame jump to a start/end transform),
`theme-preference.spec.ts` (+2: knob glides on `spring.default`; reduced-motion
jump), `view-mode-toggle.spec.ts` (+2: sliding pill; reduced-motion jump — plus
the spec-058 "active option fill" contrast check re-pointed at `view-mode-pill`
now that the active `<button>` no longer carries `bg-primary`),
`library-filters.spec.ts` / `search-result-filters.spec.ts` (+2 each: disclosure
height+opacity motion; reduced-motion opacity-only, no transform). SC-006 (one
shared token set) is guarded by the frontend unit test
`frontend/tests/unit/architecture/no-inline-motion.test.ts` — green.
Full US2 e2e set: 77 passed / 0 failed (2 pre-existing unrelated `test.fixme`
skips in `search-result-filters.spec.ts`). No interruptibility jump or
reduced-motion transform leak found in the implementation.

| Component | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `ui/Modal` | rework | INT, SPACE, DEPTH | apple-design, animate | Re-home on `Overlay`; spring enter/exit, interruptible, same-path exit; reduced-motion opacity-only | ✅ overlay-focus-management, reduced-motion |
| `ui/ThemeToggle` | refine | INT, CRAFT | animate | Knob translate → `spring.default`; sky/stars → token crossfade; reduced-motion static | ✅ theme-preference |
| `ui/ViewModeToggle` | rework | INT, SPACE, CRAFT | animate, emil | Active state → shared-element sliding pill (`layoutId` + `spring.default`); reduced-motion jump | ✅ view-mode-toggle, reduced-motion |
| `filters/CollapsibleFilterPanel` | refine | INT, FB | animate | Height+opacity disclosure motion (measured height), chevron rotate on token; reduced-motion instant | ✅ library-filters, search-result-filters, reduced-motion |
| `ui/Skeleton` + all `*Skeleton` | refine | CRAFT | apple-design | `animate-pulse` gated behind `motion-safe`; dims/structure unchanged | ✅ reduced-motion |
| `components/GalleryFullscreenViewer` (image change) | refine | INT, SPACE | animate | Image swap → directional slide + `spring.momentum`; (swipe in US4) | ✅ reduced-motion (release-detail-responsive in US3/US4) |
| `components/ReleaseImageGallery` (thumb → viewer) | refine | SPACE | apple-design | Open viewer anchored to the tapped thumbnail (transform-origin) | ✅ reduced-motion (release-detail-responsive in US3/US4) |
| `components/FeedArticleBoard` / carousel | refine | INT, DM | animate | No carousel exists (responsive grid) — no-op; token easing applies if one is added | n/a (dashboard-feed-grid) |
| `components/*Section` (Release/Master detail sections) | conforms | — | apple-design | Static content; no motion warranted (emil: don't animate content) | — |

---

## US3 — Overlay depth & focus management (P2)

**Status**: ✅ done (T060–T067). Material + focus contract shipped in commits
75c00d4 / 1d370f5 (T062–T064). E2E coverage (T060/T061/T065/T066/T067):
`e2e/tests/overlay-focus-management.spec.ts` (+13 cases — for the centered
Modal, the end-drawer and the fullscreen gallery: Tab/Shift+Tab trapped inside;
Escape, scrim-click and close-button each restore focus to the exact opener;
`document.body` `overflow: hidden` while open and reverted after; background
does not scroll on wheel/`PageDown`; scrim reads as a distinct backdrop —
plus the T065 nested confirm-in-Modal stack: inner traps, unwinds to the outer
opener, then to the page trigger, with ref-counted scroll lock),
`e2e/tests/overlay-contrast.spec.ts` (new, 8 cases — `assertOverlayContentContrast`
over blurred busy cover art both themes; axe `serious`/`critical` = 0 with the
Genre Modal open and with the fullscreen gallery open, both themes;
`prefers-contrast: more` emulated → solid scrim + bordered surface; the
`prefers-reduced-transparency` / `@supports not (backdrop-filter)` fallback
rules asserted present in the shipped stylesheet — neither is emulatable in
Playwright 1.61), `e2e/tests/release-detail-responsive.spec.ts` (+2, chromium
& webkit — gallery scrim dims + blurs and the surface is the `.overlay-surface`
floating layer; close control clears 1.4.11 against the scrim),
`e2e/tests/dark-mode-contrast.spec.ts` (+4 — Modal content on its opaque
surface + gallery scrim/close-control contrast, both themes). Test-only harness
`frontend/src/pages/dev/NestedOverlayHarness.tsx` at `/__dev/nested-overlay`
(DEV-only route). Full US3 e2e set: 60 passed / 0 failed. The four latent
`Modal` gaps (focus trap / focus restore / scroll lock / backdrop distinction)
are proven closed by e2e for all three overlays. No focus, scroll-lock or
material defect found in the implementation; two secondary observations logged
below.

**Notes / follow-ups (not US3-blocking):**
- The fullscreen gallery `[role="dialog"]` has no accessible name
  (`GalleryFullscreenViewer` passes no `labelledBy`/`aria-label` to `Overlay`).
  Not a `wcag2a`/`aa` axe failure (the `aria-dialog-name` rule is
  best-practice-tagged), but worth a one-line fix.
- `useEscapeKey` is not stack-aware: with the nested stack open, one Escape
  fires both overlays' handlers. The T065 tests dismiss the inner dialog via
  its button to get a deterministic unwind; a topmost-only Escape would be the
  cleaner behaviour if nested overlays become a real pattern.

| Component | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `motion/Overlay` | rework | DEPTH, RESP | apple-design | Scrim `bg-stone-950/60` + `backdrop-blur-md backdrop-saturate-150`; `@supports`/reduced-transparency/reduced-contrast fallbacks; focus trap + restore + scroll lock | ✅ overlay-focus-management, overlay-contrast |
| `ui/Modal` | rework | DEPTH | apple-design | Consumes `Overlay` material + focus contract; `aria-labelledby` on title | ✅ overlay-focus-management, overlay-contrast, dark-mode-contrast |
| `components/GalleryFullscreenViewer` | rework | DEPTH | apple-design | Consumes `Overlay`; blur backdrop + fallbacks; focus trap/restore/scroll lock | ✅ overlay-focus-management, release-detail-responsive, dark-mode-contrast |
| `e2e/helpers/contrast.ts` | refine | — | — | Add `colorAlpha` + `assertOverlayContentContrast` over-blur worst-case (busy cover art) — opaque-surface guard + text ≥ 4.5:1 + control ≥ 3:1 | ✅ overlay-contrast, dark-mode-contrast |
| `pages/dev/NestedOverlayHarness` (test-only) | add | — | — | DEV-only `/__dev/nested-overlay` route — confirm dialog inside a Modal, for the nested focus-unwind test | ✅ overlay-focus-management |
| `ui/Card` | conforms | DEPTH | apple-design | `rounded-xl border shadow-sm` already correct for in-flow cards; floating tiers reserved correctly | — |

---

## US4 — Touch gestures: drag-to-dismiss & gallery swipe (P2)

**Status**: ✅ done (T068–T077). Implementation shipped in commit 1232ce9
(T070–T075; `MotionProvider` bumped `domAnimation` → `domMax` so the `drag`
gesture works at runtime). E2E coverage (T068/T069/T076/T077):
`e2e/tests/sheet-drag-dismiss.spec.ts` (new, 8 cases — 1:1 tracking from the
grab point; released < 45% & slow → spring-back with the dialog still
mounted and focus still trapped; released > 45% → dismiss + `onClose` +
focus restored to the opener; short flick ≥ 500 px/s → dismiss; the whole
surface — not just the handle — is the drag affordance and a vertical
content-scroll offset never swallows the horizontal dismiss; close-button +
Escape parity; axe serious/critical = [] with the drawer open, light + dark),
`e2e/tests/gallery-swipe.spec.ts` (new, 10 cases — swipe left/right steps
exactly ±1; thumbnail `aria-current` follows; a hard flick never skips two
images; no wrap at either end; `ArrowLeft`/`ArrowRight` + thumbnail-button +
close-button + Escape parity; axe serious/critical = [] with the viewer
open, light + dark), `e2e/tests/header-responsive-nav.spec.ts` (+2 — the
header hamburger drawer opens, swipe-dismisses, and lands focus back on the
hamburger, matching the Escape / close-button paths). US4 validation set
(`sheet-drag-dismiss` + `gallery-swipe` + `header-responsive-nav` +
`release-detail-responsive`): 64 passed / 0 failed (chromium + webkit).
SC-005 baseline (`reduced-motion`, `overlay-focus-management`,
`overlay-contrast`, `dark-mode-contrast`, `press-feedback`): 47 passed / 0
failed — no regression from the `domMax` bump. SC-008 met: every
gesture-driven outcome (drawer dismissal, gallery navigation) has an
automated non-gesture button + keyboard path covered alongside the gesture.

Notes / deltas from the task text:
- **FR-011 scroll-vs-dismiss "block" branch** — the app's only `Sheet` is the
  x-axis hamburger drawer, whose content scrolls only vertically.
  `scrollBlocksDismiss` gates an x-axis dismiss on horizontal scroll
  (`scrollLeft`, always 0 here) — vertical scroll is orthogonal and never
  blocks the horizontal dismiss, matching `Sheet.test.tsx`. The classic
  "drag down while scrolled → scroll first" case only applies to a y-axis
  sheet, which does not exist in the product yet; that branch stays covered
  by the `scrollBlocksDismiss` unit tests.
- **Synthetic Pointer-Event drags** reliably drive `motion`'s gesture layer
  in Playwright (Chromium + WebKit). `page.mouse` moves with an inter-step
  delay drive the drawer's slow drags; rAF-paced in-page `PointerEvent`
  dispatch drives the velocity flicks and every gallery swipe (it also
  avoids the stray post-drag `click` that a real off-surface `page.mouse`
  drag lands on the gallery scrim — see the minor findings in the T077
  report).

| Component | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `motion/Sheet` | rework | DM, INT | apple-design | 1:1 drag from grab offset; dismiss on 45% distance OR 500 px/s; spring-back; rubber-band; scroll-boundary disambiguation; velocity hand-off | ✅ sheet-drag-dismiss |
| `ui/Modal` (`position="end"`) | rework | DM | apple-design | Drawer form renders through `Sheet`; button + Escape parity kept | ✅ sheet-drag-dismiss, header-responsive-nav |
| `components/HamburgerMenu` | refine | DM | apple-design | Drawer is now swipe-dismissible via `Modal position="end"`; nav rows keep press state | ✅ header-responsive-nav |
| `components/GalleryFullscreenViewer` | rework | DM, INT, SPACE | apple-design, animate | Horizontal swipe between images (offset/velocity + momentum projection); `ArrowLeft/Right` keys added; thumbnails + close + Escape parity | ✅ gallery-swipe, release-detail-responsive |

---

## US5 — Consistent interaction & typography language (P2)

| Component | Disposition | HIG | Skill | Change | e2e |
|---|---|---|---|---|---|
| `focusRing` rollout | refine | CONS | emil | Every interactive control uses the one shared constant; delete the 3 historical variants | (each control's spec) |
| `ui/ThemeToggle` vs `ui/ViewModeToggle` vs `ui/StarRating` | refine | CONS | apple-design, emil | Document as `binary-switch` / `segmented-selector` / rating-input; unify focus + press only, keep distinct semantics | theme-preference, view-mode-toggle |
| `filters/CollapsibleFilterPanel` + any accordion | refine | CONS | emil | One `disclosure` pattern (chevron dir, motion token, aria) | library-filters |
| `components/RecordCard` ("Open record" `underline`) | refine | TYPO, CRAFT | apple-design | Replace underline-as-emphasis with `text-primary dark:text-primary-text font-medium` | library-list-responsive |
| `components/*` display headings (page/pillar/showcase) | refine | TYPO | apple-design | Apply `--tracking-display` (-0.02em) + `--leading-display` (1.05) to `--font-display` headings; keep fixed `text-*`/`leading-*` no-CLS pairing | landing-page-responsive, dashboard-feed-grid |
| `components/LandingHero`, `LandingPillarSection` | refine | TYPO, CRAFT | apple-design | Display-type tracking/leading; press state on CTAs | landing-page-responsive |
| `components/AppHeader`, `LandingHeader` | refine | DEPTH, CRAFT | apple-design | Hard bottom border → scroll-edge mask; opaque near-black surface kept (constitution wins over full translucency) | header-responsive-nav, landing-page-responsive |
| Body-text links/emphasis across composites | refine | TYPO | apple-design | Remove decoration-as-emphasis; hierarchy via weight/size/color | (per-screen specs) |
| `ui/Badge`, `ui/ReleaseRatingBadge` | conforms | CONS, CRAFT | emil | Spec-058 boundary/contrast work already correct; no motion warranted | — |
| `ui/Input` | refine | FB, CRAFT | emil | `focus:border-primary` kept; add a calm focus transition token; no layout shift | (form specs) |
| `ui/Avatar` | conforms | — | apple-design | Static image/placeholder; correct | — |
| `components/UnderConstruction`, `LibraryLinkRequired`, `DiscogsRelinkNotice`, `FeedSourceStatusBanner` | refine | CRAFT, FB | emil | Status/empty states: gentle opacity entrance (token), no movement; wayfinding copy check | (per-screen specs) |
| `brand/VinylmaniaIcon`, `VinylmaniaWordmark`, `VinylmaniaGrungeFilter` | conforms | — | apple-design | Decorative brand marks; no interaction/motion change | logo-rebranding |
| `ui/icons/CloseIcon` | conforms | — | — | Pure SVG; inherits button treatment from its parent | — |

---

## Coverage check

- Every component listed in spec.md → Scope appears above exactly once (atomic `ui/*`, `filters/*`, `brand/*`, and all composites).
- `conforms` rows still name the principle checked + skill consulted (Principle XI: "MUST NOT be skipped because a change looks small").
- Story mapping: US1 = press/RESP · US2 = motion/INT · US3 = depth+focus/DEPTH · US4 = gestures/DM · US5 = consistency+typography/CONS+TYPO. Foundational precedes all.
