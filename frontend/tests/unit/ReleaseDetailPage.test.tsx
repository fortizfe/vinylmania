import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseDetailPage } from '../../src/pages/ReleaseDetailPage';
import { createTestQueryClient } from '../testUtils';

const mockGetRelease = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
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

  it('shows link/relink guidance when Add fails due to a Discogs gating error', async () => {
    mockGetRelease.mockResolvedValue(fullRelease);
    const { ApiError } = await import('../../src/services/apiClient');
    mockCreate.mockRejectedValue(new ApiError('not linked', 409, 'discogs_not_linked'));

    renderPage();
    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add to library/i }));

    await waitFor(() =>
      expect(screen.getByText(/link your Discogs account/i)).toBeInTheDocument(),
    );
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
      expect(screen.getByText(/your discogs link is no longer valid/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /go to your profile/i })).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t find that release/i)).not.toBeInTheDocument();
  });
});
