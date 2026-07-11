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
    it('applies the same fixed-height classes regardless of a short title and no excerpt', () => {
      const { container } = render(
        <FeedArticleCard article={{ ...baseArticle, title: 'Short', excerpt: '' }} />,
      );

      expect(container.firstChild).toHaveClass('h-40');
      expect(container.firstChild).toHaveClass('sm:h-96');
    });

    it('applies the same fixed-height classes for a long title and excerpt', () => {
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

      expect(container.firstChild).toHaveClass('h-40');
      expect(container.firstChild).toHaveClass('sm:h-96');
    });

    it('clamps the title to 2 lines', () => {
      render(<FeedArticleCard article={baseArticle} />);

      expect(screen.getByText(baseArticle.title)).toHaveClass('line-clamp-2');
    });

    it('clamps the excerpt (fewer lines on the compact mobile layout than on desktop)', () => {
      render(<FeedArticleCard article={baseArticle} />);

      const excerpt = screen.getByText(baseArticle.excerpt);
      expect(excerpt).toHaveClass('line-clamp-1');
      expect(excerpt).toHaveClass('sm:line-clamp-2');
    });
  });

  describe('responsive layout (feature 033, US2, FR-005, FR-007)', () => {
    it('uses a compact row layout (image beside text) at the base breakpoint, column at sm:+', () => {
      const { container } = render(
        <FeedArticleCard
          article={{ ...baseArticle, imageUrl: 'https://cdn.example.com/cover.jpg' }}
        />,
      );

      const link = container.querySelector('a');
      expect(link).toHaveClass('flex-row');
      expect(link).toHaveClass('sm:flex-col');

      const image = screen.getByRole('img', { name: baseArticle.title });
      expect(image).toHaveClass('w-24');
      expect(image).toHaveClass('sm:w-full');
      expect(image).toHaveClass('sm:aspect-video');
    });

    it('still shows title, excerpt, source, category badge, and date in the compact layout', () => {
      render(<FeedArticleCard article={baseArticle} />);

      expect(screen.getByText(baseArticle.title)).toBeInTheDocument();
      expect(screen.getByText(baseArticle.excerpt)).toBeInTheDocument();
      expect(screen.getByText(baseArticle.category)).toBeInTheDocument();
      expect(screen.getByText(/Metal Injection/)).toBeInTheDocument();
    });

    it('still opens the original article in a new tab from the compact layout', () => {
      render(<FeedArticleCard article={baseArticle} />);

      const link = screen.getByRole('link', { name: new RegExp(baseArticle.title) });
      expect(link).toHaveAttribute('href', baseArticle.link);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  describe('equal prominence across sources (feature 033, US3, FR-010, SC-004, SC-007)', () => {
    const priorityArticles = [
      { ...baseArticle, id: 'mi-1', sourceId: 'metal-injection', sourceName: 'Metal Injection' },
      { ...baseArticle, id: 'ms-1', sourceId: 'metalsucks', sourceName: 'MetalSucks' },
      { ...baseArticle, id: 'ls-1', sourceId: 'louder-sound', sourceName: 'Louder Sound' },
    ];
    const nonPriorityArticle = {
      ...baseArticle,
      id: 'ms-storm-1',
      sourceId: 'metal-storm-reviews',
      sourceName: 'Metal Storm',
    };

    it('renders an identical card size/structure for every source, differing only in the badge/source text', () => {
      const renders = [...priorityArticles, nonPriorityArticle].map((article) =>
        render(<FeedArticleCard article={article} />),
      );

      for (const { container } of renders) {
        expect(container.firstChild).toHaveClass('h-40');
        expect(container.firstChild).toHaveClass('sm:h-96');
      }

      expect(screen.getByText(/Metal Injection/)).toBeInTheDocument();
      expect(screen.getByText(/MetalSucks/)).toBeInTheDocument();
      expect(screen.getByText(/Louder Sound/)).toBeInTheDocument();
      expect(screen.getByText(/Metal Storm/)).toBeInTheDocument();
    });
  });
});
