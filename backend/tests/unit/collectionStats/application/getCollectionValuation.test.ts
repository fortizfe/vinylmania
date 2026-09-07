import {
  createGetCollectionValuationUseCase,
  type ValuationChunkResult,
} from '../../../../src/application/collectionStats/getCollectionValuation';
import { DiscogsNotLinkedError, SellerSettingsRequiredError } from '../../../../src/domain/collectionStats/statsErrors';
import { DiscogsUnavailableError } from '../../../../src/discogs/discogsErrors';
import { priceSuggestionsCacheKey } from '../../../../src/ports/discogsOauth/discogsMarketplacePort';
import type { PriceSuggestions } from '../../../../src/ports/discogsOauth/discogsMarketplacePort';
import type { CollectionInstance } from '../../../../src/domain/discogsOauth/collectionTypes';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';

/**
 * Feature 061, T037 (US2) — chunked `getCollectionValuation` use case. Fake
 * ports only; the module under test does not exist yet, so this MUST fail on
 * first run (Constitution Principle I).
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

let seq = 0;
function collectionInstance(overrides: Partial<CollectionInstance> = {}): CollectionInstance {
  seq += 1;
  const releaseId = overrides.releaseId ?? seq;
  return {
    releaseId,
    instanceId: overrides.instanceId ?? releaseId * 100,
    folderId: 1,
    rating: 0,
    mediaCondition:
      overrides.mediaCondition === undefined ? 'Very Good (VG)' : overrides.mediaCondition,
    sleeveCondition: null,
    notes: null,
    dateAdded: '2024-01-01T00:00:00-08:00',
    year: 1975,
    labelNames: ['Label'],
    artistNames: overrides.artistNames ?? ['Some Artist'],
    genres: ['Rock'],
    styles: ['Krautrock'],
    title: overrides.title ?? `Release ${releaseId}`,
  };
}

function priceMap(value: number): PriceSuggestions {
  return { 'Very Good (VG)': { currency: 'EUR', value } };
}

/** In-memory CachePort: real get-or-fetch semantics, observable store. */
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
 * Fake marketplace port that models the real adapter's 7-day cache: the port
 * method may be called many times, but `discogsCalls` only counts the ones
 * that would actually reach Discogs (a cold release).
 */
