import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, authorizedFetch, setUnauthorizedHandler } from '../../src/services/apiClient';
import { clearSessionToken, getSessionToken, setSessionToken } from '../../src/services/sessionStore';

const originalFetch = global.fetch;

describe('authorizedFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches Authorization from the session store when a token is present', async () => {
    setSessionToken('stored-token');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    await authorizedFetch('/api/library');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/library'),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer stored-token');
  });

  it('sends no Authorization header when no token is stored', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    await authorizedFetch('/api/library');

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Headers).has('Authorization')).toBe(false);
  });

  it('clears the stored token and invokes the registered handler on a 401 response', async () => {
    setSessionToken('stored-token');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized', message: 'Sign-in required or session expired.' }),
    }) as unknown as typeof fetch;

    await expect(authorizedFetch('/api/library')).rejects.toBeInstanceOf(ApiError);

    expect(getSessionToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the handler on a non-401 error', async () => {
    setSessionToken('stored-token');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal_error', message: 'boom' }),
    }) as unknown as typeof fetch;

    await expect(authorizedFetch('/api/library')).rejects.toBeInstanceOf(ApiError);

    expect(getSessionToken()).toBe('stored-token');
    expect(handler).not.toHaveBeenCalled();
  });

  afterEach(() => {
    clearSessionToken();
  });
});
