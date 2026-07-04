import { authorizedFetch } from './apiClient';
import type { Release } from './libraryApi';

export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist';
  title: string;
  artist?: string;
  thumbnailUrl?: string;
  year?: number;
  formats?: string[];
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
): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams({ q: query, type: resultType });
  if (page !== undefined) params.set('page', String(page));
  if (perPage !== undefined) params.set('perPage', String(perPage));
  const res = await authorizedFetch(`/api/discogs/search?${params.toString()}`);
  return res.json();
}

export async function getRelease(discogsId: number): Promise<Release> {
  const res = await authorizedFetch(`/api/discogs/releases/${discogsId}`);
  return res.json();
}
