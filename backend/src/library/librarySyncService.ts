import { getRedisClient } from '../cache/redisClient';
import { logger } from '../config/logger';
import {
  addReleaseToCollection,
  deleteInstance,
  getFieldMap,
  getInstancesForRelease,
  listAllInstances,
  setFieldValue,
  setRating,
} from '../discogs/collection/collectionClient';
import type {
  CollectionFieldMap,
  CollectionInstance,
  InstanceRef,
} from '../discogs/collection/collectionTypes';
import { mapLegacyCondition } from '../discogs/collection/conditionGrading';
import { DiscogsNotFoundError } from '../discogs/discogsErrors';
import { getConnection, markInitialLibrarySync } from '../discogs/oauth/discogsOauthService';
import type { DiscogsConnection } from '../discogs/oauth/types';
import * as libraryService from './libraryService';
import type { EntryDiscogsData, LibraryEntry } from './types';

const ROUTE = 'librarySync';
const SYNC_MARKER_TTL_SECONDS = 300;

/** The user has no Discogs connection — the library is gated (FR-003). */
export class DiscogsNotLinkedError extends Error {
  constructor() {
    super('No Discogs account is linked to this user.');
    this.name = 'DiscogsNotLinkedError';
  }
}

/** The targeted Discogs custom field was deleted by the user on discogs.com. */
export class FieldNotEditableError extends Error {
  constructor(field: string) {
    super(`The Discogs "${field}" field is not available on this collection.`);
    this.name = 'FieldNotEditableError';
  }
}

export async function requireConnection(uid: string): Promise<DiscogsConnection> {
  const connection = await getConnection(uid);
  if (!connection) {
    throw new DiscogsNotLinkedError();
  }
  return connection;
}

function syncMarkerKey(uid: string): string {
  return `discogs:libsync:${uid}`;
}

// The throttle marker is fail-soft in both directions: without Redis every
// library load syncs (correct, just more Discogs calls), and a marker write
// failure only means the next load re-syncs.
async function isMarkerFresh(uid: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    return (await client.get(syncMarkerKey(uid))) !== null;
  } catch {
    return false;
  }
}

async function setMarker(uid: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.set(syncMarkerKey(uid), new Date().toISOString(), 'EX', SYNC_MARKER_TTL_SECONDS);
  } catch {
    // Fail-soft: the next load simply syncs again.
  }
}

/** Picks the instance Vinylmania manages for a release: the oldest one (R8). */
function pickManagedInstances(instances: CollectionInstance[]): Map<number, CollectionInstance> {
  const managed = new Map<number, CollectionInstance>();
  for (const instance of instances) {
    const current = managed.get(instance.releaseId);
    if (!current || instance.instanceId < current.instanceId) {
      managed.set(instance.releaseId, instance);
    }
  }
  return managed;
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

  if (mapped !== null && fieldMap.mediaConditionFieldId !== null && existing.mediaCondition === null) {
    await setFieldValue(connection, ref, fieldMap.mediaConditionFieldId, mapped);
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
    await setFieldValue(connection, ref, fieldMap.notesFieldId, notesParts.join('\n'));
  }
}

export interface SyncResult {
  skipped: boolean;
  added: number;
  removed: number;
  migrated: number;
  failures: number;
}

/**
 * Reconciles the Firestore mirror with the user's Discogs collection (R2/R3).
 * First sync (no initialLibrarySyncAt on the connection): union merge —
 * Firestore-only entries are pushed to Discogs and legacy data migrated.
 * Afterwards: Discogs is the sole source of truth for membership.
 */
