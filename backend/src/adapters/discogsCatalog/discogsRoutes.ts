import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { logger } from '../../config/logger';
import { createSearchCatalogWithRatingsUseCase } from '../../application/discogsCatalog/searchCatalogWithRatings';
import { resolveCatalogCredential } from '../../application/discogsCatalog/resolveCatalogCredential';
import type { CatalogCredential } from '../../domain/discogsCatalog/types';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../../discogs/discogsErrors';
import { requireAuth } from '../auth/requireAuth';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { cacheAdapter } from '../cache/cacheAdapter';
import { respondDiscogsAuthError } from '../discogs/respondDiscogsAuthError';
import { discogsConnectionAdapter } from '../discogsOauth/discogsConnectionAdapter';
import {
  discogsCatalogAdapter,
  getMasterRelease,
  getMasterReleaseVersions,
  getRelease,
} from './discogsCatalogAdapter';

const { searchCatalogWithRatings } = createSearchCatalogWithRatingsUseCase({
  discogsCatalog: discogsCatalogAdapter,
  cache: cacheAdapter,
});

const DEFAULT_PER_PAGE = 50;

function parsePageParams(req: Request): { page: number; perPage: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Number(req.query.perPage) || DEFAULT_PER_PAGE);
  return { page, perPage };
}

const FILTER_PARAM_NAMES = ['genre', 'style', 'format'] as const;

/** Reads and trims the four filter query params (spec FR-010); blank/whitespace-only values are omitted. */
function parseFilterParams(
  req: Request,
): Partial<Record<(typeof FILTER_PARAM_NAMES)[number], string>> {
  const filters: Partial<Record<(typeof FILTER_PARAM_NAMES)[number], string>> = {};
  for (const name of FILTER_PARAM_NAMES) {
    const raw = req.query[name];
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (trimmed) {
      filters[name] = trimmed;
    }
  }
  return filters;
}

export const discogsRouter = Router();

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

