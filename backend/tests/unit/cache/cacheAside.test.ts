import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

describe('withCache', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns the cached value on a hit and never calls the fetcher', async () => {
    const { withCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    await getRedisClient()!.set('key:1', JSON.stringify({ value: 'cached' }));

    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });
    const result = await withCache('key:1', 60, fetcher);

    expect(result).toEqual({ value: 'cached' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls the fetcher on a miss and stores the result with the given TTL', async () => {
    const { withCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });
    const result = await withCache('key:2', 60, fetcher);

    expect(result).toEqual({ value: 'fresh' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const client = getRedisClient()!;
    const stored = await client.get('key:2');
    expect(JSON.parse(stored as string)).toEqual({ value: 'fresh' });
    const ttl = await client.ttl('key:2');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('falls back to the fetcher without throwing when Redis errors on read', async () => {
    const { withCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    jest
      .spyOn(getRedisClient()!, 'get')
      .mockRejectedValueOnce(new Error('connection reset'));

    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });
    const result = await withCache('key:3', 60, fetcher);

    expect(result).toEqual({ value: 'fresh' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the fetcher result without throwing when Redis errors on write', async () => {
    const { withCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    jest
      .spyOn(getRedisClient()!, 'set')
      .mockRejectedValueOnce(new Error('connection reset'));

    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });
    const result = await withCache('key:4', 60, fetcher);

    expect(result).toEqual({ value: 'fresh' });
  });

  it('propagates a fetcher error unchanged and caches nothing', async () => {
    const { withCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    const fetcher = jest.fn().mockRejectedValue(new Error('upstream failure'));

    await expect(withCache('key:5', 60, fetcher)).rejects.toThrow('upstream failure');
    expect(await getRedisClient()!.get('key:5')).toBeNull();
  });

  it('calls the fetcher directly without touching Redis when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;

    const { withCache } = await import('../../../src/cache/cacheAside');
    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });

    const result = await withCache('key:6', 60, fetcher);

    expect(result).toEqual({ value: 'fresh' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateCache', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('deletes the key so the next read misses', async () => {
    const { invalidateCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    const client = getRedisClient()!;
    await client.set('key:inv', JSON.stringify({ value: 'stale' }));

    await invalidateCache('key:inv');

    expect(await client.get('key:inv')).toBeNull();
  });

  it('does not throw when Redis errors on delete', async () => {
    const { invalidateCache } = await import('../../../src/cache/cacheAside');
    const { getRedisClient } = await import('../../../src/cache/redisClient');

    jest
      .spyOn(getRedisClient()!, 'del')
      .mockRejectedValueOnce(new Error('connection reset'));

    await expect(invalidateCache('key:inv-err')).resolves.toBeUndefined();
  });

  it('is a no-op when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;

    const { invalidateCache } = await import('../../../src/cache/cacheAside');

    await expect(invalidateCache('key:inv-none')).resolves.toBeUndefined();
  });
});
