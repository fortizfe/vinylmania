import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import {
  DEFAULT_LIBRARY_SORT,
  type LibrarySortCriterion,
  type LibrarySortDirection,
  type LibrarySortValue,
} from '../constants/librarySortOptions';
import {
  type CatalogFilters,
  readCatalogFilters,
  writeCatalogFilters,
} from './catalogFilterParams';

export type LibraryFilters = CatalogFilters;

interface LibraryQueryParams extends LibraryFilters {
  page: number;
  sort: LibrarySortValue;
}

const CRITERIA: readonly LibrarySortCriterion[] = ['added', 'artist', 'album'];

/** data-model §2: never errors; unknown values fall back to defaults. */
function readSort(params: URLSearchParams): LibrarySortValue {
  const sort = CRITERIA.find((c) => c === params.get('sort'));
  if (!sort) {
    return DEFAULT_LIBRARY_SORT;
  }
  const rawDir = params.get('dir');
  const dir: LibrarySortDirection =
    rawDir === 'asc' || rawDir === 'desc' ? rawDir : sort === 'added' ? 'desc' : 'asc';
  return { sort, dir };
}

export function useLibraryQueryParams(): LibraryQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const parsedPage = Number(params.get('page'));
    const page =
      Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    return { page, sort: readSort(params), ...readCatalogFilters(params) };
  }, [location.search]);
}

export function buildLibraryPath(
  filters?: LibraryFilters,
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
  page = 1,
): string {
  const params = new URLSearchParams();
  if (sort.sort !== DEFAULT_LIBRARY_SORT.sort || sort.dir !== DEFAULT_LIBRARY_SORT.dir) {
    params.set('sort', sort.sort);
    params.set('dir', sort.dir);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  writeCatalogFilters(params, filters);
  const query = params.toString();
  return query ? `/app/library?${query}` : '/app/library';
}
