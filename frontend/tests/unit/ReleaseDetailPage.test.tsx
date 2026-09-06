import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseDetailPage } from '../../src/pages/ReleaseDetailPage';
import { ApiError } from '../../src/services/apiClient';
import { createTestQueryClient } from '../testUtils';

const mockGetRelease = vi.fn();
const mockCreate = vi.fn();
const mockAddWant = vi.fn();
const mockGetWantEntry = vi.fn();
const mockUpdateWantEntry = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

vi.mock('../../src/services/wantlistApi', () => ({
  add: (...args: unknown[]) => mockAddWant(...args),
  getOne: (...args: unknown[]) => mockGetWantEntry(...args),
  update: (...args: unknown[]) => mockUpdateWantEntry(...args),
}));

const fullRelease = {
  discogsId: 1,
  title: 'Stockholm',
  year: 1999,
  country: 'Sweden',
  releaseDate: '1999-05-01',
  notes: 'Recorded at Stockholm Sound Studio.',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
  formats: [{ name: 'Vinyl', quantity: 2, descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
  community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
  tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' as const }],
  discogsUrl: 'https://www.discogs.com/release/1',
};

function renderPage(initialEntries: string[] = ['/app/releases/1']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/app/releases/:discogsId" element={<ReleaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReleaseDetailPage', () => {
  beforeEach(() => {
    mockGetRelease.mockReset();
    mockCreate.mockReset();
    mockAddWant.mockReset();
    mockGetWantEntry.mockReset();
    mockUpdateWantEntry.mockReset();
    // Default: the release is NOT in the wantlist (GET 404 not_in_wantlist).
    mockGetWantEntry.mockRejectedValue(
      new ApiError('not in wantlist', 404, 'not_in_wantlist'),
    );
  });

  it('renders a skeleton loading state while the release is loading', () => {
    mockGetRelease.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('record-detail-skeleton')).toBeInTheDocument();
  });

  it('renders all catalog sections once the release loads', async () => {
    mockGetRelease.mockResolvedValue(fullRelease);

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText('Sweden')).toBeInTheDocument();
    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded at Stockholm Sound Studio/)).toBeInTheDocument();
    expect(screen.getByText(/7 39051 23421 6/)).toBeInTheDocument();
    expect(screen.getByText(/214 have/)).toBeInTheDocument();
    expect(mockGetRelease).toHaveBeenCalledWith(1);
  });

  it('adds the release to the library and shows an added state', async () => {
    mockGetRelease.mockResolvedValue(fullRelease);
    mockCreate.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-08T00:00:00.000Z',
      catalogStatus: 'ok',
      release: fullRelease,
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    expect(mockCreate).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /added to library/i }),
      ).toBeInTheDocument(),
    );
  });

  describe('wantlist auto-removal on purchase (feature 060, US5)', () => {
    const wishlistRemovalNotice =
      /added to your library\. we couldn.t remove it from your wishlist — remove it there when you can\./i;

    const addedEntry = {
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-09-06T00:00:00.000Z',
      catalogStatus: 'ok',
      release: fullRelease,
    };

    it('shows a non-blocking notice when the wantlist removal failed', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockCreate.mockResolvedValue({ ...addedEntry, wantlistRemoval: 'failed' });

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add to library/i }));

      const notice = await screen.findByText(wishlistRemovalNotice);
      expect(notice).toHaveAttribute('role', 'status');
      expect(notice).not.toHaveAttribute('role', 'alert');
    });

    it.each(['removed', 'not_in_wantlist', undefined] as const)(
      'shows no extra notice when wantlistRemoval is %s',
      async (wantlistRemoval) => {
        mockGetRelease.mockResolvedValue(fullRelease);
        mockCreate.mockResolvedValue(
          wantlistRemoval ? { ...addedEntry, wantlistRemoval } : addedEntry,
        );

        renderPage();
        await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: /add to library/i }));

        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: /added to library/i }),
          ).toBeInTheDocument(),
        );
        expect(screen.queryByText(wishlistRemovalNotice)).not.toBeInTheDocument();
      },
    );
  });

  it('shows link/relink guidance when Add fails due to a Discogs gating error', async () => {
    mockGetRelease.mockResolvedValue(fullRelease);
    const { ApiError } = await import('../../src/services/apiClient');
    mockCreate.mockRejectedValue(new ApiError('not linked', 409, 'discogs_not_linked'));

    renderPage();
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() =>
      expect(
        screen.getByText(
          /link your Discogs account before adding records to your library\./i,
        ),
      ).toBeInTheDocument(),
    );
  });

  describe('add to wishlist (feature 060, US2)', () => {
    const wantResult = {
      discogsReleaseId: 1,
      rating: 0,
      notes: null,
      addedAt: '2026-09-06T00:00:00.000Z',
      catalogStatus: 'ok',
      release: null,
      alreadyInWantlist: false,
      alreadyInLibrary: false,
    };

    it('renders an "Add to wishlist" control next to "Add to library"', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add to wishlist/i }),
      ).toBeInTheDocument();
    });

    it('adds the release to the wishlist and shows an added state', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockAddWant.mockResolvedValue(wantResult);

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      expect(mockAddWant).toHaveBeenCalledWith(1);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /added to wishlist/i }),
        ).toBeInTheDocument(),
      );
    });

    it('notes when the added release is already in the library (FR-007a)', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockAddWant.mockResolvedValue({ ...wantResult, alreadyInLibrary: true });

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(screen.getByText(/this is already in your library/i)).toBeInTheDocument(),
      );
    });

    it('shows wishlist-specific link guidance when the wishlist add hits a Discogs gating error', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      const { ApiError } = await import('../../src/services/apiClient');
      mockAddWant.mockRejectedValue(
        new ApiError('not linked', 409, 'discogs_not_linked'),
      );

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(
          screen.getByText(
            /link your Discogs account before adding records to your wishlist\./i,
          ),
        ).toBeInTheDocument(),
      );
      // Distinct from the library add gate on the same page.
      expect(
        screen.queryByText(/before adding records to your library/i),
      ).not.toBeInTheDocument();
    });

    it('shows a retryable alert on a generic wishlist add failure', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      const { ApiError } = await import('../../src/services/apiClient');
      mockAddWant.mockRejectedValue(new ApiError('boom', 500, 'internal_error'));

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
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

  describe('wantlist panel (feature 060, US3)', () => {
    const wantEntry = {
      discogsReleaseId: 1,
      rating: 3,
      notes: 'First pressing only',
      addedAt: '2026-09-06T00:00:00.000Z',
    };

    it('renders the wantlist panel in its own card when the release is in the wantlist', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockGetWantEntry.mockResolvedValue(wantEntry);

      renderPage();

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /your wishlist notes/i }),
        ).toBeInTheDocument(),
      );
      expect(screen.getByText('First pressing only')).toBeInTheDocument();
    });

    it('does not render the wantlist panel when the release is not in the wantlist', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      // beforeEach already stubs GET as 404 not_in_wantlist.

      renderPage();

      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /add to wishlist/i }),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole('heading', { name: /your wishlist notes/i }),
      ).not.toBeInTheDocument();
    });

    it('reveals the panel after a successful add to wishlist without a reload', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockGetWantEntry
        .mockRejectedValueOnce(new ApiError('not in wantlist', 404, 'not_in_wantlist'))
        .mockResolvedValue({ ...wantEntry, rating: 0, notes: null });
      mockAddWant.mockResolvedValue({
        discogsReleaseId: 1,
        rating: 0,
        notes: null,
        addedAt: '2026-09-06T00:00:00.000Z',
        catalogStatus: 'ok',
        release: null,
        alreadyInWantlist: false,
        alreadyInLibrary: false,
      });

      renderPage();
      await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /add to wishlist/i }));

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /your wishlist notes/i }),
        ).toBeInTheDocument(),
      );
    });

    it('saves the personal rating through the update mutation', async () => {
      mockGetRelease.mockResolvedValue(fullRelease);
      mockGetWantEntry.mockResolvedValue({ ...wantEntry, rating: 0 });
      mockUpdateWantEntry.mockResolvedValue({ ...wantEntry, rating: 4 });

      renderPage();
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /your wishlist notes/i }),
        ).toBeInTheDocument(),
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /4 stars/i }));

      await waitFor(() =>
        expect(mockUpdateWantEntry).toHaveBeenCalledWith(1, { rating: 4 }),
      );
    });
  });

  it('shows a not-found message when the release lookup fails', async () => {
    const { ApiError } = await import('../../src/services/apiClient');
    mockGetRelease.mockRejectedValue(new ApiError('not found', 404, 'release_not_found'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn.t find that release/i)).toBeInTheDocument(),
    );
  });

  it('shows the relink notice when the release fetch itself fails with discogs_link_invalid (spec 053, US3)', async () => {
    const { ApiError } = await import('../../src/services/apiClient');
    mockGetRelease.mockRejectedValue(
      new ApiError('Your Discogs link is no longer valid.', 401, 'discogs_link_invalid'),
    );

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/your discogs link is no longer valid/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /go to your profile/i })).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t find that release/i)).not.toBeInTheDocument();
  });
});
