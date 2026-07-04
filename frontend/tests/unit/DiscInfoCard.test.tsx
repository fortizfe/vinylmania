import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DiscInfoCard } from '../../src/components/DiscInfoCard';
import type { Release } from '../../src/services/libraryApi';

function buildRelease(overrides: Partial<Release> = {}): Release {
  return {
    discogsId: 1,
    title: 'Stockholm',
    artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
    labels: [],
    formats: [{ name: 'Vinyl', descriptions: ['12"'] }],
    genres: ['Electronic'],
    styles: [],
    tracklist: [],
    images: [],
    discogsUrl: 'https://www.discogs.com/release/1',
    ...overrides,
  };
}

describe('DiscInfoCard', () => {
  it('renders title, artist, year, format, and genre when all are present', () => {
    render(<DiscInfoCard release={buildRelease({ year: 1999 })} />);

    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('The Persuader')).toBeInTheDocument();
    expect(screen.getByText('1999')).toBeInTheDocument();
    expect(screen.getByText(/Vinyl/)).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
  });

  it('omits the year field entirely when not present', () => {
    render(<DiscInfoCard release={buildRelease({ year: undefined })} />);

    expect(screen.queryByText(/\b\d{4}\b/)).not.toBeInTheDocument();
  });

  it('renders every credited artist', () => {
    render(
      <DiscInfoCard
        release={buildRelease({
          artists: [
            { discogsArtistId: 1, name: 'The Persuader' },
            { discogsArtistId: 2, name: 'Rune Lindbæk' },
          ],
        })}
      />,
    );

    expect(screen.getByText(/The Persuader/)).toBeInTheDocument();
    expect(screen.getByText(/Rune Lindbæk/)).toBeInTheDocument();
  });

  it('renders every format descriptor and every genre when there is more than one', () => {
    render(
      <DiscInfoCard
        release={buildRelease({
          formats: [
            { name: 'Vinyl', descriptions: ['12"'] },
            { name: 'File', descriptions: ['MP3'] },
          ],
          genres: ['Electronic', 'House'],
        })}
      />,
    );

    expect(screen.getByText(/Vinyl/)).toBeInTheDocument();
    expect(screen.getByText(/File/)).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();
  });

  it('renders no interactive controls', () => {
    render(<DiscInfoCard release={buildRelease({ year: 1999 })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
