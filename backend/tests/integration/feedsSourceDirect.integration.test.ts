import RedisMock from 'ioredis-mock';
import nock from 'nock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { invalidateCache } from '../../src/cache/cacheAside';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

// A low-frequency source sharing a category with a prolific one, so the
// general dashboard view's per-category top-10 cutoff excludes its articles
// — this is exactly the scenario the direct per-source endpoint must fix
// (spec 041 US3, FR-008, FR-009).
jest.mock('../../src/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'direct-prolific',
      name: 'Prolific Source',
      feedUrl: 'https://direct-prolific.test/rss',
      category: 'News',
      enabled: true,
      priority: true,
    },
    {
      id: 'direct-quiet',
      name: 'Quiet Source',
      feedUrl: 'https://direct-quiet.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
    },
    {
      id: 'direct-flaky',
      name: 'Flaky Source',
      feedUrl: 'https://direct-flaky.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
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

describe('Direct per-source feed query (spec 041 US3, FR-008, FR-009, FR-010)', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  beforeEach(async () => {
    await invalidateCache('feeds:direct-prolific');
    await invalidateCache('feeds:direct-quiet');
    await invalidateCache('feeds:direct-flaky');
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it("returns the quiet source's article via the direct endpoint even though it doesn't survive the general view's top-10 cutoff (Acceptance Scenario 1, FR-008)", async () => {
    const { idToken } = await getTestIdToken('feeds-source-direct-user');

    // 10 recent items from the prolific source fill the News category's cap
    // entirely, all newer than the quiet source's single article.
    nock('https://direct-prolific.test')
      .get('/rss')
      .reply(
        200,
        rssXml(
          Array.from({ length: 10 }).map((_, index) => ({
            title: `Prolific ${index}`,
            link: `https://direct-prolific.test/${index}`,
            pubDate: new Date(Date.UTC(2026, 6, 10 + index)).toUTCString(),
          })),
        ),
      );
    nock('https://direct-quiet.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Quiet Article',
            link: 'https://direct-quiet.test/1',
            pubDate: new Date(Date.UTC(2026, 6, 1)).toUTCString(),
          },
        ]),
      );
    nock('https://direct-flaky.test').get('/rss').reply(200, rssXml([]));

    const dashboardRes = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);
    const newsCategory = dashboardRes.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategory.articles).toHaveLength(10);
    expect(
      newsCategory.articles.some((a: { title: string }) => a.title === 'Quiet Article'),
    ).toBe(false);

    const directRes = await request(app)
      .get('/api/feeds/sources/direct-quiet')
      .set('Authorization', `Bearer ${idToken}`);

    expect(directRes.status).toBe(200);
    expect(directRes.body.status).toBe('ok');
    expect(directRes.body.articles).toHaveLength(1);
    expect(directRes.body.articles[0].title).toBe('Quiet Article');
  });

  it('returns the same, non-duplicated articles for a source that already appears in the general view (Acceptance Scenario 2, FR-009)', async () => {
    const { idToken } = await getTestIdToken('feeds-source-direct-user-2');

    nock('https://direct-prolific.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Visible Article',
            link: 'https://direct-prolific.test/1',
            pubDate: new Date(Date.UTC(2026, 6, 10)).toUTCString(),
          },
        ]),
      );
    nock('https://direct-quiet.test').get('/rss').reply(200, rssXml([]));
    nock('https://direct-flaky.test').get('/rss').reply(200, rssXml([]));

    const dashboardRes = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);
    const newsCategory = dashboardRes.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategory.articles.map((a: { title: string }) => a.title)).toEqual([
      'Visible Article',
    ]);

    const directRes = await request(app)
      .get('/api/feeds/sources/direct-prolific')
      .set('Authorization', `Bearer ${idToken}`);

    expect(directRes.status).toBe(200);
    expect(directRes.body.status).toBe('ok');
    expect(directRes.body.articles).toHaveLength(1);
    expect(directRes.body.articles[0].title).toBe('Visible Article');
  });

  it('returns status "unavailable" for a source that fails, distinct from a reachable source with zero items (FR-010, edge case)', async () => {
    const { idToken } = await getTestIdToken('feeds-source-direct-user-3');

    nock('https://direct-flaky.test').get('/rss').reply(500);
    nock('https://direct-quiet.test').get('/rss').reply(200, rssXml([]));

    const flakyRes = await request(app)
      .get('/api/feeds/sources/direct-flaky')
      .set('Authorization', `Bearer ${idToken}`);
    expect(flakyRes.status).toBe(200);
    expect(flakyRes.body.status).toBe('unavailable');
    expect(flakyRes.body.articles).toEqual([]);

    const quietRes = await request(app)
      .get('/api/feeds/sources/direct-quiet')
      .set('Authorization', `Bearer ${idToken}`);
    expect(quietRes.status).toBe(200);
    expect(quietRes.body.status).toBe('ok');
    expect(quietRes.body.articles).toEqual([]);
  });
});
