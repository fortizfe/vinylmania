import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../src/cache/cacheAside';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

// A dedicated fixture set (own file, mirroring this project's existing
// per-file FEED_SOURCES convention) covering feature 025 US2: five new
// Metal Storm categories, one of which ("News") shares its label with an
// already-configured source and must merge rather than duplicate.
jest.mock('../../src/feeds/feedSources', () => ({
  FEED_SOURCES: [
    {
      id: 'ms-existing-news',
      name: 'Existing News Source',
      feedUrl: 'https://ms-existing-news.test/rss',
      category: 'News',
      enabled: true,
    },
    {
      id: 'metal-storm-news',
      name: 'Metal Storm',
      feedUrl: 'https://ms-news.test/rss',
      category: 'News',
      enabled: true,
    },
    {
      id: 'metal-storm-reviews',
      name: 'Metal Storm',
      feedUrl: 'https://ms-reviews.test/rss',
      category: 'Reviews',
      enabled: true,
    },
    {
      id: 'metal-storm-interviews',
      name: 'Metal Storm',
      feedUrl: 'https://ms-interviews.test/rss',
      category: 'Interviews',
      enabled: true,
    },
    {
      id: 'metal-storm-articles',
      name: 'Metal Storm',
      feedUrl: 'https://ms-articles.test/rss',
      category: 'Articles',
      enabled: true,
    },
    {
      id: 'metal-storm-picks',
      name: 'Metal Storm',
      feedUrl: 'https://ms-picks.test/rss',
      category: 'Staff Picks',
      enabled: true,
    },
  ],
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../src/app';

const app = createApp();

const ALL_SOURCE_IDS = [
  'ms-existing-news',
  'metal-storm-news',
  'metal-storm-reviews',
  'metal-storm-interviews',
  'metal-storm-articles',
  'metal-storm-picks',
];

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

describe('Feeds dashboard: additional Metal Storm categories (feature 025, US2)', () => {
  beforeEach(async () => {
    await Promise.all(ALL_SOURCE_IDS.map((id) => invalidateCache(`feeds:${id}`)));
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns News (merged), Reviews, Interviews, Articles, and Staff Picks categories when all sources are healthy (spec FR-002-FR-004)', async () => {
    const { idToken } = await getTestIdToken('feeds-metal-storm-categories-user');

    nock('https://ms-existing-news.test')
      .get('/rss')
      .reply(
        200,
        rssXml([{ title: 'Existing News Item', link: 'https://ms-existing-news.test/1', pubDate: 'Mon, 06 Jul 2026 00:00:00 GMT' }]),
      );
    nock('https://ms-news.test')
      .get('/rss')
      .reply(
        200,
        rssXml([{ title: 'Metal Storm News Item', link: 'https://ms-news.test/1', pubDate: 'Tue, 07 Jul 2026 00:00:00 GMT' }]),
      );
    nock('https://ms-reviews.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Review Item', link: 'https://ms-reviews.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-interviews.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Interview Item', link: 'https://ms-interviews.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-articles.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Article Item', link: 'https://ms-articles.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-picks.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Staff Pick Item', link: 'https://ms-picks.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));

    const res = await request(app).get('/api/feeds/dashboard').set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);

    const categoryNames = res.body.categories.map((c: { category: string }) => c.category);
    expect(categoryNames).toEqual(expect.arrayContaining(['News', 'Reviews', 'Interviews', 'Articles', 'Staff Picks']));

    // "News" must appear exactly once, combining both News-labeled sources — not duplicated.
    const newsCategories = res.body.categories.filter((c: { category: string }) => c.category === 'News');
    expect(newsCategories).toHaveLength(1);
    expect(newsCategories[0].articles.map((a: { title: string }) => a.title).sort()).toEqual(
      ['Existing News Item', 'Metal Storm News Item'].sort(),
    );

    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining(ALL_SOURCE_IDS.map((sourceId) => expect.objectContaining({ sourceId, status: 'ok' }))),
    );
  });

  it('keeps the other categories and marks only the failing source unavailable when one Metal Storm feed fails (spec FR-010)', async () => {
    const { idToken } = await getTestIdToken('feeds-metal-storm-categories-partial-user');

    nock('https://ms-existing-news.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Existing News Item', link: 'https://ms-existing-news.test/1', pubDate: 'Mon, 06 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-news.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Metal Storm News Item', link: 'https://ms-news.test/1', pubDate: 'Tue, 07 Jul 2026 00:00:00 GMT' }]));
    // Reviews is the sole source for its category and fails outright.
    nock('https://ms-reviews.test').get('/rss').reply(500);
    nock('https://ms-interviews.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Interview Item', link: 'https://ms-interviews.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-articles.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Article Item', link: 'https://ms-articles.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));
    nock('https://ms-picks.test')
      .get('/rss')
      .reply(200, rssXml([{ title: 'Staff Pick Item', link: 'https://ms-picks.test/1', pubDate: 'Wed, 08 Jul 2026 00:00:00 GMT' }]));

    const res = await request(app).get('/api/feeds/dashboard').set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);

    const categoryNames = res.body.categories.map((c: { category: string }) => c.category);
    expect(categoryNames).toEqual(expect.arrayContaining(['News', 'Interviews', 'Articles', 'Staff Picks']));
    expect(categoryNames).not.toContain('Reviews');

    expect(res.body.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'metal-storm-reviews', sourceName: 'Metal Storm', status: 'unavailable' },
        { sourceId: 'ms-existing-news', sourceName: 'Existing News Source', status: 'ok' },
        { sourceId: 'metal-storm-news', sourceName: 'Metal Storm', status: 'ok' },
        { sourceId: 'metal-storm-interviews', sourceName: 'Metal Storm', status: 'ok' },
        { sourceId: 'metal-storm-articles', sourceName: 'Metal Storm', status: 'ok' },
        { sourceId: 'metal-storm-picks', sourceName: 'Metal Storm', status: 'ok' },
      ]),
    );
  });
});
