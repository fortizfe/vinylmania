import type { LibraryFilters } from '../hooks/useLibraryQueryParams';
import { authorizedFetch } from './apiClient';

export interface ReleaseArtistCredit {
  discogsArtistId: number;
  name: string;
  nameVariation?: string;
  joinPhrase?: string;
}

export interface Track {
  position: string;
  title: string;
  duration?: string;
}

export interface LabelCredit {
  discogsLabelId: number;
  name: string;
  catalogNumber?: string;
}

export interface FormatDescriptor {
  name: string;
  quantity?: number;
  descriptions: string[];
}

export interface CatalogImage {
  url: string;
  imageType: 'primary' | 'secondary';
  width?: number;
  height?: number;
}

export interface ReleaseIdentifier {
  type: string;
  value: string;
  description?: string;
}

export interface CommunityStats {
  have: number;
  want: number;
  rating: {
    average: number;
    count: number;
  };
}

export interface Release {
  discogsId: number;
  title: string;
  year?: number;
  country?: string;
  releaseDate?: string;
  notes?: string;
  artists: ReleaseArtistCredit[];
  labels: LabelCredit[];
  formats: FormatDescriptor[];
  genres: string[];
  styles: string[];
  identifiers: ReleaseIdentifier[];
  community?: CommunityStats;
  tracklist: Track[];
  images: CatalogImage[];
  masterId?: number;
  discogsUrl: string;
}

/**
 * Per-copy data held in the user's Discogs collection (feature 016).
 * `editable` flags are false when the matching Discogs custom field was
 * deleted by the user on discogs.com.
 */
export interface EntryDiscogsData {
  instanceId: number;
  folderId: number;
  /** 0–5; 0 means unrated. */
  rating: number;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
  editable: {
    mediaCondition: boolean;
    sleeveCondition: boolean;
    notes: boolean;
  };
}

export interface EnrichedLibraryEntry {
  id: string;
  discogsReleaseId: number;
  addedAt: string;
  catalogStatus: 'ok' | 'unavailable';
  release: Release | null;
  /** Null in list responses and when the copy is gone from Discogs. */
  discogs: EntryDiscogsData | null;
  /** Persisted at enrichment time (feature 038); absent until first successful enrichment. */
  genre?: string[];
  style?: string[];
  format?: string[];
}

export interface PaginatedLibraryEntries {
  items: EnrichedLibraryEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
}

/** One field per call — the detail panel autosaves field by field. */
export interface UpdateCopyDataPatch {
  rating?: number;
  mediaCondition?: string;
  sleeveCondition?: string;
  notes?: string;
}

export async function create(discogsReleaseId: number): Promise<EnrichedLibraryEntry> {
  const res = await authorizedFetch('/api/library', {
    method: 'POST',
    body: JSON.stringify({ discogsReleaseId }),
  });
  return res.json();
}

export async function list(
  page = 1,
  pageSize = 20,
  refresh = false,
  filters?: LibraryFilters,
): Promise<PaginatedLibraryEntries> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (refresh) {
    params.set('refresh', 'true');
  }
  const { genre, style, format } = filters ?? {};
  for (const [name, values] of Object.entries({ genre, style, format })) {
    if (values && values.length > 0) {
      params.set(name, values.join(','));
    }
  }
  const res = await authorizedFetch(`/api/library?${params.toString()}`);
  return res.json();
}

export async function getOne(entryId: string): Promise<EnrichedLibraryEntry> {
  const res = await authorizedFetch(`/api/library/${entryId}`);
  return res.json();
}

export async function remove(entryId: string): Promise<void> {
  await authorizedFetch(`/api/library/${entryId}`, { method: 'DELETE' });
}

export async function update(
  entryId: string,
  patch: UpdateCopyDataPatch,
): Promise<EnrichedLibraryEntry> {
  const res = await authorizedFetch(`/api/library/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.json();
}
