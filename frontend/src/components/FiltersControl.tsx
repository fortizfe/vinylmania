import { type FormEvent, useEffect, useState } from 'react';

import { Button } from './ui/Button';
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
interface FilterValues {
  genre?: string[];
  style?: string[];
  format?: string[];
}

interface FiltersControlProps<T extends FilterValues> {
  filters: T;
  onApply: (filters: T) => void;
  onClear: () => void;
  /**
   * Library variant (spec 068 D13, FR-021a): the sheet/drawer is the
   * container, so there is no collapsible wrapper, no `<form>` and no Apply —
   * every tick calls `onApply` with the full next selection immediately, and
   * the facets render as inline `<details>` disclosures. Search passes
   * nothing and keeps the Apply flow unchanged.
   */
  live?: boolean;
}

type FacetKey = 'genre' | 'style' | 'format';

/** Drops emptied facets, so `{}` means "no filters" for both call sites. */
function toPayload(selection: Record<FacetKey, string[]>): FilterValues {
  const next: FilterValues = {};
  if (selection.genre.length > 0) next.genre = selection.genre;
  if (selection.style.length > 0) next.style = selection.style;
  if (selection.format.length > 0) next.format = selection.format;
  return next;
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
  live = false,
}: FiltersControlProps<T>) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    () => filters.genre ?? [],
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    () => filters.style ?? [],
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    () => filters.format ?? [],
  );

  useEffect(() => {
    setSelectedGenres(filters.genre ?? []);
    setSelectedStyles(filters.style ?? []);
    setSelectedFormats(filters.format ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.genre, filters.style, filters.format]);

  const selection: Record<FacetKey, string[]> = {
    genre: selectedGenres,
    style: selectedStyles,
    format: selectedFormats,
  };
  const setters: Record<FacetKey, (value: string[]) => void> = {
    genre: setSelectedGenres,
    style: setSelectedStyles,
    format: setSelectedFormats,
  };

  function handleApply(event: FormEvent) {
    event.preventDefault();
    onApply(toPayload(selection) as T);
  }

  /** `live`: commit the whole next selection as soon as a facet ticks. */
  function handleLiveChange(key: FacetKey, value: string[]) {
    setters[key](value);
    onApply(toPayload({ ...selection, [key]: value }) as T);
  }

  function handleClear() {
    setSelectedGenres([]);
    setSelectedStyles([]);
    setSelectedFormats([]);
    onClear();
  }

  function facetProps(key: FacetKey) {
    return {
      value: selection[key],
      onChange: live ? (value: string[]) => handleLiveChange(key, value) : setters[key],
      inline: live,
    };
  }

  const facets = (
    <>
      {/* Format leads the filter bar (feature 023, FR-001) — unchanged by feature 038. */}
      <SelectableListFilter
        label="Format"
        options={FORMAT_OPTIONS}
        {...facetProps('format')}
      />
      <SelectableListFilter
        label="Genre"
        options={GENRE_OPTIONS}
        {...facetProps('genre')}
      />
      <SelectableListFilter
        label="Style"
        options={STYLE_OPTIONS}
        searchable
        {...facetProps('style')}
      />
    </>
  );

  if (live) {
    const hasActive = activeCount(toPayload(selection)) > 0;
    return (
      <div className="flex flex-col gap-2">
        {facets}
        {/* Always rendered and always focusable: `aria-disabled` (not
            `disabled`) so focus is never dropped when the last filter
            clears (spec 068 D13). */}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          aria-disabled={hasActive ? undefined : true}
          onClick={hasActive ? handleClear : undefined}
        >
          Clear all filters
        </Button>
      </div>
    );
  }

  return (
    <CollapsibleFilterPanel activeCount={activeCount(filters)}>
      <form
        onSubmit={handleApply}
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {facets}
        <FilterActions onClear={handleClear} />
      </form>
    </CollapsibleFilterPanel>
  );
}
