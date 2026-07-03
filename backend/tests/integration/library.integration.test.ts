import { getFirestoreDb } from '../../src/config/firebase-admin';
import { createEntry } from '../../src/library/libraryService';
import { clearEmulatorFirestore, clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

// Exercises the real Discogs API (release ID 1, permanent and stable — see
// specs/002-discogs-api-client/research.md §8) against the Firestore
// emulator, without mocking either side.
describe('Library service live integration: createEntry', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('persists a new library entry under users/{uid}/libraryEntries', async () => {
    const { uid } = await getTestIdToken('library-integration-user');

    const entry = await createEntry(uid, {
      discogsReleaseId: 1,
      condition: 'Very Good Plus',
    });

    expect(entry.discogsReleaseId).toBe(1);
    expect(entry.condition).toBe('Very Good Plus');

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
