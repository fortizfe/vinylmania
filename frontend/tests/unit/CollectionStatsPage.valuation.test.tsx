import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../testUtils';
import { CollectionStatsPage } from '../../src/pages/CollectionStatsPage';
import { ApiError } from '../../src/services/apiClient';
import { formatCurrency } from '../../src/components/valuation/formatCurrency';
import type {
  CollectionStatistics,
  PerDiscValue,
  ValuationChunkResponse,
} from '../../src/services/collectionStatsApi';

// Mock the service layer, not the query hooks — the real `useProgressiveValuation`
// chunk loop (T044) is under test here.
const api = vi.hoisted(() => ({
  getStatistics: vi.fn(),
  getValuationChunk: vi.fn(),
}));

vi.mock('../../src/services/collectionStatsApi', () => api);

function buildStatistics(): CollectionStatistics {
  return {
    totalRecords: 5,
    byDecade: { buckets: [{ label: '1950s', count: 5 }], others: null },
    byGenre: {
      buckets: [{ label: 'Jazz', count: 5 }],
      others: { count: 18, hiddenBuckets: 6 },
    },
    byStyle: { buckets: [{ label: 'Hard Bop', count: 3 }], others: null },
    byLabel: { buckets: [{ label: 'Blue Note', count: 4 }], others: null },
    topArtists: [{ name: 'John Coltrane', count: 3 }],
    mostPresentArtist: { name: 'John Coltrane', count: 3 },
    growth: {
      granularity: 'month',
      points: [{ period: '2023-01', added: 5, cumulative: 5 }],
    },
  };
}

const PER_DISC: PerDiscValue[] = [
  {
    releaseId: 1,
    instanceId: 11,
    title: 'Kind Of Blue',
    artist: 'Miles Davis',
    mediaCondition: 'Near Mint (NM or M-)',
    value: 150,
    reason: 'ok',
  },
  {
    releaseId: 2,
    instanceId: 22,
    title: 'Blue Train',
    artist: 'John Coltrane',
    mediaCondition: 'Very Good Plus (VG+)',
    value: 100,
    reason: 'ok',
  },
  {
    releaseId: 3,
    instanceId: 33,
    title: 'Giant Steps',
    artist: 'John Coltrane',
    mediaCondition: 'Mint (M)',
    value: null,
    reason: 'no_market_data',
  },
  {
    releaseId: 4,
    instanceId: 44,
    title: 'Lush Life',
    artist: 'John Coltrane',
    mediaCondition: null,
    value: null,
    reason: 'no_condition',
  },
];

function partialChunk(): ValuationChunkResponse {
  return {
    valuation: {
      currency: 'EUR',
      estimatedTotal: 120,
      coveredCount: 2,
      totalCount: 5,
      uncovered: { noMarketData: 0, noCondition: 0 },
      topValuable: [PER_DISC[0]],
      status: 'partial',
    },
    status: 'partial',
    nextCursor: 25,
    pricedThisBatch: 25,
    fromCacheThisBatch: 0,
  };
}

