import type { MediaCondition } from '../../domain/discogsOauth/conditionGrading';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';

/**
 * `DiscogsMarketplacePort` ↔ Discogs `GET /marketplace/price_suggestions/{release_id}`
 * (feature 061, contracts/discogs-marketplace-client.md). One method; the
 * OAuth-signed adapter (`discogsMarketplaceAdapter`) is the only implementation.
 */

interface ConditionPrice {
  /** ISO 4217, e.g. "EUR" — the user's Discogs seller currency. */
  currency: string;
  /** Suggested price for that grade. */
  value: number;
}

/** Full per-grade map, or `null` when Discogs has no market data for the release. */
export type PriceSuggestions = Partial<Record<MediaCondition, ConditionPrice>> | null;

export interface DiscogsMarketplacePort {
  getPriceSuggestions(
    connection: DiscogsConnection,
    releaseId: number,
  ): Promise<PriceSuggestions>;
}

/**
 * Redis key for one release's cached price suggestions (data-model §7). Owned
 * by the port so both its adapter (which writes the 7-day entry) and the
 * `getCollectionValuation` use case (which probes `cache.has` to report
 * `fromCacheThisBatch`) name it the same way without either depending on the
 * other — mirrors `fieldsCacheKey` in `domain/discogsOauth/collectionTypes`.
 */
export function priceSuggestionsCacheKey(uid: string, releaseId: number): string {
  return `discogs:pricesuggest:${uid}:${releaseId}`;
}
