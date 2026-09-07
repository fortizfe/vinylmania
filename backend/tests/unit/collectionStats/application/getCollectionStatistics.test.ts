import { createGetCollectionStatisticsUseCase } from '../../../../src/application/collectionStats/getCollectionStatistics';
import { DiscogsNotLinkedError } from '../../../../src/domain/collectionStats/statsErrors';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { LibraryEntry } from '../../../../src/domain/library/types';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../../../src/ports/library/libraryRepositoryPort';

/**
 * Feature 061, T023 (US1) — `getCollectionStatistics` use case. Fake ports
 * only; the module under test does not exist yet, so this MUST fail on first
 * run (Constitution Principle I).
 */

const UID = 'user-1';

function connection(overrides: Partial<DiscogsConnection> = {}): DiscogsConnection {
  return {
    uid: UID,
    discogsUsername: 'collector',
    discogsUserId: 9,
    accessToken: 'at',
    accessTokenSecret: 'as',
    linkedAt: '2026-07-01T00:00:00.000Z',
    initialLibrarySyncAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'e1',
    discogsReleaseId: 1,
    addedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

function fakeRepository(
  entries: LibraryEntry[] = [],
): jest.Mocked<LibraryRepositoryPort> {
  return {
    createEntry: jest.fn(),
    getEntry: jest.fn(),
    listEntries: jest.fn(),
    listAllEntries: jest.fn().mockResolvedValue(entries),
    persistCatalogFields: jest.fn(),
    persistCollectionFacets: jest.fn(),
    reconcileAddedAt: jest.fn(),
    updateEntryInstance: jest.fn(),
    clearLegacyFields: jest.fn(),
    deleteEntry: jest.fn(),
  } as unknown as jest.Mocked<LibraryRepositoryPort>;
}

function fakeConnectionPort(
  conn: DiscogsConnection | null = connection(),
): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(conn),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn(),
  } as unknown as jest.Mocked<DiscogsConnectionPort>;
}

function build(
  opts: {
    entries?: LibraryEntry[];
    connection?: DiscogsConnection | null;
  } = {},
) {
  const repository = fakeRepository(opts.entries ?? []);
  const discogsConnection = fakeConnectionPort(
    opts.connection === undefined ? connection() : opts.connection,
  );
  const syncLibrary = jest.fn().mockResolvedValue({
    skipped: false,
    added: 0,
    removed: 0,
    migrated: 0,
    failures: 0,
  });
  const { getCollectionStatistics } = createGetCollectionStatisticsUseCase({
    repository,
    syncLibrary,
    discogsConnection,
  });
  return { getCollectionStatistics, repository, discogsConnection, syncLibrary };
}

describe('getCollectionStatistics (feature 061, US1)', () => {
  it('throws DiscogsNotLinkedError when the caller has no connection', async () => {
    const { getCollectionStatistics, syncLibrary, repository } = build({
      connection: null,
    });
    await expect(getCollectionStatistics(UID)).rejects.toBeInstanceOf(
      DiscogsNotLinkedError,
    );
    expect(syncLibrary).not.toHaveBeenCalled();
    expect(repository.listAllEntries).not.toHaveBeenCalled();
  });

  it('triggers a non-forced sync by default', async () => {
    const { getCollectionStatistics, syncLibrary } = build();
    await getCollectionStatistics(UID);
    expect(syncLibrary).toHaveBeenCalledWith(UID, { force: false });
  });

  it('forces the sync when refresh is requested', async () => {
    const { getCollectionStatistics, syncLibrary } = build();
    await getCollectionStatistics(UID, { refresh: true });
    expect(syncLibrary).toHaveBeenCalledWith(UID, { force: true });
  });

  it('syncs before reading the entries', async () => {
    const calls: string[] = [];
    const { getCollectionStatistics, syncLibrary, repository } = build();
    syncLibrary.mockImplementation(async () => {
      calls.push('sync');
      return { skipped: false, added: 0, removed: 0, migrated: 0, failures: 0 };
    });
    repository.listAllEntries.mockImplementation(async () => {
      calls.push('list');
      return [];
    });
    await getCollectionStatistics(UID);
    expect(calls).toEqual(['sync', 'list']);
  });

  it('returns aggregateStatistics over every entry', async () => {
    const entries = [
      entry({ id: 'a', year: 1971, primaryArtist: 'Can', genre: ['Rock'] }),
      entry({ id: 'b', year: 1972, primaryArtist: 'Can', genre: ['Rock', 'Electronic'] }),
      entry({ id: 'c', year: undefined, primaryArtist: 'Neu!' }),
    ];
    const { getCollectionStatistics } = build({ entries });
    const stats = await getCollectionStatistics(UID);
    expect(stats.totalRecords).toBe(3);
    expect(stats.mostPresentArtist).toEqual({ name: 'Can', count: 2 });
    expect(stats.byDecade.buckets).toContainEqual({ label: '1970s', count: 2 });
    expect(stats.byDecade.buckets).toContainEqual({ label: 'Año desconocido', count: 1 });
    expect(stats.byGenre.buckets).toContainEqual({ label: 'Rock', count: 2 });
  });

  it('reads the entries for the calling uid', async () => {
    const { getCollectionStatistics, repository } = build();
    await getCollectionStatistics(UID);
    expect(repository.listAllEntries).toHaveBeenCalledWith(UID);
  });
});
