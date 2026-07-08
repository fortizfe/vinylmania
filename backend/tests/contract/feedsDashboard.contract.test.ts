import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../src/cache/cacheAside';
import type { FeedSourceConfig } from '../../src/feeds/types';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

const CONTRACT_SOURCE_A: FeedSourceConfig = {
  id: 'contract-source-a',
  name: 'Contract Feed A',
  feedUrl: 'https://contract-feed-a.test/rss',
  category: 'News',
  enabled: true,
};
const CONTRACT_SOURCE_B: FeedSourceConfig = {
  id: 'contract-source-b',
  name: 'Contract Feed B',
  feedUrl: 'https://contract-feed-b.test/rss',
  category: 'Reviews',
  enabled: true,
};

jest.mock('../../src/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'contract-source-a',
      name: 'Contract Feed A',
      feedUrl: 'https://contract-feed-a.test/rss',
      category: 'News',
      enabled: true,
    },
    {
      id: 'contract-source-b',
      name: 'Contract Feed B',
      feedUrl: 'https://contract-feed-b.test/rss',
      category: 'Reviews',
      enabled: true,
    },
  ],
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../src/app';

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

describe('Feeds dashboard API contract: GET /api/feeds/dashboard', () => {
  beforeEach(async () => {
    await invalidateCache(`feeds:${CONTRACT_SOURCE_A.id}`);
    await invalidateCache(`feeds:${CONTRACT_SOURCE_B.id}`);
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns 200 with the categories/sourceStatuses shape for an authenticated caller', async () => {
    const { idToken } = await getTestIdToken('feeds-contract-user');

    nock('https://contract-feed-a.test')
      .get('/rss')
      .reply(
        200,
        rssXml([{ title: 'News Item', link: 'https://contract-feed-a.test/1', pubDate: 'Tue, 07 Jul 2026 00:00:00 GMT' }]),
      );
    nock('https://contract-feed-b.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          { title: 'Review Item', link: 'https://contract-feed-b.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' },
        ]),
      );

    const res = await request(app).get('/api/feeds/dashboard').set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'contract-source-a', sourceName: 'Contract Feed A', status: 'ok' },
        { sourceId: 'contract-source-b', sourceName: 'Contract Feed B', status: 'ok' },
      ]),
    );

    const newsCategory = res.body.categories.find((c: { category: string }) => c.category === 'News');
    expect(newsCategory.articles[0]).toMatchObject({
      title: 'News Item',
      sourceName: 'Contract Feed A',
      link: 'https://contract-feed-a.test/1',
    });

    const reviewsCategory = res.body.categories.find((c: { category: string }) => c.category === 'Reviews');
    expect(reviewsCategory.articles[0]).toMatchObject({
      title: 'Review Item',
      sourceName: 'Contract Feed B',
      link: 'https://contract-feed-b.test/1',
    });

    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/feeds/dashboard');

    expect(res.status).toBe(401);
  });
});
