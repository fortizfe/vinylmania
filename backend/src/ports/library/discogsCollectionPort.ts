import type {
  CollectionFieldMap,
  CollectionInstance,
  InstanceRef,
} from '../../discogs/collection/collectionTypes';
import type { DiscogsConnection } from '../../discogs/oauth/types';

export interface DiscogsCollectionPort {
  getFieldMap(connection: DiscogsConnection): Promise<CollectionFieldMap>;

  /** Walks every page of the user's "All" folder. */
  listAllInstances(
    connection: DiscogsConnection,
    prefetchedFieldMap?: CollectionFieldMap,
  ): Promise<CollectionInstance[]>;

  getInstancesForRelease(
    connection: DiscogsConnection,
    releaseId: number,
    prefetchedFieldMap?: CollectionFieldMap,
  ): Promise<CollectionInstance[]>;

  addReleaseToCollection(
    connection: DiscogsConnection,
    releaseId: number,
  ): Promise<{ instanceId: number; folderId: number }>;

  deleteInstance(connection: DiscogsConnection, ref: InstanceRef): Promise<void>;

  setRating(connection: DiscogsConnection, ref: InstanceRef, rating: number): Promise<void>;

  setFieldValue(
    connection: DiscogsConnection,
    ref: InstanceRef,
    fieldId: number,
    value: string,
  ): Promise<void>;
}
