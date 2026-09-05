import { useRef, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, m } from 'motion/react';
import clsx from 'clsx';

import { useEscapeKey } from '../hooks/useEscapeKey';
import { Card } from '../components/ui/Card';
import { spring } from './tokens';
import { useFocusTrap } from './useFocusTrap';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useRestoreFocus } from './useRestoreFocus';
import { useScrollLock } from './useScrollLock';

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.001 : 0.2 }}
          className={clsx(
            'overlay-scrim fixed inset-0 z-50 flex bg-stone-950/60 backdrop-blur-md backdrop-saturate-150',
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
            onClick={(event) => event.stopPropagation()}
            {...surfaceMotion}
            className={clsx(
              surfaceSizeClasses[variant],
              variant === 'center' && !hasMaxWidth(surfaceClassName) && 'max-w-lg',
              surfaceClassName,
            )}
          >
            <Card
              className={clsx(
                'overlay-surface h-full',
                variant === 'center' ? 'shadow-2xl' : 'shadow-xl',
              )}
            >
              {children}
            </Card>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
