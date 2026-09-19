import { createSyncLibraryUseCase } from '../../../src/application/library/syncLibrary';
import type { CollectionInstance } from '../../../src/domain/discogsOauth/collectionTypes';
import type { DiscogsConnection } from '../../../src/domain/discogsOauth/types';
import type { LibraryEntry } from '../../../src/domain/library/types';
import type { CachePort } from '../../../src/ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../../src/ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../../src/ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../../src/ports/library/libraryRepositoryPort';

/**
 * Feature 061, T013 — `syncLibrary` write-back of the collection facets
 * (`year` / `label` / `primaryArtist`) and the `addedAt` reconciliation
 * (data-model §1, FR-010). Sibling of `application/syncLibrary.test.ts`;
 * kept separate so the facet rules are one focused file.
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
    title: `Release ${releaseId}`,
    year: 1985,
    labelNames: ['Roadrunner Records'],
    artistNames: ['Sepultura'],
    genres: ['Rock'],
    styles: ['Thrash'],
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
    addedAt: '2026-01-02T00:00:00.000Z',
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
    listAllEntries: jest.fn().mockResolvedValue([]),
    persistCatalogFields: jest.fn().mockResolvedValue(undefined),
    persistCollectionFacets: jest.fn().mockResolvedValue(undefined),
    reconcileAddedAt: jest.fn().mockResolvedValue(undefined),
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

function fakeCache(): jest.Mocked<CachePort> {
  return {
    has: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    withCache: jest.fn().mockImplementation((_key, _ttl, fetcher) => fetcher()),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

function build(overrides: {
  repository?: jest.Mocked<LibraryRepositoryPort>;
  discogsCollection?: jest.Mocked<DiscogsCollectionPort>;
} = {}) {
  const repository = overrides.repository ?? fakeRepository();
  const discogsCollection = overrides.discogsCollection ?? fakeDiscogsCollection();
  const { syncLibrary } = createSyncLibraryUseCase({
    repository,
    discogsCollection,
    discogsConnection: fakeDiscogsConnection(),
    cache: fakeCache(),
  });
  return { syncLibrary, repository, discogsCollection };
}

describe('syncLibrary: collection-facet write-back (feature 061)', () => {
  it('persists year/label/primaryArtist/genre/style on a matched entry from the instance basic_information', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, {
        instanceId: 550,
        year: 1991,
        labelNames: ['Earache', 'Combat'],
        artistNames: ['Morbid Angel', 'Guest'],
        genres: ['Death Metal'],
        styles: ['Death Metal', 'Grindcore'],
      }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'e1', {
      year: 1991,
      label: ['Earache', 'Combat'],
      primaryArtist: 'Morbid Angel',
      title: 'Release 55',
      genre: ['Death Metal'],
      style: ['Death Metal', 'Grindcore'],
    });
  });

  it('persists facets on a newly created (Discogs-only) entry', async () => {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(77, {
        instanceId: 71,
        year: 2001,
        labelNames: ['Nuclear Blast'],
        artistNames: ['Nile'],
        genres: ['Rock'],
        styles: ['Death Metal'],
      }),
    ]);
    const { syncLibrary, repository } = build({ discogsCollection });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'new-entry', {
      year: 2001,
      label: ['Nuclear Blast'],
      primaryArtist: 'Nile',
      title: 'Release 77',
      genre: ['Rock'],
      style: ['Death Metal'],
    });
  });

  it('does not overwrite a genre/style already persisted by catalog enrichment', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, {
        discogsInstanceId: 550,
        discogsFolderId: 1,
        genre: ['Electronic'],
        style: ['Deep House'],
      }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, {
        instanceId: 550,
        year: 1991,
        labelNames: ['Warp'],
        artistNames: ['Aphex Twin'],
        genres: ['Rock'],
        styles: ['Heavy Metal'],
      }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    // year/label/primaryArtist still mirrored; genre/style deferred to enrichment.
    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'e1', {
      year: 1991,
      label: ['Warp'],
      primaryArtist: 'Aphex Twin',
      title: 'Release 55',
    });
  });

  it('persists a populated genre/style facet but omits an empty one (no clobber of prior enrichment)', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, {
        instanceId: 550,
        year: null,
        labelNames: [],
        artistNames: [],
        genres: ['Jazz'],
        styles: [],
      }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'e1', {
      title: 'Release 55',
      genre: ['Jazz'],
    });
  });

  it('reconciles addedAt to new Date(instance.dateAdded) when it differs', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, {
        discogsInstanceId: 550,
        discogsFolderId: 1,
        addedAt: '2020-01-01T00:00:00.000Z',
      }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 550, dateAdded: '2019-05-06T07:08:09.000Z' }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.reconcileAddedAt).toHaveBeenCalledWith(
      UID,
      'e1',
      new Date('2019-05-06T07:08:09.000Z'),
    );
  });

  it('does not reconcile addedAt when it already matches the instance date_added', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, {
        discogsInstanceId: 550,
        discogsFolderId: 1,
        addedAt: '2026-01-02T00:00:00.000Z',
      }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 550, dateAdded: '2026-01-02T00:00:00.000Z' }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.reconcileAddedAt).not.toHaveBeenCalled();
  });

  it('leaves prior values untouched for a facet-less instance (no persist call)', async () => {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, {
        instanceId: 550,
        title: '',
        year: null,
        labelNames: [],
        artistNames: [],
        genres: [],
        styles: [],
      }),
    ]);
    const { syncLibrary } = build({ repository, discogsCollection });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).not.toHaveBeenCalled();
  });
});

describe('syncLibrary: album title write-back (feature 068, research D4)', () => {
  function matched() {
    const repository = fakeRepository();
    repository.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1, title: 'Stored Title' }),
    ]);
    return repository;
  }

  function collectionWith(title: string) {
    const discogsCollection = fakeDiscogsCollection();
    discogsCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 550, title, year: null, labelNames: [], genres: [], styles: [] }),
    ]);
    return discogsCollection;
  }

  it('passes a non-empty basic_information.title to persistCollectionFacets for a matched entry', async () => {
    const { syncLibrary, repository } = build({
      repository: matched(),
      discogsCollection: collectionWith('Reign in Blood'),
    });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'e1', {
      primaryArtist: 'Sepultura',
      title: 'Reign in Blood',
    });
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('omits an %s title for a matched entry, so the stored value is never overwritten', async (_name, title) => {
    const { syncLibrary, repository } = build({
      repository: matched(),
      discogsCollection: collectionWith(title),
    });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'e1', {
      primaryArtist: 'Sepultura',
    });
  });

  it('passes a non-empty title for a newly created (Discogs-only) entry', async () => {
    const { syncLibrary, repository } = build({
      discogsCollection: collectionWith('Beneath the Remains'),
    });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'new-entry', {
      primaryArtist: 'Sepultura',
      title: 'Beneath the Remains',
    });
  });

  it('omits a whitespace-only title for a newly created entry', async () => {
    const { syncLibrary, repository } = build({ discogsCollection: collectionWith('  ') });

    await syncLibrary(UID);

    expect(repository.persistCollectionFacets).toHaveBeenCalledWith(UID, 'new-entry', {
      primaryArtist: 'Sepultura',
    });
  });
});
