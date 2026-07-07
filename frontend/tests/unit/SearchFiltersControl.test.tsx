import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchFiltersControl } from '../../src/components/SearchFiltersControl';

describe('SearchFiltersControl', () => {
  it('renders four empty, labeled fields when no filters are active', () => {
    render(<SearchFiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByLabelText(/^artist$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^style$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^format$/i)).toHaveValue('');
  });

  it('initializes fields from currently active filters', () => {
    render(
      <SearchFiltersControl
        filters={{ genre: 'Rock', format: 'Vinyl' }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('Rock');
    expect(screen.getByLabelText(/^format$/i)).toHaveValue('Vinyl');
    expect(screen.getByLabelText(/^artist$/i)).toHaveValue('');
  });

  it('calls onApply exactly once with the trimmed, non-empty subset of values when "Apply filters" is selected (FR-002/FR-003)', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.type(screen.getByLabelText(/^genre$/i), '  Rock  ');
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ genre: 'Rock' });
  });

  it('calls onClear and resets all fields to empty when "Clear filters" is selected (FR-005)', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchFiltersControl
        filters={{ genre: 'Rock', format: 'Vinyl' }}
        onApply={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^format$/i)).toHaveValue('');
  });

  it('omits empty fields from onApply and supports any subset of the four filters (FR-004)', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.type(screen.getByLabelText(/^artist$/i), 'Nirvana');
    await user.type(screen.getByLabelText(/^genre$/i), 'Rock');
    await user.type(screen.getByLabelText(/^style$/i), 'Grunge');
    await user.type(screen.getByLabelText(/^format$/i), 'Vinyl');
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledWith({
      artist: 'Nirvana',
      genre: 'Rock',
      style: 'Grunge',
      format: 'Vinyl',
    });
  });
});
