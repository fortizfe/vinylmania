import {
  discogsScope,
  rawCollectionInstance,
  stubCollectionFields,
  stubCollectionPage,
} from '../helpers/nock';
import {
  addReleaseToCollection,
  deleteInstance,
  getFieldMap,
  getInstancesForRelease,
  listAllInstances,
  setFieldValue,
  setRating,
} from '../../src/discogs/collection/collectionClient';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../src/discogs/discogsErrors';
import type { DiscogsConnection } from '../../src/discogs/oauth/types';

const connection: DiscogsConnection = {
  uid: 'user-1',
  discogsUsername: 'testuser',
  discogsUserId: 42,
  accessToken: 'access-token',
  accessTokenSecret: 'access-secret',
  linkedAt: '2026-07-01T00:00:00.000Z',
};

beforeAll(() => {
  // Keep the per-user field map from being cached in a real local Redis:
  // without REDIS_URL the cache-aside layer passes straight through.
  delete process.env.REDIS_URL;
});

const OAUTH_TOKEN_HEADER = /oauth_token="access-token"/;

describe('collectionClient: listAllInstances', () => {
  it('walks every page of folder 0 with a signed request and maps named fields', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query((query) => Number(query.page ?? 1) === 1)
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, {
        pagination: { page: 1, pages: 2, per_page: 100, items: 2 },
        releases: [
          rawCollectionInstance(101, {
            instanceId: 11,
            rating: 4,
            mediaCondition: 'Very Good Plus (VG+)',
            sleeveCondition: 'Generic',
            notes: 'First pressing',
            dateAdded: '2025-12-01T00:00:00-08:00',
          }),
        ],
      });
    stubCollectionPage(
      'testuser',
      [rawCollectionInstance(202, { instanceId: 22, folderId: 3 })],
      {
        page: 2,
        pages: 2,
      },
    );

    const instances = await listAllInstances(connection);

    expect(instances).toHaveLength(2);
    expect(instances[0]).toEqual({
      releaseId: 101,
      instanceId: 11,
      folderId: 1,
      rating: 4,
      mediaCondition: 'Very Good Plus (VG+)',
      sleeveCondition: 'Generic',
      notes: 'First pressing',
      dateAdded: expect.any(String),
    });
    expect(instances[1]).toMatchObject({
      releaseId: 202,
      instanceId: 22,
      folderId: 3,
      rating: 0,
      mediaCondition: null,
      sleeveCondition: null,
      notes: null,
    });
  });

  it('maps a 401 to DiscogsAuthError (externally revoked link)', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(401, { message: 'You must authenticate.' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(DiscogsAuthError);
  });

  it('maps a 429 to DiscogsRateLimitError', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(429, { message: 'Too many requests' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsRateLimitError,
    );
  });

  it('maps a 5xx to DiscogsUnavailableError', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .reply(500, { message: 'boom' });

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsUnavailableError,
    );
  });

  it('maps a network failure to DiscogsUnavailableError', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/folders/0/releases')
      .query(true)
      .replyWithError('socket hang up');

    await expect(listAllInstances(connection)).rejects.toBeInstanceOf(
      DiscogsUnavailableError,
    );
  });
});

describe('collectionClient: getFieldMap', () => {
  it('resolves field IDs by their default names', async () => {
    stubCollectionFields('testuser', {
      fields: [
        // Customized account: ids differ from the 1/2/3 defaults.
        { id: 7, name: 'Sleeve Condition', type: 'dropdown' },
        { id: 5, name: 'Media Condition', type: 'dropdown' },
        { id: 9, name: 'Notes', type: 'textarea' },
      ],
    });

    await expect(getFieldMap(connection)).resolves.toEqual({
      mediaConditionFieldId: 5,
      sleeveConditionFieldId: 7,
      notesFieldId: 9,
    });
  });

  it('returns null for fields the user deleted on discogs.com', async () => {
    stubCollectionFields('testuser', {
      fields: [{ id: 3, name: 'Notes', type: 'textarea' }],
    });

    await expect(getFieldMap(connection)).resolves.toEqual({
      mediaConditionFieldId: null,
      sleeveConditionFieldId: null,
      notesFieldId: 3,
    });
  });

  it('maps a 403 to DiscogsAuthError', async () => {
    discogsScope()
      .get('/users/testuser/collection/fields')
      .reply(403, { message: 'forbidden' });

    await expect(getFieldMap(connection)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});

describe('collectionClient: getInstancesForRelease', () => {
  it('returns the instances of one release', async () => {
    stubCollectionFields('testuser');
    discogsScope()
      .get('/users/testuser/collection/releases/101')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(200, {
        pagination: { page: 1, pages: 1, per_page: 100, items: 2 },
        releases: [
          rawCollectionInstance(101, { instanceId: 30 }),
          rawCollectionInstance(101, { instanceId: 12, rating: 5 }),
        ],
      });

    const instances = await getInstancesForRelease(connection, 101);

    expect(instances.map((instance) => instance.instanceId)).toEqual([30, 12]);
  });
});

describe('collectionClient: addReleaseToCollection', () => {
  it('POSTs to the Uncategorized folder and returns the new instance ids', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/1/releases/555')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(201, { instance_id: 777, resource_url: '' });

    await expect(addReleaseToCollection(connection, 555)).resolves.toEqual({
      instanceId: 777,
      folderId: 1,
    });
  });

  it('maps a 404 (unknown release) to DiscogsNotFoundError', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/1/releases/999')
      .reply(404, { message: 'Release not found.' });

    await expect(addReleaseToCollection(connection, 999)).rejects.toBeInstanceOf(
      DiscogsNotFoundError,
    );
  });
});

describe('collectionClient: instance writes', () => {
  const ref = { folderId: 3, releaseId: 101, instanceId: 11 };

  it('deletes an instance from its folder', async () => {
    discogsScope()
      .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(deleteInstance(connection, ref)).resolves.toBeUndefined();
  });

  it('maps a 404 on delete to DiscogsNotFoundError so callers can converge', async () => {
    discogsScope()
      .delete('/users/testuser/collection/folders/3/releases/101/instances/11')
      .reply(404, { message: 'Instance not found.' });

    await expect(deleteInstance(connection, ref)).rejects.toBeInstanceOf(
      DiscogsNotFoundError,
    );
  });

  it('sets the rating via the instance endpoint', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
        rating: 4,
      })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(setRating(connection, ref, 4)).resolves.toBeUndefined();
  });

  it('sets a notes-field value via the fields endpoint', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11/fields/2', {
        value: 'Generic',
      })
      .matchHeader('authorization', OAUTH_TOKEN_HEADER)
      .reply(204);

    await expect(setFieldValue(connection, ref, 2, 'Generic')).resolves.toBeUndefined();
  });

  it('maps a 401 on a write to DiscogsAuthError', async () => {
    discogsScope()
      .post('/users/testuser/collection/folders/3/releases/101/instances/11', {
        rating: 2,
      })
      .reply(401, { message: 'You must authenticate.' });

    await expect(setRating(connection, ref, 2)).rejects.toBeInstanceOf(DiscogsAuthError);
  });
});
