import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import { DiscogsNotLinkedError } from '../library/libraryErrors';

/**
 * The user has no Discogs connection — the wantlist is gated exactly like
 * the library (shared gate contract). Re-exported from the library domain
 * so `application/wantlist` never reaches across into `domain/library`.
 */
export { DiscogsNotLinkedError };

/**
 * The catalog lookup that gates adding a release to the wantlist failed with
 * a 404. Thrown only for that step so the driving adapter can map it to
 * `release_not_found` distinctly from a `DiscogsNotFoundError` raised later
 * by the wants write itself. Mirrors `ReleaseNotFoundForCreationError` in
 * `application/library/createLibraryEntry.ts`.
 */
export class ReleaseNotFoundForWantError extends Error {
  constructor(public readonly cause: DiscogsNotFoundError) {
    super(cause.message);
    this.name = 'ReleaseNotFoundForWantError';
  }
}

/**
 * Same rationale as {@link ReleaseNotFoundForWantError}, for the
 * `catalog_unavailable` (502) branch — the catalog lookup that gates the add
 * was rate-limited or unavailable. Mirrors `CatalogUnavailableForCreationError`
 * in `application/library/createLibraryEntry.ts`.
 */
export class CatalogUnavailableForWantError extends Error {
  constructor(
    public readonly cause: DiscogsRateLimitError | DiscogsUnavailableError,
  ) {
    super(cause.message);
    this.name = 'CatalogUnavailableForWantError';
  }
}
