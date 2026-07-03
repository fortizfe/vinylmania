import { authorizedFetch } from './apiClient';

export interface CatalogSearchResult {
  discogsId: number;
  resultType: 'release' | 'artist';
  title: string;
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
): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams({ q: query, type: resultType });
  const res = await authorizedFetch(`/api/discogs/search?${params.toString()}`);
  return res.json();
}
