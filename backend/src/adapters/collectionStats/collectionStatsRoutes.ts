import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { logger } from '../../config/logger';
import { createGetCollectionStatisticsUseCase } from '../../application/collectionStats/getCollectionStatistics';
import { createGetCollectionValuationUseCase } from '../../application/collectionStats/getCollectionValuation';
import { createSyncLibraryUseCase } from '../../application/library/syncLibrary';
import { SellerSettingsRequiredError } from '../../domain/collectionStats/statsErrors';
import { requireAuth } from '../auth/requireAuth';
import { cacheAdapter } from '../cache/cacheAdapter';
import { respondCollectionError } from '../discogs/respondCollectionError';
import { discogsCollectionAdapter } from '../discogsOauth/discogsCollectionAdapter';
import { discogsConnectionAdapter } from '../discogsOauth/discogsConnectionAdapter';
import { discogsMarketplaceAdapter } from '../discogsOauth/discogsMarketplaceAdapter';
import { firestoreLibraryRepository } from '../library/firestoreLibraryRepository';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';

/**
 * Driving HTTP adapter for "Mi colección en cifras" (feature 061,
 * `contracts/collection-stats-api.md`). Same auth + rate-limit tier as
 * `/api/library` and `/api/wantlist`.
 *
 * Composition root: the `collectionStats` application use cases
 * (`getCollectionStatistics` — US1; `getCollectionValuation` — US2) are wired
 * here from the process-lifetime adapter singletons. Error mapping goes
 * through the shared `respondCollectionError` plus the feature-specific
 * `seller_settings_required` → `422` branch below. `GET /valuation` never
 * returns a 5xx — a Discogs outage / rate-limit is folded into
 * `valuation.status` by the use case (data-model §6).
 */

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

/**
 * Maps domain errors to the HTTP contract: the shared collection-gate errors
 * via `respondCollectionError`, plus `SellerSettingsRequiredError` → `422`
 * (Block 2 only; Block 1 is unaffected). Returns `false` when unhandled.
 */
function respondStatsError(
  res: Response,
  route: string,
  uid: string,
  err: unknown,
): boolean {
  if (err instanceof SellerSettingsRequiredError) {
    logger.warn({ route, outcome: 'seller_settings_required', uid });
    res.status(422).json({
      error: 'seller_settings_required',
      message: err.message,
    });
    return true;
  }
  return respondCollectionError(res, route, uid, err, 'collection stats');
}

function respondInternalError(
  res: Response,
  route: string,
  uid: string,
  err: unknown,
): void {
  logger.error({
    route,
    outcome: 'error',
    uid,
    message: err instanceof Error ? err.message : 'unknown error',
  });
  res.status(500).json({
    error: 'internal_error',
    message: 'Something went wrong. Please try again.',
  });
}

// Composition root: one instance of each adapter/use case for the process
// lifetime. `syncLibrary` is re-composed here from the same adapters the
// library slice uses — it is a plain function dependency, so the use case
// depends on `ports/`, not on this wiring.
const { syncLibrary } = createSyncLibraryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { getCollectionStatistics } = createGetCollectionStatisticsUseCase({
  repository: firestoreLibraryRepository,
  syncLibrary,
  discogsConnection: discogsConnectionAdapter,
});
const { getCollectionValuation } = createGetCollectionValuationUseCase({
  discogsCollection: discogsCollectionAdapter,
  discogsMarketplace: discogsMarketplaceAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});

export const collectionStatsRouter = Router();

collectionStatsRouter.get(
  '/statistics',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const route = '/api/collection-stats/statistics';
    try {
      const stats = await getCollectionStatistics(uid, {
        refresh: req.query.refresh === 'true',
      });
      logger.info({
        route,
        outcome: 'stats_computed',
        uid,
        meta: { recordCount: stats.totalRecords },
      });
      res.status(200).json(stats);
    } catch (err) {
      if (respondStatsError(res, route, uid, err)) {
        return;
      }
      respondInternalError(res, route, uid, err);
    }
  },
);

collectionStatsRouter.get(
  '/valuation',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const route = '/api/collection-stats/valuation';

    const cursor = parseCursor(req.query.cursor);
    if (cursor === null) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'cursor must be an integer greater than or equal to 0.',
      });
      return;
    }

    try {
      const result = await getCollectionValuation(uid, {
        cursor,
        refresh: req.query.refresh === 'true',
        ...(req.query.retry === 'failed' ? { retry: 'failed' as const } : {}),
      });
      const { failedThisBatch, ...body } = result;
      logger.info({
        route,
        outcome: 'valuation_batch',
        uid,
        meta: {
          cursor,
          retry: req.query.retry === 'failed' ? 'failed' : undefined,
          status: result.status,
          priced: result.pricedThisBatch,
          cached: result.fromCacheThisBatch,
          covered: result.valuation.coveredCount,
          failed: failedThisBatch,
          retryable: result.retryable,
        },
      });
      // Never a 5xx: the use case has already folded a Discogs outage /
      // rate-limit into `valuation.status` (data-model §6, FR-025).
      res.status(200).json(body);
    } catch (err) {
      if (respondStatsError(res, route, uid, err)) {
        return;
      }
      respondInternalError(res, route, uid, err);
    }
  },
);

/** `undefined` → `0`; a valid non-negative integer string → its value; anything else → `null`. */
function parseCursor(raw: unknown): number | null {
  if (raw === undefined) {
    return 0;
  }
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}
