import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { clearSessionToken, getSessionToken, setSessionToken } from '../../src/services/sessionStore';

const originalFetch = global.fetch;
const originalAssign = window.location.assign;

const PROFILE = {
  uid: 'abc123',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  photoURL: 'https://example.com/photo.png',
};

function TestConsumer() {
  const { user, loading, error, signIn, signOut } = useAuth();

  if (loading) return <p>loading</p>;

  return (
    <div>
      <p data-testid="user">{user ? user.displayName : 'anonymous'}</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={signIn}>sign-in</button>
      <button onClick={signOut}>sign-out</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location.assign = originalAssign;
    clearSessionToken();
  });

  it('has no firebase/auth import (no SDK listener) — starts signed out with no stored session', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
  });

  it('signIn() performs a full-page navigation to the backend authorize URL, not a fetch/SDK call', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));

    const user = userEvent.setup();
    await user.click(screen.getByText('sign-in'));

    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google/authorize'),
    );
  });

  it('silently restores an existing session from a stored token on mount', async () => {
    setSessionToken('existing-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => PROFILE,
    }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it('does not call the backend at all on mount when no session token is stored', async () => {
    global.fetch = vi.fn();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('signOut() calls DELETE /api/auth/session, clears the stored token, and clears the user', async () => {
    setSessionToken('existing-token');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => PROFILE })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe'));

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('sign-out'));
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/auth/session'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
    expect(getSessionToken()).toBeNull();
  });

  it('a registered 401 handler (from apiClient) clears the signed-in user', async () => {
    setSessionToken('existing-token');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => PROFILE })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized', message: 'Sign-in required or session expired.' }),
      }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe'));

    const { authorizedFetch } = await import('../../src/services/apiClient');
    await act(async () => {
      await authorizedFetch('/api/library').catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anonymous'));
  });

  it('exposes no signingIn state — that UX now lives on the login callback page, not AuthContext', () => {
    let ctxValue: Record<string, unknown> | undefined;
    function Probe() {
      ctxValue = useAuth() as unknown as Record<string, unknown>;
      return null;
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(ctxValue).toBeDefined();
    expect(ctxValue).not.toHaveProperty('signingIn');
  });
});
