import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { AnimatePresence, m, type DragControls, type PanInfo } from 'motion/react';
import clsx from 'clsx';

import { useEscapeKey } from '../hooks/useEscapeKey';
import { Card } from '../components/ui/Card';
import { motionDuration, spring, type SpringToken } from './tokens';
import { useFocusTrap } from './useFocusTrap';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useRestoreFocus } from './useRestoreFocus';
import { useScrollLock } from './useScrollLock';

/**
 * `easing.out` (`cubic-bezier(0.23, 1, 0.32, 1)`) as a control-point tuple —
 * `motion` rejects the CSS string form for `ease`. Same value as the
 * `--ease-out` custom property / `easing.out` token (parity checked by
 * `tokens.test.ts`); kept as a local literal exactly like
 * `CollapsibleFilterPanel`.
 */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Default backdrop-blur radius for the scrim material (Tailwind `backdrop-blur-md`). */
const DEFAULT_BLUR_PX = 12;

export interface OverlayScrimMaterial {
  /**
   * Tailwind classes for the scrim's dim colour (and any non-blur material).
   * Replaces the default `bg-stone-950/60`; keep it a single opaque-ish dim
   * so overlay content never sits on two stacked translucent layers
   * (apple-design §12).
   */
  className?: string;
  /** Backdrop blur radius in px. Defaults to 12 (`backdrop-blur-md`). */
  blurPx?: number;
}

/**
 * Makes the opaque surface itself draggable, so a drawer can be dismissed by
 * a 1:1 drag (spec 059 US4). Supplied only by `Sheet` — every other consumer
 * leaves it undefined and gets a static surface. The surface still animates
 * to its `open` position (`x: 0` / `y: 0`) whenever a drag ends without a
 * dismiss, so the spring-back is `motion`'s constraint animation on
 * `spring.sheet`.
 */
export interface OverlaySurfaceDrag {
  /** Axis the surface may be dragged along. */
  axis: 'x' | 'y';
  /** Drag is started imperatively (see `onPointerDown`) so the scroll-boundary guard can veto it. */
  controls: DragControls;
  /**
   * Called on pointer-down on the surface. `Sheet` decides here whether to
   * begin the drag (`controls.start(event)`) or let the browser scroll the
   * content (FR-011).
   */
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Release decision — `Sheet` compares offset/velocity against `tokens.dismiss`. */
  onDragEnd: (event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => void;
  /** Per-edge rubber-band: 1 on the outward (dismiss) edge for 1:1 tracking, `dismiss.elastic` elsewhere. */
  elastic: Record<'top' | 'right' | 'bottom' | 'left', number>;
}

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** 'center' = dialog scale-in; 'end' = side drawer slide-in. */
  variant: 'center' | 'end';
  /**
   * Element to return focus to on close. Defaults to the element focused
   * when `open` became true.
   */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** id of the title element, for `aria-labelledby`. */
  labelledBy?: string;
  /**
   * Accessible name for the dialog when there is no visible title element to
   * point `labelledBy` at (e.g. the fullscreen gallery). Ignored when
   * `labelledBy` is given.
   */
  ariaLabel?: string;
  /** `data-testid` for the animating surface element. */
  surfaceTestId?: string;
  /**
   * Overrides the surface exit transition — `Sheet` sets `spring.momentum`
   * when the drawer was flung shut so the dismissal carries the release
   * energy (apple-design §4). Default keeps the per-variant transition.
   */
  exitTransition?: SpringToken;
  /** When set, the surface is draggable for a drag-to-dismiss sheet. */
  surfaceDrag?: OverlaySurfaceDrag;
  /** Extra classes for the opaque surface (e.g. a consumer's own width). */
  surfaceClassName?: string;
  /**
   * Inline style for the animating surface element — used for a
   * source-anchored `transform-origin` (apple-design §7; e.g. the tapped
   * gallery thumbnail). Modals stay centred and pass nothing.
   */
  surfaceStyle?: CSSProperties;
  /**
   * `'card'` (default) wraps children in the design-system `<Card>` — the
   * opaque floating surface every dialog/drawer needs. `'bare'` renders
   * children directly for a full-bleed immersive consumer
   * (`GalleryFullscreenViewer`) that supplies its own surface treatment.
   */
  surface?: 'card' | 'bare';
  /** Scrim material overrides (dim colour + blur radius). */
  scrim?: OverlayScrimMaterial;
  /**
   * `data-testid` for the scrim element. Defaults to `overlay-scrim`;
   * consumers (e.g. `Modal`) may keep their historical id for existing tests.
   */
  scrimTestId?: string;
  children: ReactNode;
}

