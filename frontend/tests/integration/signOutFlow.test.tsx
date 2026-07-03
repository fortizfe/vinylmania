import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../src/services/firebaseClient', () => ({
  firebaseAuth: {},
  googleAuthProvider: {},
}));

const originalFetch = global.fetch;

describe('Sign-out flow (US3)', () => {
  beforeEach(() => {
    mockSignInWithPopup.mockReset();
    mockSignOut.mockReset().mockResolvedValue(undefined);
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

  it('returns the user to the anonymous landing page after signing out', async () => {
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
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled(),
    );
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    });

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /sign out/i }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('landing-viewport')).toBeInTheDocument(),
    );
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
