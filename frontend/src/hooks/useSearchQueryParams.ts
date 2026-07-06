import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export interface SearchQueryParams {
  query: string;
  page: number;
}

export function useSearchQueryParams(): SearchQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') ?? '';
    const parsedPage = Number(params.get('page'));
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    return { query, page };
  }, [location.search]);
}

export function buildSearchPath(query: string, page = 1): string {
  const params = new URLSearchParams();
  params.set('q', query.trim());
  if (page > 1) {
    params.set('page', String(page));
  }
  return `/app/search?${params.toString()}`;
}
