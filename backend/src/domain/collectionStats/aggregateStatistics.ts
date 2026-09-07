import type { LibraryEntry } from '../library/types';
import type {
  ArtistCount,
  CollectionStatistics,
  GrowthPoint,
  StatBreakdown,
  StatBucket,
} from './types';

/**
 * Pure Block 1 aggregator for "Mi colección en cifras" (feature 061,
 * data-model §3). Folds the persisted `LibraryEntry` mirror into a
 * `CollectionStatistics` with zero Discogs knowledge — no SDK, no HTTP, no
 * persistence (Constitution Principle VIII). Every rule here is pinned by
 * `tests/unit/collectionStats/domain/aggregateStatistics.test.ts`.
 */

/** How many buckets a truncatable breakdown keeps before collapsing the tail. */
export const TOP_N = 12;

const UNKNOWN_DECADE_LABEL = 'Año desconocido';
const MAX_TOP_ARTISTS = 10;
const VARIOUS_ARTISTS = /^various(\s+artists)?$/i;

/** `1971` → `"1970s"`. */
function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/** Descending by count, then label ascending so ties are deterministic. */
function sortedBuckets(counts: Map<string, number>): StatBucket[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Keeps the first `TOP_N` buckets; folds the rest into `others`. */
function truncate(buckets: StatBucket[]): StatBreakdown {
  if (buckets.length <= TOP_N) {
    return { buckets, others: null };
  }
  const kept = buckets.slice(0, TOP_N);
  const hidden = buckets.slice(TOP_N);
  return {
    buckets: kept,
    others: {
      count: hidden.reduce((sum, bucket) => sum + bucket.count, 0),
      hiddenBuckets: hidden.length,
    },
  };
}

function tally(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** Adds one count per distinct value on the entry (data-model §3). */
function tallyMultiValued(
  counts: Map<string, number>,
  values: string[] | undefined,
): void {
  if (!values) {
    return;
  }
  for (const value of new Set(values)) {
    tally(counts, value);
  }
}

function monthOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 7); // YYYY-MM
}

/** Every `YYYY-MM` from `start` to `end` inclusive, so the growth line is continuous. */
function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function buildGrowth(entries: LibraryEntry[]): GrowthPoint[] {
  if (entries.length === 0) {
    return [];
  }
  const addedByMonth = new Map<string, number>();
  for (const entry of entries) {
    tally(addedByMonth, monthOf(entry.addedAt));
  }
  const populated = [...addedByMonth.keys()].sort();
  const timeline = monthsBetween(populated[0], populated[populated.length - 1]);

  let cumulative = 0;
  return timeline.map((period) => {
    const added = addedByMonth.get(period) ?? 0;
    cumulative += added;
    return { period, added, cumulative };
  });
}

export function aggregateStatistics(entries: LibraryEntry[]): CollectionStatistics {
  const decade = new Map<string, number>();
  const genre = new Map<string, number>();
  const style = new Map<string, number>();
  const label = new Map<string, number>();
  const artist = new Map<string, number>();

  for (const entry of entries) {
    tally(
      decade,
      typeof entry.year === 'number' ? decadeLabel(entry.year) : UNKNOWN_DECADE_LABEL,
    );
    tallyMultiValued(genre, entry.genre);
    tallyMultiValued(style, entry.style);
    tallyMultiValued(label, entry.label);

    if (entry.primaryArtist && !VARIOUS_ARTISTS.test(entry.primaryArtist)) {
      tally(artist, entry.primaryArtist);
    }
  }

  const topArtists: ArtistCount[] = sortedBuckets(artist)
    .slice(0, MAX_TOP_ARTISTS)
    .map(({ label: name, count }) => ({ name, count }));

  return {
    totalRecords: entries.length,
    byDecade: { buckets: sortedBuckets(decade), others: null },
    byGenre: truncate(sortedBuckets(genre)),
    byStyle: truncate(sortedBuckets(style)),
    byLabel: truncate(sortedBuckets(label)),
    topArtists,
    mostPresentArtist: topArtists[0] ?? null,
    growth: { granularity: 'month', points: buildGrowth(entries) },
  };
}
