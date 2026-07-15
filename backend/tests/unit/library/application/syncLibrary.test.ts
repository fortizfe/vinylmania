import type { CollectionInstance } from '../../../../src/discogs/collection/collectionTypes';
import type { DiscogsConnection } from '../../../../src/discogs/oauth/types';
import type { LibraryEntry } from '../../../../src/domain/library/types';
import { DiscogsNotLinkedError } from '../../../../src/domain/library/libraryErrors';
import { DiscogsUnavailableError } from '../../../../src/discogs/discogsErrors';
import { createSyncLibraryUseCase } from '../../../../src/application/library/syncLibrary';
import type { LibraryRepositoryPort } from '../../../../src/ports/library/libraryRepositoryPort';
import type { DiscogsCollectionPort } from '../../../../src/ports/library/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../../../src/ports/library/discogsConnectionPort';
import type { CachePort } from '../../../../src/ports/cache/cachePort';

const UID = 'user-1';

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

function instance(
  releaseId: number,
  overrides: Partial<CollectionInstance> = {},
): CollectionInstance {
  return {
    releaseId,
    instanceId: releaseId * 10,
    folderId: 1,
    rating: 0,
    mediaCondition: null,
    sleeveCondition: null,
    notes: null,
    dateAdded: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function entry(
  id: string,
  releaseId: number,
  overrides: Partial<LibraryEntry> = {},
): LibraryEntry {
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
    getConnection: jest.fn().mockResolvedValue(connection()),
    markInitialLibrarySync: jest.fn().mockResolvedValue(undefined),
  };
}

// Fail-soft, always-miss cache — mirrors the original test's
// `jest.mock('cache/redisClient', () => ({ getRedisClient: () => null }))`,
// which made every sync run in full (never skipped as "fresh").
function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
  };
}

function buildUseCase(overrides: {
  repository?: jest.Mocked<LibraryRepositoryPort>;
  discogsCollection?: jest.Mocked<DiscogsCollectionPort>;
  discogsConnection?: jest.Mocked<DiscogsConnectionPort>;
  cache?: jest.Mocked<CachePort>;
} = {}) {
  const repository = overrides.repository ?? fakeRepository();
  const discogsCollection = overrides.discogsCollection ?? fakeDiscogsCollection();
  const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
  const cache = overrides.cache ?? fakeCache();
  const { syncLibrary } = createSyncLibraryUseCase({
    repository,
    discogsCollection,
    discogsConnection,
    cache,
  });
  return { syncLibrary, repository, discogsCollection, discogsConnection, cache };
}

describe('syncLibrary: gating', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);
    const { syncLibrary, discogsCollection } = buildUseCase({ discogsConnection });

    await expect(syncLibrary(UID)).rejects.toBeInstanceOf(DiscogsNotLinkedError);
    expect(discogsCollection.listAllInstances).not.toHaveBeenCalled();
  });

  it('propagates a collection listing failure without touching the mirror', async () => {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockRejectedValue(new DiscogsUnavailableError());
    const { syncLibrary, repository } = buildUseCase({ discogsCollection });

    await expect(syncLibrary(UID)).rejects.toBeInstanceOf(DiscogsUnavailableError);
    expect(repository.createEntry).not.toHaveBeenCalled();
    expect(repository.deleteEntry).not.toHaveBeenCalled();
  });
});

