import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MyCopySection } from '../../src/components/MyCopySection';
import type { EntryDiscogsData } from '../../src/services/libraryApi';

const baseDiscogs: EntryDiscogsData = {
  instanceId: 100,
  folderId: 1,
  rating: 0,
  mediaCondition: null,
  sleeveCondition: null,
  notes: null,
  editable: { mediaCondition: true, sleeveCondition: true, notes: true },
};

function makeProps(overrides: Partial<EntryDiscogsData> = {}) {
  return {
    discogs: { ...baseDiscogs, ...overrides },
    onSaveRating: vi.fn().mockResolvedValue(undefined),
    onSaveMediaCondition: vi.fn().mockResolvedValue(undefined),
    onSaveSleeveCondition: vi.fn().mockResolvedValue(undefined),
    onSaveNotes: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn(),
  };
}

describe('MyCopySection', () => {
  it('renders the star rating with current value', () => {
    render(<MyCopySection {...makeProps({ rating: 3 })} />);

    const stars = screen.getAllByRole('button', { name: /stars/i });
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSaveRating when a star is clicked', async () => {
    const props = makeProps({ rating: 0 });
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /4 stars/i }));

    expect(props.onSaveRating).toHaveBeenCalledWith(4);
  });

  it('renders media condition select with Discogs grading options', () => {
    render(<MyCopySection {...makeProps({ mediaCondition: 'Very Good Plus (VG+)' })} />);

    const select = screen.getByLabelText('Media Condition');
    expect(select.tagName).toBe('SELECT');
    expect((select as HTMLSelectElement).value).toBe('Very Good Plus (VG+)');
  });

  it('calls onSaveMediaCondition when a condition is selected', async () => {
    const props = makeProps();
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Media Condition'), 'Mint (M)');

    expect(props.onSaveMediaCondition).toHaveBeenCalledWith('Mint (M)');
  });

  it('disables media condition select with a hint when editable is false', () => {
    render(
      <MyCopySection
        {...makeProps({
          editable: { mediaCondition: false, sleeveCondition: true, notes: true },
        })}
      />,
    );

    const select = screen.getByLabelText('Media Condition');
    expect(select).toBeDisabled();
    expect(screen.getByText(/Media Condition.*not available/i)).toBeInTheDocument();
  });

  it('calls onRemove when "Remove from library" is clicked', async () => {
    const props = makeProps();
    render(<MyCopySection {...props} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /remove from library/i }));

    expect(props.onRemove).toHaveBeenCalled();
  });
});
