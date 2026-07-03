import { Router, type Request, type Response } from 'express';

import { logger } from '../config/logger';
import { getRelease } from '../discogs/discogsClient';
import {
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../discogs/discogsErrors';
import { requireAuth } from '../middleware/requireAuth';
import { enrichEntries, enrichEntry } from '../library/libraryEnrichment';
import * as libraryService from '../library/libraryService';
import type { EnrichedLibraryEntry } from '../library/types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePageParams(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

export const libraryRouter = Router();

libraryRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  const { discogsReleaseId, condition, notes } = req.body ?? {};

  if (typeof discogsReleaseId !== 'number') {
    res.status(400).json({
      error: 'invalid_request',
      message: 'discogsReleaseId is required and must be a number.',
    });
    return;
  }

  try {
    const release = await getRelease(discogsReleaseId);
    const entry = await libraryService.createEntry(uid, { discogsReleaseId, condition, notes });

    logger.info({ route: '/api/library', outcome: 'success', uid });

    const response: EnrichedLibraryEntry = { ...entry, catalogStatus: 'ok', release };
    res.status(201).json(response);
  } catch (err) {
    if (err instanceof DiscogsNotFoundError) {
      logger.warn({ route: '/api/library', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'release_not_found',
        message: 'No release found in the catalog for that ID.',
      });
      return;
    }

    if (err instanceof DiscogsRateLimitError || err instanceof DiscogsUnavailableError) {
      logger.warn({
        route: '/api/library',
        outcome: 'unavailable',
        uid,
        message: err.message,
      });
      res.status(502).json({
        error: 'catalog_unavailable',
        message: 'The catalog service is temporarily unavailable. Please try again.',
      });
      return;
    }

    logger.error({
      route: '/api/library',
      outcome: 'error',
      uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

libraryRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  try {
    const entry = await libraryService.getEntry(uid, req.params.id);
    if (!entry) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    const enriched = await enrichEntry(entry);
    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res.status(200).json(enriched);
  } catch (err) {
    logger.error({
      route: '/api/library/:id',
      outcome: 'error',
      uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

libraryRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  const { page, pageSize } = parsePageParams(req);

  try {
    const { items, totalItems } = await libraryService.listEntries(uid, page, pageSize);
    const enriched = await enrichEntries(items);

    logger.info({ route: '/api/library', outcome: 'success', uid });
    res.status(200).json({ items: enriched, page, pageSize, totalItems });
  } catch (err) {
    logger.error({
      route: '/api/library',
      outcome: 'error',
      uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

libraryRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  const { condition, notes } = req.body ?? {};

  try {
    const updated = await libraryService.updateEntry(uid, req.params.id, { condition, notes });
    if (!updated) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    const enriched = await enrichEntry(updated);
    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res.status(200).json(enriched);
  } catch (err) {
    logger.error({
      route: '/api/library/:id',
      outcome: 'error',
      uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

libraryRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  try {
    const deleted = await libraryService.deleteEntry(uid, req.params.id);
    if (!deleted) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res.status(204).send();
  } catch (err) {
    logger.error({
      route: '/api/library/:id',
      outcome: 'error',
      uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});
