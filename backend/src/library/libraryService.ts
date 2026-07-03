import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../config/firebase-admin';
import type {
  CreateLibraryEntryInput,
  LibraryEntry,
  PaginatedLibraryEntries,
  UpdateLibraryEntryInput,
} from './types';

function entriesCollection(uid: string) {
  return getFirestoreDb().collection('users').doc(uid).collection('libraryEntries');
}

function toLibraryEntry(id: string, data: FirebaseFirestore.DocumentData): LibraryEntry {
  return {
    id,
    discogsReleaseId: data.discogsReleaseId,
    addedAt: data.addedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    ...(data.condition ? { condition: data.condition } : {}),
    ...(data.notes ? { notes: data.notes } : {}),
  };
}

export async function createEntry(
  uid: string,
  input: CreateLibraryEntryInput,
): Promise<LibraryEntry> {
  const docRef = entriesCollection(uid).doc();
  await docRef.set({
    discogsReleaseId: input.discogsReleaseId,
    addedAt: FieldValue.serverTimestamp(),
    ...(input.condition ? { condition: input.condition } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  });

  const snapshot = await docRef.get();
  return toLibraryEntry(snapshot.id, snapshot.data()!);
}

export async function getEntry(uid: string, entryId: string): Promise<LibraryEntry | null> {
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

export async function updateEntry(
  uid: string,
  entryId: string,
  input: UpdateLibraryEntryInput,
): Promise<LibraryEntry | null> {
  const docRef = entriesCollection(uid).doc(entryId);
  const existing = await docRef.get();
  if (!existing.exists) {
    return null;
  }

  const updates: Record<string, unknown> = {};
  if (input.condition !== undefined) {
    updates.condition = input.condition;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }
  await docRef.update(updates);

  const snapshot = await docRef.get();
  return toLibraryEntry(snapshot.id, snapshot.data()!);
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
