import { discogsScope } from '../helpers/nock';

import { getArtist, getRelease, searchCatalog } from '../../src/discogs/discogsClient';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../src/discogs/discogsErrors';

describe('Discogs client contract: searchCatalog', () => {
  it('returns mapped release results for a release-scoped search', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Stockholm', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [
          {
            id: 1,
            type: 'release',
            title: 'The Persuader - Stockholm',
            year: '1999',
            format: ['Vinyl', '12"', '33 ⅓ RPM'],
            thumb: '',
            cover_image: 'https://example.com/cover.jpg',
            resource_url: 'https://api.discogs.com/releases/1',
          },
        ],
      });

    const result = await searchCatalog('Stockholm', { resultType: 'release' });

    expect(result.pagination).toEqual({ page: 1, pages: 1, items: 1, perPage: 50 });
    expect(result.results).toEqual([
      {
        discogsId: 1,
        resultType: 'release',
        title: 'Stockholm',
        artist: 'The Persuader',
        year: 1999,
        formats: ['Vinyl', '12"', '33 ⅓ RPM'],
        thumbnailUrl: 'https://example.com/cover.jpg',
      },
    ]);
  });

  it('returns mapped artist results for an artist-scoped search', async () => {
    discogsScope()
      .get('/database/search')
      .query({ q: 'Persuader', type: 'artist', page: '1', per_page: '50' })
      .reply(200, {
        pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
        results: [
          {
            id: 1,
            type: 'artist',
            title: 'The Persuader',
            thumb: '',
            cover_image: '',
            resource_url: 'https://api.discogs.com/artists/1',
          },
        ],
      });

    const result = await searchCatalog('Persuader', { resultType: 'artist' });

    expect(result.results).toEqual([
      {
        discogsId: 1,
        resultType: 'artist',
        title: 'The Persuader',
      },
    ]);
  });

  it('rejects with DiscogsRateLimitError on a 429 response', async () => {
    discogsScope()
      .get('/database/search')
      .query(true)
      .reply(429, { message: 'too many requests' });

    await expect(
      searchCatalog('anything', { resultType: 'release' }),
    ).rejects.toBeInstanceOf(DiscogsRateLimitError);
  });

  it('rejects with DiscogsUnavailableError on a 500 response', async () => {
    discogsScope()
      .get('/database/search')
      .query(true)
      .reply(500, { message: 'server error' });

    await expect(
      searchCatalog('anything', { resultType: 'release' }),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);
  });

  it('rejects with DiscogsUnavailableError on a network error', async () => {
    discogsScope().get('/database/search').query(true).replyWithError('connection reset');

    await expect(
      searchCatalog('anything', { resultType: 'release' }),
    ).rejects.toBeInstanceOf(DiscogsUnavailableError);
  });

  describe('master result rating enrichment (feature 026, US1)', () => {
    it("attaches the master's main/key release rating to a master-type hit", async () => {
      discogsScope()
        .get('/database/search')
        .query({ q: 'Hybrid Theory', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [
            {
              id: 12345,
              type: 'master',
              title: 'Linkin Park - Hybrid Theory',
              year: '2000',
              thumb: '',
              cover_image: '',
              resource_url: 'https://api.discogs.com/masters/12345',
            },
          ],
        });
      discogsScope()
        .get('/masters/12345')
        .reply(200, {
          id: 12345,
          title: 'Hybrid Theory',
          artists: [{ id: 1, name: 'Linkin Park', anv: '', join: '', role: '' }],
          main_release: 98765,
          uri: 'https://www.discogs.com/master/12345',
        });
      discogsScope()
        .get('/releases/98765/rating')
        .reply(200, { release_id: 98765, rating: { average: 4.5, count: 812 } });

      const result = await searchCatalog('Hybrid Theory', { resultType: 'release' });

      expect(result.results[0]).toMatchObject({
        resultType: 'master',
        communityRating: { average: 4.5, count: 812 },
      });
    });

    it('omits communityRating on a master hit when the master lookup fails, without rejecting the search', async () => {
      discogsScope()
        .get('/database/search')
        .query({ q: 'Hybrid Theory Failure', page: '1', per_page: '50' })
        .reply(200, {
          pagination: { page: 1, pages: 1, items: 1, per_page: 50 },
          results: [
            {
              id: 12346,
              type: 'master',
              title: 'Linkin Park - Hybrid Theory',
              thumb: '',
              cover_image: '',
              resource_url: 'https://api.discogs.com/masters/12346',
            },
          ],
        });
      discogsScope().get('/masters/12346').reply(503, { message: 'unavailable' });

      const result = await searchCatalog('Hybrid Theory Failure', {
        resultType: 'release',
      });

      expect(result.results[0].communityRating).toBeUndefined();
      expect(result.results[0].resultType).toBe('master');
    });
  });
});

