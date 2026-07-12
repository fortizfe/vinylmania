import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function renderPage(initialEntries: string[] = ['/app/library']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
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

  it('does not show an "Add a record" link now that search lives in the header (FR-008, FR-009)', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    renderPage();

    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /add a record/i })).not.toBeInTheDocument();
    // The Refresh action and the rest of the page are unaffected by the removal.
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
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
      new ApiError(
        'Link your Discogs account to use your library.',
        409,
        'discogs_not_linked',
      ),
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

    await waitFor(() => expect(screen.getByText(/no longer valid/i)).toBeInTheDocument());
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

    await waitFor(() => expect(mockList).toHaveBeenCalledWith(1, 20, true, {}));
  });
});

describe('Shared collapsible filters on My Library (feature 038, US2)', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  function releaseEntry(
    id: string,
    title: string,
    overrides: { genre?: string[]; style?: string[]; format?: string[] } = {},
  ) {
    return {
      id,
      discogsReleaseId: Number(id.replace(/\D/g, '')) || 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'ok',
      release: {
        discogsId: 1,
        title,
        artists: [],
        labels: [],
        formats: [],
        genres: [],
        styles: [],
        tracklist: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
      ...overrides,
    };
  }

  it('renders the same collapsible filter component (collapsed by default) above the records grid (FR-016)', async () => {
    mockList.mockResolvedValue({
      items: [releaseEntry('entry-1', 'Stockholm')],
      page: 1,
      pageSize: 20,
      totalItems: 1,
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^genre$/i })).not.toBeInTheDocument();
  });

  it('applying a Genre filter narrows the displayed entries and updates pagination totals (FR-017)', async () => {
    mockList.mockImplementation((_page, _pageSize, _refresh, filters) => {
      if (filters?.genre?.includes('Rock')) {
        return Promise.resolve({
          items: [releaseEntry('entry-1', 'Rock Only')],
          page: 1,
          pageSize: 20,
          totalItems: 1,
        });
      }
      return Promise.resolve({
        items: [releaseEntry('entry-1', 'Rock Only'), releaseEntry('entry-2', 'Jazz Only')],
        page: 1,
        pageSize: 20,
        totalItems: 2,
      });
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Jazz Only')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /^genre$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Rock'));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => expect(screen.getByText('Rock Only')).toBeInTheDocument());
    expect(screen.queryByText('Jazz Only')).not.toBeInTheDocument();
  });

  it('shows a "no results for the active filters" message distinct from the empty-library message (FR-021)', async () => {
    mockList.mockImplementation((_page, _pageSize, _refresh, filters) => {
      if (filters?.genre?.includes('Non-Music')) {
        return Promise.resolve({ items: [], page: 1, pageSize: 20, totalItems: 0 });
      }
      return Promise.resolve({
        items: [releaseEntry('entry-1', 'Stockholm')],
        page: 1,
        pageSize: 20,
        totalItems: 1,
      });
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /^genre$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Non-Music'));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() =>
      expect(screen.getByText(/no results for the active filters/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/no records yet/i)).not.toBeInTheDocument();
  });

  it('keeps filters active when navigating to another page (FR-022)', async () => {
    mockList.mockImplementation((page) =>
      Promise.resolve({
        items: [releaseEntry(`entry-${page}`, `Rock Result Page ${page}`)],
        page,
        pageSize: 20,
        totalItems: 40,
      }),
    );

    renderPage(['/app/library?genre=Rock']);
    await waitFor(() => expect(screen.getByText(/rock result page 1/i)).toBeInTheDocument());
    expect(mockList).toHaveBeenLastCalledWith(1, 20, false, { genre: ['Rock'] });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() => expect(screen.getByText(/rock result page 2/i)).toBeInTheDocument());
    expect(mockList).toHaveBeenLastCalledWith(2, 20, false, { genre: ['Rock'] });
  });
});
