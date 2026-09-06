import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WantlistPanel } from '../../src/components/WantlistPanel';
import type { WantEntryDetail } from '../../src/services/wantlistApi';

const baseEntry: WantEntryDetail = {
  discogsReleaseId: 42,
  rating: 2,
  notes: 'First pressing only',
  addedAt: '2026-09-06T00:00:00.000Z',
};

function makeProps(overrides: Partial<WantEntryDetail> = {}) {
  return {
    entry: { ...baseEntry, ...overrides },
    onSaveRating: vi.fn().mockResolvedValue(undefined),
    onSaveNotes: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WantlistPanel', () => {
  it('renders a heading for the wishlist notes', () => {
    render(<WantlistPanel {...makeProps()} />);

    expect(
      screen.getByRole('heading', { name: /your wishlist notes/i }),
    ).toBeInTheDocument();
  });

  it('renders the personal rating reflecting the entry rating', () => {
    render(<WantlistPanel {...makeProps({ rating: 3 })} />);

    const stars = screen.getAllByRole('button', { name: /stars/i });
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-pressed', 'true');
    expect(stars[3]).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the rating group with its visible "Personal rating" label (WCAG 2.5.3)', () => {
    render(<WantlistPanel {...makeProps()} />);

    expect(screen.getByRole('group', { name: 'Personal rating' })).toBeInTheDocument();
  });

  it('renders the notes field reflecting the entry notes', () => {
    render(<WantlistPanel {...makeProps({ notes: 'Blue vinyl' })} />);

    expect(screen.getByText('Blue vinyl')).toBeInTheDocument();
  });

  it('renders a placeholder when the entry has no notes', () => {
    render(<WantlistPanel {...makeProps({ notes: null })} />);

    expect(screen.getByText(/why you want this/i)).toBeInTheDocument();
  });

  it('saves only the rating when a star is tapped', async () => {
    const props = makeProps({ rating: 0 });
    render(<WantlistPanel {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /4 stars/i }));

    expect(props.onSaveRating).toHaveBeenCalledWith(4);
    expect(props.onSaveNotes).not.toHaveBeenCalled();
  });

  it('saves only the notes when an edit is confirmed', async () => {
    const props = makeProps({ notes: null });
    render(<WantlistPanel {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit notes/i }));
    await user.type(screen.getByLabelText('Notes'), 'Repress is fine');
    await user.tab();

    expect(props.onSaveNotes).toHaveBeenCalledWith('Repress is fine');
    expect(props.onSaveRating).not.toHaveBeenCalled();
  });

  it('has no Save button anywhere', () => {
    render(<WantlistPanel {...makeProps()} />);

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('surfaces a retryable error when saving the rating fails and keeps the prior value', async () => {
    const onSaveRating = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const props = { ...makeProps({ rating: 2 }), onSaveRating };
    render(<WantlistPanel {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /5 stars/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.t save/i);
    // The star control still reflects the persisted (prior) rating, not 5.
    const stars = screen.getAllByRole('button', { name: /stars/i });
    expect(stars[4]).toHaveAttribute('aria-pressed', 'false');
    expect(stars[1]).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onSaveRating).toHaveBeenCalledTimes(2);
    expect(onSaveRating).toHaveBeenLastCalledWith(5);
  });

  it('surfaces a retryable error when saving the notes fails', async () => {
    const onSaveNotes = vi.fn().mockRejectedValue(new Error('network'));
    const props = { ...makeProps({ notes: 'Original note' }), onSaveNotes };
    render(<WantlistPanel {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit notes/i }));
    await user.type(screen.getByLabelText('Notes'), ' updated');
    await user.tab();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.t save/i);
    expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument();
  });
});
