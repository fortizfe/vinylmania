/**
 * Domain errors for streaming-link resolution.
 *
 * Mirrors the `DiscogsError` pattern in `backend/src/discogs/discogsErrors.ts`.
 * Thrown by a resolver for a **transient** failure only — a "record not on this
 * platform" is not an error, it is a `null` return.
 */

export abstract class StreamingResolutionError extends Error {
  abstract readonly code: 'unavailable' | 'rate_limited';

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class StreamingUnavailableError extends StreamingResolutionError {
  readonly code = 'unavailable' as const;

  constructor(cause?: unknown) {
    super('The streaming service is temporarily unavailable.', cause);
  }
}

export class StreamingRateLimitedError extends StreamingResolutionError {
  readonly code = 'rate_limited' as const;

  constructor(cause?: unknown) {
    super('The streaming service is busy right now — please try again shortly.', cause);
  }
}
