import { useId, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';

import { Overlay, Sheet } from '../../motion';
import { Button } from './Button';
import { CloseIcon } from './icons/CloseIcon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: 'center' | 'end' | 'bottom';
  size?: 'md' | 'lg';
  hideScrollbar?: boolean;
  /** Override the element focus returns to on close (defaults to the opener). */
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

const centerSizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Centered dialog / end-anchored drawer / bottom-anchored sheet. The overlay material, focus trap,
 * focus restoration, background scroll lock, Escape + scrim-click dismissal
 * and the spring enter/exit motion all come from `motion/Overlay`
 * (spec 059, contracts/component-api-changes §Modal). The `end` drawer and
 * the `bottom` sheet (spec 068 D16) additionally route through
 * `motion/Sheet`, so they are drag-to-dismissible on touch — the close button and Escape stay exactly as before (FR-013).
 * Public props are unchanged; every existing call site keeps working.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  position = 'center',
  size = 'md',
  hideScrollbar = false,
  restoreFocusRef,
}: ModalProps) {
  const titleId = useId();

  const body = (
    <div className={clsx('h-full', hideScrollbar && 'scrollbar-hidden')}>
      <div className="mb-4 flex items-center justify-between gap-4">
        {title && (
          <h2
            id={titleId}
            className="text-lg font-semibold text-stone-900 dark:text-stone-100"
          >
            {title}
          </h2>
        )}
        <Button
          size="icon"
          variant="secondary"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto"
        >
          <CloseIcon />
        </Button>
      </div>
      {children}
    </div>
  );

  const sharedProps = {
    open,
    onClose,
    labelledBy: title ? titleId : undefined,
    restoreFocusRef,
    scrimTestId: 'modal-backdrop',
  } as const;

  if (position === 'end' || position === 'bottom') {
    return (
      <Sheet
        {...sharedProps}
        dismissAxis={position === 'bottom' ? 'y' : 'x'}
        showHandle
        surfaceClassName={clsx(
          // The sheet sits flush with the bottom edge, so only its top
          // corners are rounded; the padding clears the home indicator.
          position === 'bottom'
            ? 'rounded-b-none pb-[env(safe-area-inset-bottom)]'
            : 'rounded-none',
          hideScrollbar && 'scrollbar-hidden',
        )}
      >
        {body}
      </Sheet>
    );
  }

  return (
    <Overlay
      {...sharedProps}
      variant="center"
      surfaceClassName={clsx(
        centerSizeClasses[size],
        hideScrollbar && 'scrollbar-hidden',
      )}
    >
      {body}
    </Overlay>
  );
}
