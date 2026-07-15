import request from 'supertest';

import { discogsScope } from '../../helpers/nock';
import { createApp } from '../../../src/app';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { clearEmulatorUsers, getTestIdToken } from '../../helpers/authEmulator';

const app = createApp();

const rawRelease = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  released: '1999-05-01',
  notes: 'Recorded at Stockholm Sound Studio.',
  artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
  labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"'] }],
  genres: ['Electronic'],
  styles: ['Deep House'],
  identifiers: [{ type: 'Barcode', value: '7 39051 23421 6' }],
  community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
  tracklist: [{ position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' }],
  images: [],
  uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
};

describe('Discogs release preview API contract: GET /api/discogs/releases/:discogsId', () => {
  beforeAll(() => {
    // Deterministic behavior regardless of a local Redis: the success and
    // rate-limit tests below reuse release ID 1, which a real cache-aside
    // hit would otherwise short-circuit.
    delete process.env.REDIS_URL;
  });

  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('returns the full release for an authenticated caller', async () => {
    const { idToken } = await getTestIdToken('preview-user');
    discogsScope().get('/releases/1').reply(200, rawRelease);

    const res = await request(app)
      .get('/api/discogs/releases/1')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      releaseDate: '1999-05-01',
      notes: 'Recorded at Stockholm Sound Studio.',
      artists: [expect.objectContaining({ discogsArtistId: 1, name: 'The Persuader' })],
      identifiers: [
        expect.objectContaining({ type: 'Barcode', value: '7 39051 23421 6' }),
      ],
      community: { have: 214, want: 58, rating: { average: 4.3, count: 37 } },
      tracklist: [expect.objectContaining({ position: 'A', title: 'Östermalm' })],
    });
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/releases/1');

    expect(res.status).toBe(401);
  });

  it('returns 404 release_not_found when the release does not exist', async () => {
    const { idToken } = await getTestIdToken('preview-notfound-user');
    discogsScope().get('/releases/999999999').reply(404, { message: 'not found' });

    const res = await request(app)
      .get('/api/discogs/releases/999999999')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('release_not_found');
  });

  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    const { idToken } = await getTestIdToken('preview-ratelimit-user');
    discogsScope()
      .get('/releases/1')
      .times(MAX_ATTEMPTS)
      .reply(429, { message: 'too many requests' });

    const res = await request(app)
      .get('/api/discogs/releases/1')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });
});
