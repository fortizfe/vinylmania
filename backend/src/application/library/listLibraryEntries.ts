import { matchesLibraryFilters } from '../../domain/library/libraryFilters';
import type { LibraryFilters, PaginatedLibraryEntries } from '../../domain/library/types';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import type { EnrichLibraryEntryUseCase } from './enrichLibraryEntry';
import type { SyncResult } from './syncLibrary';

function hasActiveLibraryFilters(filters: LibraryFilters): boolean {
  return Boolean(filters.genre?.length || filters.style?.length || filters.format?.length);
}

export function createListLibraryEntriesUseCase(deps: {
  repository: LibraryRepositoryPort;
  enrichLibraryEntry: EnrichLibraryEntryUseCase;
  syncLibrary: (uid: string, options?: { force?: boolean }) => Promise<SyncResult>;
}) {
  const { repository, enrichLibraryEntry, syncLibrary } = deps;

  /**
   * Filtered/paginated library listing (feature 038, FR-017; research.md
   * Decision 2): fetches the full per-user mirror and matches/paginates in
   * application code rather than via an unsupported multi-field Firestore
   * compound query, correct at this app's "few hundred records" per-user
   * scale (spec 003) without new indexes.
   */
  async function listEntriesFiltered(
    uid: string,
    page: number,
    pageSize: number,
    filters: LibraryFilters,
  ): Promise<PaginatedLibraryEntries> {
    const all = await repository.listAllEntries(uid);
    const matched = all.filter((entry) => matchesLibraryFilters(entry, filters));

    const offset = (page - 1) * pageSize;
    return {
      items: matched.slice(offset, offset + pageSize),
      page,
      pageSize,
      totalItems: matched.length,
    };
  }

  async function listLibraryEntries(
    uid: string,
    page: number,
    pageSize: number,
    filters: LibraryFilters,
    options: { force?: boolean } = {},
  ) {
    await syncLibrary(uid, options);

    const { items, totalItems } = hasActiveLibraryFilters(filters)
      ? await listEntriesFiltered(uid, page, pageSize, filters)
      : await repository.listEntries(uid, page, pageSize);
    const enriched = await enrichLibraryEntry.enrichEntries(uid, items);

    return { enriched, page, pageSize, totalItems };
  }

  return { listLibraryEntries };
}
