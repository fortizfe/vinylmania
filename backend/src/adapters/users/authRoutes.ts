import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { createUserProfileUseCases } from '../../application/users/userProfileUseCases';
import { createLogoutSessionUseCase } from '../../application/auth/logoutSession';
import { logger } from '../../config/logger';
import { firestoreSessionStoreAdapter } from '../auth/firestoreSessionStoreAdapter';
import { requireAuth } from '../auth/requireAuth';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { firestoreUserRepository } from './firestoreUserRepository';

export const authRouter = Router();

const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.standard,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

const BEARER_PREFIX = 'Bearer ';

const preferencesBodySchema = z.object({
  themePreference: z.enum(['light', 'dark']),
});

const { getUserProfile, updateThemePreference } = createUserProfileUseCases({
  userRepository: firestoreUserRepository,
});
const logoutSession = createLogoutSessionUseCase({ sessionStore: firestoreSessionStoreAdapter });

authRouter.delete('/session', standardRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization ?? '';
    const sessionToken = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : '';
    await logoutSession(sessionToken);
    res.status(204).send();
  } catch (err) {
    logger.error({
      route: '/api/auth/session',
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

authRouter.patch('/preferences', standardRateLimit, requireAuth, async (req: Request, res: Response) => {
  const auth = req.auth!;
  const parsed = preferencesBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'validation_error',
      message: 'The preference value is not valid.',
    });
    return;
  }

  try {
    const user = await updateThemePreference(auth.uid, parsed.data.themePreference);
    logger.info({
      route: '/api/auth/preferences',
      outcome: 'preference_saved',
      uid: auth.uid,
    });
    res.status(200).json(user);
  } catch (err) {
    logger.error({
      route: '/api/auth/preferences',
      outcome: 'preference_save_failed',
      uid: auth.uid,
      message: err instanceof Error ? err.message : 'unknown error',
    });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  }
});

authRouter.get('/me', standardRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = req.auth!;
    const user = await getUserProfile(auth.uid);

    if (!user) {
      logger.warn({ route: '/api/auth/me', outcome: 'unauthorized', uid: auth.uid });
      res.status(401).json({
        error: 'unauthorized',
        message: 'Sign-in required or session expired.',
      });
      return;
    }

    res.status(200).json(user);
  } catch (err) {
    logger.error({
      route: '/api/auth/me',
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
