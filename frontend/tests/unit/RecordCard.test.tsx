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
  it('renders title, artist, and condition for an ok entry', () => {
    renderCard({
      id: 'entry-1',
      discogsReleaseId: 1,
      addedAt: '2026-07-03T00:00:00.000Z',
      condition: 'Near Mint',
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
    });

    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText('Near Mint')).toBeInTheDocument();
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
});
