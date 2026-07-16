import type {
  CreateLibraryEntryInput,
  LibraryEntry,
  PaginatedLibraryEntries,
} from '../../domain/library/types';

export interface LibraryRepositoryPort {
  createEntry(uid: string, input: CreateLibraryEntryInput): Promise<LibraryEntry>;

  getEntry(uid: string, entryId: string): Promise<LibraryEntry | null>;

  listEntries(uid: string, page: number, pageSize: number): Promise<PaginatedLibraryEntries>;

  /** Every entry, unpaginated — used by syncLibrary's reconciliation and by filtered listing. */
  listAllEntries(uid: string): Promise<LibraryEntry[]>;

  /** Upserts genre/style/format; called only on a successful enrichment lookup. */
  persistCatalogFields(
    uid: string,
    entryId: string,
    fields: { genre: string[]; style: string[]; format: string[] },
  ): Promise<void>;

  /** Points an entry at its managed Discogs collection instance. */
  updateEntryInstance(
    uid: string,
    entryId: string,
    instance: { discogsInstanceId: number; discogsFolderId: number },
  ): Promise<void>;

  /** Removes the pre-016 legacyCondition/legacyNotes fields after a confirmed Discogs write. */
  clearLegacyFields(uid: string, entryId: string): Promise<void>;

  deleteEntry(uid: string, entryId: string): Promise<boolean>;
}
