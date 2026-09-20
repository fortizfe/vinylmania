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

    // Feature 068 (D12): infinite scroll owns the batch cursor, so no `page`
    // is read or written. A legacy `?page=N` link is simply ignored.
    return { sort: readSort(params), ...readCatalogFilters(params) };
  }, [location.search]);
}

export function buildLibraryPath(
  filters?: LibraryFilters,
  sort: LibrarySortValue = DEFAULT_LIBRARY_SORT,
): string {
  const params = new URLSearchParams();
  if (sort.sort !== DEFAULT_LIBRARY_SORT.sort || sort.dir !== DEFAULT_LIBRARY_SORT.dir) {
    params.set('sort', sort.sort);
    params.set('dir', sort.dir);
  }
  writeCatalogFilters(params, filters);
  const query = params.toString();
  return query ? `/app/library?${query}` : '/app/library';
}
