jest.mock('../../../../src/adapters/discogsCatalog/discogsCatalogAdapter', () => ({
  getRelease: jest.fn(),
}));

import { getRelease } from '../../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { createAddToWantlistUseCase } from '../../../../src/application/wantlist/addToWantlist';
import {
  CatalogUnavailableForWantError,
  DiscogsNotLinkedError,
  ReleaseNotFoundForWantError,
} from '../../../../src/domain/wantlist/wantlistErrors';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../../src/discogs/discogsErrors';
import { logger } from '../../../../src/config/logger';
import type { Release } from '../../../../src/domain/discogsCatalog/types';
import type { CollectionInstance } from '../../../../src/domain/discogsOauth/collectionTypes';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { WantItem } from '../../../../src/domain/discogsOauth/wantlistTypes';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../../../src/ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../../../src/ports/discogsOauth/discogsWantlistPort';

const UID = 'user-1';
const RELEASE_ID = 555;
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
    basicInformation: { title: `Release ${releaseId}`, year: 1979, artists: [], thumb: null },
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

function collectionInstance(releaseId: number): CollectionInstance {
  return {
    releaseId,
    instanceId: releaseId * 10,
    folderId: 1,
    rating: 0,
    mediaCondition: null,
    sleeveCondition: null,
    notes: null,
    dateAdded: '2026-01-01T00:00:00.000Z',
  };
}

function fakeDiscogsWantlist(): jest.Mocked<DiscogsWantlistPort> {
  return {
    listWants: jest.fn().mockResolvedValue([]),
    getWant: jest.fn().mockResolvedValue(null),
    putWant: jest.fn().mockImplementation(async (_conn, releaseId: number, fields) =>
      want(releaseId, {
        rating: fields.rating ?? 0,
        notes: fields.notes && fields.notes !== '' ? fields.notes : null,
      }),
    ),
    deleteWant: jest.fn(),
  };
}

function fakeDiscogsCollection(): jest.Mocked<DiscogsCollectionPort> {
  return {
    getFieldMap: jest.fn(),
    listAllInstances: jest.fn(),
    getInstancesForRelease: jest.fn().mockResolvedValue([]),
    addReleaseToCollection: jest.fn(),
    deleteInstance: jest.fn(),
    setRating: jest.fn(),
    setFieldValue: jest.fn(),
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
    discogsCollection?: jest.Mocked<DiscogsCollectionPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const discogsCollection = overrides.discogsCollection ?? fakeDiscogsCollection();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { addToWantlist } = createAddToWantlistUseCase({
    discogsWantlist,
    discogsCollection,
    discogsConnection,
    cache,
  });
  return { addToWantlist, discogsWantlist, discogsCollection, discogsConnection, cache };
}

beforeEach(() => {
  getReleaseMock.mockReset();
  getReleaseMock.mockImplementation(async (_credential, id: number) => release(id));
});

describe('addToWantlist: gating', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { addToWantlist, discogsWantlist } = buildUseCase({ discogsConnection });

    await expect(addToWantlist(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      DiscogsNotLinkedError,
    );
    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
  });
});

