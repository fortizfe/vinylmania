import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddRecordPage } from '../../src/pages/AddRecordPage';
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

function LibraryListStub() {
  return <p>Library list</p>;
}

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/library/add']}>
        <Routes>
          <Route path="/app/library/add" element={<AddRecordPage />} />
          <Route path="/app/library" element={<LibraryListStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Add record flow (US1)', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockCreate.mockReset();
    mockGetRelease.mockReset();
  });

  it('searches Discogs, lets the collector pick a result, and adds it to the library without leaving the results', async () => {
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
      pagination: { page: 1, pages: 1, items: 1, perPage: 50 },
    });
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: { discogsId: 1, title: 'Stockholm' },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Stockholm');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenCalledWith('Stockholm', 'release', 1, 20);
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute(
      'href',
      '/app/library',
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /add to library/i }));
    });

    expect(mockCreate).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /added to library/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText('Library list')).not.toBeInTheDocument();
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
  });

  it('renders the enriched community rating badge on a search result without blocking add/preview (US1)', async () => {
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
      pagination: { page: 1, pages: 1, items: 2, perPage: 50 },
    });
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: { discogsId: 1, title: 'Stockholm' },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Stockholm');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    // The enriched result shows its badge; the unrated result shows none.
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /add to library/i })[0]);
    });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /added to library/i })[0]).toBeInTheDocument(),
    );
  });

  it('previews a result in an overlay without adding it or losing the search results', async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          discogsId: 1,
          resultType: 'release',
          title: 'Stockholm',
          artist: 'The Persuader',
          year: 1999,
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 50 },
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

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Stockholm');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /preview details/i }));
    });

    await waitFor(() => expect(screen.getByText(/Östermalm/)).toBeInTheDocument());
    expect(mockGetRelease).toHaveBeenCalledWith(1);
    expect(mockCreate).not.toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /close/i }));
    });

    expect(screen.queryByText(/Östermalm/)).not.toBeInTheDocument();
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
  });

  it('shows skeleton placeholders in the results area while a search is pending', async () => {
    let resolveSearch!: (value: {
      results: unknown[];
      pagination: { page: number; pages: number; items: number; perPage: number };
    }) => void;
    mockSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'Stockholm');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    expect(screen.getByTestId('search-results-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolveSearch({
        results: [
          {
            discogsId: 1,
            resultType: 'release',
            title: 'The Persuader - Stockholm',
            year: 1999,
            formats: ['Vinyl'],
          },
        ],
        pagination: { page: 1, pages: 1, items: 1, perPage: 50 },
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/the persuader - stockholm/i)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('search-results-skeleton')).not.toBeInTheDocument();
  });

  it('shows a clear empty state when the search has no matches', async () => {
    mockSearch.mockResolvedValue({
      results: [],
      pagination: { page: 1, pages: 0, items: 0, perPage: 50 },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'zzzznomatch');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() => expect(screen.getByText(/no results/i)).toBeInTheDocument());
  });

  it('paginates a large result set without a full reload, and resets to page 1 on a new search', async () => {
    mockSearch.mockResolvedValueOnce({
      results: [
        { discogsId: 1, resultType: 'release', title: 'Stockholm', artist: 'The Persuader' },
      ],
      pagination: { page: 1, pages: 3, items: 47, perPage: 20 },
    });

    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'love');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^previous$/i })).toBeDisabled();

    mockSearch.mockResolvedValueOnce({
      results: [{ discogsId: 2, resultType: 'release', title: 'Page Two Result' }],
      pagination: { page: 2, pages: 3, items: 47, perPage: 20 },
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^next$/i }));
    });

    await waitFor(() => expect(screen.getByText('Page Two Result')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenLastCalledWith('love', 'release', 2, 20);
    expect(screen.getByRole('button', { name: /^previous$/i })).not.toBeDisabled();

    mockSearch.mockResolvedValueOnce({
      results: [
        { discogsId: 3, resultType: 'release', title: 'Fresh Search Result' },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
    });

    await user.clear(screen.getByRole('textbox', { name: /search/i }));
    await user.type(screen.getByRole('textbox', { name: /search/i }), 'fresh');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /search/i }));
    });

    await waitFor(() => expect(screen.getByText('Fresh Search Result')).toBeInTheDocument());
    expect(mockSearch).toHaveBeenLastCalledWith('fresh', 'release', 1, 20);
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });
});
