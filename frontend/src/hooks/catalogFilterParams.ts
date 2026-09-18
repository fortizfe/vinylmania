import { FORMAT_OPTIONS } from '../constants/formatOptions';
import { GENRE_OPTIONS } from '../constants/genreOptions';
import { STYLE_OPTIONS } from '../constants/styleOptions';

export interface CatalogFilters {
  genre?: string[];
  style?: string[];
  format?: string[];
}

const MULTI_VALUE_FILTERS = {
  genre: GENRE_OPTIONS,
  style: STYLE_OPTIONS,
  format: FORMAT_OPTIONS,
} as const;

const FILTER_ENTRIES = Object.entries(MULTI_VALUE_FILTERS) as [
  keyof CatalogFilters,
  readonly string[],
][];

/**
 * Parses a comma-joined URL param into the subset of values found in the
 * given catalog, re-ordered to match that catalog's canonical order
 * (generalized in feature 038 from `format`-only, feature 022 FR-010:
 * unrecognized values are silently dropped; FR-022 applies the same
 * URL-reflects-filters requirement to Library).
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

export function readCatalogFilters(params: URLSearchParams): CatalogFilters {
  const filters: CatalogFilters = {};
  for (const [name, catalog] of FILTER_ENTRIES) {
    const values = parseMultiValueParam(params.get(name), catalog);
    if (values.length > 0) {
      filters[name] = values;
    }
  }
  return filters;
}

export function writeCatalogFilters(
  params: URLSearchParams,
  filters?: CatalogFilters,
): void {
  for (const [name, catalog] of FILTER_ENTRIES) {
    const value = buildMultiValueParam(filters?.[name], catalog);
    if (value) {
      params.set(name, value);
    }
  }
}
