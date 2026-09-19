import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import type { FeedSourceConfig } from '../../../src/domain/feeds/types';
import { clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const CONTRACT_SOURCE: FeedSourceConfig = {
  id: 'contract-source-h',
  name: 'Contract Feed H',
  feedUrl: 'https://contract-feed-h.test/rss',
  category: 'News',
  enabled: true,
  priority: false,
};
const DISABLED_SOURCE: FeedSourceConfig = {
  id: 'contract-source-disabled',
  name: 'Contract Feed Disabled',
  feedUrl: 'https://contract-feed-disabled.test/rss',
  category: 'News',
  enabled: false,
  priority: false,
};

jest.mock('../../../src/domain/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'contract-source-h',
      name: 'Contract Feed H',
      feedUrl: 'https://contract-feed-h.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
    },
    {
      id: 'contract-source-disabled',
      name: 'Contract Feed Disabled',
      feedUrl: 'https://contract-feed-disabled.test/rss',
      category: 'News',
      enabled: false,
      priority: false,
    },
  ],
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../../src/app';

const app = createApp();

function rssXml(
  items: Array<{ title: string; link: string; pubDate: string; guid?: string }>,
): string {
  const itemsXml = items
    .map(
      (item) => `
      <item>
        <title>${item.title}</title>
        <link>${item.link}</link>
        <guid>${item.guid ?? item.link}</guid>
        <pubDate>${item.pubDate}</pubDate>
      </item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test</title>${itemsXml}</channel></rss>`;
}

describe('Feeds source API contract: GET /api/feeds/sources/:sourceId', () => {
  beforeEach(async () => {
    await invalidateCache(`feeds:${CONTRACT_SOURCE.id}`);
    await invalidateCache(`feeds:${DISABLED_SOURCE.id}`);
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns 200 with every article for a reachable source', async () => {
    const { sessionToken } = await createTestSession('feeds-source-contract-user');

    nock('https://contract-feed-h.test')
      .get('/rss')
      .reply(
        200,
        rssXml(
          Array.from({ length: 12 }).map((_, index) => ({
            title: `Article ${index}`,
            link: `https://contract-feed-h.test/${index}`,
            pubDate: new Date(Date.UTC(2026, 0, index + 1)).toUTCString(),
          })),
        ),
      );

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-h')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sourceId: 'contract-source-h',
      sourceName: 'Contract Feed H',
      status: 'ok',
    });
    // No per-category cap — all 12 come back, not just 10.
    expect(res.body.articles).toHaveLength(12);
    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('returns every article newest first, deduplicated by link then id, with no 7-day window or cap', async () => {
    const { sessionToken } = await createTestSession('feeds-source-contract-user-5');
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;
    const now = Date.now();

    // 62 recent articles (more than the dashboard's 60 cap) plus one 10 days old.
    const unique = Array.from({ length: 62 }).map((_, index) => ({
      title: `Article ${index}`,
      link: `https://contract-feed-h.test/${index}`,
      pubDate: new Date(now - (index + 1) * HOUR_MS).toUTCString(),
    }));
    const old = {
      title: 'Old article',
      link: 'https://contract-feed-h.test/old',
      pubDate: new Date(now - 10 * DAY_MS).toUTCString(),
    };
    const sameLink = {
      title: 'Duplicate by link',
      link: unique[0].link,
      guid: 'dup-guid-by-link',
      pubDate: new Date(now - 30 * 60 * 1000).toUTCString(),
    };
    const sameId = {
      title: 'Duplicate by id',
      link: 'https://contract-feed-h.test/dup-by-id',
      guid: unique[1].link,
      pubDate: new Date(now - 20 * 60 * 1000).toUTCString(),
    };

    // Feed order is oldest first, so "newest first" must come from the API.
    nock('https://contract-feed-h.test')
      .get('/rss')
      .reply(200, rssXml([old, ...[...unique].reverse(), sameLink, sameId]));

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-h')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    const articles: Array<{
      id: string;
      link: string;
      title: string;
      publishedAt: string;
    }> = res.body.articles;

    expect(articles.map((a) => a.title)).toEqual([
      ...unique.map((a) => a.title),
      'Old article',
    ]);
    const times = articles.map((a) => new Date(a.publishedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(new Set(articles.map((a) => a.link)).size).toBe(articles.length);
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length);
  });

  it('returns 200 with status "unavailable" and no articles for a failing/timed-out source', async () => {
    const { sessionToken } = await createTestSession('feeds-source-contract-user-2');

    nock('https://contract-feed-h.test').get('/rss').reply(500);

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-h')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sourceId: 'contract-source-h',
      sourceName: 'Contract Feed H',
      status: 'unavailable',
      articles: [],
    });
  });

  it('returns 404 source_not_found for an unknown sourceId', async () => {
    const { sessionToken } = await createTestSession('feeds-source-contract-user-3');

    const res = await request(app)
      .get('/api/feeds/sources/does-not-exist')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'source_not_found' });
  });

  it('returns 404 source_not_found for a disabled sourceId', async () => {
    const { sessionToken } = await createTestSession('feeds-source-contract-user-4');

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-disabled')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'source_not_found' });
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/feeds/sources/contract-source-h');

    expect(res.status).toBe(401);
  });
});
