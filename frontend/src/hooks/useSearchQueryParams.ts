import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { FORMAT_OPTIONS } from '../constants/formatOptions';

export interface SearchFilters {
  genre?: string;
  style?: string;
  format?: string[];
}

export interface SearchQueryParams extends SearchFilters {
  query: string;
  page: number;
}

const TEXT_FILTER_PARAM_NAMES = ['genre', 'style'] as const;

/** Trims a filter value; blank/whitespace-only values are treated as unset (spec FR-010). */
function normalizeFilterValue(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Parses a comma-joined `format` URL param into the subset of values found in
 * `FORMAT_OPTIONS`, re-ordered to match that list's canonical order (feature
 * 022, FR-010: unrecognized values are silently dropped).
 */
function parseFormatParam(value: string | null): string[] {
  if (!value) return [];
  const requested = new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return FORMAT_OPTIONS.filter((option) => requested.has(option));
}

/** Joins a format selection into a single comma-separated value, in canonical FORMAT_OPTIONS order. */
function buildFormatParam(format: string[] | undefined): string | undefined {
  if (!format || format.length === 0) return undefined;
  const selected = new Set(format);
  const ordered = FORMAT_OPTIONS.filter((option) => selected.has(option));
  return ordered.length > 0 ? ordered.join(',') : undefined;
}

export function useSearchQueryParams(): SearchQueryParams {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') ?? '';
    const parsedPage = Number(params.get('page'));
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

    const filters: SearchFilters = {};
    for (const name of TEXT_FILTER_PARAM_NAMES) {
      const value = normalizeFilterValue(params.get(name));
      if (value) {
        filters[name] = value;
      }
    }
    const format = parseFormatParam(params.get('format'));
    if (format.length > 0) {
      filters.format = format;
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
  for (const name of TEXT_FILTER_PARAM_NAMES) {
    const value = normalizeFilterValue(filters?.[name]);
    if (value) {
      params.set(name, value);
    }
  }
  const formatParam = buildFormatParam(filters?.format);
  if (formatParam) {
    params.set('format', formatParam);
  }
  return `/app/search?${params.toString()}`;
}
