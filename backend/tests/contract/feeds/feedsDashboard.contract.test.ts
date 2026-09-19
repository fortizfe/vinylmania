import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import type { FeedSourceConfig } from '../../../src/domain/feeds/types';
import { clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const CONTRACT_SOURCE_A: FeedSourceConfig = {
  id: 'contract-source-a',
  name: 'Contract Feed A',
  feedUrl: 'https://contract-feed-a.test/rss',
  category: 'News',
  enabled: true,
  priority: true,
};
const CONTRACT_SOURCE_B: FeedSourceConfig = {
  id: 'contract-source-b',
  name: 'Contract Feed B',
  feedUrl: 'https://contract-feed-b.test/rss',
  category: 'Reviews',
  enabled: true,
  priority: false,
};

const mockMultiCategorySources: FeedSourceConfig[] = [
  {
    id: 'contract-source-c',
    name: 'Contract Feed C',
    feedUrl: 'https://contract-feed-c.test/rss',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'contract-source-d',
    name: 'Contract Feed D',
    feedUrl: 'https://contract-feed-d.test/rss',
    category: 'Reviews',
    enabled: true,
    priority: false,
  },
  {
    id: 'contract-source-e',
    name: 'Contract Feed E',
    feedUrl: 'https://contract-feed-e.test/rss',
    category: 'Interviews',
    enabled: true,
    priority: false,
  },
  {
    id: 'contract-source-f',
    name: 'Contract Feed F',
    feedUrl: 'https://contract-feed-f.test/rss',
    category: 'Articles',
    enabled: true,
    priority: false,
  },
  {
    id: 'contract-source-g',
    name: 'Contract Feed G',
    feedUrl: 'https://contract-feed-g.test/rss',
    category: 'Staff Picks',
    enabled: true,
    priority: false,
  },
];

jest.mock('../../../src/domain/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'contract-source-a',
      name: 'Contract Feed A',
      feedUrl: 'https://contract-feed-a.test/rss',
      category: 'News',
      enabled: true,
      priority: true,
    },
    {
      id: 'contract-source-b',
      name: 'Contract Feed B',
      feedUrl: 'https://contract-feed-b.test/rss',
      category: 'Reviews',
      enabled: true,
      priority: false,
    },
    ...mockMultiCategorySources,
  ],
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../../src/app';

const app = createApp();

const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;
// Relative to the real clock: the route's composition root can't take an injected `now` (spec 067 D7).
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR_MS).toUTCString();

interface ContractArticle {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  publishedAt: string;
  link: string;
  sourceId: string;
  sourceName: string;
  category: string;
}

