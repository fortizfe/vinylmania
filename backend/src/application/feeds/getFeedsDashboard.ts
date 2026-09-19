import {
  dropSharedPreviewImages,
  extractPreviewImage,
  mapFeedItem,
} from '../../domain/feeds/feedMapper';
import { FEED_SOURCES } from '../../domain/feeds/feedSources';
import {
  byNewest,
  dedupe,
  selectDashboardArticles,
} from '../../domain/feeds/selectDashboardArticles';
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
import { mapWithConcurrency } from '../../shared/concurrency';

const CACHE_TTL_SECONDS = 20 * 60;
// spec 067 D4/D5: article-page image lookups.
const IMAGE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_LOOKUPS_PER_REFRESH = 8;
const LOOKUP_TIMEOUT_MS = 1000;

interface FeedsAggregationUseCase {
  getDashboard(): Promise<DashboardResponse>;
  getSourceArticles(sourceId: string): Promise<SourceFeedResponse | null>;
}

export function createFeedsAggregationUseCase(deps: {
  feedSource: FeedSourcePort;
  cache: CachePort;
  /** Overridable for tests; defaults to the real static catalog. */
  feedSources?: FeedSourceConfig[];
  /** Overridable for tests; the dashboard's 7-day window is relative to it. */
  now?: () => Date;
}): FeedsAggregationUseCase {
  const { feedSource, cache } = deps;
  const now = deps.now ?? (() => new Date());
  const sources = deps.feedSources ?? FEED_SOURCES;

  /**
   * Fills `imageUrl` of feed-image-less articles from their page's og:image
   * (spec 067 D4–D6, D13). Mutates `articles`, which the caller just built.
   */
  async function resolvePageImages(source: FeedSourceConfig, articles: Article[]) {
    const pending = articles.filter((article) => !article.imageUrl).sort(byNewest);
    let lookups = 0;
    let lookupTimeouts = 0;

    const lookup = async (link: string): Promise<string | null> => {
      if (lookups >= MAX_LOOKUPS_PER_REFRESH) {
        throw new Error('page lookup budget spent'); // not cached: retried next refresh
      }
      lookups += 1;
      let html: string | null;
      try {
        html = await feedSource.fetchArticleHead(link, LOOKUP_TIMEOUT_MS);
      } catch (err) {
        lookupTimeouts += 1;
        throw err;
      }
      return (html && extractPreviewImage(html, link)) || null;
    };

    const found = await mapWithConcurrency(pending, MAX_LOOKUPS_PER_REFRESH, (article) =>
      cache
        .withCache(`feeds:img:${article.link}`, IMAGE_CACHE_TTL_SECONDS, () =>
          lookup(article.link),
        )
        .catch(() => undefined),
    );

    const results = new Map<string, string | null>();
    pending.forEach((article, index) => {
      const url = found[index];
      if (url !== undefined) {
        results.set(article.link, url);
      }
    });
    const kept = dropSharedPreviewImages(results);

    let fromPage = 0;
    let logoDiscarded = 0;
    for (const article of pending) {
      const url = kept.get(article.link);
      if (url) {
        article.imageUrl = url;
        fromPage += 1;
      } else if (results.get(article.link)) {
        logoDiscarded += 1;
      }
    }

    const fromFeed = articles.length - pending.length;
    logger.info({
      route: 'feeds:images',
      outcome: 'feed_images_resolved',
      meta: {
        sourceId: source.id,
        articles: articles.length,
        fromFeed,
        fromPage,
        placeholders: pending.length - fromPage,
        lookups,
        lookupTimeouts,
        logoDiscarded,
      },
    });
  }

  async function fetchSourceArticles(source: FeedSourceConfig): Promise<Article[]> {
    return cache.withCache(`feeds:${source.id}`, CACHE_TTL_SECONDS, async () => {
      const items = await feedSource.fetchFeed(source.feedUrl);
      const articles = dedupe(
        items
          .map((item) => mapFeedItem(item, source))
          .filter((article) => article !== undefined),
      );
      await resolvePageImages(source, articles);
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
      articles: categoryArticles,
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
          message:
            result.reason instanceof Error ? result.reason.message : 'unknown error',
        });
      }
    });

    return {
      categories: groupByCategory(selectDashboardArticles(allArticles, now())),
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
        articles: [...articles].sort(byNewest),
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
