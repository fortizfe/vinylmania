import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchResultsPage } from '../../src/pages/SearchResultsPage';
import { createTestQueryClient } from '../testUtils';

const mockSearch = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: vi.fn(),
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
  });

  it('renders results once the search resolves', async () => {
    mockSearch.mockResolvedValue({
      results: [{ discogsId: 1, resultType: 'release', title: 'Stockholm', artist: 'The Persuader' }],
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
      expect(screen.getByText(/your discogs link is no longer valid/i)).toBeInTheDocument(),
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
      expect(screen.getByText(/something went wrong while searching/i)).toBeInTheDocument(),
    );
  });
});
