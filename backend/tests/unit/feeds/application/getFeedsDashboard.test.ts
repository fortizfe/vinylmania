import { createFeedsAggregationUseCase } from '../../../../src/application/feeds/getFeedsDashboard';
import { logger } from '../../../../src/config/logger';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { FeedSourcePort } from '../../../../src/ports/feeds/feedSourcePort';
import type { FeedSourceConfig, RawFeedItem } from '../../../../src/domain/feeds/types';

const testFeedSources: FeedSourceConfig[] = [
  {
    id: 'agg-test-a',
    name: 'Source A',
    feedUrl: 'https://source-a.test/rss',
    category: 'News',
    enabled: true,
    priority: true,
  },
  {
    id: 'agg-test-b',
    name: 'Source B',
    feedUrl: 'https://source-b.test/rss',
    category: 'News',
    enabled: true,
    priority: false,
  },
  {
    id: 'agg-test-disabled',
    name: 'Disabled Source',
    feedUrl: 'https://source-disabled.test/rss',
    category: 'Reviews',
    enabled: false,
    priority: false,
  },
];

function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    // Passthrough: these tests are about aggregation, not caching mechanics.
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

function fakeFeedSource(): jest.Mocked<FeedSourcePort> {
  return {
    fetchFeed: jest.fn<Promise<RawFeedItem[]>, [string, number?]>(),
    // Default "page has no preview image", so aggregation-only tests stay
    // unaffected by the spec 067 page lookup.
    fetchArticleHead: jest
      .fn<Promise<string | null>, [string, number]>()
      .mockResolvedValue(null),
  };
}

