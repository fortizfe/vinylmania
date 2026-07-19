import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

describe('createRateLimitStore', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
    jest.resetModules();
  });

  it('always returns a Store synchronously', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRateLimitStore } = require('../../../src/adapters/rateLimit/rateLimitStore');
    const store = createRateLimitStore();
    expect(typeof store.increment).toBe('function');
  });

  it('counts correctly via the in-memory fallback when REDIS_URL is not configured', async () => {
    process.env.REDIS_URL = '';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRateLimitStore } = require('../../../src/adapters/rateLimit/rateLimitStore');
    const store = createRateLimitStore();

    // MemoryStore.increment() returns a shared, mutable per-key record (not
    // a snapshot) — assert each result immediately, before the next call
    // mutates the same object.
    const first = await store.increment('test-key-memory');
    expect(first.totalHits).toBe(1);

    const second = await store.increment('test-key-memory');
    expect(second.totalHits).toBe(2);
  });

  it('counts correctly via the Redis-backed store (INCR/PEXPIRE, no Lua scripting) when REDIS_URL is configured', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRateLimitStore } = require('../../../src/adapters/rateLimit/rateLimitStore');
    const store = createRateLimitStore();

    const first = await store.increment('test-key-redis');
    expect(first.totalHits).toBe(1);
    expect(first.resetTime).toBeInstanceOf(Date);

    const second = await store.increment('test-key-redis');
    expect(second.totalHits).toBe(2);
  });

  it('does not call getRedisClient() at construction time — only on first increment() (regression guard)', async () => {
    // Regression: resolving Redis availability eagerly at construction
    // previously called getRedisClient() before a test file's beforeAll had
    // a chance to set REDIS_URL, permanently memoizing "no Redis" for every
    // *other* Redis-backed consumer in that same test file (observed: it
    // silently broke a catalog cache-hit test in
    // discogsRetryResilience.test.ts, which populates its cache before the
    // assertion that depends on it).
    process.env.REDIS_URL = '';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redisClientModule = require('../../../src/adapters/cache/redisClient');
    const getRedisClientSpy = jest.spyOn(redisClientModule, 'getRedisClient');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRateLimitStore } = require('../../../src/adapters/rateLimit/rateLimitStore');

    const store = createRateLimitStore();
    expect(getRedisClientSpy).not.toHaveBeenCalled();

    // express-rate-limit calls store.init(options) synchronously the moment
    // rateLimit(...) is called (still at route-module import time) — this
    // is the exact call that reintroduced the bug once, since init() had
    // resolved the delegate directly. It must not touch Redis either.
    store.init?.({ windowMs: 60_000 });
    expect(getRedisClientSpy).not.toHaveBeenCalled();

    await store.increment('test-key-lazy');
    expect(getRedisClientSpy).toHaveBeenCalled();
  });
});
