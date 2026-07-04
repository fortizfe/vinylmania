import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

import { Button } from './Button';
import { Card } from './Card';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: 'center' | 'end';
}

const backdropPositionClasses: Record<NonNullable<ModalProps['position']>, string> = {
  center: 'items-center justify-center p-4',
  end: 'justify-end',
};

const dialogPositionClasses: Record<NonNullable<ModalProps['position']>, string> = {
  center: 'max-h-[90vh] w-full max-w-lg overflow-y-auto',
  end: 'h-dvh w-full max-w-xs overflow-y-auto rounded-none',
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function Modal({ open, onClose, title, children, position = 'center' }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
        className={dialogPositionClasses[position]}
      >
        <Card className="h-full overflow-y-auto">
          <div className="mb-4 flex items-center justify-between gap-4">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
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
