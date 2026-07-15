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
}
