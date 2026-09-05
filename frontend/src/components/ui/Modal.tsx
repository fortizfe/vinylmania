import { useId, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';

import { Overlay } from '../../motion';
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
 * (spec 059, contracts/component-api-changes §Modal). Public props are
 * unchanged; every existing call site keeps working.
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

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant={position}
      labelledBy={title ? titleId : undefined}
      restoreFocusRef={restoreFocusRef}
      scrimTestId="modal-backdrop"
      surfaceClassName={clsx(
        position === 'end' ? 'rounded-none' : centerSizeClasses[size],
        hideScrollbar && 'scrollbar-hidden',
      )}
    >
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
    </Overlay>
  );
}
