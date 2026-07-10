import { AxiosError, AxiosHeaders } from 'axios';

import {
  backoffDelayMs,
  classifyForRetry,
  MAX_ATTEMPTS,
} from '../../src/discogs/discogsRetry';

function axiosErrorWithStatus(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    undefined,
    undefined,
    undefined,
    {
      status,
      statusText: 'error',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: {},
    },
  );
}

function axiosNetworkError(): AxiosError {
  return new AxiosError('connection reset', 'ECONNRESET');
}

describe('classifyForRetry', () => {
  it('classifies a 429 as rate_limited', () => {
    expect(classifyForRetry(axiosErrorWithStatus(429))).toBe('rate_limited');
  });

  it('classifies a 500/502/503 as unavailable', () => {
    expect(classifyForRetry(axiosErrorWithStatus(500))).toBe('unavailable');
    expect(classifyForRetry(axiosErrorWithStatus(502))).toBe('unavailable');
    expect(classifyForRetry(axiosErrorWithStatus(503))).toBe('unavailable');
  });

  it('classifies a network error (no response) as unavailable', () => {
    expect(classifyForRetry(axiosNetworkError())).toBe('unavailable');
  });

  it('classifies a 404 as not retryable', () => {
    expect(classifyForRetry(axiosErrorWithStatus(404))).toBeNull();
  });

  it('classifies a 401/403 as not retryable', () => {
    expect(classifyForRetry(axiosErrorWithStatus(401))).toBeNull();
    expect(classifyForRetry(axiosErrorWithStatus(403))).toBeNull();
  });

  it('classifies a non-axios error as not retryable', () => {
    expect(classifyForRetry(new Error('mapping failure'))).toBeNull();
  });
});

describe('backoffDelayMs', () => {
  it('returns ~300ms (±20% jitter) for the second attempt', () => {
    const delay = backoffDelayMs(2);
    expect(delay).toBeGreaterThanOrEqual(240);
    expect(delay).toBeLessThanOrEqual(360);
  });

  it('returns ~900ms (±20% jitter) for the third attempt', () => {
    const delay = backoffDelayMs(3);
    expect(delay).toBeGreaterThanOrEqual(720);
    expect(delay).toBeLessThanOrEqual(1080);
  });

  it('keeps the combined worst-case backoff for a fully-retried request under the ~5s FR-010 budget', () => {
    const total = backoffDelayMs(2) + backoffDelayMs(3);
    expect(total).toBeLessThan(5_000);
  });
});

describe('MAX_ATTEMPTS', () => {
  it('is 3 (1 original attempt + 2 retries), per FR-010', () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });
});
