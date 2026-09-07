import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecordDetailActions } from './RecordDetailActions';

/** Feature 063 · contracts/ui-contracts.md §C3 + data-model.md §4. */

const searchBase = {
  view: 'search' as const,
  onAddToLibrary: vi.fn(),
  onAddToWishlist: vi.fn(),
  addingToLibrary: false,
  addingToWishlist: false,
  addedToLibrary: false,
  addedToWishlist: false,
};

describe('RecordDetailActions', () => {
  it('renders both add buttons in the search view', () => {
    render(<RecordDetailActions {...searchBase} />);

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to wishlist/i })).toBeInTheDocument();
    expect(screen.getByTestId('record-detail-actions')).toBeInTheDocument();
  });

  it('renders only "Add to library" in the wishlist view', () => {
    render(
      <RecordDetailActions
        view="wishlist"
        onAddToLibrary={vi.fn()}
        addingToLibrary={false}
        addedToLibrary={false}
      />,
    );

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add to wishlist/i }),
    ).not.toBeInTheDocument();
  });

  it('renders only "Remove from library" in the library view', () => {
    render(
      <RecordDetailActions view="library" onRemove={vi.fn()} removing={false} />,
    );

    expect(
      screen.getByRole('button', { name: /remove from library/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add to library/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a gate message and a notice as role="status"', () => {
    render(
      <RecordDetailActions
        {...searchBase}
        gateMessage="You need to link your Discogs account before adding records to your library."
        notice="Added to your library."
      />,
    );

    const statuses = screen.getAllByRole('status');
    expect(statuses.some((n) => /link your discogs account/i.test(n.textContent ?? ''))).toBe(
      true,
    );
    expect(statuses.some((n) => /added to your library/i.test(n.textContent ?? ''))).toBe(
      true,
    );
  });

  it('renders library and wishlist errors as role="alert"', () => {
    render(
      <RecordDetailActions
        {...searchBase}
        libraryError="Something went wrong while adding this record. Please try again."
        wishlistError="Something went wrong while adding this record to your wishlist. Please try again."
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
  });

  it('shows "Added to library" and disables the button once addedToLibrary is true', () => {
    render(<RecordDetailActions {...searchBase} addedToLibrary />);

    const button = screen.getByRole('button', { name: /added to library/i });
    expect(button).toBeDisabled();
  });

  it('calls onRemove when the library-view Remove button is clicked', async () => {
    const onRemove = vi.fn();
    render(<RecordDetailActions view="library" onRemove={onRemove} removing={false} />);

    await userEvent.setup().click(
      screen.getByRole('button', { name: /remove from library/i }),
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
