/**
 * Isolated entry point for `LazyMotion`'s async feature loading. Importing
 * this module in its own chunk (via `() => import('./motionFeatures')`) keeps
 * the `motion` feature bundle out of the initial payload — only the tiny `m`
 * component shell ships eagerly (research.md R1).
 *
 * Feature set: `domMax` (not `domAnimation`). The spec's 2026-09-05
 * clarification authorised "one focused motion/gesture library" and
 * FR-010 / FR-012 require the `drag` gesture, which lives in the `domMax`
 * bundle. `domMax` also unlocks `layoutId`; components must still not adopt
 * `layout`/`layoutId` casually — the shared-element pill in `ViewModeToggle`
 * deliberately stays a measured-transform animation.
 */
export { domMax as default } from 'motion/react';
