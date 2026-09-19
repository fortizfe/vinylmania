import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../../config/firebase-admin';
import type { CreateLibraryEntryInput, LibraryEntry } from '../../domain/library/types';
import type { LibraryRepositoryPort } from '../../ports/library/libraryRepositoryPort';

function entriesCollection(uid: string) {
  return getFirestoreDb().collection('users').doc(uid).collection('libraryEntries');
}

function toLibraryEntry(id: string, data: FirebaseFirestore.DocumentData): LibraryEntry {
  return {
    id,
    discogsReleaseId: data.discogsReleaseId,
    addedAt: data.addedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    ...(data.discogsInstanceId !== undefined
      ? { discogsInstanceId: data.discogsInstanceId }
      : {}),
    ...(data.discogsFolderId !== undefined
      ? { discogsFolderId: data.discogsFolderId }
      : {}),
    // Pre-016 per-copy fields, kept only until their first-sync migration.
    ...(data.condition ? { legacyCondition: data.condition } : {}),
    ...(data.notes ? { legacyNotes: data.notes } : {}),
    ...(data.genre !== undefined ? { genre: data.genre } : {}),
    ...(data.style !== undefined ? { style: data.style } : {}),
    ...(data.format !== undefined ? { format: data.format } : {}),
    ...(data.year !== undefined ? { year: data.year } : {}),
    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(data.primaryArtist !== undefined ? { primaryArtist: data.primaryArtist } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
  };
}

export async function createEntry(
  uid: string,
  input: CreateLibraryEntryInput,
): Promise<LibraryEntry> {
  const docRef = entriesCollection(uid).doc();
  await docRef.set({
    discogsReleaseId: input.discogsReleaseId,
    discogsInstanceId: input.discogsInstanceId,
    discogsFolderId: input.discogsFolderId,
    addedAt: input.addedAt ?? FieldValue.serverTimestamp(),
  });

  const snapshot = await docRef.get();
  return toLibraryEntry(snapshot.id, snapshot.data()!);
}

export async function getEntry(
  uid: string,
  entryId: string,
): Promise<LibraryEntry | null> {
  const snapshot = await entriesCollection(uid).doc(entryId).get();
  if (!snapshot.exists) {
    return null;
  }
  return toLibraryEntry(snapshot.id, snapshot.data()!);
}

/** Every entry, unpaginated — the sync reconciles the full mirror at once. */
export async function listAllEntries(uid: string): Promise<LibraryEntry[]> {
  const querySnapshot = await entriesCollection(uid).orderBy('addedAt', 'desc').get();
  return querySnapshot.docs.map((doc) => toLibraryEntry(doc.id, doc.data()));
}

/**
 * Upserts an entry's persisted genre/style/format (feature 038, FR-018).
 * Called only on a successful enrichment lookup — a failed lookup makes no
 * call at all, leaving previously stored values untouched (FR-024).
 */
export async function persistCatalogFields(
  uid: string,
  entryId: string,
  fields: { genre: string[]; style: string[]; format: string[] },
): Promise<void> {
  // set+merge rather than update: an entry document might not exist yet in
  // edge cases (e.g. a race with removal), and update() would throw NOT_FOUND.
  await entriesCollection(uid).doc(entryId).set(fields, { merge: true });
}

/**
 * Upserts the feature-061 collection facets (year/label/primaryArtist) and
 * the feature-068 album `title`.
 * set+merge for the same reason as `persistCatalogFields` — the entry
 * document may not exist yet in an edge case, and `update()` would throw.
 * Only the keys actually supplied are written.
 */
export async function persistCollectionFacets(
  uid: string,
  entryId: string,
  facets: {
    year?: number;
    label?: string[];
    primaryArtist?: string;
    title?: string;
    genre?: string[];
    style?: string[];
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (facets.year !== undefined) {
    patch.year = facets.year;
  }
  if (facets.label !== undefined) {
    patch.label = facets.label;
  }
  if (facets.primaryArtist !== undefined) {
    patch.primaryArtist = facets.primaryArtist;
  }
  if (facets.title !== undefined) {
    patch.title = facets.title;
  }
  // `genre`/`style` share the fields feature 038's enrichment writes via
  // `persistCatalogFields`; an empty array from `basic_information` is omitted
  // upstream so it never clobbers an enriched value (FR-007).
  if (facets.genre !== undefined) {
    patch.genre = facets.genre;
  }
  if (facets.style !== undefined) {
    patch.style = facets.style;
  }
  if (Object.keys(patch).length === 0) {
    return;
  }
  await entriesCollection(uid).doc(entryId).set(patch, { merge: true });
}

/** Corrects an entry's `addedAt` to the real Discogs `date_added` (FR-010). */
export async function reconcileAddedAt(
  uid: string,
  entryId: string,
  addedAt: Date,
): Promise<void> {
  await entriesCollection(uid).doc(entryId).set({ addedAt }, { merge: true });
}

/** Points an entry at its managed Discogs collection instance. */
export async function updateEntryInstance(
  uid: string,
  entryId: string,
  instance: { discogsInstanceId: number; discogsFolderId: number },
): Promise<void> {
  await entriesCollection(uid).doc(entryId).update(instance);
}

/**
 * Removes the pre-016 per-copy fields. Only called after the Discogs write
 * that migrated them has been confirmed (FR-010).
 */
export async function clearLegacyFields(uid: string, entryId: string): Promise<void> {
  await entriesCollection(uid).doc(entryId).update({
    condition: FieldValue.delete(),
    notes: FieldValue.delete(),
  });
}

export async function deleteEntry(uid: string, entryId: string): Promise<boolean> {
  const docRef = entriesCollection(uid).doc(entryId);
  const existing = await docRef.get();
  if (!existing.exists) {
    return false;
  }
  await docRef.delete();
  return true;
}

export const firestoreLibraryRepository: LibraryRepositoryPort = {
  createEntry,
  getEntry,
  listAllEntries,
  persistCatalogFields,
  persistCollectionFacets,
  reconcileAddedAt,
  updateEntryInstance,
  clearLegacyFields,
  deleteEntry,
};