describe('syncLibrary: first-sync mode (no initialLibrarySyncAt)', () => {
  it('pushes Firestore-only entries to Discogs and records the returned instance', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([entry('e1', 55)]);
    const { syncLibrary, discogsCollection, discogsConnection } = buildUseCase({ repository });

    const result = await syncLibrary(UID);

    expect(discogsCollection.addReleaseToCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      55,
    );
    expect(repository.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 900,
      discogsFolderId: 1,
    });
    expect(repository.deleteEntry).not.toHaveBeenCalled();
    expect(result.failures).toBe(0);
    expect(discogsConnection.markInitialLibrarySync).toHaveBeenCalledWith(UID);
  });

  it('migrates legacy notes and a mappable condition, then clears the legacy fields', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyCondition: 'Near Mint', legacyNotes: 'Bought at a fair' }),
    ]);
    const { syncLibrary, discogsCollection } = buildUseCase({ repository });

    await syncLibrary(UID);

    // Condition mapped onto the Media Condition field (id 1) of the new instance.
    expect(discogsCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 1, releaseId: 55, instanceId: 900 },
      1,
      'Near Mint (NM or M-)',
    );
    // Notes onto the Notes field (id 3).
    expect(discogsCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 1, releaseId: 55, instanceId: 900 },
      3,
      'Bought at a fair',
    );
    expect(repository.clearLegacyFields).toHaveBeenCalledWith(UID, 'e1');
  });

  it('preserves an unmappable condition verbatim inside the migrated notes', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, {
        legacyCondition: 'Sleeve torn but plays fine',
        legacyNotes: 'My note',
      }),
    ]);
    const { syncLibrary, discogsCollection } = buildUseCase({ repository });

    await syncLibrary(UID);

    const notesWrites = discogsCollection.setFieldValue.mock.calls.filter(
      ([, , fieldId]) => fieldId === 3,
    );
    expect(notesWrites).toHaveLength(1);
    expect(notesWrites[0][3]).toContain('My note');
    expect(notesWrites[0][3]).toContain('Condition: Sleeve torn but plays fine');
    // No media-condition write for an unmappable value.
    expect(
      discogsCollection.setFieldValue.mock.calls.some(([, , fieldId]) => fieldId === 1),
    ).toBe(false);
    expect(repository.clearLegacyFields).toHaveBeenCalledWith(UID, 'e1');
  });

  it('migrates legacy data onto an existing matching instance without re-adding it', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyNotes: 'Keep me' }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 12, folderId: 4 }),
    ]);
    const { syncLibrary } = buildUseCase({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(discogsCollection.addReleaseToCollection).not.toHaveBeenCalled();
    expect(discogsCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 4, releaseId: 55, instanceId: 12 },
      3,
      'Keep me',
    );
    expect(repository.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 12,
      discogsFolderId: 4,
    });
  });

  it('keeps legacy fields and does not set the flag when a per-entry write fails', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyNotes: 'precious' }),
      entry('e2', 66),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.addReleaseToCollection
      .mockRejectedValueOnce(new DiscogsUnavailableError())
      .mockResolvedValueOnce({ instanceId: 901, folderId: 1 });
    const { syncLibrary, discogsConnection } = buildUseCase({ repository, discogsCollection });

    const result = await syncLibrary(UID);

    expect(result.failures).toBe(1);
    expect(repository.clearLegacyFields).not.toHaveBeenCalledWith(UID, 'e1');
    expect(discogsConnection.markInitialLibrarySync).not.toHaveBeenCalled();
    // The healthy entry still completed.
    expect(repository.updateEntryInstance).toHaveBeenCalledWith(UID, 'e2', {
      discogsInstanceId: 901,
      discogsFolderId: 1,
    });
  });

  it('does not clear legacy fields when the migration write itself fails', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyNotes: 'precious' }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([instance(55, { instanceId: 12 })]);
    discogsCollection.setFieldValue.mockRejectedValue(new DiscogsUnavailableError());
    const { syncLibrary, discogsConnection } = buildUseCase({ repository, discogsCollection });

    const result = await syncLibrary(UID);

    expect(result.failures).toBe(1);
    expect(repository.clearLegacyFields).not.toHaveBeenCalled();
    expect(discogsConnection.markInitialLibrarySync).not.toHaveBeenCalled();
  });
});

describe('syncLibrary: mirror mode (initialLibrarySyncAt set)', () => {
  function buildMirrorUseCase(overrides: Parameters<typeof buildUseCase>[0] = {}) {
    const discogsConnection = overrides.discogsConnection ?? fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(
      connection({ initialLibrarySyncAt: '2026-07-02T00:00:00.000Z' }),
    );
    return buildUseCase({ ...overrides, discogsConnection });
  }

  it('creates entries for Discogs-only instances using their date_added', async () => {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(77, { instanceId: 71, dateAdded: '2026-03-04T05:06:07.000Z' }),
    ]);
    const { syncLibrary, repository } = buildMirrorUseCase({ discogsCollection });

    await syncLibrary(UID);

    expect(repository.createEntry).toHaveBeenCalledWith(UID, {
      discogsReleaseId: 77,
      discogsInstanceId: 71,
      discogsFolderId: 1,
      addedAt: new Date('2026-03-04T05:06:07.000Z'),
    });
  });

  it('deletes Firestore-only entries instead of re-adding them to Discogs', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);
    const { syncLibrary, discogsCollection } = buildMirrorUseCase({ repository });

    await syncLibrary(UID);

    expect(discogsCollection.addReleaseToCollection).not.toHaveBeenCalled();
    expect(repository.deleteEntry).toHaveBeenCalledWith(UID, 'e1');
  });

  it('manages the lowest instance_id when a release has several instances', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 300 }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 300, folderId: 2 }),
      instance(55, { instanceId: 12, folderId: 4 }),
    ]);
    const { syncLibrary } = buildMirrorUseCase({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 12,
      discogsFolderId: 4,
    });
    expect(repository.deleteEntry).not.toHaveBeenCalled();
  });

  it('leaves an in-sync mirror untouched and never re-marks the first sync', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([instance(55, { instanceId: 550 })]);
    const { syncLibrary, discogsConnection } = buildMirrorUseCase({
      repository,
      discogsCollection,
    });

    const result = await syncLibrary(UID);

    expect(repository.createEntry).not.toHaveBeenCalled();
    expect(repository.deleteEntry).not.toHaveBeenCalled();
    expect(repository.updateEntryInstance).not.toHaveBeenCalled();
    expect(discogsConnection.markInitialLibrarySync).not.toHaveBeenCalled();
    expect(result).toMatchObject({ added: 0, removed: 0, failures: 0 });
  });
});
