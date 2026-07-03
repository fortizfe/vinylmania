import type { Release } from '../discogs/types';

export interface LibraryEntry {
  id: string;
  discogsReleaseId: number;
  addedAt: string;
  condition?: string;
  notes?: string;
}

export type CatalogStatus = 'ok' | 'unavailable';

export interface EnrichedLibraryEntry extends LibraryEntry {
  catalogStatus: CatalogStatus;
  release: Release | null;
}

export interface CreateLibraryEntryInput {
  discogsReleaseId: number;
  condition?: string;
  notes?: string;
}

export interface UpdateLibraryEntryInput {
  condition?: string;
  notes?: string;
}

export interface PaginatedLibraryEntries {
  items: LibraryEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
}
