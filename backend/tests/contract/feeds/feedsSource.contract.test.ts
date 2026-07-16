import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import type { FeedSourceConfig } from '../../../src/domain/feeds/types';
import { clearEmulatorUsers, getTestIdToken } from '../../helpers/authEmulator';

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
    const { idToken } = await getTestIdToken('feeds-source-contract-user');

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
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sourceId: 'contract-source-h',
      sourceName: 'Contract Feed H',
      status: 'ok',
    });
    // No ARTICLES_PER_CATEGORY-style cap — all 12 come back, not just 10.
    expect(res.body.articles).toHaveLength(12);
    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('returns 200 with status "unavailable" and no articles for a failing/timed-out source', async () => {
    const { idToken } = await getTestIdToken('feeds-source-contract-user-2');

    nock('https://contract-feed-h.test').get('/rss').reply(500);

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-h')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sourceId: 'contract-source-h',
      sourceName: 'Contract Feed H',
      status: 'unavailable',
      articles: [],
    });
  });

  it('returns 404 source_not_found for an unknown sourceId', async () => {
    const { idToken } = await getTestIdToken('feeds-source-contract-user-3');

    const res = await request(app)
      .get('/api/feeds/sources/does-not-exist')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'source_not_found' });
  });

  it('returns 404 source_not_found for a disabled sourceId', async () => {
    const { idToken } = await getTestIdToken('feeds-source-contract-user-4');

    const res = await request(app)
      .get('/api/feeds/sources/contract-source-disabled')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'source_not_found' });
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/feeds/sources/contract-source-h');

    expect(res.status).toBe(401);
  });
});
