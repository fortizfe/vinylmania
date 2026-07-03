import { Router, type Request, type Response } from 'express';

import { logger } from '../config/logger';
import { searchCatalog } from '../discogs/discogsClient';
import { DiscogsRateLimitError, DiscogsUnavailableError } from '../discogs/discogsErrors';
import { requireAuth } from '../middleware/requireAuth';

export const discogsRouter = Router();

discogsRouter.get('/search', requireAuth, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const resultType = req.query.type === 'artist' ? 'artist' : 'release';

  try {
    const result = await searchCatalog(query, { resultType });
    logger.info({ route: '/api/discogs/search', outcome: 'success', uid: req.auth?.uid });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof DiscogsRateLimitError || err instanceof DiscogsUnavailableError) {
      logger.warn({
        route: '/api/discogs/search',
        outcome: 'unavailable',
        uid: req.auth?.uid,
        message: err.message,
      });
      res.status(502).json({
        error: 'catalog_unavailable',
        message: 'The catalog service is temporarily unavailable. Please try again.',
      });
      return;
    }

    logger.error({
      route: '/api/discogs/search',
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