// Fixed clock for the dashboard's 7-day window (spec 067 D7 "Time source").
const NOW = new Date('2026-09-19T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;
const hoursBeforeNow = (h: number) => new Date(NOW.getTime() - h * HOUR_MS).toUTCString();

describe('getDashboard', () => {
  let feedSource: jest.Mocked<FeedSourcePort>;
  let cache: jest.Mocked<CachePort>;
  let getDashboard: ReturnType<typeof createFeedsAggregationUseCase>['getDashboard'];

  beforeEach(() => {
    feedSource = fakeFeedSource();
    cache = fakeCache();
    // Not an inline literal, so this compiles before `now` joins the deps type (T030).
    const deps = { feedSource, cache, feedSources: testFeedSources, now: () => NOW };
    ({ getDashboard } = createFeedsAggregationUseCase(deps));
  });

  it('fans out across every enabled source, merging their articles and marking each ok', async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return [
          {
            title: 'A1',
            link: 'https://source-a.test/1',
            pubDate: hoursBeforeNow(2),
          },
        ];
      }
      if (feedUrl === testFeedSources[1].feedUrl) {
        return [
          {
            title: 'B1',
            link: 'https://source-b.test/1',
            pubDate: hoursBeforeNow(1),
          },
        ];
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getDashboard();

    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'agg-test-a', sourceName: 'Source A', status: 'ok', priority: true },
        { sourceId: 'agg-test-b', sourceName: 'Source B', status: 'ok', priority: false },
      ]),
    );
    // The disabled source is never fetched and never appears in the response.
    expect(
      result.sourceStatuses.find((s) => s.sourceId === 'agg-test-disabled'),
    ).toBeUndefined();
    expect(feedSource.fetchFeed).toHaveBeenCalledTimes(2);

    const newsCategory = result.categories.find((c) => c.category === 'News');
    expect(newsCategory?.articles.map((a) => a.title).sort()).toEqual(['A1', 'B1']);
  });

  it("isolates one failing source into sourceStatuses without discarding the healthy source's articles", async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return [
          {
            title: 'Healthy Article',
            link: 'https://source-a.test/2',
            pubDate: hoursBeforeNow(1),
          },
        ];
      }
      if (feedUrl === testFeedSources[1].feedUrl) {
        throw new Error('simulated Cloudflare 403 challenge');
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getDashboard();

    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'agg-test-a', sourceName: 'Source A', status: 'ok', priority: true },
        {
          sourceId: 'agg-test-b',
          sourceName: 'Source B',
          status: 'unavailable',
          priority: false,
        },
      ]),
    );

    const newsCategory = result.categories.find((c) => c.category === 'News');
    expect(newsCategory?.articles).toHaveLength(1);
    expect(newsCategory?.articles[0].title).toBe('Healthy Article');
  });

  it("propagates each source's priority flag onto its sourceStatuses entry (data-model.md, spec FR-010 supporting)", async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return [{ title: 'A1', link: 'https://source-a.test/1' }];
      }
      if (feedUrl === testFeedSources[1].feedUrl) {
        throw new Error('simulated failure');
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getDashboard();

    const sourceA = result.sourceStatuses.find((s) => s.sourceId === 'agg-test-a');
    const sourceB = result.sourceStatuses.find((s) => s.sourceId === 'agg-test-b');
    expect(sourceA).toMatchObject({ status: 'ok', priority: true });
    expect(sourceB).toMatchObject({ status: 'unavailable', priority: false });
  });

  describe('category grouping and recent selection (spec 067 FR-010, D7)', () => {
    function itemsFor(
      prefix: string,
      count: number,
      startHoursAgo: number,
    ): RawFeedItem[] {
      // index 0 is newest
      return Array.from({ length: count }).map((_, index) => ({
        title: `${prefix}-${index}`,
        link: `https://${prefix}.test/${index}`,
        pubDate: hoursBeforeNow(startHoursAgo + index),
      }));
    }

    it('returns every in-window article newest first when there are fewer than 60, with no 10-cap', async () => {
      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          return itemsFor('source-a', 12, 1);
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          return [];
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      const newsCategory = result.categories.find((c) => c.category === 'News');
      expect(newsCategory?.articles.map((a) => a.title)).toEqual(
        Array.from({ length: 12 }, (_, index) => `source-a-${index}`),
      );
    });

    it("merges two sources sharing a category into one group of at most 60 from the last 7 days, keeping each source's 3 newest (SC-003)", async () => {
      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          // 70 recent articles, all newer than Source B's, plus one 8 days old.
          return [
            ...itemsFor('source-a', 70, 1),
            {
              title: 'source-a-old',
              link: 'https://source-a.test/old',
              pubDate: hoursBeforeNow(8 * 24),
            },
          ];
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          return itemsFor('source-b', 5, 100);
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      const newsCategories = result.categories.filter((c) => c.category === 'News');
      expect(newsCategories).toHaveLength(1);
      const articles = newsCategories[0].articles;
      const times = articles.map((a) => new Date(a.publishedAt).getTime());

      expect(articles).toHaveLength(60);
      expect(times.every((t) => t >= NOW.getTime() - WEEK_MS)).toBe(true);
      expect(times).toEqual([...times].sort((x, y) => y - x));
      expect(articles.map((a) => a.title)).toEqual(
        expect.arrayContaining(['source-b-0', 'source-b-1', 'source-b-2']),
      );
      expect(articles.map((a) => a.title)).not.toContain('source-a-old');
    });

    it('returns empty categories when no article is in the 7-day window', async () => {
      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          return itemsFor('source-a', 3, 8 * 24);
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          return [];
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      expect(result.categories).toEqual([]);
      expect(result.sourceStatuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceId: 'agg-test-a', status: 'ok' }),
        ]),
      );
    });

    it('omits a category from the response when it ends up with zero articles', async () => {
      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          return [
            {
              title: 'Only Article',
              link: 'https://source-a.test/only',
              pubDate: hoursBeforeNow(1),
            },
          ];
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          return [];
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      expect(result.categories.every((c) => c.articles.length > 0)).toBe(true);
    });
  });
});

