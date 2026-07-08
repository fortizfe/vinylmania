import type { SearchFilters } from '../hooks/useSearchQueryParams';
import { authorizedFetch } from './apiClient';
import type { CatalogImage, Release, ReleaseArtistCredit, Track } from './libraryApi';

export interface CommunityRating {
  average: number;
  count: number;
}

export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist' | 'master';
  title: string;
  artist?: string;
  thumbnailUrl?: string;
  year?: number;
  formats?: string[];
  /** Additive enrichment (feature 017); present only when a valid, votable rating exists. */
  communityRating?: CommunityRating;
}

export interface CatalogSearchResponse {
  results: CatalogSearchResult[];
  pagination: { page: number; pages: number; items: number; perPage: number };
}

export async function search(
  query: string,
  resultType: 'release' | 'artist',
  page?: number,
  perPage?: number,
  filters?: SearchFilters,
): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams({ q: query, type: resultType });
  if (page !== undefined) params.set('page', String(page));
  if (perPage !== undefined) params.set('perPage', String(perPage));
  const { format, ...textFilters } = filters ?? {};
  for (const [name, value] of Object.entries(textFilters)) {
    const trimmed = value?.trim();
    if (trimmed) params.set(name, trimmed);
  }
  if (format && format.length > 0) {
    params.set('format', format.join(','));
  }
  const res = await authorizedFetch(`/api/discogs/search?${params.toString()}`);
  return res.json();
}

export async function getRelease(discogsId: number): Promise<Release> {
  const res = await authorizedFetch(`/api/discogs/releases/${discogsId}`);
  return res.json();
}

/** A Discogs master release group (feature 026, US3) — see data-model.md. */
export interface MasterRelease {
  discogsId: number;
  title: string;
  year?: number;
  artists: ReleaseArtistCredit[];
  genres: string[];
  styles: string[];
  images: CatalogImage[];
  tracklist: Track[];
  mainReleaseId: number;
  discogsUrl: string;
}

/** One row of a master's paginated version list (feature 026, US3). */
export interface MasterReleaseVersion {
  discogsId: number;
  title: string;
  format?: string;
  year?: number;
  label?: string;
  country?: string;
  thumbnailUrl?: string;
}

export interface MasterReleaseVersionsPage {
  results: MasterReleaseVersion[];
  pagination: { page: number; pages: number; items: number; perPage: number };
}

export async function getMasterRelease(discogsId: number): Promise<MasterRelease> {
  const res = await authorizedFetch(`/api/discogs/masters/${discogsId}`);
  return res.json();
}

export async function getMasterReleaseVersions(
  discogsId: number,
  page?: number,
): Promise<MasterReleaseVersionsPage> {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  const res = await authorizedFetch(`/api/discogs/masters/${discogsId}/versions${suffix}`);
  return res.json();
}
