import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { logger } from '../config/logger';
import { DiscogsError } from '../discogs/discogsErrors';
import {
  completeLink,
  disconnect,
  DiscogsOauthFlowError,
  getConnection,
  getStatus,
  startLink,
} from '../discogs/oauth/discogsOauthService';
import { requireAuth } from '../middleware/requireAuth';

export const discogsOauthRouter = Router();

discogsOauthRouter.use(requireAuth);

const ALREADY_CONNECTED = {
  error: 'already_connected',
  message: 'Your Discogs account is already linked. Disconnect it first to link again.',
} as const;

const completeBodySchema = z.object({
  oauthToken: z.string().min(1),
  oauthVerifier: z.string().min(1),
});

function handleFailure(
  res: Response,
  route: string,
  uid: string | undefined,
  err: unknown,
): void {
  if (err instanceof DiscogsOauthFlowError) {
    const responses: Record<
      DiscogsOauthFlowError['code'],
      { status: number; message: string }
    > = {
      already_connected: { status: 409, message: ALREADY_CONNECTED.message },
      expired_request: {
        status: 400,
        message: 'This link attempt expired. Please start again from your profile.',
      },
      invalid_request: {
        status: 400,
        message: 'This link attempt is not valid. Please start again from your profile.',
      },
    };
    const { status, message } = responses[err.code];
    res.status(status).json({ error: err.code, message });
    return;
  }

  if (err instanceof DiscogsError && err.code === 'rate_limited') {
    res.status(429).json({
      error: 'discogs_rate_limited',
      message:
        'Discogs is receiving too many requests right now. Please try again in a moment.',
    });
    return;
  }

  if (err instanceof DiscogsError) {
    res.status(503).json({
      error: 'discogs_unavailable',
      message: 'Discogs is temporarily unavailable. Please try again later.',
    });
    return;
  }

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

discogsOauthRouter.post('/request', async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  try {
    if (await getConnection(uid)) {
      res.status(409).json(ALREADY_CONNECTED);
      return;
    }
    const { authorizeUrl } = await startLink(uid);
    res.status(200).json({ authorizeUrl });
  } catch (err) {
    handleFailure(res, '/api/discogs/oauth/request', uid, err);
  }
});

discogsOauthRouter.post('/complete', async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  const parsed = completeBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'validation_error',
      message: 'The link request is malformed.',
    });
    return;
  }

  try {
    if (await getConnection(uid)) {
      res.status(409).json(ALREADY_CONNECTED);
      return;
    }
    const status = await completeLink(
      uid,
      parsed.data.oauthToken,
      parsed.data.oauthVerifier,
    );
    res.status(200).json(status);
  } catch (err) {
    handleFailure(res, '/api/discogs/oauth/complete', uid, err);
  }
});

discogsOauthRouter.delete('/connection', async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  try {
    await disconnect(uid);
    res.status(204).send();
  } catch (err) {
    handleFailure(res, '/api/discogs/oauth/connection', uid, err);
  }
});

discogsOauthRouter.get('/status', async (req: Request, res: Response) => {
  const uid = req.auth!.uid;
  try {
    res.status(200).json(await getStatus(uid));
  } catch (err) {
    handleFailure(res, '/api/discogs/oauth/status', uid, err);
  }
});
