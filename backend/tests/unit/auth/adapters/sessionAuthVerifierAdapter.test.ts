import { createSessionAuthVerifierAdapter } from '../../../../src/adapters/auth/sessionAuthVerifierAdapter';
import type { Session } from '../../../../src/domain/auth/session';
import type { SessionStorePort } from '../../../../src/ports/auth/sessionStorePort';

function fakeSessionStore(overrides: Partial<jest.Mocked<SessionStorePort>> = {}): jest.Mocked<SessionStorePort> {
  return {
    createSession: jest.fn(),
    touchSession: jest.fn(),
    revokeSession: jest.fn(),
    ...overrides,
  };
}

const session: Session = {
  sessionId: 'session-1',
  uid: 'uid-1',
  createdAt: '2026-07-16T00:00:00.000Z',
  lastSeenAt: '2026-07-16T00:00:00.000Z',
  expiresAt: '2026-07-30T00:00:00.000Z',
};

describe('sessionAuthVerifierAdapter', () => {
  it('delegates to SessionStorePort.touchSession and maps a hit to AuthenticatedUser', async () => {
    const sessionStore = fakeSessionStore({
      touchSession: jest.fn().mockResolvedValue(session),
    });
    const adapter = createSessionAuthVerifierAdapter({ sessionStore });

    const result = await adapter.verifySession('session-1');

    expect(sessionStore.touchSession).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({ uid: 'uid-1' });
  });

  it('rejects when the session is unknown or expired (touchSession resolves null)', async () => {
    const sessionStore = fakeSessionStore({
      touchSession: jest.fn().mockResolvedValue(null),
    });
    const adapter = createSessionAuthVerifierAdapter({ sessionStore });

    await expect(adapter.verifySession('stale-or-unknown')).rejects.toThrow();
  });
});
