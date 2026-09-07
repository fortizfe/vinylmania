import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MasterReleaseDetailPage } from '../../src/pages/MasterReleaseDetailPage';
import { ApiError } from '../../src/services/apiClient';
import { createTestQueryClient } from '../testUtils';

const mockGetMasterRelease = vi.fn();
const mockGetMasterReleaseVersions = vi.fn();
const mockGetStreamingLinks = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getMasterRelease: (...args: unknown[]) => mockGetMasterRelease(...args),
  getMasterReleaseVersions: (...args: unknown[]) => mockGetMasterReleaseVersions(...args),
}));

vi.mock('../../src/services/streamingApi', () => ({
  getStreamingLinks: (...args: unknown[]) => mockGetStreamingLinks(...args),
}));

const master = {
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

const APPLE_URL = 'https://music.apple.com/us/album/hybrid-theory/123';

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/masters/1660109']}>
        <Routes>
          <Route path="/app/masters/:discogsId" element={<MasterReleaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StreamingLinksSection on MasterReleaseDetailPage (feature 062, T024)', () => {
  beforeEach(() => {
    mockGetMasterRelease.mockReset();
    mockGetMasterReleaseVersions.mockReset();
    mockGetStreamingLinks.mockReset();
    mockGetMasterRelease.mockResolvedValue(master);
    mockGetMasterReleaseVersions.mockResolvedValue(versionsPage);
  });

  it('renders the same reusable streaming section, resolving by artist + title with no barcodes', async () => {
    mockGetStreamingLinks.mockResolvedValue({
      links: [{ platform: 'apple_music', url: APPLE_URL }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Hybrid Theory')).toBeInTheDocument());

    const region = await screen.findByRole('region', { name: /streaming/i });
    const link = within(region).getByRole('link', { name: 'Escuchar en Apple Music' });
    expect(link).toHaveAttribute('href', APPLE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // A `MasterRelease` has no `identifiers` field (services/discogsApi.ts) — the
    // section forwards `undefined`, so the barcode list is empty and resolution
    // falls back to the artist + title text search (plan.md "Surface mapping").
    expect(mockGetStreamingLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        barcodes: [],
        artist: 'Linkin Park',
        title: 'Hybrid Theory',
      }),
    );

    // Mounted last: nothing with master-detail content follows it.
    const versionsCard = screen.getByTestId('master-detail-versions-card');
    expect(
      versionsCard.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the full master detail page when streaming resolution rejects', async () => {
    mockGetStreamingLinks.mockRejectedValue(new ApiError('down', 503, 'unavailable'));

    renderPage();

    await waitFor(() => expect(screen.getByText('Hybrid Theory')).toBeInTheDocument());
    expect(screen.getByText('Linkin Park')).toBeInTheDocument();
    expect(screen.getByText(/Papercut/)).toBeInTheDocument();

    await waitFor(
      () =>
        expect(screen.queryByTestId('streaming-links-skeleton')).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByRole('region', { name: /streaming/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Escuchar en Apple Music' }),
    ).not.toBeInTheDocument();
  });
});
