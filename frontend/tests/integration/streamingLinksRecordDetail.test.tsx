import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordDetailPage } from '../../src/pages/RecordDetailPage';
import { ApiError } from '../../src/services/apiClient';
import { createTestQueryClient } from '../testUtils';

const mockGetOne = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();
const mockGetStreamingLinks = vi.fn();

vi.mock('../../src/services/libraryApi', () => ({
  getOne: (...args: unknown[]) => mockGetOne(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
}));

vi.mock('../../src/services/streamingApi', () => ({
  getStreamingLinks: (...args: unknown[]) => mockGetStreamingLinks(...args),
}));

function LibraryListStub() {
  return <p>Library list</p>;
}

const releaseEntry = {
  id: 'entry-1',
  discogsReleaseId: 1,
  addedAt: '2026-07-03T00:00:00.000Z',
  catalogStatus: 'ok' as const,
  discogs: null,
  release: {
    discogsId: 1,
    title: 'Stockholm',
    artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
    tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
    images: [],
    discogsUrl: 'https://www.discogs.com/release/1',
  },
};

const APPLE_URL = 'https://music.apple.com/us/album/stockholm/123';

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/library/records/entry-1']}>
        <Routes>
          <Route path="/app/library/records/:entryId" element={<RecordDetailPage />} />
          <Route path="/app/library" element={<LibraryListStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StreamingLinksSection on RecordDetailPage (feature 062, T025)', () => {
  beforeEach(() => {
    mockGetOne.mockReset();
    mockRemove.mockReset();
    mockUpdate.mockReset();
    mockGetStreamingLinks.mockReset();
  });

  it('renders the reusable streaming section from entry.release, forwarding its identifiers, artist and title', async () => {
    mockGetOne.mockResolvedValue(releaseEntry);
    mockGetStreamingLinks.mockResolvedValue({
      links: [{ platform: 'apple_music', url: APPLE_URL }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());

    const region = await screen.findByRole('region', { name: /streaming/i });
    const link = within(region).getByRole('link', { name: 'Escuchar en Apple Music' });
    expect(link).toHaveAttribute('href', APPLE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    expect(mockGetStreamingLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        barcodes: ['7 39051 23421 6'],
        artist: 'The Persuader',
        title: 'Stockholm',
      }),
    );

    // Mounted last: nothing with record-detail content follows it.
    const otherDetails = screen.getByTestId('record-detail-other-details-card');
    expect(
      otherDetails.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('still renders the full record detail when streaming resolution rejects', async () => {
    mockGetOne.mockResolvedValue(releaseEntry);
    mockGetStreamingLinks.mockRejectedValue(new ApiError('down', 503, 'unavailable'));

    renderPage();

    await waitFor(() => expect(screen.getByText('Stockholm')).toBeInTheDocument());
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();

    await waitFor(
      () =>
        expect(screen.queryByTestId('streaming-links-skeleton')).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByRole('region', { name: /streaming/i })).not.toBeInTheDocument();
  });

  it('does not render the streaming section when there is no release data (catalogStatus "unavailable")', async () => {
    mockGetOne.mockResolvedValue({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'unavailable',
      discogs: {
        instanceId: 11,
        folderId: 1,
        rating: 0,
        mediaCondition: 'Good (G)',
        sleeveCondition: null,
        notes: 'Original notes',
        editable: { mediaCondition: true, sleeveCondition: true, notes: true },
      },
      release: null,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load catalog details/i)).toBeInTheDocument(),
    );

    expect(screen.queryByRole('region', { name: /streaming/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('streaming-links-skeleton')).not.toBeInTheDocument();
    expect(mockGetStreamingLinks).not.toHaveBeenCalled();
  });
});
