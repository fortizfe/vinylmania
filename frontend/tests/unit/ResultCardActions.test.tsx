import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResultCardActions } from '../../src/components/ResultCardActions';

const baseProps = {
  onAdd: () => {},
  adding: false,
  added: false,
  onAddToWantlist: () => {},
  addingToWantlist: false,
  inWantlist: false,
};

describe('ResultCardActions', () => {
  it('renders the add action', () => {
    render(<ResultCardActions {...baseProps} />);

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
  });

  it('the add action inherits the shared pressed-state, suppressed while disabled (US1)', () => {
    const { rerender } = render(<ResultCardActions {...baseProps} />);
    const button = screen.getByRole('button', { name: /add to library/i });
    expect(button.className).toMatch(/active:scale-\[0\.97\]/);
    expect(button.className).toMatch(/disabled:active:scale-100/);

    rerender(<ResultCardActions {...baseProps} added />);
    expect(screen.getByRole('button', { name: /added to library/i })).toBeDisabled();
  });

  it('calls onAdd when activated', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ResultCardActions {...baseProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /add to library/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a busy state on the add action while adding, and stays disabled', () => {
    render(<ResultCardActions {...baseProps} adding />);

    const addButton = screen.getByRole('button', { name: /add to library/i });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an added confirmation once added', () => {
    render(<ResultCardActions {...baseProps} added />);

    expect(screen.getByRole('button', { name: /added to library/i })).toBeDisabled();
  });

  describe('wishlist action (feature 060, US2, FR-005)', () => {
    it('renders a second, distinct action for adding to the wishlist', () => {
      render(<ResultCardActions {...baseProps} />);

      const library = screen.getByRole('button', { name: /add to library/i });
      const wishlist = screen.getByRole('button', { name: /add to wishlist/i });

      expect(library).toBeInTheDocument();
      expect(wishlist).toBeInTheDocument();
      expect(library).not.toBe(wishlist);
    });

    it('tells the two actions apart by icon shape + accessible name, not colour alone', () => {
      render(<ResultCardActions {...baseProps} />);

      const library = screen.getByRole('button', { name: /add to library/i });
      const wishlist = screen.getByRole('button', { name: /add to wishlist/i });

      // Distinct accessible names.
      expect(library.getAttribute('aria-label')).not.toEqual(
        wishlist.getAttribute('aria-label'),
      );
      // Distinct icon geometry (heart path vs. plus path).
      const libraryPath = library.querySelector('svg path')?.getAttribute('d');
      const wishlistPath = wishlist.querySelector('svg path')?.getAttribute('d');
      expect(libraryPath).toBeTruthy();
      expect(wishlistPath).toBeTruthy();
      expect(libraryPath).not.toEqual(wishlistPath);
    });

    it('calls onAddToWantlist when the wishlist action is activated', async () => {
      const user = userEvent.setup();
      const onAddToWantlist = vi.fn();
      render(<ResultCardActions {...baseProps} onAddToWantlist={onAddToWantlist} />);

      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      expect(onAddToWantlist).toHaveBeenCalledTimes(1);
    });

    it('shows a busy state on the wishlist action while adding, and stays disabled', () => {
      render(<ResultCardActions {...baseProps} addingToWantlist />);

      const wishlist = screen.getByRole('button', { name: /add to wishlist/i });
      expect(wishlist).toBeDisabled();
      expect(wishlist).toHaveAttribute('aria-busy', 'true');
    });

    it('reflects an "in your wishlist" state once the release is a want', () => {
      render(<ResultCardActions {...baseProps} inWantlist />);

      expect(
        screen.queryByRole('button', { name: /add to wishlist/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /in your wishlist/i })).toBeDisabled();
    });

    it('the wishlist added state swaps to a filled heart (shape change, not colour)', () => {
      const { rerender } = render(<ResultCardActions {...baseProps} />);
      const outlineHeart = screen
        .getByRole('button', { name: /add to wishlist/i })
        .querySelector('svg');
      expect(outlineHeart?.getAttribute('fill')).toBe('none');

      rerender(<ResultCardActions {...baseProps} inWantlist />);
      const filledHeart = screen
        .getByRole('button', { name: /in your wishlist/i })
        .querySelector('svg');
      expect(filledHeart?.getAttribute('fill')).toBe('currentColor');
    });
  });
});
