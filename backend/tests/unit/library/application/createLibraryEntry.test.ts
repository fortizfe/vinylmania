jest.mock('../../../../src/adapters/discogsCatalog/discogsCatalogAdapter', () => ({
  getRelease: jest.fn(),
}));

import { getRelease } from '../../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { createCreateLibraryEntryUseCase } from '../../../../src/application/library/createLibraryEntry';
import { wantlistCacheKey } from '../../../../src/application/wantlist/listWantlist';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../../../src/discogs/discogsErrors';
import { logger } from '../../../../src/config/logger';
import type { Release } from '../../../../src/domain/discogsCatalog/types';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { LibraryEntry } from '../../../../src/domain/library/types';
import type { CachePort } from '../../../../src/ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../../../src/ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../../../src/ports/discogsOauth/discogsWantlistPort';
import type { LibraryRepositoryPort } from '../../../../src/ports/library/libraryRepositoryPort';

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

function entry(id: string, releaseId: number, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    discogsReleaseId: releaseId,
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeRepository(): jest.Mocked<LibraryRepositoryPort> {
  return {
    createEntry: jest.fn().mockImplementation(async (_uid, input) =>
      entry('new-entry', input.discogsReleaseId, {
        discogsInstanceId: input.discogsInstanceId,
        discogsFolderId: input.discogsFolderId,
      }),
    ),
    getEntry: jest.fn(),
    listEntries: jest.fn(),
    listAllEntries: jest.fn().mockResolvedValue([]),
    persistCatalogFields: jest.fn(),
    updateEntryInstance: jest.fn().mockResolvedValue(undefined),
    clearLegacyFields: jest.fn().mockResolvedValue(undefined),
    deleteEntry: jest.fn().mockResolvedValue(true),
  };
}

function fakeDiscogsCollection(): jest.Mocked<DiscogsCollectionPort> {
  return {
    getFieldMap: jest.fn().mockResolvedValue({
      mediaConditionFieldId: 1,
      sleeveConditionFieldId: 2,
      notesFieldId: 3,
    }),
    listAllInstances: jest.fn().mockResolvedValue([]),
    getInstancesForRelease: jest.fn(),
    addReleaseToCollection: jest.fn().mockResolvedValue({ instanceId: 900, folderId: 1 }),
    deleteInstance: jest.fn(),
    setRating: jest.fn(),
    setFieldValue: jest.fn().mockResolvedValue(undefined),
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

function fakeDiscogsWantlist(): jest.Mocked<DiscogsWantlistPort> {
  return {
    listWants: jest.fn().mockResolvedValue([]),
    getWant: jest.fn().mockResolvedValue(null),
    putWant: jest.fn(),
    deleteWant: jest.fn().mockResolvedValue(undefined),
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
    repository?: jest.Mocked<LibraryRepositoryPort>;
    discogsCollection?: jest.Mocked<DiscogsCollectionPort>;
    discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
    discogsWantlist?: jest.Mocked<DiscogsWantlistPort>;
    cache?: jest.Mocked<CachePort>;
  } = {},
) {
  const repository = overrides.repository ?? fakeRepository();
  const discogsCollection = overrides.discogsCollection ?? fakeDiscogsCollection();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const discogsWantlist = overrides.discogsWantlist ?? fakeDiscogsWantlist();
  const cache = overrides.cache ?? fakeCache();
  const { createLibraryEntry } = createCreateLibraryEntryUseCase({
    repository,
    discogsCollection,
    discogsConnection,
    discogsWantlist,
    cache,
  });
  return {
    createLibraryEntry,
    repository,
    discogsCollection,
    discogsConnection,
    discogsWantlist,
    cache,
  };
}

beforeEach(() => {
  getReleaseMock.mockReset();
  getReleaseMock.mockImplementation(async (_credential, id: number) => release(id));
});

describe('createLibraryEntry: happy path (existing behavior)', () => {
  it('looks up the catalog, writes to the Discogs collection, mirrors the entry and returns its discogs data', async () => {
    const { createLibraryEntry, repository, discogsCollection } = buildUseCase();

    const result = await createLibraryEntry(UID, RELEASE_ID);

    expect(discogsCollection.addReleaseToCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
    );
    expect(repository.createEntry).toHaveBeenCalledWith(UID, {
      discogsReleaseId: RELEASE_ID,
      discogsInstanceId: 900,
      discogsFolderId: 1,
    });
    expect(result.entry).toMatchObject({ id: 'new-entry', discogsReleaseId: RELEASE_ID });
    expect(result.release.discogsId).toBe(RELEASE_ID);
    expect(result.discogs).toMatchObject({ instanceId: 900, folderId: 1, rating: 0 });
  });
});

describe('createLibraryEntry: auto-remove from wantlist on purchase (FR-012/FR-013)', () => {
  it('attempts deleteWant only after the collection write and the repository entry succeed', async () => {
    const order: string[] = [];
    const repository = fakeRepository();
    repository.createEntry.mockImplementation(async (_uid, input) => {
      order.push('createEntry');
      return entry('new-entry', input.discogsReleaseId, {
        discogsInstanceId: input.discogsInstanceId,
        discogsFolderId: input.discogsFolderId,
      });
    });
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.addReleaseToCollection.mockImplementation(async () => {
      order.push('addReleaseToCollection');
      return { instanceId: 900, folderId: 1 };
    });
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.deleteWant.mockImplementation(async () => {
      order.push('deleteWant');
    });
    const { createLibraryEntry } = buildUseCase({
      repository,
      discogsCollection,
      discogsWantlist,
    });

    await createLibraryEntry(UID, RELEASE_ID);

    expect(order).toEqual(['addReleaseToCollection', 'createEntry', 'deleteWant']);
  });

  it('does not attempt deleteWant when the repository entry creation fails', async () => {
    const repository = fakeRepository();
    repository.createEntry.mockRejectedValue(new Error('firestore down'));
    const { createLibraryEntry, discogsWantlist } = buildUseCase({ repository });

    await expect(createLibraryEntry(UID, RELEASE_ID)).rejects.toThrow('firestore down');
    expect(discogsWantlist.deleteWant).not.toHaveBeenCalled();
  });

  it('resolves with wantlistRemoval:"removed" and logs wantlist_removed_on_purchase when the want is deleted', async () => {
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { createLibraryEntry, discogsWantlist } = buildUseCase();

    const result = await createLibraryEntry(UID, RELEASE_ID);

    expect(discogsWantlist.deleteWant).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      RELEASE_ID,
    );
    expect(result.wantlistRemoval).toBe('removed');
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'wantlist_removed_on_purchase',
        uid: UID,
        meta: { releaseId: RELEASE_ID },
      }),
    );

    infoSpy.mockRestore();
  });

  it('invalidates the wantlist cache key after a successful want removal', async () => {
    const { createLibraryEntry, cache } = buildUseCase();

    await createLibraryEntry(UID, RELEASE_ID);

    expect(cache.invalidate).toHaveBeenCalledWith(wantlistCacheKey(UID));
  });

  it('maps DiscogsNotFoundError (release was not a want) to wantlistRemoval:"not_in_wantlist" with no error surfaced', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const discogsWantlist = fakeDiscogsWantlist();
    discogsWantlist.deleteWant.mockRejectedValue(new DiscogsNotFoundError());
    const { createLibraryEntry, cache } = buildUseCase({ discogsWantlist });

    const result = await createLibraryEntry(UID, RELEASE_ID);

    expect(result.wantlistRemoval).toBe('not_in_wantlist');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'wantlist_removal_failed' }),
    );
    expect(cache.invalidate).not.toHaveBeenCalledWith(wantlistCacheKey(UID));

    warnSpy.mockRestore();
  });

  it.each([
    ['rate limit', new DiscogsRateLimitError()],
    ['unavailable', new DiscogsUnavailableError()],
    ['auth', new DiscogsAuthError()],
  ])(
    'swallows a non-404 Discogs error (%s): resolves with wantlistRemoval:"failed", logs a warning, and does not roll back the library entry',
    async (_label, err) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const repository = fakeRepository();
      const discogsWantlist = fakeDiscogsWantlist();
      discogsWantlist.deleteWant.mockRejectedValue(err);
      const { createLibraryEntry } = buildUseCase({ repository, discogsWantlist });

      const result = await createLibraryEntry(UID, RELEASE_ID);

      expect(result.entry).toMatchObject({ id: 'new-entry' });
      expect(result.wantlistRemoval).toBe('failed');
      expect(repository.deleteEntry).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'wantlist_removal_failed',
          uid: UID,
          meta: { releaseId: RELEASE_ID },
        }),
      );

      warnSpy.mockRestore();
    },
  );
});
