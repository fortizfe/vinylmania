import type { Article } from './types';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PER_SOURCE_GUARANTEE = 3;
const MAX_ARTICLES = 60;

const time = (article: Article) => new Date(article.publishedAt).getTime();

export function byNewest(a: Article, b: Article): number {
  return time(b) - time(a);
}

/** Keeps the first article per `link`, then per `id` (spec 067 FR-014). */
export function dedupe(articles: Article[]): Article[] {
  const seenLinks = new Set<string>();
  const seenIds = new Set<string>();
  return articles.filter((article) => {
    if (seenLinks.has(article.link) || seenIds.has(article.id)) {
      return false;
    }
    seenLinks.add(article.link);
    seenIds.add(article.id);
    return true;
  });
}

/**
 * Dashboard selection (spec 067 D7, FR-010): articles of the last 7 days,
 * each source's 3 newest guaranteed, filled by recency up to 60, newest first.
 */
export function selectDashboardArticles(articles: Article[], now: Date): Article[] {
  const windowStart = now.getTime() - WINDOW_MS;
  const recent = dedupe(articles)
    .filter((article) => time(article) >= windowStart)
    .sort(byNewest);

  const perSource = new Map<string, number>();
  const guaranteed = new Set<Article>();
  for (const article of recent) {
    const count = perSource.get(article.sourceId) ?? 0;
    if (count < PER_SOURCE_GUARANTEE) {
      guaranteed.add(article);
      perSource.set(article.sourceId, count + 1);
    }
  }

  let room = MAX_ARTICLES - guaranteed.size;
  return recent.filter((article) => guaranteed.has(article) || room-- > 0);
}
