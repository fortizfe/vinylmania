import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../testUtils';
import { CollectionStatsPage } from '../../src/pages/CollectionStatsPage';
import { formatCurrency } from '../../src/components/valuation/formatCurrency';
import type {
  CollectionStatistics,
  PerDiscValue,
  ValuationChunkResponse,
} from '../../src/services/collectionStatsApi';

// The real `useProgressiveValuation` loop (T044/T053) is under test — mock only
// the service layer.
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

const TOP: PerDiscValue = {
  releaseId: 1,
  instanceId: 11,
  title: 'Kind Of Blue',
  artist: 'Miles Davis',
  mediaCondition: 'Near Mint (NM or M-)',
  value: 150,
  reason: 'ok',
};

/** A partial chunk from a large (500-instance) collection. */
function largePartialChunk(
  overrides: Partial<ValuationChunkResponse> = {},
): ValuationChunkResponse {
  return {
    valuation: {
      currency: 'EUR',
      estimatedTotal: 1200,
      coveredCount: 20,
      totalCount: 500,
      uncovered: { noMarketData: 0, noCondition: 0 },
      topValuable: [TOP],
      status: 'partial',
    },
    status: 'partial',
    nextCursor: 25,
    pricedThisBatch: 25,
    fromCacheThisBatch: 0,
    ...overrides,
  };
}

const money = (value: number) => formatCurrency(value, 'EUR');

function renderPage(client: QueryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/stats']}>
        <CollectionStatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getStatistics.mockResolvedValue(buildStatistics());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CollectionStatsPage — Block 2 at collection scale (US3)', () => {
  it('shows an explicit long-running "come back later" state on a first-run large collection, without blocking Block 1', async () => {
    api.getValuationChunk
      .mockResolvedValueOnce(largePartialChunk())
      // Every following chunk stays pending → the loop never completes.
      .mockImplementation(() => new Promise<ValuationChunkResponse>(() => {}));

    renderPage();
    const user = userEvent.setup();

    // The explicit long-running affordance is real text, not a colour.
    expect(await screen.findByText(/puede tardar un rato/i)).toBeInTheDocument();

    // The partial total is still shown and the coverage label keeps updating.
    expect(screen.getByText(money(1200))).toBeInTheDocument();
    expect(screen.getByText(/estimado sobre 20 de 500 discos/i)).toBeInTheDocument();

    // Block 1 stays rendered and interactive while the valuation runs.
    const othersButton = screen.getByRole('button', { name: /otros \(18\)/i });
    await user.click(othersButton);
    expect(othersButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('resumes from the last running total after navigating away and back — the figure never flashes to zero', async () => {
    const client = createTestQueryClient();

    api.getValuationChunk
      .mockResolvedValueOnce(
        largePartialChunk({
          valuation: {
            currency: 'EUR',
            estimatedTotal: 300,
            coveredCount: 40,
            totalCount: 500,
            uncovered: { noMarketData: 0, noCondition: 0 },
            topValuable: [TOP],
            status: 'partial',
          },
        }),
      )
      .mockImplementation(() => new Promise<ValuationChunkResponse>(() => {}));

    const first = renderPage(client);
    await waitFor(() =>
      expect(screen.getByText(/estimado sobre 40 de 500 discos/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(money(300))).toBeInTheDocument();

    // Navigate away.
    first.unmount();

    // Come back — nothing new has resolved yet.
    renderPage(client);

    // The last running total is shown immediately, seeded from the query cache.
    expect(screen.getByText(money(300))).toBeInTheDocument();
    expect(screen.getByText(/estimado sobre 40 de 500 discos/i)).toBeInTheDocument();
  });

  it('reports transiently-failed discs as retryable and re-drives the loop in "failed" mode', async () => {
    const completeWithFailures: ValuationChunkResponse = {
      valuation: {
        currency: 'EUR',
        estimatedTotal: 250,
        coveredCount: 3,
        totalCount: 8,
        uncovered: { noMarketData: 2, noCondition: 0 },
        topValuable: [TOP],
        status: 'complete',
      },
      status: 'complete',
      pricedThisBatch: 8,
      fromCacheThisBatch: 0,
      retryable: 3,
      perDisc: [TOP],
    };
    const completeClean: ValuationChunkResponse = {
      ...completeWithFailures,
      valuation: { ...completeWithFailures.valuation, coveredCount: 6 },
      retryable: 0,
    };

    api.getValuationChunk
      .mockResolvedValueOnce(completeWithFailures)
      .mockResolvedValue(completeClean);

    renderPage();
    const user = userEvent.setup();

    expect(
      await screen.findByText(/no pudimos consultar el precio de 3 discos/i),
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', {
      name: /reintentar esos discos/i,
    });
    await user.click(retryButton);

    await waitFor(() =>
      expect(api.getValuationChunk).toHaveBeenCalledWith(0, false, 'failed'),
    );

    // After a clean retry the affordance disappears.
    await waitFor(() =>
      expect(
        screen.queryByText(/no pudimos consultar el precio de/i),
      ).not.toBeInTheDocument(),
    );
  });
});
