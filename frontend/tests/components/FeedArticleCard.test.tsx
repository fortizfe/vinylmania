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
    render(<FeedArticleCard article={{ ...baseArticle, imageUrl: 'https://cdn.example.com/cover.jpg' }} />);

    const image = screen.getByRole('img', { name: baseArticle.title });
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/cover.jpg');
    expect(screen.queryByTestId('feed-article-thumbnail-placeholder')).not.toBeInTheDocument();
  });

  it('renders a consistent placeholder graphic when no image is available', () => {
    render(<FeedArticleCard article={baseArticle} />);

    expect(screen.getByTestId('feed-article-thumbnail-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
