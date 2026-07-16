import type {
  CollectionFieldMap,
  CollectionInstance,
  InstanceRef,
} from '../../domain/discogsOauth/collectionTypes';
import { DiscogsNotFoundError } from '../../discogs/discogsErrors';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';
import type { EntryDiscogsData, LibraryEntry } from '../../domain/library/types';
import type { DiscogsCollectionPort } from '../../ports/discogsOauth/discogsCollectionPort';

export async function resolveManagedRef(
  discogsCollection: DiscogsCollectionPort,
  connection: DiscogsConnection,
  entry: LibraryEntry,
  fieldMap: CollectionFieldMap,
): Promise<{ ref: InstanceRef; instance: CollectionInstance | null }> {
  const instances = await discogsCollection.getInstancesForRelease(
    connection,
    entry.discogsReleaseId,
    fieldMap,
  );
  const managed =
    instances.find((instance) => instance.instanceId === entry.discogsInstanceId) ??
    [...instances].sort((a, b) => a.instanceId - b.instanceId)[0] ??
    null;

  if (!managed) {
    throw new DiscogsNotFoundError();
  }
  return {
    ref: {
      folderId: managed.folderId,
      releaseId: managed.releaseId,
      instanceId: managed.instanceId,
    },
    instance: managed,
  };
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

/** Fresh per-copy data for the detail view; null when the copy is gone. */
export async function getCopyData(
  discogsCollection: DiscogsCollectionPort,
  connection: DiscogsConnection,
  entry: LibraryEntry,
): Promise<EntryDiscogsData | null> {
  const fieldMap = await discogsCollection.getFieldMap(connection);
  let instance: CollectionInstance | null;
  try {
    ({ instance } = await resolveManagedRef(discogsCollection, connection, entry, fieldMap));
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
