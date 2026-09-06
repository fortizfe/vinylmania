import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RemoveFromWantlistDialog } from '../../src/components/RemoveFromWantlistDialog';

interface HarnessProps {
  onConfirm?: () => void;
  onClose?: () => void;
  error?: boolean;
  removing?: boolean;
}

/**
 * Mirrors the real call site: a trigger button owns the open state so we can
 * assert focus returns to it on close.
 */
function Harness({ onConfirm, onClose, error, removing }: HarnessProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open remove dialog
      </button>
      <RemoveFromWantlistDialog
        open={open}
        releaseTitle="Homework"
        removing={removing}
        error={error}
        onConfirm={() => {
          onConfirm?.();
        }}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      />
    </>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /open remove dialog/i }));
  return screen.getByRole('dialog');
}

describe('RemoveFromWantlistDialog', () => {
  it('stays hidden until it is opened', () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes an accessible dialog naming the destructive action', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const dialog = await openDialog(user);

    expect(dialog).toHaveAccessibleName(/remove from wishlist\?/i);
    expect(within(dialog).getByText(/homework/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/removes it from your discogs wantlist too/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^remove$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('calls onConfirm when the Remove button is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^remove$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('dismisses via Cancel without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<Harness onConfirm={onConfirm} onClose={onClose} />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses via Escape without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<Harness onConfirm={onConfirm} onClose={onClose} />);

    await openDialog(user);
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('surfaces a retryable error as an alert', async () => {
    const user = userEvent.setup();
    render(<Harness error />);

    const dialog = await openDialog(user);

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      /couldn't remove it right now\. please try again\./i,
    );
  });

  it('traps focus inside the dialog and restores it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: /open remove dialog/i });
    const dialog = await openDialog(user);

    // Focus moved into the dialog on open.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tabbing cycles without ever leaving the dialog.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
