import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleasePreviewModal } from '../../src/components/ReleasePreviewModal';
import type { Release } from '../../src/services/libraryApi';

const release: Release = {
  discogsId: 1,
  title: 'Stockholm',
  year: 1999,
  country: 'Sweden',
  releaseDate: '1999-05-01',
  artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
  labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
  formats: [],
  genres: [],
  styles: [],
  notes: 'Recorded at Stockholm Sound Studio.',
  identifiers: [],
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

  it('renders the supplemental release details section above the tracklist', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const detailsText = screen.getByText('Sweden');
    const tracklistHeading = screen.getByText('Tracklist');

    expect(detailsText.compareDocumentPosition(tracklistHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a two-column grid wrapper that collapses to one column on narrow viewports', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const content = screen.getByTestId('release-preview-content');
    expect(content.className).toMatch(/grid-cols-1/);
    expect(content.className).toMatch(/lg:grid-cols-2/);
  });

  it('renders key details and tracklist as two adjacent columns below the gallery on wide layouts', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const detailsColumn = screen.getByTestId('release-preview-details');
    const tracklistColumn = screen.getByTestId('release-preview-tracklist');

    expect(
      detailsColumn.compareDocumentPosition(tracklistColumn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(detailsColumn.parentElement?.className).toMatch(/lg:grid-cols-2/);
    expect(detailsColumn.parentElement).toBe(tracklistColumn.parentElement);
  });

  it('renders the additional-info section full width below the details/tracklist row', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const additionalInfo = screen.getByTestId('release-preview-additional-info');
    const tracklistColumn = screen.getByTestId('release-preview-tracklist');

    expect(additionalInfo.className).toMatch(/lg:col-span-2/);
    expect(
      tracklistColumn.compareDocumentPosition(additionalInfo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the four sections in DOM source order: gallery, details, tracklist, additional info', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const gallery = screen.getByTestId('release-preview-gallery');
    const details = screen.getByTestId('release-preview-details');
    const tracklist = screen.getByTestId('release-preview-tracklist');
    const additionalInfo = screen.getByTestId('release-preview-additional-info');

    const order = [gallery, details, tracklist, additionalInfo];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('renders the gallery spanning the full width of the grid', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    const gallery = screen.getByTestId('release-preview-gallery');
    expect(gallery.className).toMatch(/lg:col-span-2/);
  });

  it('renders a full-width square skeleton for the gallery while loading', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={null} loading />);

    const loadingContainer = screen.getByTestId('release-preview-loading');
    const gallerySkeleton = loadingContainer.querySelector('[class*="aspect-square"]');
    expect(gallerySkeleton?.className).toMatch(/lg:col-span-2/);
  });

  it('renders its modal dialog with a hidden scrollbar', () => {
    render(<ReleasePreviewModal open onClose={() => {}} release={release} loading={false} />);

    expect(screen.getByRole('dialog').className).toMatch(/scrollbar-hidden/);
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
