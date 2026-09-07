import { requireConnection } from '../library/syncLibrary';
import {
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import {
  computePerDisc,
  computeValuation,
  type ReleaseSuggestions,
  type ValuationInstanceInput,
} from '../../domain/collectionStats/computeValuation';
import type { CollectionValuation, PerDiscValue } from '../../domain/collectionStats/types';
import { isMediaCondition } from '../../domain/discogsOauth/conditionGrading';
import type { CollectionInstance } from '../../domain/discogsOauth/collectionTypes';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import {
  priceSuggestionsCacheKey,
  type DiscogsMarketplacePort,
} from '../../ports/discogsOauth/discogsMarketplacePort';
import { mapWithConcurrency } from '../../shared/concurrency';

/**
 * Block 2 use case for "Mi colección en cifras" (feature 061, US2,
 * `contracts/collection-stats-api.md`). One stateless chunk of the progressive
 * valuation: price the `[cursor, cursor+BATCH_SIZE)` slice of the caller's
 * collection instances (served from the shared 7-day price cache when warm),
 * then re-fold the pure `computeValuation` over **every** suggestion gathered
 * so far so each response carries the whole running total. The frontend calls
 * this on mount and follows `nextCursor` until `status !== 'partial'`.
 *
 * Depends on `ports/` only (Constitution Principle VIII): the link-gate
 * connection port, the collection walk, the marketplace port, and the cache.
 *
 * Resilience: the marketplace adapter already maps a breaker-open / exhausted
 * upstream to `DiscogsUnavailableError` / `DiscogsRateLimitError`. This use
 * case swallows those into `status: 'unavailable'` (nothing priced yet) or
 * `status: 'partial'` (some discs already priced — the client retries the same
 * cursor after a short backoff), so `GET /valuation` never surfaces a 5xx that
 * would blank the statistics already on screen (data-model §6, FR-025).
 *
 * `fromCacheThisBatch` mechanism: the use case probes `cache.has` on the
 * shared `discogs:pricesuggest:{uid}:{releaseId}` key immediately before each
 * batch price call. A hit means the adapter will serve it from the 7-day
 * cache with no Discogs traffic — so within the cache window
 * `fromCacheThisBatch === pricedThisBatch` (SC-005). Cheap, port-only, and
 * needs no change to the marketplace port signature.
 */

export const BATCH_SIZE = 25;
const PRICE_CONCURRENCY = 4;
const INSTANCES_TTL_SECONDS = 5 * 60;

function instancesCacheKey(uid: string): string {
  return `discogs:statsinstances:${uid}`;
}

export interface ValuationChunkResult {
  valuation: CollectionValuation;
  status: CollectionValuation['status'];
  nextCursor?: number;
  pricedThisBatch: number;
  fromCacheThisBatch: number;
  /** Batch releases whose price call hit a transient upstream failure. Not
   *  serialized to the client — the route folds it into the `valuation_batch`
   *  log only. */
  failedThisBatch: number;
  /**
   * Releases attempted so far whose price call hit a *transient* upstream
   * failure (`DiscogsUnavailableError` / `DiscogsRateLimitError`) and are still
   * uncached — i.e. worth retrying, and explicitly NOT counted as permanent
   * `no_market_data` (US3, FR-023a). The client re-drives these via
   * `?retry=failed` once it has walked the whole collection. `0` on a clean
   * chunk.
   */
  retryable: number;
  perDisc?: PerDiscValue[];
}

function toValuationInput(instance: CollectionInstance): ValuationInstanceInput {
  const mediaCondition =
    instance.mediaCondition && isMediaCondition(instance.mediaCondition)
      ? instance.mediaCondition
      : null;
  return {
    releaseId: instance.releaseId,
    instanceId: instance.instanceId,
    title: instance.title,
    artist: instance.artistNames[0] ?? 'Unknown Artist',
    mediaCondition,
  };
}

function unique(ids: number[]): number[] {
  return [...new Set(ids)];
}

export function createGetCollectionValuationUseCase(deps: {
  discogsCollection: DiscogsCollectionPort;
  discogsMarketplace: DiscogsMarketplacePort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { discogsCollection, discogsMarketplace, discogsConnection, cache } = deps;

  async function getCollectionValuation(
    uid: string,
    options: { cursor?: number; refresh?: boolean; retry?: 'failed' } = {},
  ): Promise<ValuationChunkResult> {
    const connection = await requireConnection(discogsConnection, uid);
    // `retry=failed` is a full sweep over the whole collection that re-prices
    // only the releases still missing from the shared 7-day cache (the ones
    // that transiently failed on the forward pass). It never invalidates the
    // cache, so warm releases cost zero upstream calls (US3, SC-005).
    const fullSweep = options.retry === 'failed';
    const cursor = fullSweep ? 0 : Math.max(0, Math.trunc(options.cursor ?? 0));
    const refresh = !fullSweep && options.refresh === true && cursor === 0;

    if (refresh) {
      await cache.invalidate(instancesCacheKey(uid));
    }

    let instances: CollectionInstance[];
    try {
      instances = await cache.withCache(instancesCacheKey(uid), INSTANCES_TTL_SECONDS, () =>
        discogsCollection.listAllInstances(connection),
      );
    } catch (err) {
      if (err instanceof DiscogsUnavailableError || err instanceof DiscogsRateLimitError) {
        return {
          valuation: computeValuation([], new Map(), new Set(), { outage: true }),
          status: 'unavailable',
          pricedThisBatch: 0,
          fromCacheThisBatch: 0,
          failedThisBatch: 0,
          retryable: 0,
        };
      }
      throw err;
    }

    if (refresh) {
      await mapWithConcurrency(unique(instances.map((i) => i.releaseId)), PRICE_CONCURRENCY, (id) =>
        cache.invalidate(priceSuggestionsCacheKey(uid, id)),
      );
    }

    const valuationInstances = instances.map(toValuationInput);

    // Everything attempted so far = releases in [0, cursor+BATCH_SIZE) (or the
    // whole collection on a `retry=failed` sweep). The slice past the cursor is
    // priced fresh; the earlier part is re-read from the shared 7-day cache so
    // the fold covers the whole collection so far — and any earlier release
    // that transiently failed gets another attempt for free on each chunk.
    const processedReleaseIds = unique(
      (fullSweep ? instances : instances.slice(0, cursor + BATCH_SIZE)).map((i) => i.releaseId),
    );
    const batchReleaseIds = new Set(
      fullSweep
        ? processedReleaseIds
        : unique(instances.slice(cursor, cursor + BATCH_SIZE).map((i) => i.releaseId)),
    );

    const suggestionsByRelease = new Map<number, ReleaseSuggestions>();
    // Releases (batch or earlier) that hit a transient failure this chunk and
    // are therefore still uncached — surfaced as `retryable`, never folded into
    // the valuation as permanent `no_market_data` (US3, FR-023a).
    const failedReleaseIds = new Set<number>();
    let pricedThisBatch = 0;
    let fromCacheThisBatch = 0;
    let failedThisBatch = 0;
    let outage = false;

    await mapWithConcurrency(processedReleaseIds, PRICE_CONCURRENCY, async (releaseId) => {
      const inBatch = batchReleaseIds.has(releaseId);
      const wasCached = inBatch
        ? await cache.has(priceSuggestionsCacheKey(uid, releaseId))
        : false;
      try {
        const suggestions = await discogsMarketplace.getPriceSuggestions(connection, releaseId);
        suggestionsByRelease.set(releaseId, suggestions);
        if (inBatch) {
          pricedThisBatch += 1;
          if (wasCached) {
            fromCacheThisBatch += 1;
          }
        }
      } catch (err) {
        if (err instanceof DiscogsUnavailableError || err instanceof DiscogsRateLimitError) {
          outage = true;
          failedReleaseIds.add(releaseId);
          if (inBatch) {
            failedThisBatch += 1;
          }
          return;
        }
        throw err; // SellerSettingsRequiredError / DiscogsAuthError propagate.
      }
    });

    const attemptedReleaseIds = new Set(suggestionsByRelease.keys());
    const valuation = computeValuation(
      valuationInstances,
      suggestionsByRelease,
      attemptedReleaseIds,
      { outage: outage && suggestionsByRelease.size === 0 },
    );
    const retryable = failedReleaseIds.size;

    let nextCursor: number | undefined;
    if (valuation.status === 'partial') {
      const sweptWholeCollection = fullSweep || cursor + BATCH_SIZE >= instances.length;
      if (sweptWholeCollection) {
        // Every instance has been visited; the remainder is `retryable`
        // transient failures. Stop the loop — the client re-drives them
        // explicitly via `?retry=failed` (US3). No infinite same-cursor spin.
        nextCursor = undefined;
      } else if (outage && pricedThisBatch === 0) {
        // No forward progress at all this batch (a real outage on the fresh
        // slice) — the client retries the same cursor once the shared throttle
        // recovers (US2 behaviour, data-model §6).
        nextCursor = cursor;
      } else {
        // An otherwise-successful chunk: advance past the priced slice even if
        // a few releases in it failed transiently (they are counted in
        // `retryable` and retried on every subsequent fold).
        nextCursor = cursor + BATCH_SIZE;
      }
    }

    return {
      valuation,
      status: valuation.status,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
      pricedThisBatch,
      fromCacheThisBatch,
      failedThisBatch,
      retryable,
      ...(valuation.status === 'complete'
        ? {
            perDisc: computePerDisc(
              valuationInstances,
              suggestionsByRelease,
              attemptedReleaseIds,
            ),
          }
        : {}),
    };
  }

  return { getCollectionValuation };
}
