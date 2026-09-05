# Contract: `frontend/src/motion/` — shared motion & overlay layer

The **only** module that imports `motion`. Everything else in `frontend/` depends on this API (FR-006a, Constitution IV).

---

## `tokens.ts`

```ts
export const spring = {
  default:  { type: 'spring', duration: 0.4,  bounce: 0 },   // UI, no overshoot
  sheet:    { type: 'spring', duration: 0.35, bounce: 0 },    // sheet settle after drag
  momentum: { type: 'spring', duration: 0.5,  bounce: 0.2 },  // flick / drag-release only
} as const;

export const motionDuration = {
  press: 130, fade: 200, collapse: 200, drawer: 250,          // ms
} as const;

export const easing = {
  out:     'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut:   'cubic-bezier(0.77, 0, 0.175, 1)',
  drawer:  'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

export const dismiss = {
  distanceRatio: 0.45,   // fraction of sheet extent
  velocity: 500,         // px/s outward
  elastic: 0.15,         // rubber-band on non-dismiss axis
} as const;
```

**Guarantees**: values are frozen (`as const`); they mirror the CSS custom properties in `global.css` exactly (a Vitest test asserts parity by reading both).

---

## `MotionProvider`

```tsx
<MotionProvider>{children}</MotionProvider>
```

- Wraps children in `<LazyMotion features={domAnimation} strict>` + `<MotionConfig reducedMotion="user">`.
- `strict` forces use of the `m` component (no full `motion` component) — keeps the bundle small and is a lint-style guard.
- Mounted once, alongside `ThemeProvider`, above the router.
- **Contract**: with `reducedMotion="user"`, every `m` element automatically drops `transform`/`layout` animations when `prefers-reduced-motion: reduce`, animating only `opacity`. Components still must not *depend* on motion for meaning.

---

## `Overlay`

```tsx
interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** 'center' = dialog scale-in; 'end' = side drawer slide-in. */
  variant: 'center' | 'end';
  /** Element to return focus to on close. Defaults to the element focused when `open` became true. */
  restoreFocusRef?: React.RefObject<HTMLElement>;
  labelledBy?: string;   // id of the title element for aria-labelledby
  children: React.ReactNode;
}
```

**Behavioral guarantees**:
1. Renders `role="dialog" aria-modal="true"` on the surface; `aria-labelledby` when `labelledBy` given.
2. **Focus trap** while `open` — `Tab`/`Shift+Tab` cycle only within the surface (`useFocusTrap`).
3. **Focus restore** — focus returns to `restoreFocusRef` or the captured `activeElement` on any close path (`useRestoreFocus`).
4. **Scroll lock** — `document.body` scroll disabled while open, scrollbar-width compensated (no layout shift), reference-counted for nested overlays (`useScrollLock`).
5. **Escape** and **scrim click** call `onClose` (`useEscapeKey` + scrim `onPointerDown`).
6. **Material**: scrim = `bg-stone-950/60 backdrop-blur-md backdrop-saturate-150`; surface uses `<Card>` + `shadow-xl` (end) / `shadow-2xl` (center).
7. **Motion** via `AnimatePresence`: `center` → scale `0.96→1` + opacity + scrim blur/opacity, `spring.default`; `end` → slide on its own axis, `spring.sheet` / `easing.drawer`. Exit mirrors enter. Interruptible (re-open during exit continues from current value — `motion` default).
8. **Fallbacks**: `@supports not (backdrop-filter)` → scrim `/80` no blur; `prefers-reduced-transparency` → `/95` solid; `prefers-reduced-motion` → opacity-only `motionDuration.fade`, no transform.
9. Contrast: children render on the opaque `<Card>` surface; `Overlay` never places interactive content on the scrim.

---

## `Sheet` (composes `Overlay variant="end"`)

```tsx
interface SheetProps extends Omit<OverlayProps, 'variant'> {
  /** Axis the sheet is dismissed along. */
  dismissAxis: 'x' | 'y';
  /** Optional visible grab handle rendered at the leading edge. */
  showHandle?: boolean;
  children: React.ReactNode;
}
```

**Behavioral guarantees** (in addition to `Overlay`'s):
1. **1:1 drag** from the grab offset along `dismissAxis` (`m.div drag`, `dragElastic={dismiss.elastic}` on the non-dismiss direction only).
2. **Release decision**: dismiss if `offset >= dismiss.distanceRatio * extent` **OR** `|velocity| >= dismiss.velocity` in the outward direction; else spring back to open (`spring.sheet`). Dismiss animates with `spring.momentum` carrying release velocity.
3. **Scroll disambiguation**: a drag starting on scrollable content only dismisses when that content is at its scroll boundary in the drag direction; otherwise the browser scrolls (drag not captured).
4. **Parity**: the button (`Overlay`'s close affordance) and keyboard (`Escape`) paths are always present and unaffected (FR-013).
5. **Reduced motion**: drag still tracks 1:1; the settle/dismiss becomes an instant/`motionDuration.fade` snap, no spring.

---

## Hooks (hand-rolled, no dependency)

| Hook | Signature | Guarantee |
|------|-----------|-----------|
| `useFocusTrap` | `(ref: RefObject<HTMLElement>, active: boolean) => void` | While `active`: focus enters the container, `Tab` wraps at both ends, no focusable outside is reachable. No-op when inactive. |
| `useScrollLock` | `(active: boolean) => void` | While `active`: body scroll locked, scrollbar gutter compensated, ref-counted. Restores exact prior state. |
| `useRestoreFocus` | `(active: boolean, ref?: RefObject<HTMLElement>) => void` | Captures `activeElement` on `active` rising edge; restores on falling edge / unmount if the target is still connected. |

Each has its own Vitest suite (jsdom) written before implementation (Principle I).

---

## What this layer does **not** provide

- No generic `<AnimatedList>` / page-transition system (YAGNI — not in spec scope).
- No haptics/audio (apple-design §13 is noted but out of scope; `navigator.vibrate` may be added later).
- No animation for keyboard-initiated actions (emil framework — those stay instant).
