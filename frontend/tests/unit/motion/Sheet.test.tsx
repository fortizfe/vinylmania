import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MotionProvider } from '../../../src/motion/MotionProvider';
import {
  Sheet,
  scrollBlocksDismiss,
  shouldDismissSheet,
} from '../../../src/motion/Sheet';

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

  it('keeps the button + Escape paths working with the drag surface mounted', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MotionProvider>
        <Sheet open onClose={onClose} dismissAxis="x" showHandle labelledBy="sheet-title">
          <h2 id="sheet-title">Menu</h2>
          <button type="button" onClick={onClose}>
            Close menu
          </button>
        </Sheet>
      </MotionProvider>,
    );

    // The draggable surface is present…
    expect(screen.getByTestId('sheet-surface')).toBeInTheDocument();
    // …and the non-gesture paths are unaffected (FR-013).
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders a leading-edge grab handle only when showHandle is set', () => {
    const { rerender } = render(
      <MotionProvider>
        <Sheet open onClose={vi.fn()} dismissAxis="x" labelledBy="t">
          <h2 id="t">Menu</h2>
        </Sheet>
      </MotionProvider>,
    );
    expect(screen.queryByTestId('sheet-handle')).not.toBeInTheDocument();

    rerender(
      <MotionProvider>
        <Sheet open onClose={vi.fn()} dismissAxis="x" showHandle labelledBy="t">
          <h2 id="t">Menu</h2>
        </Sheet>
      </MotionProvider>,
    );
    expect(screen.getByTestId('sheet-handle')).toBeInTheDocument();
  });
});

describe('scrollBlocksDismiss — scroll-boundary disambiguation (FR-011)', () => {
  it('allows dismissal when the drag did not start on scrollable content', () => {
    expect(scrollBlocksDismiss(null, 'y')).toBe(false);
    expect(scrollBlocksDismiss(null, 'x')).toBe(false);
  });

  it('allows a y-axis dismissal only when the content is scrolled to the top', () => {
    expect(scrollBlocksDismiss({ scrollTop: 0, scrollLeft: 0 }, 'y')).toBe(false);
  });

  it('blocks a y-axis dismissal (content scrolls) when not at the top boundary', () => {
    expect(scrollBlocksDismiss({ scrollTop: 120, scrollLeft: 0 }, 'y')).toBe(true);
  });

  it('allows an x-axis dismissal only when the content is at its left boundary', () => {
    expect(scrollBlocksDismiss({ scrollTop: 0, scrollLeft: 0 }, 'x')).toBe(false);
    expect(scrollBlocksDismiss({ scrollTop: 40, scrollLeft: 0 }, 'x')).toBe(false);
  });

  it('blocks an x-axis dismissal when the content is scrolled horizontally', () => {
    expect(scrollBlocksDismiss({ scrollTop: 0, scrollLeft: 24 }, 'x')).toBe(true);
  });
});
