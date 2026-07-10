import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedArticleCard } from '../../src/components/FeedArticleCard';
import type { Article } from '../../src/services/feedsApi';

const baseArticle: Article = {
  id: '1',
  title: 'DEVILDRIVER Unleash New Video',
  excerpt: 'Off their new album.',
  publishedAt: '2026-07-07T21:17:03.000Z',
  link: 'https://metalinjection.net/new-music/devildriver',
  sourceId: 'metal-injection',
  sourceName: 'Metal Injection',
  category: 'News',
};

describe('FeedArticleCard', () => {
  it('renders the provided image when present', () => {
    render(
      <FeedArticleCard
        article={{ ...baseArticle, imageUrl: 'https://cdn.example.com/cover.jpg' }}
      />,
    );

    const image = screen.getByRole('img', { name: baseArticle.title });
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/cover.jpg');
    expect(
      screen.queryByTestId('feed-article-thumbnail-placeholder'),
    ).not.toBeInTheDocument();
  });

  it('renders a consistent placeholder graphic when no image is available', () => {
    render(<FeedArticleCard article={baseArticle} />);

    expect(screen.getByTestId('feed-article-thumbnail-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  describe('fixed-height cards with truncated text (feature 028, US4, FR-007, FR-008)', () => {
    it('applies the same fixed-height class regardless of a short title and no excerpt', () => {
      const { container } = render(
        <FeedArticleCard article={{ ...baseArticle, title: 'Short', excerpt: '' }} />,
      );

      expect(container.firstChild).toHaveClass('h-96');
    });

    it('applies the same fixed-height class for a long title and excerpt', () => {
      const { container } = render(
        <FeedArticleCard
          article={{
            ...baseArticle,
            title:
              'A Very Long Article Title That Would Otherwise Wrap Across Several Lines And Grow The Card',
            excerpt:
              'A very long excerpt that goes on and on describing the article in far more detail than a short summary would, which would otherwise grow the card height well beyond its neighbors.',
          }}
        />,
      );

      expect(container.firstChild).toHaveClass('h-96');
    });

    it('clamps the title to 2 lines', () => {
      render(<FeedArticleCard article={baseArticle} />);

      expect(screen.getByText(baseArticle.title)).toHaveClass('line-clamp-2');
    });

    it('clamps the excerpt to 2 lines', () => {
      render(<FeedArticleCard article={baseArticle} />);

      expect(screen.getByText(baseArticle.excerpt)).toHaveClass('line-clamp-2');
    });
  });
});
