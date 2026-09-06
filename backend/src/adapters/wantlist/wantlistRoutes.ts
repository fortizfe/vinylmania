import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { createAddToWantlistUseCase } from '../../application/wantlist/addToWantlist';
import { createGetWantEntryUseCase } from '../../application/wantlist/getWantEntry';
import { createListWantlistUseCase } from '../../application/wantlist/listWantlist';
import { createRemoveFromWantlistUseCase } from '../../application/wantlist/removeFromWantlist';
import { createUpdateWantEntryUseCase } from '../../application/wantlist/updateWantEntry';
import { logger } from '../../config/logger';
import {
  CatalogUnavailableForWantError,
  ReleaseNotFoundForWantError,
} from '../../domain/wantlist/wantlistErrors';
import { requireAuth } from '../auth/requireAuth';
import { cacheAdapter } from '../cache/cacheAdapter';
import { respondCollectionError } from '../discogs/respondCollectionError';
import { discogsCollectionAdapter } from '../discogsOauth/discogsCollectionAdapter';
import { discogsConnectionAdapter } from '../discogsOauth/discogsConnectionAdapter';
import { discogsWantlistAdapter } from '../discogsOauth/discogsWantlistAdapter';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';

/**
 * Driving HTTP adapter for the Discogs-integrated wantlist (feature 060,
 * `contracts/wantlist-api.md`). Same auth + rate-limit tier as `/api/library`.
 *
 * Composition root: the `wantlist` application use cases are wired here as they
 * land. `listWantlist` (US1), `addToWantlist` (US2), `getWantEntry` and
 * `updateWantEntry` (US3), and `removeFromWantlist` (US4) are all live. Each
 * depends only on the `ports/` interfaces.
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePageParams(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize };
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

// Composition root: one instance for the process lifetime. Each use case
// depends only on `ports/` interfaces; the catalog `getRelease` gate inside
// `addToWantlist` is the app-token, Redis-cached path (feature 011), imported
// there directly as `enrichWantEntry` / `createLibraryEntry` already do.
const { listWantlist } = createListWantlistUseCase({
  discogsWantlist: discogsWantlistAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { addToWantlist } = createAddToWantlistUseCase({
  discogsWantlist: discogsWantlistAdapter,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { getWantEntry } = createGetWantEntryUseCase({
  discogsWantlist: discogsWantlistAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { updateWantEntry } = createUpdateWantEntryUseCase({
  discogsWantlist: discogsWantlistAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { removeFromWantlist } = createRemoveFromWantlistUseCase({
  discogsWantlist: discogsWantlistAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});

const createBodySchema = z
  .object({ discogsReleaseId: z.number().int().positive() })
  .strict();

const patchBodySchema = z
  .object({
    rating: z.number().int().min(0).max(5).optional(),
    notes: z.string().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one of rating (0–5) or notes is required.',
  });

/** `:releaseId` must be a positive integer; returns `null` otherwise. */
function parseReleaseIdParam(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

const NOT_IN_WANTLIST = {
  error: 'not_in_wantlist',
  message: 'This release is not in your wishlist.',
} as const;

export const wantlistRouter = Router();

// Local rateLimit(...) call (not a shared instance) — see rateLimitOptions.ts.
const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

const INVALID_RELEASE_ID = {
  error: 'invalid_request',
  message: ':releaseId must be a positive integer.',
} as const;

wantlistRouter.get(
  '/',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const { page, pageSize } = parsePageParams(req);
    const refresh = req.query.refresh === 'true';

    try {
      const full = await listWantlist(uid, { force: refresh });
      const items = full.slice((page - 1) * pageSize, page * pageSize);

      logger.info({
        route: '/api/wantlist',
        outcome: 'success',
        uid,
        meta: { totalItems: full.length },
      });
      res.status(200).json({ items, page, pageSize, totalItems: full.length });
    } catch (err) {
      if (respondCollectionError(res, '/api/wantlist', uid, err, 'wishlist')) {
        return;
      }
      respondInternalError(res, '/api/wantlist', uid, err);
    }
  },
);

