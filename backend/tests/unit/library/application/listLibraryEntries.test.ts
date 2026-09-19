import { createListLibraryEntriesUseCase } from '../../../../src/application/library/listLibraryEntries';
import type { EnrichLibraryEntryUseCase } from '../../../../src/application/library/enrichLibraryEntry';
import type { SyncResult } from '../../../../src/application/library/syncLibrary';
import type {
  EnrichedLibraryEntry,
  LibraryEntry,
  LibraryFilters,
  LibrarySort,
} from '../../../../src/domain/library/types';
import type { LibraryRepositoryPort } from '../../../../src/ports/library/libraryRepositoryPort';

/**
 * Feature 068, T007 — one list path for every request (research D3, FR-002,
 * SC-007): sync → listAllEntries → filter → sort → slice → enrich.
 * The repository double has no `listEntries`: the use case must not need it.
 */

const UID = 'user-1';
const NO_FILTERS: LibraryFilters = {};
const ARTIST_ASC: LibrarySort = { criterion: 'artist', direction: 'asc' };
const ADDED_DESC: LibrarySort = { criterion: 'added', direction: 'desc' };

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id, discogsReleaseId: 1, addedAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

const MIRROR: LibraryEntry[] = [
  entry('slayer', {
    primaryArtist: 'Slayer',
    genre: ['Rock'],
    addedAt: '2021-01-01T00:00:00.000Z',
  }),
  entry('miles', {
    primaryArtist: 'Miles Davis',
    genre: ['Jazz'],
    addedAt: '2026-03-01T00:00:00.000Z',
  }),
  entry('clash', {
    primaryArtist: 'The Clash',
    genre: ['Rock'],
    addedAt: '2024-01-01T00:00:00.000Z',
  }),
  entry('no-artist', { genre: ['Rock'], addedAt: '2026-02-01T00:00:00.000Z' }),
  entry('abba', {
    primaryArtist: 'ABBA',
    genre: ['Pop'],
    addedAt: '2022-01-01T00:00:00.000Z',
  }),
  entry('anthrax', {
    primaryArtist: 'Anthrax',
    genre: ['Rock'],
    addedAt: '2020-01-01T00:00:00.000Z',
  }),
  entry('bjork', {
    primaryArtist: 'Björk',
    genre: ['Rock'],
    addedAt: '2023-01-01T00:00:00.000Z',
  }),
];

function inMemoryRepository(entries: LibraryEntry[]): jest.Mocked<LibraryRepositoryPort> {
  return {
    createEntry: jest.fn(),
    getEntry: jest.fn(),
    listAllEntries: jest.fn().mockImplementation(async () => [...entries]),
    persistCatalogFields: jest.fn(),
    persistCollectionFacets: jest.fn(),
    reconcileAddedAt: jest.fn(),
    updateEntryInstance: jest.fn(),
    clearLegacyFields: jest.fn(),
    deleteEntry: jest.fn(),
  };
}

function build(entries: LibraryEntry[] = MIRROR) {
  const repository = inMemoryRepository(entries);
  const enrichLibraryEntry: jest.Mocked<EnrichLibraryEntryUseCase> = {
    enrichEntry: jest.fn(),
    enrichEntries: jest.fn().mockImplementation(async (_uid, items: LibraryEntry[]) =>
      items.map((item): EnrichedLibraryEntry => ({
        ...item,
        catalogStatus: 'ok',
        release: null,
        discogs: null,
      })),
    ),
  };
  const syncResult: SyncResult = {
    skipped: true,
    added: 0,
    removed: 0,
    migrated: 0,
    failures: 0,
  };
  const syncLibrary = jest.fn().mockResolvedValue(syncResult);
  const { listLibraryEntries } = createListLibraryEntriesUseCase({
    repository,
    enrichLibraryEntry,
    syncLibrary,
  });
  return { listLibraryEntries, repository, enrichLibraryEntry, syncLibrary };
}

describe('listLibraryEntries: single list path (feature 068, FR-002)', () => {
  it('reads the mirror with listAllEntries exactly once per call, with or without filters', async () => {
    const { listLibraryEntries, repository } = build();

    await listLibraryEntries(UID, 1, 2, NO_FILTERS, ADDED_DESC);
    expect(repository.listAllEntries).toHaveBeenCalledTimes(1);
    expect(repository.listAllEntries).toHaveBeenCalledWith(UID);

    await listLibraryEntries(UID, 1, 2, { genre: ['Rock'] }, ARTIST_ASC);
    expect(repository.listAllEntries).toHaveBeenCalledTimes(2);
  });

  it('with no filters, sorts the whole mirror before slicing the page', async () => {
    const { listLibraryEntries } = build();

    const result = await listLibraryEntries(UID, 1, 3, NO_FILTERS, ARTIST_ASC);

    expect(result.enriched.map((e) => e.id)).toEqual(['abba', 'anthrax', 'bjork']);
    expect(result).toMatchObject({ page: 1, pageSize: 3, totalItems: MIRROR.length });
  });

  it('filters first, then sorts, then slices; totalItems is the filtered count', async () => {
    const { listLibraryEntries } = build();

    const page2 = await listLibraryEntries(UID, 2, 2, { genre: ['Rock'] }, ARTIST_ASC);

    // Rock, artist asc: anthrax, bjork, clash ("The Clash" under C), slayer, no-artist (last).
    expect(page2.enriched.map((e) => e.id)).toEqual(['clash', 'slayer']);
    expect(page2.totalItems).toBe(5);
  });

  it('pages 1..ceil(total/pageSize) concatenate to the full ordered set, without duplicates or gaps', async () => {
    const { listLibraryEntries } = build();
    const pageSize = 2;

    const first = await listLibraryEntries(UID, 1, pageSize, NO_FILTERS, ADDED_DESC);
    const pages = Math.ceil(first.totalItems / pageSize);
    const all = [...first.enriched];
    for (let page = 2; page <= pages; page += 1) {
      const next = await listLibraryEntries(UID, page, pageSize, NO_FILTERS, ADDED_DESC);
      all.push(...next.enriched);
    }

    expect(all.map((e) => e.id)).toEqual([
      'miles',
      'no-artist',
      'clash',
      'bjork',
      'abba',
      'slayer',
      'anthrax',
    ]);
  });

  it('still syncs first (passing options through) and enriches only the page items', async () => {
    const { listLibraryEntries, syncLibrary, enrichLibraryEntry, repository } = build();

    await listLibraryEntries(UID, 1, 2, NO_FILTERS, ADDED_DESC, { force: true });

    expect(syncLibrary).toHaveBeenCalledWith(UID, { force: true });
    expect(syncLibrary.mock.invocationCallOrder[0]).toBeLessThan(
      repository.listAllEntries.mock.invocationCallOrder[0],
    );
    expect(enrichLibraryEntry.enrichEntries).toHaveBeenCalledTimes(1);
    expect(
      enrichLibraryEntry.enrichEntries.mock.calls[0][1].map((e: LibraryEntry) => e.id),
    ).toEqual(['miles', 'no-artist']);
  });
});
