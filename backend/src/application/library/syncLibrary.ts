import { logger } from '../../config/logger';
import type {
  CollectionFieldMap,
  CollectionInstance,
  InstanceRef,
} from '../../domain/discogsOauth/collectionTypes';
import { mapLegacyCondition } from '../../domain/discogsOauth/conditionGrading';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import { DiscogsNotLinkedError, FieldNotEditableError } from '../../domain/library/libraryErrors';
import type { LibraryEntry } from '../../domain/library/types';
import type { CachePort } from '../../ports/cache/cachePort';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';
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

/**
 * The subset of `basic_information` facets (feature 061) worth persisting for
 * an instance — omits a key entirely when Discogs gave nothing for it, so a
 * facet-less instance produces `{}` and its entry keeps whatever it had.
 */
type CollectionFacetPatch = {
  year?: number;
  label?: string[];
  primaryArtist?: string;
  genre?: string[];
  style?: string[];
};

function nonEmpty(values: string[] | undefined): boolean {
  return Array.isArray(values) && values.length > 0;
}

function collectionFacets(
  instance: CollectionInstance,
  existing?: Pick<LibraryEntry, 'genre' | 'style'>,
): CollectionFacetPatch {
  const facets: CollectionFacetPatch = {};
  if (instance.year !== null) {
    facets.year = instance.year;
  }
  if (instance.labelNames.length > 0) {
    facets.label = instance.labelNames;
  }
  if (instance.artistNames.length > 0) {
    facets.primaryArtist = instance.artistNames[0];
  }
  // `genre`/`style` feed the Block 1 breakdowns (FR-007) and reuse the very
  // `LibraryEntry.genre`/`.style` fields feature 038's catalog enrichment
  // writes. Two guards keep the two writers coherent:
  //  - an empty `basic_information` array is never persisted (skip-empty, same
  //    rule as `year`/`label`);
  //  - a value already present on the entry is left alone — enrichment stays
  //    the authority once it has run; the sync only *backfills* never-enriched
  //    entries so the stats screen works without the enrichment path (FR-004).
  if (instance.genres.length > 0 && !nonEmpty(existing?.genre)) {
    facets.genre = instance.genres;
  }
  if (instance.styles.length > 0 && !nonEmpty(existing?.style)) {
    facets.style = instance.styles;
  }
  return facets;
}

function sameInstant(a: string, b: string): boolean {
  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();
  return Number.isNaN(timeA) || Number.isNaN(timeB) ? a === b : timeA === timeB;
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

    // feature 061 — mirror the collection facets and the real date_added onto
    // the entry so Block 1 aggregates with zero new Discogs requests (FR-010).
    const facets = collectionFacets(managed, entry);
    if (Object.keys(facets).length > 0) {
      await repository.persistCollectionFacets(uid, entry.id, facets);
    }
    if (!sameInstant(entry.addedAt, managed.dateAdded)) {
      await repository.reconcileAddedAt(uid, entry.id, new Date(managed.dateAdded));
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
      const facets = collectionFacets(managed);
      if (Object.keys(facets).length > 0) {
        await repository.persistCollectionFacets(uid, created.id, facets);
      }
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
