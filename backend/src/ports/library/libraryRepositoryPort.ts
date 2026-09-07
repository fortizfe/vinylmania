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

  /**
   * Upserts the collection facets `syncLibrary` reads off each row's
   * `basic_information` (feature 061). Called only when the instance actually
   * carries a facet — a facet-less instance makes no call, leaving prior
   * values untouched (same rule as `persistCatalogFields`). Each key is written
   * only when supplied, so an empty `genres`/`styles` array from
   * `basic_information` never clobbers a value previously written by feature
   * 038's catalog enrichment (`persistCatalogFields`); `genre`/`style` reuse
   * the same `LibraryEntry` fields as that path (FR-004/FR-007).
   */
  persistCollectionFacets(
    uid: string,
    entryId: string,
    facets: {
      year?: number;
      label?: string[];
      primaryArtist?: string;
      genre?: string[];
      style?: string[];
    },
  ): Promise<void>;

  /**
   * Corrects an entry's `addedAt` to the real Discogs `date_added` (feature
   * 061, FR-010). Called by the sync only when the stored value differs, so
   * discogs.com-added and first-sync-pushed entries are both dated by Discogs.
   */
  reconcileAddedAt(uid: string, entryId: string, addedAt: Date): Promise<void>;

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
