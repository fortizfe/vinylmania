import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectableListFilter } from '../../../src/components/filters/SelectableListFilter';

const OPTIONS = ['Vinyl', 'CD', 'Cassette', 'Reel-To-Reel', 'Betacam SP'];

describe('SelectableListFilter (feature 038, US1)', () => {
  it('shows the neutral label when no value is selected (FR-005)', () => {
    render(
      <SelectableListFilter label="Format" options={OPTIONS} value={[]} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
  });

  it('shows the single selected value as the label', () => {
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^vinyl$/i })).toBeInTheDocument();
  });

  it('shows a comma-separated list, in selection order, when it fits', () => {
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={['Vinyl', 'CD']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^vinyl, cd$/i })).toBeInTheDocument();
  });

  it('falls back to "first (+N)" once the comma-separated list no longer fits', () => {
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={['Vinyl', 'CD', 'Cassette', 'Reel-To-Reel', 'Betacam SP']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^vinyl \(\+4\)$/i })).toBeInTheDocument();
  });

  it('opens a modal listing every option, with existing selections checked', async () => {
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^vinyl$/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Vinyl')).toBeChecked();
    expect(within(dialog).getByLabelText('CD')).not.toBeChecked();
  });

  it('calls onChange with the toggled option when a checkbox is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^vinyl$/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('CD'));

    expect(onChange).toHaveBeenCalledWith(['Vinyl', 'CD']);
  });

  it('does not render a search input when searchable is unset', async () => {
    const user = userEvent.setup();
    render(
      <SelectableListFilter label="Genre" options={OPTIONS} value={[]} onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /^genre$/i }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('filters visible options by substring match (case-insensitive) when searchable is set', async () => {
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        label="Style"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
        searchable
      />,
    );

    await user.click(screen.getByRole('button', { name: /^style$/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'cas');

    expect(within(dialog).getByLabelText('Cassette')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Vinyl')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('CD')).not.toBeInTheDocument();
  });

  it('keeps an already-selected value toggleable even after it is filtered out of view', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        label="Style"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={onChange}
        searchable
      />,
    );

    await user.click(screen.getByRole('button', { name: /^vinyl$/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'cas');

    expect(within(dialog).queryByLabelText('Vinyl')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
