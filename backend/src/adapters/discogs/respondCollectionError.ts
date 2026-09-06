import { type Response } from 'express';

import { logger } from '../../config/logger';
import {
  DiscogsAuthError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import {
  DiscogsNotLinkedError,
  FieldNotEditableError,
} from '../../domain/library/libraryErrors';
import { respondDiscogsAuthError } from './respondDiscogsAuthError';

/**
 * Maps the shared Discogs gate / collection-failure errors to their HTTP
 * contract (byte-identical across `/api/library` and `/api/wantlist`, see
 * feature 016 `contracts/library-sync-api.md` and feature 060
 * `contracts/wantlist-api.md`). Returns `false` when the error is none of
 * them, so the caller falls through to its own handling.
 *
 * `resourceLabel` only fills the one user-facing noun in the
 * `discogs_not_linked` message ("...to use your library." vs "...wishlist.");
 * every other message is already generic.
 */
export function respondCollectionError(
  res: Response,
  route: string,
  uid: string,
  err: unknown,
  resourceLabel = 'library',
): boolean {
  if (err instanceof DiscogsNotLinkedError) {
    logger.warn({ route, outcome: 'unauthorized', uid, message: 'discogs_not_linked' });
    res.status(409).json({
      error: 'discogs_not_linked',
      message: `Link your Discogs account to use your ${resourceLabel}.`,
    });
    return true;
  }
  if (err instanceof DiscogsAuthError) {
    logger.warn({ route, outcome: 'auth_failed', uid });
    // These clients always identify with the user's own linked account
    // (never a shared app-level credential), so this mapping always applies.
    const response = respondDiscogsAuthError('user', err);
    res.status(response!.status).json(response!.body);
    return true;
  }
  if (err instanceof FieldNotEditableError) {
    res.status(400).json({ error: 'invalid_request', message: err.message });
    return true;
  }
  if (err instanceof DiscogsRateLimitError) {
    logger.warn({ route, outcome: 'rate_limited', uid });
    res.status(429).json({
      error: 'discogs_rate_limited',
      message:
        'Discogs is receiving too many requests right now. Please try again in a moment.',
    });
    return true;
  }
  if (err instanceof DiscogsUnavailableError) {
    logger.warn({ route, outcome: 'unavailable', uid, message: err.message });
    res.status(503).json({
      error: 'discogs_unavailable',
      message: 'Discogs is temporarily unavailable. Please try again later.',
    });
    return true;
  }
  return false;
}
