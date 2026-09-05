import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, m } from 'motion/react';
import clsx from 'clsx';

import { useEscapeKey } from '../hooks/useEscapeKey';
import { Card } from '../components/ui/Card';
import { motionDuration, spring } from './tokens';
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
            data-variant={variant}
            data-reduced-motion={reduceMotion ? 'true' : 'false'}
            tabIndex={-1}
            onClick={bare ? undefined : (event) => event.stopPropagation()}
            style={surfaceStyle}
            {...surfaceMotion}
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
