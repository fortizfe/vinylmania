export abstract class DiscogsError extends Error {
  abstract readonly code: 'not_found' | 'rate_limited' | 'unavailable' | 'validation_error' | 'auth_failed';

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class DiscogsNotFoundError extends DiscogsError {
  readonly code = 'not_found' as const;

  constructor(cause?: unknown) {
    super('No release/artist found for that ID.', cause);
  }
}

export class DiscogsRateLimitError extends DiscogsError {
  readonly code = 'rate_limited' as const;

  constructor(cause?: unknown) {
    super('The catalog service is busy right now — please try again shortly.', cause);
  }
}

export class DiscogsUnavailableError extends DiscogsError {
  readonly code = 'unavailable' as const;

  constructor(cause?: unknown) {
    super('The catalog service is temporarily unavailable.', cause);
  }
}

export class DiscogsValidationError extends DiscogsError {
  readonly code = 'validation_error' as const;

  constructor(cause?: unknown) {
    super('Received unexpected data from the catalog service.', cause);
  }
}

export class DiscogsAuthError extends DiscogsError {
  readonly code = 'auth_failed' as const;

  constructor(cause?: unknown) {
    super('Discogs rejected the linked account credentials.', cause);
  }
}
