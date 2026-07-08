import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../config/firebase-admin';
import type {
  CreateLibraryEntryInput,
  LibraryEntry,
  PaginatedLibraryEntries,
} from './types';

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

export async function listEntries(
  uid: string,
  page: number,
  pageSize: number,
): Promise<PaginatedLibraryEntries> {
  const collection = entriesCollection(uid);
  const totalSnapshot = await collection.count().get();
  const totalItems = totalSnapshot.data().count;

  const offset = (page - 1) * pageSize;
  const querySnapshot = await collection
    .orderBy('addedAt', 'desc')
    .offset(offset)
    .limit(pageSize)
    .get();

  return {
    items: querySnapshot.docs.map((doc) => toLibraryEntry(doc.id, doc.data())),
    page,
    pageSize,
    totalItems,
  };
}

/** Every entry, unpaginated — the sync reconciles the full mirror at once. */
export async function listAllEntries(uid: string): Promise<LibraryEntry[]> {
  const querySnapshot = await entriesCollection(uid).orderBy('addedAt', 'desc').get();
  return querySnapshot.docs.map((doc) => toLibraryEntry(doc.id, doc.data()));
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