function rssXml(items: Array<{ title: string; link: string; pubDate: string }>): string {
  const itemsXml = items
    .map(
      (item) => `
      <item>
        <title>${item.title}</title>
        <link>${item.link}</link>
        <guid>${item.link}</guid>
        <pubDate>${item.pubDate}</pubDate>
      </item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test</title>${itemsXml}</channel></rss>`;
}

describe('Feeds dashboard API contract: GET /api/feeds/dashboard', () => {
  beforeEach(async () => {
    await invalidateCache(`feeds:${CONTRACT_SOURCE_A.id}`);
    await invalidateCache(`feeds:${CONTRACT_SOURCE_B.id}`);
    await Promise.all(
      mockMultiCategorySources.map((source) => invalidateCache(`feeds:${source.id}`)),
    );
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns 200 with the categories/sourceStatuses shape for an authenticated caller', async () => {
    const { sessionToken } = await createTestSession('feeds-contract-user');

    nock('https://contract-feed-a.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'News Item',
            link: 'https://contract-feed-a.test/1',
            pubDate: hoursAgo(2),
          },
        ]),
      );
    nock('https://contract-feed-b.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Review Item',
            link: 'https://contract-feed-b.test/1',
            pubDate: hoursAgo(1),
          },
        ]),
      );

    for (const source of mockMultiCategorySources) {
      // Dated before contract-feed-a/-b's items so they never displace the
      // pre-existing articles[0] assertions below when categories merge.
      nock(new URL(source.feedUrl).origin)
        .get(new URL(source.feedUrl).pathname)
        .reply(
          200,
          rssXml([
            {
              title: `${source.id} Item`,
              link: `${source.feedUrl}#1`,
              pubDate: hoursAgo(24),
            },
          ]),
        );
    }

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'contract-source-a',
          sourceName: 'Contract Feed A',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'contract-source-b',
          sourceName: 'Contract Feed B',
          status: 'ok',
          priority: false,
        },
        ...mockMultiCategorySources.map((source) => ({
          sourceId: source.id,
          sourceName: source.name,
          status: 'ok',
          priority: false,
        })),
      ]),
    );

    const articles: ContractArticle[] = res.body.categories.flatMap(
      (c: { articles: ContractArticle[] }) => c.articles,
    );
    expect(articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'News Item',
          sourceName: 'Contract Feed A',
          link: 'https://contract-feed-a.test/1',
        }),
        expect.objectContaining({
          title: 'Review Item',
          sourceName: 'Contract Feed B',
          link: 'https://contract-feed-b.test/1',
        }),
      ]),
    );

    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('keeps the response shape and returns at most 60 articles from the last 7 days, omitting a source with nothing recent from categories only (spec 067 FR-010, contracts/feeds-api.md)', async () => {
    const { sessionToken } = await createTestSession('feeds-contract-window-user');

    // Feed A (News): 70 recent articles, all newer than Feed C's.
    nock('https://contract-feed-a.test')
      .get('/rss')
      .reply(
        200,
        rssXml(
          Array.from({ length: 70 }, (_, i) => ({
            title: `A ${i}`,
            link: `https://contract-feed-a.test/${i}`,
            pubDate: hoursAgo(1 + i),
          })),
        ),
      );
    nock('https://contract-feed-b.test').get('/rss').reply(200, rssXml([]));
    // Feed C (News, like A): 4 articles older than all of A's, inside the window.
    // Feed E (its own category): only an article from 10 days ago. The rest: empty.
    for (const source of mockMultiCategorySources) {
      const url = new URL(source.feedUrl);
      let items: Array<{ title: string; link: string; pubDate: string }> = [];
      if (source.id === 'contract-source-c') {
        items = Array.from({ length: 4 }, (_, i) => ({
          title: `C ${i}`,
          link: `${source.feedUrl}#${i}`,
          pubDate: hoursAgo(100 + i),
        }));
      } else if (source.id === 'contract-source-e') {
        items = [
          {
            title: 'Stale E',
            link: `${source.feedUrl}#stale`,
            pubDate: hoursAgo(10 * 24),
          },
        ];
      }
      nock(url.origin).get(url.pathname).reply(200, rssXml(items));
    }

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['categories', 'generatedAt', 'sourceStatuses'].sort(),
    );
    expect(typeof res.body.generatedAt).toBe('string');
    for (const group of res.body.categories) {
      expect(typeof group.category).toBe('string');
      expect(Array.isArray(group.articles)).toBe(true);
    }

    const articles: ContractArticle[] = res.body.categories.flatMap(
      (c: { articles: ContractArticle[] }) => c.articles,
    );
    for (const article of articles) {
      expect(article).toEqual({
        id: expect.any(String),
        title: expect.any(String),
        excerpt: expect.any(String),
        ...(article.imageUrl !== undefined && { imageUrl: expect.any(String) }),
        publishedAt: expect.any(String),
        link: expect.any(String),
        sourceId: expect.any(String),
        sourceName: expect.any(String),
        category: expect.any(String),
      });
    }

    expect(articles.length).toBeGreaterThan(0);
    expect(articles.length).toBeLessThanOrEqual(60);
    const windowStart = Date.now() - WEEK_MS;
    expect(articles.every((a) => new Date(a.publishedAt).getTime() >= windowStart)).toBe(
      true,
    );
    // Feed C's 3 newest survive Feed A's volume (FR-010).
    expect(articles.map((a) => a.title)).toEqual(
      expect.arrayContaining(['C 0', 'C 1', 'C 2']),
    );

    expect(articles.some((a) => a.sourceId === 'contract-source-e')).toBe(false);
    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'contract-source-e',
          sourceName: 'Contract Feed E',
          status: 'ok',
          priority: false,
        },
      ]),
    );
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/feeds/dashboard');

    expect(res.status).toBe(401);
  });
});
