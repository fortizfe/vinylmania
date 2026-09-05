# Phase 0 Research: Apple HIG Component Polish

All decisions below feed Phase 1 contracts and the eventual `tasks.md`. Skills consulted: `apple-design` (Fluid Interfaces + Principles of Great Design + typography), `emil-design-eng` (animation decision framework, press states, unseen-detail craft), `animate` (exact curve/duration/spring token tables).

---

## R1 — Motion & gesture library

**Decision**: Add `motion` (the package formerly published as `framer-motion`), imported only via `frontend/src/motion/`. Use `motion/react` with `LazyMotion` + `domAnimation` features and the `m` component to keep the initial bundle small; wrap the app in a single `MotionProvider`.

**Rationale**:
- One dependency covers every capability the spec needs: interruptible springs that animate from the presentation value, `AnimatePresence` for exit animations (modal/drawer/gallery unmount), `drag` with `dragConstraints`/`dragElastic` (rubber-banding) and `onDragEnd` exposing offset + velocity, `useReducedMotion`, and `MotionConfig reducedMotion="user"` for a global guard.
- Its spring API (`{ type: "spring", duration, bounce }`) maps directly onto Apple's designer-facing damping/response model (apple-design §4), so the token values below translate 1:1.
- React 19 support is stable in `motion` v11.5+/v12.
- `LazyMotion` + `m` reduces the always-loaded footprint to ~5 kB, lazy-loading the DOM animation features.

**Alternatives considered**:
- **CSS-only + hand-rolled Pointer Events**: rejected — CSS transitions cannot be grabbed and reversed mid-flight (apple-design §3); fails FR-004 by construction. Hand-rolling velocity-blended springs is more code and more risk than a wrapped library.
- **`react-spring` + `@use-gesture/react`**: rejected — two dependencies, and the drag↔spring velocity hand-off is left to us. `motion` integrates them.
- **`@react-spring/web` alone**: rejected — no first-class drag; would still need a gesture lib.

**Wrapper obligations (FR-006a)**: no component under `components/` imports `motion`. All spring/gesture usage goes through `Overlay`, `Sheet`, or a thin `m`-re-export + token module. Trivial state (`:hover`, simple show/hide, pressed) stays CSS — no library call.

---

## R2 — Motion token values (exact, from the `animate` skill tables)

