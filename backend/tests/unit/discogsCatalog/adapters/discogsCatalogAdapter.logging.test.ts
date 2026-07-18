import { discogsScope } from '../../../helpers/nock';

import { getRelease } from '../../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import type { DiscogsConnection } from '../../../../src/domain/discogsOauth/types';
import type { CatalogCredential } from '../../../../src/domain/discogsCatalog/types';
import { logger } from '../../../../src/config/logger';

const connection: DiscogsConnection = {
  uid: 'user-1',
  discogsUsername: 'testuser',
  discogsUserId: 42,
  accessToken: 'super-secret-access-token',
  accessTokenSecret: 'super-secret-access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

const USER_CREDENTIAL: CatalogCredential = { type: 'user', connection };
const VINYLMANIA_CREDENTIAL: CatalogCredential = { type: 'vinylmania' };

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  artists: [],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [],
  images: [],
  uri: 'https://www.discogs.com/release/1',
};

function loggedMeta(): Record<string, unknown>[] {
  const calls = [
    ...(logger.info as jest.Mock).mock.calls,
    ...(logger.warn as jest.Mock).mock.calls,
    ...(logger.error as jest.Mock).mock.calls,
  ];
  return calls.map(([event]) => event as Record<string, unknown>);
}

describe('discogsCatalogAdapter: credential-type audit logging (spec 053, US4)', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'warn');
    jest.spyOn(logger, 'error');
  });

  it('logs meta.credentialType "user" for a successful user-credentialed call', async () => {
    discogsScope().get('/releases/8001').reply(200, { ...rawRelease, id: 8001 });

    await getRelease(USER_CREDENTIAL, 8001);

    const events = loggedMeta();
    const releaseEvent = events.find((e) => e.route === '/releases/8001');
    expect(releaseEvent?.meta).toMatchObject({ credentialType: 'user' });
  });

  it('logs meta.credentialType "vinylmania" for a successful vinylmania-credentialed call', async () => {
    discogsScope().get('/releases/8002').reply(200, { ...rawRelease, id: 8002 });

    await getRelease(VINYLMANIA_CREDENTIAL, 8002);

    const events = loggedMeta();
    const releaseEvent = events.find((e) => e.route === '/releases/8002');
    expect(releaseEvent?.meta).toMatchObject({ credentialType: 'vinylmania' });
  });

  it('logs meta.credentialType matching the credential that failed with auth_failed', async () => {
    discogsScope().get('/releases/8003').reply(401, { message: 'unauthorized' });

    await expect(getRelease(USER_CREDENTIAL, 8003)).rejects.toThrow();

    const events = loggedMeta();
    const authFailedEvent = events.find((e) => e.outcome === 'auth_failed' && e.route === '/releases/8003');
    expect(authFailedEvent?.meta).toMatchObject({ credentialType: 'user' });
  });

  it('never logs the connection access token or secret value', async () => {
    discogsScope().get('/releases/8004').reply(200, { ...rawRelease, id: 8004 });
    discogsScope().get('/releases/8005').reply(401, { message: 'unauthorized' });

    await getRelease(USER_CREDENTIAL, 8004);
    await expect(getRelease(USER_CREDENTIAL, 8005)).rejects.toThrow();

    const serialized = JSON.stringify(loggedMeta());
    expect(serialized).not.toContain(connection.accessToken);
    expect(serialized).not.toContain(connection.accessTokenSecret);
  });
});
