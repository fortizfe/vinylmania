import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { logger } from '../../config/logger';
import { GoogleAuthFlowError } from '../../domain/googleAuth/googleAuthErrors';
import { createCompleteLoginUseCase } from '../../application/googleAuth/completeLogin';
import { createStartLoginUseCase } from '../../application/googleAuth/startLogin';
import { createUserProfileUseCases } from '../../application/users/userProfileUseCases';
import { firebaseIdentityResolverAdapter } from '../auth/firebaseIdentityResolverAdapter';
import { firestoreSessionStoreAdapter } from '../auth/firestoreSessionStoreAdapter';
import {
  RATE_LIMIT_MESSAGE,
  RATE_LIMIT_THRESHOLDS,
  RATE_LIMIT_WINDOW_MS,
  rateLimitHandler,
} from '../rateLimit/rateLimitOptions';
import { createRateLimitStore } from '../rateLimit/rateLimitStore';
import { firestoreUserRepository } from '../users/firestoreUserRepository';
import { googleIdentityAdapter } from './googleIdentityAdapter';

export const googleAuthRouter = Router();

const strictRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_THRESHOLDS.strict,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  handler: rateLimitHandler,
  store: createRateLimitStore(),
});

const APP_CALLBACK_URL = 'vinylmania://auth/callback';
const RELAYED_PARAMS = ['code', 'error', 'state'] as const;

const MALFORMED = {
  error: 'validation_error',
  message: 'The sign-in request is malformed.',
} as const;

const authorizeQuerySchema = z.union([
  z.object({ client: z.literal('web').optional(), code_challenge: z.undefined() }),
  z.object({
    client: z.literal('native'),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  }),
]);

const completeBodySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1),
    error: z.string().optional(),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(),
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

googleAuthRouter.get('/authorize', strictRateLimit, async (req: Request, res: Response) => {
  const parsed = authorizeQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json(MALFORMED);
    return;
  }

  try {
    const { authorizeUrl } = await startLogin({
      client: parsed.data.client ?? 'web',
      codeChallenge: parsed.data.code_challenge,
    });
    res.redirect(302, authorizeUrl);
  } catch (err) {
    handleFailure(res, '/api/auth/google/authorize', err);
  }
});

googleAuthRouter.post('/complete', strictRateLimit, async (req: Request, res: Response) => {
  const parsed = completeBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(MALFORMED);
    return;
  }

  try {
    const result = await completeLogin({
      state: parsed.data.state,
      code: parsed.data.code,
      denied: parsed.data.error === 'access_denied',
      codeVerifier: parsed.data.codeVerifier,
    });
    res.status(200).json(result);
  } catch (err) {
    handleFailure(res, '/api/auth/google/complete', err);
  }
});

// Google redirects native logins here (a web OAuth client rejects custom-scheme
// redirect URIs). Relays only the whitelisted params to the fixed app URL, so
// there is no open redirect. No state lookup: /complete validates state + PKCE.
googleAuthRouter.get('/native/callback', strictRateLimit, (req: Request, res: Response) => {
  if (typeof req.query.state !== 'string' || !req.query.state) {
    res.status(400).json(MALFORMED);
    return;
  }

  const params = new URLSearchParams();
  for (const key of RELAYED_PARAMS) {
    const value = req.query[key];
    if (typeof value === 'string') params.set(key, value);
  }
  res.redirect(302, `${APP_CALLBACK_URL}?${params}`);
});
