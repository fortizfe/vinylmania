import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MasterReleaseDetailPage } from '../../src/pages/MasterReleaseDetailPage';
import { createTestQueryClient } from '../testUtils';

const mockGetMasterRelease = vi.fn();
const mockGetMasterReleaseVersions = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getMasterRelease: (...args: unknown[]) => mockGetMasterRelease(...args),
  getMasterReleaseVersions: (...args: unknown[]) => mockGetMasterReleaseVersions(...args),
}));

const fullMaster = {
  discogsId: 1660109,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' as const }],
  tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
  mainReleaseId: 98765,
  discogsUrl: 'https://www.discogs.com/master/1660109',
};

const versionsPage = {
  results: [{ discogsId: 98765, title: 'Hybrid Theory', format: 'Vinyl', year: 2000 }],
  pagination: { page: 1, pages: 1, items: 1, perPage: 10 },
};

function renderPage(initialEntries: string[] = ['/app/masters/1660109']) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/app/masters/:discogsId" element={<MasterReleaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MasterReleaseDetailPage', () => {
  beforeEach(() => {
    mockGetMasterRelease.mockReset();
    mockGetMasterReleaseVersions.mockReset();
  });

  it('renders a skeleton loading state while the master is loading', () => {
    mockGetMasterRelease.mockReturnValue(new Promise(() => {}));
    mockGetMasterReleaseVersions.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('record-detail-skeleton')).toBeInTheDocument();
  });

  it('renders the master info and version table once loaded, with no Add to library action', async () => {
    mockGetMasterRelease.mockResolvedValue(fullMaster);
    mockGetMasterReleaseVersions.mockResolvedValue(versionsPage);

    renderPage();

    await waitFor(() => expect(screen.getByText('Hybrid Theory')).toBeInTheDocument());
    expect(screen.getByText('Linkin Park')).toBeInTheDocument();
    expect(screen.getByText('Rock')).toBeInTheDocument();
    expect(screen.getByText(/Papercut/)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockGetMasterReleaseVersions).toHaveBeenCalledWith(1660109, 1),
    );
    expect(
      screen.queryByRole('button', { name: /add to library/i }),
    ).not.toBeInTheDocument();
  });

  it('shows a not-found message when the master lookup fails', async () => {
    const { ApiError } = await import('../../src/services/apiClient');
    mockGetMasterRelease.mockRejectedValue(
      new ApiError('not found', 404, 'master_not_found'),
    );
    mockGetMasterReleaseVersions.mockResolvedValue(versionsPage);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn.t find that master release/i)).toBeInTheDocument(),
    );
  });
});
