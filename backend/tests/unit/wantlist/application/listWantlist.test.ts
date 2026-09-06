jest.mock('../../../../src/adapters/discogsCatalog/discogsCatalogAdapter', () => ({
  getRelease: jest.fn(),
}));

import { getRelease } from '../../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { createListWantlistUseCase } from '../../../../src/application/wantlist/listWantlist';
import { DiscogsNotLinkedError } from '../../../../src/domain/wantlist/wantlistErrors';
import { DiscogsUnavailableError } from '../../../../src/discogs/discogsErrors';
import type { Release } from '../../../../src/domain/discogsCatalog/types';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type {
  WantItem,
  EnrichedWantEntry,
} from '../../../../src/domain/discogsOauth/wantlistTypes';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { DiscogsWantlistPort } from '../../../../src/ports/discogsOauth/discogsWantlistPort';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';

const UID = 'user-1';
const getReleaseMock = getRelease as jest.MockedFunction<typeof getRelease>;

function connection(overrides: Partial<DiscogsConnection> = {}): DiscogsConnection {
  return {
    uid: UID,
    discogsUsername: 'collector',
    discogsUserId: 9,
    accessToken: 'at',
    accessTokenSecret: 'as',
    linkedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function want(releaseId: number, overrides: Partial<WantItem> = {}): WantItem {
  return {
    releaseId,
    rating: 0,
    notes: null,
    dateAdded: '2025-08-01T12:00:00.000Z',
    basicInformation: {
      title: `Release ${releaseId}`,
      year: 1979,
      artists: [],
      thumb: null,
    },
    ...overrides,
  };
}

function release(discogsId: number): Release {
  return {
    discogsId,
    title: `Release ${discogsId}`,
    artists: [],
    labels: [],
    formats: [],
    genres: [],
    styles: [],
    identifiers: [],
    tracklist: [],
    images: [],
    discogsUrl: `https://www.discogs.com/release/${discogsId}`,
  };
}

function fakeDiscogsWantlist(): jest.Mocked<DiscogsWantlistPort> {
  return {
    listWants: jest.fn().mockResolvedValue([]),
    getWant: jest.fn(),
    putWant: jest.fn(),
    deleteWant: jest.fn(),
  };
}

function fakeDiscogsConnection(): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(connection()),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn().mockResolvedValue(undefined),
  };
}

// Fail-soft, always-miss cache — every call runs the fetcher, mirroring the
// syncLibrary unit test's fake cache.
function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

function buildUseCase(
  overrides: {
    discogsWantlist?: jest.Mocked<DiscogsWantlistPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { listWantlist } = createListWantlistUseCase({
    discogsWantlist,
    discogsConnection,
    cache,
  });
  return { listWantlist, discogsWantlist, discogsConnection, cache };
}

beforeEach(() => {
  getReleaseMock.mockReset();
  getReleaseMock.mockImplementation(async (_credential, id: number) => release(id));
});

describe('listWantlist: gating', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { listWantlist, discogsWantlist } = buildUseCase({ discogsConnection });

    await expect(listWantlist(UID)).rejects.toBeInstanceOf(DiscogsNotLinkedError);
    expect(discogsWantlist.listWants).not.toHaveBeenCalled();
  });

  it('propagates a Discogs failure from listWants', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockRejectedValue(new DiscogsUnavailableError());
    const { listWantlist } = buildUseCase({ discogsWantlist });

    await expect(listWantlist(UID)).rejects.toBeInstanceOf(DiscogsUnavailableError);
  });
});

describe('listWantlist: enrichment + ordering', () => {
  it('returns entries newest-first by addedAt', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockResolvedValue([
      want(1, { dateAdded: '2025-01-01T00:00:00.000Z' }),
      want(2, { dateAdded: '2025-08-01T00:00:00.000Z' }),
      want(3, { dateAdded: '2025-05-01T00:00:00.000Z' }),
    ]);
    const { listWantlist } = buildUseCase({ discogsWantlist });

    const result = await listWantlist(UID);

    expect(result.map((e) => e.discogsReleaseId)).toEqual([2, 3, 1]);
  });

  it('maps WantItem fields onto the enriched entry', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockResolvedValue([
      want(7, {
        rating: 4,
        notes: 'Original pressing only',
        dateAdded: '2025-08-01T19:00:00.000Z',
      }),
    ]);
    const { listWantlist } = buildUseCase({ discogsWantlist });

    const [entry] = await listWantlist(UID);

    expect(entry).toMatchObject({
      discogsReleaseId: 7,
      rating: 4,
      notes: 'Original pressing only',
      addedAt: '2025-08-01T19:00:00.000Z',
      catalogStatus: 'ok',
    });
    expect(entry.release?.discogsId).toBe(7);
  });

  it('marks a single entry catalogStatus unavailable when its catalog lookup throws, keeping the others', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockResolvedValue([
      want(1, { dateAdded: '2025-08-02T00:00:00.000Z' }),
      want(2, { dateAdded: '2025-08-01T00:00:00.000Z' }),
    ]);
    getReleaseMock.mockImplementation(async (_credential, id: number) => {
      if (id === 1) throw new DiscogsUnavailableError();
      return release(id);
    });
    const { listWantlist } = buildUseCase({ discogsWantlist });

    const result = await listWantlist(UID);

    const one = result.find((e) => e.discogsReleaseId === 1)!;
    const two = result.find((e) => e.discogsReleaseId === 2)!;
    expect(one.catalogStatus).toBe('unavailable');
    expect(one.release).toBeNull();
    expect(two.catalogStatus).toBe('ok');
    expect(two.release).not.toBeNull();
  });
});

describe('listWantlist: caching', () => {
  it('serves a warm cache hit without calling listWants', async () => {
    const cached: EnrichedWantEntry[] = [
      {
        discogsReleaseId: 99,
        rating: 0,
        notes: null,
        addedAt: '2025-08-01T00:00:00.000Z',
        catalogStatus: 'ok',
        release: release(99),
      },
    ];
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    cache.withCache.mockResolvedValue(cached);
    const { listWantlist, discogsWantlist } = buildUseCase({ cache });

    const result = await listWantlist(UID);

    expect(result).toEqual(cached);
    expect(discogsWantlist.listWants).not.toHaveBeenCalled();
  });

  it('force=true invalidates the cache key first, then re-fetches', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockResolvedValue([want(5)]);
    const cache = fakeCache();
    cache.has.mockResolvedValue(true);
    const { listWantlist } = buildUseCase({ cache, discogsWantlist });

    await listWantlist(UID, { force: true });

    expect(cache.invalidate).toHaveBeenCalledWith(`discogs:wantlist:${UID}`);
    expect(discogsWantlist.listWants).toHaveBeenCalledTimes(1);
    const invalidateOrder = cache.invalidate.mock.invocationCallOrder[0];
    const listOrder = discogsWantlist.listWants.mock.invocationCallOrder[0];
    expect(invalidateOrder).toBeLessThan(listOrder);
  });

  it('returns the full array (the route does the slicing)', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.listWants.mockResolvedValue(
      Array.from({ length: 25 }, (_v, i) =>
        want(i + 1, {
          dateAdded: `2025-08-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        }),
      ),
    );
    const { listWantlist } = buildUseCase({ discogsWantlist });

    const result = await listWantlist(UID);

    expect(result).toHaveLength(25);
  });
});
