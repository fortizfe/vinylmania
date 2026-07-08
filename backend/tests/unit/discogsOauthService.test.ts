import { getFirestoreDb } from '../../src/config/firebase-admin';
import { logger } from '../../src/config/logger';
import {
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../src/discogs/discogsErrors';
import {
  completeLink,
  DiscogsOauthFlowError,
  disconnect,
  getConnection,
  startLink,
} from '../../src/discogs/oauth/discogsOauthService';
import { clearEmulatorFirestore } from '../helpers/authEmulator';
import { discogsScope } from '../helpers/nock';

const REQUEST_TOKEN_BODY =
  'oauth_token=req-tok&oauth_token_secret=req-sec&oauth_callback_confirmed=true';
const ACCESS_TOKEN_BODY = 'oauth_token=acc-tok&oauth_token_secret=acc-sec';
const IDENTITY_BODY = { id: 99, username: 'discogs-jane' };
const URLENCODED = { 'Content-Type': 'application/x-www-form-urlencoded' };

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function pendingDoc(oauthToken: string) {
  return getFirestoreDb().collection('discogsOAuthRequests').doc(oauthToken);
}

function connectionDoc(uid: string) {
  return getFirestoreDb().collection('discogsConnections').doc(uid);
}

describe('discogsOauthService', () => {
  beforeAll(() => {
    process.env.DISCOGS_CONSUMER_KEY = 'service-test-key';
    process.env.DISCOGS_CONSUMER_SECRET = 'service-test-secret';
    process.env.DISCOGS_OAUTH_CALLBACK_URL =
      'http://localhost:5173/app/profile/discogs/callback';
  });

  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  describe('startLink', () => {
    it('stores a pending request keyed by the request token, expiring in ~15 minutes', async () => {
      discogsScope()
        .get('/oauth/request_token')
        .reply(200, REQUEST_TOKEN_BODY, URLENCODED);
      const before = Date.now();

      const { authorizeUrl } = await startLink('user-a');

      expect(authorizeUrl).toBe(
        'https://www.discogs.com/oauth/authorize?oauth_token=req-tok',
      );

      const snapshot = await pendingDoc('req-tok').get();
      expect(snapshot.exists).toBe(true);
      const data = snapshot.data()!;
      expect(data.uid).toBe('user-a');
      expect(data.requestTokenSecret).toBe('req-sec');
      const expiresAt = data.expiresAt.toDate().getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + FIFTEEN_MINUTES_MS - 5_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + FIFTEEN_MINUTES_MS + 5_000);
    });
  });

  describe('completeLink', () => {
    async function seedPending(uid: string): Promise<void> {
      discogsScope()
        .get('/oauth/request_token')
        .reply(200, REQUEST_TOKEN_BODY, URLENCODED);
      await startLink(uid);
    }

    it('exchanges the token, verifies identity, persists the connection, and deletes the pending doc', async () => {
      await seedPending('user-a');
      discogsScope()
        .post('/oauth/access_token')
        .reply(200, ACCESS_TOKEN_BODY, URLENCODED);
      discogsScope().get('/oauth/identity').reply(200, IDENTITY_BODY);

      const status = await completeLink('user-a', 'req-tok', 'the-verifier');

      expect(status).toMatchObject({ connected: true, discogsUsername: 'discogs-jane' });

      const stored = (await connectionDoc('user-a').get()).data()!;
      expect(stored.uid).toBe('user-a');
      expect(stored.discogsUsername).toBe('discogs-jane');
      expect(stored.discogsUserId).toBe(99);
      expect(stored.accessToken).toBe('acc-tok');
      expect(stored.accessTokenSecret).toBe('acc-sec');
      expect(stored.linkedAt).toBeDefined();

      expect((await pendingDoc('req-tok').get()).exists).toBe(false);
    });

    it('rejects an unknown oauth token with invalid_request and writes nothing', async () => {
      await expect(completeLink('user-a', 'never-issued', 'v')).rejects.toMatchObject({
        code: 'invalid_request',
      });
      await expect(completeLink('user-a', 'never-issued', 'v')).rejects.toBeInstanceOf(
        DiscogsOauthFlowError,
      );

      expect((await connectionDoc('user-a').get()).exists).toBe(false);
    });

    it('rejects completion by a different uid and retains the pending doc for its owner', async () => {
      await seedPending('user-a');

      await expect(completeLink('user-b', 'req-tok', 'v')).rejects.toMatchObject({
        code: 'invalid_request',
      });

      expect((await pendingDoc('req-tok').get()).exists).toBe(true);
      expect((await connectionDoc('user-b').get()).exists).toBe(false);
    });
  });

  describe('failure handling (US3)', () => {
    async function seedExpiredPending(uid: string): Promise<void> {
      await pendingDoc('req-tok').set({
        uid,
        requestTokenSecret: 'req-sec',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      });
    }

    it('rejects an expired attempt with expired_request, deletes the pending doc, and logs link_failed', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      await seedExpiredPending('user-a');

      await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toMatchObject({
        code: 'expired_request',
      });

      expect((await pendingDoc('req-tok').get()).exists).toBe(false);
      expect((await connectionDoc('user-a').get()).exists).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'link_failed', uid: 'user-a' }),
      );
    });

    it('maps a Discogs 429 during the request-token call to DiscogsRateLimitError', async () => {
      discogsScope().get('/oauth/request_token').reply(429, 'slow down');

      await expect(startLink('user-a')).rejects.toBeInstanceOf(DiscogsRateLimitError);
    });

    it('maps a Discogs 500 during the token exchange to DiscogsUnavailableError, writing nothing', async () => {
      discogsScope()
        .get('/oauth/request_token')
        .reply(
          200,
          'oauth_token=req-tok&oauth_token_secret=req-sec&oauth_callback_confirmed=true',
          URLENCODED,
        );
      await startLink('user-a');
      discogsScope().post('/oauth/access_token').reply(500, 'boom');

      await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toBeInstanceOf(
        DiscogsUnavailableError,
      );
      expect((await connectionDoc('user-a').get()).exists).toBe(false);
    });

    it('treats a Discogs 400 on the exchange as an expired attempt and deletes the pending doc', async () => {
      discogsScope()
        .get('/oauth/request_token')
        .reply(
          200,
          'oauth_token=req-tok&oauth_token_secret=req-sec&oauth_callback_confirmed=true',
          URLENCODED,
        );
      await startLink('user-a');
      discogsScope().post('/oauth/access_token').reply(400, 'expired verifier');

      await expect(completeLink('user-a', 'req-tok', 'v')).rejects.toMatchObject({
        code: 'expired_request',
      });
      expect((await pendingDoc('req-tok').get()).exists).toBe(false);
      expect((await connectionDoc('user-a').get()).exists).toBe(false);
    });
  });

  describe('disconnect (US2)', () => {
    it('removes the stored connection and logs the event', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      await connectionDoc('user-a').set({
        uid: 'user-a',
        discogsUsername: 'discogs-jane',
        discogsUserId: 99,
        accessToken: 'acc-tok',
        accessTokenSecret: 'acc-sec',
        linkedAt: new Date(),
      });

      await disconnect('user-a');

      expect((await connectionDoc('user-a').get()).exists).toBe(false);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'disconnected', uid: 'user-a' }),
      );
    });

    it('is idempotent when nothing is stored', async () => {
      await expect(disconnect('user-none')).resolves.toBeUndefined();
    });
  });

  describe('getConnection', () => {
    it('returns null when no connection is stored', async () => {
      expect(await getConnection('user-none')).toBeNull();
    });

    it('returns the stored connection', async () => {
      await connectionDoc('user-a').set({
        uid: 'user-a',
        discogsUsername: 'discogs-jane',
        discogsUserId: 99,
        accessToken: 'acc-tok',
        accessTokenSecret: 'acc-sec',
        linkedAt: new Date('2026-07-06T09:00:00Z'),
      });

      const connection = await getConnection('user-a');

      expect(connection).toMatchObject({
        uid: 'user-a',
        discogsUsername: 'discogs-jane',
        discogsUserId: 99,
        accessToken: 'acc-tok',
        accessTokenSecret: 'acc-sec',
      });
      expect(connection!.linkedAt).toBe('2026-07-06T09:00:00.000Z');
    });
  });
});
