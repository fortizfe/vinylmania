import { useState } from 'react';

import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

interface SelectableListFilterProps {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Renders an in-list search box to narrow large option lists (FR-008, e.g. Style's 757 values). */
  searchable?: boolean;
}

/**
 * Character budget for the trigger's full comma-joined label before it falls
 * back to the abbreviated "first (+N)" form (feature 022 FR-006, generalized
 * in feature 038 from Format-only to any selectable-list filter). A
 * character count is used instead of measured pixel width because it is
 * deterministic across environments (including jsdom, which has no layout
 * engine) while still approximating the trigger's available width.
 */
const MAX_LABEL_LENGTH = 24;

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function triggerLabel(label: string, value: string[]): string {
  if (value.length === 0) return label;
  if (value.length === 1) return value[0];
  const joined = value.join(', ');
  return joined.length <= MAX_LABEL_LENGTH
    ? joined
    : `${value[0]} (+${value.length - 1})`;
}

export function SelectableListFilter({
  label,
  options,
  value,
  onChange,
  searchable = false,
}: SelectableListFilterProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const slug = slugify(label);
  const visibleOptions = searchable
    ? options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  function toggleOption(option: string) {
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );
  }

  function handleClose() {
    setModalOpen(false);
    setSearch('');
  }

  return (
    <>
      <div className="flex flex-1 min-w-40 flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <Button
          type="button"
          id={`filter-${slug}-trigger`}
          variant="secondary"
          onClick={() => setModalOpen(true)}
        >
          {triggerLabel(label, value)}
        </Button>
      </div>

      <Modal open={modalOpen} onClose={handleClose} title={label}>
        <div className="flex flex-col gap-2">
          {searchable && (
            <Input
              id={`filter-${slug}-search`}
              label={`Search ${label.toLowerCase()}`}
              hideLabel
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
            />
          )}
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {visibleOptions.map((option) => (
              <Checkbox
                key={option}
                id={`filter-${slug}-option-${slugify(option)}`}
                label={option}
                checked={value.includes(option)}
                onChange={() => toggleOption(option)}
              />
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
