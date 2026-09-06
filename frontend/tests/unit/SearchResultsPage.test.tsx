import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchResultsPage } from '../../src/pages/SearchResultsPage';
import { createTestQueryClient } from '../testUtils';

const mockSearch = vi.fn();
const mockAddWant = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

vi.mock('../../src/services/wantlistApi', () => ({
  add: (...args: unknown[]) => mockAddWant(...args),
}));

function renderPage(initialEntries: string[] = ['/app/search?q=Stockholm']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/app/search" element={<SearchResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockAddWant.mockReset();
    mockCreate.mockReset();
  });

  it('renders results once the search resolves', async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          discogsId: 1,
          resultType: 'release',
          title: 'Stockholm',
          artist: 'The Persuader',
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
  });

  it('shows the relink notice when the search itself fails with discogs_link_invalid (spec 053, US3)', async () => {
    const { ApiError } = await import('../../src/services/apiClient');
    mockSearch.mockRejectedValue(
      new ApiError('Your Discogs link is no longer valid.', 401, 'discogs_link_invalid'),
    );

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/your discogs link is no longer valid/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /go to your profile/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong while searching/i),
    ).not.toBeInTheDocument();
  });

  it('shows a generic error message for a non-relink search failure', async () => {
    const { ApiError } = await import('../../src/services/apiClient');
    mockSearch.mockRejectedValue(new ApiError('boom', 500, 'internal_error'));

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/something went wrong while searching/i),
      ).toBeInTheDocument(),
    );
  });

  describe('add to wishlist (feature 060, US2)', () => {
    const oneResult = {
      results: [
        {
          discogsId: 7,
          resultType: 'release',
          title: 'Stockholm',
          artist: 'The Persuader',
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    };

    async function renderWithResult() {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
      return user;
    }

    it('adds the release to the wishlist and reflects the in-wishlist state', async () => {
      mockSearch.mockResolvedValue(oneResult);
      mockAddWant.mockResolvedValue({
        discogsReleaseId: 7,
        rating: 0,
        notes: null,
        addedAt: '2026-09-06T00:00:00.000Z',
        catalogStatus: 'ok',
        release: null,
        alreadyInWantlist: false,
        alreadyInLibrary: false,
      });

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      expect(mockAddWant).toHaveBeenCalledWith(7);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /in your wishlist/i }),
        ).toBeInTheDocument(),
      );
    });

    it('surfaces an "already in your library" note when the added want is already owned (FR-007a)', async () => {
      mockSearch.mockResolvedValue(oneResult);
      mockAddWant.mockResolvedValue({
        discogsReleaseId: 7,
        rating: 0,
        notes: null,
        addedAt: '2026-09-06T00:00:00.000Z',
        catalogStatus: 'ok',
        release: null,
        alreadyInWantlist: false,
        alreadyInLibrary: true,
      });

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(
          screen.getByText(/added to your wishlist — already in your library/i),
        ).toBeInTheDocument(),
      );
    });

    it('shows a non-blocking notice when a purchase fails to clear the wishlist (US5)', async () => {
      mockSearch.mockResolvedValue(oneResult);
      mockCreate.mockResolvedValue({
        id: 'entry-7',
        discogsReleaseId: 7,
        addedAt: '2026-09-06T00:00:00.000Z',
        catalogStatus: 'ok',
        release: null,
        wantlistRemoval: 'failed',
      });

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to library/i }));

      const notice = await screen.findByText(
        /added to your library\. we couldn.t remove it from your wishlist — remove it there when you can\./i,
      );
      expect(notice).toHaveAttribute('role', 'status');
      expect(notice).not.toHaveAttribute('role', 'alert');
    });

    it.each(['removed', 'not_in_wantlist', undefined] as const)(
      'shows no wishlist-removal notice when wantlistRemoval is %s (US5)',
      async (wantlistRemoval) => {
        mockSearch.mockResolvedValue(oneResult);
        mockCreate.mockResolvedValue({
          id: 'entry-7',
          discogsReleaseId: 7,
          addedAt: '2026-09-06T00:00:00.000Z',
          catalogStatus: 'ok',
          release: null,
          ...(wantlistRemoval ? { wantlistRemoval } : {}),
        });

        const user = await renderWithResult();
        await user.click(screen.getByRole('button', { name: /add to library/i }));

        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: /added to library/i }),
          ).toBeInTheDocument(),
        );
        expect(
          screen.queryByText(/we couldn.t remove it from your wishlist/i),
        ).not.toBeInTheDocument();
      },
    );

    it('shows a wishlist-specific link-required message when the wishlist add is gated', async () => {
      const { ApiError } = await import('../../src/services/apiClient');
      mockSearch.mockResolvedValue(oneResult);
      mockAddWant.mockRejectedValue(
        new ApiError('not linked', 409, 'discogs_not_linked'),
      );

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(
          screen.getByText(
            /you need to link your discogs account before adding records to your wishlist\./i,
          ),
        ).toBeInTheDocument(),
      );
      // Not the library gate copy — the two add actions gate with distinct messages.
      expect(
        screen.queryByText(/before adding records to your library/i),
      ).not.toBeInTheDocument();
    });

    it('shows the library gate copy when the library add is gated on the same page', async () => {
      const { ApiError } = await import('../../src/services/apiClient');
      mockSearch.mockResolvedValue(oneResult);
      mockCreate.mockRejectedValue(new ApiError('not linked', 409, 'discogs_not_linked'));

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to library/i }));

      await waitFor(() =>
        expect(
          screen.getByText(
            /you need to link your discogs account before adding records to your library\./i,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('shows a retryable alert on a generic wishlist add failure', async () => {
      const { ApiError } = await import('../../src/services/apiClient');
      mockSearch.mockResolvedValue(oneResult);
      mockAddWant.mockRejectedValue(new ApiError('boom', 500, 'internal_error'));

      const user = await renderWithResult();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(
          screen.getByText(
            /something went wrong while adding this record to your wishlist/i,
          ),
        ).toHaveAttribute('role', 'alert'),
      );
    });
  });
});
