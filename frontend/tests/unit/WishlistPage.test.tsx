import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WishlistPage } from '../../src/pages/WishlistPage';
import { ApiError } from '../../src/services/apiClient';
import type { EnrichedWantEntry } from '../../src/services/wantlistApi';

const mocks = vi.hoisted(() => ({
  useWantlist: vi.fn(),
  useRefreshWantlist: vi.fn(),
  useRemoveFromWantlist: vi.fn(),
}));

vi.mock('../../src/queries/wantlistQueries', () => mocks);

function buildEntry(overrides: Partial<EnrichedWantEntry> = {}): EnrichedWantEntry {
  return {
    discogsReleaseId: 1,
    rating: 0,
    notes: null,
    addedAt: '2026-08-01T00:00:00.000Z',
    catalogStatus: 'ok',
    release: {
      discogsId: 1,
      title: 'Discovery',
      artists: [{ discogsArtistId: 1, name: 'Daft Punk' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      community: { have: 1, want: 1, rating: { average: 4.7, count: 100 } },
      tracklist: [],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    },
    ...overrides,
  };
}

function renderPage(initialEntries: string[] = ['/app/wishlist']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <WishlistPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useWantlist.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  });
  mocks.useRefreshWantlist.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  });
  mocks.useRemoveFromWantlist.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  });
});

describe('WishlistPage', () => {
  it('shows skeletons while the wishlist is loading', () => {
    renderPage();

    expect(screen.getAllByTestId('record-card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders a card per entry once the wishlist resolves', () => {
    mocks.useWantlist.mockReturnValue({
      data: {
        items: [
          buildEntry({ discogsReleaseId: 1 }),
          buildEntry({
            discogsReleaseId: 2,
            release: {
              ...buildEntry().release!,
              discogsId: 2,
              title: 'Random Access Memories',
            },
          }),
        ],
        page: 1,
        pageSize: 20,
        totalItems: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Random Access Memories')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows a distinct empty state when the wishlist has no entries', () => {
    mocks.useWantlist.mockReturnValue({
      data: { items: [], page: 1, pageSize: 20, totalItems: 0 },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText(/nothing on your wishlist yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('falls back to the empty state when the last entry is removed (FR-004)', () => {
    mocks.useWantlist.mockReturnValue({
      data: { items: [buildEntry()], page: 1, pageSize: 20, totalItems: 1 },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { rerender } = renderPage();
    expect(screen.getByTestId('wishlist-grid')).toBeInTheDocument();

    // The remove mutation invalidates the list; the refetch now returns [].
    mocks.useWantlist.mockReturnValue({
      data: { items: [], page: 1, pageSize: 20, totalItems: 0 },
      isLoading: false,
      isError: false,
      error: null,
    });
    rerender(
      <MemoryRouter initialEntries={['/app/wishlist']}>
        <WishlistPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('wishlist-grid')).not.toBeInTheDocument();
    expect(screen.getByText(/nothing on your wishlist yet/i)).toBeInTheDocument();
  });

  it('triggers a fresh synchronization from the Refresh button', async () => {
    const mutate = vi.fn();
    mocks.useRefreshWantlist.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    });
    mocks.useWantlist.mockReturnValue({
      data: { items: [buildEntry()], page: 1, pageSize: 20, totalItems: 1 },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();
    await userEvent.setup().click(screen.getByRole('button', { name: /refresh/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  describe('Discogs link gate (FR-002)', () => {
    it('renders the link-required gate and no list/refresh for discogs_not_linked', () => {
      mocks.useWantlist.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Not linked', 409, 'discogs_not_linked'),
      });

      renderPage();

      expect(screen.getByText(/link your discogs account/i)).toBeInTheDocument();
      expect(
        screen.getByText(/synchronized with your discogs wantlist/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /go to your profile/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('renders the relink gate for discogs_link_invalid', () => {
      mocks.useWantlist.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Invalid link', 401, 'discogs_link_invalid'),
      });

      renderPage();

      expect(screen.getByText(/no longer valid/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    });

    it('shows a generic error (not the gate) for an unrelated failure', () => {
      mocks.useWantlist.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Boom', 500, 'internal'),
      });

      renderPage();

      expect(screen.queryByText(/link your discogs account/i)).not.toBeInTheDocument();
      expect(screen.getByText(/something went wrong/i)).toHaveAttribute('role', 'alert');
    });
  });
});
