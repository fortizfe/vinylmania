import { logger } from '../../config/logger';
import type {
  CollectionFieldMap,
  CollectionInstance,
  InstanceRef,
} from '../../discogs/collection/collectionTypes';
import { mapLegacyCondition } from '../../discogs/collection/conditionGrading';
import type { DiscogsConnection } from '../../discogs/oauth/types';
import { DiscogsNotLinkedError, FieldNotEditableError } from '../../domain/library/libraryErrors';
import type { LibraryEntry } from '../../domain/library/types';
import type { CachePort } from '../../ports/library/cachePort';
import type { DiscogsCollectionPort } from '../../ports/library/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/library/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';

const ROUTE = 'librarySync';
const SYNC_MARKER_TTL_SECONDS = 300;

export { DiscogsNotLinkedError, FieldNotEditableError };

export async function requireConnection(
  discogsConnection: DiscogsConnectionPort,
  uid: string,
): Promise<DiscogsConnection> {
  const connection = await discogsConnection.getConnection(uid);
  if (!connection) {
    throw new DiscogsNotLinkedError();
  }
  return connection;
}

function syncMarkerKey(uid: string): string {
  return `discogs:libsync:${uid}`;
}

/** Picks the instance Vinylmania manages for a release: the oldest one (R8). */
function pickManagedInstances(
  instances: CollectionInstance[],
): Map<number, CollectionInstance> {
  const managed = new Map<number, CollectionInstance>();
  for (const instance of instances) {
    const current = managed.get(instance.releaseId);
    if (!current || instance.instanceId < current.instanceId) {
      managed.set(instance.releaseId, instance);
    }
  }
  return managed;
}

export interface SyncResult {
  skipped: boolean;
  added: number;
  removed: number;
  migrated: number;
  failures: number;
}

