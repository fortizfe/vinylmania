import { createFeedsAggregationUseCase } from '../../../../src/application/feeds/getFeedsDashboard';
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
  };
}

describe('getDashboard', () => {
  let feedSource: jest.Mocked<FeedSourcePort>;
  let cache: jest.Mocked<CachePort>;
  let getDashboard: ReturnType<typeof createFeedsAggregationUseCase>['getDashboard'];

  beforeEach(() => {
    feedSource = fakeFeedSource();
    cache = fakeCache();
    ({ getDashboard } = createFeedsAggregationUseCase({
      feedSource,
      cache,
      feedSources: testFeedSources,
    }));
  });

  it('fans out across every enabled source, merging their articles and marking each ok', async () => {
    feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === testFeedSources[0].feedUrl) {
        return [
          {
            title: 'A1',
            link: 'https://source-a.test/1',
            pubDate: 'Mon, 01 Jan 2026 00:00:00 GMT',
          },
        ];
      }
      if (feedUrl === testFeedSources[1].feedUrl) {
        return [
          {
            title: 'B1',
            link: 'https://source-b.test/1',
            pubDate: 'Tue, 02 Jan 2026 00:00:00 GMT',
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
        return [{ title: 'Healthy Article', link: 'https://source-a.test/2' }];
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

  it('propagates each source\'s priority flag onto its sourceStatuses entry (data-model.md, spec FR-010 supporting)', async () => {
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

  describe('category grouping, sorting, and cap (spec 024 FR-012, superseded by 025 FR-006)', () => {
    it('sorts each category by most-recent first and caps it to the top 10 articles', async () => {
      const twelveItems: RawFeedItem[] = Array.from({ length: 12 }).map((_, index) => ({
        title: `Article ${index}`,
        link: `https://source-a.test/${index}`,
        // index 0 is oldest, index 11 is newest
        pubDate: new Date(Date.UTC(2026, 0, index + 1)).toUTCString(),
      }));

      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          return twelveItems;
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          return [];
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      const newsCategory = result.categories.find((c) => c.category === 'News');
      expect(newsCategory?.articles).toHaveLength(10);
      expect(newsCategory?.articles.map((a) => a.title)).toEqual([
        'Article 11',
        'Article 10',
        'Article 9',
        'Article 8',
        'Article 7',
        'Article 6',
        'Article 5',
        'Article 4',
        'Article 3',
        'Article 2',
      ]);
    });

    it('merges articles from two sources sharing the same category label, capped at 10 combined rather than 10 per source (feature 025 FR-004, SC-005)', async () => {
      // Both testFeedSources[0] and [1] are configured with category "News" —
      // 7 items each (14 total) must collapse into one "News" entry capped
      // at 10 combined, sorted by recency across both sources' items.
      function itemsFor(prefix: string, count: number, startDay: number): RawFeedItem[] {
        return Array.from({ length: count }).map((_, index) => ({
          title: `${prefix}-${index}`,
          link: `https://${prefix}.test/${index}`,
          pubDate: new Date(Date.UTC(2026, 0, startDay + index)).toUTCString(),
        }));
      }

      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          // Days 1-7
          return itemsFor('source-a', 7, 1);
        }
        if (feedUrl === testFeedSources[1].feedUrl) {
          // Days 8-14 (all newer than Source A's items)
          return itemsFor('source-b', 7, 8);
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      const newsCategories = result.categories.filter((c) => c.category === 'News');
      expect(newsCategories).toHaveLength(1);
      expect(newsCategories[0].articles).toHaveLength(10);
      // The 10 most recent combined: all 7 from source-b (days 8-14) plus the 3 newest from source-a (days 7,6,5).
      expect(newsCategories[0].articles.map((a) => a.title)).toEqual([
        'source-b-6',
        'source-b-5',
        'source-b-4',
        'source-b-3',
        'source-b-2',
        'source-b-1',
        'source-b-0',
        'source-a-6',
        'source-a-5',
        'source-a-4',
      ]);
    });

    it('omits a category from the response when it ends up with zero articles', async () => {
      feedSource.fetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === testFeedSources[0].feedUrl) {
          return [{ title: 'Only Article', link: 'https://source-a.test/only' }];
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
  let getSourceArticles: ReturnType<typeof createFeedsAggregationUseCase>['getSourceArticles'];

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
