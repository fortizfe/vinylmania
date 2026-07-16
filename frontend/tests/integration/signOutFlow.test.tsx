import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { setSessionToken } from '../../src/services/sessionStore';
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

describe('Sign-out flow (US3)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSessionToken('existing-session-token');
    global.fetch = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (init?.method === 'DELETE' && input.includes('/api/auth/session')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
      }
      if (input.includes('/api/library')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => PROFILE });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('returns the user to the anonymous landing page after signing out', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/app']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText(/check back soon/i)).toBeInTheDocument());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /sign out/i }));
    });

    await waitFor(() => expect(screen.getByTestId('landing-viewport')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/session'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
