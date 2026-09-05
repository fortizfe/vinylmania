/**
 * `frontend/src/motion/` — the shared motion & overlay layer.
 *
 * This is the ONLY module in the frontend that may import the `motion`
 * gesture/animation library (spec 059 FR-006a, Constitution IV). Components
 * and pages consume the primitives and tokens re-exported here — never the
 * library directly. `tests/unit/architecture/motion-import-boundary.test.ts`
 * enforces the boundary.
 */

export { dismiss, easing, motionDuration, spring } from './tokens';
export type { SpringToken } from './tokens';

export { MotionProvider } from './MotionProvider';
export { Overlay } from './Overlay';
export type { OverlayProps } from './Overlay';
export { Sheet, shouldDismissSheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { useFocusTrap } from './useFocusTrap';
export { useScrollLock } from './useScrollLock';
export { useRestoreFocus } from './useRestoreFocus';
export { usePrefersReducedMotion } from './usePrefersReducedMotion';
