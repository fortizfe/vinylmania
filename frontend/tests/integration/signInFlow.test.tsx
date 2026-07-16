import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { createTestQueryClient } from '../testUtils';

vi.mock('../../src/services/feedsApi', () => ({
  getDashboard: () =>
    Promise.resolve({
      categories: [],
      sourceStatuses: [],
      generatedAt: '2026-07-08T00:00:00.000Z',
    }),
}));

const originalFetch = global.fetch;

const PROFILE = {
  uid: 'abc123',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  photoURL: 'https://example.com/photo.png',
};

describe('Sign-in flow (US2)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (input.includes('/api/auth/google/complete')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ sessionToken: 'fresh-session-token', user: PROFILE }),
        });
      }
      if (input.includes('/api/library')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => PROFILE });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('lands authenticated on the Dashboard after returning from Google via /login/callback', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/login/callback?code=auth-code&state=abc']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/google/complete'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    await waitFor(() => expect(screen.getByText(/check back soon/i)).toBeInTheDocument());
  });

  it('shows the "Sign in with Google" control on the landing page for a first-time, unauthenticated visitor', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled(),
    );
  });
});
