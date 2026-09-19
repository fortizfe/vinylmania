import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LibraryToolbar } from '../../src/components/LibraryToolbar';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_OPTIONS,
  type LibrarySortValue,
} from '../../src/constants/librarySortOptions';

function renderToolbar(sort: LibrarySortValue = DEFAULT_LIBRARY_SORT) {
  const onSortChange = vi.fn();
  const onModeChange = vi.fn();
  const utils = render(
    <LibraryToolbar
      mode="grid"
      onModeChange={onModeChange}
      sort={sort}
      onSortChange={onSortChange}
    />,
  );
  return { ...utils, onSortChange, onModeChange };
}

describe('LibraryToolbar sort select (feature 068, US1, FR-001/FR-009a)', () => {
  it('has a native select with the visible label "Sort"', () => {
    renderToolbar();

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(select.tagName).toBe('SELECT');
    // A real, visible <label>, not an aria-label.
    expect(screen.getByText('Sort', { selector: 'label' })).toBeVisible();
  });

  it('groups the six options in three optgroups, labelled from librarySortOptions', () => {
    renderToolbar();

    const select = screen.getByRole('combobox', { name: 'Sort' });
    const groups = Array.from(select.querySelectorAll('optgroup'));
    const expectedGroups = [...new Set(LIBRARY_SORT_OPTIONS.map((o) => o.group))];

    expect(groups.map((g) => g.label)).toEqual(expectedGroups);
    for (const group of groups) {
      const expectedLabels = LIBRARY_SORT_OPTIONS.filter(
        (o) => o.group === group.label,
      ).map((o) => o.label);
      const options = within(group as HTMLElement).getAllByRole('option', {
        hidden: true,
      });
      expect(options.map((o) => o.textContent)).toEqual(expectedLabels);
    }
  });

  it('selects the default option ("Newest first") for the default sort', () => {
    renderToolbar();

    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveDisplayValue(
      'Newest first',
    );
  });

  it('selects the current option for a non-default sort', () => {
    renderToolbar({ sort: 'album', dir: 'desc' });

    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveDisplayValue(
      'Album (Z → A)',
    );
  });

  it('calls onSortChange with the chosen option as { sort, dir }', async () => {
    const { onSortChange } = renderToolbar();
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort' }),
      screen.getByRole('option', { name: 'Artist (A → Z)' }),
    );

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith({ sort: 'artist', dir: 'asc' });
  });

  it('renders the view mode toggle exactly once', () => {
    renderToolbar();

    expect(screen.getAllByTestId('view-mode-toggle')).toHaveLength(1);
  });
});
