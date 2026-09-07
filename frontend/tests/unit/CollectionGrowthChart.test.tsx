import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollectionGrowthChart } from '../../src/components/stats/CollectionGrowthChart';
import type { GrowthSeries } from '../../src/services/collectionStatsApi';

const growth: GrowthSeries = {
  granularity: 'month',
  points: [
    { period: '2023-01', added: 4, cumulative: 4 },
    { period: '2023-02', added: 0, cumulative: 4 },
    { period: '2023-03', added: 9, cumulative: 13 },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CollectionGrowthChart', () => {
  it('renders the chart as a labelled image with a text summary', () => {
    render(<CollectionGrowthChart growth={growth} />);

    const chart = screen.getByRole('img');
    expect(chart.tagName.toLowerCase()).toBe('svg');
    // The accessible summary carries the shape of the series as words, not
    // just colour: total added and the covered span.
    expect(chart).toHaveAccessibleName(/growth/i);
    expect(chart).toHaveAccessibleName(/13/);
  });

  it('exposes every period in a visually-hidden data table (non-visual alternative)', () => {
    render(<CollectionGrowthChart growth={growth} />);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('sr-only');

    const rows = within(table).getAllByRole('row');
    // header + one row per period
    expect(rows).toHaveLength(1 + growth.points.length);

    const marchRow = within(table).getByRole('row', { name: /mar 2023/i });
    expect(marchRow).toHaveTextContent('9'); // added
    expect(marchRow).toHaveTextContent('13'); // cumulative
  });

  it('defaults to the per-period bars and offers a series toggle', () => {
    render(<CollectionGrowthChart growth={growth} />);

    const perPeriod = screen.getByRole('button', { name: /per period/i });
    const cumulative = screen.getByRole('button', { name: /cumulative/i });

    expect(perPeriod).toHaveAttribute('aria-pressed', 'true');
    expect(cumulative).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByTestId('growth-bars')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-line')).not.toBeInTheDocument();
  });

  it('switches the rendered series when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<CollectionGrowthChart growth={growth} />);

    await user.click(screen.getByRole('button', { name: /cumulative/i }));

    expect(screen.getByRole('button', { name: /cumulative/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('growth-line')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-bars')).not.toBeInTheDocument();
  });

  it('the series toggle is operable from the keyboard', async () => {
    const user = userEvent.setup();
    render(<CollectionGrowthChart growth={growth} />);

    const cumulative = screen.getByRole('button', { name: /cumulative/i });
    cumulative.focus();
    expect(cumulative).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('growth-line')).toBeInTheDocument();

    const perPeriod = screen.getByRole('button', { name: /per period/i });
    perPeriod.focus();
    await user.keyboard(' '); // Space also activates
    expect(screen.getByTestId('growth-bars')).toBeInTheDocument();
  });

  it('labels each bar with its period and count so meaning is not colour-only', () => {
    render(<CollectionGrowthChart growth={growth} />);

    const titles = Array.from(
      screen.getByTestId('growth-bars').querySelectorAll('title'),
    ).map((node) => node.textContent);
    expect(titles).toEqual([
      'Jan 2023: 4 added',
      'Feb 2023: 0 added',
      'Mar 2023: 9 added',
    ]);
  });

  it('does not animate when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<CollectionGrowthChart growth={growth} />);

    expect(screen.getByRole('img')).toHaveAttribute('data-reduced-motion', 'true');
  });
});
