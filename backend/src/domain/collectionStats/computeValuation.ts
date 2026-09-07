import type { MediaCondition } from '../discogsOauth/conditionGrading';
import type { CollectionValuation, PerDiscValue, ValuationStatus } from './types';

/**
 * Pure Block 2 valuation for "Mi colección en cifras" (feature 061,
 * data-model §4). Folds a set of already-fetched price suggestions into a
 * running `CollectionValuation` with zero Discogs knowledge — no SDK, no
 * HTTP, no cache (Constitution Principle VIII). Every rule here is pinned by
 * `tests/unit/collectionStats/domain/computeValuation.test.ts`.
 *
 * The application use case (`getCollectionValuation`) walks the collection in
 * cursor-bounded chunks, prices each release once (served from the shared
 * 7-day cache when warm), and re-folds this function over **every** suggestion
 * gathered so far — so each chunk response carries the whole running total.
 */

/** The per-disc facts this aggregator needs — a projection of `CollectionInstance`. */
export interface ValuationInstanceInput {
  releaseId: number;
  instanceId: number;
  title: string;
  artist: string;
  /** `null` when the user never graded their copy (→ `no_condition`). */
  mediaCondition: MediaCondition | null;
}

/**
 * One release's price suggestions, per grade, in the user's seller currency —
 * structurally identical to the marketplace port's `PriceSuggestions`. `null`
 * when Discogs has no market data for the release.
 */
export type ReleaseSuggestions =
  | Partial<Record<MediaCondition, { currency: string; value: number }>>
  | null;

/** Round to 2 decimal places (currency), avoiding binary-float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function priceInstance(
  instance: ValuationInstanceInput,
  suggestions: ReleaseSuggestions,
): PerDiscValue {
  const base = {
    releaseId: instance.releaseId,
    instanceId: instance.instanceId,
    title: instance.title,
    artist: instance.artist,
    mediaCondition: instance.mediaCondition,
  };

  if (instance.mediaCondition === null) {
    return { ...base, value: null, reason: 'no_condition' };
  }

  const priced = suggestions?.[instance.mediaCondition];
  if (!priced || typeof priced.value !== 'number' || !Number.isFinite(priced.value)) {
    return { ...base, value: null, reason: 'no_market_data' };
  }

  return { ...base, value: round2(priced.value), reason: 'ok' };
}

/**
 * The full per-disc list for every instance already attempted (data-model §5).
 * Instances whose release is not yet in `attemptedReleaseIds` are omitted —
 * they only ever contribute to `totalCount`.
 */
export function computePerDisc(
  instances: ValuationInstanceInput[],
  suggestionsByRelease: Map<number, ReleaseSuggestions>,
  attemptedReleaseIds: Set<number>,
): PerDiscValue[] {
  return instances
    .filter((instance) => attemptedReleaseIds.has(instance.releaseId))
    .map((instance) =>
      priceInstance(instance, suggestionsByRelease.get(instance.releaseId) ?? null),
    );
}

/** The seller currency of the first release that returned any price. */
function firstCurrency(
  instances: ValuationInstanceInput[],
  suggestionsByRelease: Map<number, ReleaseSuggestions>,
  attemptedReleaseIds: Set<number>,
): string | null {
  for (const instance of instances) {
    if (!attemptedReleaseIds.has(instance.releaseId)) {
      continue;
    }
    const suggestions = suggestionsByRelease.get(instance.releaseId);
    if (!suggestions) {
      continue;
    }
    for (const price of Object.values(suggestions)) {
      if (price && typeof price.currency === 'string') {
        return price.currency;
      }
    }
  }
  return null;
}

const MAX_TOP_VALUABLE = 10;

export function computeValuation(
  instances: ValuationInstanceInput[],
  suggestionsByRelease: Map<number, ReleaseSuggestions>,
  attemptedReleaseIds: Set<number>,
  opts: { outage?: boolean } = {},
): CollectionValuation {
  const perDisc = computePerDisc(instances, suggestionsByRelease, attemptedReleaseIds);

  const covered = perDisc.filter((disc) => disc.reason === 'ok');
  const estimatedTotal = round2(
    covered.reduce((sum, disc) => sum + (disc.value ?? 0), 0),
  );

  const uncovered = {
    noMarketData: perDisc.filter((disc) => disc.reason === 'no_market_data').length,
    noCondition: perDisc.filter((disc) => disc.reason === 'no_condition').length,
  };

  const topValuable = [...covered]
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, MAX_TOP_VALUABLE);

  const everyInstanceAttempted = instances.every((instance) =>
    attemptedReleaseIds.has(instance.releaseId),
  );

  let status: ValuationStatus;
  if (opts.outage && covered.length === 0) {
    status = 'unavailable';
  } else {
    status = everyInstanceAttempted ? 'complete' : 'partial';
  }

  return {
    currency: firstCurrency(instances, suggestionsByRelease, attemptedReleaseIds),
    estimatedTotal,
    coveredCount: covered.length,
    totalCount: instances.length,
    uncovered,
    topValuable,
    status,
  };
}
