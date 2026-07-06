import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../src/services/apiClient';
import { LibraryListPage } from '../../src/pages/LibraryListPage';
import { createTestQueryClient } from '../testUtils';

const mockList = vi.fn();

vi.mock('../../src/services/libraryApi', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <LibraryListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Library list flow (US2)', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('renders every entry in the library', async () => {
    mockList.mockResolvedValue({
      items: [
        {
          id: 'entry-1',
          discogsReleaseId: 1,
          addedAt: '2026-07-03T00:00:00.000Z',
          catalogStatus: 'ok',
          release: {
            discogsId: 1,
            title: 'Stockholm',
            artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
            labels: [],
            formats: [],
            genres: [],
            styles: [],
            tracklist: [],
            images: [],
            discogsUrl: 'https://www.discogs.com/release/1',
          },
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
  });

  it('shows a clear empty state when the library has no entries', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    renderPage();

    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
  });

  it('shows skeleton placeholders while the library is loading, then replaces them with content', async () => {
    let resolveList!: (value: {
      items: unknown[];
      page: number;
      pageSize: number;
      totalItems: number;
    }) => void;
    mockList.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    renderPage();

    expect(screen.getAllByTestId('record-card-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText(/loading your library/i)).not.toBeInTheDocument();

    resolveList({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
    expect(screen.queryByTestId('record-card-skeleton')).not.toBeInTheDocument();
  });

  it('shows the link-required gate with a profile CTA when the accounts are not linked (FR-003)', async () => {
    mockList.mockRejectedValue(
      new ApiError('Link your Discogs account to use your library.', 409, 'discogs_not_linked'),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/link your discogs account/i)).toBeInTheDocument(),
    );
    const cta = screen.getByRole('link', { name: /go to your profile/i });
    expect(cta).toHaveAttribute('href', '/app/profile');
    // No library content or actions while gated.
    expect(screen.queryByRole('link', { name: /add a record/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('shows the re-link variant when the stored Discogs link is no longer valid (FR-012)', async () => {
    mockList.mockRejectedValue(
      new ApiError('Your Discogs link is no longer valid.', 401, 'discogs_link_invalid'),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no longer valid/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /go to your profile/i })).toHaveAttribute(
      'href',
      '/app/profile',
    );
  });

  it('offers a Refresh action that forces a fresh synchronization (FR-014)', async () => {
    const entryPage = { items: [], page: 1, pageSize: 20, totalItems: 0 };
    mockList.mockResolvedValue(entryPage);

    renderPage();
    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(mockList).toHaveBeenCalledWith(1, 20, true));
  });
});
