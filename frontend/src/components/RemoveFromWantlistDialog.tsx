import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface RemoveFromWantlistDialogProps {
  open: boolean;
  /** Shown, quoted, in the confirmation body. */
  releaseTitle: string;
  /** User committed to the removal. */
  onConfirm: () => void;
  /** User dismissed (Cancel / Escape / scrim / close) — no change is made. */
  onClose: () => void;
  /** The Discogs write is in flight. */
  removing?: boolean;
  /** The last removal attempt failed and can be retried. */
  error?: boolean;
}

/**
 * FR-011: a lightweight confirmation before the wishlist-remove writes
 * through to the user's Discogs wantlist. Dismissing it changes nothing.
 *
 * Wraps `ui/Modal`, so the focus trap, focus restoration, Escape / scrim
 * dismissal, background scroll lock and the spring enter/exit motion (with
 * its `prefers-reduced-motion` guard) all come from `motion/Overlay` — no
 * new motion is introduced here (Constitution XI).
 *
 * The confirm button is `primary` (`Button` has no dedicated destructive
 * variant); its destructive nature is carried by the visible "Remove" label,
 * never by colour alone (Constitution X).
 */
export function RemoveFromWantlistDialog({
  open,
  releaseTitle,
  onConfirm,
  onClose,
  removing = false,
  error = false,
}: RemoveFromWantlistDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Remove from wishlist?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Remove &ldquo;{releaseTitle}&rdquo; from your wishlist? This removes it from
          your Discogs wantlist too.
        </p>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            Couldn&apos;t remove it right now. Please try again.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
