import type { FeedSourceConfig } from '../../src/feeds/types';

const mockFeedSources: FeedSourceConfig[] = [
  { id: 'agg-test-a', name: 'Source A', feedUrl: 'https://source-a.test/rss', category: 'News', enabled: true },
  { id: 'agg-test-b', name: 'Source B', feedUrl: 'https://source-b.test/rss', category: 'News', enabled: true },
  {
    id: 'agg-test-disabled',
    name: 'Disabled Source',
    feedUrl: 'https://source-disabled.test/rss',
    category: 'Reviews',
    enabled: false,
  },
];

jest.mock('../../src/feeds/feedSources', () => ({ FEED_SOURCES: mockFeedSources }));
jest.mock('../../src/feeds/feedClient');

import { invalidateCache } from '../../src/cache/cacheAside';
import { fetchFeed } from '../../src/feeds/feedClient';
import { getDashboard } from '../../src/feeds/feedAggregator';

const mockedFetchFeed = jest.mocked(fetchFeed);

interface RawItem {
  title: string;
  link: string;
  pubDate?: string;
}

function feedOutput(items: RawItem[]) {
  return { items } as unknown as Awaited<ReturnType<typeof fetchFeed>>;
}

describe('getDashboard', () => {
  beforeEach(async () => {
    await invalidateCache('feeds:agg-test-a');
    await invalidateCache('feeds:agg-test-b');
    await invalidateCache('feeds:agg-test-disabled');
    mockedFetchFeed.mockReset();
  });

  it('fans out across every enabled source, merging their articles and marking each ok', async () => {
    mockedFetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === mockFeedSources[0].feedUrl) {
        return feedOutput([{ title: 'A1', link: 'https://source-a.test/1', pubDate: 'Mon, 01 Jan 2026 00:00:00 GMT' }]);
      }
      if (feedUrl === mockFeedSources[1].feedUrl) {
        return feedOutput([{ title: 'B1', link: 'https://source-b.test/1', pubDate: 'Tue, 02 Jan 2026 00:00:00 GMT' }]);
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getDashboard();

    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'agg-test-a', sourceName: 'Source A', status: 'ok' },
        { sourceId: 'agg-test-b', sourceName: 'Source B', status: 'ok' },
      ]),
    );
    // The disabled source is never fetched and never appears in the response.
    expect(result.sourceStatuses.find((s) => s.sourceId === 'agg-test-disabled')).toBeUndefined();
    expect(mockedFetchFeed).toHaveBeenCalledTimes(2);

    const newsCategory = result.categories.find((c) => c.category === 'News');
    expect(newsCategory?.articles.map((a) => a.title).sort()).toEqual(['A1', 'B1']);
  });

  it("isolates one failing source into sourceStatuses without discarding the healthy source's articles", async () => {
    mockedFetchFeed.mockImplementation(async (feedUrl: string) => {
      if (feedUrl === mockFeedSources[0].feedUrl) {
        return feedOutput([{ title: 'Healthy Article', link: 'https://source-a.test/2' }]);
      }
      if (feedUrl === mockFeedSources[1].feedUrl) {
        throw new Error('simulated Cloudflare 403 challenge');
      }
      throw new Error(`unexpected feed url ${feedUrl}`);
    });

    const result = await getDashboard();

    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([
        { sourceId: 'agg-test-a', sourceName: 'Source A', status: 'ok' },
        { sourceId: 'agg-test-b', sourceName: 'Source B', status: 'unavailable' },
      ]),
    );

    const newsCategory = result.categories.find((c) => c.category === 'News');
    expect(newsCategory?.articles).toHaveLength(1);
    expect(newsCategory?.articles[0].title).toBe('Healthy Article');
  });

  describe('category grouping, sorting, and cap (spec FR-012, US2)', () => {
    it('sorts each category by most-recent first and caps it to the top 5 articles', async () => {
      const sevenItems: RawItem[] = Array.from({ length: 7 }).map((_, index) => ({
        title: `Article ${index}`,
        link: `https://source-a.test/${index}`,
        // index 0 is oldest, index 6 is newest
        pubDate: new Date(Date.UTC(2026, 0, index + 1)).toUTCString(),
      }));

      mockedFetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === mockFeedSources[0].feedUrl) {
          return feedOutput(sevenItems);
        }
        if (feedUrl === mockFeedSources[1].feedUrl) {
          return feedOutput([]);
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      const newsCategory = result.categories.find((c) => c.category === 'News');
      expect(newsCategory?.articles).toHaveLength(5);
      expect(newsCategory?.articles.map((a) => a.title)).toEqual([
        'Article 6',
        'Article 5',
        'Article 4',
        'Article 3',
        'Article 2',
      ]);
    });

    it('omits a category from the response when it ends up with zero articles', async () => {
      mockedFetchFeed.mockImplementation(async (feedUrl: string) => {
        if (feedUrl === mockFeedSources[0].feedUrl) {
          return feedOutput([{ title: 'Only Article', link: 'https://source-a.test/only' }]);
        }
        if (feedUrl === mockFeedSources[1].feedUrl) {
          return feedOutput([]);
        }
        throw new Error(`unexpected feed url ${feedUrl}`);
      });

      const result = await getDashboard();

      expect(result.categories.every((c) => c.articles.length > 0)).toBe(true);
    });
  });
});
