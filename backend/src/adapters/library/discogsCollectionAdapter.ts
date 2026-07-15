import {
  addReleaseToCollection,
  deleteInstance,
  getFieldMap,
  getInstancesForRelease,
  listAllInstances,
  setFieldValue,
  setRating,
} from '../../discogs/collection/collectionClient';
import type { DiscogsCollectionPort } from '../../ports/library/discogsCollectionPort';

export const discogsCollectionAdapter: DiscogsCollectionPort = {
  getFieldMap,
  listAllInstances,
  getInstancesForRelease,
  addReleaseToCollection,
  deleteInstance,
  setRating,
  setFieldValue,
};
