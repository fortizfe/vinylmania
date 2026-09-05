import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useDragControls, type PanInfo } from 'motion/react';

import { Overlay, type OverlayProps, type OverlaySurfaceDrag } from './Overlay';
import { dismiss, spring } from './tokens';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface SheetProps extends Omit<OverlayProps, 'variant' | 'surfaceDrag'> {
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
 * Scroll-boundary disambiguation (FR-011). A drag that begins on scrollable
 * overlay content must only start a dismissal when that content is already
 * at its boundary in the drag direction — otherwise the browser scrolls it.
 *
 * The end-anchored sheet dismisses *outward* (positive axis), so the
 * relevant boundary is the scroll origin: `scrollTop === 0` for a `y` sheet,
 * `scrollLeft === 0` for an `x` drawer. A `null` element means the drag did
 * not begin on a scroll container, so nothing blocks the dismissal.
 *
 * @returns `true` when the content should scroll instead of the sheet dismissing.
 */
export function scrollBlocksDismiss(
  scrollEl: Pick<HTMLElement, 'scrollTop' | 'scrollLeft'> | null,
  dismissAxis: 'x' | 'y',
): boolean {
  if (!scrollEl) return false;
  return dismissAxis === 'y' ? scrollEl.scrollTop > 0 : scrollEl.scrollLeft > 0;
}

/** The outward edge for a given dismiss axis (end-anchored sheet). */
function outwardEdge(dismissAxis: 'x' | 'y'): 'right' | 'bottom' {
  return dismissAxis === 'x' ? 'right' : 'bottom';
}

/**
 * A drawer that also dismisses by 1:1 drag along `dismissAxis`. Composes
 * `Overlay variant="end"`, so the scrim, focus trap, focus restore, scroll
 * lock, Escape and any in-content close button all behave identically to a
 * non-gesture overlay (FR-013).
 *
 * Drag mechanics (spec 059 US4 T071/T072):
 * - The opaque `Overlay` surface is the draggable element, so the whole
 *   drawer tracks the pointer 1:1 from the grab offset (`dragElastic` is 1
 *   on the outward edge, `dismiss.elastic` — a gentle rubber-band —
 *   everywhere else).
 * - Drag is started imperatively via `useDragControls` so `onPointerDown`
 *   can veto it when the pointer landed on scrollable content that is not at
 *   its boundary (`scrollBlocksDismiss`).
 * - On release, `shouldDismissSheet` decides: dismiss → `onClose()` and the
 *   exit animates on `spring.momentum` (carrying the fling energy); keep →
 *   `motion` springs the surface back to its open position on `spring.sheet`
 *   (the surface's own constraint animation).
 * - Reduced motion: the 1:1 drag still tracks, but `Overlay`'s reduced-motion
 *   surface path makes the settle/dismiss an instant opacity snap, no spring.
 */
export function Sheet({
  dismissAxis,
  showHandle,
  children,
  ...overlayProps
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const reduceMotion = usePrefersReducedMotion();
  const [flungClose, setFlungClose] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // The `end` Overlay surface is itself the scroll container
    // (`overflow-y-auto`); `event.currentTarget` is that surface.
    if (scrollBlocksDismiss(event.currentTarget, dismissAxis)) return;
    dragControls.start(event);
  }

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const node = contentRef.current;
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
      setFlungClose(true);
      overlayProps.onClose();
    }
  }

  const edge = outwardEdge(dismissAxis);
  const surfaceDrag: OverlaySurfaceDrag = {
    axis: dismissAxis,
    controls: dragControls,
    onPointerDown: handlePointerDown,
    onDragEnd: handleDragEnd,
    elastic: {
      top: dismiss.elastic,
      right: dismiss.elastic,
      bottom: dismiss.elastic,
      left: dismiss.elastic,
      [edge]: 1,
    },
  };

  return (
    <Overlay
      {...overlayProps}
      variant="end"
      surfaceTestId="sheet-surface"
      surfaceDrag={surfaceDrag}
      exitTransition={flungClose && !reduceMotion ? spring.momentum : undefined}
    >
      <div ref={contentRef} className="flex h-full flex-col">
        {showHandle && (
          <div
            data-testid="sheet-handle"
            aria-hidden="true"
            className={
              dismissAxis === 'x'
                ? 'absolute top-1/2 left-1.5 h-10 w-1 -translate-y-1/2 rounded-full bg-stone-400 dark:bg-stone-600'
                : 'mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-stone-400 dark:bg-stone-600'
            }
          />
        )}
        {children}
      </div>
    </Overlay>
  );
}
