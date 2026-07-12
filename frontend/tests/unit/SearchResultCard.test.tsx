import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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

function renderCard(result: CatalogSearchResult, searchPath = '/app/search?q=blue') {
  return render(
    <MemoryRouter>
      <SearchResultCard
        result={result}
        searchPath={searchPath}
        onAdd={() => {}}
        adding={false}
        added={false}
      />
    </MemoryRouter>,
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

  it('delegates the add action to ResultCardActions', () => {
    renderCard(baseResult);

    expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument();
  });

  describe('navigation (feature 026, US2)', () => {
    it('links a standalone card to its release detail page, carrying the current search path as router state', () => {
      renderCard(baseResult, '/app/search?q=blue&page=2');

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/app/releases/1');
    });

    it('the link wraps the title so clicking the card navigates', () => {
      renderCard(baseResult);

      expect(screen.getByRole('link')).toHaveTextContent('Kind Of Blue');
    });
  });

  describe('grouped (master release) results (feature 026, US1)', () => {
    const masterResult: CatalogSearchResult = {
      ...baseResult,
      discogsId: 12345,
      resultType: 'master',
      title: 'Hybrid Theory',
      artist: 'Linkin Park',
    };

    it('renders the stacked-covers visual for a master result', () => {
      renderCard(masterResult);

      expect(screen.getByTestId('search-result-stacked-covers')).toBeInTheDocument();
    });

    it('renders the stacked-covers ghost layers with enhanced offset/shadow classes for visibility (feature 028, US3, FR-004)', () => {
      renderCard(masterResult);

      const [outerLayer, innerLayer] = screen.getByTestId(
        'search-result-stacked-covers',
      ).children;

      expect(outerLayer).toHaveClass(
        'translate-x-3',
        'translate-y-3',
        'rotate-6',
        'shadow-md',
      );
      expect(innerLayer).toHaveClass(
        'translate-x-1.5',
        'translate-y-1.5',
        '-rotate-3',
        'shadow-sm',
      );
    });

    it('does not render the stacked-covers visual for a standalone release result', () => {
      renderCard(baseResult);

      expect(
        screen.queryByTestId('search-result-stacked-covers'),
      ).not.toBeInTheDocument();
    });

    it('does not render an "Add to library" button for a master result', () => {
      renderCard(masterResult);

      expect(
        screen.queryByRole('button', { name: /add to library/i }),
      ).not.toBeInTheDocument();
    });

    it('still renders title, artist, and year for a master result, but omits the format badge (feature 027, FR-014)', () => {
      renderCard({ ...masterResult, year: 2000, formats: ['Vinyl'] });

      expect(screen.getByText('Hybrid Theory')).toBeInTheDocument();
      expect(screen.getByText('Linkin Park')).toBeInTheDocument();
      expect(screen.getByText('2000')).toBeInTheDocument();
      expect(screen.queryByText('Vinyl')).not.toBeInTheDocument();
    });

    it('still renders the format badge for a standalone release result (feature 027, FR-015)', () => {
      renderCard(baseResult);

      expect(screen.getByText('Vinyl')).toBeInTheDocument();
    });

    it('links a master result to its master detail page (feature 026, US3, FR-005)', () => {
      renderCard(masterResult);

      expect(screen.getByRole('link')).toHaveAttribute('href', '/app/masters/12345');
    });

    it('renders a "Multiple editions" label for a master result instead of the format badge/actions (feature 028, US2, FR-002a)', () => {
      renderCard(masterResult);

      expect(screen.getByText('Multiple editions')).toBeInTheDocument();
    });

    it('does not render a "Multiple editions" label for a standalone release result (feature 028, US2, FR-002a)', () => {
      renderCard(baseResult);

      expect(screen.queryByText('Multiple editions')).not.toBeInTheDocument();
    });
  });

  describe('fixed-height cards (feature 028, US2, FR-002; scoped to sm:+ since spec 036)', () => {
    // Fixed height only applies from `sm:` up, where the multi-column grid
    // keeps cards narrow enough for a fixed height to fit the image without
    // clipping the title/artist text below it. Below `sm:` (single-column
    // mobile), cards use their natural content height instead (spec 036) —
    // a fixed h-96 there squeezed the title/artist text to zero height once
    // the mobile grid became a single full-width column (feature 035).
    it('applies the same sm:+ fixed-height class to a standalone release card', () => {
      const { container } = renderCard(baseResult);

      expect(container.firstChild).toHaveClass('sm:h-96');
    });

    it('applies the same sm:+ fixed-height class to a master (grouped) card', () => {
      const { container } = renderCard({
        ...baseResult,
        resultType: 'master',
        discogsId: 12345,
      });

      expect(container.firstChild).toHaveClass('sm:h-96');
    });
  });

  describe('rating badge (feature 017)', () => {
    it('renders the rating badge in the thumbnail corner when a valid community rating is present', () => {
      renderCard({ ...baseResult, communityRating: { average: 4.19, count: 47 } });

      expect(screen.getByText('4.2')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when there is no community rating (feature 019)', () => {
      renderCard(baseResult);

      expect(
        screen.getByRole('status', { name: 'Rating not available' }),
      ).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('shows the unrated placeholder badge when the community rating has no votes (feature 019)', () => {
      renderCard({ ...baseResult, communityRating: { average: 0, count: 0 } });

      expect(
        screen.getByRole('status', { name: 'Rating not available' }),
      ).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('does not displace the title, artist, year, or format', () => {
      renderCard({ ...baseResult, communityRating: { average: 4.19, count: 47 } });

      expect(screen.getByText('Kind Of Blue')).toBeInTheDocument();
      expect(screen.getByText('Miles Davis')).toBeInTheDocument();
      expect(screen.getByText('1959')).toBeInTheDocument();
      expect(screen.getByText('Vinyl')).toBeInTheDocument();
    });
  });
});
