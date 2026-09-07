import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { createResolveStreamingLinksUseCase } from '../../application/streaming/resolveStreamingLinks';
import { logger } from '../../config/logger';
import type { StreamingLinkQuery } from '../../domain/streaming/types';
import { requireAuth } from '../auth/requireAuth';
import { cacheAdapter } from '../cache/cacheAdapter';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { itunesSearchAdapter } from './itunesSearchAdapter';
import { localeToStorefront } from './storefront';

const ROUTE = '/api/streaming/links';

/**
 * The registered streaming resolvers, in the order their links are returned.
 *
 * ── To add a streaming platform ────────────────────────────────────────────
 * 1. Implement `StreamingResolverPort` in `adapters/streaming/<x>Adapter.ts`
 *    (mirror `itunesSearchAdapter.ts`), and add the platform id to
 *    `StreamingPlatform` in `domain/streaming/types.ts`.
 * 2. Add it to this array.
 * 3. Add a frontend platform-metadata row + icon in
 *    `frontend/src/components/StreamingLinksSection.tsx`.
 * Nothing else changes — not the `resolveStreamingLinks` use case, not the
 * `matching` domain, not any other platform's adapter.
 */
const resolvers = [itunesSearchAdapter];

const { resolveStreamingLinks } = createResolveStreamingLinksUseCase({
  resolvers,
  cache: cacheAdapter,
});

export const streamingRouter = Router();

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/** A repeatable `?barcode=` param → array (0..n), non-strings dropped. */
function barcodeList(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

streamingRouter.get(
  '/links',
  standardRateLimit,
  requireAuth,
  async (req: Request, res: Response) => {
    const artist = firstString(req.query.artist)?.trim();
    const title = firstString(req.query.title)?.trim();

    if (!artist || !title) {
      res
        .status(400)
        .json({ error: 'invalid_request', message: 'artist and title are required.' });
      return;
    }

    const storefront = localeToStorefront(
      firstString(req.query.locale),
      req.headers['accept-language'],
    );
    const query: StreamingLinkQuery = {
      artist,
      title,
      barcodes: barcodeList(req.query.barcode),
      storefront,
    };

    try {
      const { links } = await resolveStreamingLinks(query, { uid: req.auth?.uid });
      logger.info({
        route: ROUTE,
        outcome: 'success',
        uid: req.auth?.uid,
        meta: { linkCount: links.length },
      });
      res.status(200).json({ links });
    } catch (err) {
      // The section must degrade silently — an internal failure is never
      // surfaced to the client as a non-200 (contract: always 200).
      logger.error({
        route: ROUTE,
        outcome: 'error',
        uid: req.auth?.uid,
        message: err instanceof Error ? err.message : 'unknown error',
      });
      res.status(200).json({ links: [] });
    }
  },
);
