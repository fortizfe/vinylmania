import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedArticleBoard } from '../../src/components/FeedArticleBoard';
import type { CategoryGroup, SourceFeedResponse, SourceStatus } from '../../src/services/feedsApi';

const mockUseSourceFeed = vi.fn();

vi.mock('../../src/queries/feedsQueries', () => ({
  useSourceFeed: (sourceId: string | null) => mockUseSourceFeed(sourceId),
}));

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

function sourceFeed(overrides: Partial<SourceFeedResponse> = {}): SourceFeedResponse {
  return {
    sourceId: overrides.sourceId ?? 'sample-source',
    sourceName: overrides.sourceName ?? 'Sample Source',
    status: overrides.status ?? 'ok',
    articles: overrides.articles ?? [],
    generatedAt: overrides.generatedAt ?? '2026-07-13T00:00:00.000Z',
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
        sourceId: 'sample-source',
        sourceName: 'Sample Source',
        publishedAt: '2026-07-05T00:00:00.000Z',
      }),
    ],
  },
];

const sourceStatuses: SourceStatus[] = [
  { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok', priority: true },
  {
    sourceId: 'sample-source',
    sourceName: 'Sample Source',
    status: 'ok',
    priority: false,
  },
];

describe('FeedArticleBoard', () => {
  beforeEach(() => {
    mockUseSourceFeed.mockReset();
    mockUseSourceFeed.mockReturnValue({ data: undefined, isLoading: false });
  });

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

describe('FeedArticleBoard source filter queries the source directly (spec 041 US3, FR-008-FR-011)', () => {
  beforeEach(() => {
    mockUseSourceFeed.mockReset();
  });

  it('shows a source’s real articles via the direct query even when absent from the categories prop (Acceptance Scenario 1, FR-008)', async () => {
    mockUseSourceFeed.mockReturnValue({ data: undefined, isLoading: false });

    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    mockUseSourceFeed.mockReturnValue({
      data: sourceFeed({
        articles: [
          article({
            id: 'hidden-1',
            title: 'Hidden From General View',
            sourceId: 'sample-source',
            sourceName: 'Sample Source',
          }),
        ],
      }),
      isLoading: false,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(mockUseSourceFeed).toHaveBeenCalledWith('sample-source');
  });

  it('renders the mocked direct-query result instead of the categories prop once a source is selected', async () => {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return {
          data: sourceFeed({
            articles: [
              article({
                id: 'direct-1',
                title: 'Direct Query Article',
                sourceId: 'sample-source',
                sourceName: 'Sample Source',
              }),
            ],
          }),
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(screen.getByText('Direct Query Article')).toBeInTheDocument();
    expect(screen.queryByText('Newer News')).not.toBeInTheDocument();
  });

  it('restores the original aggregated view when "All sources" is selected again (FR-011)', async () => {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return {
          data: sourceFeed({
            articles: [
              article({ id: 'direct-1', title: 'Direct Query Article', sourceId: 'sample-source' }),
            ],
          }),
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));
    expect(screen.getByText('Direct Query Article')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(screen.getByText('Newer News')).toBeInTheDocument();
    expect(screen.getByText('Mid Review')).toBeInTheDocument();
    expect(screen.queryByText('Direct Query Article')).not.toBeInTheDocument();
  });

  it('shows a distinct "unavailable" message when the direct query fails, different from the empty-articles message (FR-010)', async () => {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return { data: sourceFeed({ status: 'unavailable', articles: [] }), isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/check back soon/i)).not.toBeInTheDocument();
  });

  it('shows the plain empty-state message when the source is reachable but has zero articles', async () => {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return { data: sourceFeed({ status: 'ok', articles: [] }), isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });
});

describe('FeedArticleBoard combined category + source filtering (spec 041 US3, FR-012)', () => {
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
          id: 'sample-review',
          title: 'Sample Source Review',
          sourceId: 'sample-source',
          sourceName: 'Sample Source',
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
      sourceId: 'sample-source',
      sourceName: 'Sample Source',
      status: 'ok',
      priority: false,
    },
  ];

  beforeEach(() => {
    mockUseSourceFeed.mockReset();
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'louder-sound') {
        return {
          data: sourceFeed({
            sourceId: 'louder-sound',
            sourceName: 'Louder Sound',
            articles: [
              article({
                id: 'ls-news',
                title: 'Louder Sound News',
                sourceId: 'louder-sound',
                sourceName: 'Louder Sound',
                category: 'News',
                publishedAt: '2026-07-08T00:00:00.000Z',
              }),
            ],
          }),
          isLoading: false,
        };
      }
      if (sourceId === 'sample-source') {
        return {
          data: sourceFeed({
            sourceId: 'sample-source',
            sourceName: 'Sample Source',
            articles: [
              article({
                id: 'sample-review',
                title: 'Sample Source Review',
                sourceId: 'sample-source',
                sourceName: 'Sample Source',
                category: 'Reviews',
                publishedAt: '2026-07-07T00:00:00.000Z',
              }),
            ],
          }),
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });
  });

  it('narrows to the selected source’s own direct-query articles matching the active category (AND)', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));

    expect(screen.getByText('Louder Sound News')).toBeInTheDocument();
    expect(screen.queryByText('Metal Injection News')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample Source Review')).not.toBeInTheDocument();
  });

  it('clearing the source filter restores the category-only aggregated view', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));
    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(screen.getByText('Louder Sound News')).toBeInTheDocument();
    expect(screen.getByText('Metal Injection News')).toBeInTheDocument();
    expect(screen.queryByText('Sample Source Review')).not.toBeInTheDocument();
  });

  it('shows the empty-state message when the source’s own articles don’t match the active category (edge case, FR-012)', async () => {
    render(
      <FeedArticleBoard categories={combinedCategories} sourceStatuses={combinedSourceStatuses} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'News' }));
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });
});
