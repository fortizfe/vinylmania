import { Button } from '../ui/Button';
import { RECORD_DETAIL_TESTIDS } from './testIds';

/**
 * Presentational action bar shared by the three record-detail views (feature
 * 063, contracts/ui-contracts.md §C3 + data-model.md §4). It sits directly
 * under the back-link, above the gallery, and is chrome — never wrapped in a
 * `<Card>` ("Not everything is a card").
 *
 * It owns no data-fetching: every callback, pending flag, added flag and
 * message string is supplied by the page, which keeps the TanStack Query
 * mutations and the `ApiError.code` → message mapping. This component only
 * lays out the `<Button>`s and renders the status / error lines below them in
 * the correct live region (`role="status"` vs `role="alert"`, §C7).
 */

type SearchActionsProps = {
  view: 'search';
  onAddToLibrary: () => void;
  onAddToWishlist: () => void;
  addingToLibrary: boolean;
  addingToWishlist: boolean;
  addedToLibrary: boolean;
  addedToWishlist: boolean;
  gateMessage?: string | null;
  notice?: string | null;
  libraryError?: string | null;
  wishlistError?: string | null;
};

type WishlistActionsProps = {
  view: 'wishlist';
  onAddToLibrary: () => void;
  addingToLibrary: boolean;
  addedToLibrary: boolean;
  gateMessage?: string | null;
  notice?: string | null;
  libraryError?: string | null;
};

type LibraryActionsProps = {
  view: 'library';
  onRemove: () => void;
  removing: boolean;
  removeError?: string | null;
};

type RecordDetailActionsProps =
  | SearchActionsProps
  | WishlistActionsProps
  | LibraryActionsProps;

const statusTextClasses = 'text-sm text-stone-500 dark:text-stone-400';
const errorTextClasses = 'text-sm text-red-600 dark:text-red-400';

function StatusLine({ children }: { children: string }) {
  return (
    <p role="status" className={statusTextClasses}>
      {children}
    </p>
  );
}

function ErrorLine({ children }: { children: string }) {
  return (
    <p role="alert" className={errorTextClasses}>
      {children}
    </p>
  );
}

export function RecordDetailActions(props: RecordDetailActionsProps) {
  return (
    <div
      data-testid={RECORD_DETAIL_TESTIDS.ACTIONS}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap gap-2">
        {props.view === 'library' ? (
          <Button onClick={props.onRemove} loading={props.removing}>
            Remove from library
          </Button>
        ) : (
          <>
            <Button
              onClick={props.onAddToLibrary}
              loading={props.addingToLibrary}
              disabled={props.addedToLibrary}
            >
              {props.addedToLibrary ? 'Added to library' : 'Add to library'}
            </Button>
            {props.view === 'search' && (
              <Button
                variant="secondary"
                onClick={props.onAddToWishlist}
                loading={props.addingToWishlist}
                disabled={props.addedToWishlist}
              >
                {props.addedToWishlist ? 'Added to wishlist' : 'Add to wishlist'}
              </Button>
            )}
          </>
        )}
      </div>

      {props.view !== 'library' && props.gateMessage && (
        <StatusLine>{props.gateMessage}</StatusLine>
      )}
      {props.view !== 'library' && props.notice && (
        <StatusLine>{props.notice}</StatusLine>
      )}
      {props.view !== 'library' && props.libraryError && (
        <ErrorLine>{props.libraryError}</ErrorLine>
      )}
      {props.view === 'search' && props.wishlistError && (
        <ErrorLine>{props.wishlistError}</ErrorLine>
      )}
      {props.view === 'library' && props.removeError && (
        <ErrorLine>{props.removeError}</ErrorLine>
      )}
    </div>
  );
}
