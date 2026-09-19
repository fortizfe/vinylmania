import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedArticleBoard } from '../../src/components/FeedArticleBoard';
import type {
  CategoryGroup,
  SourceFeedResponse,
  SourceStatus,
} from '../../src/services/feedsApi';

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
      article({
        id: 'news-old',
        title: 'Older News',
        publishedAt: '2026-07-01T00:00:00.000Z',
      }),
      article({
        id: 'news-new',
        title: 'Newer News',
        publishedAt: '2026-07-09T00:00:00.000Z',
      }),
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
  {
    sourceId: 'metal-injection',
    sourceName: 'Metal Injection',
    status: 'ok',
    priority: true,
  },
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

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((el) => el.textContent);
    expect(titles).toEqual(['Newer News', 'Mid Review', 'Older News']);
  });

  it('shows the empty-state message when there are zero articles at all', () => {
    render(<FeedArticleBoard categories={[]} sourceStatuses={[]} />);

    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });
});

describe('FeedArticleBoard sticky chip bar never hides the focused element (spec 067 T050 #2, WCAG 2.4.11)', () => {
  let observed: { callback: ResizeObserverCallback; target?: Element } | undefined;

  beforeEach(() => {
    mockUseSourceFeed.mockReset();
    mockUseSourceFeed.mockReturnValue({ data: undefined, isLoading: false });
    observed = undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observed = { callback };
        }
        observe(target: Element) {
          observed!.target = target;
        }
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.scrollPaddingTop = '';
  });

  it('sticks the chip bar right below the app header, not under it', () => {
    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const bar = screen.getByRole('group', { name: 'Filter by source' }).parentElement;
    expect(bar).toHaveClass('sticky', 'top-(--header-h)');
    expect(bar).not.toHaveClass('top-0');
  });

  it('pads the page scroll by header + the measured chip bar height, and clears it on unmount', () => {
    const { unmount } = render(
      <FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />,
    );

    const bar = screen.getByRole('group', { name: 'Filter by source' }).parentElement!;
    expect(observed?.target).toBe(bar);

    // The bar wraps to more rows on wider screens, so its height is measured.
    vi.spyOn(bar, 'offsetHeight', 'get').mockReturnValue(120);
    observed!.callback([], {} as ResizeObserver);
    expect(document.documentElement.style.scrollPaddingTop).toBe(
      'calc(var(--header-h) + 120px)',
    );

    unmount();
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
  });
});

