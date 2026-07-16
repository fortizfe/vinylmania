import Redis from 'ioredis';

import { logger } from '../config/logger';

let client: Redis | null | undefined;

// Lazily constructed, memoized across invocations of the same warm
// serverless container — mirrors getFirebaseApp() in config/firebase-admin.ts,
// since a fresh ioredis connection per request would exhaust connections.
export function getRedisClient(): Redis | null {
  if (client !== undefined) {
    return client;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return client;
  }

  client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
  client.on('error', (err: Error) => {
    logger.warn({ route: 'redis', outcome: 'cache_unavailable', message: err.message });
  });

  return client;
}