describe('Discogs client contract: getRelease', () => {
  it('returns the mapped release for a valid ID', async () => {
    discogsScope()
      .get('/releases/1')
      .reply(200, {
        id: 1,
        title: 'Stockholm',
        year: 1999,
        country: 'Sweden',
        artists: [{ id: 1, name: 'The Persuader', anv: '', join: '', role: '' }],
        labels: [{ id: 5, name: 'Svek', catno: 'SK032' }],
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['12"', '33 ⅓ RPM'] }],
        genres: ['Electronic'],
        styles: ['Deep House'],
        tracklist: [
          { position: 'A', type_: 'track', title: 'Östermalm', duration: '4:45' },
          { position: 'B1', type_: 'track', title: 'Vasastaden', duration: '6:11' },
        ],
        images: [
          {
            type: 'primary',
            uri: 'https://example.com/cover.jpg',
            width: 600,
            height: 600,
          },
        ],
        master_id: 1660109,
        uri: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
      });

    const release = await getRelease(1);

    expect(release).toEqual({
      discogsId: 1,
      title: 'Stockholm',
      year: 1999,
      country: 'Sweden',
      artists: [{ discogsArtistId: 1, name: 'The Persuader' }],
      labels: [{ discogsLabelId: 5, name: 'Svek', catalogNumber: 'SK032' }],
      formats: [{ name: 'Vinyl', quantity: 2, descriptions: ['12"', '33 ⅓ RPM'] }],
      genres: ['Electronic'],
      styles: ['Deep House'],
      tracklist: [
        { position: 'A', title: 'Östermalm', duration: '4:45' },
        { position: 'B1', title: 'Vasastaden', duration: '6:11' },
      ],
      images: [
        {
          url: 'https://example.com/cover.jpg',
          imageType: 'primary',
          width: 600,
          height: 600,
        },
      ],
      masterId: 1660109,
      discogsUrl: 'https://www.discogs.com/release/1-The-Persuader-Stockholm',
    });
  });

  it('rejects with DiscogsNotFoundError on a 404 response', async () => {
    discogsScope()
      .get('/releases/999999999')
      .reply(404, { message: 'Release not found' });

    await expect(getRelease(999999999)).rejects.toBeInstanceOf(DiscogsNotFoundError);
  });

  it('rejects with DiscogsRateLimitError on a 429 response', async () => {
    discogsScope().get('/releases/1').reply(429, { message: 'too many requests' });

    await expect(getRelease(1)).rejects.toBeInstanceOf(DiscogsRateLimitError);
  });

  it('rejects with DiscogsUnavailableError on a 500 response and on a network error', async () => {
    discogsScope().get('/releases/1').reply(500, { message: 'server error' });
    await expect(getRelease(1)).rejects.toBeInstanceOf(DiscogsUnavailableError);

    discogsScope().get('/releases/1').replyWithError('connection reset');
    await expect(getRelease(1)).rejects.toBeInstanceOf(DiscogsUnavailableError);
  });
});

describe('Discogs client contract: getArtist', () => {
  it('returns the mapped artist for a valid ID', async () => {
    discogsScope()
      .get('/artists/1')
      .reply(200, {
        id: 1,
        name: 'The Persuader',
        realname: 'Jesper Dahlbäck',
        profile: 'Electronic artist working out of Stockholm, active since 1994.',
        namevariations: ['Persuader', 'The Presuader'],
        aliases: [
          {
            id: 239,
            name: 'Jesper Dahlbäck',
            resource_url: 'https://api.discogs.com/artists/239',
          },
        ],
        images: [
          {
            type: 'primary',
            uri: 'https://example.com/artist.jpg',
            width: 600,
            height: 771,
          },
        ],
        uri: 'https://www.discogs.com/artist/1-The-Persuader',
      });

    const artist = await getArtist(1);

    expect(artist).toEqual({
      discogsId: 1,
      name: 'The Persuader',
      realName: 'Jesper Dahlbäck',
      profile: 'Electronic artist working out of Stockholm, active since 1994.',
      nameVariations: ['Persuader', 'The Presuader'],
      aliases: [{ discogsArtistId: 239, name: 'Jesper Dahlbäck' }],
      images: [
        {
          url: 'https://example.com/artist.jpg',
          imageType: 'primary',
          width: 600,
          height: 771,
        },
      ],
      discogsUrl: 'https://www.discogs.com/artist/1-The-Persuader',
    });
  });

  it('rejects with DiscogsNotFoundError on a 404 response', async () => {
    discogsScope().get('/artists/999999999').reply(404, { message: 'Artist not found' });

    await expect(getArtist(999999999)).rejects.toBeInstanceOf(DiscogsNotFoundError);
  });

  it('rejects with DiscogsRateLimitError on a 429 response', async () => {
    discogsScope().get('/artists/1').reply(429, { message: 'too many requests' });

    await expect(getArtist(1)).rejects.toBeInstanceOf(DiscogsRateLimitError);
  });

  it('rejects with DiscogsUnavailableError on a 500 response and on a network error', async () => {
    discogsScope().get('/artists/1').reply(500, { message: 'server error' });
    await expect(getArtist(1)).rejects.toBeInstanceOf(DiscogsUnavailableError);

    discogsScope().get('/artists/1').replyWithError('connection reset');
    await expect(getArtist(1)).rejects.toBeInstanceOf(DiscogsUnavailableError);
  });
});
