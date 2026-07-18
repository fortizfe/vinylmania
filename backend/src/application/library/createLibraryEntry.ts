import { logger } from '../../config/logger';
import { getRelease } from '../../adapters/discogsCatalog/discogsCatalogAdapter';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import type { Release } from '../../domain/discogsCatalog/types';
import type { EntryDiscogsData, LibraryEntry } from '../../domain/library/types';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import { requireConnection } from './syncLibrary';

const ROUTE = 'librarySync';

/**
 * The catalog lookup that gates entry creation failed. Thrown only for that
 * step, so the driving adapter can map it to `release_not_found` distinctly
 * from a `DiscogsNotFoundError` raised later (e.g. by the Discogs collection
 * write itself), which falls through to the generic collection-error mapping
 * instead — preserving the route's pre-migration two-tier error handling.
 */
export class ReleaseNotFoundForCreationError extends Error {
  constructor(public readonly cause: DiscogsNotFoundError) {
    super(cause.message);
    this.name = 'ReleaseNotFoundForCreationError';
  }
}

/** Same rationale as {@link ReleaseNotFoundForCreationError}, for `catalog_unavailable`. */
export class CatalogUnavailableForCreationError extends Error {
  constructor(public readonly cause: DiscogsRateLimitError | DiscogsUnavailableError) {
    super(cause.message);
    this.name = 'CatalogUnavailableForCreationError';
  }
}

export interface CreateLibraryEntryResult {
  entry: LibraryEntry;
  release: Release;
  discogs: EntryDiscogsData;
}

export function createCreateLibraryEntryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
}) {
  const { repository, discogsCollection, discogsConnection } = deps;

  async function createLibraryEntry(
    uid: string,
    discogsReleaseId: number,
  ): Promise<CreateLibraryEntryResult> {
    const connection = await requireConnection(discogsConnection, uid);

    // Catalog lookup first: keeps release_not_found/catalog_unavailable
    // semantics and never adds unknown releases to the user's collection.
    let release: Release;
    try {
      release = await getRelease({ type: 'vinylmania' }, discogsReleaseId);
    } catch (err) {
      if (err instanceof DiscogsNotFoundError) {
        throw new ReleaseNotFoundForCreationError(err);
      }
      if (err instanceof DiscogsRateLimitError || err instanceof DiscogsUnavailableError) {
        throw new CatalogUnavailableForCreationError(err);
      }
      throw err;
    }

    const { instanceId, folderId } = await discogsCollection.addReleaseToCollection(
      connection,
      discogsReleaseId,
    );
    const entry = await repository.createEntry(uid, {
      discogsReleaseId,
      discogsInstanceId: instanceId,
      discogsFolderId: folderId,
    });
    logger.info({
      route: ROUTE,
      outcome: 'entry_added',
      uid,
      meta: { entryId: entry.id, releaseId: discogsReleaseId, pushedToDiscogs: true },
    });

    const fieldMap = await discogsCollection.getFieldMap(connection);
    const discogs: EntryDiscogsData = {
      instanceId: entry.discogsInstanceId!,
      folderId: entry.discogsFolderId!,
      rating: 0,
      mediaCondition: null,
      sleeveCondition: null,
      notes: null,
      editable: {
        mediaCondition: fieldMap.mediaConditionFieldId !== null,
        sleeveCondition: fieldMap.sleeveConditionFieldId !== null,
        notes: fieldMap.notesFieldId !== null,
      },
    };

    return { entry, release, discogs };
  }

  return { createLibraryEntry };
}
