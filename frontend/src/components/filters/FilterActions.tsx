import { Button } from '../ui/Button';

interface FilterActionsProps {
  onClear: () => void;
}

function ApplyIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l3.5 3.5L16 5.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/**
 * Icon-only Apply/Clear controls (FR-010–FR-013): no visible text, but each
 * keeps a distinct `aria-label` so its action stays identifiable to
 * assistive technology.
 */
export function FilterActions({ onClear }: FilterActionsProps) {
  return (
    <div className="flex gap-2">
      <Button type="submit" size="icon" aria-label="Apply filters">
        <ApplyIcon />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Clear filters"
        onClick={onClear}
      >
        <ClearIcon />
      </Button>
    </div>
  );
}
