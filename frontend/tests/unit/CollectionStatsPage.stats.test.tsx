import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionStatsPage } from '../../src/pages/CollectionStatsPage';
import { ApiError } from '../../src/services/apiClient';
import type { CollectionStatistics } from '../../src/services/collectionStatsApi';

const mocks = vi.hoisted(() => ({
  useCollectionStatistics: vi.fn(),
  useProgressiveValuation: vi.fn(),
}));

vi.mock('../../src/queries/collectionStatsQueries', () => mocks);

function buildStatistics(
  overrides: Partial<CollectionStatistics> = {},
): CollectionStatistics {
  return {
    totalRecords: 312,
    byDecade: {
      buckets: [
        { label: '1980s', count: 96 },
        { label: '1970s', count: 74 },
        { label: 'Año desconocido', count: 7 },
      ],
      others: null,
    },
    byGenre: {
      buckets: [
        { label: 'Rock', count: 210 },
        { label: 'Electronic', count: 44 },
      ],
      others: { count: 18, hiddenBuckets: 6 },
    },
    byStyle: {
      buckets: [{ label: 'Heavy Metal', count: 71 }],
      others: { count: 33, hiddenBuckets: 12 },
    },
    byLabel: {
      buckets: [{ label: 'Roadrunner Records', count: 12 }],
      others: { count: 140, hiddenBuckets: 88 },
    },
    topArtists: [
      { name: 'Iron Maiden', count: 14 },
      { name: 'Metallica', count: 11 },
    ],
    mostPresentArtist: { name: 'Iron Maiden', count: 14 },
    growth: {
      granularity: 'month',
      points: [
        { period: '2023-01', added: 4, cumulative: 4 },
        { period: '2023-02', added: 9, cumulative: 13 },
      ],
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/stats']}>
      <CollectionStatsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCollectionStatistics.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  });
  mocks.useProgressiveValuation.mockReturnValue({
    valuation: null,
    perDisc: null,
    progress: 0,
    notice: null,
    status: 'idle',
    retry: vi.fn(),
  });
});

describe('CollectionStatsPage — Block 1 statistics', () => {
  it('shows a loading skeleton while the statistics load', () => {
    renderPage();

    expect(screen.getByTestId('stats-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  describe('Discogs link gate (FR-002)', () => {
    it('renders the stats link-required gate and no statistics for discogs_not_linked', () => {
      mocks.useCollectionStatistics.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Not linked', 409, 'discogs_not_linked'),
      });

      renderPage();

      expect(screen.getByText(/link your discogs account/i)).toBeInTheDocument();
      expect(screen.getByText(/built from your discogs collection/i)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /go to your profile/i }),
      ).toBeInTheDocument();

      // No statistics content leaks past the gate.
      expect(screen.queryByTestId('stats-skeleton')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /by genre/i }),
      ).not.toBeInTheDocument();
    });

    it('renders the relink gate for discogs_link_invalid', () => {
      mocks.useCollectionStatistics.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Invalid link', 401, 'discogs_link_invalid'),
      });

      renderPage();

      expect(screen.getByText(/no longer valid/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /by genre/i }),
      ).not.toBeInTheDocument();
    });

    it('shows a generic error (not the gate) for an unrelated failure', () => {
      mocks.useCollectionStatistics.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Boom', 500, 'internal_error'),
      });

      renderPage();

      expect(screen.queryByText(/link your discogs account/i)).not.toBeInTheDocument();
      expect(screen.getByText(/something went wrong/i)).toHaveAttribute('role', 'alert');
    });
  });

  it('shows an empty state (not an error) for an empty collection', () => {
    mocks.useCollectionStatistics.mockReturnValue({
      data: buildStatistics({
        totalRecords: 0,
        byDecade: { buckets: [], others: null },
        byGenre: { buckets: [], others: null },
        byStyle: { buckets: [], others: null },
        byLabel: { buckets: [], others: null },
        topArtists: [],
        mostPresentArtist: null,
        growth: { granularity: 'month', points: [] },
      }),
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText(/no records yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /by genre/i })).not.toBeInTheDocument();
  });

  describe('populated collection', () => {
    beforeEach(() => {
      mocks.useCollectionStatistics.mockReturnValue({
        data: buildStatistics(),
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('renders totals, the four breakdowns, top artists and the growth chart', () => {
      renderPage();

      // Totals
      expect(screen.getByText('312')).toBeInTheDocument();

      // Four breakdowns
      expect(screen.getByRole('heading', { name: /by decade/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /by genre/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /by style/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /by label/i })).toBeInTheDocument();

      // Top artists
      expect(screen.getByRole('heading', { name: /top artists/i })).toBeInTheDocument();
      expect(screen.getByText(/most present/i)).toBeInTheDocument();
      expect(screen.getAllByText('Iron Maiden').length).toBeGreaterThan(0);

      // Growth chart
      expect(screen.getByRole('img', { name: /growth/i })).toBeInTheDocument();
    });

    it('collapses the breakdown tail behind an "Otros" button that expands it', async () => {
      const user = userEvent.setup();
      renderPage();

      const othersButton = screen.getByRole('button', { name: /otros \(18\)/i });
      expect(othersButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/6 more values/i)).not.toBeInTheDocument();

      await user.click(othersButton);

      expect(othersButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/6 more values/i)).toBeInTheDocument();
    });
  });
});
