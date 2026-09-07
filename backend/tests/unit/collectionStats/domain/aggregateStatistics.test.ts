import { aggregateStatistics } from '../../../../src/domain/collectionStats/aggregateStatistics';
import type { LibraryEntry } from '../../../../src/domain/library/types';

/**
 * Feature 061, T022 (US1) — pure `aggregateStatistics(entries)` rules
 * (data-model §3). Table-driven; the module under test does not exist yet, so
 * this file MUST fail on first run (Constitution Principle I).
 */

let seq = 0;
function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    discogsReleaseId: seq,
    addedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregateStatistics (feature 061, data-model §3)', () => {
  describe('totalRecords', () => {
    it('counts every entry, including facet-less ones', () => {
      const stats = aggregateStatistics([entry(), entry(), entry({ year: undefined })]);
      expect(stats.totalRecords).toBe(3);
    });

    it('empty input → zeros + null artist + empty growth', () => {
      const stats = aggregateStatistics([]);
      expect(stats).toEqual({
        totalRecords: 0,
        byDecade: { buckets: [], others: null },
        byGenre: { buckets: [], others: null },
        byStyle: { buckets: [], others: null },
        byLabel: { buckets: [], others: null },
        topArtists: [],
        mostPresentArtist: null,
        growth: { granularity: 'month', points: [] },
      });
    });
  });

  describe('byDecade', () => {
    it('buckets by Math.floor(year/10)*10 with an "1970s"-style label', () => {
      const stats = aggregateStatistics([
        entry({ year: 1971 }),
        entry({ year: 1979 }),
        entry({ year: 1983 }),
      ]);
      expect(stats.byDecade.buckets).toEqual([
        { label: '1970s', count: 2 },
        { label: '1980s', count: 1 },
      ]);
    });

    it('year: undefined → "Año desconocido" bucket, still counted in the total', () => {
      const stats = aggregateStatistics([
        entry({ year: 1990 }),
        entry({ year: undefined }),
        entry({ year: undefined }),
      ]);
      expect(stats.totalRecords).toBe(3);
      expect(stats.byDecade.buckets).toContainEqual({
        label: 'Año desconocido',
        count: 2,
      });
      expect(stats.byDecade.buckets).toContainEqual({ label: '1990s', count: 1 });
    });

    it('is never truncated — others stays null even past TOP_N distinct decades', () => {
      const entries: LibraryEntry[] = [];
      for (let decade = 1900; decade <= 2030; decade += 10) {
        entries.push(entry({ year: decade + 1 }));
      }
      const stats = aggregateStatistics(entries);
      expect(stats.byDecade.buckets.length).toBe(14);
      expect(stats.byDecade.others).toBeNull();
    });

    it('sorts descending by count', () => {
      const stats = aggregateStatistics([
        entry({ year: 1985 }),
        entry({ year: 1986 }),
        entry({ year: 1987 }),
        entry({ year: 1995 }),
        entry({ year: 2001 }),
        entry({ year: 2002 }),
      ]);
      expect(stats.byDecade.buckets.map((b) => b.count)).toEqual([3, 2, 1]);
      expect(stats.byDecade.buckets[0].label).toBe('1980s');
    });
  });

  describe('byGenre / byStyle / byLabel (multi-valued)', () => {
    it('adds one count per distinct value on the entry; a bucket sum may exceed totalRecords', () => {
      const stats = aggregateStatistics([
        entry({ genre: ['Rock', 'Electronic'] }),
        entry({ genre: ['Rock'] }),
      ]);
      expect(stats.totalRecords).toBe(2);
      expect(stats.byGenre.buckets).toEqual([
        { label: 'Rock', count: 2 },
        { label: 'Electronic', count: 1 },
      ]);
    });

    it('de-duplicates repeated values within a single entry', () => {
      const stats = aggregateStatistics([
        entry({ style: ['Techno', 'Techno', 'House'] }),
      ]);
      expect(stats.byStyle.buckets).toEqual([
        { label: 'House', count: 1 },
        { label: 'Techno', count: 1 },
      ]);
    });

    it('counts labels the same way', () => {
      const stats = aggregateStatistics([
        entry({ label: ['Sub Pop'] }),
        entry({ label: ['Sub Pop', 'Warner'] }),
      ]);
      expect(stats.byLabel.buckets).toEqual([
        { label: 'Sub Pop', count: 2 },
        { label: 'Warner', count: 1 },
      ]);
    });

    it('keeps the top 12 and collapses the rest into others {count, hiddenBuckets}', () => {
      const entries: LibraryEntry[] = [];
      // 15 distinct genres, each appearing (20 - index) times so the order is deterministic.
      for (let i = 0; i < 15; i += 1) {
        for (let n = 0; n < 20 - i; n += 1) {
          entries.push(entry({ genre: [`G${String(i).padStart(2, '0')}`] }));
        }
      }
      const stats = aggregateStatistics(entries);
      expect(stats.byGenre.buckets).toHaveLength(12);
      // collapsed: G12 (8) + G13 (7) + G14 (6) = 21 across 3 hidden buckets
      expect(stats.byGenre.others).toEqual({ count: 21, hiddenBuckets: 3 });
    });

    it('others is null when nothing was truncated (≤ 12 distinct values)', () => {
      const entries: LibraryEntry[] = [];
      for (let i = 0; i < 12; i += 1) {
        entries.push(entry({ genre: [`G${i}`] }));
      }
      const stats = aggregateStatistics(entries);
      expect(stats.byGenre.buckets).toHaveLength(12);
      expect(stats.byGenre.others).toBeNull();
    });
  });

  describe('artists', () => {
    it('counts primaryArtist only — one per entry — desc, and sets mostPresentArtist', () => {
      const stats = aggregateStatistics([
        entry({ primaryArtist: 'Iron Maiden' }),
        entry({ primaryArtist: 'Iron Maiden' }),
        entry({ primaryArtist: 'Metallica' }),
      ]);
      expect(stats.topArtists).toEqual([
        { name: 'Iron Maiden', count: 2 },
        { name: 'Metallica', count: 1 },
      ]);
      expect(stats.mostPresentArtist).toEqual({ name: 'Iron Maiden', count: 2 });
    });

    it('skips undefined primaryArtist and the various-artists sentinel', () => {
      const stats = aggregateStatistics([
        entry({ primaryArtist: undefined }),
        entry({ primaryArtist: 'Various' }),
        entry({ primaryArtist: 'Various Artists' }),
        entry({ primaryArtist: 'VARIOUS  ARTISTS' }),
        entry({ primaryArtist: 'The Analog Kid' }),
      ]);
      expect(stats.topArtists).toEqual([{ name: 'The Analog Kid', count: 1 }]);
    });

    it('caps topArtists at 10', () => {
      const entries: LibraryEntry[] = [];
      for (let i = 0; i < 15; i += 1) {
        entries.push(entry({ primaryArtist: `Artist ${i}` }));
      }
      const stats = aggregateStatistics(entries);
      expect(stats.topArtists).toHaveLength(10);
    });

    it('mostPresentArtist is null when no entry carries a usable artist', () => {
      const stats = aggregateStatistics([entry({ primaryArtist: 'Various' }), entry()]);
      expect(stats.mostPresentArtist).toBeNull();
      expect(stats.topArtists).toEqual([]);
    });
  });

  describe('growth', () => {
    it('groups added per YYYY-MM and keeps a continuous zero-filled cumulative line', () => {
      const stats = aggregateStatistics([
        entry({ addedAt: '2023-01-10T00:00:00.000Z' }),
        entry({ addedAt: '2023-01-20T00:00:00.000Z' }),
        entry({ addedAt: '2023-03-05T00:00:00.000Z' }),
      ]);
      expect(stats.growth).toEqual({
        granularity: 'month',
        points: [
          { period: '2023-01', added: 2, cumulative: 2 },
          { period: '2023-02', added: 0, cumulative: 2 },
          { period: '2023-03', added: 1, cumulative: 3 },
        ],
      });
    });

    it('zero-fills across a year boundary', () => {
      const stats = aggregateStatistics([
        entry({ addedAt: '2022-11-01T00:00:00.000Z' }),
        entry({ addedAt: '2023-02-01T00:00:00.000Z' }),
      ]);
      expect(stats.growth.points.map((p) => p.period)).toEqual([
        '2022-11',
        '2022-12',
        '2023-01',
        '2023-02',
      ]);
      expect(stats.growth.points.map((p) => p.cumulative)).toEqual([1, 1, 1, 2]);
    });

    it('a single month produces a single point', () => {
      const stats = aggregateStatistics([entry({ addedAt: '2024-06-15T00:00:00.000Z' })]);
      expect(stats.growth.points).toEqual([
        { period: '2024-06', added: 1, cumulative: 1 },
      ]);
    });
  });
});
