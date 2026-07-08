import request from 'supertest';

import { discogsScope } from '../helpers/nock';
import { createApp } from '../../src/app';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

const app = createApp();

const rawMaster = {
  id: 1660109,
  title: 'Hybrid Theory',
  year: 2000,
  artists: [{ id: 1, name: 'Linkin Park', anv: '', join: '', role: '' }],
  genres: ['Rock'],
  styles: ['Nu Metal'],
  images: [
    { type: 'primary', uri: 'https://example.com/cover.jpg', width: 600, height: 600 },
  ],
  tracklist: [{ position: '1', type_: 'track', title: 'Papercut', duration: '3:05' }],
  main_release: 98765,
  uri: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
};

describe('Discogs master API contract: GET /api/discogs/masters/:discogsId', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('returns the mapped master release for an authenticated caller', async () => {
    const { idToken } = await getTestIdToken('master-detail-user');

    discogsScope().get('/masters/1660109').reply(200, rawMaster);

    const res = await request(app)
      .get('/api/discogs/masters/1660109')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      discogsId: 1660109,
      title: 'Hybrid Theory',
      year: 2000,
      artists: [{ discogsArtistId: 1, name: 'Linkin Park' }],
      genres: ['Rock'],
      styles: ['Nu Metal'],
      images: [
        {
          url: 'https://example.com/cover.jpg',
          imageType: 'primary',
          width: 600,
          height: 600,
        },
      ],
      tracklist: [{ position: '1', title: 'Papercut', duration: '3:05' }],
      mainReleaseId: 98765,
      discogsUrl: 'https://www.discogs.com/master/1660109-Linkin-Park-Hybrid-Theory',
    });
  });

  it('returns 404 master_not_found when Discogs has no master for that ID', async () => {
    const { idToken } = await getTestIdToken('master-detail-notfound-user');

    discogsScope().get('/masters/999999999').reply(404, { message: 'Master not found' });

    const res = await request(app)
      .get('/api/discogs/masters/999999999')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('master_not_found');
  });

  it('returns 502 catalog_unavailable when Discogs is rate-limited', async () => {
    const { idToken } = await getTestIdToken('master-detail-ratelimit-user');

    discogsScope().get('/masters/1660109').reply(429, { message: 'too many requests' });

    const res = await request(app)
      .get('/api/discogs/masters/1660109')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('catalog_unavailable');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/discogs/masters/1660109');

    expect(res.status).toBe(401);
  });
});

describe('Discogs master versions API contract: GET /api/discogs/masters/:discogsId/versions', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('returns a paginated version list, defaulting to 10 per page (spec FR-009)', async () => {
    const { idToken } = await getTestIdToken('master-versions-user');

    discogsScope()
      .get('/masters/1660109/versions')
      .query({ page: '1', per_page: '10' })
      .reply(200, {
        pagination: { page: 1, pages: 3, items: 27, per_page: 10 },
        versions: [
          {
            id: 98765,
            title: 'Hybrid Theory',
            format: 'Vinyl, LP, Album',
            label: 'Warner Bros. Records',
            catno: '9362-47755-1',
            released: '2000',
            country: 'US',
            thumb: 'https://example.com/thumb.jpg',
          },
        ],
      });

    const res = await request(app)
      .get('/api/discogs/masters/1660109/versions')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      results: [
        {
          discogsId: 98765,
          title: 'Hybrid Theory',
          format: 'Vinyl, LP, Album',
          label: 'Warner Bros. Records',
          year: 2000,
          country: 'US',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
      ],
      pagination: { page: 1, pages: 3, items: 27, perPage: 10 },
    });
  });

  it('forwards the requested page to the catalog', async () => {
    const { idToken } = await getTestIdToken('master-versions-page-user');

    discogsScope()
      .get('/masters/1660109/versions')
      .query({ page: '2', per_page: '10' })
      .reply(200, {
        pagination: { page: 2, pages: 3, items: 27, per_page: 10 },
        versions: [],
      });

    const res = await request(app)
      .get('/api/discogs/masters/1660109/versions')
      .query({ page: '2' })
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
  });

  it('returns 404 master_not_found when Discogs has no master for that ID', async () => {
    const { idToken } = await getTestIdToken('master-versions-notfound-user');

    discogsScope()
      .get('/masters/999999999/versions')
      .query({ page: '1', per_page: '10' })
      .reply(404, { message: 'Master not found' });

    const res = await request(app)
      .get('/api/discogs/masters/999999999/versions')
      .set('Authorization', `Bearer ${idToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('master_not_found');
  });
});
