import {
  createGetCollectionValuationUseCase,
  type ValuationChunkResult,
} from '../../../../src/application/collectionStats/getCollectionValuation';
import { DiscogsUnavailableError } from '../../../../src/discogs/discogsErrors';
import { priceSuggestionsCacheKey } from '../../../../src/ports/discogsOauth/discogsMarketplacePort';
import type { PriceSuggestions } from '../../../../src/ports/discogsOauth/discogsMarketplacePort';
import type { CollectionInstance } from '../../../../src/domain/discogsOauth/collectionTypes';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';

/**
 * Feature 061, T048 (US3) — `getCollectionValuation` at collection scale.
 * Fake ports only. Pins the large-collection guarantees of `data-model` §4 /
 * FR-023a / FR-021 / SC-005–006:
 *   - the cursor loop pages the whole collection with no cap;
 *   - per-chunk pricing concurrency never exceeds the limit;
 *   - a chunk where some price calls throw `DiscogsUnavailableError` marks
 *     those releases retryable (never permanently `no_market_data`), keeps the
 *     successes, and the loop continues to completion;
 *   - a second full pass over a warm 7-day cache issues zero upstream calls.
 */

const UID = 'user-1';
const CONNECTION: DiscogsConnection = {
  uid: UID,
  discogsUsername: 'collector',
  discogsUserId: 9,
  accessToken: 'at',
  accessTokenSecret: 'as',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

const INSTANCE_COUNT = 250;
const CONCURRENCY_LIMIT = 4;
const VG = 'Very Good (VG)';

function collectionInstance(releaseId: number): CollectionInstance {
  return {
    releaseId,
    instanceId: releaseId * 100,
    folderId: 1,
    rating: 0,
    mediaCondition: VG,
    sleeveCondition: null,
    notes: null,
    dateAdded: '2024-01-01T00:00:00-08:00',
    title: `Release ${releaseId}`,
    year: 1975,
    labelNames: ['Label'],
    artistNames: ['Some Artist'],
    genres: ['Rock'],
    styles: ['Krautrock'],
  };
}

function priceMap(value: number): PriceSuggestions {
  return { [VG]: { currency: 'EUR', value } };
}

/** In-memory CachePort with real get-or-fetch semantics. */
function fakeCache() {
  const store = new Map<string, string>();
  return {
    store,
    has: jest.fn(async (key: string) => store.has(key)),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    invalidate: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    withCache: jest.fn(async <T>(key: string, _ttl: number, fetcher: () => Promise<T>) => {
      const cached = store.get(key);
      if (cached !== undefined) {
        return JSON.parse(cached) as T;
      }
      const fresh = await fetcher();
      store.set(key, JSON.stringify(fresh));
      return fresh;
    }),
  };
}

/**
 * Fake marketplace port modelling the real adapter: it writes each fetched
 * price into the shared cache (the adapter's 7-day entry) so a warm key means
 * zero upstream traffic, tracks max observed in-flight calls and the count of
 * calls that actually reached Discogs, and lets specific releases throw a
 * transient `DiscogsUnavailableError` on their first N calls.
 */
function fakeMarketplace(
  cache: ReturnType<typeof fakeCache>,
  opts: { transientOnce?: Set<number> } = {},
) {
  const transientRemaining = new Map<number, number>();
  for (const id of opts.transientOnce ?? []) {
    transientRemaining.set(id, 1);
  }
  const state = { discogsCalls: 0, inFlight: 0, maxInFlight: 0 };

  const getPriceSuggestions = jest.fn(async (_conn: DiscogsConnection, releaseId: number) => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    try {
      await new Promise((resolve) => setImmediate(resolve));

      const key = priceSuggestionsCacheKey(UID, releaseId);
      const cached = cache.store.get(key);
      if (cached !== undefined) {
        return JSON.parse(cached) as PriceSuggestions;
      }

      const failuresLeft = transientRemaining.get(releaseId) ?? 0;
      if (failuresLeft > 0) {
        transientRemaining.set(releaseId, failuresLeft - 1);
        throw new DiscogsUnavailableError();
      }

      state.discogsCalls += 1;
      const result = priceMap(10);
      cache.store.set(key, JSON.stringify(result));
      return result;
    } finally {
      state.inFlight -= 1;
    }
  });

  return { getPriceSuggestions, state };
}

