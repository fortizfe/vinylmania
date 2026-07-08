import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReleaseDetailsSection } from '../../src/components/ReleaseDetailsSection';
import type { Release } from '../../src/services/libraryApi';

function buildRelease(overrides: Partial<Release> = {}): Release {
  return {
    discogsId: 1,
    title: 'Stockholm',
    artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    identifiers: [],
    tracklist: [],
    images: [],
    discogsUrl: 'https://www.discogs.com/release/1',
    ...overrides,
  };
}

describe('ReleaseDetailsSection', () => {
  it('renders label, catalogue number, country, release date, genres, and styles when present', () => {
    render(
      <ReleaseDetailsSection
        release={buildRelease({
          country: 'Sweden',
          releaseDate: '1999-05-01',
          labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
          genres: ['Electronic'],
          styles: ['Deep House'],
        })}
      />,
    );

    expect(screen.getByText('Sweden')).toBeInTheDocument();
    expect(screen.getByText('1999-05-01')).toBeInTheDocument();
    expect(screen.getByText(/Svek/)).toBeInTheDocument();
    expect(screen.getByText(/SK032/)).toBeInTheDocument();
    expect(screen.getByText('Electronic')).toBeInTheDocument();
    expect(screen.getByText('Deep House')).toBeInTheDocument();
  });

  it('does not render notes, identifiers, or community stats (owned by ReleaseAdditionalInfoSection)', () => {
    render(
      <ReleaseDetailsSection
        release={buildRelease({
          notes: 'Recorded at Stockholm Sound Studio.',
          identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
          community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
        })}
      />,
    );

    expect(
      screen.queryByText('Recorded at Stockholm Sound Studio.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Barcode/)).not.toBeInTheDocument();
    expect(screen.queryByText(/214/)).not.toBeInTheDocument();
  });

  it('omits the optional meta row when the release has none of that data', () => {
    render(<ReleaseDetailsSection release={buildRelease()} />);

    expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
  });

  it('renders a single format descriptor as a badge', () => {
    render(
      <ReleaseDetailsSection
        release={buildRelease({ formats: [{ name: 'Vinyl', descriptions: ['12"'] }] })}
      />,
    );

    expect(screen.getByText(/Vinyl/)).toBeInTheDocument();
    expect(screen.getByText(/12"/)).toBeInTheDocument();
  });

  it('renders every format descriptor when there is more than one', () => {
    render(
      <ReleaseDetailsSection
        release={buildRelease({
          formats: [
            { name: 'Vinyl', descriptions: ['12"'] },
            { name: 'File', descriptions: ['MP3'] },
          ],
        })}
      />,
    );

    expect(screen.getByText(/Vinyl/)).toBeInTheDocument();
    expect(screen.getByText(/File/)).toBeInTheDocument();
  });

  it('still omits the meta row when formats is also empty, alongside the other optional fields', () => {
    render(<ReleaseDetailsSection release={buildRelease({ formats: [] })} />);

    expect(screen.queryByText(/Vinyl/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sweden')).not.toBeInTheDocument();
  });
});
