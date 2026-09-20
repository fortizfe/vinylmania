import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectableListFilter } from '../../../src/components/filters/SelectableListFilter';

const OPTIONS = ['Vinyl', 'CD', 'Cassette', 'Reel-To-Reel', 'Betacam SP'];

describe('SelectableListFilter (feature 038, US1)', () => {
  it('shows the neutral label when no value is selected (FR-005)', () => {
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
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

  it('each selectable row carries the shared row press affordance (US1 multi-select-list)', async () => {
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        label="Format"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^format$/i }));
    const dialog = screen.getByRole('dialog');
    const row = within(dialog).getByLabelText('Vinyl').closest('div');
    expect(row?.className).toMatch(/active:brightness-95/);
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
      <SelectableListFilter
        label="Genre"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
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

/**
 * Feature 068, US3 (T047) — `inline` renders the facet as a native
 * `<details>` disclosure instead of a trigger + nested `Modal`, because an
 * overlay cannot be nested inside the Library's sheet/drawer (research D13).
 */
describe('SelectableListFilter — inline disclosure (068 US3)', () => {
  function summaryOf(label: string): HTMLElement {
    const summary = screen
      .getAllByText(new RegExp(`^${label}`))
      .find((node) => node.tagName === 'SUMMARY');
    if (!summary) throw new Error(`no <summary> found for ${label}`);
    return summary;
  }

  it('renders a native details/summary disclosure instead of a dialog', () => {
    render(
      <SelectableListFilter
        inline
        label="Genre"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    const summary = summaryOf('Genre');
    expect(summary.closest('details')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // No modal trigger button either — the summary is the only control.
    expect(screen.queryByRole('button', { name: /^genre$/i })).not.toBeInTheDocument();
  });

  it('shows the selected count in the summary, and nothing when none are selected', () => {
    const { rerender } = render(
      <SelectableListFilter
        inline
        label="Genre"
        options={OPTIONS}
        value={['Vinyl', 'CD']}
        onChange={vi.fn()}
      />,
    );
    expect(summaryOf('Genre')).toHaveTextContent('Genre (2 selected)');

    rerender(
      <SelectableListFilter
        inline
        label="Genre"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(summaryOf('Genre')).toHaveTextContent(/^Genre$/);
  });

  it('keeps the summary a 44px touch target', () => {
    render(
      <SelectableListFilter
        inline
        label="Genre"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(summaryOf('Genre').className).toMatch(/min-h-11/);
  });

  it('renders the same checkbox list inside the disclosure, with selections checked', () => {
    render(
      <SelectableListFilter
        inline
        label="Format"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={vi.fn()}
      />,
    );

    const details = summaryOf('Format').closest('details') as HTMLElement;
    expect(within(details).getByLabelText('Vinyl')).toBeChecked();
    expect(within(details).getByLabelText('CD')).not.toBeChecked();
  });

  it('calls onChange with the toggled option from the inline list', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectableListFilter
        inline
        label="Format"
        options={OPTIONS}
        value={['Vinyl']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('CD'));
    expect(onChange).toHaveBeenCalledWith(['Vinyl', 'CD']);
  });

  it('keeps the in-list search box when searchable, and omits it otherwise', () => {
    const { rerender } = render(
      <SelectableListFilter
        inline
        searchable
        label="Style"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: /search style/i })).toBeInTheDocument();

    rerender(
      <SelectableListFilter
        inline
        label="Style"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
