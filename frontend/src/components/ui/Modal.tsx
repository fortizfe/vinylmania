import { useEffect, type ReactNode } from 'react';

import { Button } from './Button';
import { Card } from './Card';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function Modal({ open, onClose, title, children }: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
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
