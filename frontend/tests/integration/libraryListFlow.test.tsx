import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../src/services/apiClient';
import { LibraryListPage } from '../../src/pages/LibraryListPage';
import { createTestQueryClient } from '../testUtils';

const mockList = vi.fn();

vi.mock('../../src/services/libraryApi', () => ({
  list: (...args: unknown[]) => mockList(...args),
}));

const DEFAULT_SORT = { sort: 'added', dir: 'desc' } as const;

// Feature 068, US2: jsdom has no IntersectionObserver. This stub records every
// observer the page creates (with its options, so the 300 px rootMargin can be
// asserted) and lets a test fire the "sentinel reached" callback by hand.
interface RecordedObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const observers: RecordedObserver[] = [];

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): IntersectionObserverEntry[] => [];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? '';
    observers.push({
      callback,
      options,
      observe: this.observe,
      disconnect: this.disconnect,
    });
  }
}

function lastObserver(): RecordedObserver {
  const observer = observers.at(-1);
  if (!observer) throw new Error('no IntersectionObserver was created');
  return observer;
}

/** Fires the current sentinel observer as if the user scrolled to it. */
async function scrollToSentinel(isIntersecting = true) {
  const observer = observers.at(-1);
  if (!observer) return;
  await act(async () => {
    observer.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  });
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

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

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        1,
        20,
        true,
        {},
        { sort: 'added', dir: 'desc' },
      ),
    );
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
        items: [
          releaseEntry('entry-1', 'Rock Only'),
          releaseEntry('entry-2', 'Jazz Only'),
        ],
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

  it('keeps filters active when the next batch is loaded (FR-022)', async () => {
    mockList.mockImplementation((page) =>
      Promise.resolve({
        items: [releaseEntry(`entry-${page}`, `Rock Result Page ${page}`)],
        page,
        pageSize: 20,
        totalItems: 40,
      }),
    );

    renderPage(['/app/library?genre=Rock']);
    await waitFor(() =>
      expect(screen.getByText(/rock result page 1/i)).toBeInTheDocument(),
    );
    expect(mockList).toHaveBeenLastCalledWith(
      1,
      20,
      false,
      { genre: ['Rock'] },
      DEFAULT_SORT,
    );

    // Feature 068, US2: Previous/Next are gone; the next batch arrives on scroll.
    await scrollToSentinel();

    await waitFor(() =>
      expect(screen.getByText(/rock result page 2/i)).toBeInTheDocument(),
    );
    expect(mockList).toHaveBeenLastCalledWith(
      2,
      20,
      false,
      { genre: ['Rock'] },
      DEFAULT_SORT,
    );
  });
});

