import type { GoogleIdentityPort } from '../../../../src/ports/googleAuth/googleIdentityPort';
import { createStartLoginUseCase } from '../../../../src/application/googleAuth/startLogin';

function fakeGoogleIdentity(
  overrides: Partial<jest.Mocked<GoogleIdentityPort>> = {},
): jest.Mocked<GoogleIdentityPort> {
  return {
    getAuthorizeUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc'),
    exchangeCodeForIdentity: jest.fn(),
    createPendingLogin: jest.fn().mockResolvedValue({ state: 'abc' }),
    getPendingLogin: jest.fn(),
    deletePendingLogin: jest.fn(),
    ...overrides,
  };
}

describe('startLogin', () => {
  it('creates a pending login and returns the authorize URL built from its state', async () => {
    const port = fakeGoogleIdentity();
    const startLogin = createStartLoginUseCase({ googleIdentity: port });

    const result = await startLogin({ client: 'web' });

    expect(port.createPendingLogin).toHaveBeenCalledWith({ client: 'web' });
    expect(port.getAuthorizeUrl).toHaveBeenCalledWith('abc', 'web');
    expect(result).toEqual({
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
    });
  });

  it('stores the native client and its PKCE challenge, and builds the native authorize URL', async () => {
    const port = fakeGoogleIdentity();
    const startLogin = createStartLoginUseCase({ googleIdentity: port });

    await startLogin({ client: 'native', codeChallenge: 'the-challenge' });

    expect(port.createPendingLogin).toHaveBeenCalledWith({
      client: 'native',
      codeChallenge: 'the-challenge',
    });
    expect(port.getAuthorizeUrl).toHaveBeenCalledWith('abc', 'native');
  });
});
