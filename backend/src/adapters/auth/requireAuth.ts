import type { NextFunction, Request, Response } from 'express';

import { logger } from '../../config/logger';
import type { AuthVerifierPort } from '../../ports/auth/authVerifierPort';
import { firebaseAuthVerifierAdapter } from './firebaseAuthVerifierAdapter';

const BEARER_PREFIX = 'Bearer ';

export function createRequireAuth(deps: { authVerifier: AuthVerifierPort }) {
  return async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = req.headers.authorization;

    if (!header || !header.startsWith(BEARER_PREFIX)) {
      logger.warn({
        route: req.path,
        outcome: 'unauthorized',
        message: 'missing bearer token',
      });
      res.status(401).json({
        error: 'unauthorized',
        message: 'Sign-in required or session expired.',
      });
      return;
    }

    const token = header.slice(BEARER_PREFIX.length);

    try {
      req.auth = await deps.authVerifier.verifyIdToken(token);
      logger.info({ route: req.path, outcome: 'verified', uid: req.auth.uid });
      next();
    } catch (err) {
      logger.warn({
        route: req.path,
        outcome: 'unauthorized',
        message: err instanceof Error ? err.message : 'token verification failed',
      });
      res.status(401).json({
        error: 'unauthorized',
        message: 'Sign-in required or session expired.',
      });
    }
  };
}

export const requireAuth = createRequireAuth({ authVerifier: firebaseAuthVerifierAdapter });
