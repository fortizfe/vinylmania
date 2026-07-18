import RedisMock from 'ioredis-mock';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import { discogsScope } from '../../helpers/nock';

import { getRelease } from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import type { DiscogsConnection } from '../../../src/domain/discogsOauth/types';

const connection: DiscogsConnection = {
  uid: 'cache-parity-user',
  discogsUsername: 'testuser',
  discogsUserId: 42,
  accessToken: 'access-token',
  accessTokenSecret: 'access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

const rawRelease = (id: number) => ({
  id,
  title: 'Cache Parity Release',
  artists: [],
  labels: [],
  formats: [],
  genres: [],
  styles: [],
  tracklist: [],
  images: [],
  uri: `https://www.discogs.com/release/${id}`,
});

describe('Discogs catalog cache: credential-independent (spec 053, US1 edge case)', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('serves a vinylmania-primed cache entry to a subsequent user-credentialed request, unchanged', async () => {
    // Only one interceptor registered — a second outbound call would hit no
    // matching interceptor and reject, so the second call succeeding at all
    // proves it was served from cache, not a second Discogs request.
    discogsScope().get('/releases/9101').reply(200, rawRelease(9101));

    const viaVinylmania = await getRelease({ type: 'vinylmania' }, 9101);
    const viaUser = await getRelease({ type: 'user', connection }, 9101);

    expect(viaUser).toEqual(viaVinylmania);
  });

  it('serves a user-primed cache entry to a subsequent vinylmania-credentialed request, unchanged', async () => {
    discogsScope().get('/releases/9102').reply(200, rawRelease(9102));

    const viaUser = await getRelease({ type: 'user', connection }, 9102);
    const viaVinylmania = await getRelease({ type: 'vinylmania' }, 9102);

    expect(viaVinylmania).toEqual(viaUser);
  });
});
