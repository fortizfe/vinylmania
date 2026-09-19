import { getFirestoreDb } from '../../../../src/config/firebase-admin';
import {
  createEntry,
  getEntry,
  listAllEntries,
  persistCollectionFacets,
} from '../../../../src/adapters/library/firestoreLibraryRepository';
import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../../../helpers/authEmulator';

// Exercises the real Discogs API (release ID 1, permanent and stable — see
// specs/002-discogs-api-client/research.md §8) against the Firestore
// emulator, without mocking either side.
describe('Library repository adapter live integration: createEntry', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('persists a new library entry under users/{uid}/libraryEntries', async () => {
    const { uid } = await getTestIdToken('library-integration-user');

    const entry = await createEntry(uid, {
      discogsReleaseId: 1,
      discogsInstanceId: 42,
      discogsFolderId: 1,
    });

    expect(entry.discogsReleaseId).toBe(1);
    expect(entry.discogsInstanceId).toBe(42);

    const snapshot = await getFirestoreDb()
      .collection('users')
      .doc(uid)
      .collection('libraryEntries')
      .doc(entry.id)
      .get();

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()?.discogsReleaseId).toBe(1);
  });
});

describe('Library repository adapter live integration: title round-trip (feature 068, research D4)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('persists title via persistCollectionFacets and maps it back in getEntry and listAllEntries', async () => {
    const { uid } = await getTestIdToken('library-title-user');
    const created = await createEntry(uid, {
      discogsReleaseId: 1,
      discogsInstanceId: 42,
      discogsFolderId: 1,
    });
    const facets = { primaryArtist: 'The Persuader', title: 'Stockholm' };

    await persistCollectionFacets(uid, created.id, facets);

    expect(await getEntry(uid, created.id)).toMatchObject({
      primaryArtist: 'The Persuader',
      title: 'Stockholm',
    });
    const all = await listAllEntries(uid);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: created.id, title: 'Stockholm' });
  });
});