Added to `frontend/src/styles/global.css` (`@theme` for the easings so they're usable as Tailwind `ease-*` utilities; a plain `:root` block + `@theme` for durations/springs) and mirrored as typed constants in `frontend/src/motion/tokens.ts`.

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entrances, exits, press-release, simple fades (CSS) |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen move/morph (CSS) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | non-gesture drawer slide + reduced-motion drawer |
| `--motion-duration-press` | `130ms` | pressed-state transition (`transform`/`opacity`) |
| `--motion-duration-fade` | `200ms` | modal/dropdown fade, reduced-motion cross-fade |
| `--motion-duration-collapse` | `200ms` | disclosure height+opacity |
| `--motion-duration-drawer` | `250ms` | drawer slide (non-gesture open) |
| `spring.default` (JS) | `{ type: 'spring', duration: 0.4, bounce: 0 }` | UI springs with no overshoot (modal scale, toggle knob, shared-element pill) |
| `spring.sheet` (JS) | `{ type: 'spring', duration: 0.35, bounce: 0 }` | sheet settle to open/closed after a drag with no momentum |
| `spring.momentum` (JS) | `{ type: 'spring', duration: 0.5, bounce: 0.2 }` | drag-release fling (dismiss / gallery image change) — bounce only because a flick preceded it |

**Reduced motion** (`@media (prefers-reduced-motion: reduce)` + `MotionConfig reducedMotion="user"`): all `transform`/`scale`/spring motion becomes `transform: none`; only an opacity change of `--motion-duration-fade` remains; `animate-pulse` on skeletons is disabled (`animation: none`).

**Press state** (emil framework: hover effects are "tens of times/day" → near-imperceptible only): `:active` (fires on pointer-down, native hysteresis, cancel-by-drag-away) applies `transform: scale(0.97)` + a subtle opacity/brightness shift, `transition: transform var(--motion-duration-press) var(--ease-out)`. Gated behind `@media (hover: hover)` is **not** wanted here — press feedback is for touch too; instead gate the *scale* off for `prefers-reduced-motion` (keep an opacity/background shift). Disabled / `aria-busy` controls get no `:active` treatment.

---

## R3 — Focus trap, scroll lock, focus restoration

**Decision**: Hand-roll three hooks in `frontend/src/motion/` — `useFocusTrap`, `useScrollLock`, `useRestoreFocus`. No new dependency.

**Rationale**: Constitution III (KISS, no speculative deps). Each is ~30–50 lines and well-understood:
- `useFocusTrap(containerRef, active)`: on activate, focus the first focusable (or the container); intercept `Tab`/`Shift+Tab` at the boundaries and wrap; ignore when `active` is false. Query `a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])`.
- `useScrollLock(active)`: on activate, set `document.body` `overflow: hidden` and compensate scrollbar width with `padding-right` (or `scrollbar-gutter: stable` already on `<html>` — confirm) to avoid layout shift (constitution no-layout-shift rule); restore on deactivate; reference-count so nested overlays don't unlock early.
- `useRestoreFocus(active)`: capture `document.activeElement` when `active` flips true; on cleanup / flip false, call `.focus()` on it if still in the DOM.

**Alternatives considered**: `focus-trap-react` (+`focus-trap`), `react-focus-lock`, `react-remove-scroll` — all solid, but three dependencies for ~120 lines of well-trodden code the project can own and test directly. Rejected on KISS.

**Composition**: `Overlay` composes all three + the existing `useEscapeKey`. `Modal` and `GalleryFullscreenViewer` render through `Overlay` and stop hand-managing Escape.

---

## R4 — Overlay material & depth (apple-design §12, §14)

**Decision**: `Overlay` renders a dimming scrim + a blurred backdrop layer:
- Scrim: `bg-stone-950/60` (dark, "dim to focus" for a modal task — a blocking overlay pairs dimming with push-back).
- Blur: `backdrop-blur-md backdrop-saturate-150` on the scrim element (Tailwind v4 utilities).
- Surface elevation: overlay content keeps `shadow-xl`/`shadow-2xl` per the constitution's "floating elements" reservation.
- **Materialize, don't just fade** (apple-design §12): on enter, animate blur radius + scale together (`spring.default`) not a bare opacity fade — for the center modal, scale from `0.96 → 1` + opacity, transform-origin at the trigger where feasible (`emil`: modals stay centered, so origin-at-trigger is a light touch, not full popover behavior); for the drawer, slide along its own axis (enter and exit on the **same path** — apple-design §7).

**Fallbacks**:
- `@supports not (backdrop-filter: blur(1px))` → scrim opacity raised to `/80`, no blur.
- `@media (prefers-reduced-transparency: reduce)` → solid scrim (`bg-stone-950/95`), `backdrop-filter: none`.
- `@media (prefers-contrast: more)` → solid scrim + a defined `1px` contrasting border on the overlay surface.

**Contrast (FR-009 / SC-005)**: overlay text/controls sit on the **opaque** overlay surface (`Card` `bg-stone-50 dark:bg-surface-raised`), never directly on the translucent layer, so existing spec-058 contrast pairings hold. `e2e/helpers/contrast.ts` gets an over-blur assertion that screenshots the worst-case (busy cover art behind) and confirms the surface + text still measure ≥ 4.5:1.

---

## R5 — Sticky header / toolbar translucency (documented conflict decision)

**Decision**: **Do not** convert `AppHeader` / `LandingHeader` to translucent `backdrop-filter` chrome in this feature. Keep the opaque `bg-white dark:bg-surface-raised` + bottom border.

**Rationale**: apple-design §12 favors translucent chrome, but the constitution's "Dark mode's primary and elevated surfaces MUST use the brand's near-black tokens (`--color-surface`, `--color-surface-raised`)" and the spec-058 border-contrast decisions are explicit, tested rules. Principle XI **subordinates to** the Tailwind rules where they conflict. A translucent header also risks the WCAG 1.4.11 border/boundary contrast that spec 058 spent effort fixing. The header instead gets the **scroll-edge treatment** as a lighter touch: replace the hard 1px bottom border with a subtle shadow/gradient mask that only appears once content scrolls under it (apple-design §12 "scroll edge effects, not hard dividers") — this is in-scope for US5 and keeps the near-black token as the surface.

---

## R6 — Typography tracking & leading (apple-design §15)

**Decision**: Add size-specific tracking + leading tokens to `@theme`, applied to the display-typeface headings the constitution already defines (`--font-display` / Anton: page headers, pillar/section headers, showcase titles):

| Token | Value | Applies to |
|-------|-------|-----------|
| `--tracking-display` | `-0.02em` | Anton headings (negative tracking as large text grows) |
| `--leading-display` | `1.05` | Anton headings (tight leading for large text) — pairs with the existing fixed `text-*`/`leading-*` no-layout-shift rule |
| `--tracking-body` | `0` (unchanged) | body — left at browser default |

Body hierarchy stays weight/size/color only. **Remove decoration-as-emphasis**: audit surfaces `className="underline"` / `text-sm underline` used for emphasis (e.g. `Recordcard` "Open record", some inline links) and replaces with `text-primary dark:text-primary-text font-medium` (link) or weight/color (emphasis) — underline is retained only for genuine inline text links where removing it would hurt affordance, per WCAG. No change to `VinylmaniaWordmark`.

---

## R7 — Drag-to-dismiss thresholds (clarification 2026-09-05)

**Decision** (constants in `motion/tokens.ts`):
- `DISMISS_DISTANCE_RATIO = 0.45` — released past 45% of the sheet's extent in the dismiss direction → dismiss.
- `DISMISS_VELOCITY = 500` (px/s) — released with outward velocity ≥ 500 px/s → dismiss regardless of distance (a flick).
- Otherwise → `spring.sheet` back to fully open.
- Rubber-band on the non-dismiss direction via `dragElastic={0.15}` (apple-design §9).
- **Scroll disambiguation** (FR-011): the drag handle is the sheet header / a top grab area; a drag starting inside scrollable content only initiates dismissal when that content is at its scroll-top boundary (`scrollTop === 0`) and the drag is downward/outward — otherwise the gesture scrolls.
- **Momentum projection** for the gallery swipe (apple-design §6): project the release point with `project(v, 0.998)` and snap to the nearest image index.

---

## R8 — Gallery swipe (FR-012)

**Decision**: Wrap the gallery main image in a horizontal `drag="x"` `m.div` with `dragConstraints` locked to 0 (no free translate) and `onDragEnd` deciding prev/next from offset (> 45% width) or velocity (≥ 500 px/s), animating the swap with `spring.momentum`. Thumbnails and keyboard arrow support (existing thumbnail `<button>`s, plus add `ArrowLeft`/`ArrowRight` on the viewer) stay as the non-gesture path (FR-013). `AnimatePresence` with a directional slide keyed on `selectedIndex`.

---

## R9 — Consistent interaction patterns (FR-014, US5)

Audit-driven; the canonical set:
- **Binary switch**: `role="switch"` + knob spring (`ThemeToggle`). Only for genuine on/off.
- **Segmented selector**: `role="radiogroup"` + roving tabindex + shared-element active pill (`ViewModeToggle`); reused for any 2–4 exclusive named options.
- **Multi-select list**: checkboxes / selectable rows (`SelectableListFilter`, `Checkbox`).
- **Disclosure**: one expand/collapse motion (`--motion-duration-collapse`, chevron rotate) for `CollapsibleFilterPanel` and any future accordion.
- **Dismissible layer**: `Overlay` + optional `Sheet` — one material, one Escape/backdrop/gesture behavior, one focus contract.
- **Focus indicator**: the existing `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` promoted to a single shared class (`focusRing` in a `motion`/`ui` helper or a `@utility`) and applied everywhere, replacing the three historical variants noted in the `Button`/`StarRating` comments.

---

## R10 — Testing interruptibility & 60 fps

- **Interruptibility (SC-003)**: Playwright — open the modal, `dispatchEvent` the close during the enter animation (or drag the drawer partway then reverse), assert no computed-transform discontinuity by sampling `getBoundingClientRect()` across `requestAnimationFrame` ticks and checking monotonic / bounded deltas; assert the element never jumps to its start/end transform in a single frame.
- **60 fps (SC-010)**: Playwright with CDP `Emulation.setCPUThrottlingRate(4)`; use `page.evaluate` + `PerformanceObserver('long-animation-frame')` / rAF timing during a transition; assert p95 frame interval ≤ ~20 ms (allowing minor CI noise around the 16.7 ms target) or that the component fell back (a `data-motion-reduced` marker) — mirrors how spec 058 handled platform-variance in CI.
- **Reduced motion (SC-004)**: Playwright `emulateMedia({ reducedMotion: 'reduce' })` — assert every animated element's `transform` is `none` mid-transition and skeletons have `animation-name: none`.
- **Press (SC-001)**: `page.mouse.down()` without `up`, assert the pressed-state class/computed `transform` is applied before mouseup.
- Component-level (Vitest): tokens exist and are referenced; `Overlay` traps focus, restores focus, locks scroll (jsdom); reduced-motion prop path renders without spring config.

---

## Open feel-checks (flagged per `animate` skill — verify on device, not from code)

1. Modal enter: blur+scale materialize vs. plain fade — check at 3× speed and on a real phone.
2. Drawer drag-release bounce (`spring.momentum` bounce 0.2) — confirm it reads as "thrown", not "wobbly".
3. Shared-element pill on `ViewModeToggle` — confirm no text reflow jitter during the slide.
4. Gallery swipe direction + momentum projection — confirm it doesn't overshoot by two images on a hard flick.
5. Header scroll-edge mask — confirm it appears only on scroll and doesn't shimmer.
