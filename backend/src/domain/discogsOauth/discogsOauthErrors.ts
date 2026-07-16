/**
 * A linking-flow failure the user can act on. `code` maps 1:1 to the error
 * codes in contracts/discogs-oauth-api.md.
 */
export class DiscogsOauthFlowError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'expired_request' | 'already_connected',
    message: string,
  ) {
    super(message);
    this.name = 'DiscogsOauthFlowError';
  }
}
