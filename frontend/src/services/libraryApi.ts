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

export interface EnrichedLibraryEntry {
  id: string;
  discogsReleaseId: number;
  addedAt: string;
  condition?: string;
  notes?: string;
  catalogStatus: 'ok' | 'unavailable';
  release: Release | null;
}

export interface PaginatedLibraryEntries {
  items: EnrichedLibraryEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
}

export async function create(
  discogsReleaseId: number,
  condition?: string,
  notes?: string,
): Promise<EnrichedLibraryEntry> {
  const res = await authorizedFetch('/api/library', {
    method: 'POST',
    body: JSON.stringify({ discogsReleaseId, condition, notes }),
  });
  return res.json();
}

export async function list(page = 1, pageSize = 20): Promise<PaginatedLibraryEntries> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
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
  condition?: string,
  notes?: string,
): Promise<EnrichedLibraryEntry> {
  const res = await authorizedFetch(`/api/library/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ condition, notes }),
  });
  return res.json();
}
