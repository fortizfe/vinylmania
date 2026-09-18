import { authorizedFetch } from './apiClient';

/**
 * DTOs for `/api/collection-stats/*`. These mirror the backend payloads
 * (`specs/061-collection-stats-valuation/data-model.md` §3–§5, §8 and
 * `contracts/collection-stats-api.md`) — no behaviour, shapes only.
 */

/** One ranked row in a breakdown: a facet value and how many records carry it. */
interface StatBucket {
  label: string;
  count: number;
}

/** A ranked facet breakdown — top buckets plus a collapsed `others` remainder. */
export interface StatBreakdown {
  /** Descending by count. */
  buckets: StatBucket[];
  /** `null` when nothing was truncated; otherwise the collapsed tail. */
  others: { count: number; hiddenBuckets: number } | null;
}

/** One artist and the number of records where they are the primary artist. */
export interface ArtistCount {
  name: string;
  count: number;
}

/** A single period on the growth timeline. */
interface GrowthPoint {
  /** `YYYY-MM`. */
  period: string;
  /** Records added in this period. */
  added: number;
  /** Running total up to and including this period. */
  cumulative: number;
}

/** Collection growth over time — a continuous monthly series. */
export interface GrowthSeries {
  granularity: 'month';
  /** Ascending by period; zero-fill months are included so the line is continuous. */
  points: GrowthPoint[];
}

/** Block 1 payload — `GET /api/collection-stats/statistics`. */
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

/** Why a disc is or is not counted in the estimated value. */
export type PerDiscValueReason = 'ok' | 'no_market_data' | 'no_condition';

/** One instance in the per-disc valuation breakdown. */
export interface PerDiscValue {
  releaseId: number;
  instanceId: number;
  title: string;
  artist: string;
  mediaCondition: string | null;
  /** `null` when the disc is not covered. */
  value: number | null;
  reason: PerDiscValueReason;
}

/** Running valuation totals — one snapshot returned by each chunk. */
export interface CollectionValuation {
  /** e.g. `EUR`; `null` until the first priced disc. */
  currency: string | null;
  estimatedTotal: number;
  coveredCount: number;
  totalCount: number;
  uncovered: { noMarketData: number; noCondition: number };
  /** Descending by value, length ≤ 10. */
  topValuable: PerDiscValue[];
  status: 'partial' | 'complete' | 'unavailable';
}

/** One page of the progressive valuation — `GET /api/collection-stats/valuation`. */
export interface ValuationChunkResponse {
  valuation: CollectionValuation;
  status: 'partial' | 'complete' | 'unavailable';
  /** Present only while `status === 'partial'`. */
  nextCursor?: number;
  pricedThisBatch: number;
  fromCacheThisBatch: number;
  /**
   * Discs whose price lookup failed transiently this run and can be retried
   * without re-pricing the whole collection (US3 / backend T052). Absent or
   * `0` means nothing to retry.
   */
  retryable?: number;
  /** Present only on the final (`status === 'complete'`) page. */
  perDisc?: PerDiscValue[];
}

/**
 * Block 1. `refresh` forces a fresh library sync before aggregating.
 */
export async function getStatistics(refresh = false): Promise<CollectionStatistics> {
  const params = new URLSearchParams();
  if (refresh) {
    params.set('refresh', 'true');
  }
  const query = params.toString();
  const res = await authorizedFetch(
    `/api/collection-stats/statistics${query ? `?${query}` : ''}`,
  );
  return res.json();
}

/**
 * Block 2, one chunk. The caller loops with the returned `nextCursor` until
 * `status !== 'partial'`. `refresh` is honoured on `cursor=0` only.
 *
 * `retry: 'failed'` re-prices only the discs that failed transiently on a
 * previous run (US3 / backend T052) instead of the whole collection.
 * TODO verify param — coordinate the exact query-param name with backend T052.
 */
export async function getValuationChunk(
  cursor = 0,
  refresh = false,
  retry?: 'failed',
): Promise<ValuationChunkResponse> {
  const params = new URLSearchParams({ cursor: String(cursor) });
  if (refresh) {
    params.set('refresh', 'true');
  }
  if (retry) {
    params.set('retry', retry);
  }
  const res = await authorizedFetch(
    `/api/collection-stats/valuation?${params.toString()}`,
  );
  return res.json();
}