function fakeMarketplace(
  pricesByRelease: Map<number, PriceSuggestions>,
  opts: { warm?: number[]; throwFor?: Map<number, Error> } = {},
) {
  const warm = new Set(opts.warm ?? []);
  const state = { discogsCalls: 0, portCalls: 0 };
  const getPriceSuggestions = jest.fn(async (_conn: DiscogsConnection, releaseId: number) => {
    state.portCalls += 1;
    const thrown = opts.throwFor?.get(releaseId);
    if (thrown) {
      throw thrown;
    }
    if (!warm.has(releaseId)) {
      state.discogsCalls += 1;
      warm.add(releaseId);
    }
    return pricesByRelease.get(releaseId) ?? null;
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

function fakeConnectionPort(conn: DiscogsConnection | null = CONNECTION) {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn(async () => conn),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn(),
  };
}

function build(opts: {
  instances?: CollectionInstance[];
  prices?: Map<number, PriceSuggestions>;
  warm?: number[];
  throwFor?: Map<number, Error>;
  connection?: DiscogsConnection | null;
  cache?: ReturnType<typeof fakeCache>;
} = {}) {
  const instances = opts.instances ?? [];
  const prices =
    opts.prices ?? new Map(instances.map((i) => [i.releaseId, priceMap(10)]));
  const cache = opts.cache ?? fakeCache();
  const collection = fakeCollectionPort(instances);
  const marketplace = fakeMarketplace(prices, { warm: opts.warm, throwFor: opts.throwFor });
  const connection = fakeConnectionPort(
    opts.connection === undefined ? CONNECTION : opts.connection,
  );
  const { getCollectionValuation } = createGetCollectionValuationUseCase({
    discogsCollection: collection as never,
    discogsMarketplace: marketplace as never,
    discogsConnection: connection as never,
    cache: cache as never,
  });
  return { getCollectionValuation, cache, collection, marketplace, connection };
}

/** Drive the cursor loop to exhaustion, collecting each chunk response. */
async function runLoop(
  getCollectionValuation: (
    uid: string,
    o?: { cursor?: number; refresh?: boolean },
  ) => Promise<ValuationChunkResult>,
) {
  const chunks: ValuationChunkResult[] = [];
  let cursor: number | undefined = 0;
  let guard = 0;
  do {
    const chunk = await getCollectionValuation(UID, { cursor });
    chunks.push(chunk);
    cursor = chunk.nextCursor;
    guard += 1;
  } while (cursor !== undefined && guard < 50);
  return chunks;
}

describe('getCollectionValuation (feature 061, US2)', () => {
  it('throws DiscogsNotLinkedError when the caller has no connection', async () => {
    const { getCollectionValuation } = build({ connection: null });
    await expect(getCollectionValuation(UID)).rejects.toBeInstanceOf(DiscogsNotLinkedError);
  });

  it('caches the instance list at discogs:statsinstances:{uid} on cursor=0', async () => {
    const instances = [collectionInstance({ releaseId: 1 })];
    const { getCollectionValuation, cache, collection } = build({ instances });
    await getCollectionValuation(UID, { cursor: 0 });
    expect(cache.store.has(`discogs:statsinstances:${UID}`)).toBe(true);
    // A follow-up chunk reuses the cached list — no second collection walk.
    await getCollectionValuation(UID, { cursor: 25 });
    expect(collection.listAllInstances).toHaveBeenCalledTimes(1);
  });

  it('prices only the [cursor, cursor+BATCH_SIZE) slice each call', async () => {
    const instances = Array.from({ length: 30 }, (_, i) =>
      collectionInstance({ releaseId: i + 1 }),
    );
    const { getCollectionValuation, marketplace } = build({ instances });

    const first = await getCollectionValuation(UID, { cursor: 0 });
    expect(first.pricedThisBatch).toBe(25);
    expect(first.status).toBe('partial');
    expect(first.nextCursor).toBe(25);
    expect(marketplace.state.discogsCalls).toBe(25);

    const second = await getCollectionValuation(UID, { cursor: 25 });
    expect(second.pricedThisBatch).toBe(5);
    expect(second.status).toBe('complete');
    expect(second.nextCursor).toBeUndefined();
    // 25 fresh + 5 fresh; the re-read of [0,25) is served from cache.
    expect(marketplace.state.discogsCalls).toBe(30);
  });

  it('folds the valuation over every cached suggestion so far, not just this batch', async () => {
    const instances = Array.from({ length: 30 }, (_, i) =>
      collectionInstance({ releaseId: i + 1, mediaCondition: 'Very Good (VG)' }),
    );
    const prices = new Map(instances.map((i) => [i.releaseId, priceMap(2)]));
    const { getCollectionValuation } = build({ instances, prices });

    const first = await getCollectionValuation(UID, { cursor: 0 });
    expect(first.valuation.coveredCount).toBe(25);
    expect(first.valuation.estimatedTotal).toBe(50);

    const second = await getCollectionValuation(UID, { cursor: 25 });
    expect(second.valuation.coveredCount).toBe(30);
    expect(second.valuation.estimatedTotal).toBe(60);
    expect(second.valuation.totalCount).toBe(30);
  });

  it('includes the full perDisc list only on the final (complete) page', async () => {
    const instances = Array.from({ length: 26 }, (_, i) =>
      collectionInstance({ releaseId: i + 1 }),
    );
    const { getCollectionValuation } = build({ instances });
    const chunks = await runLoop(getCollectionValuation);
    const last = chunks[chunks.length - 1];
    expect(chunks[0].perDisc).toBeUndefined();
    expect(last.status).toBe('complete');
    expect(last.perDisc).toHaveLength(26);
  });

  it('a warm 7-day cache ⇒ zero Discogs calls and fromCacheThisBatch == pricedThisBatch', async () => {
    const instances = Array.from({ length: 10 }, (_, i) =>
      collectionInstance({ releaseId: i + 1 }),
    );
    const cache = fakeCache();
    // Pre-warm the shared price cache the use case probes with `has`.
    for (const inst of instances) {
      cache.store.set(
        priceSuggestionsCacheKey(UID, inst.releaseId),
        JSON.stringify(priceMap(10)),
      );
    }
    const { getCollectionValuation, marketplace } = build({
      instances,
      warm: instances.map((i) => i.releaseId),
      cache,
    });

    const chunk = await getCollectionValuation(UID, { cursor: 0 });
    expect(marketplace.state.discogsCalls).toBe(0);
    expect(chunk.fromCacheThisBatch).toBe(chunk.pricedThisBatch);
    expect(chunk.pricedThisBatch).toBe(10);
  });

  it('reports fromCacheThisBatch = 0 on a cold run', async () => {
    const instances = [collectionInstance({ releaseId: 1 }), collectionInstance({ releaseId: 2 })];
    const { getCollectionValuation } = build({ instances });
    const chunk = await getCollectionValuation(UID, { cursor: 0 });
    expect(chunk.fromCacheThisBatch).toBe(0);
    expect(chunk.pricedThisBatch).toBe(2);
  });

  it('propagates SellerSettingsRequiredError from the marketplace port', async () => {
    const instances = [collectionInstance({ releaseId: 1 })];
    const { getCollectionValuation } = build({
      instances,
      throwFor: new Map([[1, new SellerSettingsRequiredError()]]),
    });
    await expect(getCollectionValuation(UID, { cursor: 0 })).rejects.toBeInstanceOf(
      SellerSettingsRequiredError,
    );
  });

  it('DiscogsUnavailableError before any disc is priced → status unavailable, no throw', async () => {
    const instances = [collectionInstance({ releaseId: 1 }), collectionInstance({ releaseId: 2 })];
    const { getCollectionValuation } = build({
      instances,
      throwFor: new Map([
        [1, new DiscogsUnavailableError()],
        [2, new DiscogsUnavailableError()],
      ]),
    });
    const chunk = await getCollectionValuation(UID, { cursor: 0 });
    expect(chunk.status).toBe('unavailable');
    expect(chunk.valuation.status).toBe('unavailable');
    expect(chunk.nextCursor).toBeUndefined();
  });

  it('DiscogsUnavailableError while walking the collection → status unavailable, no throw', async () => {
    const { getCollectionValuation, collection } = build({ instances: [] });
    collection.listAllInstances.mockRejectedValueOnce(new DiscogsUnavailableError());
    const chunk = await getCollectionValuation(UID, { cursor: 0 });
    expect(chunk.status).toBe('unavailable');
  });

  it('a whole-batch outage mid-collection → status partial, retry the same cursor', async () => {
    const instances = Array.from({ length: 60 }, (_, i) =>
      collectionInstance({ releaseId: i + 1 }),
    );
    // Every release in the [25,50) slice fails; [0,25) still prices fine.
    const throwFor = new Map<number, Error>();
    for (let releaseId = 26; releaseId <= 50; releaseId += 1) {
      throwFor.set(releaseId, new DiscogsUnavailableError());
    }
    const { getCollectionValuation } = build({ instances, throwFor });

    const chunk = await getCollectionValuation(UID, { cursor: 25 });
    expect(chunk.status).toBe('partial');
    expect(chunk.nextCursor).toBe(25); // no forward progress → retry same cursor
    expect(chunk.retryable).toBe(25);
  });

  it('a transient per-release failure on an otherwise-successful final slice → partial + retryable, loop stops', async () => {
    const instances = Array.from({ length: 30 }, (_, i) =>
      collectionInstance({ releaseId: i + 1 }),
    );
    const { getCollectionValuation } = build({
      instances,
      throwFor: new Map([[26, new DiscogsUnavailableError()]]),
    });

    const chunk = await getCollectionValuation(UID, { cursor: 25 });
    expect(chunk.status).toBe('partial');
    // The whole collection has been swept; the client re-drives release 26
    // via ?retry=failed rather than spinning on the same cursor.
    expect(chunk.nextCursor).toBeUndefined();
    expect(chunk.retryable).toBe(1);
    expect(chunk.valuation.uncovered.noMarketData).toBe(0);
  });

  it('honors refresh on cursor=0 by re-walking the collection', async () => {
    const instances = [collectionInstance({ releaseId: 1 })];
    const { getCollectionValuation, cache, collection } = build({ instances });
    await getCollectionValuation(UID, { cursor: 0 });
    await getCollectionValuation(UID, { cursor: 0, refresh: true });
    expect(collection.listAllInstances).toHaveBeenCalledTimes(2);
    expect(cache.invalidate).toHaveBeenCalledWith(`discogs:statsinstances:${UID}`);
  });
});
