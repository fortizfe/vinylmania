import type { RawFeedItem } from '../../domain/feeds/types';

export interface FeedSourcePort {
  /**
   * Fetches one feed URL and returns its parsed items as domain-owned
   * `RawFeedItem`s — never a type belonging to the underlying HTTP client or
   * RSS/Atom parsing library (spec 049 FR-012). Rejects on a non-2xx
   * response, a network-level failure, or exceeding `timeoutMs`; callers are
   * responsible for degrading a rejection into a per-source "unavailable"
   * status rather than failing the whole request — this port itself does
   * not catch or retry.
   */
  fetchFeed(feedUrl: string, timeoutMs?: number): Promise<RawFeedItem[]>;
}
