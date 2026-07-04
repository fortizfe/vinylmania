import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleasePreviewModal } from '../../src/components/ReleasePreviewModal';
import type { Release } from '../../src/services/libraryApi';

const release: Release = {
  discogsId: 1,
  title: 'Stockholm',
  year: 1999,
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [{ position: 'A', title: 'Östermalm', duration: '4:45' }],
  images: [],
  discogsUrl: 'https://www.discogs.com/release/1',
};

describe('ReleasePreviewModal', () => {
  it('shows a loading state while the release is being fetched', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={null} loading />);

    expect(screen.getByTestId('release-preview-loading')).toBeInTheDocument();
  });

  it('renders the release details once loaded', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText(/Östermalm/)).toBeInTheDocument();
  });

  it('shows an error state when the release could not be loaded', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={null} loading={false} />);

    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ReleasePreviewModal open={false} onClose={() => {}} release={release} loading={false} />);

    expect(screen.queryByText('Stockholm')).not.toBeInTheDocument();
  });
});
