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
import { createApp } from '../../../src/app';
import { getRedisClient } from '../../../src/adapters/cache/redisClient';
import { shouldShortCircuit } from '../../../src/discogs/discogsCircuitBreaker';
import { getFirestoreDb } from '../../../src/config/firebase-admin';
import { clearEmulatorFirestore, clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

/**
 * Feature 061, T049 (US3) — `GET /api/collection-stats/valuation` at collection
 * scale. Emulator-backed (Firestore + Auth). A full cursor loop over 100+
 * releases, priced through a deliberately slow/paced marketplace stub, must:
 *   - reach `status: 'complete'` with every disc attempted (FR-023a, no cap);
 *   - never trip the shared Discogs circuit breaker (SC-006);
 *   - on a warm repeat loop, report `fromCacheThisBatch === pricedThisBatch`
 *     on every chunk and issue zero new upstream price calls (SC-005).
 */

const app = createApp();

const RELEASE_COUNT = 120;
const VG = 'Very Good (VG)';
const PRICE_MAP = { [VG]: { currency: 'EUR', value: 3.25 } };
// Discogs sends these on every response; recording them keeps the shared
// preventive throttle relaxed (mirrors real traffic).
const RL_HEADERS = { 'x-discogs-ratelimit': '60', 'x-discogs-ratelimit-remaining': '58' };

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

interface ValuationChunkBody {
  status: 'partial' | 'complete' | 'unavailable';
  nextCursor?: number;
  pricedThisBatch: number;
  fromCacheThisBatch: number;
  retryable: number;
  valuation: { coveredCount: number; totalCount: number };
  perDisc?: unknown[];
}

async function driveLoop(sessionToken: string): Promise<ValuationChunkBody[]> {
  const chunks: ValuationChunkBody[] = [];
  let cursor: number | undefined = 0;
  let guard = 0;
  do {
    const res = await request(app)
      .get('/api/collection-stats/valuation')
      .query({ cursor: String(cursor) })
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(res.status).toBe(200);
    const body = res.body as ValuationChunkBody;
    chunks.push(body);
    cursor = body.nextCursor;
    guard += 1;
  } while (cursor !== undefined && guard < 50);
  return chunks;
}

describe('GET /api/collection-stats/valuation at scale (feature 061, US3)', () => {
  it('completes a 120-release cursor loop without tripping the breaker, then serves a warm repeat from cache', async () => {
    const { sessionToken, uid } = await createTestSession('val-scale-user');
    const username = await linkDiscogs(uid);

    const instances = Array.from({ length: RELEASE_COUNT }, (_, i) =>
      rawCollectionInstance(i + 1, { instanceId: (i + 1) * 10, mediaCondition: VG }),
    );
    // The instance list is walked once (cached at `discogs:statsinstances`);
    // one page stub is enough for the whole loop.
    stubCollectionFields(username);
    stubCollectionPage(username, instances);

    // Paced / slow price stub: a small per-request delay simulates a sluggish
    // marketplace without ever erroring.
    for (let releaseId = 1; releaseId <= RELEASE_COUNT; releaseId += 1) {
      discogsScope()
        .get(`/marketplace/price_suggestions/${releaseId}`)
        .delay(8)
        .reply(200, PRICE_MAP, RL_HEADERS);
    }

    const firstLoop = await driveLoop(sessionToken);

    const last = firstLoop[firstLoop.length - 1];
    expect(last.status).toBe('complete');
    expect(last.valuation.totalCount).toBe(RELEASE_COUNT);
    expect(last.valuation.coveredCount).toBe(RELEASE_COUNT);
    expect(last.perDisc).toHaveLength(RELEASE_COUNT);
    expect(firstLoop.every((c) => c.status !== 'unavailable')).toBe(true);
    expect(firstLoop.every((c) => c.retryable === 0)).toBe(true);
    // 120 / 25 → 5 chunks, no early cap.
    expect(firstLoop).toHaveLength(Math.ceil(RELEASE_COUNT / 25));
    // The shared breaker was never opened by the run.
    expect(shouldShortCircuit()).toBe(false);

    // Warm repeat loop: NO new price_suggestions stubs are registered, so any
    // upstream call would throw (nock: no match). Every chunk must be
    // fully cache-served.
    const secondLoop = await driveLoop(sessionToken);

    const warmLast = secondLoop[secondLoop.length - 1];
    expect(warmLast.status).toBe('complete');
    expect(warmLast.valuation.coveredCount).toBe(RELEASE_COUNT);
    for (const chunk of secondLoop) {
      expect(chunk.fromCacheThisBatch).toBe(chunk.pricedThisBatch);
    }
    expect(shouldShortCircuit()).toBe(false);
  }, 30_000);
});