export async function syncLibrary(
  uid: string,
  options: { force?: boolean } = {},
): Promise<SyncResult> {
  const connection = await requireConnection(uid);

  if (!options.force && (await isMarkerFresh(uid))) {
    logger.info({ route: ROUTE, outcome: 'sync_skipped', uid });
    return { skipped: true, added: 0, removed: 0, migrated: 0, failures: 0 };
  }

  logger.info({ route: ROUTE, outcome: 'sync_started', uid });
  const fieldMap = await getFieldMap(connection);
  const [instances, entries] = await Promise.all([
    listAllInstances(connection, fieldMap),
    libraryService.listAllEntries(uid),
  ]);

  const managedByRelease = pickManagedInstances(instances);
  const firstSync = !connection.initialLibrarySyncAt;
  const seenReleases = new Set<number>();
  const result: SyncResult = { skipped: false, added: 0, removed: 0, migrated: 0, failures: 0 };

  for (const entry of entries) {
    const managed = managedByRelease.get(entry.discogsReleaseId);

    if (managed && !seenReleases.has(entry.discogsReleaseId)) {
      seenReleases.add(entry.discogsReleaseId);
      await reconcileMatchedEntry(connection, uid, entry, managed, firstSync, result, fieldMap);
    } else if (firstSync && !seenReleases.has(entry.discogsReleaseId)) {
      seenReleases.add(entry.discogsReleaseId);
      await pushEntryToDiscogs(connection, uid, entry, result, fieldMap);
    } else {
      // Mirror mode: the instance is gone from Discogs (or this is a
      // duplicate entry for a release already reconciled) — remove it.
      await libraryService.deleteEntry(uid, entry.id);
      result.removed += 1;
      logger.info({ route: ROUTE, outcome: 'entry_removed', uid, meta: { entryId: entry.id } });
    }
  }

  for (const [releaseId, managed] of managedByRelease) {
    if (seenReleases.has(releaseId)) {
      continue;
    }
    const created = await libraryService.createEntry(uid, {
      discogsReleaseId: releaseId,
      discogsInstanceId: managed.instanceId,
      discogsFolderId: managed.folderId,
      addedAt: new Date(managed.dateAdded),
    });
    result.added += 1;
    logger.info({ route: ROUTE, outcome: 'entry_added', uid, meta: { entryId: created.id, releaseId } });
  }

  if (firstSync && result.failures === 0) {
    await markInitialLibrarySync(uid);
    logger.info({ route: ROUTE, outcome: 'first_sync_migrated', uid, meta: { migrated: result.migrated } });
  }
  if (result.failures === 0) {
    await setMarker(uid);
  }

  logger.info({ route: ROUTE, outcome: 'sync_completed', uid, meta: { ...result } });
  return result;
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
    await libraryService.updateEntryInstance(uid, entry.id, {
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
      await libraryService.clearLegacyFields(uid, entry.id);
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
    const { instanceId, folderId } = await addReleaseToCollection(
      connection,
      entry.discogsReleaseId,
    );
    await libraryService.updateEntryInstance(uid, entry.id, {
      discogsInstanceId: instanceId,
      discogsFolderId: folderId,
    });

    if (entry.legacyCondition || entry.legacyNotes) {
      const ref: InstanceRef = { folderId, releaseId: entry.discogsReleaseId, instanceId };
      await migrateLegacyFields(connection, ref, { mediaCondition: null, notes: null }, entry, fieldMap);
      await libraryService.clearLegacyFields(uid, entry.id);
      result.migrated += 1;
    }

    result.added += 1;
    logger.info({
      route: ROUTE,
      outcome: 'entry_added',
      uid,
      meta: { entryId: entry.id, releaseId: entry.discogsReleaseId, pushedToDiscogs: true },
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

// ---------------------------------------------------------------------------
// Per-copy data (US2) and write-through membership operations (US3/US4)
// ---------------------------------------------------------------------------

async function resolveManagedRef(
  connection: DiscogsConnection,
  entry: LibraryEntry,
  fieldMap: CollectionFieldMap,
): Promise<{ ref: InstanceRef; instance: CollectionInstance | null }> {
  const instances = await getInstancesForRelease(connection, entry.discogsReleaseId, fieldMap);
  const managed =
    instances.find((instance) => instance.instanceId === entry.discogsInstanceId) ??
    [...instances].sort((a, b) => a.instanceId - b.instanceId)[0] ??
    null;

  if (!managed) {
    throw new DiscogsNotFoundError();
  }
  return {
    ref: { folderId: managed.folderId, releaseId: managed.releaseId, instanceId: managed.instanceId },
    instance: managed,
  };
}

/** Fresh per-copy data for the detail view; null when the copy is gone. */
export async function getCopyData(
  connection: DiscogsConnection,
  entry: LibraryEntry,
): Promise<EntryDiscogsData | null> {
  const fieldMap = await getFieldMap(connection);
  let instance: CollectionInstance | null;
  try {
    ({ instance } = await resolveManagedRef(connection, entry, fieldMap));
  } catch (err) {
    if (err instanceof DiscogsNotFoundError) {
      return null;
    }
    throw err;
  }
  if (!instance) {
    return null;
  }
  return toEntryDiscogsData(instance, fieldMap);
}

function toEntryDiscogsData(
  instance: CollectionInstance,
  fieldMap: CollectionFieldMap,
): EntryDiscogsData {
  return {
    instanceId: instance.instanceId,
    folderId: instance.folderId,
    rating: instance.rating,
    mediaCondition: instance.mediaCondition,
    sleeveCondition: instance.sleeveCondition,
    notes: instance.notes,
    editable: {
      mediaCondition: fieldMap.mediaConditionFieldId !== null,
      sleeveCondition: fieldMap.sleeveConditionFieldId !== null,
      notes: fieldMap.notesFieldId !== null,
    },
  };
}

export interface CopyDataPatch {
  rating?: number;
  mediaCondition?: string | null;
  sleeveCondition?: string | null;
  notes?: string;
}

/** Persists per-field edits to the user's Discogs collection (FR-007). */
export async function updateCopyData(
  connection: DiscogsConnection,
  entry: LibraryEntry,
  patch: CopyDataPatch,
): Promise<void> {
  let ref: InstanceRef;
  if (entry.discogsInstanceId !== undefined && entry.discogsFolderId !== undefined) {
    ref = {
      folderId: entry.discogsFolderId,
      releaseId: entry.discogsReleaseId,
      instanceId: entry.discogsInstanceId,
    };
  } else {
    const fieldMap = await getFieldMap(connection);
    ref = (await resolveManagedRef(connection, entry, fieldMap)).ref;
  }

  if (patch.rating !== undefined) {
    await setRating(connection, ref, patch.rating);
  }

  const fieldEdits: Array<{ label: string; fieldId: number | null; value: string | null | undefined }> = [];
  if (patch.mediaCondition !== undefined || patch.sleeveCondition !== undefined || patch.notes !== undefined) {
    const fieldMap = await getFieldMap(connection);
    if (patch.mediaCondition !== undefined) {
      fieldEdits.push({ label: 'Media Condition', fieldId: fieldMap.mediaConditionFieldId, value: patch.mediaCondition });
    }
    if (patch.sleeveCondition !== undefined) {
      fieldEdits.push({ label: 'Sleeve Condition', fieldId: fieldMap.sleeveConditionFieldId, value: patch.sleeveCondition });
    }
    if (patch.notes !== undefined) {
      fieldEdits.push({ label: 'Notes', fieldId: fieldMap.notesFieldId, value: patch.notes });
    }
  }

  for (const edit of fieldEdits) {
    if (edit.fieldId === null) {
      throw new FieldNotEditableError(edit.label);
    }
    await setFieldValue(connection, ref, edit.fieldId, edit.value ?? '');
  }
}

/** Write-through add (FR-004): Discogs first, then the mirror entry. */
export async function addToLibrary(
  connection: DiscogsConnection,
  uid: string,
  discogsReleaseId: number,
): Promise<LibraryEntry> {
  const { instanceId, folderId } = await addReleaseToCollection(connection, discogsReleaseId);
  const entry = await libraryService.createEntry(uid, {
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
  return entry;
}

/** Write-through remove (FR-005): Discogs instance first, then the mirror. */
export async function removeFromLibrary(
  connection: DiscogsConnection,
  uid: string,
  entry: LibraryEntry,
): Promise<void> {
  if (entry.discogsInstanceId !== undefined && entry.discogsFolderId !== undefined) {
    try {
      await deleteInstance(connection, {
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
  await libraryService.deleteEntry(uid, entry.id);
  logger.info({ route: ROUTE, outcome: 'entry_removed', uid, meta: { entryId: entry.id } });
}
