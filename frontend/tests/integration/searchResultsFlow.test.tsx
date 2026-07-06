import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderSearchBox } from '../../src/components/HeaderSearchBox';
import { SearchResultsPage } from '../../src/pages/SearchResultsPage';
import { createTestQueryClient } from '../testUtils';

const mockSearch = vi.fn();
const mockCreate = vi.fn();
const mockGetRelease = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  search: (...args: unknown[]) => mockSearch(...args),
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

function renderPage(initialEntries: string[] = ['/app/search']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <HeaderSearchBox />
        <SearchResultsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Search results flow (US2)', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockCreate.mockReset();
    mockGetRelease.mockReset();
  });

  it('renders matching result cards with a working add action from a query already in the URL', async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          discogsId: 1,
          resultType: 'release',
          title: 'Stockholm',
          artist: 'The Persuader',
          year: 1999,
          formats: ['Vinyl'],
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: { discogsId: 1, title: 'Stockholm' },
    });

    renderPage(['/app/search?q=Stockholm']);

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenCalledWith('Stockholm', 'release', 1, 20);

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /add to library/i }));
    });

    expect(mockCreate).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /added to library/i })).toBeInTheDocument(),
    );
  });

  it('renders the enriched community rating badge on a search result without blocking add/preview (feature 017, US1)', async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          discogsId: 1,
          resultType: 'release',
          title: 'Stockholm',
          artist: 'The Persuader',
          year: 1999,
          formats: ['Vinyl'],
          communityRating: { average: 4.19, count: 47 },
        },
        {
          discogsId: 2,
          resultType: 'release',
          title: 'Unrated Release',
          artist: 'Nobody',
          year: 2001,
        },
      ],
      pagination: { page: 1, pages: 1, items: 2, perPage: 20 },
    });
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: { discogsId: 1, title: 'Stockholm' },
    });

    renderPage(['/app/search?q=Stockholm']);

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    // The enriched result shows its badge; the unrated result shows none.
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /add to library/i })[0]);
    });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /added to library/i })[0]).toBeInTheDocument(),
    );
  });

  it('previews a result in an overlay without adding it or losing the search results', async () => {
    mockSearch.mockResolvedValue({
      results: [{ discogsId: 1, resultType: 'release', title: 'Stockholm', artist: 'The Persuader' }],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });
    mockGetRelease.mockResolvedValue({
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      identifiers: [],
      tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
      images: [],
      discogsUrl: 'https://www.discogs.com/release/1',
    });

    renderPage(['/app/search?q=Stockholm']);
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /preview details/i }));
    });

    await waitFor(() => expect(screen.getByText(/Östermalm/)).toBeInTheDocument());
    expect(mockGetRelease).toHaveBeenCalledWith(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('updates the results in place when a new query is submitted from the header (FR-005)', async () => {
    mockSearch.mockResolvedValueOnce({
      results: [{ discogsId: 1, resultType: 'release', title: 'Stockholm', artist: 'The Persuader' }],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });

    renderPage(['/app/search?q=Stockholm']);
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    mockSearch.mockResolvedValueOnce({
      results: [{ discogsId: 2, resultType: 'release', title: 'Fresh Result' }],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });

    const user = userEvent.setup();
    await user.clear(screen.getByRole('searchbox', { name: /search discogs/i }));
    await user.type(screen.getByRole('searchbox', { name: /search discogs/i }), 'fresh');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^search$/i }));
    });

    await waitFor(() => expect(screen.getByText('Fresh Result')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenLastCalledWith('fresh', 'release', 1, 20);
    expect(screen.queryByText('Stockholm')).not.toBeInTheDocument();
  });

  it('shows a clear empty state when the search has no matches', async () => {
    mockSearch.mockResolvedValue({
      results: [],
      pagination: { page: 1, pages: 0, items: 0, perPage: 20 },
    });

    renderPage(['/app/search?q=zzzznomatch']);

    await waitFor(() => expect(screen.getByText(/no results/i)).toBeInTheDocument());
  });

  it('shows a clear error message when the search request fails', async () => {
    mockSearch.mockRejectedValue(new Error('network error'));

    renderPage(['/app/search?q=Stockholm']);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i),
    );
  });

  it('paginates without a full reload by updating the page URL param', async () => {
    mockSearch.mockResolvedValueOnce({
      results: [{ discogsId: 1, resultType: 'release', title: 'Stockholm' }],
      pagination: { page: 1, pages: 3, items: 47, perPage: 20 },
    });

    renderPage(['/app/search?q=love']);
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /^previous$/i })).toBeDisabled();

    mockSearch.mockResolvedValueOnce({
      results: [{ discogsId: 2, resultType: 'release', title: 'Page Two Result' }],
      pagination: { page: 2, pages: 3, items: 47, perPage: 20 },
    });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^next$/i }));
    });

    await waitFor(() => expect(screen.getByText('Page Two Result')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenLastCalledWith('love', 'release', 2, 20);
    expect(screen.getByRole('button', { name: /^previous$/i })).not.toBeDisabled();
  });
});