describe('View mode toggle (feature 052, US1)', () => {
  beforeEach(() => {
    mockList.mockReset();
    window.localStorage.clear();
  });

  it('renders the toggle in the header row beside Refresh', async () => {
    mockList.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0 });

    renderPage();

    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
    expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('switches from grid to list without losing already-loaded records or changing refresh behavior', async () => {
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
            artists: [],
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
    expect(screen.getByTestId('library-record-grid')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTestId('view-mode-list'));

    expect(screen.queryByTestId('library-record-grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('library-record-list')).toBeInTheDocument();
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('renders row-shaped skeletons instead of grid-card skeletons while loading in list mode', async () => {
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
    await waitFor(() =>
      expect(screen.getAllByTestId('record-card-skeleton').length).toBeGreaterThan(0),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('view-mode-list'));

    expect(screen.getAllByTestId('record-list-row-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('record-card-skeleton')).not.toBeInTheDocument();

    resolveList({ items: [], page: 1, pageSize: 20, totalItems: 0 });
    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());
  });
});

describe('Sorting the library (feature 068, US1 AS2/AS5/AS6, FR-008)', () => {
  const byArtist = { sort: 'artist', dir: 'asc' } as const;
  const byAlbumDesc = { sort: 'album', dir: 'desc' } as const;
  let lastLocation: { search: string; navigationType: string };

  function LocationProbe() {
    const location = useLocation();
    lastLocation = { search: location.search, navigationType: useNavigationType() };
    return null;
  }

  function renderWithProbe(initialEntry: string) {
    return render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LibraryListPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function entry(id: string, title: string) {
    return {
      id,
      discogsReleaseId: 1,
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
    };
  }

  function listPage(title: string) {
    return { items: [entry('entry-1', title)], page: 1, pageSize: 20, totalItems: 1 };
  }

  function currentParams() {
    return new URLSearchParams(lastLocation.search);
  }

  beforeEach(() => {
    mockList.mockReset();
    window.localStorage.clear();
  });

  it('a deep link requests the library with its sort and filters and shows that option selected', async () => {
    mockList.mockResolvedValue(listPage('Deep Linked'));

    renderWithProbe('/app/library?sort=artist&dir=asc&genre=Rock');

    await waitFor(() => expect(screen.getByText('Deep Linked')).toBeInTheDocument());
    expect(mockList).toHaveBeenLastCalledWith(
      1,
      20,
      false,
      { genre: ['Rock'] },
      byArtist,
    );
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveDisplayValue(
      'Artist (A → Z)',
    );
  });

  it('announces nothing on the initial load', async () => {
    mockList.mockResolvedValue(listPage('Initial'));

    renderWithProbe('/app/library');

    await waitFor(() => expect(screen.getByText('Initial')).toBeInTheDocument());
    expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();
  });

  it('changing the select replaces the URL (filters kept, no page) and announces once after the new data renders, keeping focus', async () => {
    let resolveSorted!: (value: ReturnType<typeof listPage>) => void;
    mockList.mockImplementation((...args: unknown[]) => {
      const sort = args[4] as { sort?: string } | undefined;
      if (sort?.sort === 'artist') {
        return new Promise((resolve) => {
          resolveSorted = resolve;
        });
      }
      return Promise.resolve(listPage('Newest Order'));
    });

    renderWithProbe('/app/library?genre=Rock');
    await waitFor(() => expect(screen.getByText('Newest Order')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort' }),
      screen.getByRole('option', { name: 'Artist (A → Z)' }),
    );

    // URL: replaced (no new history entry), sort + filters kept, page dropped.
    await waitFor(() => expect(currentParams().get('sort')).toBe('artist'));
    expect(lastLocation.navigationType).toBe('REPLACE');
    expect(currentParams().get('dir')).toBe('asc');
    expect(currentParams().get('genre')).toBe('Rock');
    expect(currentParams().get('page')).toBeNull();
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        1,
        20,
        false,
        { genre: ['Rock'] },
        byArtist,
      ),
    );

    // Not announced before the new results render.
    expect(screen.queryByText(/^Sorted by/)).not.toBeInTheDocument();

    resolveSorted(listPage('Artist Order'));

    await waitFor(() => expect(screen.getByText('Artist Order')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('Sorted by artist, A to Z.')).toBeInTheDocument(),
    );
    const announcements = screen.getAllByText('Sorted by artist, A to Z.');
    expect(announcements).toHaveLength(1);
    expect(announcements[0].closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveFocus();
  });

  it('applying a filter keeps sort and dir in the URL and in the request', async () => {
    mockList.mockResolvedValue(listPage('Album Order'));

    renderWithProbe('/app/library?sort=album&dir=desc');
    await waitFor(() => expect(screen.getByText('Album Order')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.click(screen.getByRole('button', { name: /^genre$/i }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('Rock'));
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => expect(currentParams().get('genre')).toBe('Rock'));
    expect(currentParams().get('sort')).toBe('album');
    expect(currentParams().get('dir')).toBe('desc');
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        1,
        20,
        false,
        { genre: ['Rock'] },
        byAlbumDesc,
      ),
    );
  });
});

/**
 * Feature 068, US2 (T029) — infinite scroll replaces Previous/Next
 * (FR-010–FR-014, FR-028, US2 AS1–AS5, contracts/library-ui §5).
 */
describe('Infinite scroll on the library (feature 068, US2)', () => {
  function entry(id: string, title: string) {
    return {
      id,
      discogsReleaseId: 1,
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
        identifiers: [],
        tracklist: [],
        images: [],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
    };
  }

  /** A batch of `count` entries for `page`, titled "Record <page>-<i>". */
  function batch(page: number, count: number, totalItems: number) {
    return {
      items: Array.from({ length: count }, (_, index) =>
        entry(`p${page}-e${index}`, `Record ${page}-${index}`),
      ),
      page,
      pageSize: 20,
      totalItems,
    };
  }

  /** Serves page N from `pages`, keyed by the page argument. */
  function servePages(pages: Record<number, unknown>) {
    mockList.mockImplementation((page: number) =>
      page in pages
        ? Promise.resolve(pages[page])
        : Promise.reject(new Error(`unexpected page ${page}`)),
    );
  }

  beforeEach(() => {
    mockList.mockReset();
    window.localStorage.clear();
  });

  it('observes a sentinel 300 px before the end of the loaded content (AS1, FR-010)', async () => {
    servePages({ 1: batch(1, 20, 45) });

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());

    expect(lastObserver().options?.rootMargin).toBe('0px 0px 300px 0px');
    expect(lastObserver().observe).toHaveBeenCalled();
  });

  it('appends the next batch on intersection, with same-size placeholders inside the same list (AS1, AS2, FR-011)', async () => {
    let resolvePage2!: (value: unknown) => void;
    mockList.mockImplementation((page: number) =>
      page === 1
        ? Promise.resolve(batch(1, 20, 45))
        : new Promise((resolve) => {
            resolvePage2 = resolve;
          }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());

    await scrollToSentinel();
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(2, 20, false, {}, DEFAULT_SORT),
    );

    // min(20, 45 - 20) placeholders, in the very same <ul> as the records.
    const grid = screen.getByTestId('library-record-grid');
    await waitFor(() =>
      expect(within(grid).getAllByTestId('record-card-skeleton')).toHaveLength(20),
    );
    expect(within(grid).getByText('Record 1-0')).toBeInTheDocument();

    await act(async () => {
      resolvePage2(batch(2, 20, 45));
    });

    await waitFor(() => expect(screen.getByText('Record 2-19')).toBeInTheDocument());
    expect(screen.getByText('Record 1-0')).toBeInTheDocument();
    expect(screen.queryByTestId('record-card-skeleton')).not.toBeInTheDocument();
  });

  it('no longer renders Previous/Next pagination buttons (FR-010)', async () => {
    servePages({ 1: batch(1, 20, 45) });

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /^previous$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('shows the end message with the total and stops requesting (AS3, FR-012)', async () => {
    let resolvePage2!: (value: unknown) => void;
    mockList.mockImplementation((page: number) =>
      page === 1
        ? Promise.resolve(batch(1, 20, 21))
        : new Promise((resolve) => {
            resolvePage2 = resolve;
          }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());
    expect(
      screen.queryByText(/you've reached the end of your collection/i),
    ).not.toBeInTheDocument();

    await scrollToSentinel();
    // A short last batch reserves only the row it will fill: min(20, 21 - 20).
    const grid = screen.getByTestId('library-record-grid');
    await waitFor(() =>
      expect(within(grid).getAllByTestId('record-card-skeleton')).toHaveLength(1),
    );

    await act(async () => {
      resolvePage2(batch(2, 1, 21));
    });

    await waitFor(() =>
      expect(
        screen.getByText("You've reached the end of your collection — 21 records"),
      ).toBeInTheDocument(),
    );

    const callsAtEnd = mockList.mock.calls.length;
    await scrollToSentinel();
    expect(mockList.mock.calls).toHaveLength(callsAtEnd);
  });

  it('uses the singular form for a collection of one record (FR-012)', async () => {
    servePages({ 1: batch(1, 1, 1) });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("You've reached the end of your collection — 1 record"),
      ).toBeInTheDocument(),
    );
  });

  it('renders neither the end message nor a sentinel when there are no records', async () => {
    servePages({ 1: batch(1, 0, 0) });

    renderPage();
    await waitFor(() => expect(screen.getByText(/no records yet/i)).toBeInTheDocument());

    expect(
      screen.queryByText(/you've reached the end of your collection/i),
    ).not.toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  it('keeps the loaded records and pauses on a failed batch until Retry (AS4, FR-013)', async () => {
    let failPage2 = true;
    mockList.mockImplementation((page: number) => {
      if (page === 1) return Promise.resolve(batch(1, 20, 45));
      if (failPage2) return Promise.reject(new Error('boom'));
      return Promise.resolve(batch(2, 20, 45));
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());

    await scrollToSentinel();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Couldn't load more records. Please try again.",
      ),
    );
    // Already-loaded records stay; no full-page error replaces them.
    expect(screen.getByText('Record 1-0')).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong while loading/i),
    ).not.toBeInTheDocument();

    // Automatic loading is paused: further intersections request nothing.
    const callsAfterFailure = mockList.mock.calls.length;
    await scrollToSentinel();
    expect(mockList.mock.calls).toHaveLength(callsAfterFailure);

    failPage2 = false;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^retry$/i }));

    await waitFor(() => expect(screen.getByText('Record 2-0')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still shows the full-page error when the first batch fails (AS5)', async () => {
    mockList.mockRejectedValue(new Error('boom'));

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/something went wrong while loading your library/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /^retry$/i })).not.toBeInTheDocument();
  });

  it('announces each appended batch, and the end only when a later batch closes the collection (FR-028, contracts §5)', async () => {
    servePages({ 1: batch(1, 20, 45), 2: batch(2, 20, 45), 3: batch(3, 5, 45) });

    renderPage();
    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());

    await scrollToSentinel();
    await waitFor(() => expect(screen.getByText('Record 2-0')).toBeInTheDocument());
    const batchAnnouncement = screen.getByText('20 more records loaded.');
    expect(batchAnnouncement.closest('[role="status"]')).not.toBeNull();

    await scrollToSentinel();
    await waitFor(() =>
      expect(
        screen.getByText('5 more records loaded. End of collection, 45 records.'),
      ).toBeInTheDocument(),
    );
  });

  it('makes no end announcement when the first batch is also the last (contracts §5)', async () => {
    servePages({ 1: batch(1, 5, 5) });

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("You've reached the end of your collection — 5 records"),
      ).toBeInTheDocument(),
    );

    expect(screen.queryByText(/End of collection/)).not.toBeInTheDocument();
    expect(screen.queryByText(/more records loaded/)).not.toBeInTheDocument();
  });
});

