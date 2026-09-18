import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import {
  type CatalogFilters,
  readCatalogFilters,
  writeCatalogFilters,
} from './catalogFilterParams';

export type LibraryFilters = CatalogFilters;

interface LibraryQueryParams extends LibraryFilters {
  page: number;
}

export function useLibraryQueryParams(): LibraryQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const parsedPage = Number(params.get('page'));
    const page =
      Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    return { page, ...readCatalogFilters(params) };
  }, [location.search]);
}

export function buildLibraryPath(page = 1, filters?: LibraryFilters): string {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', String(page));
  }
  writeCatalogFilters(params, filters);
  const query = params.toString();
  return query ? `/app/library?${query}` : '/app/library';
}
