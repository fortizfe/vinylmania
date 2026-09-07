import request from 'supertest';

import { clearEmulatorUsers } from '../../helpers/authEmulator';
import { createTestSession } from '../../helpers/testSession';

const mockResolve = jest.fn();

jest.mock('../../../src/adapters/streaming/itunesSearchAdapter', () => ({
  itunesSearchAdapter: {
    platform: 'apple_music',
    resolve: (...args: unknown[]) => mockResolve(...args),
  },
}));

// Imported after the mock so the route wires the stubbed resolver.
import { createApp } from '../../../src/app';
import { logger } from '../../../src/config/logger';
import { StreamingUnavailableError } from '../../../src/domain/streaming/streamingErrors';

const app = createApp();

const MATCH = {
  platform: 'apple_music' as const,
  url: 'https://music.apple.com/es/album/master-of-puppets/1440899482',
};

describe('GET /api/streaming/links contract', () => {
  beforeEach(() => {
    mockResolve.mockReset();
  });

  afterEach(async () => {
    await clearEmulatorUsers();
  });

  async function auth() {
    const { sessionToken } = await createTestSession(`streaming-contract-${Date.now()}`);
    return sessionToken;
  }

  it('200 { links: [...] } when a resolver matches', async () => {
    mockResolve.mockResolvedValue(MATCH);
    const token = await auth();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ links: [MATCH] });
  });

  it('200 { links: [] } when the resolver returns null', async () => {
    mockResolve.mockResolvedValue(null);
    const token = await auth();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Obscure', title: 'Vinyl Only' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ links: [] });
  });

  it('200 { links: [] } when the resolver throws a StreamingResolutionError', async () => {
    mockResolve.mockRejectedValue(new StreamingUnavailableError());
    const token = await auth();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ links: [] });
  });

  it('400 invalid_request when artist is missing', async () => {
    const token = await auth();
    const res = await request(app)
      .get('/api/streaming/links')
      .query({ title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('400 invalid_request when title is blank', async () => {
    const token = await auth();
    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: '   ' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('401 without a session', async () => {
    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' });

    expect(res.status).toBe(401);
  });

  it('forwards every repeated barcode param to the resolver query', async () => {
    mockResolve.mockResolvedValue(null);
    const token = await auth();

    await request(app)
      .get(
        '/api/streaming/links?artist=Metallica&title=Master%20of%20Puppets&barcode=075596060721&barcode=856115004123',
      )
      .set('Authorization', `Bearer ${token}`);

    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({ barcodes: ['075596060721', '856115004123'] }),
    );
  });

  it('derives the storefront from the locale query param', async () => {
    mockResolve.mockResolvedValue(null);
    const token = await auth();

    await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets', locale: 'pt-BR' })
      .set('Authorization', `Bearer ${token}`);

    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({ storefront: 'BR' }),
    );
  });

  it('falls back to the Accept-Language header when there is no locale param', async () => {
    mockResolve.mockResolvedValue(null);
    const token = await auth();

    await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', 'en-US,en;q=0.9');

    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({ storefront: 'US' }),
    );
  });

  it('falls back to ES when neither a locale param nor Accept-Language is usable', async () => {
    mockResolve.mockResolvedValue(null);
    const token = await auth();

    await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', '');

    expect(mockResolve).toHaveBeenCalledWith(
      expect.objectContaining({ storefront: 'ES' }),
    );
  });

  it('returns a body with no field other than links', async () => {
    mockResolve.mockResolvedValue({ ...MATCH, method: 'barcode', score: 0.99 });
    const token = await auth();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets' })
      .set('Authorization', `Bearer ${token}`);

    expect(Object.keys(res.body)).toEqual(['links']);
    expect(Object.keys(res.body.links[0]).sort()).toEqual(['platform', 'url']);
  });
});

describe('GET /api/streaming/links structured logging contract (FR-019, T023)', () => {
  const STREAMING_ROUTE = '/api/streaming/links';

  beforeEach(() => {
    mockResolve.mockReset();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearEmulatorUsers();
  });

  async function authSession() {
    return createTestSession(`streaming-logging-${Date.now()}`);
  }

  /** Every LogEvent passed to logger.info/warn/error, in call order. */
  function loggedEvents(): Record<string, unknown>[] {
    return [
      ...(logger.info as jest.Mock).mock.calls,
      ...(logger.warn as jest.Mock).mock.calls,
      ...(logger.error as jest.Mock).mock.calls,
    ].map(([event]) => event as Record<string, unknown>);
  }

  /** Per-resolver attempt line for the streaming route (matched/no_match/transient_failure). */
  function attemptLines(): Record<string, unknown>[] {
    return loggedEvents().filter(
      (e) =>
        e.route === STREAMING_ROUTE &&
        ['matched', 'no_match', 'transient_failure'].includes(e.outcome as string),
    );
  }

  it('MATCHED: emits a per-attempt line with outcome "matched", platform, method, storefront and uid', async () => {
    mockResolve.mockResolvedValue(MATCH);
    const { sessionToken, uid } = await authSession();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({
        artist: 'Metallica',
        title: 'Master of Puppets',
        barcode: '075596060721',
        locale: 'es-ES',
      })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);

    const attempts = attemptLines();
    expect(attempts).toHaveLength(1);
    const attempt = attempts[0];
    expect(attempt.outcome).toBe('matched');

    // Assert the diagnostic dimensions wherever the LogEvent shape puts them:
    // `uid` is top-level (LogEvent.uid); platform/method/storefront live in `meta`.
    expect(attempt.uid).toBe(uid);
    expect(attempt.meta).toMatchObject({
      platform: 'apple_music',
      method: 'barcode',
      storefront: 'ES',
    });
    expect(['barcode', 'text']).toContain(
      (attempt.meta as Record<string, unknown>).method,
    );

    // The per-request summary line also fires.
    expect(loggedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: STREAMING_ROUTE,
          outcome: 'success',
          meta: { linkCount: 1 },
        }),
      ]),
    );
  });

  it('UNMATCHED: emits a per-attempt line with outcome "no_match" and the same dimensions', async () => {
    mockResolve.mockResolvedValue(null);
    const { sessionToken, uid } = await authSession();

    const res = await request(app)
      .get('/api/streaming/links')
      // no barcode → text-search method
      .query({ artist: 'Obscure', title: 'Vinyl Only', locale: 'es-ES' })
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);

    const attempts = attemptLines();
    expect(attempts).toHaveLength(1);
    const attempt = attempts[0];
    expect(attempt.outcome).toBe('no_match');
    expect(attempt.uid).toBe(uid);
    expect(attempt.meta).toMatchObject({
      platform: 'apple_music',
      method: 'text',
      storefront: 'ES',
    });

    expect(loggedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: STREAMING_ROUTE,
          outcome: 'success',
          meta: { linkCount: 0 },
        }),
      ]),
    );
  });

  it('never leaks internal error detail (upstream body, stack) to a log line or the 200 body', async () => {
    const upstreamSecret = '<html>itunes 503 internal upstream body SECRET_TOKEN_abc</html>';
    mockResolve.mockRejectedValue(
      new StreamingUnavailableError(new Error(upstreamSecret)),
    );
    const { sessionToken } = await authSession();

    const res = await request(app)
      .get('/api/streaming/links')
      .query({ artist: 'Metallica', title: 'Master of Puppets', locale: 'es-ES' })
      .set('Authorization', `Bearer ${sessionToken}`);

    // Contract: always 200, body carries links only — no error/message/stack.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ links: [] });

    const serialized = JSON.stringify(loggedEvents());
    expect(serialized).not.toContain('SECRET_TOKEN_abc');
    expect(serialized).not.toContain('internal upstream body');
    // No raw stack traces in any structured field.
    expect(serialized).not.toContain('\\n    at ');
    for (const event of loggedEvents()) {
      expect(event).not.toHaveProperty('stack');
      expect(event.meta ?? {}).not.toHaveProperty('stack');
    }

    // The per-request summary still fires for a silently-degraded request.
    expect(loggedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: STREAMING_ROUTE,
          outcome: 'success',
          meta: { linkCount: 0 },
        }),
      ]),
    );
  });
});