/**
 * Feature 068, US3 (T050) — header count, live filters applied from the
 * toolbar panel, and the rapid-change rule. FR-014, FR-015, FR-020, FR-021,
 * FR-021a, FR-028; spec edge case "rapid sort/filter changes";
 * contracts/library-ui §3–§5.
 */
describe('Library header and live filters (feature 068, US3)', () => {
  let lastLocation: { search: string; navigationType: string };

  function LocationProbe() {
    const location = useLocation();
    lastLocation = { search: location.search, navigationType: useNavigationType() };
    return null;
  }

  function renderWithProbe(initialEntry = '/app/library') {
    return render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LibraryListPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function entry(id: string, title: string) {
    return {
      id,
      discogsReleaseId: 1,
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
    };
  }

  function result(titles: string[], totalItems = titles.length, page = 1) {
    return {
      items: titles.map((title, index) => entry(`${page}-${index}-${title}`, title)),
      page,
      pageSize: 20,
      totalItems,
    };
  }

  function currentParams() {
    return new URLSearchParams(lastLocation.search);
  }

  /** Opens the phone-sized "Sort & Filter" panel and returns its dialog. */
  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /sort & filter/i }));
    return screen.getByRole('dialog');
  }

  beforeEach(() => {
    mockList.mockReset();
    window.localStorage.clear();
    // Phone-sized: the capsule + bottom sheet path, and no reduced motion.
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('shows the title, the record count for the current filters and Refresh (FR-020)', async () => {
    mockList.mockResolvedValue(result(['Record 1-0'], 45));

    renderWithProbe();

    await waitFor(() => expect(screen.getByText('Record 1-0')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Your library' })).toBeVisible();
    // The same total as the end message, not the number of loaded records.
    expect(screen.getByText('45 records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('uses the singular record count for a one-record library (FR-020)', async () => {
    mockList.mockResolvedValue(result(['Only One'], 1));

    renderWithProbe();

    await waitFor(() => expect(screen.getByText('Only One')).toBeInTheDocument());
    expect(screen.getByText('1 record')).toBeInTheDocument();
  });

  it('applies a genre tick live: URL replaced with sort kept, batch 1 restarted, new total announced', async () => {
    mockList.mockImplementation(
      (page: number, _size: number, _refresh: boolean, filters) =>
        Promise.resolve(
          filters?.genre?.includes('Rock')
            ? result(['Rock Record'], 3, page)
            : result(['Everything'], 45, page),
        ),
    );

    renderWithProbe('/app/library?sort=album&dir=desc');
    await waitFor(() => expect(screen.getByText('Everything')).toBeInTheDocument());

    const user = userEvent.setup();
    const dialog = await openPanel(user);
    await user.click(within(dialog).getByLabelText('Rock'));

    // URL: replaced, sort kept, no page cursor (FR-021a, contracts §1).
    await waitFor(() => expect(currentParams().get('genre')).toBe('Rock'));
    expect(lastLocation.navigationType).toBe('REPLACE');
    expect(currentParams().get('sort')).toBe('album');
    expect(currentParams().get('dir')).toBe('desc');
    expect(currentParams().get('page')).toBeNull();

    // Restarted from batch 1 with the new filters, and the old rows are gone.
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        1,
        20,
        false,
        { genre: ['Rock'] },
        { sort: 'album', dir: 'desc' },
      ),
    );
    await waitFor(() => expect(screen.getByText('Rock Record')).toBeInTheDocument());
    expect(screen.queryByText('Everything')).not.toBeInTheDocument();

    // Count and polite announcement both reflect the new total (FR-028).
    expect(screen.getByText('3 records')).toBeInTheDocument();
    const announcement = screen.getByText('Showing 3 records.');
    expect(announcement.closest('[role="status"]')).not.toBeNull();
  });

  it('announces the empty result distinctly when no record matches (contracts §5)', async () => {
    mockList.mockImplementation(
      (page: number, _size: number, _refresh: boolean, filters) =>
        Promise.resolve(
          filters?.genre?.includes('Rock')
            ? result([], 0, page)
            : result(['Everything'], 45, page),
        ),
    );

    renderWithProbe();
    await waitFor(() => expect(screen.getByText('Everything')).toBeInTheDocument());

    const user = userEvent.setup();
    const dialog = await openPanel(user);
    await user.click(within(dialog).getByLabelText('Rock'));

    await waitFor(() =>
      expect(
        screen.getByText('No records match the active filters.'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText('No records match the active filters.').closest('[role="status"]'),
    ).not.toBeNull();
    expect(screen.getByText('0 records')).toBeInTheDocument();
  });

  it('shows and announces only the latest selection when an earlier response lands late (FR-015)', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    mockList.mockImplementation(
      (page: number, _size: number, _refresh: boolean, filters) => {
        const key = (filters?.genre ?? []).join('+');
        if (key === '') return Promise.resolve(result(['Everything'], 45, page));
        return new Promise((resolve) => {
          pending.set(key, resolve as (value: unknown) => void);
        });
      },
    );

    renderWithProbe();
    await waitFor(() => expect(screen.getByText('Everything')).toBeInTheDocument());

    const user = userEvent.setup();
    const dialog = await openPanel(user);
    // Two quick ticks: Rock, then Jazz — neither response has landed yet.
    await user.click(within(dialog).getByLabelText('Rock'));
    await user.click(within(dialog).getByLabelText('Jazz'));

    await waitFor(() => expect(pending.has('Rock')).toBe(true));
    await waitFor(() => expect(pending.has('Rock+Jazz')).toBe(true));
    expect(currentParams().get('genre')).toBe('Rock,Jazz');

    // Out of order on purpose: the newest selection answers first…
    await act(async () => {
      pending.get('Rock+Jazz')!(result(['Fusion Record'], 3));
    });
    await waitFor(() => expect(screen.getByText('Fusion Record')).toBeInTheDocument());

    // …then the abandoned one answers. It must neither render nor announce.
    await act(async () => {
      pending.get('Rock')!(result(['Rock Record'], 9));
    });

    expect(screen.queryByText('Rock Record')).not.toBeInTheDocument();
    expect(screen.getByText('Fusion Record')).toBeInTheDocument();
    expect(screen.getByText('3 records')).toBeInTheDocument();
    expect(screen.queryByText('Showing 9 records.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Showing 3 records.')).toHaveLength(1);
  });

  it('clearing every filter from the panel restores the unfiltered list (FR-021a)', async () => {
    mockList.mockImplementation(
      (page: number, _size: number, _refresh: boolean, filters) =>
        Promise.resolve(
          filters?.genre?.length
            ? result(['Rock Record'], 3, page)
            : result(['Everything'], 45, page),
        ),
    );

    renderWithProbe('/app/library?genre=Rock');
    await waitFor(() => expect(screen.getByText('Rock Record')).toBeInTheDocument());

    const user = userEvent.setup();
    const dialog = await openPanel(user);
    await user.click(within(dialog).getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect(currentParams().get('genre')).toBeNull());
    await waitFor(() => expect(screen.getByText('Everything')).toBeInTheDocument());
    expect(screen.getByText('Showing 45 records.')).toBeInTheDocument();
  });

  it('Refresh restarts the list from batch 1 (FR-014)', async () => {
    mockList.mockImplementation((page: number, _size: number, refresh: boolean) => {
      if (refresh) return Promise.resolve(result(['Fresh Record'], 40));
      return Promise.resolve(
        page === 1 ? result(['Batch One'], 40) : result(['Batch Two'], 40, 2),
      );
    });

    renderWithProbe();
    await waitFor(() => expect(screen.getByText('Batch One')).toBeInTheDocument());

    await scrollToSentinel();
    await waitFor(() => expect(screen.getByText('Batch Two')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText('Fresh Record')).toBeInTheDocument());
    expect(screen.queryByText('Batch Two')).not.toBeInTheDocument();
    expect(mockList).toHaveBeenLastCalledWith(1, 20, true, {}, DEFAULT_SORT);
  });
});
