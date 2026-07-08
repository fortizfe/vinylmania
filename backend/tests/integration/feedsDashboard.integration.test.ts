import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../src/cache/cacheAside';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

jest.mock('../../src/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'integration-source-a',
      name: 'Integration Feed A',
      feedUrl: 'https://integration-feed-a.test/rss',
      category: 'News',
      enabled: true,
    },
    {
      id: 'integration-source-b',
      name: 'Integration Feed B',
      feedUrl: 'https://integration-feed-b.test/rss',
      category: 'News',
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

describe('Feeds dashboard graceful degradation (spec FR-007, FR-011)', () => {
  beforeEach(async () => {
    await invalidateCache('feeds:integration-source-a');
    await invalidateCache('feeds:integration-source-b');
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns 200 with the healthy source’s articles when the other source returns a Cloudflare-style 403 challenge', async () => {
    const { idToken } = await getTestIdToken('feeds-integration-partial-user');

    nock('https://integration-feed-a.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Still Working',
            link: 'https://integration-feed-a.test/1',
            pubDate: 'Tue, 07 Jul 2026 00:00:00 GMT',
          },
        ]),
      );
    nock('https://integration-feed-b.test')
      .get('/rss')
      .reply(403, 'Cloudflare managed challenge', { 'cf-mitigated': 'challenge' });

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'integration-source-a',
          sourceName: 'Integration Feed A',
          status: 'ok',
        },
        {
          sourceId: 'integration-source-b',
          sourceName: 'Integration Feed B',
          status: 'unavailable',
        },
      ]),
    );

    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategory.articles).toHaveLength(1);
    expect(newsCategory.articles[0].title).toBe('Still Working');
  });

  it('returns 200 with empty categories and every source unavailable when all sources fail (FR-011)', async () => {
    const { idToken } = await getTestIdToken('feeds-integration-alldown-user');

    nock('https://integration-feed-a.test').get('/rss').reply(500);
    nock('https://integration-feed-b.test')
      .get('/rss')
      .reply(403, 'Cloudflare managed challenge', {
        'cf-mitigated': 'challenge',
      });

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'integration-source-a',
          sourceName: 'Integration Feed A',
          status: 'unavailable',
        },
        {
          sourceId: 'integration-source-b',
          sourceName: 'Integration Feed B',
          status: 'unavailable',
        },
      ]),
    );
  });
});
