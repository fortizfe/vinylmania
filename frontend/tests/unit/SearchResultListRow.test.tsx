import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SearchResultListRow } from '../../src/components/SearchResultListRow';
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

function renderRow(
  result: CatalogSearchResult,
  searchPath = '/app/search?q=blue',
  overrides: Partial<{ onAdd: () => void; adding: boolean; added: boolean }> = {},
) {
  return render(
    <MemoryRouter>
      <SearchResultListRow
        result={result}
        searchPath={searchPath}
        onAdd={overrides.onAdd ?? (() => {})}
        adding={overrides.adding ?? false}
        added={overrides.added ?? false}
      />
    </MemoryRouter>,
  );
}

describe('SearchResultListRow', () => {
  it('renders cover, title, and artist for a release result', () => {
    renderRow(baseResult);

    expect(screen.getByRole('img', { name: /kind of blue/i })).toHaveAttribute(
      'src',
      baseResult.thumbnailUrl,
    );
    expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles Davis')).toBeInTheDocument();
  });

  it('renders a placeholder when there is no thumbnail', () => {
    renderRow({ ...baseResult, thumbnailUrl: undefined });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-result-thumbnail-placeholder')).toBeInTheDocument();
  });

  it('navigates to the release detail page on click for a release result', () => {
    renderRow(baseResult);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/releases/1');
  });

  describe('grouped (master) results', () => {
    const masterResult: CatalogSearchResult = {
      ...baseResult,
      discogsId: 12345,
      resultType: 'master',
      title: 'Hybrid Theory',
      artist: 'Linkin Park',
    };

    it('renders the stacked-covers visual and a "Multiple editions" badge', () => {
      renderRow(masterResult);

      expect(screen.getByTestId('search-result-stacked-covers')).toBeInTheDocument();
      expect(screen.getByText('Multiple editions')).toBeInTheDocument();
      expect(screen.getByText('Hybrid Theory')).toBeInTheDocument();
      expect(screen.getByText('Linkin Park')).toBeInTheDocument();
    });

    it('does not render the stacked-covers visual for a standalone result', () => {
      renderRow(baseResult);

      expect(
        screen.queryByTestId('search-result-stacked-covers'),
      ).not.toBeInTheDocument();
    });

    it('links a master result to its master detail page', () => {
      renderRow(masterResult);

      expect(screen.getByRole('link')).toHaveAttribute('href', '/app/masters/12345');
    });
  });

  describe('full field set (feature 052, US3)', () => {
    const fullResult: CatalogSearchResult = {
      ...baseResult,
      formats: ['Vinyl', 'LP'],
      country: 'Sweden',
      labels: ['Svek', 'Other Label'],
    };

    it('renders format, country, year, and labels (comma-joined) beside the emphasized title/artist', () => {
      renderRow(fullResult);

      expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
      expect(screen.getByText('Miles Davis')).toBeInTheDocument();
      expect(screen.getByText('Vinyl, LP')).toBeInTheDocument();
      expect(screen.getByText('Sweden')).toBeInTheDocument();
      expect(screen.getByText('1959')).toBeInTheDocument();
      expect(screen.getByText('Svek, Other Label')).toBeInTheDocument();
    });

    it('omits country and labels cleanly when the result has none, with no placeholder text', () => {
      renderRow({ ...baseResult, country: undefined, labels: undefined });

      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
      expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
    });

    it('renders "Add to library" with adding/added states for a release result', () => {
      renderRow(fullResult, undefined, { adding: true });

      expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
    });

    it('does not render "Add to library" for a master result', () => {
      renderRow({ ...fullResult, resultType: 'master' });

      expect(
        screen.queryByRole('button', { name: /add to library/i }),
      ).not.toBeInTheDocument();
    });

    it('clicking "Add to library" calls onAdd and does not navigate away from the row', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      renderRow(fullResult, undefined, { onAdd });

      await user.click(screen.getByRole('button', { name: /add to library/i }));

      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('renders the community rating badge overlaid on the cover', () => {
      renderRow({ ...fullResult, communityRating: { average: 4.19, count: 47 } });

      expect(screen.getByText('4.2')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when there is no community rating', () => {
      renderRow(fullResult);

      expect(
        screen.getByRole('status', { name: 'Rating not available' }),
      ).toBeInTheDocument();
    });
  });
});
