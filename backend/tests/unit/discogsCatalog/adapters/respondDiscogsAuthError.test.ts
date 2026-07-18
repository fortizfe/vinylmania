import { respondDiscogsAuthError } from '../../../../src/adapters/discogs/respondDiscogsAuthError';
import { DiscogsAuthError, DiscogsUnavailableError } from '../../../../src/discogs/discogsErrors';

describe('respondDiscogsAuthError', () => {
  it('returns the 401 discogs_link_invalid body when the credential is the user\'s own and the error is a DiscogsAuthError', () => {
    const result = respondDiscogsAuthError('user', new DiscogsAuthError());

    expect(result).toEqual({
      status: 401,
      body: {
        error: 'discogs_link_invalid',
        message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
      },
    });
  });

  it('returns undefined when the credential is vinylmania\'s own, even for a DiscogsAuthError (mis-attribution guard)', () => {
    const result = respondDiscogsAuthError('vinylmania', new DiscogsAuthError());

    expect(result).toBeUndefined();
  });

  it('returns undefined for a non-DiscogsAuthError, regardless of credential', () => {
    const result = respondDiscogsAuthError('user', new DiscogsUnavailableError());

    expect(result).toBeUndefined();
  });
});
