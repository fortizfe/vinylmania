import { logger } from '../../config/logger';
import { DiscogsNotFoundError } from '../../discogs/discogsErrors';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import { requireConnection } from './syncLibrary';

const ROUTE = 'librarySync';

export function createDeleteLibraryEntryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
}) {
  const { repository, discogsCollection, discogsConnection } = deps;

  /** Write-through remove (FR-005): Discogs instance first, then the mirror. */
  async function deleteLibraryEntry(uid: string, entryId: string): Promise<boolean | null> {
    const connection = await requireConnection(discogsConnection, uid);

    const entry = await repository.getEntry(uid, entryId);
    if (!entry) {
      return null;
    }

    if (entry.discogsInstanceId !== undefined && entry.discogsFolderId !== undefined) {
      try {
        await discogsCollection.deleteInstance(connection, {
          folderId: entry.discogsFolderId,
          releaseId: entry.discogsReleaseId,
          instanceId: entry.discogsInstanceId,
        });
      } catch (err) {
        if (!(err instanceof DiscogsNotFoundError)) {
          throw err;
        }
        // Already gone on Discogs — converge by removing the mirror entry.
      }
    }
    await repository.deleteEntry(uid, entry.id);
    logger.info({
      route: ROUTE,
      outcome: 'entry_removed',
      uid,
      meta: { entryId: entry.id },
    });
    return true;
  }

  return { deleteLibraryEntry };
}