describe('getSourceArticles (spec 041 FR-008, FR-009, FR-010)', () => {
  let feedSource: jest.Mocked<FeedSourcePort>;
  let cache: jest.Mocked<CachePort>;
  let getSourceArticles: ReturnType<
    typeof createFeedsAggregationUseCase
  >['getSourceArticles'];

  beforeEach(() => {
    feedSource = fakeFeedSource();
    cache = fakeCache();
    ({ getSourceArticles } = createFeedsAggregationUseCase({
      feedSource,
      cache,
      feedSources: testFeedSources,
    }));
  });

  it('returns every article for a known source uncapped, sorted most-recent-first', async () => {
    const twelveItems: RawFeedItem[] = Array.from({ length: 12 }).map((_, index) => ({
      title: `Article ${index}`,
      link: `https://source-a.test/${index}`,
      pubDate: new Date(Date.UTC(2026, 0, index + 1)).toUTCString(),
    }));
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return twelveItems;
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getSourceArticles('agg-test-a');

    expect(result?.status).toBe('ok');
    expect(result?.sourceId).toBe('agg-test-a');
    expect(result?.sourceName).toBe('Source A');
    expect(result?.articles).toHaveLength(12);
    expect(result?.articles[0].title).toBe('Article 11');
    expect(result?.articles[11].title).toBe('Article 0');
  });

  it('returns null for an unknown sourceId', async () => {
    const result = await getSourceArticles('does-not-exist');
    expect(result).toBeNull();
  });

  it('returns null for a disabled sourceId', async () => {
    const result = await getSourceArticles('agg-test-disabled');
    expect(result).toBeNull();
    expect(feedSource.fetchFeed).not.toHaveBeenCalled();
  });

  it('returns status "unavailable" with an empty article list when the underlying fetch throws', async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        throw new Error('simulated timeout');
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getSourceArticles('agg-test-a');

    expect(result).toEqual({
      sourceId: 'agg-test-a',
      sourceName: 'Source A',
      status: 'unavailable',
      articles: [],
      generatedAt: expect.any(String),
    });
  });

  it('returns status "ok" with an empty article list when the feed responds with zero items', async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return [];
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getSourceArticles('agg-test-a');

    expect(result).toEqual({
      sourceId: 'agg-test-a',
      sourceName: 'Source A',
      status: 'ok',
      articles: [],
      generatedAt: expect.any(String),
    });
  });
});

