import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RecordCard } from '../../src/components/RecordCard';
import type { EnrichedLibraryEntry } from '../../src/services/libraryApi';

function renderCard(entry: EnrichedLibraryEntry) {
  return render(
    <MemoryRouter>
      <RecordCard entry={entry} />
    </MemoryRouter>,
  );
}

describe('RecordCard', () => {
  it('renders title and artist for an ok entry', () => {
    renderCard({
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
      discogs: null,
    });

    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
  });

  it('renders an unavailable state when the catalog could not be fetched', () => {
    renderCard({
      id: 'entry-2',
      discogsReleaseId: 2,
      addedAt: '2026-07-03T00:00:00.000Z',
      catalogStatus: 'unavailable',
      release: null,
    });

    expect(screen.getByText(/couldn't load catalog details/i)).toBeInTheDocument();
  });

  describe('rating badge (feature 017)', () => {
    function entryWithCommunity(community?: { have: number; want: number; rating: { average: number; count: number } }) {
      return {
        id: 'entry-3',
        discogsReleaseId: 3,
        addedAt: '2026-07-03T00:00:00.000Z',
        catalogStatus: 'ok' as const,
        release: {
          discogsId: 3,
          title: 'Stockholm',
          artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
          labels: [],
          formats: [],
          genres: [],
          styles: [],
          identifiers: [],
          ...(community ? { community } : {}),
          tracklist: [],
          images: [],
          discogsUrl: 'https://www.discogs.com/release/3',
        },
        discogs: null,
      };
    }

    it('renders the rating badge when the release has a valid community rating', () => {
      renderCard(entryWithCommunity({ have: 10, want: 5, rating: { average: 4.19, count: 47 } }));

      expect(screen.getByText('4.2')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when the release has no community rating (feature 019)', () => {
      renderCard(entryWithCommunity());

      expect(screen.getByRole('status', { name: 'Rating not available' })).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when the community rating has no votes (feature 019)', () => {
      renderCard(entryWithCommunity({ have: 10, want: 5, rating: { average: 0, count: 0 } }));

      expect(screen.getByRole('status', { name: 'Rating not available' })).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('does not render a badge for an unavailable catalog entry', () => {
      renderCard({
        id: 'entry-4',
        discogsReleaseId: 4,
        addedAt: '2026-07-03T00:00:00.000Z',
        catalogStatus: 'unavailable',
        release: null,
      });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
