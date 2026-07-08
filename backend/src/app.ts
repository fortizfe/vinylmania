import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { logger } from './config/logger';
import { authRouter } from './routes/auth';
import { discogsRouter } from './routes/discogs';
import { discogsOauthRouter } from './routes/discogsOauth';
import { feedsRouter } from './routes/feeds';
import { libraryRouter } from './routes/library';

export function createApp(): express.Express {
  const app = express();

  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  // Mounted before /api/discogs so the more specific OAuth path wins.
  app.use('/api/discogs/oauth', discogsOauthRouter);
  app.use('/api/discogs', discogsRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/feeds', feedsRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ route: 'unhandled', outcome: 'error', message: err.message });
    res.status(500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  });

  return app;
}
