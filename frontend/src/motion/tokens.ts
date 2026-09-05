/**
 * Motion tokens — the single source of truth for every animated component
 * (spec 059 FR-006). No component defines its own curve/duration/spring.
 *
 * These mirror the `--ease-*` / `--motion-duration-*` custom properties in
 * `frontend/src/styles/global.css` exactly; `tests/unit/motion/tokens.test.ts`
 * fails if the two drift. Values come from research.md R2 — do not invent
 * new curves or durations.
 *
 * Every object is `Object.freeze`d so a consumer cannot mutate shared motion
 * config at runtime.
 */

/** JS spring configs for `motion` (`m`) elements. */
export const spring = Object.freeze({
  /** UI springs with no overshoot — modal scale, toggle knob, shared-element pill. */
  default: Object.freeze({ type: 'spring', duration: 0.4, bounce: 0 }),
  /** Sheet settle to open/closed after a drag with no momentum. */
  sheet: Object.freeze({ type: 'spring', duration: 0.35, bounce: 0 }),
  /**
   * Drag-release fling (dismiss / gallery image change). Bounce is non-zero
   * ONLY here — a flick preceded it (apple-design §4).
   */
  momentum: Object.freeze({ type: 'spring', duration: 0.5, bounce: 0.2 }),
} as const);

/** CSS transition durations, in milliseconds. */
export const motionDuration = Object.freeze({
  press: 130,
  fade: 200,
  collapse: 200,
  drawer: 250,
} as const);

/** CSS easing curves (also exposed as Tailwind `ease-*` utilities). */
export const easing = Object.freeze({
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const);

/** Drag-to-dismiss thresholds for `Sheet` (research.md R7). */
export const dismiss = Object.freeze({
  /** Released past this fraction of the sheet's extent → dismiss. */
  distanceRatio: 0.45,
  /** Released with outward velocity ≥ this (px/s) → dismiss regardless of distance. */
  velocity: 500,
  /** Rubber-band elasticity on the non-dismiss axis. */
  elastic: 0.15,
} as const);

export type SpringToken = (typeof spring)[keyof typeof spring];
