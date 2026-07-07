import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchFiltersControl } from '../../src/components/SearchFiltersControl';
import { FORMAT_OPTIONS } from '../../src/constants/formatOptions';

describe('SearchFiltersControl', () => {
  it('renders empty, labeled Genre/Style fields, an unselected Format trigger, and no Artist field when no filters are active', () => {
    render(<SearchFiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^style$/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^artist$/i)).not.toBeInTheDocument();
  });

  it('initializes text fields and the Format trigger label from currently active filters', () => {
    render(
      <SearchFiltersControl
        filters={{ genre: 'Rock', format: ['Vinyl', 'CD'] }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('Rock');
    expect(screen.getByRole('button', { name: /^format \(2\)$/i })).toBeInTheDocument();
  });

  it('does not render an Artist field, even if legacy filters carrying an artist value are passed in (FR-001, feature 022, US2)', () => {
    render(
      <SearchFiltersControl
        // @ts-expect-error artist is no longer part of SearchFilters (feature 022)
        filters={{ artist: 'Nirvana', genre: 'Rock' }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/^artist$/i)).not.toBeInTheDocument();
  });

  it('calls onApply exactly once with the trimmed, non-empty subset of text values when "Apply filters" is selected (FR-002/FR-003)', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.type(screen.getByLabelText(/^genre$/i), '  Rock  ');
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ genre: 'Rock' });
  });

  it('calls onClear and resets all text fields and the format selection when "Clear filters" is selected (FR-005)', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchFiltersControl
        filters={{ genre: 'Rock', format: ['Vinyl'] }}
        onApply={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
  });

  describe('Format multi-select (feature 022, US1)', () => {
    it('opens a modal listing every fixed format option, unchecked by default', async () => {
      const user = userEvent.setup();
      render(<SearchFiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /^format$/i }));

      const dialog = screen.getByRole('dialog');
      for (const option of FORMAT_OPTIONS) {
        const checkbox = within(dialog).getByLabelText(option);
        expect(checkbox).not.toBeChecked();
      }
    });

    it('checking two format options and applying calls onApply with both selected values (Acceptance Scenarios 1-3)', async () => {
      const onApply = vi.fn();
      const user = userEvent.setup();
      render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /^format$/i }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByLabelText('Vinyl'));
      await user.click(within(dialog).getByLabelText('CD'));

      await user.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledWith({ format: ['Vinyl', 'CD'] });
    });

    it('checking or unchecking a format option alone does NOT call onApply (FR-008)', async () => {
      const onApply = vi.fn();
      const user = userEvent.setup();
      render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: /^format$/i }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByLabelText('Vinyl'));
      await user.click(within(dialog).getByLabelText('Vinyl'));

      expect(onApply).not.toHaveBeenCalled();
    });

    it('deselecting all formats and applying omits format from onApply (Acceptance Scenario 4)', async () => {
      const onApply = vi.fn();
      const user = userEvent.setup();
      render(
        <SearchFiltersControl filters={{ format: ['Vinyl'] }} onApply={onApply} onClear={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /^format \(1\)$/i }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByLabelText('Vinyl'));

      await user.click(screen.getByRole('button', { name: /apply filters/i }));

      expect(onApply).toHaveBeenCalledWith({});
    });
  });

  it('omits empty text fields from onApply and supports any subset of filters, including a format selection (FR-004)', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<SearchFiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await user.type(screen.getByLabelText(/^genre$/i), 'Rock');
    await user.type(screen.getByLabelText(/^style$/i), 'Grunge');
    await user.click(screen.getByRole('button', { name: /^format$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Vinyl'));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledWith({
      genre: 'Rock',
      style: 'Grunge',
      format: ['Vinyl'],
    });
  });
});
