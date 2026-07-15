import type { InstanceRef } from '../../discogs/collection/collectionTypes';
import { FieldNotEditableError } from '../../domain/library/libraryErrors';
import type { DiscogsCollectionPort } from '../../ports/library/discogsCollectionPort';
import type { DiscogsConnectionPort } from '../../ports/library/discogsConnectionPort';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';
import { getCopyData, resolveManagedRef } from './discogsCopyData';
import type { EnrichLibraryEntryUseCase } from './enrichLibraryEntry';
import { requireConnection } from './syncLibrary';

export interface CopyDataPatch {
  rating?: number;
  mediaCondition?: string | null;
  sleeveCondition?: string | null;
  notes?: string;
}

export function createUpdateLibraryEntryUseCase(deps: {
  repository: LibraryRepositoryPort;
  discogsCollection: DiscogsCollectionPort;
  discogsConnection: DiscogsConnectionPort;
  enrichLibraryEntry: EnrichLibraryEntryUseCase;
}) {
  const { repository, discogsCollection, discogsConnection, enrichLibraryEntry } = deps;

  /** Persists per-field edits to the user's Discogs collection (FR-007). */
  async function updateLibraryEntry(uid: string, entryId: string, patch: CopyDataPatch) {
    const connection = await requireConnection(discogsConnection, uid);

    const entry = await repository.getEntry(uid, entryId);
    if (!entry) {
      return null;
    }

    let ref: InstanceRef;
    if (entry.discogsInstanceId !== undefined && entry.discogsFolderId !== undefined) {
      ref = {
        folderId: entry.discogsFolderId,
        releaseId: entry.discogsReleaseId,
        instanceId: entry.discogsInstanceId,
      };
    } else {
      const fieldMap = await discogsCollection.getFieldMap(connection);
      ref = (await resolveManagedRef(discogsCollection, connection, entry, fieldMap)).ref;
    }

    if (patch.rating !== undefined) {
      await discogsCollection.setRating(connection, ref, patch.rating);
    }

    const fieldEdits: Array<{
      label: string;
      fieldId: number | null;
      value: string | null | undefined;
    }> = [];
    if (
      patch.mediaCondition !== undefined ||
      patch.sleeveCondition !== undefined ||
      patch.notes !== undefined
    ) {
      const fieldMap = await discogsCollection.getFieldMap(connection);
      if (patch.mediaCondition !== undefined) {
        fieldEdits.push({
          label: 'Media Condition',
          fieldId: fieldMap.mediaConditionFieldId,
          value: patch.mediaCondition,
        });
      }
      if (patch.sleeveCondition !== undefined) {
        fieldEdits.push({
          label: 'Sleeve Condition',
          fieldId: fieldMap.sleeveConditionFieldId,
          value: patch.sleeveCondition,
        });
      }
      if (patch.notes !== undefined) {
        fieldEdits.push({
          label: 'Notes',
          fieldId: fieldMap.notesFieldId,
          value: patch.notes,
        });
      }
    }

    for (const edit of fieldEdits) {
      if (edit.fieldId === null) {
        throw new FieldNotEditableError(edit.label);
      }
      await discogsCollection.setFieldValue(connection, ref, edit.fieldId, edit.value ?? '');
    }

    const [enriched, discogs] = await Promise.all([
      enrichLibraryEntry.enrichEntry(uid, entry),
      getCopyData(discogsCollection, connection, entry),
    ]);

    return { entry, enriched, discogs };
  }

  return { updateLibraryEntry };
}
