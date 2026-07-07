import { type FormEvent, useEffect, useState } from 'react';

import { FORMAT_OPTIONS } from '../constants/formatOptions';
import type { SearchFilters } from '../hooks/useSearchQueryParams';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

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

function sanitizeOptionId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function SearchFiltersControl({ filters, onApply, onClear }: SearchFiltersControlProps) {
  const [textFields, setTextFields] = useState<TextFields>(() => toTextFields(filters));
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => filters.format ?? []);
  const [formatModalOpen, setFormatModalOpen] = useState(false);

  useEffect(() => {
    setTextFields(toTextFields(filters));
    setSelectedFormats(filters.format ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.genre, filters.style, filters.format]);

  function updateTextField(name: keyof TextFields, value: string) {
    setTextFields((prev) => ({ ...prev, [name]: value }));
  }

  function toggleFormat(option: string) {
    setSelectedFormats((prev) =>
      prev.includes(option) ? prev.filter((value) => value !== option) : [...prev, option],
    );
  }

  function handleApply(event: FormEvent) {
    event.preventDefault();
    const trimmed: SearchFilters = {};
    for (const [name, value] of Object.entries(textFields) as [keyof TextFields, string][]) {
      const value_ = value.trim();
      if (value_) {
        trimmed[name] = value_;
      }
    }
    if (selectedFormats.length > 0) {
      trimmed.format = FORMAT_OPTIONS.filter((option) => selectedFormats.includes(option));
    }
    onApply(trimmed);
  }

  function handleClear() {
    setTextFields(EMPTY_TEXT_FIELDS);
    setSelectedFormats([]);
    onClear();
  }

  const formatButtonLabel =
    selectedFormats.length > 0 ? `Format (${selectedFormats.length})` : 'Format';

  return (
    <>
      <Card padding="sm">
        <form onSubmit={handleApply} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-32 flex-1">
            <Input
              id="filter-genre"
              label="Genre"
              value={textFields.genre}
              onChange={(event) => updateTextField('genre', event.target.value)}
            />
          </div>
          <div className="min-w-32 flex-1">
            <Input
              id="filter-style"
              label="Style"
              value={textFields.style}
              onChange={(event) => updateTextField('style', event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Format</span>
            <Button
              type="button"
              id="filter-format-trigger"
              variant="secondary"
              onClick={() => setFormatModalOpen(true)}
            >
              {formatButtonLabel}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="secondary" onClick={handleClear}>
              Clear filters
            </Button>
          </div>
        </form>
      </Card>

      <Modal open={formatModalOpen} onClose={() => setFormatModalOpen(false)} title="Format">
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {FORMAT_OPTIONS.map((option) => (
            <Checkbox
              key={option}
              id={`filter-format-option-${sanitizeOptionId(option)}`}
              label={option}
              checked={selectedFormats.includes(option)}
              onChange={() => toggleFormat(option)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}
