import { requireConnection } from '../library/syncLibrary';
import type { SyncResult } from '../library/syncLibrary';
import { aggregateStatistics } from '../../domain/collectionStats/aggregateStatistics';
import type { CollectionStatistics } from '../../domain/collectionStats/types';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';

/**
 * Block 1 use case for "Mi colección en cifras" (feature 061, US1,
 * `contracts/collection-stats-api.md`). Computed entirely from the
 * synchronized `LibraryEntry` mirror — no Discogs catalog or marketplace
 * request (FR-004). Depends on `ports/` only (Constitution Principle VIII):
 * the link-gate connection port, the library repository, and the injected
 * `syncLibrary` function (already composed in the library slice).
 */

export function createGetCollectionStatisticsUseCase(deps: {
  repository: LibraryRepositoryPort;
  syncLibrary: (uid: string, options?: { force?: boolean }) => Promise<SyncResult>;
  discogsConnection: DiscogsConnectionPort;
}) {
  const { repository, syncLibrary, discogsConnection } = deps;

  async function getCollectionStatistics(
    uid: string,
    options: { refresh?: boolean } = {},
  ): Promise<CollectionStatistics> {
    // Link gate first — throws DiscogsNotLinkedError before any work.
    await requireConnection(discogsConnection, uid);

    // Sync-on-read, honoring the shared `discogs:libsync:{uid}` marker unless
    // the caller forced a refresh.
    await syncLibrary(uid, { force: options.refresh === true });

    const entries = await repository.listAllEntries(uid);
    return aggregateStatistics(entries);
  }

  return { getCollectionStatistics };
}
