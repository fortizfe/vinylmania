import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FiltersControl } from '../../src/components/FiltersControl';
import { FORMAT_OPTIONS } from '../../src/constants/formatOptions';
import { GENRE_OPTIONS } from '../../src/constants/genreOptions';

async function expandPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^filters$/i }));
}

describe('FiltersControl (feature 038, US1)', () => {
  it('renders collapsed by default, with no filter lists visible (FR-002)', () => {
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^genre$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^style$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^format$/i })).not.toBeInTheDocument();
  });

  it('shows no active-filter badge when no filters are active (FR-005)', () => {
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByTestId('active-filter-badge')).not.toBeInTheDocument();
  });

  it('shows an active-filter badge reflecting total selected values across genre/style/format, even while collapsed (FR-004)', () => {
    render(
      <FiltersControl
        filters={{ genre: ['Rock'], style: ['Grunge', 'Shoegaze'], format: ['Vinyl'] }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId('active-filter-badge')).toHaveTextContent('4');
  });

  it('expands to show Genre, Style, and Format as selectable-list triggers, plus Apply/Clear (FR-006)', async () => {
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    await expandPanel(user);

    expect(screen.getByRole('button', { name: /^genre$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^style$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it("opens Genre's list with the 15 GENRE_OPTIONS values (FR-007)", async () => {
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    await expandPanel(user);
    await user.click(screen.getByRole('button', { name: /^genre$/i }));

    const dialog = screen.getByRole('dialog');
    for (const option of GENRE_OPTIONS) {
      expect(within(dialog).getByLabelText(option)).toBeInTheDocument();
    }
  });

  it("opens Format's list with the 51 FORMAT_OPTIONS values (FR-009)", async () => {
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    await expandPanel(user);
    await user.click(screen.getByRole('button', { name: /^format$/i }));

    const dialog = screen.getByRole('dialog');
    for (const option of FORMAT_OPTIONS) {
      expect(within(dialog).getByLabelText(option)).toBeInTheDocument();
    }
  });

  it("renders Style's list with an in-list search box, unlike Genre's (FR-008)", async () => {
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={vi.fn()} onClear={vi.fn()} />);

    await expandPanel(user);

    await user.click(screen.getByRole('button', { name: /^style$/i }));
    expect(within(screen.getByRole('dialog')).getByRole('textbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    await user.click(screen.getByRole('button', { name: /^genre$/i }));
    expect(
      within(screen.getByRole('dialog')).queryByRole('textbox'),
    ).not.toBeInTheDocument();
  });

  it('initializes each trigger label from currently active filters, once expanded', async () => {
    const user = userEvent.setup();
    render(
      <FiltersControl
        filters={{ genre: ['Rock'], format: ['Vinyl', 'CD'] }}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    await expandPanel(user);

    expect(screen.getByRole('button', { name: /^rock$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^vinyl, cd$/i })).toBeInTheDocument();
  });

  it('calls onApply exactly once with the selected genre/style/format arrays when Apply is pressed, and the panel stays expanded (FR-007 URL/apply mechanics)', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await expandPanel(user);
    await user.click(screen.getByRole('button', { name: /^genre$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Rock'));
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    await user.click(screen.getByRole('button', { name: /^format$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Vinyl'));
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ genre: ['Rock'], format: ['Vinyl'] });
    // Panel remains expanded (does not auto-collapse on Apply): the Genre
    // trigger now shows the selected value as its label instead of "Genre".
    expect(screen.getByRole('button', { name: /^rock$/i })).toBeInTheDocument();
  });

  it('omits a filter from onApply entirely when no value is selected for it', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FiltersControl filters={{}} onApply={onApply} onClear={vi.fn()} />);

    await expandPanel(user);
    await user.click(screen.getByRole('button', { name: /^style$/i }));
    const dialog = screen.getByRole('dialog');
    // Narrow via the search box first — Style has 757 options, and querying
    // by label text against the full unfiltered list is prohibitively slow.
    await user.type(within(dialog).getByRole('textbox'), 'Grunge');
    await user.click(within(dialog).getByLabelText('Grunge'));
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(onApply).toHaveBeenCalledWith({ style: ['Grunge'] });
  });

  it('calls onClear and resets every selection when Clear is pressed (FR-011)', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <FiltersControl
        filters={{ genre: ['Rock'], style: ['Grunge'], format: ['Vinyl'] }}
        onApply={vi.fn()}
        onClear={onClear}
      />,
    );

    await expandPanel(user);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /^genre$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^style$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^format$/i })).toBeInTheDocument();
  });
});