describe('addToWantlist: catalog gate', () => {
  it('throws ReleaseNotFoundForWantError when the catalog lookup 404s, writing nothing', async () => {
    getReleaseMock.mockRejectedValue(new DiscogsNotFoundError());
    const { addToWantlist, discogsWantlist } = buildUseCase();

    await expect(addToWantlist(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      ReleaseNotFoundForWantError,
    );
    expect(discogsWantlist.getWant).not.toHaveBeenCalled();
    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
  });

  it('throws CatalogUnavailableForWantError when the catalog is rate-limited', async () => {
    getReleaseMock.mockRejectedValue(new DiscogsRateLimitError());
    const { addToWantlist } = buildUseCase();

    await expect(addToWantlist(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      CatalogUnavailableForWantError,
    );
  });

  it('throws CatalogUnavailableForWantError when the catalog is unavailable', async () => {
    getReleaseMock.mockRejectedValue(new DiscogsUnavailableError());
    const { addToWantlist } = buildUseCase();

    await expect(addToWantlist(UID, RELEASE_ID)).rejects.toBeInstanceOf(
      CatalogUnavailableForWantError,
    );
  });
});

describe('addToWantlist: happy path', () => {
  it('creates the want when it is not present and returns alreadyInWantlist:false', async () => {
    const { addToWantlist, discogsWantlist } = buildUseCase();

    const result = await addToWantlist(UID, RELEASE_ID);

    expect(discogsWantlist.getWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
    );
    expect(discogsWantlist.putWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
      {},
    );
    expect(result.alreadyInWantlist).toBe(false);
    expect(result).toMatchObject({
      discogsReleaseId: RELEASE_ID,
      catalogStatus: 'ok',
      alreadyInLibrary: false,
    });
    expect(result.release?.discogsId).toBe(RELEASE_ID);
  });

  it('invalidates the wantlist cache key after a successful add', async () => {
    const { addToWantlist, cache } = buildUseCase();

    await addToWantlist(UID, RELEASE_ID);

    expect(cache.invalidate).toHaveBeenCalledWith(`discogs:wantlist:${UID}`);
  });

  it('returns a full AddToWantlistResult enriched from the catalog', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.putWant.mockResolvedValue(
      want(RELEASE_ID, { rating: 3, notes: 'Repress fine', dateAdded: '2026-09-06T12:00:00.000Z' }),
    );
    const { addToWantlist } = buildUseCase({ discogsWantlist });

    const result = await addToWantlist(UID, RELEASE_ID);

    expect(result).toEqual({
      discogsReleaseId: RELEASE_ID,
      rating: 3,
      notes: 'Repress fine',
      addedAt: '2026-09-06T12:00:00.000Z',
      catalogStatus: 'ok',
      release: release(RELEASE_ID),
      alreadyInWantlist: false,
      alreadyInLibrary: false,
    });
  });
});

describe('addToWantlist: idempotency', () => {
  it('does not write when the release is already a want and reflects the existing entry', async () => {
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.getWant.mockResolvedValue(
      want(RELEASE_ID, { rating: 5, notes: 'Original pressing only' }),
    );
    const { addToWantlist } = buildUseCase({ discogsWantlist });

    const result = await addToWantlist(UID, RELEASE_ID);

    expect(discogsWantlist.putWant).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      discogsReleaseId: RELEASE_ID,
      rating: 5,
      notes: 'Original pressing only',
      alreadyInWantlist: true,
    });
  });
});

describe('addToWantlist: already-in-library indication', () => {
  it('sets alreadyInLibrary:true when the collection has an instance, without writing the library', async () => {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.getInstancesForRelease.mockResolvedValue([
      collectionInstance(RELEASE_ID),
    ]);
    const { addToWantlist } = buildUseCase({ discogsCollection });

    const result = await addToWantlist(UID, RELEASE_ID);

    expect(result.alreadyInLibrary).toBe(true);
    expect(discogsCollection.addReleaseToCollection).not.toHaveBeenCalled();
  });

  it('sets alreadyInLibrary:false when the collection has no instance for the release', async () => {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.getInstancesForRelease.mockResolvedValue([]);
    const { addToWantlist } = buildUseCase({ discogsCollection });

    const result = await addToWantlist(UID, RELEASE_ID);

    expect(result.alreadyInLibrary).toBe(false);
  });
});

describe('addToWantlist: logging', () => {
  it('logs entry_added with the two advisory flags', async () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { addToWantlist } = buildUseCase();

    await addToWantlist(UID, RELEASE_ID);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'wantlistSync',
        outcome: 'entry_added',
        uid: UID,
        meta: { releaseId: RELEASE_ID, alreadyInWantlist: false, alreadyInLibrary: false },
      }),
    );

    infoSpy.mockRestore();
  });
});
