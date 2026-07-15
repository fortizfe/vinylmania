import type { LibraryEntry, LibraryFilters } from './types';

const FILTER_FIELDS = ['genre', 'style', 'format'] as const;

/**
 * AND across genre/style/format, OR within each field's selected values
 * (feature 038, FR-015). An entry with no stored values for a filtered
 * field never matches (covers both a never-enriched entry and a release
 * that genuinely lacks that field's data).
 */
export function matchesLibraryFilters(entry: LibraryEntry, filters: LibraryFilters): boolean {
  for (const field of FILTER_FIELDS) {
    const selected = filters[field];
    if (!selected || selected.length === 0) continue;
    const entryValues = entry[field] ?? [];
    if (!selected.some((value) => entryValues.includes(value))) {
      return false;
    }
  }
  return true;
}
