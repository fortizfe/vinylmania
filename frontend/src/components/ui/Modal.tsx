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
  position?: 'center' | 'end';
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
 * Centered dialog / end-anchored drawer. The overlay material, focus trap,
 * focus restoration, background scroll lock, Escape + scrim-click dismissal
 * and the spring enter/exit motion all come from `motion/Overlay`
 * (spec 059, contracts/component-api-changes §Modal). The `end` drawer
 * additionally routes through `motion/Sheet`, so it is drag-to-dismissible
 * on touch — the close button and Escape stay exactly as before (FR-013).
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

  if (position === 'end') {
    return (
      <Sheet
        {...sharedProps}
        dismissAxis="x"
        showHandle
        surfaceClassName={clsx('rounded-none', hideScrollbar && 'scrollbar-hidden')}
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
