import { logger } from '../../src/config/logger';
import {
  __resetRateLimiterForTests,
  acquireSlot,
  MAX_WAIT_MS,
  recordRateLimitHeaders,
} from '../../src/discogs/discogsRateLimiter';

describe('discogsRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetRateLimiterForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('acquireSlot() — delay formula & threshold crossing', () => {
    it('resolves immediately (delay 0) on a cold start, well above the safety threshold', async () => {
      const infoSpy = jest.spyOn(logger, 'info');

      const promise = acquireSlot();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttled' }),
      );
    });

    it('stays at delay 0 while remaining is above ceil(limit * SAFETY_THRESHOLD_RATIO)', async () => {
      // DEFAULT_LIMIT=60, threshold=ceil(60*0.15)=9. Draining down to 10
      // remaining (still above the 9 threshold) must never add a delay.
      const callsAboveThreshold = 60 - 10;
      const start = Date.now();
      for (let i = 0; i < callsAboveThreshold; i += 1) {
        const promise = acquireSlot();
        await jest.advanceTimersByTimeAsync(0);
        await promise;
      }

      expect(Date.now() - start).toBe(0);
    });

    it('applies a non-zero, capped delay once remaining drops to/below the safety threshold', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      // Threshold = ceil(60 * 0.15) = 9. 51 prior calls drain remaining
      // from 60 down to exactly 9, so the 52nd call observes remaining=9<=9.
      const priorCalls = 60 - 9;
      for (let i = 0; i < priorCalls; i += 1) {
        const promise = acquireSlot();
        await jest.advanceTimersByTimeAsync(0);
        await promise;
      }

      const thresholdPromise = acquireSlot();
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
      await thresholdPromise;

      const throttledCall = infoSpy.mock.calls.find(
        ([event]) => event.outcome === 'throttled',
      );
      expect(throttledCall).toBeDefined();
      expect(throttledCall?.[0].meta).toMatchObject({ remaining: 9, limit: 60 });
      expect(throttledCall?.[0].meta?.delayMs).toBeGreaterThan(0);
      expect(throttledCall?.[0].meta?.delayMs).toBeLessThanOrEqual(MAX_WAIT_MS);
    });

    it('never applies a delay greater than MAX_WAIT_MS even when remaining is 1 and the window just reset', async () => {
      recordRateLimitHeaders({
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '1',
      });

      const promise = acquireSlot();
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      // Full window remaining / 1 slot left would exceed MAX_WAIT_MS
      // (1_500ms) absent the cap — confirm it never blocks past the cap.
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 1);
      expect(resolved).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);
    });

    it('decrements the shared remaining budget synchronously on every call', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      recordRateLimitHeaders({
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '10',
      });

      // 10 -> 9: still above threshold (9), delay 0, but next call should
      // observe remaining=9 (at threshold).
      const first = acquireSlot();
      await jest.advanceTimersByTimeAsync(0);
      await first;
      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttled' }),
      );

      const second = acquireSlot();
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
      await second;
      const throttledCall = infoSpy.mock.calls.find(
        ([event]) => event.outcome === 'throttled',
      );
      expect(throttledCall?.[0].meta).toMatchObject({ remaining: 9 });
    });

    it('falls back to zero delay and logs throttle_unavailable on an internal error', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      recordRateLimitHeaders({
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '1',
      });

      const dateNowSpy = jest.spyOn(Date, 'now').mockImplementationOnce(() => {
        throw new Error('clock unavailable');
      });

      await expect(acquireSlot()).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttle_unavailable' }),
      );
      dateNowSpy.mockRestore();
    });
  });

  describe('recordRateLimitHeaders() — header correction', () => {
    it('corrects limit/remaining and re-anchors windowResetAt when both headers are numeric', async () => {
      recordRateLimitHeaders({
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '3',
      });

      // Threshold at limit=60 is 9; remaining=3 is below it, so the very
      // next acquireSlot() call must observe the corrected, low remaining.
      const infoSpy = jest.spyOn(logger, 'info');
      const promise = acquireSlot();
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
      await promise;

      const throttledCall = infoSpy.mock.calls.find(
        ([event]) => event.outcome === 'throttled',
      );
      expect(throttledCall?.[0].meta).toMatchObject({ remaining: 3, limit: 60 });
    });

    it('is a no-op when either header is missing', async () => {
      recordRateLimitHeaders({ 'x-discogs-ratelimit': '60' });
      recordRateLimitHeaders({});

      const infoSpy = jest.spyOn(logger, 'info');
      const promise = acquireSlot();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttled' }),
      );
    });

    it('is a no-op when either header is non-numeric', async () => {
      recordRateLimitHeaders({
        'x-discogs-ratelimit': 'not-a-number',
        'x-discogs-ratelimit-remaining': '3',
      });

      const infoSpy = jest.spyOn(logger, 'info');
      const promise = acquireSlot();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttled' }),
      );
    });
  });

  describe('__resetRateLimiterForTests()', () => {
    it('restores cold-start defaults (limit=remaining=DEFAULT_LIMIT)', async () => {
      recordRateLimitHeaders({
        'x-discogs-ratelimit': '60',
        'x-discogs-ratelimit-remaining': '1',
      });

      __resetRateLimiterForTests();

      const infoSpy = jest.spyOn(logger, 'info');
      const promise = acquireSlot();
      await jest.advanceTimersByTimeAsync(0);
      await promise;

      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'throttled' }),
      );
    });
  });
});