function fakeCollectionPort(instances: CollectionInstance[]) {
  return {
    getFieldMap: jest.fn(),
    listAllInstances: jest.fn(async () => instances),
    getInstancesForRelease: jest.fn(),
    addReleaseToCollection: jest.fn(),
    deleteInstance: jest.fn(),
    setRating: jest.fn(),
    setFieldValue: jest.fn(),
  };
}

function fakeConnectionPort() {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn(async () => CONNECTION),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn(),
  };
}

function build(opts: { transientOnce?: Set<number>; cache?: ReturnType<typeof fakeCache> } = {}) {
  const instances = Array.from({ length: INSTANCE_COUNT }, (_, i) => collectionInstance(i + 1));
  const cache = opts.cache ?? fakeCache();
  const collection = fakeCollectionPort(instances);
  const marketplace = fakeMarketplace(cache, { transientOnce: opts.transientOnce });
  const { getCollectionValuation } = createGetCollectionValuationUseCase({
    discogsCollection: collection as never,
    discogsMarketplace: marketplace as never,
    discogsConnection: fakeConnectionPort() as never,
    cache: cache as never,
  });
  return { getCollectionValuation, cache, collection, marketplace, instances };
}

async function runLoop(
  getCollectionValuation: (
    uid: string,
    o?: { cursor?: number; refresh?: boolean; retry?: 'failed' },
  ) => Promise<ValuationChunkResult>,
): Promise<ValuationChunkResult[]> {
  const chunks: ValuationChunkResult[] = [];
  let cursor: number | undefined = 0;
  let guard = 0;
  do {
    const chunk: ValuationChunkResult = await getCollectionValuation(UID, { cursor });
    chunks.push(chunk);
    cursor = chunk.nextCursor;
    guard += 1;
  } while (cursor !== undefined && guard < 100);
  return chunks;
}

