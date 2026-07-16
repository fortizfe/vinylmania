import { DiscogsOauthFlowError } from '../../../../src/domain/discogsOauth/discogsOauthErrors';
import type { DiscogsConnection, PendingOAuthRequest } from '../../../../src/domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import { createCompleteLinkUseCase } from '../../../../src/application/discogsOauth/completeLink';

const CONNECTED: DiscogsConnection = {
  uid: 'user-a',
  discogsUsername: 'discogs-jane',
  discogsUserId: 99,
  accessToken: 'acc-tok',
  accessTokenSecret: 'acc-sec',
  linkedAt: '2026-01-01T00:00:00.000Z',
};

const FRESH_PENDING: PendingOAuthRequest = {
  uid: 'user-a',
  requestTokenSecret: 'req-sec',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const EXPIRED_PENDING: PendingOAuthRequest = {
  uid: 'user-a',
  requestTokenSecret: 'req-sec',
  createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  expiresAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

function fakeConnectionPort(
  overrides: Partial<jest.Mocked<DiscogsConnectionPort>> = {},
): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn().mockResolvedValue(FRESH_PENDING),
    deletePendingRequest: jest.fn().mockResolvedValue(undefined),
    exchangeAccessToken: jest.fn().mockResolvedValue({
      accessToken: 'acc-tok',
      accessTokenSecret: 'acc-sec',
    }),
    fetchIdentity: jest.fn().mockResolvedValue({
      discogsUserId: 99,
      discogsUsername: 'discogs-jane',
    }),
    saveConnection: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockResolvedValue(null),
    deleteConnection: jest.fn().mockResolvedValue(undefined),
    markInitialLibrarySync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('completeLink', () => {
  it('rejects already_connected without touching the pending request when a connection exists', async () => {
    const port = fakeConnectionPort({ getConnection: jest.fn().mockResolvedValue(CONNECTED) });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    await expect(completeLink('user-a', 'req-tok', 'verifier')).rejects.toMatchObject({
      code: 'already_connected',
    });
    expect(port.getPendingRequest).not.toHaveBeenCalled();
  });

  it('rejects invalid_request when the pending request is unknown', async () => {
    const port = fakeConnectionPort({ getPendingRequest: jest.fn().mockResolvedValue(null) });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    await expect(completeLink('user-a', 'never-issued', 'v')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(completeLink('user-a', 'never-issued', 'v')).rejects.toBeInstanceOf(
      DiscogsOauthFlowError,
    );
  });

  it('rejects invalid_request without deleting the pending request on an ownership mismatch', async () => {
    const port = fakeConnectionPort({
      getPendingRequest: jest.fn().mockResolvedValue({ ...FRESH_PENDING, uid: 'user-b' }),
    });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    expect(port.deletePendingRequest).not.toHaveBeenCalled();
  });

  it('deletes the pending request and rejects expired_request when it is past its window', async () => {
    const port = fakeConnectionPort({
      getPendingRequest: jest.fn().mockResolvedValue(EXPIRED_PENDING),
    });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toMatchObject({
      code: 'expired_request',
    });
    expect(port.deletePendingRequest).toHaveBeenCalledWith('req-tok');
  });

  it('deletes the pending request and re-throws when the port signals an expired handshake', async () => {
    const flowError = new DiscogsOauthFlowError('expired_request', 'Link attempt expired.');
    const port = fakeConnectionPort({
      exchangeAccessToken: jest.fn().mockRejectedValue(flowError),
    });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toBe(flowError);
    expect(port.deletePendingRequest).toHaveBeenCalledWith('req-tok');
  });

  it('exchanges the token, fetches identity, saves the connection, and deletes the pending request in order', async () => {
    const calls: string[] = [];
    const port = fakeConnectionPort({
      exchangeAccessToken: jest.fn().mockImplementation(async () => {
        calls.push('exchangeAccessToken');
        return { accessToken: 'acc-tok', accessTokenSecret: 'acc-sec' };
      }),
      fetchIdentity: jest.fn().mockImplementation(async () => {
        calls.push('fetchIdentity');
        return { discogsUserId: 99, discogsUsername: 'discogs-jane' };
      }),
      saveConnection: jest.fn().mockImplementation(async () => {
        calls.push('saveConnection');
      }),
      deletePendingRequest: jest.fn().mockImplementation(async () => {
        calls.push('deletePendingRequest');
      }),
    });
    const completeLink = createCompleteLinkUseCase({ discogsConnection: port });

    const status = await completeLink('user-a', 'req-tok', 'the-verifier');

    expect(calls).toEqual([
      'exchangeAccessToken',
      'fetchIdentity',
      'saveConnection',
      'deletePendingRequest',
    ]);
    expect(status).toMatchObject({ connected: true, discogsUsername: 'discogs-jane' });
    expect(port.exchangeAccessToken).toHaveBeenCalledWith('req-tok', 'req-sec', 'the-verifier');
  });
});
