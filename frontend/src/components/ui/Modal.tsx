import type { ReactNode } from 'react';
import clsx from 'clsx';

import { useEscapeKey } from '../../hooks/useEscapeKey';
import { Button } from './Button';
import { Card } from './Card';
import { CloseIcon } from './icons/CloseIcon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: 'center' | 'end';
  size?: 'md' | 'lg';
  hideScrollbar?: boolean;
}

const backdropPositionClasses: Record<NonNullable<ModalProps['position']>, string> = {
  center: 'items-center justify-center p-4',
  end: 'justify-end',
};

const centerSizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  position = 'center',
  size = 'md',
  hideScrollbar = false,
}: ModalProps) {
  useEscapeKey(onClose, open);

  if (!open) return null;

  return (
    <div
      data-testid="modal-backdrop"
      className={clsx(
        'fixed inset-0 z-50 flex bg-black/50',
        backdropPositionClasses[position],
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={clsx(
          position === 'end'
            ? 'h-dvh w-full max-w-xs overflow-y-auto rounded-none'
            : clsx('max-h-[90vh] w-full overflow-y-auto', centerSizeClasses[size]),
          hideScrollbar && 'scrollbar-hidden',
        )}
      >
        <Card
          className={clsx('h-full overflow-y-auto', hideScrollbar && 'scrollbar-hidden')}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            {title && (
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
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
        </Card>
      </div>
    </div>
  );
}
