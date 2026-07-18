import type { CatalogCredential } from '../../domain/discogsCatalog/types';
import type { DiscogsConnectionPort } from '../../ports/discogsOauth/discogsConnectionPort';

/**
 * Resolves which Discogs credential should identify a catalog request on
 * behalf of `uid` (spec 053). Unlike collection's `requireConnection`, this
 * never throws for an unlinked user — catalog MUST keep working without a
 * link (spec FR-002). Whether a `user` credential is still valid against
 * Discogs is discovered only when it's actually used to sign a request, not
 * here (avoids an extra Discogs round-trip per catalog request).
 */
export async function resolveCatalogCredential(
  discogsConnection: DiscogsConnectionPort,
  uid: string,
): Promise<CatalogCredential> {
  const connection = await discogsConnection.getConnection(uid);
  return connection ? { type: 'user', connection } : { type: 'vinylmania' };
}
