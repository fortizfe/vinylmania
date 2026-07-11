import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FeedArticleBoard } from '../../src/components/FeedArticleBoard';
import type { CategoryGroup, SourceStatus } from '../../src/services/feedsApi';

function article(overrides: Partial<CategoryGroup['articles'][number]> = {}) {
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'Article',
    excerpt: overrides.excerpt ?? 'x',
    publishedAt: overrides.publishedAt ?? '2026-07-07T00:00:00.000Z',
    link: overrides.link ?? 'https://example.com/a',
    sourceId: overrides.sourceId ?? 'metal-injection',
    sourceName: overrides.sourceName ?? 'Metal Injection',
    category: overrides.category ?? 'News',
    ...overrides,
  };
}

const categories: CategoryGroup[] = [
  {
    category: 'News',
    articles: [
      article({ id: 'news-old', title: 'Older News', publishedAt: '2026-07-01T00:00:00.000Z' }),
      article({ id: 'news-new', title: 'Newer News', publishedAt: '2026-07-09T00:00:00.000Z' }),
    ],
  },
  {
    category: 'Reviews',
    articles: [
      article({
        id: 'review-mid',
        title: 'Mid Review',
        category: 'Reviews',
        sourceId: 'metal-storm-reviews',
        sourceName: 'Metal Storm',
        publishedAt: '2026-07-05T00:00:00.000Z',
      }),
    ],
  },
];

const sourceStatuses: SourceStatus[] = [
  { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
  {
    sourceId: 'metal-storm-reviews',
    sourceName: 'Metal Storm',
    status: 'ok',
    priority: false,
  },
];

describe('FeedArticleBoard', () => {
  it('flattens every category into one list and sorts it by recency, newest first', () => {
    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const titles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);
    expect(titles).toEqual(['Newer News', 'Mid Review', 'Older News']);
  });

  it('renders the flattened articles inside a grid capped at 5 columns', () => {
    const { container } = render(
      <FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />,
    );

    const grid = container.querySelector('[data-testid="feed-article-grid"]');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('sm:grid-cols-2');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('lg:grid-cols-4');
    expect(grid).toHaveClass('xl:grid-cols-5');
    expect(grid?.className).not.toMatch(/2xl:grid-cols-6/);
  });

  it('narrows the visible articles to the selected category', async () => {
    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reviews' }));

    expect(screen.queryByText('Newer News')).not.toBeInTheDocument();
    expect(screen.getByText('Mid Review')).toBeInTheDocument();
  });

  it('restores the full article set when the category filter is cleared', async () => {
    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reviews' }));
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('Newer News')).toBeInTheDocument();
    expect(screen.getByText('Mid Review')).toBeInTheDocument();
    expect(screen.getByText('Older News')).toBeInTheDocument();
  });

  it('shows the empty-state message when there are zero articles at all', () => {
    render(<FeedArticleBoard categories={[]} sourceStatuses={[]} />);

    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });
});

describe('FeedArticleBoard combined category + source filtering (feature 033, US4)', () => {
  const combinedCategories: CategoryGroup[] = [
    {
      category: 'News',
      articles: [
        article({
          id: 'mi-news',
          title: 'Metal Injection News',
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          category: 'News',
          publishedAt: '2026-07-09T00:00:00.000Z',
        }),
        article({
          id: 'ls-news',
          title: 'Louder Sound News',
          sourceId: 'louder-sound',
          sourceName: 'Louder Sound',
          category: 'News',
          publishedAt: '2026-07-08T00:00:00.000Z',
        }),
      ],
    },
    {
      category: 'Reviews',
      articles: [
        article({
          id: 'ms-review',
          title: 'Metal Storm Review',
          sourceId: 'metal-storm-reviews',
          sourceName: 'Metal Storm',
          category: 'Reviews',
          publishedAt: '2026-07-07T00:00:00.000Z',
        }),
      ],
    },
  ];

  const combinedSourceStatuses: SourceStatus[] = [
    { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
    { sourceId: 'louder-sound', sourceName: 'Louder Sound', status: 'ok', priority: true },
    {
      sourceId: 'metal-storm-reviews',
      sourceName: 'Metal Storm',
      status: 'ok',
      priority: false,
    },
  ];

  it('narrows to articles matching both the selected category and source (AND)', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));

    expect(screen.getByText('Louder Sound News')).toBeInTheDocument();
    expect(screen.queryByText('Metal Injection News')).not.toBeInTheDocument();
    expect(screen.queryByText('Metal Storm Review')).not.toBeInTheDocument();
  });

  it('clearing one filter leaves the other filter’s effect intact', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));
    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(screen.getByText('Louder Sound News')).toBeInTheDocument();
    expect(screen.getByText('Metal Injection News')).toBeInTheDocument();
    expect(screen.queryByText('Metal Storm Review')).not.toBeInTheDocument();
  });

  it('shows the empty-state message when the category+source combination yields zero results', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Metal Storm' }));

    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });
});
