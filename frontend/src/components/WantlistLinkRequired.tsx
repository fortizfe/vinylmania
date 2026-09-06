import { LibraryLinkRequired } from './LibraryLinkRequired';

interface WantlistLinkRequiredProps {
  /**
   * `not-linked`: the user never linked a Discogs account (409).
   * `relink`: Discogs rejected the stored credentials (401).
   */
  variant: 'not-linked' | 'relink';
}

/**
 * The Discogs-link gate for the wishlist (feature 060, FR-002) — the same
 * card, button, and error mapping as the library gate, with wishlist copy.
 */
export function WantlistLinkRequired({ variant }: WantlistLinkRequiredProps) {
  return <LibraryLinkRequired variant={variant} context="wishlist" />;
}
