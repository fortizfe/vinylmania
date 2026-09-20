import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibraryToolbar } from '../../src/components/LibraryToolbar';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_OPTIONS,
  type LibrarySortValue,
} from '../../src/constants/librarySortOptions';

function renderToolbar(sort: LibrarySortValue = DEFAULT_LIBRARY_SORT) {
  const onSortChange = vi.fn();
  const onModeChange = vi.fn();
  const onFiltersChange = vi.fn();
  const onClear = vi.fn();
  const utils = render(
    <LibraryToolbar
      mode="grid"
      onModeChange={onModeChange}
      sort={sort}
      onSortChange={onSortChange}
      filters={{}}
      onFiltersChange={onFiltersChange}
      onClear={onClear}
    />,
  );
  return { ...utils, onSortChange, onModeChange, onFiltersChange, onClear };
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

/**
 * Feature 068, US3 (T049) — the one bar element that is the floating capsule
 * below 640 px and the sticky toolbar from 640 px up, plus its single panel
 * (bottom sheet / end drawer). FR-016–FR-018, FR-024, US3 AS1–AS3 + AS7,
 * research D15–D18, contracts/library-ui §3–§4.
 */
describe('LibraryToolbar — dual layout bar and panel (068 US3)', () => {
  /**
   * Deterministic breakpoint control: only `(min-width: 640px)` is driven,
   * every other query (notably `prefers-reduced-motion`) stays false.
   */
  function mockBreakpoint(initialDesktop: boolean) {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let desktop = initialDesktop;

    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query === '(min-width: 640px)' ? desktop : false;
          },
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: (_type: string, listener: EventListener) => {
            if (query === '(min-width: 640px)') {
              listeners.add(listener as unknown as (e: MediaQueryListEvent) => void);
            }
          },
          removeEventListener: (_type: string, listener: EventListener) => {
            listeners.delete(listener as unknown as (e: MediaQueryListEvent) => void);
          },
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    return {
      async cross(next: boolean) {
        desktop = next;
        await act(async () => {
          for (const listener of listeners) {
            listener({
              matches: next,
              media: '(min-width: 640px)',
            } as MediaQueryListEvent);
          }
        });
      },
    };
  }

  function renderBar({
    desktop = false,
    filters = {},
    sort = DEFAULT_LIBRARY_SORT,
  }: {
    desktop?: boolean;
    filters?: { genre?: string[]; style?: string[]; format?: string[] };
    sort?: LibrarySortValue;
  } = {}) {
    const breakpoint = mockBreakpoint(desktop);
    const onSortChange = vi.fn();
    const onModeChange = vi.fn();
    const onFiltersChange = vi.fn();
    const onClear = vi.fn();
    const utils = render(
      <LibraryToolbar
        mode="grid"
        onModeChange={onModeChange}
        sort={sort}
        onSortChange={onSortChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClear={onClear}
      />,
    );
    return { ...utils, breakpoint, onSortChange, onModeChange, onFiltersChange, onClear };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('renders exactly one bar element carrying the chrome material, and one view toggle', () => {
    const { container } = renderBar();

    expect(container.querySelectorAll('.chrome-material')).toHaveLength(1);
    expect(screen.getAllByTestId('view-mode-toggle')).toHaveLength(1);
  });

  it('exposes the phone-only "Sort & Filter" trigger as a dialog opener with a 44px target', () => {
    renderBar();

    const trigger = screen.getByRole('button', { name: /sort & filter/i });
    expect(trigger.className).toMatch(/(^|\s)sm:hidden(\s|$)/);
    expect(trigger.className).toMatch(/min-h-11/);
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the active-filter count as a number plus an sr-only suffix (never colour alone)', () => {
    renderBar({ filters: { genre: ['Rock'], format: ['Vinyl'] } });

    const trigger = screen.getByRole('button', { name: /sort & filter/i });
    expect(within(trigger).getByText('2')).toBeInTheDocument();
    expect(trigger).toHaveAccessibleName(/2 active filters/);
  });

  it('opens a bottom sheet titled "Sort & Filter" holding a native radio group per criterion', async () => {
    const user = userEvent.setup();
    renderBar();

    const trigger = screen.getByRole('button', { name: /sort & filter/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-variant', 'bottom');
    expect(
      within(dialog).getByRole('heading', { name: 'Sort & Filter' }),
    ).toBeInTheDocument();

    const sortGroup = within(dialog).getByRole('group', { name: 'Sort by' });
    for (const group of [...new Set(LIBRARY_SORT_OPTIONS.map((o) => o.group))]) {
      expect(within(sortGroup).getByRole('group', { name: group })).toBeInTheDocument();
    }

    const radios = within(sortGroup).getAllByRole('radio');
    expect(radios).toHaveLength(LIBRARY_SORT_OPTIONS.length);
    // One shared `name`, so arrow keys rove across the three fieldsets natively.
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
    expect(within(sortGroup).getByRole('radio', { name: 'Newest first' })).toBeChecked();
  });

  it('applies a sort pick immediately and leaves the sheet open', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderBar();

    await user.click(screen.getByRole('button', { name: /sort & filter/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Artist (A → Z)' }));

    expect(onSortChange).toHaveBeenCalledWith({ sort: 'artist', dir: 'asc' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('puts the live filters in the sheet (AS7)', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar();

    await user.click(screen.getByRole('button', { name: /sort & filter/i }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Clear all filters' }),
    ).toBeInTheDocument();

    const rock = within(dialog).getByLabelText('Rock');
    await user.click(rock);

    expect(onFiltersChange).toHaveBeenCalledWith({ genre: ['Rock'] });
    expect(rock).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('returns focus to the "Sort & Filter" trigger when the sheet is dismissed', async () => {
    const user = userEvent.setup();
    renderBar();

    const trigger = screen.getByRole('button', { name: /sort & filter/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the sort select and the "Filters" trigger for the ≥ 640 px toolbar', () => {
    renderBar({ desktop: true });

    const selectWrapper = screen.getByText('Sort', { selector: 'label' })
      .parentElement as HTMLElement;
    expect(selectWrapper.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(selectWrapper.className).toMatch(/sm:flex/);

    const filtersTrigger = screen.getByRole('button', { name: /^filters$/i });
    expect(filtersTrigger.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(filtersTrigger.className).toMatch(/sm:inline-flex/);
    expect(filtersTrigger.className).toMatch(/min-h-11/);
    expect(filtersTrigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(filtersTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the end drawer titled "Filters" with the same live filters and no sort radios', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar({ desktop: true });

    const trigger = screen.getByRole('button', { name: /^filters$/i });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-variant', 'end');
    expect(within(dialog).getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('group', { name: 'Sort by' }),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByLabelText('Rock'));
    expect(onFiltersChange).toHaveBeenCalledWith({ genre: ['Rock'] });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('shows the "Filters" trigger count too', () => {
    renderBar({ desktop: true, filters: { style: ['Doom Metal'] } });

    const trigger = screen.getByRole('button', { name: /^filters/i });
    expect(within(trigger).getByText('1')).toBeInTheDocument();
    expect(trigger).toHaveAccessibleName(/1 active filter/);
  });

  it('closes an open panel when the 640 px breakpoint is crossed', async () => {
    const user = userEvent.setup();
    const { breakpoint } = renderBar({ desktop: false });

    await user.click(screen.getByRole('button', { name: /sort & filter/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await breakpoint.cross(true);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  /**
   * Feature 068, US4 (T061) — every toolbar row of the names/roles/states
   * table in contracts/library-ui.md §4, plus the §4 footer rule (≥ 44 px,
   * shared `focusRing`) and the §6 keyboard rules that are observable
   * without layout. FR-026 (name/role/value on every control, expanded
   * state on the panel triggers) and FR-029 (no state by colour alone).
   *
   * The rows for the record count, the live announcer, the next-batch
   * failure, the end-of-list message and the load sentinel belong to
   * `LibraryListPage`, not to this component — they are covered by the
   * US2/US3 flow tests and by e2e (T062).
   */
  describe('accessible names, roles and states (contracts §4)', () => {
    it('exposes the view toggle as a named radiogroup of two labelled radios', () => {
      renderBar();

      const group = screen.getByRole('radiogroup', { name: 'View mode' });
      const grid = within(group).getByRole('radio', { name: 'Grid view' });
      const list = within(group).getByRole('radio', { name: 'List view' });

      expect(grid).toHaveAttribute('aria-checked', 'true');
      expect(list).toHaveAttribute('aria-checked', 'false');
    });

    it('exposes the sort select as a combobox whose value is the selected option, grouped by criterion', () => {
      renderBar({ desktop: true, sort: { sort: 'artist', dir: 'desc' } });

      const select = screen.getByRole('combobox', { name: 'Sort' });
      expect(select).toHaveDisplayValue('Artist (Z → A)');
      expect(
        within(select).getByRole('option', { name: 'Artist (Z → A)', hidden: true }),
      ).toBeInTheDocument();

      const optgroups = within(select).getAllByRole('group', { hidden: true });
      expect(optgroups.map((group) => group.getAttribute('label'))).toEqual([
        ...new Set(LIBRARY_SORT_OPTIONS.map((o) => o.group)),
      ]);
    });

    it('exposes the same selected sort as a checked radio inside the sheet', async () => {
      const user = userEvent.setup();
      renderBar({ sort: { sort: 'artist', dir: 'desc' } });

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const sortGroup = within(screen.getByRole('dialog')).getByRole('group', {
        name: 'Sort by',
      });

      for (const option of LIBRARY_SORT_OPTIONS) {
        const radio = within(sortGroup).getByRole('radio', { name: option.label });
        if (option.sort === 'artist' && option.dir === 'desc') {
          expect(radio).toBeChecked();
        } else {
          expect(radio).not.toBeChecked();
        }
      }
    });

    it('names the "Sort & Filter" trigger with its count in words, not by the amber alone', () => {
      renderBar({ filters: { genre: ['Rock'], format: ['Vinyl'] } });

      const trigger = screen.getByRole('button', { name: /sort & filter/i });
      expect(trigger).toHaveAccessibleName(/^Sort & Filter\s*,\s*2 active filters$/);
      // The digit is visible but aria-hidden, so the name is not doubled.
      expect(within(trigger).getByText('2')).toHaveAttribute('aria-hidden', 'true');
    });

    it('names the "Filters" trigger plainly with no filters and with the singular suffix for one', () => {
      const { unmount } = renderBar({ desktop: true });
      expect(screen.getByRole('button', { name: /^filters/i })).toHaveAccessibleName(
        'Filters',
      );
      unmount();

      renderBar({ desktop: true, filters: { style: ['Doom Metal'] } });
      expect(screen.getByRole('button', { name: /^filters/i })).toHaveAccessibleName(
        /^Filters\s*,\s*1 active filter$/,
      );
    });

    it('flips aria-expanded on the trigger that owns the open panel, and only that one', async () => {
      const user = userEvent.setup();
      renderBar();

      const sheetTrigger = screen.getByRole('button', { name: /sort & filter/i });
      const drawerTrigger = screen.getByRole('button', { name: /^filters/i });

      expect(sheetTrigger).toHaveAttribute('aria-expanded', 'false');
      expect(drawerTrigger).toHaveAttribute('aria-expanded', 'false');

      await user.click(sheetTrigger);

      expect(sheetTrigger).toHaveAttribute('aria-expanded', 'true');
      expect(drawerTrigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('labels the panel as a modal dialog by its own title element', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Sort & Filter');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)).toHaveTextContent('Sort & Filter');
    });

    it('renders each facet as a native disclosure whose name carries its selected count', async () => {
      const user = userEvent.setup();
      renderBar({ filters: { genre: ['Rock'] } });

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const dialog = screen.getByRole('dialog');

      const summaries = Array.from(dialog.querySelectorAll('details > summary'));
      expect(summaries.map((s) => s.textContent)).toEqual([
        'Format',
        'Genre (1 selected)',
        'Style',
      ]);

      // Native expanded state: no ARIA substitute, no height animation.
      const genre = summaries[1].closest('details') as HTMLDetailsElement;
      expect(genre.open).toBe(false);
      await user.click(summaries[1]);
      expect(genre.open).toBe(true);
    });

    it('exposes each facet option as a checkbox named by its value and checked from the filters', async () => {
      const user = userEvent.setup();
      renderBar({ filters: { genre: ['Rock'] } });

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const dialog = screen.getByRole('dialog');

      expect(within(dialog).getByRole('checkbox', { name: 'Rock' })).toBeChecked();
      expect(within(dialog).getByRole('checkbox', { name: 'Jazz' })).not.toBeChecked();
    });

    it('gives the style search box an accessible name without a visible label', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const dialog = screen.getByRole('dialog');

      const search = within(dialog).getByRole('textbox', { name: 'Search style' });
      expect(search.tagName).toBe('INPUT');
    });

    it('keeps "Clear all filters" focusable while inactive, marked aria-disabled rather than disabled', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const clear = within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Clear all filters',
      });

      expect(clear).toHaveAttribute('aria-disabled', 'true');
      expect(clear).not.toBeDisabled();
      clear.focus();
      expect(clear).toHaveFocus();
    });

    it('drops aria-disabled from "Clear all filters" once a filter is active', async () => {
      const user = userEvent.setup();
      const { onClear } = renderBar({ filters: { format: ['Vinyl'] } });

      await user.click(screen.getByRole('button', { name: /sort & filter/i }));
      const clear = within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Clear all filters',
      });

      expect(clear).not.toHaveAttribute('aria-disabled');
      await user.click(clear);
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('gives every bar control a 44px target and the shared focus ring (§4 footer)', () => {
      const { container } = renderBar({ desktop: true });
      const bar = container.querySelector('.chrome-material') as HTMLElement;

      const controls = Array.from(
        bar.querySelectorAll<HTMLElement>('button, select, input, a[href]'),
      );
      expect(controls.length).toBeGreaterThan(0);

      for (const control of controls) {
        expect(control.className).toMatch(/min-h-11/);
        expect(control.className).toContain('focus-visible:ring-primary');
      }
    });

    it('puts the bar controls in visual order in the tab order (§6)', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.tab();
      expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /sort & filter/i })).toHaveFocus();
    });
  });
});