export function createSyncLibraryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
  cache: CachePort;
}) {
  const { repository, discogsCollection, discogsConnection, cache } = deps;

  // The throttle marker is fail-soft in both directions: without a cache
  // backend every library load syncs (correct, just more Discogs calls),
  // and a marker write failure only means the next load re-syncs.
  async function isMarkerFresh(uid: string): Promise<boolean> {
    return cache.has(syncMarkerKey(uid));
  }

  async function setMarker(uid: string): Promise<void> {
    await cache.set(syncMarkerKey(uid), new Date().toISOString(), SYNC_MARKER_TTL_SECONDS);
  }

  /**
   * Pushes an entry's pre-016 condition/notes onto its managed Discogs
   * instance without information loss (FR-010): mappable condition → media
   * condition (unless Discogs already has one), everything else → notes.
   * Throws when a write fails or a needed field is unavailable, so the caller
   * retains the legacy fields for a later retry.
   */
  async function migrateLegacyFields(
    connection: DiscogsConnection,
    ref: InstanceRef,
    existing: { mediaCondition: string | null; notes: string | null },
    entry: LibraryEntry,
    fieldMap: CollectionFieldMap,
  ): Promise<void> {
    const mapped = entry.legacyCondition ? mapLegacyCondition(entry.legacyCondition) : null;
    let conditionForNotes: string | null = null;

    if (
      mapped !== null &&
      fieldMap.mediaConditionFieldId !== null &&
      existing.mediaCondition === null
    ) {
      await discogsCollection.setFieldValue(connection, ref, fieldMap.mediaConditionFieldId, mapped);
    } else if (entry.legacyCondition) {
      // A condition that cannot be written (unmappable, field missing, or the
      // instance already graded on Discogs) is preserved verbatim in the notes.
      conditionForNotes = entry.legacyCondition;
    }

    const notesParts = [
      existing.notes,
      entry.legacyNotes,
      conditionForNotes ? `Condition: ${conditionForNotes}` : null,
    ].filter((part): part is string => Boolean(part));
    const hasNewNotes = Boolean(entry.legacyNotes || conditionForNotes);

    if (hasNewNotes) {
      if (fieldMap.notesFieldId === null) {
        throw new FieldNotEditableError('Notes');
      }
      await discogsCollection.setFieldValue(connection, ref, fieldMap.notesFieldId, notesParts.join('\n'));
    }
  }

  async function reconcileMatchedEntry(
    connection: DiscogsConnection,
    uid: string,
    entry: LibraryEntry,
    managed: CollectionInstance,
    firstSync: boolean,
    result: SyncResult,
    fieldMap: CollectionFieldMap,
  ): Promise<void> {
    if (
      entry.discogsInstanceId !== managed.instanceId ||
      entry.discogsFolderId !== managed.folderId
    ) {
      await repository.updateEntryInstance(uid, entry.id, {
        discogsInstanceId: managed.instanceId,
        discogsFolderId: managed.folderId,
      });
    }

    if (firstSync && (entry.legacyCondition || entry.legacyNotes)) {
      try {
        const ref: InstanceRef = {
          folderId: managed.folderId,
          releaseId: entry.discogsReleaseId,
          instanceId: managed.instanceId,
        };
        await migrateLegacyFields(
          connection,
          ref,
          { mediaCondition: managed.mediaCondition, notes: managed.notes },
          entry,
          fieldMap,
        );
        await repository.clearLegacyFields(uid, entry.id);
        result.migrated += 1;
      } catch (err) {
        result.failures += 1;
        logger.warn({
          route: ROUTE,
          outcome: 'migration_failed',
          uid,
          message: err instanceof Error ? err.message : 'unknown error',
          meta: { entryId: entry.id },
        });
      }
    }
  }

  async function pushEntryToDiscogs(
    connection: DiscogsConnection,
    uid: string,
    entry: LibraryEntry,
    result: SyncResult,
    fieldMap: CollectionFieldMap,
  ): Promise<void> {
    try {
      const { instanceId, folderId } = await discogsCollection.addReleaseToCollection(
        connection,
        entry.discogsReleaseId,
      );
      await repository.updateEntryInstance(uid, entry.id, {
        discogsInstanceId: instanceId,
        discogsFolderId: folderId,
      });

      if (entry.legacyCondition || entry.legacyNotes) {
        const ref: InstanceRef = {
          folderId,
          releaseId: entry.discogsReleaseId,
          instanceId,
        };
        await migrateLegacyFields(
          connection,
          ref,
          { mediaCondition: null, notes: null },
          entry,
          fieldMap,
        );
        await repository.clearLegacyFields(uid, entry.id);
        result.migrated += 1;
      }

      result.added += 1;
      logger.info({
        route: ROUTE,
        outcome: 'entry_added',
        uid,
        meta: {
          entryId: entry.id,
          releaseId: entry.discogsReleaseId,
          pushedToDiscogs: true,
        },
      });
    } catch (err) {
      result.failures += 1;
      logger.warn({
        route: ROUTE,
        outcome: 'migration_failed',
        uid,
        message: err instanceof Error ? err.message : 'unknown error',
        meta: { entryId: entry.id },
      });
    }
  }

  /**
   * Reconciles the Firestore mirror with the user's Discogs collection (R2/R3).
   * First sync (no initialLibrarySyncAt on the connection): union merge —
   * Firestore-only entries are pushed to Discogs and legacy data migrated.
   * Afterwards: Discogs is the sole source of truth for membership.
   */
  async function syncLibrary(
    uid: string,
    options: { force?: boolean } = {},
  ): Promise<SyncResult> {
    const connection = await requireConnection(discogsConnection, uid);

    if (!options.force && (await isMarkerFresh(uid))) {
      logger.info({ route: ROUTE, outcome: 'sync_skipped', uid });
      return { skipped: true, added: 0, removed: 0, migrated: 0, failures: 0 };
    }

    logger.info({ route: ROUTE, outcome: 'sync_started', uid });
    const fieldMap = await discogsCollection.getFieldMap(connection);
    const [instances, entries] = await Promise.all([
      discogsCollection.listAllInstances(connection, fieldMap),
      repository.listAllEntries(uid),
    ]);

    const managedByRelease = pickManagedInstances(instances);
    const firstSync = !connection.initialLibrarySyncAt;
    const seenReleases = new Set<number>();
    const result: SyncResult = {
      skipped: false,
      added: 0,
      removed: 0,
      migrated: 0,
      failures: 0,
    };

    for (const entry of entries) {
      const managed = managedByRelease.get(entry.discogsReleaseId);

      if (managed && !seenReleases.has(entry.discogsReleaseId)) {
        seenReleases.add(entry.discogsReleaseId);
        await reconcileMatchedEntry(
          connection,
          uid,
          entry,
          managed,
          firstSync,
          result,
          fieldMap,
        );
      } else if (firstSync && !seenReleases.has(entry.discogsReleaseId)) {
        seenReleases.add(entry.discogsReleaseId);
        await pushEntryToDiscogs(connection, uid, entry, result, fieldMap);
      } else {
        // Mirror mode: the instance is gone from Discogs (or this is a
        // duplicate entry for a release already reconciled) — remove it.
        await repository.deleteEntry(uid, entry.id);
        result.removed += 1;
        logger.info({
          route: ROUTE,
          outcome: 'entry_removed',
          uid,
          meta: { entryId: entry.id },
        });
      }
    }

    for (const [releaseId, managed] of managedByRelease) {
      if (seenReleases.has(releaseId)) {
        continue;
      }
      const created = await repository.createEntry(uid, {
        discogsReleaseId: releaseId,
        discogsInstanceId: managed.instanceId,
        discogsFolderId: managed.folderId,
        addedAt: new Date(managed.dateAdded),
      });
      result.added += 1;
      logger.info({
        route: ROUTE,
        outcome: 'entry_added',
        uid,
        meta: { entryId: created.id, releaseId },
      });
    }

    if (firstSync && result.failures === 0) {
      await discogsConnection.markInitialLibrarySync(uid);
      logger.info({
        route: ROUTE,
        outcome: 'first_sync_migrated',
        uid,
        meta: { migrated: result.migrated },
      });
    }
    if (result.failures === 0) {
      await setMarker(uid);
    }

    logger.info({ route: ROUTE, outcome: 'sync_completed', uid, meta: { ...result } });
    return result;
  }

  return { syncLibrary };
}
