import { FieldValue } from 'firebase-admin/firestore';

import { getFirestoreDb } from '../config/firebase-admin';
import type {
  CreateLibraryEntryInput,
  LibraryEntry,
  LibraryFilters,
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
    ...(data.genre !== undefined ? { genre: data.genre } : {}),
    ...(data.style !== undefined ? { style: data.style } : {}),
    ...(data.format !== undefined ? { format: data.format } : {}),
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

const FILTER_FIELDS = ['genre', 'style', 'format'] as const;

/**
 * AND across genre/style/format, OR within each field's selected values
 * (feature 038, FR-015). An entry with no stored values for a filtered
 * field never matches (covers both a never-enriched entry and a release
 * that genuinely lacks that field's data).
 */
export function matchesLibraryFilters(entry: LibraryEntry, filters: LibraryFilters): boolean {
  for (const field of FILTER_FIELDS) {
    const selected = filters[field];
    if (!selected || selected.length === 0) continue;
    const entryValues = entry[field] ?? [];
    if (!selected.some((value) => entryValues.includes(value))) {
      return false;
    }
  }
  return true;
}

/**
 * Filtered/paginated library listing (feature 038, FR-017; research.md
 * Decision 2): fetches the full per-user mirror and matches/paginates in
 * application code rather than via an unsupported multi-field Firestore
 * compound query, correct at this app's "few hundred records" per-user
 * scale (spec 003) without new indexes.
 */
export async function listEntriesFiltered(
  uid: string,
  page: number,
  pageSize: number,
  filters: LibraryFilters,
): Promise<PaginatedLibraryEntries> {
  const all = await listAllEntries(uid);
  const matched = all.filter((entry) => matchesLibraryFilters(entry, filters));

  const offset = (page - 1) * pageSize;
  return {
    items: matched.slice(offset, offset + pageSize),
    page,
    pageSize,
    totalItems: matched.length,
  };
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
