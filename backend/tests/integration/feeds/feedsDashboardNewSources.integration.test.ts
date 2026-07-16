import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import { clearEmulatorUsers, getTestIdToken } from '../../helpers/authEmulator';

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

  it('merges MetalSucks and Louder Sound articles into the existing "News" category, capped at 10 combined (spec FR-008, FR-009, FR-010)', async () => {
    const { idToken } = await getTestIdToken('feeds-new-sources-user');

    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Metal Injection Item',
            link: 'https://ns-metal-injection.test/1',
            pubDate: 'Mon, 06 Jul 2026 00:00:00 GMT',
          },
        ]),
      );
    nock('https://ns-metalsucks.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'MetalSucks Item',
            link: 'https://ns-metalsucks.test/1',
            pubDate: 'Tue, 07 Jul 2026 00:00:00 GMT',
          },
        ]),
      );
    nock('https://ns-louder-sound.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Louder Sound Item',
            link: 'https://ns-louder-sound.test/1',
            pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT',
          },
        ]),
      );

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);

    const newsCategories = res.body.categories.filter(
      (c: { category: string }) => c.category === 'News',
    );
    expect(newsCategories).toHaveLength(1);
    expect(
      newsCategories[0].articles.map((a: { title: string }) => a.title).sort(),
    ).toEqual(['Louder Sound Item', 'Metal Injection Item', 'MetalSucks Item'].sort());
    expect(newsCategories[0].articles.length).toBeLessThanOrEqual(10);

    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        {
          sourceId: 'metal-injection',
          sourceName: 'Metal Injection',
          status: 'ok',
          priority: true,
        },
        { sourceId: 'metalsucks', sourceName: 'MetalSucks', status: 'ok', priority: true },
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
    const { idToken } = await getTestIdToken('feeds-new-sources-partial-user');

    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Metal Injection Item',
            link: 'https://ns-metal-injection.test/1',
            pubDate: 'Mon, 06 Jul 2026 00:00:00 GMT',
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
            pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT',
          },
        ]),
      );

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);

    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(
      newsCategory.articles.map((a: { title: string }) => a.title).sort(),
    ).toEqual(['Louder Sound Item', 'Metal Injection Item'].sort());

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
    const { idToken } = await getTestIdToken('feeds-new-sources-empty-user');

    nock('https://ns-metal-injection.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Metal Injection Item',
            link: 'https://ns-metal-injection.test/1',
            pubDate: 'Mon, 06 Jul 2026 00:00:00 GMT',
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
            pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT',
          },
        ]),
      );

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    expect(
      newsCategory.articles.map((a: { title: string }) => a.title).sort(),
    ).toEqual(['Louder Sound Item', 'Metal Injection Item'].sort());
    expect(
      res.body.sourceStatuses.find((s: { sourceId: string }) => s.sourceId === 'metalsucks'),
    ).toMatchObject({ status: 'ok' });
  });
});
