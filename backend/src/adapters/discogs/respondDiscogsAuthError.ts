import { DiscogsAuthError } from '../../discogs/discogsErrors';
import type { CatalogCredential } from '../../domain/discogsCatalog/types';

export interface DiscogsAuthErrorResponse {
  status: 401;
  body: { error: 'discogs_link_invalid'; message: string };
}

/**
 * Maps a `DiscogsAuthError` to the shared "relink required" HTTP contract
 * (byte-identical across collection and catalog, spec 053 FR-003) — but
 * only when the credential that failed was the user's own linked account.
 * A `DiscogsAuthError` from the `vinylmania` credential means `DISCOGS_TOKEN`
 * itself is broken (an operational problem, not this user's link) and MUST
 * NOT be reported as if the caller had a Discogs link to re-establish
 * (research.md Decision 6) — returns `undefined` so the caller falls
 * through to its existing unmatched-error handling instead.
 *
 * Takes just the credential's `type` (not the full `CatalogCredential`) —
 * this policy never needs the `connection` payload, and collection's own
 * call site (which always uses a `user` credential) has no `CatalogCredential`
 * value on hand, only the fact that it's always identifying with the user's
 * own connection.
 */
export function respondDiscogsAuthError(
  credentialType: CatalogCredential['type'],
  err: unknown,
): DiscogsAuthErrorResponse | undefined {
  if (!(err instanceof DiscogsAuthError) || credentialType !== 'user') {
    return undefined;
  }
  return {
    status: 401,
    body: {
      error: 'discogs_link_invalid',
      message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    },
  };
}
