import type { WantItem } from '../../domain/discogsOauth/wantlistTypes';
import type { DiscogsConnection } from '../../domain/discogsOauth/types';

/**
 * OAuth-1.0a-signed client for the authenticated Discogs wantlist endpoints
 * (`/users/{username}/wants`), acting as the linked user. Reuses the shared
 * resilience machinery (circuit breaker, preventive throttle, retry/backoff)
 * — see `contracts/discogs-wantlist-client.md`.
 */
export interface DiscogsWantlistPort {
  /**
   * Walks every page of `GET /users/{username}/wants`. Newest-first is not
   * guaranteed by Discogs; the caller sorts.
   */
  listWants(connection: DiscogsConnection): Promise<WantItem[]>;

  /** Single want lookup. Resolves `null` on 404 (release not in wantlist). */
  getWant(connection: DiscogsConnection, releaseId: number): Promise<WantItem | null>;

  /**
   * `PUT /users/{username}/wants/{releaseId}`. Upsert: creates the want if
   * absent, updates the provided fields if present. Omitted fields are left
   * unchanged by Discogs. Returns the resulting `WantItem`. Non-idempotent
   * write: `__skipRetry` (the circuit breaker still applies).
   */
  putWant(
    connection: DiscogsConnection,
    releaseId: number,
    fields: { notes?: string; rating?: number },
  ): Promise<WantItem>;

  /**
   * `DELETE /users/{username}/wants/{releaseId}`. Resolves on 204; throws
   * `DiscogsNotFoundError` on 404 (the caller decides whether a 404 is
   * benign). Non-idempotent write: `__skipRetry` (the breaker still applies).
   */
  deleteWant(connection: DiscogsConnection, releaseId: number): Promise<void>;
}
