export interface CachePort {
  /**
   * Fail-soft: MUST NOT reject. Returns `false` when the cache backend is
   * unconfigured, unavailable, or the key is simply absent — callers cannot
   * and MUST NOT distinguish those three cases (parity with today's
   * `isMarkerFresh`, which treats "no Redis" and "Redis errored" and "key
   * missing" identically).
   */
  has(key: string): Promise<boolean>;

  /**
   * Fail-soft: MUST NOT reject. A write failure (or no cache backend
   * configured) is silently swallowed — the caller has no way to observe it
   * and MUST NOT need to (parity with today's `setMarker`).
   */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;

  /**
   * Read-through cache-aside: serves `key` from the cache when present,
   * otherwise calls `fetcher()`, caches its resolved value for `ttlSeconds`,
   * and returns it. Concurrent calls for the same key while a fetch is in
   * flight are coalesced into that one fetch rather than each starting their
   * own. Fail-soft: any cache error (or no cache backend configured) falls
   * back to calling `fetcher()` directly — a cache outage MUST NOT fail the
   * caller's request.
   */
  withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;

  /**
   * Fail-soft: MUST NOT reject. Deletes `key` if present; a cache outage or
   * absent backend is silently swallowed — the caller has no way to observe
   * it and MUST NOT need to, matching `has`/`set`'s existing fail-soft
   * contract.
   */
  invalidate(key: string): Promise<void>;
}