const positionClasses: Record<OverlayProps['variant'], string> = {
  center: 'items-center justify-center p-4',
  end: 'justify-end',
};

// Layout only — a consumer supplies its own max-width via `surfaceClassName`
// (e.g. `Modal`'s `size`). `center` falls back to `max-w-lg` when the
// consumer names no width.
const surfaceSizeClasses: Record<OverlayProps['variant'], string> = {
  center: 'max-h-[90vh] w-full overflow-y-auto',
  end: 'h-dvh w-full max-w-xs overflow-y-auto',
};

function hasMaxWidth(className: string | undefined): boolean {
  return !!className && /(?:^|\s)max-w-/.test(className);
}

export function Overlay({
  open,
  onClose,
  variant,
  restoreFocusRef,
  labelledBy,
  surfaceClassName,
  surfaceStyle,
  surface = 'card',
  scrim,
  scrimTestId = 'overlay-scrim',
  ariaLabel,
  surfaceTestId,
  exitTransition,
  surfaceDrag,
  children,
}: OverlayProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  // Order matters: capture the opener BEFORE the focus trap moves focus in.
  useRestoreFocus(open, restoreFocusRef);
  useEscapeKey(onClose, open);
  useFocusTrap(surfaceRef, open);
  useScrollLock(open);

  const bare = surface === 'bare';
  const scrimDimClassName = scrim?.className ?? 'bg-stone-950/60';
  const blurPx = scrim?.blurPx ?? DEFAULT_BLUR_PX;
  const blurredFilter = `blur(${blurPx}px) saturate(1.5)`;

  // Materialize (apple-design §12): the scrim's blur + dim ramp in together
  // with the surface's scale — not a bare opacity fade. Exit mirrors enter.
  // The `.overlay-scrim` / `.overlay-surface` fallback blocks in global.css
  // override this inline `backdropFilter` (`!important`) under
  // `prefers-reduced-transparency` / `prefers-contrast`, and unsupported
  // browsers ignore it entirely (with the `@supports` block raising the dim).
  const scrimMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.001 },
        style: { backdropFilter: blurredFilter, WebkitBackdropFilter: blurredFilter },
      }
    : {
        initial: { opacity: 0, backdropFilter: 'blur(0px) saturate(1)' },
        animate: { opacity: 1, backdropFilter: blurredFilter },
        exit: { opacity: 0, backdropFilter: 'blur(0px) saturate(1)' },
        transition: { duration: motionDuration.fade / 1000, ease: EASE_OUT },
      };

  const surfaceMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.001 },
      }
    : variant === 'center'
      ? {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
          transition: spring.default,
        }
      : {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '100%' },
          transition: spring.sheet,
        };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="overlay-scrim"
          data-testid={scrimTestId}
          onClick={onClose}
          {...scrimMotion}
          className={clsx(
            'overlay-scrim fixed inset-0 z-50 flex',
            scrimDimClassName,
            positionClasses[variant],
          )}
        >
          <m.div
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            data-testid={surfaceTestId}
            data-variant={variant}
            data-reduced-motion={reduceMotion ? 'true' : 'false'}
            tabIndex={-1}
            onClick={bare ? undefined : (event) => event.stopPropagation()}
            onPointerDown={surfaceDrag?.onPointerDown}
            style={surfaceStyle}
            {...surfaceMotion}
            {...(exitTransition && !reduceMotion
              ? {
                  exit: {
                    ...(surfaceMotion.exit as Record<string, unknown>),
                    transition: exitTransition,
                  },
                }
              : {})}
            {...(surfaceDrag
              ? {
                  drag: surfaceDrag.axis,
                  dragControls: surfaceDrag.controls,
                  dragListener: false,
                  dragMomentum: false,
                  dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
                  dragElastic: surfaceDrag.elastic,
                  onDragEnd: surfaceDrag.onDragEnd,
                }
              : {})}
            className={clsx(
              !bare && surfaceSizeClasses[variant],
              !bare &&
                variant === 'center' &&
                !hasMaxWidth(surfaceClassName) &&
                'max-w-lg',
              bare && 'overlay-surface',
              surfaceClassName,
            )}
          >
            {bare ? (
              children
            ) : (
              <Card
                className={clsx(
                  'overlay-surface h-full',
                  variant === 'center' ? 'shadow-2xl' : 'shadow-xl',
                )}
              >
                {children}
              </Card>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
