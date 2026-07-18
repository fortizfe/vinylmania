import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { DiscogsConnectionPort } from '../../../../src/ports/discogsOauth/discogsConnectionPort';
import { resolveCatalogCredential } from '../../../../src/application/discogsCatalog/resolveCatalogCredential';

const UID = 'user-1';

function connection(overrides: Partial<DiscogsConnection> = {}): DiscogsConnection {
  return {
    uid: UID,
    discogsUsername: 'collector',
    discogsUserId: 9,
    accessToken: 'at',
    accessTokenSecret: 'as',
    linkedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeDiscogsConnection(): jest.Mocked<DiscogsConnectionPort> {
  return {
    createPendingRequest: jest.fn(),
    getPendingRequest: jest.fn(),
    deletePendingRequest: jest.fn(),
    exchangeAccessToken: jest.fn(),
    fetchIdentity: jest.fn(),
    saveConnection: jest.fn(),
    getConnection: jest.fn(),
    deleteConnection: jest.fn(),
    markInitialLibrarySync: jest.fn(),
  };
}

describe('resolveCatalogCredential', () => {
  it('resolves to the vinylmania credential when the user has no linked account', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);

    const credential = await resolveCatalogCredential(discogsConnection, UID);

    expect(credential).toEqual({ type: 'vinylmania' });
    expect(discogsConnection.getConnection).toHaveBeenCalledWith(UID);
  });

  it('resolves to the user credential when the user has a linked account', async () => {
    const discogsConnection = fakeDiscogsConnection();
    const linked = connection();
    discogsConnection.getConnection.mockResolvedValue(linked);

    const credential = await resolveCatalogCredential(discogsConnection, UID);

    expect(credential).toEqual({ type: 'user', connection: linked });
  });

  it('never throws for an unlinked user', async () => {
    const discogsConnection = fakeDiscogsConnection();
    discogsConnection.getConnection.mockResolvedValue(null);

    await expect(resolveCatalogCredential(discogsConnection, UID)).resolves.not.toThrow();
  });
});
