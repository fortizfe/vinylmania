import { mapFeedItem } from '../../domain/feeds/feedMapper';
import { FEED_SOURCES } from '../../domain/feeds/feedSources';
import type {
  Article,
  CategoryGroup,
  DashboardResponse,
  FeedSourceConfig,
  SourceFeedResponse,
  SourceStatus,
} from '../../domain/feeds/types';
import { logger } from '../../config/logger';
import type { CachePort } from '../../ports/cache/cachePort';
import type { FeedSourcePort } from '../../ports/feeds/feedSourcePort';

const CACHE_TTL_SECONDS = 20 * 60;
const ARTICLES_PER_CATEGORY = 10;

export interface FeedsAggregationUseCase {
  getDashboard(): Promise<DashboardResponse>;
  getSourceArticles(sourceId: string): Promise<SourceFeedResponse | null>;
}

export function createFeedsAggregationUseCase(deps: {
  feedSource: FeedSourcePort;
  cache: CachePort;
  /** Overridable for tests; defaults to the real static catalog. */
  feedSources?: FeedSourceConfig[];
}): FeedsAggregationUseCase {
  const { feedSource, cache } = deps;
  const sources = deps.feedSources ?? FEED_SOURCES;

  async function fetchSourceArticles(source: FeedSourceConfig): Promise<Article[]> {
    return cache.withCache(`feeds:${source.id}`, CACHE_TTL_SECONDS, async () => {
      const items = await feedSource.fetchFeed(source.feedUrl);
      const articles: Article[] = [];
      for (const item of items) {
        const mapped = mapFeedItem(item, source);
        if (mapped) {
          articles.push(mapped);
        }
      }
      return articles;
    });
  }

  // Grouping by category falls out of each source's static category assignment,
  // so a category with zero articles is never produced in the first place —
  // there is no pre-declared category list to iterate that could leave gaps.
  function groupByCategory(articles: Article[]): CategoryGroup[] {
    const byCategory = new Map<string, Article[]>();

    for (const article of articles) {
      const existing = byCategory.get(article.category);
      if (existing) {
        existing.push(article);
      } else {
        byCategory.set(article.category, [article]);
      }
    }

    return Array.from(byCategory.entries()).map(([category, categoryArticles]) => ({
      category,
      articles: [...categoryArticles]
        .sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        )
        .slice(0, ARTICLES_PER_CATEGORY),
    }));
  }

  async function getDashboard(): Promise<DashboardResponse> {
    const enabledSources = sources.filter((source) => source.enabled);

    const settled = await Promise.allSettled(
      enabledSources.map((source) => fetchSourceArticles(source)),
    );

    const sourceStatuses: SourceStatus[] = [];
    const allArticles: Article[] = [];

    settled.forEach((result, index) => {
      const source = enabledSources[index];
      if (result.status === 'fulfilled') {
        sourceStatuses.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'ok',
          priority: source.priority,
        });
        allArticles.push(...result.value);
      } else {
        sourceStatuses.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'unavailable',
          priority: source.priority,
        });
        logger.warn({
          route: 'feeds:aggregator',
          outcome: 'feed_unavailable',
          meta: { sourceId: source.id },
          message: result.reason instanceof Error ? result.reason.message : 'unknown error',
        });
      }
    });

    return {
      categories: groupByCategory(allArticles),
      sourceStatuses,
      generatedAt: new Date().toISOString(),
    };
  }

  async function getSourceArticles(sourceId: string): Promise<SourceFeedResponse | null> {
    const source = sources.find((s) => s.id === sourceId && s.enabled);
    if (!source) {
      return null;
    }

    try {
      const articles = await fetchSourceArticles(source);
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'ok',
        articles: [...articles].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        ),
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn({
        route: 'feeds:aggregator',
        outcome: 'feed_unavailable',
        meta: { sourceId: source.id },
        message: err instanceof Error ? err.message : 'unknown error',
      });
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'unavailable',
        articles: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  return { getDashboard, getSourceArticles };
}
