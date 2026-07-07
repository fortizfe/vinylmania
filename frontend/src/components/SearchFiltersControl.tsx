import { type FormEvent, useEffect, useState } from 'react';

import type { SearchFilters } from '../hooks/useSearchQueryParams';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

interface SearchFiltersControlProps {
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClear: () => void;
}

type FilterFields = Required<{ [K in keyof SearchFilters]: string }>;

const EMPTY_FIELDS: FilterFields = { artist: '', genre: '', style: '', format: '' };

function toFields(filters: SearchFilters): FilterFields {
  return {
    artist: filters.artist ?? '',
    genre: filters.genre ?? '',
    style: filters.style ?? '',
    format: filters.format ?? '',
  };
}

export function SearchFiltersControl({ filters, onApply, onClear }: SearchFiltersControlProps) {
  const [fields, setFields] = useState<FilterFields>(() => toFields(filters));

  useEffect(() => {
    setFields(toFields(filters));
  }, [filters.artist, filters.genre, filters.style, filters.format]);

  function updateField(name: keyof FilterFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleApply(event: FormEvent) {
    event.preventDefault();
    const trimmed: SearchFilters = {};
    for (const [name, value] of Object.entries(fields) as [keyof FilterFields, string][]) {
      const value_ = value.trim();
      if (value_) {
        trimmed[name] = value_;
      }
    }
    onApply(trimmed);
  }

  function handleClear() {
    setFields(EMPTY_FIELDS);
    onClear();
  }

  return (
    <Card padding="sm">
      <form onSubmit={handleApply} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-32 flex-1">
          <Input
            id="filter-artist"
            label="Artist"
            value={fields.artist}
            onChange={(event) => updateField('artist', event.target.value)}
          />
        </div>
        <div className="min-w-32 flex-1">
          <Input
            id="filter-genre"
            label="Genre"
            value={fields.genre}
            onChange={(event) => updateField('genre', event.target.value)}
          />
        </div>
        <div className="min-w-32 flex-1">
          <Input
            id="filter-style"
            label="Style"
            value={fields.style}
            onChange={(event) => updateField('style', event.target.value)}
          />
        </div>
        <div className="min-w-32 flex-1">
          <Input
            id="filter-format"
            label="Format"
            value={fields.format}
            onChange={(event) => updateField('format', event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Clear filters
          </Button>
        </div>
      </form>
    </Card>
  );
}
