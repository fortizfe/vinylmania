import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { FORMAT_OPTIONS } from '../constants/formatOptions';
import { GENRE_OPTIONS } from '../constants/genreOptions';
import { STYLE_OPTIONS } from '../constants/styleOptions';

export interface LibraryFilters {
  genre?: string[];
  style?: string[];
  format?: string[];
}

export interface LibraryQueryParams extends LibraryFilters {
  page: number;
}

const MULTI_VALUE_FILTERS = {
  genre: GENRE_OPTIONS,
  style: STYLE_OPTIONS,
  format: FORMAT_OPTIONS,
} as const;

/**
 * Parses a comma-joined URL param into the subset of values found in the
 * given catalog, re-ordered to match that catalog's canonical order
 * (mirrors `useSearchQueryParams`' identical helper — feature 038, FR-010/
 * FR-022 apply the same URL-reflects-filters requirement to Library).
 */
function parseMultiValueParam(
  value: string | null,
  catalog: readonly string[],
): string[] {
  if (!value) return [];
  const requested = new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return catalog.filter((option) => requested.has(option));
}

/** Joins a selection into a single comma-separated value, in canonical catalog order. */
function buildMultiValueParam(
  values: string[] | undefined,
  catalog: readonly string[],
): string | undefined {
  if (!values || values.length === 0) return undefined;
  const selected = new Set(values);
  const ordered = catalog.filter((option) => selected.has(option));
  return ordered.length > 0 ? ordered.join(',') : undefined;
}

export function useLibraryQueryParams(): LibraryQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const parsedPage = Number(params.get('page'));
    const page =
      Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    const filters: LibraryFilters = {};
    for (const [name, catalog] of Object.entries(MULTI_VALUE_FILTERS) as [
      keyof LibraryFilters,
      readonly string[],
    ][]) {
      const values = parseMultiValueParam(params.get(name), catalog);
      if (values.length > 0) {
        filters[name] = values;
      }
    }

    return { page, ...filters };
  }, [location.search]);
}

export function buildLibraryPath(page = 1, filters?: LibraryFilters): string {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', String(page));
  }
  for (const [name, catalog] of Object.entries(MULTI_VALUE_FILTERS) as [
    keyof LibraryFilters,
    readonly string[],
  ][]) {
    const value = buildMultiValueParam(filters?.[name], catalog);
    if (value) {
      params.set(name, value);
    }
  }
  const query = params.toString();
  return query ? `/app/library?${query}` : '/app/library';
}
