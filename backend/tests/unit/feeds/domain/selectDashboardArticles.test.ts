import { selectDashboardArticles } from '../../../../src/domain/feeds/selectDashboardArticles';
import type { Article } from '../../../../src/domain/feeds/types';

const NOW = new Date('2026-09-19T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

function article(sourceId: string, n: number, publishedAtMs: number): Article {
  const link = `https://${sourceId}.test/${n}`;
  return {
    id: link,
    title: `${sourceId}-${n}`,
    excerpt: '',
    publishedAt: new Date(publishedAtMs).toISOString(),
    link,
    sourceId,
    sourceName: sourceId,
    category: 'News',
  };
}

/** `count` articles of one source, n = 0 newest, one hour apart, starting `startHoursAgo` before NOW. */
function articles(sourceId: string, count: number, startHoursAgo: number): Article[] {
  return Array.from({ length: count }, (_, n) =>
    article(sourceId, n, NOW.getTime() - (startHoursAgo + n) * HOUR_MS),
  );
}

const titles = (list: Article[]) => list.map((a) => a.title);

describe('selectDashboardArticles (spec 067 D7, FR-010, FR-014)', () => {
  it('includes an article published exactly 7 days before now and excludes one 1 ms older', () => {
    const edge = article('a', 0, NOW.getTime() - WEEK_MS);
    const tooOld = article('a', 1, NOW.getTime() - WEEK_MS - 1);

    expect(titles(selectDashboardArticles([tooOld, edge], NOW))).toEqual(['a-0']);
  });

  it("keeps another source's 3 newest in-window articles when a 100-item source is newer", () => {
    const prolific = articles('heavy', 100, 1); // hours 1..100 ago, all newer than quiet
    const quiet = articles('quiet', 5, 120);

    const result = selectDashboardArticles([...prolific, ...quiet], NOW);

    expect(result).toHaveLength(60);
    expect(titles(result)).toEqual(
      expect.arrayContaining(['quiet-0', 'quiet-1', 'quiet-2']),
    );
    expect(titles(result)).not.toContain('quiet-3');
    expect(titles(result)).not.toContain('quiet-4');
    expect(result.filter((a) => a.sourceId === 'heavy')).toHaveLength(57);
  });

  it('includes every in-window article of a source that has fewer than 3', () => {
    const result = selectDashboardArticles(
      [...articles('heavy', 100, 1), ...articles('quiet', 2, 150)],
      NOW,
    );

    expect(titles(result)).toEqual(expect.arrayContaining(['quiet-0', 'quiet-1']));
  });

  it('does not guarantee a source any article older than 7 days', () => {
    const stale = articles('stale', 3, 7 * 24 + 1);

    const result = selectDashboardArticles([...articles('heavy', 100, 1), ...stale], NOW);

    expect(result.some((a) => a.sourceId === 'stale')).toBe(false);
  });

  it('returns at most 60 articles, newest first', () => {
    const input = [
      ...articles('a', 40, 2),
      ...articles('b', 40, 1),
      ...articles('c', 40, 3),
    ].reverse();

    const result = selectDashboardArticles(input, NOW);
    const times = result.map((a) => new Date(a.publishedAt).getTime());

    expect(result).toHaveLength(60);
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it('returns every in-window article, newest first, when there are fewer than 60', () => {
    const result = selectDashboardArticles(
      [...articles('a', 2, 5), ...articles('b', 2, 1)],
      NOW,
    );

    expect(titles(result)).toEqual(['b-0', 'b-1', 'a-0', 'a-1']);
  });

  it('returns an empty list when nothing is in the window', () => {
    expect(selectDashboardArticles(articles('a', 3, 8 * 24), NOW)).toEqual([]);
    expect(selectDashboardArticles([], NOW)).toEqual([]);
  });

  it('removes duplicates by link and by id, keeping the first occurrence', () => {
    const first = article('a', 0, NOW.getTime() - HOUR_MS);
    const sameLink = {
      ...article('b', 1, NOW.getTime() - 2 * HOUR_MS),
      link: first.link,
    };
    const sameId = { ...article('c', 2, NOW.getTime() - 3 * HOUR_MS), id: first.id };
    const other = article('d', 3, NOW.getTime() - 4 * HOUR_MS);

    const result = selectDashboardArticles([first, sameLink, sameId, other], NOW);

    expect(titles(result)).toEqual(['a-0', 'd-3']);
  });
});
