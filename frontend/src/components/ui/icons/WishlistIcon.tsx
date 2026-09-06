const HEART_PATH =
  'M10 17S3 12.5 3 7.8A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 7 1.8C17 12.5 10 17 10 17Z';

/**
 * Outline heart — the wishlist action/nav icon. Shared so the header nav
 * (`HeaderNavIcons`) and the search/detail "Add to wishlist" action render
 * the exact same shape (feature 060, FR-005: the wishlist action is told
 * apart from the library action by icon shape + accessible name, never by
 * colour alone).
 */
export function WishlistIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={HEART_PATH} />
    </svg>
  );
}

/**
 * Filled heart — the "already in your wishlist" state. A filled vs. outline
 * shape change (not a colour change) signals the state (Constitution X).
 */
export function WishlistIconFilled() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d={HEART_PATH} />
    </svg>
  );
}