discogsRouter.get('/search', standardRateLimit, requireAuth, async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const resultType = req.query.type === 'artist' ? 'artist' : 'release';
  const { page, perPage } = parsePageParams(req);
  const filters = parseFilterParams(req);

  let credential: CatalogCredential | undefined;
  try {
    credential = await resolveCatalogCredential(discogsConnectionAdapter, req.auth!.uid);
    const result = await searchCatalogWithRatings(credential, query, {
      resultType,
      page,
      perPage,
      ...filters,
    });
    const releaseResults = result.results.filter((r) => r.resultType === 'release');
    const masterResults = result.results.filter((r) => r.resultType === 'master');
    const enrichedCount = [...releaseResults, ...masterResults].filter(
      (r) => r.communityRating !== undefined,
    ).length;
    logger.info({
      route: '/api/discogs/search',
      outcome: 'success',
      uid: req.auth?.uid,
      meta: {
        releases: releaseResults.length,
        masters: masterResults.length,
        ratingEnriched: enrichedCount,
        filters: Object.keys(filters),
      },
    });
    // Masters surface ahead of every other result within this page/batch
    // (spec FR-012, feature 027) — best-effort, per-page only; no extra
    // Discogs requests are made to enforce ordering across pages (see
    // contracts/search-api.md). Partitioned against "not master" (rather
    // than reusing `releaseResults` above) so a `type=artist` search's
    // artist-type hits aren't silently dropped from the response.
    const nonMasterResults = result.results.filter((r) => r.resultType !== 'master');
    res.status(200).json({ ...result, results: [...masterResults, ...nonMasterResults] });
  } catch (err) {
    const authErrorResponse =
      credential && respondDiscogsAuthError(credential.type, err);
    if (authErrorResponse) {
      logger.warn({ route: '/api/discogs/search', outcome: 'auth_failed', uid: req.auth?.uid });
      res.status(authErrorResponse.status).json(authErrorResponse.body);
      return;
    }

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

discogsRouter.get(
  '/releases/:discogsId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const discogsId = Number(req.params.discogsId);

    let credential: CatalogCredential | undefined;
    try {
      credential = await resolveCatalogCredential(discogsConnectionAdapter, req.auth!.uid);
      const release = await getRelease(credential, discogsId);
      logger.info({
        route: '/api/discogs/releases/:discogsId',
        outcome: 'success',
        uid: req.auth?.uid,
      });
      res.status(200).json(release);
    } catch (err) {
      const authErrorResponse =
        credential && respondDiscogsAuthError(credential.type, err);
      if (authErrorResponse) {
        logger.warn({
          route: '/api/discogs/releases/:discogsId',
          outcome: 'auth_failed',
          uid: req.auth?.uid,
        });
        res.status(authErrorResponse.status).json(authErrorResponse.body);
        return;
      }

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

      if (
        err instanceof DiscogsRateLimitError ||
        err instanceof DiscogsUnavailableError
      ) {
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
  },
);

discogsRouter.get(
  '/masters/:discogsId',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const discogsId = Number(req.params.discogsId);

    let credential: CatalogCredential | undefined;
    try {
      credential = await resolveCatalogCredential(discogsConnectionAdapter, req.auth!.uid);
      const master = await getMasterRelease(credential, discogsId);
      logger.info({
        route: '/api/discogs/masters/:discogsId',
        outcome: 'success',
        uid: req.auth?.uid,
      });
      res.status(200).json(master);
    } catch (err) {
      const authErrorResponse =
        credential && respondDiscogsAuthError(credential.type, err);
      if (authErrorResponse) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId',
          outcome: 'auth_failed',
          uid: req.auth?.uid,
        });
        res.status(authErrorResponse.status).json(authErrorResponse.body);
        return;
      }

      if (err instanceof DiscogsNotFoundError) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId',
          outcome: 'not_found',
          uid: req.auth?.uid,
        });
        res.status(404).json({
          error: 'master_not_found',
          message: 'No master release found for that ID.',
        });
        return;
      }

      if (
        err instanceof DiscogsRateLimitError ||
        err instanceof DiscogsUnavailableError
      ) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId',
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
        route: '/api/discogs/masters/:discogsId',
        outcome: 'error',
        uid: req.auth?.uid,
        message: err instanceof Error ? err.message : 'unknown error',
      });
      res.status(500).json({
        error: 'internal_error',
        message: 'Something went wrong. Please try again.',
      });
    }
  },
);

const DEFAULT_MASTER_VERSIONS_PER_PAGE = 10;

discogsRouter.get(
  '/masters/:discogsId/versions',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const discogsId = Number(req.params.discogsId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.max(
      1,
      Number(req.query.perPage) || DEFAULT_MASTER_VERSIONS_PER_PAGE,
    );

    let credential: CatalogCredential | undefined;
    try {
      credential = await resolveCatalogCredential(discogsConnectionAdapter, req.auth!.uid);
      const versions = await getMasterReleaseVersions(credential, discogsId, page, perPage);
      logger.info({
        route: '/api/discogs/masters/:discogsId/versions',
        outcome: 'success',
        uid: req.auth?.uid,
      });
      res.status(200).json(versions);
    } catch (err) {
      const authErrorResponse =
        credential && respondDiscogsAuthError(credential.type, err);
      if (authErrorResponse) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId/versions',
          outcome: 'auth_failed',
          uid: req.auth?.uid,
        });
        res.status(authErrorResponse.status).json(authErrorResponse.body);
        return;
      }

      if (err instanceof DiscogsNotFoundError) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId/versions',
          outcome: 'not_found',
          uid: req.auth?.uid,
        });
        res.status(404).json({
          error: 'master_not_found',
          message: 'No master release found for that ID.',
        });
        return;
      }

      if (
        err instanceof DiscogsRateLimitError ||
        err instanceof DiscogsUnavailableError
      ) {
        logger.warn({
          route: '/api/discogs/masters/:discogsId/versions',
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
        route: '/api/discogs/masters/:discogsId/versions',
        outcome: 'error',
        uid: req.auth?.uid,
        message: err instanceof Error ? err.message : 'unknown error',
      });
      res.status(500).json({
        error: 'internal_error',
        message: 'Something went wrong. Please try again.',
      });
    }
  },
);
