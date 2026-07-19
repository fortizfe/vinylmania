import type { NextFunction, Request, Response } from 'express';

import { logger } from '../../config/logger';
import type { RateLimiterPort, RateLimitTier } from '../../ports/rateLimit/rateLimiterPort';
import { redisRateLimiterAdapter } from './redisRateLimiterAdapter';

export function createRequireRateLimit(deps: { rateLimiter: RateLimiterPort }) {
  return (tier: RateLimitTier) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const decision = await deps.rateLimiter.checkAndIncrement(tier, req.ip ?? 'unknown');

      if (decision.limited) {
        logger.warn({ route: req.path, outcome: 'rate_limited' });
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res.status(429).json({
          error: 'rate_limited',
          message: 'Too many requests. Please try again shortly.',
        });
        return;
      }

      next();
    };
}

export const requireRateLimit = createRequireRateLimit({ rateLimiter: redisRateLimiterAdapter });
