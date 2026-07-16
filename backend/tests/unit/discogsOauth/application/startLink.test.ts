import { DiscogsOauthFlowError } from '../../../../src/domain/discogsOauth/discogsOauthErrors';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import { createStartLinkUseCase } from '../../../../src/application/discogsOauth/startLink';

const CONNECTED: DiscogsConnection = {
  uid: 'user-a',
  discogsUsername: 'discogs-jane',
  discogsUserId: 99,
  accessToken: 'acc-tok',
  accessTokenSecret: 'acc-sec',
  linkedAt: '2026-01-01T00:00:00.000Z',
};

function fakeConnectionPort(
  overrides: Partial<jest.Mocked<DiscogsConnectionPort>> = {},
): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn().mockResolvedValue({ authorizeUrl: 'https://discogs.example/authorize' }),
    getPendingRequest: jest.fn().mockResolvedValue(null),
    deletePendingRequest: jest.fn().mockResolvedValue(undefined),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn().mockResolvedValue(null),
    deleteConnection: jest.fn().mockResolvedValue(undefined),
    markInitialLibrarySync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('startLink', () => {
  it('creates a pending request and returns its authorizeUrl when no connection exists', async () => {
    const port = fakeConnectionPort();
    const startLink = createStartLinkUseCase({ discogsConnection: port });

    const result = await startLink('user-a');

    expect(result).toEqual({ authorizeUrl: 'https://discogs.example/authorize' });
    expect(port.createPendingRequest).toHaveBeenCalledWith('user-a');
  });

  it('rejects with already_connected and never calls createPendingRequest when a connection exists', async () => {
    const port = fakeConnectionPort({ getConnection: jest.fn().mockResolvedValue(CONNECTED) });
    const startLink = createStartLinkUseCase({ discogsConnection: port });

    await expect(startLink('user-a')).rejects.toMatchObject({ code: 'already_connected' });
    await expect(startLink('user-a')).rejects.toBeInstanceOf(DiscogsOauthFlowError);
    expect(port.createPendingRequest).not.toHaveBeenCalled();
  });
});
