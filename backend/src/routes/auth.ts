import { Router, type Request, type Response } from 'express';

import { logger } from '../config/logger';
import { requireAuth } from '../middleware/requireAuth';
import { getOrCreateUser, getUser } from '../services/userService';

export const authRouter = Router();

authRouter.post('/session', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = req.auth!;
    const user = await getOrCreateUser({
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

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = req.auth!;
    const user = await getUser(auth.uid);

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