function completeChunk(): ValuationChunkResponse {
  return {
    valuation: {
      currency: 'EUR',
      estimatedTotal: 250,
      coveredCount: 3,
      totalCount: 5,
      uncovered: { noMarketData: 1, noCondition: 1 },
      topValuable: [PER_DISC[0], PER_DISC[1]],
      status: 'complete',
    },
    status: 'complete',
    pricedThisBatch: 10,
    fromCacheThisBatch: 10,
    perDisc: PER_DISC,
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/stats']}>
        <CollectionStatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const money = (value: number) => formatCurrency(value, 'EUR');

beforeEach(() => {
  api.getStatistics.mockResolvedValue(buildStatistics());
  api.getValuationChunk.mockResolvedValue(completeChunk());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CollectionStatsPage — Block 2 estimated market value (US2)', () => {
  it('auto-starts the valuation on mount with no button to press (FR-020)', async () => {
    renderPage();

    await waitFor(() => expect(api.getValuationChunk).toHaveBeenCalledWith(0));
    expect(
      screen.queryByRole('button', { name: /calcula|estimate value|valorar/i }),
    ).not.toBeInTheDocument();
  });

  it('announces progress in an aria-live region and updates the running total and coverage across chunks', async () => {
    let resolveSecond!: (value: ValuationChunkResponse) => void;
    const second = new Promise<ValuationChunkResponse>((resolve) => {
      resolveSecond = resolve;
    });
    api.getValuationChunk
      .mockReset()
      .mockResolvedValueOnce(partialChunk())
      .mockReturnValueOnce(second);

    renderPage();

    // First chunk: running total + "estimado sobre X de Y discos".
    await waitFor(() =>
      expect(screen.getByText(/estimado sobre 2 de 5 discos/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(money(120))).toBeInTheDocument();

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // Second chunk: totals advance.
    resolveSecond(completeChunk());
    await waitFor(() =>
      expect(screen.getByText(/estimado sobre 3 de 5 discos/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(money(250))).toBeInTheDocument();
  });

  it('uses one consistent currency across the total, the highlights and the breakdown (FR-019)', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText(money(250))).toBeInTheDocument());

    // Highlight list.
    const highlights = screen.getByRole('region', { name: /most valuable records/i });
    expect(within(highlights).getByText(money(150))).toBeInTheDocument();

    // Breakdown dialog.
    await user.click(screen.getByRole('button', { name: /ver todos/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(money(150))).toBeInTheDocument();
  });

  it('renders the MostValuableRecords highlight list', async () => {
    renderPage();

    const highlights = await screen.findByRole('region', {
      name: /most valuable records/i,
    });
    expect(within(highlights).getByText('Kind Of Blue')).toBeInTheDocument();
    expect(within(highlights).getByText('Blue Train')).toBeInTheDocument();
  });

  it('opens the full per-disc breakdown dialog from "Ver todos" with covered and uncovered rows', async () => {
    renderPage();
    const user = userEvent.setup();

    const verTodos = await screen.findByRole('button', { name: /ver todos/i });
    await user.click(verTodos);

    const dialog = await screen.findByRole('dialog');
    // Covered row with its value.
    expect(within(dialog).getByText('Kind Of Blue')).toBeInTheDocument();
    expect(within(dialog).getByText(money(150))).toBeInTheDocument();
    // Uncovered rows carry a text reason (never colour-only).
    expect(within(dialog).getByText('Giant Steps')).toBeInTheDocument();
    expect(within(dialog).getByText(/sin datos de mercado/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Lush Life')).toBeInTheDocument();
    expect(within(dialog).getByText(/sin estado/i)).toBeInTheDocument();
  });

  it('keeps the Block 1 statistics rendered and interactive while the valuation is still partial (FR-012)', async () => {
    api.getValuationChunk
      .mockReset()
      .mockResolvedValueOnce(partialChunk())
      .mockImplementation(() => new Promise(() => {}));

    renderPage();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByText(/estimado sobre 2 de 5 discos/i)).toBeInTheDocument(),
    );

    // Block 1 is still on screen…
    expect(screen.getByRole('heading', { name: /by genre/i })).toBeInTheDocument();
    // …and still interactive.
    const othersButton = screen.getByRole('button', { name: /otros \(18\)/i });
    await user.click(othersButton);
    expect(othersButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the ValuationUnavailableNotice for seller_settings_required and leaves Block 1 untouched', async () => {
    api.getValuationChunk
      .mockReset()
      .mockRejectedValue(
        new ApiError(
          'Discogs only provides price estimates once you have completed your seller settings on discogs.com.',
          422,
          'seller_settings_required',
        ),
      );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/seller settings on discogs\.com/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: /by genre/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver todos/i })).not.toBeInTheDocument();
  });
});
