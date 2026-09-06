import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { logger } from '../../config/logger';
import {
  MEDIA_CONDITIONS,
  SLEEVE_CONDITIONS,
} from '../../domain/discogsOauth/conditionGrading';
import { requireAuth } from '../auth/requireAuth';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { respondCollectionError } from '../discogs/respondCollectionError';
import {
  CatalogUnavailableForCreationError,
  createCreateLibraryEntryUseCase,
  ReleaseNotFoundForCreationError,
} from '../../application/library/createLibraryEntry';
import { createDeleteLibraryEntryUseCase } from '../../application/library/deleteLibraryEntry';
import { createEnrichLibraryEntryUseCase } from '../../application/library/enrichLibraryEntry';
import { createGetLibraryEntryUseCase } from '../../application/library/getLibraryEntry';
import { createListLibraryEntriesUseCase } from '../../application/library/listLibraryEntries';
import { createSyncLibraryUseCase } from '../../application/library/syncLibrary';
import { createUpdateLibraryEntryUseCase } from '../../application/library/updateLibraryEntry';
import type {
  EntryDiscogsData,
  LibraryEntry,
  LibraryFilters,
} from '../../domain/library/types';
import { cacheAdapter } from '../cache/cacheAdapter';
import { discogsCollectionAdapter } from '../discogsOauth/discogsCollectionAdapter';
import { discogsConnectionAdapter } from '../discogsOauth/discogsConnectionAdapter';
import { discogsWantlistAdapter } from '../discogsOauth/discogsWantlistAdapter';
import { firestoreLibraryRepository } from './firestoreLibraryRepository';

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

const FILTER_PARAM_NAMES = ['genre', 'style', 'format'] as const;

/** Reads and splits the three comma-joined filter query params (feature 038, FR-017). */
function parseLibraryFilters(req: Request): LibraryFilters {
  const filters: LibraryFilters = {};
  for (const name of FILTER_PARAM_NAMES) {
    const raw = req.query[name];
    if (typeof raw !== 'string') continue;
    const values = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length > 0) {
      filters[name] = values;
    }
  }
  return filters;
}

/** Public entry shape: legacy per-copy fields never leave the backend. */
function serializeEntry(
  entry: LibraryEntry,
  catalog: { catalogStatus: 'ok' | 'unavailable'; release: unknown },
  discogs: EntryDiscogsData | null,
) {
  const {
    legacyCondition: _legacyCondition,
    legacyNotes: _legacyNotes,
    ...publicEntry
  } = entry;
  return { ...publicEntry, ...catalog, discogs };
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

// Composition root: one instance of each adapter/use case for the process lifetime.
const { enrichEntry, enrichEntries } = createEnrichLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
});
const enrichLibraryEntry = { enrichEntry, enrichEntries };
const { syncLibrary } = createSyncLibraryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  cache: cacheAdapter,
});
const { createLibraryEntry } = createCreateLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  discogsWantlist: discogsWantlistAdapter,
  cache: cacheAdapter,
});
const { getLibraryEntry } = createGetLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  enrichLibraryEntry,
});
const { listLibraryEntries } = createListLibraryEntriesUseCase({
  repository: firestoreLibraryRepository,
  enrichLibraryEntry,
  syncLibrary,
});
const { updateLibraryEntry } = createUpdateLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
  enrichLibraryEntry,
});
const { deleteLibraryEntry } = createDeleteLibraryEntryUseCase({
  repository: firestoreLibraryRepository,
  discogsCollection: discogsCollectionAdapter,
  discogsConnection: discogsConnectionAdapter,
});

export const libraryRouter = Router();

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

const createBodySchema = z
  .object({
    discogsReleaseId: z.number().int().positive(),
  })
  .strict();

