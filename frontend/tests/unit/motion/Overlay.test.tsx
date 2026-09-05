import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MotionProvider } from '../../../src/motion/MotionProvider';
import { Overlay } from '../../../src/motion/Overlay';

function renderOverlay(ui: ReactNode) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  vi.restoreAllMocks();
});

describe('Overlay', () => {
  it('renders an accessible modal dialog when open', () => {
    renderOverlay(
      <Overlay open onClose={() => {}} variant="center">
        <p>Overlay body</p>
      </Overlay>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Overlay body')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderOverlay(
      <Overlay open={false} onClose={() => {}} variant="center">
        <p>Overlay body</p>
      </Overlay>,
    );
    expect(screen.queryByText('Overlay body')).not.toBeInTheDocument();
  });

  it('wires aria-labelledby when labelledBy is provided', () => {
    renderOverlay(
      <Overlay open onClose={() => {}} variant="center" labelledBy="overlay-title">
        <h2 id="overlay-title">Titled overlay</h2>
      </Overlay>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'overlay-title',
    );
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(
      <Overlay open onClose={onClose} variant="center">
        <p>body</p>
      </Overlay>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the scrim is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(
      <Overlay open onClose={onClose} variant="center">
        <p>body</p>
      </Overlay>,
    );

    await user.click(screen.getByTestId('overlay-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when content inside the surface is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(
      <Overlay open onClose={onClose} variant="center">
        <button type="button">inner action</button>
      </Overlay>,
    );

    await user.click(screen.getByRole('button', { name: 'inner action' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps focus within the surface', async () => {
    const user = userEvent.setup();
    renderOverlay(
      <Overlay open onClose={() => {}} variant="center">
        <button type="button">alpha</button>
        <button type="button">omega</button>
      </Overlay>,
    );

    screen.getByRole('button', { name: 'omega' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'alpha' })).toHaveFocus();
  });

  it('restores focus to the opener on close', () => {
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();
    expect(opener).toHaveFocus();

    const { rerender } = renderOverlay(
      <Overlay open onClose={() => {}} variant="center">
        <button type="button">alpha</button>
      </Overlay>,
    );

    rerender(
      <MotionProvider>
        <Overlay open={false} onClose={() => {}} variant="center">
          <button type="button">alpha</button>
        </Overlay>
      </MotionProvider>,
    );

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('locks body scroll while open and releases it on close', () => {
    const { rerender } = renderOverlay(
      <Overlay open onClose={() => {}} variant="center">
        <p>body</p>
      </Overlay>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <MotionProvider>
        <Overlay open={false} onClose={() => {}} variant="center">
          <p>body</p>
        </Overlay>
      </MotionProvider>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('renders on the reduced-motion path without a spring transition', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    renderOverlay(
      <Overlay open onClose={() => {}} variant="center">
        <p>reduced body</p>
      </Overlay>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-reduced-motion', 'true');
    expect(screen.getByText('reduced body')).toBeInTheDocument();
  });

  it('supports the end (drawer) variant', () => {
    renderOverlay(
      <Overlay open onClose={() => {}} variant="end">
        <p>drawer body</p>
      </Overlay>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-variant', 'end');
  });

  describe('material treatment (US3 / FR-007)', () => {
    it('renders the scrim with the dim + blur material hook classes', () => {
      renderOverlay(
        <Overlay open onClose={() => {}} variant="center">
          <p>body</p>
        </Overlay>,
      );

      const scrim = screen.getByTestId('overlay-scrim');
      // `.overlay-scrim` is the CSS hook the global.css fallback blocks target.
      expect(scrim.className).toMatch(/(^|\s)overlay-scrim(\s|$)/);
      expect(scrim.className).toMatch(/bg-stone-950\/60/);
    });

    it('marks the opaque surface with the floating-element elevation + hook class', () => {
      renderOverlay(
        <Overlay open onClose={() => {}} variant="center">
          <p>body</p>
        </Overlay>,
      );
      const surface = screen.getByRole('dialog').querySelector('.overlay-surface');
      expect(surface).not.toBeNull();
      expect(surface!.className).toMatch(/shadow-2xl/);
    });

    it('uses the drawer elevation (shadow-xl) for the end variant', () => {
      renderOverlay(
        <Overlay open onClose={() => {}} variant="end">
          <p>body</p>
        </Overlay>,
      );
      const surface = screen.getByRole('dialog').querySelector('.overlay-surface');
      expect(surface!.className).toMatch(/shadow-xl/);
    });

    it('lets a consumer override the scrim material (gallery uses a darker dim)', () => {
      renderOverlay(
        <Overlay
          open
          onClose={() => {}}
          variant="center"
          scrim={{ className: 'bg-stone-950/90', blurPx: 4 }}
        >
          <p>body</p>
        </Overlay>,
      );
      const scrim = screen.getByTestId('overlay-scrim');
      expect(scrim.className).toMatch(/bg-stone-950\/90/);
      expect(scrim.className).not.toMatch(/bg-stone-950\/60/);
    });

    it('renders children bare (no Card chrome) when surface="bare"', () => {
      renderOverlay(
        <Overlay
          open
          onClose={() => {}}
          variant="center"
          surface="bare"
          surfaceClassName="bare-surface"
        >
          <p>bare body</p>
        </Overlay>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toMatch(/bare-surface/);
      // No Card wrapper: none of Card's chrome utilities are present.
      expect(dialog.innerHTML).not.toMatch(/bg-stone-50/);
      expect(dialog.innerHTML).not.toMatch(/border-stone-500/);
      expect(screen.getByText('bare body')).toBeInTheDocument();
    });

    it('applies surfaceStyle to the animating surface (thumbnail-anchored origin)', () => {
      renderOverlay(
        <Overlay
          open
          onClose={() => {}}
          variant="center"
          surface="bare"
          surfaceStyle={{ transformOrigin: '20% 30%' }}
        >
          <p>body</p>
        </Overlay>,
      );
      expect(screen.getByRole('dialog')).toHaveStyle({ transformOrigin: '20% 30%' });
    });
  });
});
