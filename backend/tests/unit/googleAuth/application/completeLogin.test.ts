import { GoogleAuthFlowError } from '../../../../src/domain/googleAuth/googleAuthErrors';
import type { PendingGoogleLogin } from '../../../../src/domain/googleAuth/types';
import type { Session } from '../../../../src/domain/auth/session';
import type { UserProfile } from '../../../../src/domain/users/types';
import type { GoogleIdentityPort } from '../../../../src/ports/googleAuth/googleIdentityPort';
import type { IdentityResolverPort } from '../../../../src/ports/auth/identityResolverPort';
import type { SessionStorePort } from '../../../../src/ports/auth/sessionStorePort';
import { createCompleteLoginUseCase } from '../../../../src/application/googleAuth/completeLogin';

const FRESH_PENDING: PendingGoogleLogin = {
  state: 'fresh-state',
  client: 'web',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const EXPIRED_PENDING: PendingGoogleLogin = {
  state: 'expired-state',
  client: 'web',
  createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  expiresAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

// RFC 7636 Appendix B
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const NATIVE_PENDING: PendingGoogleLogin = {
  ...FRESH_PENDING,
  client: 'native',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
};

const IDENTITY = {
  sub: 'google-sub-1',
  email: 'jane@example.com',
  name: 'Jane Doe',
  picture: 'https://example.com/p.png',
};
const USER_PROFILE: UserProfile = {
  uid: 'uid-1',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  createdAt: '2026-07-01T00:00:00.000Z',
  lastSignInAt: '2026-07-16T00:00:00.000Z',
};
const SESSION: Session = {
  sessionId: 'session-1',
  uid: 'uid-1',
  createdAt: '2026-07-16T00:00:00.000Z',
  lastSeenAt: '2026-07-16T00:00:00.000Z',
  expiresAt: '2026-07-30T00:00:00.000Z',
};

function fakeGoogleIdentity(
  overrides: Partial<jest.Mocked<GoogleIdentityPort>> = {},
): jest.Mocked<GoogleIdentityPort> {
  return {
    getAuthorizeUrl: jest.fn(),
    exchangeCodeForIdentity: jest.fn().mockResolvedValue(IDENTITY),
    createPendingLogin: jest.fn(),
    getPendingLogin: jest.fn().mockResolvedValue(FRESH_PENDING),
    deletePendingLogin: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeIdentityResolver(
  overrides: Partial<jest.Mocked<IdentityResolverPort>> = {},
): jest.Mocked<IdentityResolverPort> {
  return {
    resolveOrCreateUser: jest.fn().mockResolvedValue({ uid: 'uid-1' }),
    ...overrides,
  };
}

function fakeSessionStore(
  overrides: Partial<jest.Mocked<SessionStorePort>> = {},
): jest.Mocked<SessionStorePort> {
  return {
    createSession: jest.fn().mockResolvedValue(SESSION),
    touchSession: jest.fn(),
    revokeSession: jest.fn(),
    ...overrides,
  };
}

function makeUseCase(overrides: {
  googleIdentity?: jest.Mocked<GoogleIdentityPort>;
  identityResolver?: jest.Mocked<IdentityResolverPort>;
  sessionStore?: jest.Mocked<SessionStorePort>;
  syncUserProfile?: jest.Mock;
} = {}) {
  const googleIdentity = overrides.googleIdentity ?? fakeGoogleIdentity();
  const identityResolver = overrides.identityResolver ?? fakeIdentityResolver();
  const sessionStore = overrides.sessionStore ?? fakeSessionStore();
  const syncUserProfile = overrides.syncUserProfile ?? jest.fn().mockResolvedValue(USER_PROFILE);

  return {
    completeLogin: createCompleteLoginUseCase({
      googleIdentity,
      identityResolver,
      sessionStore,
      syncUserProfile,
    }),
    googleIdentity,
    identityResolver,
    sessionStore,
    syncUserProfile,
  };
}

describe('completeLogin', () => {
  it('rejects denied without touching the pending login', async () => {
    const { completeLogin, googleIdentity } = makeUseCase();

    await expect(
      completeLogin({ state: 'fresh-state', denied: true }),
    ).rejects.toMatchObject({ code: 'denied' });
    expect(googleIdentity.getPendingLogin).not.toHaveBeenCalled();
  });

  it('rejects invalid_state when the pending login is unknown', async () => {
    const { completeLogin } = makeUseCase({
      googleIdentity: fakeGoogleIdentity({ getPendingLogin: jest.fn().mockResolvedValue(null) }),
    });

    await expect(completeLogin({ code: 'abc', state: 'never-issued' })).rejects.toMatchObject({
      code: 'invalid_state',
    });
    await expect(
      completeLogin({ code: 'abc', state: 'never-issued' }),
    ).rejects.toBeInstanceOf(GoogleAuthFlowError);
  });

  it('deletes the pending login and rejects expired_state when it is past its window', async () => {
    const { completeLogin, googleIdentity } = makeUseCase({
      googleIdentity: fakeGoogleIdentity({
        getPendingLogin: jest.fn().mockResolvedValue(EXPIRED_PENDING),
      }),
    });

    await expect(
      completeLogin({ code: 'abc', state: 'expired-state' }),
    ).rejects.toMatchObject({ code: 'expired_state' });
    expect(googleIdentity.deletePendingLogin).toHaveBeenCalledWith('expired-state');
  });

  it('exchanges the code, resolves the uid, syncs the profile, creates a session, and deletes the pending login in order', async () => {
    const calls: string[] = [];
    const { completeLogin, syncUserProfile, sessionStore } = makeUseCase({
      googleIdentity: fakeGoogleIdentity({
        exchangeCodeForIdentity: jest.fn().mockImplementation(async () => {
          calls.push('exchangeCodeForIdentity');
          return IDENTITY;
        }),
        deletePendingLogin: jest.fn().mockImplementation(async () => {
          calls.push('deletePendingLogin');
        }),
      }),
      identityResolver: fakeIdentityResolver({
        resolveOrCreateUser: jest.fn().mockImplementation(async () => {
          calls.push('resolveOrCreateUser');
          return { uid: 'uid-1' };
        }),
      }),
      syncUserProfile: jest.fn().mockImplementation(async () => {
        calls.push('syncUserProfile');
        return USER_PROFILE;
      }),
      sessionStore: fakeSessionStore({
        createSession: jest.fn().mockImplementation(async () => {
          calls.push('createSession');
          return SESSION;
        }),
      }),
    });

    const result = await completeLogin({ code: 'auth-code', state: 'fresh-state' });

    expect(calls).toEqual([
      'exchangeCodeForIdentity',
      'resolveOrCreateUser',
      'syncUserProfile',
      'createSession',
      'deletePendingLogin',
    ]);
    expect(syncUserProfile).toHaveBeenCalledWith({
      uid: 'uid-1',
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      photoURL: 'https://example.com/p.png',
    });
    expect(sessionStore.createSession).toHaveBeenCalledWith('uid-1');
    expect(result).toEqual({ sessionToken: 'session-1', user: USER_PROFILE });
  });

  it('does not delete the pending login when the exchange itself fails', async () => {
    const exchangeError = new GoogleAuthFlowError('exchange_failed', 'boom');
    const { completeLogin, googleIdentity } = makeUseCase({
      googleIdentity: fakeGoogleIdentity({
        exchangeCodeForIdentity: jest.fn().mockRejectedValue(exchangeError),
      }),
    });

    await expect(completeLogin({ code: 'auth-code', state: 'fresh-state' })).rejects.toBe(
      exchangeError,
    );
    expect(googleIdentity.deletePendingLogin).not.toHaveBeenCalled();
  });

  it('exchanges the code with the pending login client', async () => {
    const { completeLogin, googleIdentity } = makeUseCase();

    await completeLogin({ code: 'auth-code', state: 'fresh-state' });

    expect(googleIdentity.exchangeCodeForIdentity).toHaveBeenCalledWith(
      'auth-code',
      'web',
    );
  });

  it('ignores a codeVerifier on a web pending login', async () => {
    const { completeLogin } = makeUseCase();

    await expect(
      completeLogin({
        code: 'auth-code',
        state: 'fresh-state',
        codeVerifier: 'whatever',
      }),
    ).resolves.toEqual({ sessionToken: 'session-1', user: USER_PROFILE });
  });

  describe('native pending login (PKCE)', () => {
    function nativeUseCase() {
      return makeUseCase({
        googleIdentity: fakeGoogleIdentity({
          getPendingLogin: jest.fn().mockResolvedValue(NATIVE_PENDING),
        }),
      });
    }

    it('completes with a matching verifier and exchanges with the native client', async () => {
      const { completeLogin, googleIdentity } = nativeUseCase();

      const result = await completeLogin({
        code: 'auth-code',
        state: 'fresh-state',
        codeVerifier: VERIFIER,
      });

      expect(result).toEqual({ sessionToken: 'session-1', user: USER_PROFILE });
      expect(googleIdentity.exchangeCodeForIdentity).toHaveBeenCalledWith(
        'auth-code',
        'native',
      );
    });

    it.each([
      ['missing', undefined],
      ['wrong', `${VERIFIER.slice(0, -1)}A`],
    ])(
      'rejects invalid_state with a %s verifier and keeps the pending login',
      async (_label, codeVerifier) => {
        const { completeLogin, googleIdentity } = nativeUseCase();

        await expect(
          completeLogin({ code: 'auth-code', state: 'fresh-state', codeVerifier }),
        ).rejects.toMatchObject({ code: 'invalid_state' });
        expect(googleIdentity.exchangeCodeForIdentity).not.toHaveBeenCalled();
        expect(googleIdentity.deletePendingLogin).not.toHaveBeenCalled();
      },
    );
  });
});
