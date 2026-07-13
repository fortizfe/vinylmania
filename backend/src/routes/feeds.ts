import { Router, type Request, type Response } from 'express';

import { logger } from '../config/logger';
import { getDashboard, getSourceArticles } from '../feeds/feedAggregator';
import { requireAuth } from '../middleware/requireAuth';

export const feedsRouter = Router();

feedsRouter.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
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
