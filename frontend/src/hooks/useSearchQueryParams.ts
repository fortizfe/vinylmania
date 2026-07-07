import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export interface SearchFilters {
  artist?: string;
  genre?: string;
  style?: string;
  format?: string;
}

export interface SearchQueryParams extends SearchFilters {
  query: string;
  page: number;
}

const FILTER_PARAM_NAMES = ['artist', 'genre', 'style', 'format'] as const;

/** Trims a filter value; blank/whitespace-only values are treated as unset (spec FR-010). */
function normalizeFilterValue(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function useSearchQueryParams(): SearchQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') ?? '';
    const parsedPage = Number(params.get('page'));
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    const filters: SearchFilters = {};
    for (const name of FILTER_PARAM_NAMES) {
      const value = normalizeFilterValue(params.get(name));
      if (value) {
        filters[name] = value;
      }
    }

    return { query, page, ...filters };
  }, [location.search]);
}

export function buildSearchPath(query: string, page = 1, filters?: SearchFilters): string {
  const params = new URLSearchParams();
  params.set('q', query.trim());
  if (page > 1) {
    params.set('page', String(page));
  }
  for (const name of FILTER_PARAM_NAMES) {
    const value = normalizeFilterValue(filters?.[name]);
    if (value) {
      params.set(name, value);
    }
  }
  return `/app/search?${params.toString()}`;
}
