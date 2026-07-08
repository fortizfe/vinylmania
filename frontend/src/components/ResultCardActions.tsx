import { Button } from './ui/Button';

interface ResultCardActionsProps {
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
    </svg>
  );
}

export function ResultCardActions({ onAdd, adding, added }: ResultCardActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="secondary"
        onClick={onAdd}
        loading={adding}
        disabled={added}
        aria-label={added ? 'Added to library' : 'Add to library'}
      >
        {added ? <CheckIcon /> : <PlusIcon />}
      </Button>
    </div>
  );
}
