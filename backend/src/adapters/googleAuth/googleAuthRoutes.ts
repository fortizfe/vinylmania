import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { logger } from '../../config/logger';
import { GoogleAuthFlowError } from '../../domain/googleAuth/googleAuthErrors';
import { createCompleteLoginUseCase } from '../../application/googleAuth/completeLogin';
import { createStartLoginUseCase } from '../../application/googleAuth/startLogin';
import { createUserProfileUseCases } from '../../application/users/userProfileUseCases';
import { firebaseIdentityResolverAdapter } from '../auth/firebaseIdentityResolverAdapter';
import { firestoreSessionStoreAdapter } from '../auth/firestoreSessionStoreAdapter';
import { requireRateLimit } from '../rateLimit/requireRateLimit';
import { firestoreUserRepository } from '../users/firestoreUserRepository';
import { googleIdentityAdapter } from './googleIdentityAdapter';

export const googleAuthRouter = Router();

const completeBodySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1),
    error: z.string().optional(),
  })
  .refine((data) => Boolean(data.code) || Boolean(data.error), {
    message: 'Either code or error must be present.',
  });

const startLogin = createStartLoginUseCase({ googleIdentity: googleIdentityAdapter });
const { createOrRefreshSession } = createUserProfileUseCases({
  userRepository: firestoreUserRepository,
});
const completeLogin = createCompleteLoginUseCase({
  googleIdentity: googleIdentityAdapter,
  identityResolver: firebaseIdentityResolverAdapter,
  sessionStore: firestoreSessionStoreAdapter,
  syncUserProfile: createOrRefreshSession,
});

function handleFailure(res: Response, route: string, err: unknown): void {
  if (err instanceof GoogleAuthFlowError) {
    const responses: Record<GoogleAuthFlowError['code'], { status: number; message: string }> = {
      denied: { status: 400, message: 'Sign-in was cancelled.' },
      invalid_state: {
        status: 400,
        message: 'This sign-in attempt is not valid. Please try signing in again.',
      },
      expired_state: {
        status: 400,
        message: 'This sign-in attempt expired. Please try signing in again.',
      },
      exchange_failed: {
        status: 502,
        message: 'We could not reach the sign-in service. Please try again.',
      },
    };
    const { status, message } = responses[err.code];
    res.status(status).json({ error: err.code, message });
    return;
  }

  logger.error({
    route,
    outcome: 'error',
    message: err instanceof Error ? err.message : 'unknown error',
  });
  res.status(500).json({
    error: 'internal_error',
    message: 'Something went wrong. Please try again.',
  });
}

googleAuthRouter.get('/authorize', requireRateLimit('strict'), async (_req: Request, res: Response) => {
  try {
    const { authorizeUrl } = await startLogin();
    res.redirect(302, authorizeUrl);
  } catch (err) {
    handleFailure(res, '/api/auth/google/authorize', err);
  }
});

googleAuthRouter.post('/complete', requireRateLimit('strict'), async (req: Request, res: Response) => {
  const parsed = completeBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'validation_error',
      message: 'The sign-in request is malformed.',
    });
    return;
  }

  try {
    const result = await completeLogin({
      state: parsed.data.state,
      code: parsed.data.code,
      denied: parsed.data.error === 'access_denied',
    });
    res.status(200).json(result);
  } catch (err) {
    handleFailure(res, '/api/auth/google/complete', err);
  }
});
