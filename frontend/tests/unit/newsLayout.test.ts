import { describe, expect, it } from 'vitest';

import {
  assignPortadaSlots,
  formatArticleAge,
  sourceMonogram,
} from '../../src/lib/newsLayout';
import type { Article } from '../../src/services/feedsApi';

describe('sourceMonogram (feature 067, D9)', () => {
  it.each([
    ['Metal Underground', 'MU'],
    ['MetalSucks', 'M'],
    ['Heavy Metal Overload', 'HM'],
    ['  Metal Underground  ', 'MU'],
    ['', '?'],
  ])('%j → %j', (name, expected) => {
    expect(sourceMonogram(name)).toBe(expected);
  });
});

const NOW = new Date('2026-09-19T12:00:00.000Z');
const HOUR = 3_600_000;

function article(
  id: string,
  sourceId: string,
  hoursAgo: number,
  withImage: boolean,
): Article {
  return {
    id,
    title: `Title ${id}`,
    excerpt: 'x',
    imageUrl: withImage ? `https://cdn.example.com/${id}.jpg` : undefined,
    publishedAt: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(),
    link: `https://example.com/${id}`,
    sourceId,
    sourceName: sourceId,
    category: 'News',
  };
}

const ids = (articles: Article[]) => articles.map((a) => a.id);

describe('assignPortadaSlots (feature 067, US2, D8, FR-009)', () => {
  it('puts the newest article that has an image in the lead slot', () => {
    const { lead } = assignPortadaSlots([
      article('old-img', 'a', 5, true),
      article('newest-no-img', 'b', 1, false),
      article('new-img', 'c', 2, true),
    ]);

    expect(lead?.id).toBe('new-img');
  });

  it('fills up to 4 secondaries with at most one per source while other sources have candidates', () => {
    const { lead, secondary, latest } = assignPortadaSlots([
      article('a1', 'a', 1, true),
      article('a2', 'a', 2, true),
      article('b1', 'b', 3, true),
      article('b2', 'b', 4, true),
      article('c1', 'c', 5, true),
      article('d1', 'd', 6, true),
      article('e1', 'e', 7, true),
      article('f1', 'f', 8, true),
    ]);

    expect(lead?.id).toBe('a1');
    expect(secondary).toHaveLength(4);
    expect(new Set(secondary.map((a) => a.sourceId)).size).toBe(4);
    expect(ids(secondary)).not.toContain('b2');
    expect(ids(latest)).toContain('b2');
  });

  it('relaxes the one-per-source rule when a single source is all there is', () => {
    const articles = [1, 2, 3, 4, 5, 6].map((h) => article(`s${h}`, 'solo', h, true));

    const { lead, secondary, latest } = assignPortadaSlots(articles);

    expect(lead?.id).toBe('s1');
    expect(ids(secondary)).toEqual(['s2', 's3', 's4', 's5']);
    expect(ids(latest)).toEqual(['s6']);
  });

  it('never puts placeholder-only articles in the lead or secondary slots', () => {
    const { lead, secondary, latest } = assignPortadaSlots([
      article('p1', 'a', 1, false),
      article('p2', 'b', 2, false),
      article('img', 'c', 3, true),
    ]);

    expect(lead?.id).toBe('img');
    expect(secondary).toEqual([]);
    expect(ids(latest)).toEqual(['p1', 'p2']);
  });

  it('lists the remaining articles newest first and places every article exactly once', () => {
    const input = [
      article('l3', 'a', 30, false),
      article('lead', 'b', 1, true),
      article('l1', 'c', 10, false),
      article('l2', 'd', 20, false),
    ];

    const { lead, secondary, latest } = assignPortadaSlots(input);

    expect(ids(latest)).toEqual(['l1', 'l2', 'l3']);
    expect(1 + secondary.length + latest.length).toBe(input.length);
    expect(lead?.id).toBe('lead');
  });

  it('returns no lead and empty slots for empty input', () => {
    const { lead, secondary, latest } = assignPortadaSlots([]);

    expect(lead).toBeFalsy();
    expect(secondary).toEqual([]);
    expect(latest).toEqual([]);
  });
});

describe('formatArticleAge (feature 067, US2, D10, FR-011)', () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  const MIN = 60_000;
  const DAY = 24 * HOUR;

  it.each([
    [30_000, 'just now'],
    [59_000, 'just now'],
    [MIN, '1m ago'],
    [59 * MIN, '59m ago'],
    [HOUR, '1h ago'],
    [23 * HOUR, '23h ago'],
    [DAY, '1d ago'],
    [6 * DAY, '6d ago'],
    [7 * DAY, 'Sep 12'],
    [40 * DAY, 'Aug 10'],
  ])('%i ms ago → %j', (ms, expected) => {
    expect(formatArticleAge(ago(ms), NOW)).toBe(expected);
  });
});
