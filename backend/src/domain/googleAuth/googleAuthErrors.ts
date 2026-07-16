/**
 * A login-flow failure the user can act on. `code` maps 1:1 to the error
 * codes in contracts/google-login-api.md.
 */
export class GoogleAuthFlowError extends Error {
  constructor(
    public readonly code: 'denied' | 'invalid_state' | 'expired_state' | 'exchange_failed',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleAuthFlowError';
  }
}
