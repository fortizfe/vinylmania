import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import { clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

// A dedicated fixture set (own file, mirroring this project's existing
// per-file FEED_SOURCES convention) covering feature 033 US3: MetalSucks and
// Louder Sound merge into the existing "News" category alongside Metal
// Injection, and degrade gracefully per-source like every other feed.
jest.mock('../../../src/domain/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'metal-injection',
      name: 'Metal Injection',
      feedUrl: 'https://ns-metal-injection.test/rss',
      category: 'News',
      enabled: true,
      priority: true,
    },
    {
      id: 'metalsucks',
      name: 'MetalSucks',
      feedUrl: 'https://ns-metalsucks.test/rss',
      category: 'News',
      enabled: true,
      priority: true,
    },
    {
      id: 'louder-sound',
      name: 'Louder Sound',
      feedUrl: 'https://ns-louder-sound.test/rss',
      category: 'News',
      enabled: true,
      priority: true,
    },
  ],
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../../src/app';

const app = createApp();

const HOUR_MS = 3_600_000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR_MS).toUTCString();

const ALL_SOURCE_IDS = ['metal-injection', 'metalsucks', 'louder-sound'];

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

describe('Feeds dashboard: MetalSucks and Louder Sound (feature 033, US3)', () => {
  beforeEach(async () => {
    await Promise.all(ALL_SOURCE_IDS.map((id) => invalidateCache(`feeds:${id}`)));
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('merges MetalSucks and Louder Sound into the existing "News" category, keeping every source\'s 3 newest of the last 7 days, at most 60 (spec FR-008, FR-009; spec 067 FR-010)', async () => {
    const { sessionToken } = await createTestSession('feeds-new-sources-user');

    const items = (host: string, name: string, count: number, startHoursAgo: number) =>
      Array.from({ length: count }, (_, i) => ({
        title: `${name} ${i}`,
        link: `https://${host}/${i}`,
        pubDate: hoursAgo(startHoursAgo + i),
      }));

    // MetalSucks: 20 articles, all newer than the other two sources'.
    nock('https://ns-metalsucks.test')
      .get('/rss')
      .reply(200, rssXml(items('ns-metalsucks.test', 'MetalSucks', 20, 1)));
    // Metal Injection: 4 recent + one 8 days old (outside the window).
    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          ...items('ns-metal-injection.test', 'Metal Injection', 4, 30),
          {
            title: 'Metal Injection Old',
            link: 'https://ns-metal-injection.test/old',
            pubDate: hoursAgo(8 * 24),
          },
        ]),
      );
    nock('https://ns-louder-sound.test')
      .get('/rss')
      .reply(200, rssXml(items('ns-louder-sound.test', 'Louder Sound', 4, 40)));

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);

    const newsCategories = res.body.categories.filter(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategories).toHaveLength(1);
    const articles: Array<{ title: string; publishedAt: string }> =
      newsCategories[0].articles;
    const titles = articles.map((a) => a.title);

    expect(articles.length).toBeLessThanOrEqual(60);
    const windowStart = Date.now() - 7 * 24 * HOUR_MS;
    expect(articles.every((a) => new Date(a.publishedAt).getTime() >= windowStart)).toBe(
      true,
    );
    expect(titles).not.toContain('Metal Injection Old');
    expect(titles).toEqual(
      expect.arrayContaining([
        'MetalSucks 0',
        'MetalSucks 1',
        'MetalSucks 2',
        'Metal Injection 0',
        'Metal Injection 1',
        'Metal Injection 2',
        'Louder Sound 0',
        'Louder Sound 1',
        'Louder Sound 2',
      ]),
    );

    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'metalsucks',
          sourceName: 'MetalSucks',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'louder-sound',
          sourceName: 'Louder Sound',
          status: 'ok',
          priority: true,
        },
      ]),
    );
  });

  it('keeps the rest of the dashboard when MetalSucks fails, marking only it unavailable (spec FR-011, SC-006)', async () => {
    const { sessionToken } = await createTestSession('feeds-new-sources-partial-user');

    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Metal Injection Item',
            link: 'https://ns-metal-injection.test/1',
            pubDate: hoursAgo(3),
          },
        ]),
      );
    nock('https://ns-metalsucks.test').get('/rss').reply(500);
    nock('https://ns-louder-sound.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Louder Sound Item',
            link: 'https://ns-louder-sound.test/1',
            pubDate: hoursAgo(1),
          },
        ]),
      );

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);

    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategory.articles.map((a: { title: string }) => a.title).sort()).toEqual(
      ['Louder Sound Item', 'Metal Injection Item'].sort(),
    );

    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          status: 'ok',
          priority: true,
        },
        {
          sourceId: 'metalsucks',
          sourceName: 'MetalSucks',
          status: 'unavailable',
          priority: true,
        },
        {
          sourceId: 'louder-sound',
          sourceName: 'Louder Sound',
          status: 'ok',
          priority: true,
        },
      ]),
    );
  });

  it('returns zero items from MetalSucks without blocking the rest of the dashboard (edge case: zero available items)', async () => {
    const { sessionToken } = await createTestSession('feeds-new-sources-empty-user');

    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Metal Injection Item',
            link: 'https://ns-metal-injection.test/1',
            pubDate: hoursAgo(3),
          },
        ]),
      );
    nock('https://ns-metalsucks.test').get('/rss').reply(200, rssXml([]));
    nock('https://ns-louder-sound.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Louder Sound Item',
            link: 'https://ns-louder-sound.test/1',
            pubDate: hoursAgo(1),
          },
        ]),
      );

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategory.articles.map((a: { title: string }) => a.title).sort()).toEqual(
      ['Louder Sound Item', 'Metal Injection Item'].sort(),
    );
    expect(
      res.body.sourceStatuses.find(
        (s: { sourceId: string }) => s.sourceId === 'metalsucks',
      ),
    ).toMatchObject({ status: 'ok' });
  });
});
