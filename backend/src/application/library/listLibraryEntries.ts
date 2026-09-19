import { matchesLibraryFilters } from '../../domain/library/libraryFilters';
import { sortLibraryEntries } from '../../domain/library/librarySort';
import type { LibraryFilters, LibrarySort } from '../../domain/library/types';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import type { EnrichLibraryEntryUseCase } from './enrichLibraryEntry';
import type { SyncResult } from './syncLibrary';

export function createListLibraryEntriesUseCase(deps: {
  repository: LibraryRepositoryPort;
  enrichLibraryEntry: EnrichLibraryEntryUseCase;
  syncLibrary: (uid: string, options?: { force?: boolean }) => Promise<SyncResult>;
}) {
  const { repository, enrichLibraryEntry, syncLibrary } = deps;

  /**
   * One list path for every request (feature 068, FR-002): sync → full
   * per-user mirror → filter → sort → slice → enrich, so every batch shares
   * one global order.
   */
  async function listLibraryEntries(
    uid: string,
    page: number,
    pageSize: number,
    filters: LibraryFilters,
    sort: LibrarySort,
    options: { force?: boolean } = {},
  ) {
    await syncLibrary(uid, options);

    // ponytail: reads the whole per-user mirror per batch (~N reads); ceiling a few thousand records or read-quota pressure; upgrade: Redis-cached sorted id list per (uid, sort, filters) or persisted sort keys + Firestore cursors
    const all = await repository.listAllEntries(uid);
    const matched = all.filter((entry) => matchesLibraryFilters(entry, filters));
    const offset = (page - 1) * pageSize;
    const items = sortLibraryEntries(matched, sort).slice(offset, offset + pageSize);
    const enriched = await enrichLibraryEntry.enrichEntries(uid, items);

    return { enriched, page, pageSize, totalItems: matched.length };
  }

  return { listLibraryEntries };
}
