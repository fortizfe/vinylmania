import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from '../../src/pages/DashboardPage';
import { createTestQueryClient } from '../testUtils';

const mockGetDashboard = vi.fn();

vi.mock('../../src/services/feedsApi', () => ({
  getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
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
  });

  it('shows a loading state while feeds are being fetched', async () => {
    mockGetDashboard.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getAllByTestId('feed-article-card-skeleton').length).toBeGreaterThan(0);
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
      sourceStatuses: [{ sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' }],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('DEVILDRIVER Unleash New Video')).toBeInTheDocument());
    expect(screen.getByText(/Metal Injection/)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /DEVILDRIVER Unleash New Video/i });
    expect(link).toHaveAttribute('href', 'https://metalinjection.net/new-music/devildriver');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows a non-blocking banner when a source is marked unavailable, without hiding the healthy content', async () => {
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
        { sourceId: 'metal-storm', sourceName: 'Metal Storm', status: 'unavailable' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Still Working Article')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/Metal Storm/);
  });

  it('groups articles under labeled category sections (feature 024, US2)', async () => {
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
              link: 'https://metalstorm.net/reviews/1',
              sourceId: 'metal-storm',
              sourceName: 'Metal Storm',
              category: 'Reviews',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
        { sourceId: 'metal-storm', sourceName: 'Metal Storm', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    expect(screen.getByText('Review Article')).toBeInTheDocument();
  });

  it('filters the view down to one category and restores the full view when cleared (feature 024, US3)', async () => {
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
              link: 'https://metalstorm.net/reviews/1',
              sourceId: 'metal-storm',
              sourceName: 'Metal Storm',
              category: 'Reviews',
            },
          ],
        },
      ],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'ok' },
        { sourceId: 'metal-storm', sourceName: 'Metal Storm', status: 'ok' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('News Article')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reviews' }));

    expect(screen.queryByText('News Article')).not.toBeInTheDocument();
    expect(screen.getByText('Review Article')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByText('News Article')).toBeInTheDocument();
    expect(screen.getByText('Review Article')).toBeInTheDocument();
  });

  it('shows a graceful empty state when there are zero articles across all sources (FR-011)', async () => {
    mockGetDashboard.mockResolvedValue({
      categories: [],
      sourceStatuses: [
        { sourceId: 'metal-injection', sourceName: 'Metal Injection', status: 'unavailable' },
        { sourceId: 'metal-storm', sourceName: 'Metal Storm', status: 'unavailable' },
      ],
      generatedAt: '2026-07-08T00:00:00.000Z',
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/check back soon/i)).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/Metal Injection/);
    expect(screen.getByRole('status')).toHaveTextContent(/Metal Storm/);
  });
});
