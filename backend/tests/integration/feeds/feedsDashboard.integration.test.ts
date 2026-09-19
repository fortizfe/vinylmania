import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import { clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

jest.mock('../../../src/domain/feeds/feedSources', () => ({
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

// feedsRoutes.ts wires the adapter module directly (no injectable resolver),
// so the article-page lookup's DNS guard is stubbed at the module level with a
// public address (spec 067 D3). Only promises.lookup is overridden.
jest.mock('node:dns', () => ({
  ...jest.requireActual('node:dns'),
  promises: {
    ...jest.requireActual('node:dns').promises,
    lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  },
}));

// Imported after the mock above so the route/aggregator pick up the fixture sources.
import { createApp } from '../../../src/app';
import { FEED_SOURCES } from '../../../src/domain/feeds/feedSources';
import type { FeedSourceConfig } from '../../../src/domain/feeds/types';

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
    const { sessionToken } = await createTestSession('feeds-integration-partial-user');

    nock('https://integration-feed-a.test')
      .get('/rss')
      .reply(
        200,
        rssXml([
          {
            title: 'Still Working',
            link: 'https://integration-feed-a.test/1',
            pubDate: new Date(Date.now() - 3_600_000).toUTCString(),
          },
        ]),
      );
    nock('https://integration-feed-b.test')
      .get('/rss')
      .reply(403, 'Cloudflare managed challenge', { 'cf-mitigated': 'challenge' });

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

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
    const { sessionToken } = await createTestSession('feeds-integration-alldown-user');

    nock('https://integration-feed-a.test').get('/rss').reply(500);
    nock('https://integration-feed-b.test')
      .get('/rss')
      .reply(403, 'Cloudflare managed challenge', {
        'cf-mitigated': 'challenge',
      });

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

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

describe('Feeds dashboard article images (spec 067 D2, D3, D6)', () => {
  const imageSources: FeedSourceConfig[] = [
    {
      id: 'integration-media-only',
      name: 'Media Only',
      feedUrl: 'https://media-only.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
    },
    {
      id: 'integration-og-pages',
      name: 'OG Pages',
      feedUrl: 'https://og-pages.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
    },
    {
      id: 'integration-shared-logo',
      name: 'Shared Logo',
      feedUrl: 'https://shared-logo.test/rss',
      category: 'News',
      enabled: true,
      priority: false,
    },
  ];
  const originalSources = [...FEED_SOURCES];
  const HTML = { 'Content-Type': 'text/html; charset=utf-8' };

  // Recent dates so the scenario stays inside the dashboard's 7-day window (US2).
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toUTCString();

  function rssWithItems(itemsXml: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Test</title>${itemsXml}</channel></rss>`;
  }

  function plainItem(link: string, title: string, hours: number): string {
    return `<item><title>${title}</title><link>${link}</link><guid>${link}</guid><pubDate>${hoursAgo(hours)}</pubDate></item>`;
  }

  function pageWithOgImage(url: string): string {
    return `<html><head><title>Article</title><meta property="og:image" content="${url}"></head><body></body></html>`;
  }

  beforeAll(() => {
    // The mocked catalog is the same array the use case reads, so swapping its
    // contents scopes these sources to this describe only.
    FEED_SOURCES.splice(0, FEED_SOURCES.length, ...imageSources);
    nock.disableNetConnect();
    nock.enableNetConnect(
      (host) => host.includes('127.0.0.1') || host.includes('localhost'),
    );
  });

  afterAll(() => {
    FEED_SOURCES.splice(0, FEED_SOURCES.length, ...originalSources);
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    await Promise.all(
      imageSources.map((source) => invalidateCache(`feeds:${source.id}`)),
    );
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('returns feed-ladder and page og:image URLs, and none for a source whose pages share one logo', async () => {
    const { sessionToken } = await createTestSession('feeds-integration-images-user');

    nock('https://media-only.test')
      .get('/rss')
      .reply(
        200,
        rssWithItems(
          `<item><title>Media One</title><link>https://media-only.test/one</link><guid>https://media-only.test/one</guid><pubDate>${hoursAgo(1)}</pubDate><media:content url="https://cdn.media-only.test/one.jpg" medium="image" width="1200" /></item>`,
        ),
      );
    // Articles with a feed image are never looked up.
    const mediaPage = nock('https://media-only.test')
      .get('/one')
      .reply(200, pageWithOgImage('https://cdn.media-only.test/page.jpg'), HTML);

    nock('https://og-pages.test')
      .get('/rss')
      .reply(
        200,
        rssWithItems(
          plainItem('https://og-pages.test/one', 'OG One', 2) +
            plainItem('https://og-pages.test/two', 'OG Two', 3),
        ),
      )
      .get('/one')
      .reply(200, pageWithOgImage('https://cdn.og-pages.test/one.jpg'), HTML)
      .get('/two')
      .reply(200, pageWithOgImage('https://cdn.og-pages.test/two.jpg'), HTML);

    nock('https://shared-logo.test')
      .get('/rss')
      .reply(
        200,
        rssWithItems(
          plainItem('https://shared-logo.test/one', 'Logo One', 4) +
            plainItem('https://shared-logo.test/two', 'Logo Two', 5),
        ),
      )
      .get('/one')
      .reply(200, pageWithOgImage('https://shared-logo.test/horns-512.png'), HTML)
      .get('/two')
      .reply(200, pageWithOgImage('https://shared-logo.test/horns-512.png'), HTML);

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    const articles: Array<{ link: string; imageUrl?: string }> =
      res.body.categories.flatMap(
        (c: { articles: Array<{ link: string; imageUrl?: string }> }) => c.articles,
      );
    const imageByLink = Object.fromEntries(articles.map((a) => [a.link, a.imageUrl]));

    expect(imageByLink).toEqual({
      'https://media-only.test/one': 'https://cdn.media-only.test/one.jpg',
      'https://og-pages.test/one': 'https://cdn.og-pages.test/one.jpg',
      'https://og-pages.test/two': 'https://cdn.og-pages.test/two.jpg',
      'https://shared-logo.test/one': undefined,
      'https://shared-logo.test/two': undefined,
    });
    expect(mediaPage.isDone()).toBe(false);
  });
});
