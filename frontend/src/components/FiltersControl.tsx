import { type FormEvent, useEffect, useState } from 'react';

import { CollapsibleFilterPanel } from './filters/CollapsibleFilterPanel';
import { SelectableListFilter } from './filters/SelectableListFilter';
import { FilterActions } from './filters/FilterActions';
import { FORMAT_OPTIONS } from '../constants/formatOptions';
import { GENRE_OPTIONS } from '../constants/genreOptions';
import { STYLE_OPTIONS } from '../constants/styleOptions';

/**
 * Genre/Style/Format selection, shared shape between Search (`SearchFilters`)
 * and Library (`LibraryFilters`) — this component is the single filter
 * component used by both screens (spec FR-001: "not two separate
 * implementations"), so it depends on neither screen-specific type.
 */
export interface FilterValues {
  genre?: string[];
  style?: string[];
  format?: string[];
}

interface FiltersControlProps<T extends FilterValues> {
  filters: T;
  onApply: (filters: T) => void;
  onClear: () => void;
}

function activeCount(filters: FilterValues): number {
  return (
    (filters.genre?.length ?? 0) +
    (filters.style?.length ?? 0) +
    (filters.format?.length ?? 0)
  );
}

export function FiltersControl<T extends FilterValues>({
  filters,
  onApply,
  onClear,
}: FiltersControlProps<T>) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => filters.genre ?? []);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(() => filters.style ?? []);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    () => filters.format ?? [],
  );

  useEffect(() => {
    setSelectedGenres(filters.genre ?? []);
    setSelectedStyles(filters.style ?? []);
    setSelectedFormats(filters.format ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.genre, filters.style, filters.format]);

  function handleApply(event: FormEvent) {
    event.preventDefault();
    const next: FilterValues = {};
    if (selectedGenres.length > 0) next.genre = selectedGenres;
    if (selectedStyles.length > 0) next.style = selectedStyles;
    if (selectedFormats.length > 0) next.format = selectedFormats;
    onApply(next as T);
  }

  function handleClear() {
    setSelectedGenres([]);
    setSelectedStyles([]);
    setSelectedFormats([]);
    onClear();
  }

  return (
    <CollapsibleFilterPanel activeCount={activeCount(filters)}>
      <form
        onSubmit={handleApply}
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {/* Format leads the filter bar (feature 023, FR-001) — unchanged by feature 038. */}
        <SelectableListFilter
          label="Format"
          options={FORMAT_OPTIONS}
          value={selectedFormats}
          onChange={setSelectedFormats}
        />
        <SelectableListFilter
          label="Genre"
          options={GENRE_OPTIONS}
          value={selectedGenres}
          onChange={setSelectedGenres}
        />
        <SelectableListFilter
          label="Style"
          options={STYLE_OPTIONS}
          value={selectedStyles}
          onChange={setSelectedStyles}
          searchable
        />
        <FilterActions onClear={handleClear} />
      </form>
    </CollapsibleFilterPanel>
  );
}
