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

    const result = await startLogin();

    expect(port.createPendingLogin).toHaveBeenCalledTimes(1);
    expect(port.getAuthorizeUrl).toHaveBeenCalledWith('abc');
    expect(result).toEqual({
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
    });
  });
});
