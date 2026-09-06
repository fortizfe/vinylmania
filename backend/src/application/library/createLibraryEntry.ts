import { logger } from '../../config/logger';
import { getRelease } from '../../adapters/discogsCatalog/discogsCatalogAdapter';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import type { Release } from '../../domain/discogsCatalog/types';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import type {
  EntryDiscogsData,
  LibraryEntry,
  WantlistRemovalOutcome,
} from '../../domain/library/types';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
import type { DiscogsWantlistPort } from '../../ports/discogsOauth/discogsWantlistPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import { wantlistCacheKey } from '../wantlist/listWantlist';
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
  /**
   * Outcome of the best-effort wantlist removal (FR-012/FR-013). Always
   * computed for a linked user's add; optional so the field can be absent
   * from serialized responses when no removal was attempted.
   */
  wantlistRemoval?: WantlistRemovalOutcome;
}

export function createCreateLibraryEntryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
  discogsWantlist: DiscogsWantlistPort;
  cache: CachePort;
}) {
  const { repository, discogsCollection, discogsConnection, discogsWantlist, cache } = deps;

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

    // Best-effort wantlist cleanup, only once the collection write and the
    // Firestore entry are confirmed (FR-012). A failure here is surfaced as a
    // flag but never rolls back the add or fails the request (FR-013).
    const wantlistRemoval = await removeFromWantlist(uid, connection, discogsReleaseId);

    return { entry, release, discogs, wantlistRemoval };
  }

  /**
   * Attempts `DELETE /wants/{releaseId}` as a secondary cleanup. A 404 means
   * the release was never a want (benign); any other Discogs error is
   * swallowed with a warn log — the library add has already succeeded
   * (research.md Decision 5).
   */
  async function removeFromWantlist(
    ownerUid: string,
    connection: DiscogsConnection,
    releaseId: number,
  ): Promise<WantlistRemovalOutcome> {
    try {
      await discogsWantlist.deleteWant(connection, releaseId);
    } catch (err) {
      if (err instanceof DiscogsNotFoundError) {
        return 'not_in_wantlist';
      }
      logger.warn({
        route: ROUTE,
        outcome: 'wantlist_removal_failed',
        uid: ownerUid,
        meta: { releaseId },
      });
      return 'failed';
    }

    // Keep `/api/wantlist`'s cached projection in step with the removal, the
    // same way every explicit wantlist write busts the key (research Decision 2).
    await cache.invalidate(wantlistCacheKey(ownerUid));
    logger.info({
      route: ROUTE,
      outcome: 'wantlist_removed_on_purchase',
      uid: ownerUid,
      meta: { releaseId },
    });
    return 'removed';
  }

  return { createLibraryEntry };
}
