import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { createTestQueryClient } from '../testUtils';

const mockSignInWithPopup = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: vi.fn(),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../src/services/firebaseClient', () => ({
  firebaseAuth: {},
  googleAuthProvider: {},
}));

vi.mock('../../src/services/feedsApi', () => ({
  getDashboard: () => Promise.resolve({ categories: [], sourceStatuses: [], generatedAt: '2026-07-08T00:00:00.000Z' }),
}));

const originalFetch = global.fetch;

describe('Sign-in flow (US2)', () => {
  beforeEach(() => {
    mockSignInWithPopup.mockReset();
    mockOnAuthStateChanged.mockReset().mockImplementation((_auth, callback) => {
      callback(null);
      return () => undefined;
    });
    global.fetch = vi.fn().mockImplementation((input: string) => {
      if (input.includes('/api/library')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          uid: 'abc123',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          photoURL: 'https://example.com/photo.png',
        }),
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('takes the visitor from the landing CTA to the Dashboard', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        uid: 'abc123',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/photo.png',
        getIdToken: async () => 'fake-id-token',
      },
    });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled(),
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument(),
    );
  });
});
