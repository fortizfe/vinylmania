import RedisMock from 'ioredis-mock';
import request from 'supertest';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

import {
  discogsScope,
  rawCollectionInstance,
  stubCollectionFields,
  stubCollectionPage,
} from '../../helpers/nock';
import { MAX_ATTEMPTS } from '../../../src/discogs/discogsRetry';
import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

/**
 * Feature 061, T038 (US2) — `GET /api/collection-stats/valuation`
 * (`contracts/collection-stats-api.md`). Emulator-backed (Firestore + Auth);
 * runs in CI where the emulators are up. MUST fail before T043 wires the real
 * handler (the stub returns 501).
 */

const app = createApp();

beforeAll(() => {
  process.env.REDIS_URL = 'redis://localhost:6379/0';
});

afterEach(async () => {
  await getRedisClient()!.flushall();
  await clearEmulatorUsers();
  await clearEmulatorFirestore();
});

async function linkDiscogs(uid: string): Promise<string> {
  const username = `collector-${uid}`;
  await getFirestoreDb()
    .collection('discogsConnections')
    .doc(uid)
    .set({
      uid,
      discogsUsername: username,
      discogsUserId: 42,
      accessToken: 'access-token',
      accessTokenSecret: 'access-secret',
      linkedAt: new Date('2026-07-01T00:00:00.000Z'),
      initialLibrarySyncAt: new Date('2026-07-02T00:00:00.000Z'),
    });
  return username;
}

const VG = 'Very Good (VG)';
const PRICE_MAP = {
  [VG]: { currency: 'EUR', value: 4.95 },
  'Near Mint (NM or M-)': { currency: 'EUR', value: 12.4 },
};

describe('GET /api/collection-stats/valuation (feature 061, US2)', () => {
  it('returns 409 discogs_not_linked when the caller has no connection', async () => {
    const { sessionToken } = await createTestSession('val-unlinked');
    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('discogs_not_linked');
  });

  it('rejects a negative / non-integer cursor with 400 invalid_request', async () => {
    const { sessionToken, uid } = await createTestSession('val-badcursor');
    await linkDiscogs(uid);
    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .query({ cursor: '-3' })
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('reaches status complete with a full perDisc breakdown and consistent coverage arithmetic', async () => {
    const { sessionToken, uid } = await createTestSession('val-complete');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, { instanceId: 11, mediaCondition: VG }),
      rawCollectionInstance(2, { instanceId: 22 }), // no media condition -> no_condition
      rawCollectionInstance(3, { instanceId: 33, mediaCondition: VG }), // release has no market data
    ]);
    discogsScope().get('/marketplace/price_suggestions/1').reply(200, PRICE_MAP);
    discogsScope().get('/marketplace/price_suggestions/2').reply(200, PRICE_MAP);
    discogsScope().get('/marketplace/price_suggestions/3').reply(404, { message: 'not found' });

    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .query({ cursor: '0' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');
    expect(res.body.nextCursor).toBeUndefined();
    expect(res.body.valuation.currency).toBe('EUR');
    expect(res.body.valuation.estimatedTotal).toBe(4.95);
    expect(res.body.valuation.coveredCount).toBe(1);
    expect(res.body.valuation.totalCount).toBe(3);

    const { coveredCount, uncovered } = res.body.valuation;
    expect(coveredCount + uncovered.noMarketData + uncovered.noCondition).toBe(3);

    expect(res.body.perDisc).toHaveLength(3);
    const reasons = res.body.perDisc.map((d: { reason: string }) => d.reason).sort();
    expect(reasons).toEqual(['no_condition', 'no_market_data', 'ok']);
  });

  it('a transiently-failed release is reported retryable, then priced by a retry=failed sweep without re-pricing the cached discs', async () => {
    const { sessionToken, uid } = await createTestSession('val-retry-failed');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [
      rawCollectionInstance(1, { instanceId: 11, mediaCondition: VG }),
      rawCollectionInstance(2, { instanceId: 22, mediaCondition: VG }),
      rawCollectionInstance(3, { instanceId: 33, mediaCondition: VG }),
    ]);
    discogsScope().get('/marketplace/price_suggestions/1').reply(200, PRICE_MAP);
    discogsScope().get('/marketplace/price_suggestions/2').reply(200, PRICE_MAP);
    // Release 3's price call fails every attempt on the forward pass — one
    // exhausted strike (below the breaker's threshold of 5, so the breaker
    // stays closed and the retry sweep below is not short-circuited).
    discogsScope()
      .get('/marketplace/price_suggestions/3')
      .times(MAX_ATTEMPTS)
      .reply(503, { message: 'unavailable' });

    const forward = await request(app)
      .get('/api/collection-stats/valuation')
      .query({ cursor: '0' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(forward.status).toBe(200);
    // The whole collection was visited; release 3 is a transient failure, not
    // permanent no_market_data, so the loop stops with no nextCursor and a
    // retryable count instead (US3, FR-023a / FR-025).
    expect(forward.body.status).toBe('partial');
    expect(forward.body.nextCursor).toBeUndefined();
    expect(forward.body.retryable).toBe(1);
    expect(forward.body.valuation.coveredCount).toBe(2);
    expect(forward.body.valuation.uncovered.noMarketData).toBe(0);

    // Discogs recovers; the retry=failed sweep re-prices only release 3 —
    // releases 1 & 2 are served from the shared 7-day price cache (SC-005), so
    // no new nock interceptor for them is registered or consumed.
    discogsScope().get('/marketplace/price_suggestions/3').reply(200, PRICE_MAP);

    const retried = await request(app)
      .get('/api/collection-stats/valuation')
      .query({ retry: 'failed' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe('complete');
    expect(retried.body.retryable).toBe(0);
    expect(retried.body.valuation.coveredCount).toBe(3);
    expect(retried.body.perDisc).toHaveLength(3);
    expect(
      retried.body.perDisc.every((d: { reason: string }) => d.reason === 'ok'),
    ).toBe(true);
  }, 15_000);

  it('returns 422 seller_settings_required when the linked account has no seller settings — and /statistics still works', async () => {
    const { sessionToken, uid } = await createTestSession('val-noseller');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11, mediaCondition: VG })]);
    discogsScope()
      .get('/marketplace/price_suggestions/1')
      .reply(403, { message: 'You must have seller settings enabled.' });

    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('seller_settings_required');

    // Block 1 is unaffected by the missing seller settings.
    stubCollectionFields(username);
    stubCollectionPage(username, [rawCollectionInstance(1, { instanceId: 11, mediaCondition: VG })]);
    const stats = await request(app)
      .get('/api/collection-stats/statistics')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.totalRecords).toBe(1);
  });

  it('Discogs unavailable before any disc is priced → 200 with status unavailable, never a 5xx', async () => {
    const { sessionToken, uid } = await createTestSession('val-outage');
    const username = await linkDiscogs(uid);

    stubCollectionFields(username);
    discogsScope()
      .get(`/users/${username}/collection/folders/0/releases`)
      .query(true)
      .times(MAX_ATTEMPTS)
      .reply(503, { message: 'unavailable' });

    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unavailable');
  }, 15_000);
});
