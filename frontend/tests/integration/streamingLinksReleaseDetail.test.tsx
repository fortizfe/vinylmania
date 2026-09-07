import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseDetailPage } from '../../src/pages/ReleaseDetailPage';
import { ApiError } from '../../src/services/apiClient';
import { createTestQueryClient } from '../testUtils';

const mockGetRelease = vi.fn();
const mockGetStreamingLinks = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getRelease: (...args: unknown[]) => mockGetRelease(...args),
}));

vi.mock('../../src/services/libraryApi', () => ({
  create: vi.fn(),
}));

vi.mock('../../src/services/wantlistApi', () => ({
  add: vi.fn(),
  getOne: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/services/streamingApi', () => ({
  getStreamingLinks: (...args: unknown[]) => mockGetStreamingLinks(...args),
}));

const release = {
  discogsId: 1,
  title: 'Master of Puppets',
  year: 1986,
  country: 'US',
  notes: 'Recorded at Sweet Silence Studios.',
  artists: [{ discogsArtistId: 1, name: 'Metallica' }],
  labels: [{ discogsLabelId: 5, name: 'Elektra', catalogNumber: '60439-1' }],
  formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
  genres: ['Rock'],
  styles: ['Thrash', 'Heavy Metal'],
  identifiers: [{ type: 'Barcode', value: '075596043916' }],
  community: { have: 5000, want: 2000, rating: { average: 4.8, count: 900 } },
  tracklist: [{ position: 'A1', title: 'Battery', duration: '5:13' }],
  images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' as const }],
  discogsUrl: 'https://www.discogs.com/release/1',
};

const APPLE_URL = 'https://music.apple.com/us/album/master-of-puppets/123';

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app/releases/1']}>
        <Routes>
          <Route path="/app/releases/:discogsId" element={<ReleaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StreamingLinksSection on ReleaseDetailPage (feature 062, T020)', () => {
  beforeEach(() => {
    mockGetRelease.mockReset();
    mockGetStreamingLinks.mockReset();
    mockGetRelease.mockResolvedValue(release);
  });

  it('renders the streaming section as the last section, with the resolved Apple Music link', async () => {
    mockGetStreamingLinks.mockResolvedValue({
      links: [{ platform: 'apple_music', url: APPLE_URL }],
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Master of Puppets')).toBeInTheDocument(),
    );

    const region = await screen.findByRole('region', { name: /streaming/i });
    const link = within(region).getByRole('link', { name: 'Escuchar en Apple Music' });
    expect(link).toHaveAttribute('href', APPLE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // Resolution uses only data already on the record (FR-003): barcode + artist + title.
    expect(mockGetStreamingLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        barcodes: ['075596043916'],
        artist: 'Metallica',
        title: 'Master of Puppets',
      }),
    );

    // It is the last section in the detail layout (FR-017 / research.md §7):
    // nothing with detail content follows it in document order.
    const otherDetails = screen.getByText(/Recorded at Sweet Silence Studios/);
    expect(
      otherDetails.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('still renders the full detail page when streaming resolution rejects', async () => {
    mockGetStreamingLinks.mockRejectedValue(new ApiError('down', 503, 'unavailable'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Master of Puppets')).toBeInTheDocument(),
    );
    // Rest of the detail renders fully.
    expect(screen.getByText('Metallica')).toBeInTheDocument();
    expect(screen.getByText(/Battery/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded at Sweet Silence Studios/)).toBeInTheDocument();

    // The streaming area degrades silently: no section, no lingering skeleton,
    // no error text (FR-014). `useStreamingLinks` retries once, so allow for
    // the backoff before the section collapses.
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
