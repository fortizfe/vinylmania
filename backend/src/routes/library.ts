import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { logger } from '../config/logger';
import {
  MEDIA_CONDITIONS,
  SLEEVE_CONDITIONS,
} from '../discogs/collection/conditionGrading';
import { getRelease } from '../discogs/discogsClient';
import {
  DiscogsAuthError,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsUnavailableError,
} from '../discogs/discogsErrors';
import { getFieldMap } from '../discogs/collection/collectionClient';
import { requireAuth } from '../middleware/requireAuth';
import { enrichEntries, enrichEntry } from '../library/libraryEnrichment';
import * as libraryService from '../library/libraryService';
import {
  addToLibrary,
  DiscogsNotLinkedError,
  FieldNotEditableError,
  getCopyData,
  removeFromLibrary,
  requireConnection,
  syncLibrary,
  updateCopyData,
} from '../library/librarySyncService';
import type { EntryDiscogsData, LibraryEntry } from '../library/types';
import type { Release } from '../discogs/types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePageParams(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

/** Public entry shape: legacy per-copy fields never leave the backend. */
function serializeEntry(
  entry: LibraryEntry,
  catalog: { catalogStatus: 'ok' | 'unavailable'; release: unknown },
  discogs: EntryDiscogsData | null,
) {
  const { legacyCondition: _legacyCondition, legacyNotes: _legacyNotes, ...publicEntry } = entry;
  return { ...publicEntry, ...catalog, discogs };
}

/**
 * Maps feature-016 gate/collection failures per contracts/library-sync-api.md.
 * Returns false when the error is not one of them (caller falls through).
 */
function respondCollectionError(res: Response, route: string, uid: string, err: unknown): boolean {
  if (err instanceof DiscogsNotLinkedError) {
    logger.warn({ route, outcome: 'unauthorized', uid, message: 'discogs_not_linked' });
    res.status(409).json({
      error: 'discogs_not_linked',
      message: 'Link your Discogs account to use your library.',
    });
    return true;
  }
  if (err instanceof DiscogsAuthError) {
    logger.warn({ route, outcome: 'auth_failed', uid });
    res.status(401).json({
      error: 'discogs_link_invalid',
      message: 'Your Discogs link is no longer valid. Please re-link your account from your profile.',
    });
    return true;
  }
  if (err instanceof FieldNotEditableError) {
    res.status(400).json({ error: 'invalid_request', message: err.message });
    return true;
  }
  if (err instanceof DiscogsRateLimitError) {
    logger.warn({ route, outcome: 'rate_limited', uid });
    res.status(429).json({
      error: 'discogs_rate_limited',
      message: 'Discogs is receiving too many requests right now. Please try again in a moment.',
    });
    return true;
  }
  if (err instanceof DiscogsUnavailableError) {
    logger.warn({ route, outcome: 'unavailable', uid, message: err.message });
    res.status(503).json({
      error: 'discogs_unavailable',
      message: 'Discogs is temporarily unavailable. Please try again later.',
    });
    return true;
  }
  return false;
}

function respondInternalError(res: Response, route: string, uid: string, err: unknown): void {
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

export const libraryRouter = Router();

const createBodySchema = z
  .object({
    discogsReleaseId: z.number().int().positive(),
  })
  .strict();

libraryRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  const parsed = createBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Body must be exactly { discogsReleaseId: number }.',
    });
    return;
  }
  const { discogsReleaseId } = parsed.data;

  try {
    const connection = await requireConnection(uid);

    // Catalog lookup first: keeps release_not_found/catalog_unavailable
    // semantics and never adds unknown releases to the user's collection.
    let release: Release;
    try {
      release = await getRelease(discogsReleaseId);
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
        logger.warn({ route: '/api/library', outcome: 'unavailable', uid, message: err.message });
        res.status(502).json({
          error: 'catalog_unavailable',
          message: 'The catalog service is temporarily unavailable. Please try again.',
        });
        return;
      }
      throw err;
    }

    const entry = await addToLibrary(connection, uid, discogsReleaseId);
    const fieldMap = await getFieldMap(connection);
    const discogs: EntryDiscogsData = {
      instanceId: entry.discogsInstanceId!,
      folderId: entry.discogsFolderId!,
      rating: 0,
      mediaCondition: null,
      sleeveCondition: null,
      notes: null,
      editable: {
        mediaCondition: fieldMap.mediaConditionFieldId !== null,
        sleeveCondition: fieldMap.sleeveConditionFieldId !== null,
        notes: fieldMap.notesFieldId !== null,
      },
    };

    logger.info({ route: '/api/library', outcome: 'success', uid });
    res.status(201).json(serializeEntry(entry, { catalogStatus: 'ok', release }, discogs));
  } catch (err) {
    if (respondCollectionError(res, '/api/library', uid, err)) {
      return;
    }
    respondInternalError(res, '/api/library', uid, err);
  }
});

libraryRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  try {
    const connection = await requireConnection(uid);

    const entry = await libraryService.getEntry(uid, req.params.id);
    if (!entry) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    const [enriched, discogs] = await Promise.all([
      enrichEntry(entry),
      getCopyData(connection, entry),
    ]);

    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res
      .status(200)
      .json(serializeEntry(entry, { catalogStatus: enriched.catalogStatus, release: enriched.release }, discogs));
  } catch (err) {
    if (respondCollectionError(res, '/api/library/:id', uid, err)) {
      return;
    }
    respondInternalError(res, '/api/library/:id', uid, err);
  }
});

libraryRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  const { page, pageSize } = parsePageParams(req);

  try {
    await syncLibrary(uid, { force: req.query.refresh === 'true' });

    const { items, totalItems } = await libraryService.listEntries(uid, page, pageSize);
    const enriched = await enrichEntries(items);
    const serialized = enriched.map((item) =>
      serializeEntry(item, { catalogStatus: item.catalogStatus, release: item.release }, null),
    );

    logger.info({ route: '/api/library', outcome: 'success', uid });
    res.status(200).json({ items: serialized, page, pageSize, totalItems });
  } catch (err) {
    if (respondCollectionError(res, '/api/library', uid, err)) {
      return;
    }
    respondInternalError(res, '/api/library', uid, err);
  }
});

const patchBodySchema = z
  .object({
    rating: z.number().int().min(0).max(5).optional(),
    mediaCondition: z.enum(MEDIA_CONDITIONS).nullable().optional(),
    sleeveCondition: z.enum(SLEEVE_CONDITIONS).nullable().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required.' });

libraryRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  const parsed = patchBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      message:
        'Body must contain at least one of rating (0–5), mediaCondition, sleeveCondition, or notes, with conditions from the Discogs grading options.',
    });
    return;
  }

  try {
    const connection = await requireConnection(uid);

    const entry = await libraryService.getEntry(uid, req.params.id);
    if (!entry) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    await updateCopyData(connection, entry, parsed.data);

    const [enriched, discogs] = await Promise.all([
      enrichEntry(entry),
      getCopyData(connection, entry),
    ]);

    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res
      .status(200)
      .json(serializeEntry(entry, { catalogStatus: enriched.catalogStatus, release: enriched.release }, discogs));
  } catch (err) {
    if (respondCollectionError(res, '/api/library/:id', uid, err)) {
      return;
    }
    respondInternalError(res, '/api/library/:id', uid, err);
  }
});

libraryRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const uid = req.auth!.uid;

  try {
    const connection = await requireConnection(uid);

    const entry = await libraryService.getEntry(uid, req.params.id);
    if (!entry) {
      logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
      res.status(404).json({
        error: 'entry_not_found',
        message: 'No record found in your library for that ID.',
      });
      return;
    }

    await removeFromLibrary(connection, uid, entry);

    logger.info({ route: '/api/library/:id', outcome: 'success', uid });
    res.status(204).send();
  } catch (err) {
    if (respondCollectionError(res, '/api/library/:id', uid, err)) {
      return;
    }
    respondInternalError(res, '/api/library/:id', uid, err);
  }
});
