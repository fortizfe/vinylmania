import { useState } from 'react';

import { FORMAT_OPTIONS } from '../../constants/formatOptions';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from '../ui/Modal';

interface FormatFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Character budget for the trigger's full comma-joined label before it falls
 * back to the abbreviated "first (+N)" form (FR-006). The exact threshold is
 * an implementation detail left open by the spec (see spec.md Assumptions);
 * a character count is used instead of measured pixel width because it is
 * deterministic across environments (including jsdom, which has no layout
 * engine) while still approximating the trigger's available width.
 */
const MAX_LABEL_LENGTH = 24;

function sanitizeOptionId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function formatTriggerLabel(value: string[]): string {
  if (value.length === 0) return 'Format';
  if (value.length === 1) return value[0];
  const joined = value.join(', ');
  return joined.length <= MAX_LABEL_LENGTH
    ? joined
    : `${value[0]} (+${value.length - 1})`;
}

export function FormatFilter({ value, onChange }: FormatFilterProps) {
  const [modalOpen, setModalOpen] = useState(false);

  function toggleOption(option: string) {
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );
  }

  return (
    <>
      <div className="flex flex-1 min-w-40 flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Format
        </span>
        <Button
          type="button"
          id="filter-format-trigger"
          variant="secondary"
          onClick={() => setModalOpen(true)}
        >
          {formatTriggerLabel(value)}
        </Button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Format">
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {FORMAT_OPTIONS.map((option) => (
            <Checkbox
              key={option}
              id={`filter-format-option-${sanitizeOptionId(option)}`}
              label={option}
              checked={value.includes(option)}
              onChange={() => toggleOption(option)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}
