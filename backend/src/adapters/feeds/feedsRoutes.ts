import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { createFeedsAggregationUseCase } from '../../application/feeds/getFeedsDashboard';
import { logger } from '../../config/logger';
import { requireAuth } from '../auth/requireAuth';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { cacheAdapter } from '../cache/cacheAdapter';
import { feedSourceAdapter } from './feedSourceAdapter';

const { getDashboard, getSourceArticles } = createFeedsAggregationUseCase({
  feedSource: feedSourceAdapter,
  cache: cacheAdapter,
});

export const feedsRouter = Router();

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

feedsRouter.get('/dashboard', standardRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const dashboard = await getDashboard();
    logger.info({
      route: '/api/feeds/dashboard',
      outcome: 'success',
      uid: req.auth?.uid,
    });
    res.status(200).json(dashboard);
  } catch (err) {
    logger.error({
      route: '/api/feeds/dashboard',
      outcome: 'error',
      uid: req.auth?.uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

feedsRouter.get(
  '/sources/:sourceId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const sourceFeed = await getSourceArticles(req.params.sourceId);
      if (!sourceFeed) {
        res.status(404).json({
          error: 'source_not_found',
          message: 'This source is not part of the current feed catalog.',
        });
        return;
      }
      logger.info({
        route: '/api/feeds/sources/:sourceId',
        outcome: 'success',
        uid: req.auth?.uid,
        meta: { sourceId: req.params.sourceId },
      });
      res.status(200).json(sourceFeed);
    } catch (err) {
      logger.error({
        route: '/api/feeds/sources/:sourceId',
        outcome: 'error',
        uid: req.auth?.uid,
        meta: { sourceId: req.params.sourceId },
        message: err instanceof Error ? err.message : 'unknown error',
      });
      res.status(500).json({
        error: 'internal_error',
        message: 'Something went wrong. Please try again.',
      });
    }
  },
);
