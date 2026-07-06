import { Router, type Request, type Response } from 'express';

import { logger } from '../config/logger';
import { getRelease, searchCatalog } from '../discogs/discogsClient';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../discogs/discogsErrors';
import { requireAuth } from '../middleware/requireAuth';

const DEFAULT_PER_PAGE = 50;

function parsePageParams(req: Request): { page: number; perPage: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Number(req.query.perPage) || DEFAULT_PER_PAGE);
  return { page, perPage };
}

export const discogsRouter = Router();

discogsRouter.get('/search', requireAuth, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const resultType = req.query.type === 'artist' ? 'artist' : 'release';
  const { page, perPage } = parsePageParams(req);

  try {
    const result = await searchCatalog(query, { resultType, page, perPage });
    const releaseResults = result.results.filter((r) => r.resultType === 'release');
    const enrichedCount = releaseResults.filter((r) => r.communityRating !== undefined).length;
    logger.info({
      route: '/api/discogs/search',
      outcome: 'success',
      uid: req.auth?.uid,
      meta: { releases: releaseResults.length, ratingEnriched: enrichedCount },
    });
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

discogsRouter.get('/releases/:discogsId', requireAuth, async (req: Request, res: Response) => {
  const discogsId = Number(req.params.discogsId);

  try {
    const release = await getRelease(discogsId);
    logger.info({ route: '/api/discogs/releases/:discogsId', outcome: 'success', uid: req.auth?.uid });
    res.status(200).json(release);
  } catch (err) {
    if (err instanceof DiscogsNotFoundError) {
      logger.warn({
        route: '/api/discogs/releases/:discogsId',
        outcome: 'not_found',
        uid: req.auth?.uid,
      });
      res.status(404).json({
        error: 'release_not_found',
        message: 'No release/artist found for that ID.',
      });
      return;
    }

    if (err instanceof DiscogsRateLimitError || err instanceof DiscogsUnavailableError) {
      logger.warn({
        route: '/api/discogs/releases/:discogsId',
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
      route: '/api/discogs/releases/:discogsId',
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
