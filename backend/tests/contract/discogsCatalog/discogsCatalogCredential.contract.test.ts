import { discogsScope } from '../../helpers/nock';

import {
  getArtist,
  getMasterRelease,
  getMasterReleaseVersions,
  getRelease,
  getReleaseRating,
  searchCatalog,
} from '../../../src/adapters/discogsCatalog/discogsCatalogAdapter';
import { DiscogsAuthError } from '../../../src/discogs/discogsErrors';
import type { DiscogsConnection } from '../../../src/domain/discogsOauth/types';
import type { CatalogCredential } from '../../../src/domain/discogsCatalog/types';

const connection: DiscogsConnection = {
  uid: 'user-1',
  discogsUsername: 'testuser',
  discogsUserId: 42,
  accessToken: 'access-token',
  accessTokenSecret: 'access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

const USER_CREDENTIAL: CatalogCredential = { type: 'user', connection };
const VINYLMANIA_CREDENTIAL: CatalogCredential = { type: 'vinylmania' };

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;
const APP_TOKEN_HEADER = /^Discogs token=/;

const rawRelease = {
  id: 6001,
  title: 'Stockholm',
  year: 1999,
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  identifiers: [],
  tracklist: [{ position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' }],
  images: [],
  uri: 'https://www.discogs.com/release/6001-The-Persuader-Stockholm',
};

const rawMaster = {
  id: 7001,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ id: 1, name: 'Linkin Park', anv: '', join: '', role: '' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [],
  tracklist: [],
  main_release: 98765,
  uri: 'https://www.discogs.com/master/7001-Linkin-Park-Hybrid-Theory',
};

const rawArtist = {
  id: 8001,
  name: 'The Persuader',
  realname: 'Jesper Dahlbäck',
  profile: 'Electronic artist working out of Stockholm, active since 1994.',
  namevariations: [],
  aliases: [],
  images: [],
  uri: 'https://www.discogs.com/artist/8001-The-Persuader',
};

beforeAll(() => {
  // Deterministic behavior regardless of a local Redis: every credential
  // type reuses the same catalog IDs, which a real cache-aside hit would
  // otherwise short-circuit (and which US1's own T012 cache test relies on
  // being observable per-call here).
  delete process.env.REDIS_URL;
});

describe('discogsCatalogAdapter: credential attribution (spec 053, US1/US2)', () => {
  it('getRelease signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope().get('/releases/6001').matchHeader('authorization', OAUTH_TOKEN_HEADER).reply(200, rawRelease);

    const release = await getRelease(USER_CREDENTIAL, 6001);

    expect(release.discogsId).toBe(6001);
  });

  it('getRelease signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope().get('/releases/6002').matchHeader('authorization', APP_TOKEN_HEADER).reply(200, {
      ...rawRelease,
      id: 6002,
    });

    const release = await getRelease(VINYLMANIA_CREDENTIAL, 6002);

    expect(release.discogsId).toBe(6002);
  });

  it('returns identical mapped content regardless of which credential identified the request (FR-007)', async () => {
    discogsScope().get('/releases/6003').matchHeader('authorization', OAUTH_TOKEN_HEADER).reply(200, {
      ...rawRelease,
      id: 6003,
    });
    discogsScope().get('/releases/6004').matchHeader('authorization', APP_TOKEN_HEADER).reply(200, {
      ...rawRelease,
      id: 6004,
    });

    const [viaUser, viaVinylmania] = await Promise.all([
      getRelease(USER_CREDENTIAL, 6003),
      getRelease(VINYLMANIA_CREDENTIAL, 6004),
    ]);

    // Same stubbed payload shape mapped through the same code path — only
    // the requested ID differs, everything else must be byte-identical.
    expect({ ...viaUser, discogsId: 0 }).toEqual({ ...viaVinylmania, discogsId: 0 });
  });

  it('getMasterRelease signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope().get('/masters/7001').matchHeader('authorization', OAUTH_TOKEN_HEADER).reply(200, rawMaster);

    const master = await getMasterRelease(USER_CREDENTIAL, 7001);

    expect(master.discogsId).toBe(7001);
  });

  it('getMasterRelease signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope().get('/masters/7002').matchHeader('authorization', APP_TOKEN_HEADER).reply(200, {
      ...rawMaster,
      id: 7002,
    });

    const master = await getMasterRelease(VINYLMANIA_CREDENTIAL, 7002);

    expect(master.discogsId).toBe(7002);
  });

  it('getMasterReleaseVersions signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope()
      .get('/masters/7001/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 10 }, versions: [] });

    const versions = await getMasterReleaseVersions(USER_CREDENTIAL, 7001);

    expect(versions.pagination.page).toBe(1);
  });

  it('getMasterReleaseVersions signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope()
      .get('/masters/7002/versions')
      .query({ page: '1', per_page: '10' })
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 10 }, versions: [] });

    const versions = await getMasterReleaseVersions(VINYLMANIA_CREDENTIAL, 7002);

    expect(versions.pagination.page).toBe(1);
  });

  it('getReleaseRating signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope()
      .get('/releases/6005/rating')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { release_id: 6005, rating: { average: 4.5, count: 10 } });

    const rating = await getReleaseRating(USER_CREDENTIAL, 6005);

    expect(rating.count).toBe(10);
  });

  it('getReleaseRating signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope()
      .get('/releases/6006/rating')
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { release_id: 6006, rating: { average: 4.5, count: 10 } });

    const rating = await getReleaseRating(VINYLMANIA_CREDENTIAL, 6006);

    expect(rating.count).toBe(10);
  });

  it('getArtist signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope().get('/artists/8001').matchHeader('authorization', OAUTH_TOKEN_HEADER).reply(200, rawArtist);

    const artist = await getArtist(USER_CREDENTIAL, 8001);

    expect(artist.discogsId).toBe(8001);
  });

  it('getArtist signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope().get('/artists/8002').matchHeader('authorization', APP_TOKEN_HEADER).reply(200, {
      ...rawArtist,
      id: 8002,
    });

    const artist = await getArtist(VINYLMANIA_CREDENTIAL, 8002);

    expect(artist.discogsId).toBe(8002);
  });

  it('searchCatalog signs with the linked user OAuth token when given a user credential', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 50 }, results: [] });

    const result = await searchCatalog(USER_CREDENTIAL, 'Stockholm', { resultType: 'release' });

    expect(result.pagination.page).toBe(1);
  });

  it('searchCatalog signs with DISCOGS_TOKEN when given the vinylmania credential', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
      .matchHeader('authorization', APP_TOKEN_HEADER)
      .reply(200, { pagination: { page: 1, pages: 1, items: 0, per_page: 50 }, results: [] });

    const result = await searchCatalog(VINYLMANIA_CREDENTIAL, 'Stockholm', { resultType: 'release' });

    expect(result.pagination.page).toBe(1);
  });

  it('a user-credentialed call whose credentials are rejected by Discogs rejects with DiscogsAuthError (US3 precondition)', async () => {
    discogsScope().get('/releases/6007').matchHeader('authorization', OAUTH_TOKEN_HEADER).reply(401, {
      message: 'unauthorized',
    });

    await expect(getRelease(USER_CREDENTIAL, 6007)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});
