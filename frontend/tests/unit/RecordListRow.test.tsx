import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RecordListRow } from '../../src/components/RecordListRow';
import type { EnrichedLibraryEntry } from '../../src/services/libraryApi';

function renderRow(entry: EnrichedLibraryEntry) {
  return render(
    <MemoryRouter>
      <RecordListRow entry={entry} />
    </MemoryRouter>,
  );
}

describe('RecordListRow', () => {
  it('renders cover, title, and artist for an ok entry', () => {
    renderRow({
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
        images: [{ url: 'https://example.com/cover.jpg', imageType: 'primary' }],
        discogsUrl: 'https://www.discogs.com/release/1',
      },
      discogs: null,
    });

    expect(screen.getByRole('img', { name: /stockholm/i })).toHaveAttribute(
      'src',
      'https://example.com/cover.jpg',
    );
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
  });

  it('renders a placeholder when there is no cover image', () => {
    renderRow({
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
      discogs: null,
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('record-list-row-thumbnail-placeholder'),
    ).toBeInTheDocument();
  });

  it('navigates to the record detail page on click', () => {
    renderRow({
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
      discogs: null,
    });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/app/library/records/entry-1',
    );
  });

  it('shows the existing unavailable-catalog fallback with an Open record link', () => {
    renderRow({
      id: 'entry-2',
      discogsReleaseId: 2,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'unavailable',
      release: null,
      discogs: null,
    });

    expect(screen.getByText(/couldn't load catalog details/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open record/i })).toHaveAttribute(
      'href',
      '/app/library/records/entry-2',
    );
  });

  describe('full field set (feature 052, US2)', () => {
    function fullEntry() {
      return {
        id: 'entry-1',
        discogsReleaseId: 1,
        addedAt: '2026-07-03T00:00:00.000Z',
        catalogStatus: 'ok' as const,
        release: {
          discogsId: 1,
          title: 'Stockholm',
          year: 1999,
          country: 'Sweden',
          artists: [
            { discogsArtistId: 1, name: 'The Persuader' },
            { discogsArtistId: 2, name: 'Some Other Artist' },
          ],
          labels: [
            { discogsLabelId: 1, name: 'Svek' },
            { discogsLabelId: 2, name: 'Other Label' },
          ],
          formats: [
            { name: 'Vinyl', descriptions: [] },
            { name: 'LP', descriptions: [] },
          ],
          genres: [],
          styles: [],
          tracklist: [],
          images: [],
          discogsUrl: 'https://www.discogs.com/release/1',
        },
        discogs: null,
      };
    }

    it('renders format, country, year, and label beside the emphasized title/artist', () => {
      renderRow(fullEntry());

      expect(screen.getByText('Stockholm')).toBeInTheDocument();
      expect(screen.getByText('The Persuader, Some Other Artist')).toBeInTheDocument();
      expect(screen.getByText('Vinyl, LP')).toBeInTheDocument();
      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.getByText('1999')).toBeInTheDocument();
      expect(screen.getByText('Svek, Other Label')).toBeInTheDocument();
    });

    it('omits country and label cleanly when the release has none, with no placeholder text', () => {
      const entry = fullEntry();
      entry.release.country = undefined as unknown as string;
      entry.release.labels = [];

      renderRow(entry);

      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
      expect(screen.getByText('Stockholm')).toBeInTheDocument();
    });

    it('renders the community rating badge overlaid on the cover, matching grid mode', () => {
      const entry = fullEntry();
      entry.release.community = {
        have: 10,
        want: 5,
        rating: { average: 4.19, count: 47 },
      };

      renderRow(entry);

      expect(screen.getByText('4.2')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when the release has no community rating', () => {
      renderRow(fullEntry());

      expect(
        screen.getByRole('status', { name: 'Rating not available' }),
      ).toBeInTheDocument();
    });
  });
});
