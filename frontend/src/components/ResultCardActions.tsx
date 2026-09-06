import { Button } from './ui/Button';
import { WishlistIcon, WishlistIconFilled } from './ui/icons/WishlistIcon';

interface ResultCardActionsProps {
  onAdd: () => void;
  adding: boolean;
  added: boolean;
  onAddToWantlist: () => void;
  addingToWantlist: boolean;
  inWantlist: boolean;
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
    </svg>
  );
}

/**
 * The two independent add actions on a search result (feature 060, FR-005):
 * "Add to library" (plus / check icon) and "Add to wishlist" (outline /
 * filled heart). They are told apart by icon shape + accessible name, never
 * by colour alone (Constitution X) — both use the same `secondary` icon
 * button and inherit `Button`'s shared press + loading behaviour.
 */
export function ResultCardActions({
  onAdd,
  adding,
  added,
  onAddToWantlist,
  addingToWantlist,
  inWantlist,
}: ResultCardActionsProps) {
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
      <Button
        size="icon"
        variant="secondary"
        onClick={onAddToWantlist}
        loading={addingToWantlist}
        disabled={inWantlist}
        aria-label={inWantlist ? 'In your wishlist' : 'Add to wishlist'}
      >
        {inWantlist ? <WishlistIconFilled /> : <WishlistIcon />}
      </Button>
    </div>
  );
}
