import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { createUserProfileUseCases } from '../../application/users/userProfileUseCases';
import { logger } from '../../config/logger';
import { requireAuth } from '../auth/requireAuth';
import { firestoreUserRepository } from './firestoreUserRepository';

export const authRouter = Router();

const preferencesBodySchema = z.object({
  themePreference: z.enum(['light', 'dark']),
});

const { createOrRefreshSession, getUserProfile, updateThemePreference } = createUserProfileUseCases({
  userRepository: firestoreUserRepository,
});

authRouter.post('/session', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = req.auth!;
    const user = await createOrRefreshSession({
      uid: auth.uid,
      email: auth.email,
      displayName: auth.name ?? auth.email,
      photoURL: auth.picture,
    });
    logger.info({ route: '/api/auth/session', outcome: 'verified', uid: auth.uid });
    res.status(200).json(user);
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

authRouter.patch('/preferences', requireAuth, async (req: Request, res: Response) => {
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

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
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
