import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchResultCard } from '../../src/components/SearchResultCard';
import type { CatalogSearchResult } from '../../src/services/discogsApi';

const baseResult: CatalogSearchResult = {
  discogsId: 1,
  resultType: 'release',
  title: 'Kind Of Blue',
  artist: 'Miles Davis',
  thumbnailUrl: 'https://example.com/cover.jpg',
  year: 1959,
  formats: ['Vinyl'],
};

function renderCard(result: CatalogSearchResult) {
  return render(
    <SearchResultCard
      result={result}
      onAdd={() => {}}
      onPreview={() => {}}
      adding={false}
      added={false}
    />,
  );
}

describe('SearchResultCard', () => {
  it('renders the cover thumbnail, title, artist, year, and format', () => {
    renderCard(baseResult);

    expect(screen.getByRole('img', { name: /kind of blue/i })).toHaveAttribute(
      'src',
      baseResult.thumbnailUrl,
    );
    expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles Davis')).toBeInTheDocument();
    expect(screen.getByText('1959')).toBeInTheDocument();
    expect(screen.getByText('Vinyl')).toBeInTheDocument();
  });

  it('renders a placeholder occupying the same space when there is no thumbnail', () => {
    renderCard({ ...baseResult, thumbnailUrl: undefined });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-result-thumbnail-placeholder')).toBeInTheDocument();
  });

  it('omits the artist line when the result has none', () => {
    renderCard({ ...baseResult, artist: undefined });

    expect(screen.queryByText('Miles Davis')).not.toBeInTheDocument();
  });

  it('delegates the add/preview actions to ResultCardActions', async () => {
    const onAdd = vi.fn();
    const onPreview = vi.fn();
    render(
      <SearchResultCard
        result={baseResult}
        onAdd={onAdd}
        onPreview={onPreview}
        adding={false}
        added={false}
      />,
    );

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preview details/i })).toBeInTheDocument();
  });
});
