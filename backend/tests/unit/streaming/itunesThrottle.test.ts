import {
  __resetItunesThrottleForTests,
  MIN_ITUNES_INTERVAL_MS,
  throttleItunesCall,
} from '../../../src/adapters/streaming/itunesSearchAdapter';
import { logger } from '../../../src/config/logger';
import { StreamingRateLimitedError } from '../../../src/domain/streaming/streamingErrors';

/**
 * T031 (US3) — the in-process minimum-interval throttle that wraps every
 * outbound iTunes Search call (research.md §2). It spaces calls so the app
 * stays within iTunes' documented ~20 req/min limit, and a call that cannot
 * proceed within its window fails fast as `StreamingRateLimitedError` — which
 * `resolveStreamingLinks` never caches, so the record stays eligible for a
 * later view.
 */
describe('itunesSearchAdapter in-process minimum-interval throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetItunesThrottleForTests();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lets the first call through immediately', async () => {
    await expect(throttleItunesCall()).resolves.toBeUndefined();
  });

  it('spaces a second back-to-back call by at least the minimum interval', async () => {
    await throttleItunesCall();

    let released = false;
    const second = throttleItunesCall().then(() => {
      released = true;
    });

    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS - 1);
    expect(released).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await second;
    expect(released).toBe(true);
  });

  it('permits a steady ~20 calls/minute (one every 3s) with no rejection', async () => {
    for (let i = 0; i < 20; i += 1) {
      await expect(throttleItunesCall()).resolves.toBeUndefined();
      await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS);
    }
  });

  it('fails fast with StreamingRateLimitedError once a call is already waiting on the window', async () => {
    await throttleItunesCall(); // proceeds, opens the window
    const waiting = throttleItunesCall(); // the single permitted waiter
    void waiting.catch(() => undefined);

    await expect(throttleItunesCall()).rejects.toBeInstanceOf(StreamingRateLimitedError);
    await expect(throttleItunesCall()).rejects.toBeInstanceOf(StreamingRateLimitedError);

    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS * 3);
    await waiting;
  });

  it('under a sustained burst, most calls reject as rate_limited rather than queueing unboundedly', async () => {
    await throttleItunesCall();

    const burst = [
      throttleItunesCall(),
      throttleItunesCall(),
      throttleItunesCall(),
      throttleItunesCall(),
      throttleItunesCall(),
    ];
    burst.forEach((p) => void p.catch(() => undefined));

    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS * burst.length);
    const settled = await Promise.allSettled(burst);

    const rejected = settled.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(burst.length - 1);
    rejected.forEach((r) => {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
        StreamingRateLimitedError,
      );
    });
  });

  it('reopens after the interval elapses (a rejection is not sticky)', async () => {
    await throttleItunesCall();
    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS);
    await expect(throttleItunesCall()).resolves.toBeUndefined();
  });

  it('logs a greppable warn line when it fails fast (distinct from an Apple-side 403)', async () => {
    await throttleItunesCall();
    const waiting = throttleItunesCall();
    void waiting.catch(() => undefined);

    await expect(throttleItunesCall()).rejects.toBeInstanceOf(StreamingRateLimitedError);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'streaming:itunes:throttle',
        outcome: 'rate_limited',
        meta: expect.objectContaining({ reason: 'local_min_interval_exceeded' }),
      }),
    );

    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS * 3);
    await waiting;
  });

  it('logs a "throttled" info line with the wait when it spaces a call', async () => {
    await throttleItunesCall();
    const second = throttleItunesCall();
    void second.catch(() => undefined);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'streaming:itunes:throttle',
        outcome: 'throttled',
        meta: expect.objectContaining({ waitMs: expect.any(Number) }),
      }),
    );

    await jest.advanceTimersByTimeAsync(MIN_ITUNES_INTERVAL_MS);
    await second;
  });
});