wantlistRouter.post(
  '/',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;

    const parsed = createBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Body must be exactly { discogsReleaseId: number }.',
      });
      return;
    }

    try {
      const result = await addToWantlist(uid, parsed.data.discogsReleaseId);
      logger.info({ route: '/api/wantlist', outcome: 'success', uid });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ReleaseNotFoundForWantError) {
        logger.warn({ route: '/api/wantlist', outcome: 'not_found', uid });
        res.status(404).json({
          error: 'release_not_found',
          message: 'No release found in the catalog for that ID.',
        });
        return;
      }
      if (err instanceof CatalogUnavailableForWantError) {
        logger.warn({
          route: '/api/wantlist',
          outcome: 'unavailable',
          uid,
          message: err.cause.message,
        });
        res.status(502).json({
          error: 'catalog_unavailable',
          message: 'The catalog service is temporarily unavailable. Please try again.',
        });
        return;
      }
      if (respondCollectionError(res, '/api/wantlist', uid, err, 'wishlist')) {
        return;
      }
      respondInternalError(res, '/api/wantlist', uid, err);
    }
  },
);
wantlistRouter.get(
  '/:releaseId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const route = '/api/wantlist/:releaseId';

    const releaseId = parseReleaseIdParam(req.params.releaseId);
    if (releaseId === null) {
      res.status(400).json(INVALID_RELEASE_ID);
      return;
    }

    try {
      const entry = await getWantEntry(uid, releaseId);
      if (!entry) {
        logger.warn({ route, outcome: 'not_found', uid, meta: { releaseId } });
        res.status(404).json(NOT_IN_WANTLIST);
        return;
      }

      logger.info({ route, outcome: 'success', uid, meta: { releaseId } });
      res.status(200).json(entry);
    } catch (err) {
      if (respondCollectionError(res, route, uid, err, 'wishlist')) {
        return;
      }
      respondInternalError(res, route, uid, err);
    }
  },
);

wantlistRouter.patch(
  '/:releaseId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const route = '/api/wantlist/:releaseId';

    const releaseId = parseReleaseIdParam(req.params.releaseId);
    if (releaseId === null) {
      res.status(400).json(INVALID_RELEASE_ID);
      return;
    }

    const parsed = patchBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Body must contain exactly one of rating (0–5) or notes.',
      });
      return;
    }

    try {
      const entry = await updateWantEntry(uid, releaseId, parsed.data);
      if (!entry) {
        logger.warn({ route, outcome: 'not_found', uid, meta: { releaseId } });
        res.status(404).json(NOT_IN_WANTLIST);
        return;
      }

      logger.info({ route, outcome: 'success', uid, meta: { releaseId } });
      res.status(200).json(entry);
    } catch (err) {
      if (respondCollectionError(res, route, uid, err, 'wishlist')) {
        return;
      }
      respondInternalError(res, route, uid, err);
    }
  },
);

wantlistRouter.delete(
  '/:releaseId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const route = '/api/wantlist/:releaseId';

    const releaseId = parseReleaseIdParam(req.params.releaseId);
    if (releaseId === null) {
      res.status(400).json(INVALID_RELEASE_ID);
      return;
    }

    try {
      const outcome = await removeFromWantlist(uid, releaseId);
      if (outcome === 'not_in_wantlist') {
        logger.warn({ route, outcome: 'not_found', uid, meta: { releaseId } });
        res.status(404).json(NOT_IN_WANTLIST);
        return;
      }

      logger.info({ route, outcome: 'success', uid, meta: { releaseId } });
      res.status(204).send();
    } catch (err) {
      if (respondCollectionError(res, route, uid, err, 'wishlist')) {
        return;
      }
      respondInternalError(res, route, uid, err);
    }
  },
);
