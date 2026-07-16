import nock from 'nock';
import request from 'supertest';

import { invalidateCache } from '../../../src/adapters/cache/cacheAside';
import { FEED_SOURCES } from '../../../src/domain/feeds/feedSources';
import { clearEmulatorUsers, getTestIdToken } from '../../helpers/authEmulator';
import { createApp } from '../../../src/app';

const app = createApp();

const NEW_SOURCE_IDS = [
  'heavy-mag',
  'metal-underground',
  'heavy-metal-overload',
  'femme-metal',
  'metaltalk',
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

describe('Feeds dashboard with the expanded real catalog (spec 041 FR-005, FR-006, FR-007)', () => {
  beforeEach(async () => {
    await Promise.all(FEED_SOURCES.map((source) => invalidateCache(`feeds:${source.id}`)));
  });

  afterEach(async () => {
    await clearEmulatorUsers();
    nock.cleanAll();
  });

  it('contains exactly the 5 new confirmed-reachable sources and no Metal Blade Records entry', () => {
    for (const id of NEW_SOURCE_IDS) {
      expect(FEED_SOURCES.some((source) => source.id === id)).toBe(true);
    }
    expect(FEED_SOURCES.some((source) => source.feedUrl.includes('metalblade.com'))).toBe(false);
  });

  it('aggregates articles from every new source and isolates one failing new source from the rest (FR-007)', async () => {
    const { idToken } = await getTestIdToken('feeds-expanded-sources-user');

    for (const source of FEED_SOURCES) {
      const url = new URL(source.feedUrl);
      if (source.id === 'metal-underground') {
        nock(url.origin).get(url.pathname).reply(500);
        continue;
      }
      nock(url.origin)
        .get(url.pathname)
        .reply(
          200,
          rssXml([
            {
              title: `${source.name} Article`,
              link: `${source.feedUrl}#1`,
              pubDate: 'Mon, 13 Jul 2026 00:00:00 GMT',
            },
          ]),
        );
    }

    const res = await request(app)
      .get('/api/feeds/dashboard')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);

    const statusById = new Map(
      res.body.sourceStatuses.map((s: { sourceId: string; status: string }) => [
        s.sourceId,
        s.status,
      ]),
    );
    expect(statusById.get('metal-underground')).toBe('unavailable');
    for (const id of NEW_SOURCE_IDS.filter((id) => id !== 'metal-underground')) {
      expect(statusById.get(id)).toBe('ok');
    }

    const newsCategory = res.body.categories.find(
      (c: { category: string }) => c.category === 'News',
    );
    const titles = newsCategory.articles.map((a: { title: string }) => a.title);
    expect(titles).toContain('Heavy Mag Article');
    expect(titles).toContain('Heavy Metal Overload Article');
    expect(titles).toContain('Femme Metal Article');
    expect(titles).toContain('MetalTalk Article');
    expect(titles).not.toContain('Metal Underground Article');
  });
});
