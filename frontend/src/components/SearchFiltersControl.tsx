import { type FormEvent, useEffect, useState } from 'react';

import type { SearchFilters } from '../hooks/useSearchQueryParams';
import { Card } from './ui/Card';
import { FormatFilter } from './filters/FormatFilter';
import { TextFilterField } from './filters/TextFilterField';
import { FilterActions } from './filters/FilterActions';

interface SearchFiltersControlProps {
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClear: () => void;
}

interface TextFields {
  genre: string;
  style: string;
}

const EMPTY_TEXT_FIELDS: TextFields = { genre: '', style: '' };

function toTextFields(filters: SearchFilters): TextFields {
  return {
    genre: filters.genre ?? '',
    style: filters.style ?? '',
  };
}

export function SearchFiltersControl({
  filters,
  onApply,
  onClear,
}: SearchFiltersControlProps) {
  const [textFields, setTextFields] = useState<TextFields>(() => toTextFields(filters));
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    () => filters.format ?? [],
  );

  useEffect(() => {
    setTextFields(toTextFields(filters));
    setSelectedFormats(filters.format ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.genre, filters.style, filters.format]);

  function updateTextField(name: keyof TextFields, value: string) {
    setTextFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleApply(event: FormEvent) {
    event.preventDefault();
    const trimmed: SearchFilters = {};
    for (const [name, value] of Object.entries(textFields) as [
      keyof TextFields,
      string,
    ][]) {
      const value_ = value.trim();
      if (value_) {
        trimmed[name] = value_;
      }
    }
    if (selectedFormats.length > 0) {
      trimmed.format = selectedFormats;
    }
    onApply(trimmed);
  }

  function handleClear() {
    setTextFields(EMPTY_TEXT_FIELDS);
    setSelectedFormats([]);
    onClear();
  }

  return (
    <Card padding="sm">
      <form
        onSubmit={handleApply}
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <FormatFilter value={selectedFormats} onChange={setSelectedFormats} />
        <TextFilterField
          id="filter-genre"
          label="Genre"
          value={textFields.genre}
          onChange={(value) => updateTextField('genre', value)}
        />
        <TextFilterField
          id="filter-style"
          label="Style"
          value={textFields.style}
          onChange={(value) => updateTextField('style', value)}
        />
        <FilterActions onClear={handleClear} />
      </form>
    </Card>
  );
}
