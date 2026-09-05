import { useRef, type ReactNode } from 'react';
import { m } from 'motion/react';

import { Overlay, type OverlayProps } from './Overlay';
import { dismiss } from './tokens';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** The subset of `motion`'s drag callback info this primitive relies on. */
interface DragInfo {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

export interface SheetProps extends Omit<OverlayProps, 'variant'> {
  /** Axis the sheet is dismissed along. */
  dismissAxis: 'x' | 'y';
  /** Optional visible grab handle rendered at the leading edge. */
  showHandle?: boolean;
  children: ReactNode;
}

interface ReleaseInput {
  /** Absolute outward displacement along the dismiss axis, in px (≥ 0). */
  offset: number;
  /** Signed velocity along the dismiss axis, px/s. Outward is positive. */
  velocity: number;
  /** The sheet's size along the dismiss axis, in px. */
  extent: number;
}

/**
 * Release decision for a drag-to-dismiss sheet (research.md R7 / FR-011):
 * dismiss when released past `dismiss.distanceRatio` of the sheet's extent
 * OR with outward velocity ≥ `dismiss.velocity`; otherwise spring back.
 * Both thresholds are inclusive.
 */
export function shouldDismissSheet({ offset, velocity, extent }: ReleaseInput): boolean {
  if (offset <= 0 && velocity <= 0) return false;
  const draggedFarEnough = extent > 0 && offset >= dismiss.distanceRatio * extent;
  const flickedOutward = velocity >= dismiss.velocity;
  return draggedFarEnough || flickedOutward;
}

/**
 * A drawer that also dismisses by 1:1 drag along `dismissAxis`. Composes
 * `Overlay variant="end"`, so the scrim, focus trap, focus restore, scroll
 * lock, Escape and any in-content close button all behave identically to a
 * non-gesture overlay (FR-013).
 *
 * This is the foundational primitive: 1:1 drag + release decision are wired
 * here. The deeper gesture polish — scroll-boundary disambiguation and
 * release-velocity hand-off tuning — lands in US4 (T071–T072).
 */
export function Sheet({
  dismissAxis,
  showHandle,
  children,
  ...overlayProps
}: SheetProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  function handleDragEnd(_event: unknown, info: DragInfo) {
    const node = dragRef.current;
    const extent =
      dismissAxis === 'x' ? (node?.offsetWidth ?? 0) : (node?.offsetHeight ?? 0);
    const rawOffset = dismissAxis === 'x' ? info.offset.x : info.offset.y;
    const rawVelocity = dismissAxis === 'x' ? info.velocity.x : info.velocity.y;

    // The drawer is end-anchored, so "outward" is the positive direction.
    if (
      shouldDismissSheet({
        offset: Math.max(0, rawOffset),
        velocity: rawVelocity,
        extent,
      })
    ) {
      overlayProps.onClose();
    }
  }

  return (
    <Overlay {...overlayProps} variant="end">
      <m.div
        ref={dragRef}
        drag={reduceMotion ? false : dismissAxis}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          [dismissAxis === 'x' ? 'right' : 'bottom']: dismiss.elastic,
        }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        className="flex h-full flex-col"
      >
        {showHandle && (
          <div
            data-testid="sheet-handle"
            aria-hidden="true"
            className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-stone-400 dark:bg-stone-600"
          />
        )}
        {children}
      </m.div>
    </Overlay>
  );
}