libraryRouter.post(
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
    const { discogsReleaseId } = parsed.data;

    try {
      const { entry, release, discogs, wantlistRemoval } = await createLibraryEntry(
        uid,
        discogsReleaseId,
      );

      logger.info({ route: '/api/library', outcome: 'success', uid });
      const body = serializeEntry(entry, { catalogStatus: 'ok', release }, discogs);
      res
        .status(201)
        .json(wantlistRemoval ? { ...body, wantlistRemoval } : body);
    } catch (err) {
      if (err instanceof ReleaseNotFoundForCreationError) {
        logger.warn({ route: '/api/library', outcome: 'not_found', uid });
        res.status(404).json({
          error: 'release_not_found',
          message: 'No release found in the catalog for that ID.',
        });
        return;
      }
      if (err instanceof CatalogUnavailableForCreationError) {
        logger.warn({
          route: '/api/library',
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
      if (respondCollectionError(res, '/api/library', uid, err)) {
        return;
      }
      respondInternalError(res, '/api/library', uid, err);
    }
  },
);

libraryRouter.get(
  '/:id',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;

    try {
      const result = await getLibraryEntry(uid, req.params.id);
      if (!result) {
        logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
        res.status(404).json({
          error: 'entry_not_found',
          message: 'No record found in your library for that ID.',
        });
        return;
      }

      const { entry, enriched, discogs } = result;
      logger.info({ route: '/api/library/:id', outcome: 'success', uid });
      res
        .status(200)
        .json(
          serializeEntry(
            entry,
            { catalogStatus: enriched.catalogStatus, release: enriched.release },
            discogs,
          ),
        );
    } catch (err) {
      if (respondCollectionError(res, '/api/library/:id', uid, err)) {
        return;
      }
      respondInternalError(res, '/api/library/:id', uid, err);
    }
  },
);

libraryRouter.get(
  '/',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;
    const { page, pageSize } = parsePageParams(req);
    const filters = parseLibraryFilters(req);

    try {
      const { enriched, totalItems } = await listLibraryEntries(
        uid,
        page,
        pageSize,
        filters,
        {
          force: req.query.refresh === 'true',
        },
      );
      const serialized = enriched.map((item) =>
        serializeEntry(
          item,
          { catalogStatus: item.catalogStatus, release: item.release },
          null,
        ),
      );

      logger.info({
        route: '/api/library',
        outcome: 'success',
        uid,
        meta: { filters: Object.keys(filters) },
      });
      res.status(200).json({ items: serialized, page, pageSize, totalItems });
    } catch (err) {
      if (respondCollectionError(res, '/api/library', uid, err)) {
        return;
      }
      respondInternalError(res, '/api/library', uid, err);
    }
  },
);

const patchBodySchema = z
  .object({
    rating: z.number().int().min(0).max(5).optional(),
    mediaCondition: z.enum(MEDIA_CONDITIONS).nullable().optional(),
    sleeveCondition: z.enum(SLEEVE_CONDITIONS).nullable().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

libraryRouter.patch(
  '/:id',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
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
      const result = await updateLibraryEntry(uid, req.params.id, parsed.data);
      if (!result) {
        logger.warn({ route: '/api/library/:id', outcome: 'not_found', uid });
        res.status(404).json({
          error: 'entry_not_found',
          message: 'No record found in your library for that ID.',
        });
        return;
      }

      const { entry, enriched, discogs } = result;
      logger.info({ route: '/api/library/:id', outcome: 'success', uid });
      res
        .status(200)
        .json(
          serializeEntry(
            entry,
            { catalogStatus: enriched.catalogStatus, release: enriched.release },
            discogs,
          ),
        );
    } catch (err) {
      if (respondCollectionError(res, '/api/library/:id', uid, err)) {
        return;
      }
      respondInternalError(res, '/api/library/:id', uid, err);
    }
  },
);

libraryRouter.delete(
  '/:id',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const uid = req.auth!.uid;

    try {
      const result = await deleteLibraryEntry(uid, req.params.id);
      if (result === null) {
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
      if (respondCollectionError(res, '/api/library/:id', uid, err)) {
        return;
      }
      respondInternalError(res, '/api/library/:id', uid, err);
    }
  },
);
