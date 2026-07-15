import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import { getCopyData } from './discogsCopyData';
import type { EnrichLibraryEntryUseCase } from './enrichLibraryEntry';
import { requireConnection } from './syncLibrary';

export function createGetLibraryEntryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
  enrichLibraryEntry: EnrichLibraryEntryUseCase;
}) {
  const { repository, discogsCollection, discogsConnection, enrichLibraryEntry } = deps;

  async function getLibraryEntry(uid: string, entryId: string) {
    const connection = await requireConnection(discogsConnection, uid);

    const entry = await repository.getEntry(uid, entryId);
    if (!entry) {
      return null;
    }

    const [enriched, discogs] = await Promise.all([
      enrichLibraryEntry.enrichEntry(uid, entry),
      getCopyData(discogsCollection, connection, entry),
    ]);

    return { entry, enriched, discogs };
  }

  return { getLibraryEntry };
}