describe('article-page image lookup (spec 067 D4, D5, D6, D13, FR-004, FR-005, FR-014)', () => {
  const source = testFeedSources[0];
  const IMG_TTL_SECONDS = 604800;

  /** In-memory CachePort with cacheAside semantics: resolved values (incl. null) are cached, rejections are not. */
  function inMemoryCache(seed: Record<string, unknown> = {}) {
    const store = new Map<string, string>(
      Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
    );
    const cache: jest.Mocked<CachePort> = {
      has: jest.fn().mockImplementation(async (key: string) => store.has(key)),
      set: jest.fn().mockImplementation(async (key: string, value: string) => {
        store.set(key, value);
      }),
      withCache: jest
        .fn()
        .mockImplementation(
          async (key: string, _ttl: number, fetcher: () => Promise<unknown>) => {
            const hit = store.get(key);
            if (hit !== undefined) {
              return JSON.parse(hit);
            }
            const value = await fetcher();
            store.set(key, JSON.stringify(value));
            return value;
          },
        ),
      invalidate: jest.fn().mockImplementation(async (key: string) => {
        store.delete(key);
      }),
    };
    return { cache, store };
  }

  const link = (n: number) => `https://source-a.test/post-${n}`;
  const imgKey = (n: number) => `feeds:img:${link(n)}`;

  /** Higher n = newer. No image fields unless `extra` adds them. */
  function item(n: number, extra: Partial<RawFeedItem> = {}): RawFeedItem {
    return {
      title: `Post ${n}`,
      link: link(n),
      guid: link(n),
      isoDate: new Date(Date.UTC(2026, 8, 1, n)).toISOString(),
      ...extra,
    };
  }

  function pageWithImage(url: string): string {
    return `<html><head><meta property="og:image" content="${url}"></head></html>`;
  }

  let feedSource: jest.Mocked<FeedSourcePort>;

  function useCaseWith(cache: CachePort) {
    return createFeedsAggregationUseCase({ feedSource, cache, feedSources: [source] });
  }

  /** One source refresh: drop the 20-min feed blob, then read the source. */
  async function refresh(cache: jest.Mocked<CachePort>) {
    await cache.invalidate(`feeds:${source.id}`);
    return useCaseWith(cache).getSourceArticles(source.id);
  }

  function lookedUpLinks(): string[] {
    return feedSource.fetchArticleHead.mock.calls.map(([url]) => url);
  }

  beforeEach(() => {
    feedSource = fakeFeedSource();
  });

  it('looks up only articles without a feed image, newest first, with a 1000 ms timeout', async () => {
    feedSource.fetchFeed.mockResolvedValue([
      item(2),
      item(9, {
        enclosureUrl: 'https://cdn.source-a.test/9.jpg',
        enclosureType: 'image/jpeg',
      }),
      item(5),
      item(1),
    ]);
    const { cache } = inMemoryCache();

    await refresh(cache);

    expect(feedSource.fetchArticleHead.mock.calls).toEqual([
      [link(5), 1000],
      [link(2), 1000],
      [link(1), 1000],
    ]);
  });

  it('caches each lookup under feeds:img:<link> for 7 days', async () => {
    feedSource.fetchFeed.mockResolvedValue([item(1)]);
    const { cache } = inMemoryCache();

    await refresh(cache);

    expect(cache.withCache).toHaveBeenCalledWith(
      imgKey(1),
      IMG_TTL_SECONDS,
      expect.any(Function),
    );
  });

  it('starts at most 8 lookups per refresh; the rest are not cached and are looked up on the next refresh', async () => {
    const items = Array.from({ length: 18 }, (_, i) => item(i + 1)); // post-18 is newest
    feedSource.fetchFeed.mockResolvedValue(items);
    const { cache, store } = inMemoryCache();

    await refresh(cache);

    const newest8 = [18, 17, 16, 15, 14, 13, 12, 11].map(link);
    expect(feedSource.fetchArticleHead).toHaveBeenCalledTimes(8);
    expect(lookedUpLinks()).toEqual(newest8);
    for (let n = 1; n <= 10; n += 1) {
      expect(store.has(imgKey(n))).toBe(false);
    }

    feedSource.fetchArticleHead.mockClear();
    await refresh(cache);

    expect(feedSource.fetchArticleHead).toHaveBeenCalledTimes(8);
    expect(lookedUpLinks()).toEqual([10, 9, 8, 7, 6, 5, 4, 3].map(link));
  });

  it('does not look up a link whose cached result is null, and it does not count towards the 8', async () => {
    const items = Array.from({ length: 11 }, (_, i) => item(i + 1));
    feedSource.fetchFeed.mockResolvedValue(items);
    // The 3 newest were already resolved to "no image".
    const { cache } = inMemoryCache({
      [imgKey(11)]: null,
      [imgKey(10)]: null,
      [imgKey(9)]: null,
    });

    const result = await refresh(cache);

    expect(feedSource.fetchArticleHead).toHaveBeenCalledTimes(8);
    expect(lookedUpLinks()).not.toEqual(expect.arrayContaining([link(11)]));
    expect(lookedUpLinks()).not.toEqual(expect.arrayContaining([link(10)]));
    expect(lookedUpLinks()).not.toEqual(expect.arrayContaining([link(9)]));
    expect(result?.articles.find((a) => a.link === link(11))?.imageUrl).toBeUndefined();
  });

  it('leaves the article image-less on a rejected lookup and retries it on the next refresh', async () => {
    feedSource.fetchFeed.mockResolvedValue([item(1)]);
    feedSource.fetchArticleHead
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(pageWithImage('https://cdn.source-a.test/1-og.jpg'));
    const { cache, store } = inMemoryCache();

    const first = await refresh(cache);

    expect(first?.status).toBe('ok');
    expect(first?.articles[0].imageUrl).toBeUndefined();
    expect(store.has(imgKey(1))).toBe(false);

    const second = await refresh(cache);

    expect(feedSource.fetchArticleHead).toHaveBeenCalledTimes(2);
    expect(second?.articles[0].imageUrl).toBe('https://cdn.source-a.test/1-og.jpg');
  });

  it('drops a page image shared by 2 links but keeps identical feed-ladder images', async () => {
    const LOGO = 'https://source-a.test/logo.png';
    feedSource.fetchFeed.mockResolvedValue([
      item(1),
      item(2),
      item(3),
      item(4, { enclosureUrl: LOGO, enclosureType: 'image/png' }),
      item(5, { enclosureUrl: LOGO, enclosureType: 'image/png' }),
    ]);
    feedSource.fetchArticleHead.mockImplementation(async (url: string) =>
      url === link(3)
        ? pageWithImage('https://cdn.source-a.test/3-og.jpg')
        : pageWithImage(LOGO),
    );
    const { cache } = inMemoryCache();

    const result = await refresh(cache);
    const imageByLink = Object.fromEntries(
      (result?.articles ?? []).map((a) => [a.link, a.imageUrl]),
    );

    expect(imageByLink).toEqual({
      [link(1)]: undefined,
      [link(2)]: undefined,
      [link(3)]: 'https://cdn.source-a.test/3-og.jpg',
      [link(4)]: LOGO,
      [link(5)]: LOGO,
    });
  });

  it('keeps one article per duplicate link or guid within a source, and looks each up once (FR-014)', async () => {
    feedSource.fetchFeed.mockResolvedValue([
      item(4),
      {
        ...item(3),
        title: 'Same link, other guid',
        link: link(4),
        guid: 'urn:other-guid',
      },
      item(2),
      { ...item(1), title: 'Same guid, other link', guid: link(2) },
    ]);
    const { cache } = inMemoryCache();

    const result = await refresh(cache);

    expect(result?.articles.map((a) => a.title)).toEqual(['Post 4', 'Post 2']);
    expect(lookedUpLinks().sort()).toEqual([link(2), link(4)].sort());
  });

  it("emits exactly one feed_images_resolved log line per source refresh with the refresh's counts", async () => {
    const infoSpy = jest.spyOn(logger, 'info');
    const LOGO = 'https://source-a.test/logo.png';
    feedSource.fetchFeed.mockResolvedValue([
      item(7, {
        enclosureUrl: 'https://cdn.source-a.test/7.jpg',
        enclosureType: 'image/jpeg',
      }),
      item(6, { mediaThumbnails: ['https://cdn.source-a.test/6.jpg'] }),
      item(5), // page: unique image
      item(4), // page: shared logo
      item(3), // page: shared logo
      item(2), // page: no preview meta
      item(1), // page: timeout
    ]);
    feedSource.fetchArticleHead.mockImplementation(async (url: string) => {
      switch (url) {
        case link(5):
          return pageWithImage('https://cdn.source-a.test/5-og.jpg');
        case link(4):
        case link(3):
          return pageWithImage(LOGO);
        case link(2):
          return '<html><head><title>no preview</title></head></html>';
        default:
          throw new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError',
          );
      }
    });
    const { cache } = inMemoryCache();

    await refresh(cache);

    const imageLogs = infoSpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event.outcome === 'feed_images_resolved');
    expect(imageLogs).toHaveLength(1);
    expect(imageLogs[0]).toEqual(
      expect.objectContaining({
        route: 'feeds:images',
        outcome: 'feed_images_resolved',
        meta: {
          sourceId: source.id,
          articles: 7,
          fromFeed: 2,
          fromPage: 1,
          placeholders: 4,
          lookups: 5,
          lookupTimeouts: 1,
          logoDiscarded: 2,
        },
      }),
    );
    infoSpy.mockRestore();
  });
});
