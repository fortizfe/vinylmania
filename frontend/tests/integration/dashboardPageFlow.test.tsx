import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '../../src/pages/DashboardPage';
import { createTestQueryClient } from '../testUtils';

const mockGetDashboard = vi.fn();
const mockGetSourceFeed = vi.fn();

vi.mock('../../src/services/feedsApi', () => ({
  getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  getSourceFeed: (...args: unknown[]) => mockGetSourceFeed(...args),
}));

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/app']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard page flow (feature 024, US1)', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockGetSourceFeed.mockReset();
  });

  it('shows a loading state while feeds are being fetched', async () => {
    mockGetDashboard.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getAllByTestId('feed-article-card-skeleton').length).toBeGreaterThan(0);
  });

  it('shows a Portada-shaped loading skeleton: 1 lead, 4 tiles, 6 rows (feature 067, FR-015)', () => {
    mockGetDashboard.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = screen.getAllByTestId('feed-article-card-skeleton');
    const count = (variant: string) =>
      skeletons.filter((el) => el.getAttribute('data-variant') === variant).length;
    expect(count('lead')).toBe(1);
    expect(count('tile')).toBe(4);
    expect(count('row')).toBe(6);
    expect(skeletons).toHaveLength(11);
  });

  it('has a visually hidden "News" h1 as the first heading, while loading and once loaded (feature 067, FR-016)', async () => {
    let resolve: (value: unknown) => void = () => {};
    mockGetDashboard.mockImplementation(() => new Promise((r) => (resolve = r)));

    renderPage();

    const h1 = screen.getByRole('heading', { level: 1, name: 'News' });
    expect(h1).toHaveClass('sr-only');
    expect(screen.getAllByRole('heading')[0]).toBe(h1);

    resolve({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'Loaded Article',
              excerpt: 'x',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://metalinjection.net/a',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    await waitFor(() => expect(screen.getByText('Loaded Article')).toBeInTheDocument());
    const headings = screen.getAllByRole('heading');
    expect(headings[0]).toHaveTextContent('News');
    expect(headings[0].tagName).toBe('H1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the healthy-empty copy when every source is ok but there are no articles (feature 067, FR-015)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    expect(
      await screen.findByText('No news right now — check back soon.'),
    ).toBeInTheDocument();
  });

  it('renders articles with title, source, date, and a link that opens in a new tab', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'DEVILDRIVER Unleash New Video',
              excerpt: 'Off their new album.',
              publishedAt: '2026-07-07T21:17:03.000Z',
              link: 'https://metalinjection.net/new-music/devildriver',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('DEVILDRIVER Unleash New Video')).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Metal Injection/).length).toBeGreaterThan(0);

    const link = screen.getByRole('link', { name: /DEVILDRIVER Unleash New Video/i });
    expect(link).toHaveAttribute(
      'href',
      'https://metalinjection.net/new-music/devildriver',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('marks a down source on its chip with no banner, without hiding the healthy content (feature 067 US4, FR-015; replaces the banner case)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'Still Working Article',
              excerpt: 'x',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://metalinjection.net/a',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
        { sourceId: 'sample-source', sourceName: 'Sample Source', status: 'unavailable' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Still Working Article')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/showing the rest of the news/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sample Source\s+unavailable/i }),
    ).toBeInTheDocument();
  });

  it('renders every article together, not grouped into separate per-category sections (feature 033 US1, updated for 067)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'News Article',
              excerpt: 'x',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://metalinjection.net/news',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
        {
          category: 'Reviews',
          articles: [
            {
              id: '2',
              title: 'Review Article',
              excerpt: 'y',
              publishedAt: '2026-07-06T00:00:00.000Z',
              link: 'https://sample-source.test/reviews/1',
              sourceId: 'sample-source',
              sourceName: 'Sample Source',
              category: 'Reviews',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
        { sourceId: 'sample-source', sourceName: 'Sample Source', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());
    // Both articles render together (no per-category section headings). The
    // only "News" heading is the page's sr-only h1 (feature 067).
    expect(screen.getAllByRole('heading', { name: 'News' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'News' }).tagName).toBe('H1');
    expect(screen.queryByRole('heading', { name: 'Reviews' })).not.toBeInTheDocument();
    expect(screen.getByText('Review Article')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /News Article/i });
    expect(link).toHaveAttribute('href', 'https://metalinjection.net/news');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const main = document.querySelector('main');
    expect(main).toHaveClass('max-w-7xl');
  });

  it('shows every category together with no category filter to operate (feature 067, FR-013; replaces feature 024 US3)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'News Article',
              excerpt: 'x',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://metalinjection.net/news',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
        {
          category: 'Reviews',
          articles: [
            {
              id: '2',
              title: 'Review Article',
              excerpt: 'y',
              publishedAt: '2026-07-06T00:00:00.000Z',
              link: 'https://sample-source.test/reviews/1',
              sourceId: 'sample-source',
              sourceName: 'Sample Source',
              category: 'Reviews',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
        { sourceId: 'sample-source', sourceName: 'Sample Source', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());

    expect(screen.getByText('Review Article')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /filter by category/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reviews' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
  });

  it('renders all articles across categories in one grid with no carousel/arrow controls (feature 033 US1, FR-001/FR-002)', async () => {
    const articles = Array.from({ length: 7 }).map((_, index) => ({
      id: `news-${index}`,
      title: `News Article ${index}`,
      excerpt: 'x',
      publishedAt: `2026-07-0${(index % 7) + 1}T00:00:00.000Z`,
      link: `https://metalinjection.net/news-${index}`,
      sourceId: 'metal-injection',
      sourceName: 'Metal Injection',
      category: 'News',
    }));

    mockGetDashboard.mockResolvedValue({
      categories: [{ category: 'News', articles }],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('News Article 0')).toBeInTheDocument());

    // All 7 articles are present at once, no click-to-reveal interaction required.
    for (const article of articles) {
      expect(screen.getByText(article.title)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Metal Injection/).length).toBeGreaterThan(0);
    const firstLink = screen.getByRole('link', { name: /News Article 0/i });
    expect(firstLink).toHaveAttribute('target', '_blank');

    // No carousel navigation controls remain.
    expect(
      screen.queryByRole('button', { name: /previous articles/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next articles/i }),
    ).not.toBeInTheDocument();
  });

  it('renders articles from Reviews, Interviews, Articles, and Staff Picks together, with no category chips (feature 033 US1, updated for 067 FR-013)', async () => {
    function categoryFixture(category: string) {
      return {
        category,
        articles: [
          {
            id: `${category}-1`,
            title: `${category} Article`,
            excerpt: 'x',
            publishedAt: '2026-07-08T00:00:00.000Z',
            link: `https://sample-source.test/${category.toLowerCase()}/1`,
            sourceId: `sample-source-${category.toLowerCase()}`,
            sourceName: 'Sample Source',
            category,
          },
        ],
      };
    }

    mockGetDashboard.mockResolvedValue({
      categories: [
        categoryFixture('News'),
        categoryFixture('Reviews'),
        categoryFixture('Interviews'),
        categoryFixture('Articles'),
        categoryFixture('Staff Picks'),
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());

    for (const category of ['News', 'Reviews', 'Interviews', 'Articles', 'Staff Picks']) {
      expect(screen.getByText(`${category} Article`)).toBeInTheDocument();
    }

    expect(screen.queryByRole('button', { name: 'Staff Picks' })).not.toBeInTheDocument();
  });

  it('does not render a "Dashboard" page heading (feature 025 US3, FR-001)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'News Article',
              excerpt: 'x',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://metalinjection.net/news',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('filters by source via a direct query and clears back to the all-sources view (spec 041 US3; category step removed by 067 FR-013)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [
        {
          category: 'News',
          articles: [
            {
              id: '1',
              title: 'Metal Injection News',
              excerpt: 'x',
              publishedAt: '2026-07-09T00:00:00.000Z',
              link: 'https://metalinjection.net/news',
              sourceId: 'metal-injection',
              sourceName: 'Metal Injection',
              category: 'News',
            },
            {
              id: '2',
              title: 'Louder Sound News',
              excerpt: 'y',
              publishedAt: '2026-07-08T00:00:00.000Z',
              link: 'https://loudersound.com/news',
              sourceId: 'louder-sound',
              sourceName: 'Louder Sound',
              category: 'News',
            },
          ],
        },
        {
          category: 'Reviews',
          articles: [
            {
              id: '3',
              title: 'Sample Source Review',
              excerpt: 'z',
              publishedAt: '2026-07-07T00:00:00.000Z',
              link: 'https://sample-source.test/reviews/1',
              sourceId: 'sample-source',
              sourceName: 'Sample Source',
              category: 'Reviews',
            },
          ],
        },
      ],
      sourceStatuses: [
        {
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'louder-sound',
          sourceName: 'Louder Sound',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'sample-source',
          sourceName: 'Sample Source',
          status: 'ok',
          priority: false,
        },
      ],
      generatedAt: '2026-07-09T00:00:00.000Z',
    });

    // Louder Sound's direct query mirrors what already appears in the
    // general view (Acceptance Scenario 2, FR-009) — its own News article.
    mockGetSourceFeed.mockImplementation((sourceId: string) => {
      if (sourceId === 'louder-sound') {
        return Promise.resolve({
          sourceId: 'louder-sound',
          sourceName: 'Louder Sound',
          status: 'ok',
          articles: [
            {
              id: '2',
              title: 'Louder Sound News',
              excerpt: 'y',
              publishedAt: '2026-07-08T00:00:00.000Z',
              link: 'https://loudersound.com/news',
              sourceId: 'louder-sound',
              sourceName: 'Louder Sound',
              category: 'News',
            },
          ],
          generatedAt: '2026-07-09T00:00:00.000Z',
        });
      }
      return Promise.reject(new Error(`unexpected sourceId ${sourceId}`));
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Metal Injection News')).toBeInTheDocument(),
    );

    const user = userEvent.setup();

    // Source-only filter — now backed by a direct query to that source's feed.
    await user.click(screen.getByRole('button', { name: 'Louder Sound' }));
    await waitFor(() => expect(mockGetSourceFeed).toHaveBeenCalledWith('louder-sound'));
    await waitFor(() =>
      expect(screen.getByText('Louder Sound News')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Metal Injection News')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample Source Review')).not.toBeInTheDocument();

    // Clear the source filter, restoring the aggregated all-sources view (FR-011).
    await user.click(screen.getByRole('button', { name: 'All sources' }));
    expect(screen.getByText('Metal Injection News')).toBeInTheDocument();
    expect(screen.getByText('Louder Sound News')).toBeInTheDocument();
    expect(screen.getByText('Sample Source Review')).toBeInTheDocument();
  });

  it('shows only the single "temporarily unavailable" empty state when every source is down (feature 067 US4; replaces the FR-011 banner case)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [],
      sourceStatuses: [
        {
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          status: 'unavailable',
        },
        { sourceId: 'sample-source', sourceName: 'Sample Source', status: 'unavailable' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    expect(
      await screen.findByText('News is temporarily unavailable. Please try again later.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/check back soon/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Metal Injection/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sample Source/)).not.toBeInTheDocument();
  });
});