describe('FeedArticleBoard Portada layout (feature 067, US2, FR-009, FR-013, FR-016)', () => {
  const img = (id: string) => `https://cdn.example.com/${id}.jpg`;
  // Newest first: a placeholder-only article is the newest overall, so it
  // must still land in Latest (FR-009).
  const portadaArticles = [
    article({
      id: 'p-newest',
      title: 'Placeholder Newest',
      sourceId: 'a',
      sourceName: 'Alpha',
      publishedAt: '2026-09-19T11:50:00.000Z',
    }),
    article({
      id: 'a1',
      title: 'Lead Story',
      sourceId: 'a',
      sourceName: 'Alpha',
      imageUrl: img('a1'),
      publishedAt: '2026-09-19T11:00:00.000Z',
    }),
    article({
      id: 'b1',
      title: 'Tile B',
      sourceId: 'b',
      sourceName: 'Bravo',
      imageUrl: img('b1'),
      publishedAt: '2026-09-19T10:00:00.000Z',
    }),
    article({
      id: 'c1',
      title: 'Tile C',
      sourceId: 'c',
      sourceName: 'Charlie',
      imageUrl: img('c1'),
      publishedAt: '2026-09-19T09:00:00.000Z',
    }),
    article({
      id: 'd1',
      title: 'Tile D',
      sourceId: 'd',
      sourceName: 'Delta',
      imageUrl: img('d1'),
      publishedAt: '2026-09-19T08:00:00.000Z',
    }),
    article({
      id: 'e1',
      title: 'Tile E',
      sourceId: 'e',
      sourceName: 'Echo',
      imageUrl: img('e1'),
      publishedAt: '2026-09-19T07:00:00.000Z',
    }),
    article({
      id: 'a2',
      title: 'Second Alpha',
      sourceId: 'a',
      sourceName: 'Alpha',
      imageUrl: img('a2'),
      publishedAt: '2026-09-19T06:00:00.000Z',
    }),
    article({
      id: 'f1',
      title: 'Placeholder Older',
      sourceId: 'f',
      sourceName: 'Foxtrot',
      publishedAt: '2026-09-19T05:00:00.000Z',
    }),
  ];
  // Two category groups on purpose: the board must flatten them (single
  // category in practice, D11).
  const portadaCategories: CategoryGroup[] = [
    { category: 'News', articles: portadaArticles.slice(0, 4) },
    { category: 'News', articles: portadaArticles.slice(4) },
  ];
  const leadAndTiles = ['Lead Story', 'Tile B', 'Tile C', 'Tile D', 'Tile E'];
  const latestTitles = ['Placeholder Newest', 'Second Alpha', 'Placeholder Older'];

  beforeEach(() => {
    mockUseSourceFeed.mockReset();
    mockUseSourceFeed.mockReturnValue({ data: undefined, isLoading: false });
  });

  function renderPortada() {
    return render(
      <FeedArticleBoard categories={portadaCategories} sourceStatuses={sourceStatuses} />,
    );
  }

  function topStoriesSection() {
    const heading = screen.getByRole('heading', { level: 2, name: 'Top stories' });
    return heading.closest('section') as HTMLElement;
  }

  function latestList() {
    const heading = screen.getByRole('heading', { level: 2, name: 'Latest' });
    return heading.parentElement?.querySelector('ul') as HTMLUListElement;
  }

  it('renders one lead and 4 secondaries under "Top stories", then a Latest <ul> of rows', () => {
    renderPortada();

    const top = topStoriesSection();
    expect(top).not.toBeNull();
    expect(
      within(top)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(leadAndTiles);

    const list = latestList();
    expect(list).not.toBeNull();
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(latestTitles.length);
    expect(
      within(list)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(latestTitles);
  });

  it('keeps "Top stories" visually hidden but exposed to AT, while "Latest" is visible', () => {
    renderPortada();

    expect(screen.getByRole('heading', { level: 2, name: 'Top stories' })).toHaveClass(
      'sr-only',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Latest' })).not.toHaveClass(
      'sr-only',
    );
  });

  it('has a heading outline with no skipped levels (h2 → h3 only)', () => {
    renderPortada();

    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(2);
    expect(Math.max(...levels)).toBe(3);
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });

  it('places placeholder-only articles in Latest only, never in Top stories', () => {
    renderPortada();

    const top = topStoriesSection();
    expect(within(top).queryByText('Placeholder Newest')).not.toBeInTheDocument();
    expect(within(top).queryByText('Placeholder Older')).not.toBeInTheDocument();
    expect(within(latestList()).getByText('Placeholder Newest')).toBeInTheDocument();
    expect(within(latestList()).getByText('Placeholder Older')).toBeInTheDocument();
  });

  it('has no "Filter by category" group or category chips (FR-013)', () => {
    renderPortada();

    expect(
      screen.queryByRole('group', { name: /filter by category/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'News' })).not.toBeInTheDocument();
  });

  it('tabs through the articles in visual order: lead → tiles → Latest', async () => {
    renderPortada();

    const expected = [...leadAndTiles, ...latestTitles].map((title) =>
      screen.getByRole('link', { name: title }),
    );
    for (const link of expected) expect(link.tabIndex).toBeLessThanOrEqual(0);

    const user = userEvent.setup();
    expected[0].focus();
    for (const link of expected.slice(1)) {
      await user.tab();
      expect(link).toHaveFocus();
    }
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
              article({
                id: 'direct-1',
                title: 'Direct Query Article',
                sourceId: 'sample-source',
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

    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(screen.getByText('Newer News')).toBeInTheDocument();
    expect(screen.getByText('Mid Review')).toBeInTheDocument();
    expect(screen.queryByText('Direct Query Article')).not.toBeInTheDocument();
  });

  it('shows a distinct "unavailable" message when the direct query fails, different from the empty-articles message (FR-010)', async () => {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return {
          data: sourceFeed({ status: 'unavailable', articles: [] }),
          isLoading: false,
        };
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

describe('FeedArticleBoard source selection ignores categories (feature 067, FR-013; replaces spec 041 FR-012 category AND source)', () => {
  beforeEach(() => {
    mockUseSourceFeed.mockReset();
    mockUseSourceFeed.mockImplementation((sourceId: string | null) => {
      if (sourceId === 'sample-source') {
        return {
          data: sourceFeed({
            articles: [
              article({
                id: 'sample-news',
                title: 'Sample Source News',
                sourceId: 'sample-source',
                sourceName: 'Sample Source',
                category: 'News',
                publishedAt: '2026-07-08T00:00:00.000Z',
              }),
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

  it('shows every article of the selected source whatever its category', async () => {
    render(<FeedArticleBoard categories={categories} sourceStatuses={sourceStatuses} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));

    expect(screen.getByText('Sample Source News')).toBeInTheDocument();
    expect(screen.getByText('Sample Source Review')).toBeInTheDocument();
    expect(screen.queryByText('Newer News')).not.toBeInTheDocument();
  });
});

describe('FeedArticleBoard single-source Portada (feature 067, US3, FR-013, FR-015)', () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const img = (id: string) => `https://cdn.example.com/${id}.jpg`;

  // Every article from one source: the one-per-source rule must relax so all
  // 4 secondaries still fill, and a 10-day-old article is kept (no 7-day window).
  const singleSourceArticles = [1, 2, 3, 4, 5, 6].map((n) =>
    article({
      id: `s${n}`,
      title: `Sample Story ${n}`,
      sourceId: 'sample-source',
      sourceName: 'Sample Source',
      imageUrl: img(`s${n}`),
      publishedAt: ago(n * HOUR),
    }),
  );
  const tenDaysOld = article({
    id: 's-old',
    title: 'Ten Days Old Story',
    sourceId: 'sample-source',
    sourceName: 'Sample Source',
    imageUrl: img('s-old'),
    publishedAt: ago(10 * DAY),
  });

  const allSourcesCategories: CategoryGroup[] = [
    {
      category: 'News',
      articles: [
        article({
          id: 'mi-lead',
          title: 'All Sources Lead',
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          imageUrl: img('mi-lead'),
          publishedAt: ago(HOUR),
        }),
        article({
          id: 'ss-tile',
          title: 'All Sources Tile',
          sourceId: 'sample-source',
          sourceName: 'Sample Source',
          imageUrl: img('ss-tile'),
          publishedAt: ago(2 * HOUR),
        }),
      ],
    },
  ];

  function topStoryTitles() {
    const heading = screen.getByRole('heading', { level: 2, name: 'Top stories' });
    return within(heading.closest('section') as HTMLElement)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
  }

  function latestTitles() {
    const heading = screen.getByRole('heading', { level: 2, name: 'Latest' });
    const list = heading.parentElement?.querySelector('ul') as HTMLUListElement;
    return within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
  }

  function mockSourceFeed(result: { data?: SourceFeedResponse; isLoading: boolean }) {
    mockUseSourceFeed.mockImplementation((sourceId: string | null) =>
      sourceId === 'sample-source' ? result : { data: undefined, isLoading: false },
    );
  }

  async function selectSampleSource() {
    render(
      <FeedArticleBoard
        categories={allSourcesCategories}
        sourceStatuses={sourceStatuses}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sample Source' }));
    return user;
  }

  beforeEach(() => {
    mockUseSourceFeed.mockReset();
  });

  it('renders a lead plus 4 secondaries all from the selected source, and keeps a 10-day-old article in Latest', async () => {
    mockSourceFeed({
      data: sourceFeed({ articles: [...singleSourceArticles, tenDaysOld] }),
      isLoading: false,
    });

    await selectSampleSource();

    expect(topStoryTitles()).toEqual([
      'Sample Story 1',
      'Sample Story 2',
      'Sample Story 3',
      'Sample Story 4',
      'Sample Story 5',
    ]);
    expect(latestTitles()).toEqual(['Sample Story 6', 'Ten Days Old Story']);
    expect(screen.queryByText('All Sources Lead')).not.toBeInTheDocument();
  });

  it('restores the all-sources slots when "All sources" is selected again', async () => {
    mockSourceFeed({
      data: sourceFeed({ articles: [...singleSourceArticles, tenDaysOld] }),
      isLoading: false,
    });

    const user = await selectSampleSource();
    await user.click(screen.getByRole('button', { name: 'All sources' }));

    expect(topStoryTitles()).toEqual(['All Sources Lead', 'All Sources Tile']);
    expect(screen.queryByText('Sample Story 1')).not.toBeInTheDocument();
  });

  it('shows "… is temporarily unavailable right now." for an unavailable source feed', async () => {
    mockSourceFeed({
      data: sourceFeed({ status: 'unavailable', articles: [] }),
      isLoading: false,
    });

    await selectSampleSource();

    expect(
      screen.getByText('Sample Source is temporarily unavailable right now.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Top stories' }),
    ).not.toBeInTheDocument();
  });

  it('shows Portada skeletons (lead, tiles, rows) while the source feed loads', async () => {
    mockSourceFeed({ data: undefined, isLoading: true });

    const { container } = render(
      <FeedArticleBoard
        categories={allSourcesCategories}
        sourceStatuses={sourceStatuses}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sample Source' }));

    const count = (variant: string) =>
      container.querySelectorAll(`[data-variant="${variant}"]`).length;
    expect(count('lead')).toBe(1);
    expect(count('tile')).toBeGreaterThan(0);
    expect(count('row')).toBeGreaterThan(0);
    expect(screen.queryByText('All Sources Lead')).not.toBeInTheDocument();
  });
});
