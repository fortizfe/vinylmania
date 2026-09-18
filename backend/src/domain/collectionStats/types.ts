import type { MediaCondition } from '../discogsOauth/conditionGrading';

/**
 * Domain types for "Mi colección en cifras" (feature 061). Pure data shapes —
 * no SDK, no HTTP, no persistence knowledge (Constitution Principle VIII).
 *
 * Block 1 (statistics) types: `CollectionStatistics` and its parts, produced
 * by the pure `aggregateStatistics(entries)` from persisted `LibraryEntry`
 * rows — zero new Discogs requests (data-model §3).
 *
 * Block 2 (valuation) types: `CollectionValuation` and its parts, produced by
 * the pure `computeValuation(...)` folded over cached price suggestions
 * (data-model §4).
 */

// --- Block 1: statistics -------------------------------------------------------

export interface StatBucket {
  label: string;
  count: number;
}

export interface StatBreakdown {
  /** Descending by count. */
  buckets: StatBucket[];
  /**
   * The tail collapsed after keeping the first `TOP_N` buckets. `null` when
   * nothing was truncated. `hiddenBuckets` is how many distinct values were
   * folded into `count`.
   */
  others: { count: number; hiddenBuckets: number } | null;
}

export interface ArtistCount {
  name: string;
  count: number;
}

export interface GrowthPoint {
  /** `YYYY-MM`. */
  period: string;
  added: number;
  cumulative: number;
}

interface GrowthSeries {
  granularity: 'month';
  /** Ascending by period; zero-fill months present so the line is continuous. */
  points: GrowthPoint[];
}

export interface CollectionStatistics {
  totalRecords: number;
  byDecade: StatBreakdown;
  byGenre: StatBreakdown;
  byStyle: StatBreakdown;
  byLabel: StatBreakdown;
  /** Descending by count, length ≤ 10; excludes "Various Artists". */
  topArtists: ArtistCount[];
  mostPresentArtist: ArtistCount | null;
  growth: GrowthSeries;
}

// --- Block 2: valuation ------------------------------------------------------

export type ValuationStatus = 'partial' | 'complete' | 'unavailable';

type PerDiscValueReason = 'ok' | 'no_market_data' | 'no_condition';

export interface PerDiscValue {
  releaseId: number;
  instanceId: number;
  title: string;
  artist: string;
  mediaCondition: MediaCondition | null;
  /** `null` when the disc is not covered. */
  value: number | null;
  reason: PerDiscValueReason;
}

export interface CollectionValuation {
  /** e.g. `'EUR'`; `null` until the first priced disc. */
  currency: string | null;
  /** Sum of covered per-disc values, 2-dp. */
  estimatedTotal: number;
  coveredCount: number;
  /** Instances in the collection (denominator of "X de Y"). */
  totalCount: number;
  uncovered: { noMarketData: number; noCondition: number };
  /** Descending by value, length ≤ 10. */
  topValuable: PerDiscValue[];
  status: ValuationStatus;
}
