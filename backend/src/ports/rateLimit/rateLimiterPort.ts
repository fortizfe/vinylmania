export type RateLimitTier = 'strict' | 'standard';

export interface RateLimitDecision {
  /** true = the caller MUST reject the request with 429 */
  limited: boolean;
  /** Seconds until the caller may retry; only meaningful when limited === true */
  retryAfterSeconds: number;
}

export interface RateLimiterPort {
  /**
   * Fail-soft: MUST NOT reject. Increments the counter for (tier, ip)'s
   * current fixed window and returns whether the tier's threshold was
   * exceeded. When the backing store is unavailable or unconfigured, MUST
   * return { limited: false, retryAfterSeconds: 0 } (fail OPEN) — a
   * rate-limiter outage must not take down the endpoints it protects,
   * matching CachePort's existing fail-soft contract.
   */
  checkAndIncrement(tier: RateLimitTier, ip: string): Promise<RateLimitDecision>;
}
