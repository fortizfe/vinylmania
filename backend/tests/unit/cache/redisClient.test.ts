const RedisMock = jest.fn().mockImplementation(function RedisCtor(this: unknown) {
  Object.assign(this as object, { on: jest.fn(), get: jest.fn(), set: jest.fn() });
});

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

describe('getRedisClient', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    RedisMock.mockClear();
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('constructs a client using process.env.REDIS_URL', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';

    const { getRedisClient } = await import('../../../src/adapters/cache/redisClient');
    getRedisClient();

    expect(RedisMock).toHaveBeenCalledWith('redis://localhost:6379/0', expect.anything());
  });

  it('reuses the same client instance across repeated calls', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';

    const { getRedisClient } = await import('../../../src/adapters/cache/redisClient');
    const first = getRedisClient();
    const second = getRedisClient();

    expect(second).toBe(first);
    expect(RedisMock).toHaveBeenCalledTimes(1);
  });

  it('returns null and constructs no client when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;

    const { getRedisClient } = await import('../../../src/adapters/cache/redisClient');

    expect(getRedisClient()).toBeNull();
    expect(RedisMock).not.toHaveBeenCalled();
  });
});
