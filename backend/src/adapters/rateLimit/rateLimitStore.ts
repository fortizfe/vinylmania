import { MemoryStore, type ClientRateLimitInfo, type IncrementResponse, type Options, type Store } from 'express-rate-limit';

import { getRedisClient } from '../cache/redisClient';

const KEY_PREFIX = 'ratelimit:';

/**
 * Minimal Redis-backed Store using only INCR/PEXPIRE/PTTL/DECR/DEL — no Lua
 * scripting. `rate-limit-redis` (the "official" companion store) was tried
 * first, but its increment path unconditionally uses SCRIPT LOAD/EVALSHA for
 * atomicity, which `ioredis-mock` does not implement at all (several
 * existing test files, e.g. discogsRetryResilience.test.ts, globally mock
 * `ioredis` for unrelated reasons and would break the moment a rate-limited
 * route they exercise tried to use it). CodeQL's js/missing-rate-limiting
 * recognition (research.md §2b) is keyed off the `rateLimit(...)` call
 * itself, not the store implementation passed to it, so a custom store
 * carries no detection risk.
 */
class RedisIncrExpireStore implements Store {
  private windowMs = 60_000;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const client = getRedisClient()!;
    const redisKey = KEY_PREFIX + key;
    const totalHits = await client.incr(redisKey);
    if (totalHits === 1) {
      await client.pexpire(redisKey, this.windowMs);
    }
    const ttl = await client.pttl(redisKey);
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    await getRedisClient()!.decr(KEY_PREFIX + key);
  }

  async resetKey(key: string): Promise<void> {
    await getRedisClient()!.del(KEY_PREFIX + key);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const client = getRedisClient()!;
    const redisKey = KEY_PREFIX + key;
    const [hits, ttl] = await Promise.all([client.get(redisKey), client.pttl(redisKey)]);
    if (hits === null) {
      return undefined;
    }
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
  }
}

/**
 * Defers the Redis-vs-in-memory decision to the first actual rate-limit
 * check, not to when the route module is imported / rateLimit(...) is
 * constructed.
 *
 * getRedisClient() memoizes globally on its own first call (shared by every
 * consumer, e.g. the cache adapter — not scoped per caller). Route modules
 * are imported at `createApp()` time, which in every test file happens at
 * module top level, before that file's `beforeAll` has a chance to set
 * REDIS_URL. Resolving the store eagerly would call getRedisClient() too
 * early and permanently memoize "no Redis" for the whole file — silently
 * breaking every *other* Redis-backed feature in that test file (observed:
 * it broke a catalog cache-hit test in discogsRetryResilience.test.ts).
 *
 * express-rate-limit calls `store.init(options)` synchronously the moment
 * `rateLimit(...)` is called (i.e. still at route-module import time) — so
 * `init()` below only captures `options` for later; it must NOT resolve the
 * delegate itself. Resolution is deferred to the first increment()/get()/
 * etc. call, which only ever happens inside an actual request, safely after
 * beforeAll has run — matches how every other Redis consumer in this
 * codebase already behaves.
 */
class LazyRedisOrMemoryStore implements Store {
  private delegate: Store | undefined;
  private pendingInitOptions: Options | undefined;

  private resolve(): Store {
    if (!this.delegate) {
      this.delegate = getRedisClient() ? new RedisIncrExpireStore() : new MemoryStore();
      if (this.pendingInitOptions) {
        void this.delegate.init?.(this.pendingInitOptions);
      }
    }
    return this.delegate;
  }

  init(options: Options): void {
    this.pendingInitOptions = options;
  }

  get(key: string): Promise<ClientRateLimitInfo | undefined> | ClientRateLimitInfo | undefined {
    return this.resolve().get?.(key);
  }

  increment(key: string): Promise<IncrementResponse> | IncrementResponse {
    return this.resolve().increment(key);
  }

  decrement(key: string): Promise<void> | void {
    return this.resolve().decrement(key);
  }

  resetKey(key: string): Promise<void> | void {
    return this.resolve().resetKey(key);
  }
}

/**
 * Returns a Store that transparently uses a Redis-backed store (so counters
 * are consistent across the concurrent isolates a Vercel serverless
 * deployment can run — an in-memory store would not be, per research.md §2)
 * once REDIS_URL is configured, and express-rate-limit's own in-memory
 * MemoryStore otherwise (local dev, tests) — decided lazily, see above.
 */
export function createRateLimitStore(): Store {
  return new LazyRedisOrMemoryStore();
}