describe('getCollectionValuation at scale (feature 061, US3)', () => {
  it('pages the whole 250-instance collection via nextCursor with no cap', async () => {
    const { getCollectionValuation, collection } = build();

    const chunks = await runLoop(getCollectionValuation);
    const last = chunks[chunks.length - 1];

    expect(last.status).toBe('complete');
    expect(last.valuation.totalCount).toBe(INSTANCE_COUNT);
    expect(last.valuation.coveredCount).toBe(INSTANCE_COUNT);
    expect(last.perDisc).toHaveLength(INSTANCE_COUNT);
    // The instance list is walked once and cached for the rest of the loop.
    expect(collection.listAllInstances).toHaveBeenCalledTimes(1);
    // 250 / 25 = 10 chunks, no early cap.
    expect(chunks).toHaveLength(10);
  });

  it('never exceeds the per-chunk pricing concurrency limit', async () => {
    const { getCollectionValuation, marketplace } = build();
    await runLoop(getCollectionValuation);
    expect(marketplace.state.maxInFlight).toBeGreaterThan(1);
    expect(marketplace.state.maxInFlight).toBeLessThanOrEqual(CONCURRENCY_LIMIT);
  });

  it('marks transiently-failed releases retryable (not no_market_data) and the loop still completes', async () => {
    const transientOnce = new Set([3, 17, 40]);
    const { getCollectionValuation } = build({ transientOnce });

    const chunks = await runLoop(getCollectionValuation);

    // Some chunk surfaced the transient failures as retryable.
    expect(chunks.some((c) => (c.retryable ?? 0) > 0)).toBe(true);

    const last = chunks[chunks.length - 1];
    expect(last.status).toBe('complete');
    // Retried on a later fold — priced, never stuck as no_market_data.
    expect(last.valuation.uncovered.noMarketData).toBe(0);
    expect(last.valuation.coveredCount).toBe(INSTANCE_COUNT);
    expect(last.retryable ?? 0).toBe(0);
  });

  it('a second full pass over a warm cache issues zero upstream calls', async () => {
    const cache = fakeCache();
    const first = build({ cache });
    await runLoop(first.getCollectionValuation);
    const coldCalls = first.marketplace.state.discogsCalls;
    expect(coldCalls).toBe(INSTANCE_COUNT);

    // Re-drive the loop against the same warm cache (fresh use case + ports,
    // but the price entries are already in Redis).
    const second = build({ cache });
    const chunks = await runLoop(second.getCollectionValuation);

    expect(second.marketplace.state.discogsCalls).toBe(0);
    for (const chunk of chunks) {
      expect(chunk.fromCacheThisBatch).toBe(chunk.pricedThisBatch);
    }
    expect(chunks[chunks.length - 1].status).toBe('complete');
  });

  it('keeps the discogs:statsinstances cursor ordering stable across a navigation gap', async () => {
    const cache = fakeCache();
    // First visit: walk a few chunks, then the user navigates away.
    const visitA = build({ cache });
    await visitA.getCollectionValuation(UID, { cursor: 0 });
    const midA = await visitA.getCollectionValuation(UID, { cursor: 25 });
    expect(midA.valuation.coveredCount).toBe(50);

    // Return visit (fresh use case + ports, same warm cache): resume from the
    // running total, no re-walk, identical arithmetic for the same cursor.
    const visitB = build({ cache });
    const midB = await visitB.getCollectionValuation(UID, { cursor: 25 });
    expect(visitB.collection.listAllInstances).not.toHaveBeenCalled();
    expect(midB.valuation.coveredCount).toBe(50);
    expect(midB.valuation.totalCount).toBe(INSTANCE_COUNT);

    const chunks = await runLoop(visitB.getCollectionValuation);
    expect(chunks[chunks.length - 1].status).toBe('complete');
    expect(chunks[chunks.length - 1].valuation.coveredCount).toBe(INSTANCE_COUNT);
  });

  it('retry=failed re-prices only the still-uncached releases', async () => {
    // Release 9 keeps failing until an explicit retry sweep.
    const instances = Array.from({ length: INSTANCE_COUNT }, (_, i) => collectionInstance(i + 1));
    const cache = fakeCache();
    const collection = fakeCollectionPort(instances);
    const marketplace = fakeMarketplace(cache);
    // Fail release 9 on every call during the normal loop...
    const failing = new Set([9]);
    const original = marketplace.getPriceSuggestions.getMockImplementation()!;
    let allowNine = false;
    marketplace.getPriceSuggestions.mockImplementation(async (conn, releaseId) => {
      if (failing.has(releaseId) && !allowNine) {
        throw new DiscogsUnavailableError();
      }
      return original(conn, releaseId);
    });

    const { getCollectionValuation } = createGetCollectionValuationUseCase({
      discogsCollection: collection as never,
      discogsMarketplace: marketplace as never,
      discogsConnection: fakeConnectionPort() as never,
      cache: cache as never,
    });

    const chunks = await runLoop(getCollectionValuation);
    const last = chunks[chunks.length - 1];
    expect(last.status).toBe('partial');
    expect(last.retryable).toBe(1);
    expect(last.nextCursor).toBeUndefined();
    expect(cache.store.has(priceSuggestionsCacheKey(UID, 9))).toBe(false);

    // Now the upstream recovers; the retry sweep prices only release 9.
    allowNine = true;
    const callsBefore = marketplace.state.discogsCalls;
    const retried = await getCollectionValuation(UID, { retry: 'failed' });

    expect(retried.status).toBe('complete');
    expect(retried.retryable ?? 0).toBe(0);
    expect(retried.valuation.coveredCount).toBe(INSTANCE_COUNT);
    expect(marketplace.state.discogsCalls - callsBefore).toBe(1);
  });
});
