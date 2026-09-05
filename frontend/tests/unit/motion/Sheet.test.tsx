import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MotionProvider } from '../../../src/motion/MotionProvider';
import { Sheet, shouldDismissSheet } from '../../../src/motion/Sheet';

describe('shouldDismissSheet — release decision (spec 059 R7 / FR-011)', () => {
  const extent = 400;

  it('dismisses when dragged past 45% of the sheet extent', () => {
    expect(shouldDismissSheet({ offset: 0.5 * extent, velocity: 0, extent })).toBe(true);
  });

  it('treats exactly 45% as a dismiss (inclusive threshold)', () => {
    expect(shouldDismissSheet({ offset: 0.45 * extent, velocity: 0, extent })).toBe(true);
  });

  it('springs back when released short of 45% and slow', () => {
    expect(shouldDismissSheet({ offset: 0.2 * extent, velocity: 100, extent })).toBe(
      false,
    );
  });

  it('dismisses on a fast outward flick regardless of distance', () => {
    expect(shouldDismissSheet({ offset: 0.1 * extent, velocity: 600, extent })).toBe(
      true,
    );
  });

  it('treats exactly 500 px/s outward as a dismiss (inclusive threshold)', () => {
    expect(shouldDismissSheet({ offset: 0.1 * extent, velocity: 500, extent })).toBe(
      true,
    );
  });

  it('does not dismiss on a fast inward flick', () => {
    expect(shouldDismissSheet({ offset: 0.1 * extent, velocity: -600, extent })).toBe(
      false,
    );
  });

  it('never dismisses with no movement', () => {
    expect(shouldDismissSheet({ offset: 0, velocity: 0, extent })).toBe(false);
  });
});

describe('Sheet — non-gesture parity (FR-013)', () => {
  function renderSheet(onClose: () => void) {
    return render(
      <MotionProvider>
        <Sheet open onClose={onClose} dismissAxis="x" labelledBy="sheet-title">
          <h2 id="sheet-title">Menu</h2>
          <button type="button" onClick={onClose}>
            Close menu
          </button>
        </Sheet>
      </MotionProvider>,
    );
  }

  it('closes via the Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSheet(onClose);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via an in-content close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSheet(onClose);

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders as a labelled drawer dialog', () => {
    renderSheet(vi.fn());
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'sheet-title');
  });
});
