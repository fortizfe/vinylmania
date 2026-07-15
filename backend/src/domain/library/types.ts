import type { Release } from '../discogsCatalog/types';

/**
 * A record the user owns, mirrored in Firestore from their Discogs
 * collection (feature 016). Membership data only — per-copy data (rating,
 * conditions, notes) lives in the Discogs collection instance.
 */
export interface LibraryEntry {
  id: string;
  discogsReleaseId: number;
  addedAt: string;
  /** The managed Discogs collection instance (lowest instance_id, R8). */
  discogsInstanceId?: number;
  /** Folder currently holding the managed instance (needed for writes). */
  discogsFolderId?: number;
  /**
   * Pre-016 per-copy fields awaiting first-sync migration to Discogs.
   * Deleted from Firestore once the Discogs write is confirmed (FR-010);
   * never serialized to API responses.
   */
  legacyCondition?: string;
  legacyNotes?: string;
  /**
   * Persisted at enrichment time from the release's catalog data (feature
   * 038, FR-018), so Library can filter by them without a live per-request
   * Discogs lookup. Absent until the entry's first successful enrichment;
   * left untouched (not cleared) on a failed lookup (FR-024).
   */
  genre?: string[];
  style?: string[];
  format?: string[];
}

/** Genre/Style/Format selection for filtering the library listing (FR-015/FR-017). */
export interface LibraryFilters {
  genre?: string[];
  style?: string[];
  format?: string[];
}

export type CatalogStatus = 'ok' | 'unavailable';

/**
 * Per-copy data held in the user's Discogs collection, editable from the
 * record detail (data-model.md §6).
 */
export interface EntryDiscogsData {
  instanceId: number;
  folderId: number;
  /** 0–5; 0 means unrated. */
  rating: number;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
  /** false when the matching Discogs custom field is missing. */
  editable: {
    mediaCondition: boolean;
    sleeveCondition: boolean;
    notes: boolean;
  };
}

export interface EnrichedLibraryEntry extends LibraryEntry {
  catalogStatus: CatalogStatus;
  release: Release | null;
  discogs: EntryDiscogsData | null;
}

export interface CreateLibraryEntryInput {
  discogsReleaseId: number;
  discogsInstanceId: number;
  discogsFolderId: number;
  /** Discogs-originated entries carry the instance's date_added. */
  addedAt?: Date;
}

export interface PaginatedLibraryEntries {
  items: LibraryEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
}
