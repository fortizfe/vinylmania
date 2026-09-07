/**
 * Domain errors for "Mi colección en cifras" (feature 061). No HTTP knowledge
 * — the route adapter maps these to status codes (data-model §6).
 */

// The link gate is identical to the library / wantlist gate; re-exported so
// the collectionStats use cases and route import one name from their own slice.
export { DiscogsNotLinkedError } from '../library/libraryErrors';

/**
 * The linked Discogs account reached the marketplace endpoint but has no
 * seller settings configured on discogs.com, so `price_suggestions` is
 * unavailable to it. Distinct from `DiscogsAuthError` (a revoked token):
 * Block 1 is unaffected and Block 2 shows a tailored, non-blocking notice.
 * Mirrors the `DiscogsError` hierarchy's `(message, cause)` shape.
 */
export class SellerSettingsRequiredError extends Error {
  constructor(public readonly cause?: unknown) {
    super(
      "Discogs only provides price estimates once you've completed your seller settings on discogs.com.",
    );
    this.name = 'SellerSettingsRequiredError';
  }
}
