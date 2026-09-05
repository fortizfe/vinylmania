# `frontend/src/motion/` — the shared motion, overlay & interaction layer

This module is the **only** place in the frontend that imports the `motion`
gesture/animation library (Constitution IV; spec 059 FR-006a). Components and
pages consume the primitives, hooks and tokens re-exported from
[`index.ts`](./index.ts) — never the library directly.
`tests/unit/architecture/motion-import-boundary.test.ts` enforces the seam;
`tests/unit/architecture/no-inline-motion.test.ts` enforces that every animated
component pulls its curve/duration/spring from [`tokens.ts`](./tokens.ts) (or
the mirrored `--ease-*` / `--motion-duration-*` custom properties in
`src/styles/global.css`).

## Motion tokens (single source of truth)

| Token | Value | Use |
|-------|-------|-----|
| `easing.out` / `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entrances, exits, press-release, fades |
| `easing.inOut` / `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen move/morph |
| `easing.drawer` / `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | non-gesture drawer slide |
| `motionDuration.press` / `--motion-duration-press` | `130 ms` | pressed-state transition |
| `motionDuration.fade` / `--motion-duration-fade` | `200 ms` | modal/dropdown fade, reduced-motion crossfade, input focus-border, header scroll-edge, status entrance |
| `motionDuration.collapse` / `--motion-duration-collapse` | `200 ms` | disclosure height+opacity |
| `motionDuration.drawer` / `--motion-duration-drawer` | `250 ms` | drawer slide (non-gesture open) |
| `spring.default` | `{ spring, duration 0.4, bounce 0 }` | UI springs, no overshoot (modal scale, toggle knob, sliding pill) |
| `spring.sheet` | `{ spring, duration 0.35, bounce 0 }` | sheet settle to open/closed after a drag |
| `spring.momentum` | `{ spring, duration 0.5, bounce 0.2 }` | drag-release fling (dismiss, gallery image change) |
| `dismiss.distanceRatio` / `.velocity` / `.elastic` | `0.45` / `500 px/s` / `0.15` | `Sheet` drag-to-dismiss decision + rubber-band |

Typography tokens (`--tracking-display` `-0.02em`, `--leading-display` `1.05`)
live in the same `@theme` block and surface as the `tracking-display` /
`leading-display` utilities.

**Reduced motion**: `MotionProvider` sets `<MotionConfig reducedMotion="user">`
so every `m` transform collapses; the global
`@media (prefers-reduced-motion: reduce)` block in `global.css` neutralises CSS
transition/animation timing. Primitives additionally branch on
`usePrefersReducedMotion()` to render an opacity-only structure with no spring
config.

---

## Canonical interaction patterns (FR-014 / US5)

Every shared UI concept resolves to **exactly one** pattern below. Every
interactive control is `pressable` **plus** at most one higher-level pattern.
The focus treatment is the same everywhere: the shared `focusRing` constant
(`src/components/ui/focusRing.ts` —
`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`).
`tests/unit/architecture/focus-ring-consistency.test.ts` fails the build on any
other focus-visible treatment in `components/**`.

### 1. `pressable` — instant press feedback

- **Semantics**: any `<button>` / `<a>` / role-bearing control. Native `:active`
  (fires on pointer-down, cancels on drag-away). No JS, no library.
- **Affordance**: `pressable` → `scale(0.97)` + brightness nudge;
  `pressableCard` → `scale(0.99)` for whole-card `<Link>`s; `pressableRow` →
  brightness only (dense rows); `pressableNudge` → 2 px shift toward the chevron
  (`BackLink`). All from `src/components/ui/press.ts`.
- **Motion tokens**: `--motion-duration-press`, `--ease-out` (CSS only).
- **Focus**: `focusRing`.
- **Reduced motion**: scale/translate dropped, brightness shift kept; timing
  neutralised by the global guard.
- **Conforms**: `Button` (+ `buttonClassName` / `iconButtonClassName`),
  `ThemeToggle`, `ViewModeToggle` options, `StarRating` stars, `BackLink`,
  `InlineEditableField` trigger, `Checkbox` row, `SelectableListFilter` rows,
  `HeaderNavIcons`, `HeaderSearchBox`, `HamburgerMenu` trigger + nav rows,
  `ResultCardActions`, `GoogleSignInButton`, `RecordCard`, `RecordListRow`,
  `SearchResultCard`, `SearchResultListRow`, `FeedArticleCard`,
  `FeedCategoryFilterBar` / `FeedSourceFilterBar` chips, `MasterVersionsTable`
  navigable rows, `GalleryFullscreenViewer` thumbnails.

### 2. `binary-switch` — genuine on/off

- **Semantics**: `role="switch"` + `aria-checked`; `Space`/`Enter` toggles;
  accessible name via `aria-label`.
- **Affordance**: a knob that springs across the track; paired visual crossfade
  where relevant (sky/stars).
- **Motion tokens**: `spring.default` (knob translate), `--motion-duration-fade`
  + `--ease-out` (crossfade).
- **Focus**: `focusRing`.
- **Reduced motion**: knob position changes with no transition; opacity
  crossfade only.
- **Conforms**: `ThemeToggle`. *Only* for true binary state — never for a
  2-option choice (that is `segmented-selector`).

### 3. `segmented-selector` — 2–4 exclusive named options

- **Semantics**: `role="radiogroup"` wrapping `role="radio"` + `aria-checked`;
  roving `tabIndex`; Arrow keys move selection.
- **Affordance**: a single shared-element pill (`m` + `layoutId` +
  `spring.default`) that slides under the active option — the option `<button>`s
  themselves never carry the active fill.
- **Motion tokens**: `spring.default`.
- **Focus**: `focusRing`.
- **Reduced motion**: pill jumps (no layout animation).
- **Conforms**: `ViewModeToggle`. Reuse for any future 2–4 exclusive choice.

> `StarRating` is a **rating input**, not a selector — legitimately distinct
> semantics (`aria-pressed` per star, click sets value). It shares only
> `pressable` + `focusRing`.

### 4. `multi-select-list` — independent multi-choice

- **Semantics**: native `<input type="checkbox">` + `<label htmlFor>` per row,
  or a selectable row wrapping one. No group role needed.
- **Affordance**: the native checkbox mark; whole-row `pressableRow` brightness.
- **Motion tokens**: `--motion-duration-press` (row press) only.
- **Focus**: `focusRing` on the control.
- **Reduced motion**: nothing to reduce (no transform).
- **Conforms**: `Checkbox`, `SelectableListFilter` option rows,
  `FeedCategoryFilterBar` / `FeedSourceFilterBar` (single-select chip bars use
  `aria-pressed` toggle buttons — the same visual family, one selected at a
  time).

### 5. `disclosure` — expand / collapse

- **Semantics**: a `<button>` toggles; the revealed region is `aria-hidden`
  when measured off but present; chevron direction encodes state.
- **Affordance**: height + opacity reveal on the **measured** height (never
  `height: auto` keyframes), chevron rotate on the same token.
- **Motion tokens**: `--motion-duration-collapse` + `easing.out`.
- **Focus**: `focusRing` (inherited from `Button`).
- **Reduced motion**: instant show/hide, no height animation.
- **Conforms**: `CollapsibleFilterPanel`. Reuse for any future accordion.

### 6. `dismissible-layer` — modals, drawers, fullscreen gallery

- **Semantics**: `role="dialog"` + `aria-modal="true"`; `aria-labelledby` the
  title (or `aria-label`). Focus trapped on open, restored to the opener on
  **every** dismissal path (Escape, scrim click, close button, drag). Background
  scroll locked (ref-counted, scrollbar-gutter compensated — no layout shift).
- **Affordance**: one material — scrim `bg-stone-950/60` +
  `backdrop-blur-md backdrop-saturate-150`, with `@supports` /
  `prefers-reduced-transparency` / `prefers-contrast` fallbacks in
  `global.css`. `center` variant: scale `0.96 → 1` + opacity + blur ramp
  (`spring.default`). `end` variant: slide on-axis; `Sheet` adds 1:1
  drag-to-dismiss (dismiss at ≥ 45% distance **or** ≥ 500 px/s, else spring
  back; rubber-band `dragElastic 0.15`; velocity → `spring.momentum`).
- **Motion tokens**: `spring.default`, `spring.sheet`, `spring.momentum`,
  `--motion-duration-fade` (reduced-motion crossfade).
- **Focus**: `focusRing` on every control inside; the surface is the opaque
  `<Card>` so spec-058 contrast pairings hold over the blur.
- **Reduced motion**: opacity-only enter/exit, drag still tracks 1:1 but settles
  with an instant/near-instant snap.
- **Conforms**: `Overlay` (primitive), `Sheet` (primitive), `Modal` (`center`
  + `end`), `GalleryFullscreenViewer`, `HamburgerMenu` drawer,
  `SelectableListFilter` modal. Every gesture outcome has a button + keyboard
  equivalent (FR-013).

### Non-interactive: `status-fade-in`

Status / empty-state components (`UnderConstruction`, `LibraryLinkRequired`,
`DiscogsRelinkNotice`, `FeedSourceStatusBanner`) get one gentle opacity-only
entrance (`--motion-duration-fade`, `--ease-out`, **no** translate/scale — they
must not pull the eye from their wayfinding copy). The header scroll-edge
treatment (`AppHeader`, `LandingHeader`) fades a `box-shadow` in on scroll via
`transition-shadow` + `--motion-duration-fade`; the surface stays the opaque
near-black token (constitution wins over full HIG translucency — research.md
R5).
