import type { NextFunction, Request, Response } from 'express';

import { getFirebaseAuth } from '../config/firebase-admin';
import { logger } from '../config/logger';

const BEARER_PREFIX = 'Bearer ';

export async function requireAuth(
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
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    req.auth = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: decoded.name,
      picture: decoded.picture,
    };
    logger.info({ route: req.path, outcome: 'verified', uid: decoded.uid });
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
}
