import { useState } from 'react';
import clsx from 'clsx';

import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { focusRing } from '../ui/focusRing';
import { pressableRow } from '../ui/press';

interface SelectableListFilterProps {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Renders an in-list search box to narrow large option lists (FR-008, e.g. Style's 757 values). */
  searchable?: boolean;
  /**
   * Renders the facet as a native `<details>` disclosure instead of a
   * trigger + nested `Modal` (spec 068 D13). Required inside the Library's
   * sheet/drawer, where a nested overlay cannot be positioned or dismissed
   * correctly. Documented exception to the animated `disclosure` pattern:
   * native, instant, nothing to reduce.
   */
  inline?: boolean;
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
  inline = false,
}: SelectableListFilterProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const slug = slugify(label);
  const visibleOptions = searchable
    ? options.filter((option) =>
        option.toLowerCase().includes(search.trim().toLowerCase()),
      )
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

  /**
   * A `searchable` facet is by definition the long one (Style's 757 values):
   * inside an `inline` disclosure its checkboxes are mounted only while the
   * disclosure is open, so a shut facet costs no DOM. Short facets (Genre,
   * Format) keep their list mounted, which is what the trigger + `Modal`
   * path has always done.
   */
  const showOptions = !inline || !searchable || expanded;

  const optionList = (
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
        {showOptions &&
          visibleOptions.map((option) => (
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
  );

  if (inline) {
    return (
      <details
        className="border-b border-stone-200 last:border-b-0 dark:border-stone-800"
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className={clsx(
            'min-h-11 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-stone-700 dark:text-stone-300',
            focusRing,
            pressableRow,
          )}
        >
          {value.length > 0 ? `${label} (${value.length} selected)` : label}
        </summary>
        <div className="px-2 pb-3">{optionList}</div>
      </details>
    );
  }

  return (
    <>
      <div className="flex flex-1 min-w-40 flex-col gap-1">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
        {optionList}
      </Modal>
    </>
  );
}
